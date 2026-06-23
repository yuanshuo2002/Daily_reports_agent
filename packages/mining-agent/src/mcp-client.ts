/**
 * MCP工具客户端
 *
 * 使用child_process与MCP服务器通过stdio通信
 */

import { spawn } from 'child_process';
import { EventEmitter } from 'events';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface MCPResponse {
  content?: Array<{ type: string; text: string }>;
  isError?: boolean;
}

export class MCPToolClient extends EventEmitter {
  private process: ReturnType<typeof spawn> | null = null;
  private messageId: number = 0;
  private pendingRequests: Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }> = new Map();
  private buffer: string = '';
  private connected: boolean = false;
  private tools: MCPTool[] = [];

  constructor(
    public readonly command: string,
    public readonly args: string[],
    public readonly name: string
  ) {
    super();
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    return new Promise((resolve, reject) => {
      this.process = spawn(this.command, this.args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
      });

      this.process.stdout?.on('data', (data: Buffer) => {
        this.buffer += data.toString();
        this.processBuffer();
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        const error = data.toString();
        if (error.includes('running on stdio')) {
          console.error(`[${this.name}] Connected`);
        } else if (error.includes('Error')) {
          console.error(`[${this.name}] Error:`, error);
        }
      });

      this.process.on('error', (error) => {
        console.error(`[${this.name}] Process error:`, error);
        reject(error);
      });

      this.process.on('close', (code) => {
        console.error(`[${this.name}] Process closed with code:`, code);
        this.connected = false;
      });

      // 等待300ms后加载工具（进程启动需要时间）
      setTimeout(async () => {
        try {
          await this.loadTools();
          this.connected = true;
          resolve();
        } catch (error) {
          console.error(`[${this.name}] Failed to load tools:`, error);
          this.connected = true; // 仍然标记为已连接，后续会使用mock数据
          resolve();
        }
      }, 300);
    });
  }

  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const message = JSON.parse(line);

        // 处理JSON-RPC响应
        if (message.id && this.pendingRequests.has(message.id)) {
          const pending = this.pendingRequests.get(message.id)!;
          this.pendingRequests.delete(message.id);

          if (message.error) {
            pending.reject(new Error(message.error.message || message.error));
          } else {
            pending.resolve(message.result);
          }
        }
      } catch {
        // 忽略非JSON输出
      }
    }
  }

  private async loadTools(): Promise<void> {
    try {
      const response = await this.request('tools/list', {});
      this.tools = (response as { tools: MCPTool[] }).tools || [];
      console.error(`[${this.name}] Loaded ${this.tools.length} tools`);
    } catch (error) {
      console.error(`[${this.name}] Failed to load tools:`, error);
      this.tools = [];
    }
  }

  private request(method: string, params: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.process || !this.process.stdin) {
        reject(new Error('Process not connected'));
        return;
      }

      const id = ++this.messageId;
      const message = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      this.pendingRequests.set(id, { resolve, reject });
      this.process.stdin.write(JSON.stringify(message) + '\n');

      // 超时处理 - 默认10秒（由调用方控制具体超时）
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request ${method} timed out`));
        }
      }, 10000);
    });
  }

  getTools(): MCPTool[] {
    return this.tools;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.connected) {
      throw new Error('Not connected. Call connect() first.');
    }

    try {
      const response = await this.request('tools/call', { name, arguments: args });
      const result = response as MCPResponse;

      if (result.isError) {
        throw new Error((result.content?.[0] as { text: string })?.text || 'Unknown error');
      }

      if (result.content && result.content[0]?.type === 'text') {
        try {
          return JSON.parse(result.content[0].text);
        } catch {
          return result.content[0].text;
        }
      }

      return result;
    } catch (error) {
      console.error(`[${this.name}] Tool call failed:`, error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.connected = false;
    this.tools = [];
  }
}
