/**
 * MCP工具客户端
 *
 * 连接并调用MCP服务器的stdio接口
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientParameters } from '@modelcontextprotocol/sdk/client/stdio.js';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export class MCPToolClient {
  private client: Client;
  private toolList: MCPTool[] = [];

  constructor(command: string, args: string[], name: string) {
    this.client = new Client(
      {
        name,
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.connect(command, args);
  }

  private async connect(command: string, args: string[]): Promise<void> {
    const params: StdioClientParameters = {
      command,
      args,
    };

    await this.client.connect(params);
    await this.loadTools();
  }

  private async loadTools(): Promise<void> {
    const response = await this.client.request(
      { method: 'tools/list' },
      { method: 'tools/list', params: {} }
    );
    this.toolList = response.tools as MCPTool[];
  }

  getTools(): MCPTool[] {
    return this.toolList;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const response = await this.client.request(
      { method: 'tools/call', params: { name, arguments: args } },
      { method: 'tools/call', params: { name, arguments: args } }
    );

    // 解析响应内容
    const content = (response as { content: Array<{ type: string; text: string }> }).content;
    if (content && content.length > 0 && content[0].type === 'text') {
      try {
        return JSON.parse(content[0].text);
      } catch {
        return content[0].text;
      }
    }
    return response;
  }

  async disconnect(): Promise<void> {
    await this.client.close();
  }
}
