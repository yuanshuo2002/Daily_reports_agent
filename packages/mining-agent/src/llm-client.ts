/**
 * LLM 抽象层
 *
 * 支持多种大模型提供商：
 * - Anthropic (Claude)
 * - OpenAI (GPT-4)
 * - DeepSeek
 * - 兼容 OpenAI 接口的其他模型 (硅基流动、阿里云等)
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';

dotenv.config();

// 提供商配置
export interface LLMConfig {
  provider: 'anthropic' | 'openai' | 'deepseek' | 'compatible';
  model: string;
  apiKey: string;
  baseUrl?: string;  // 用于兼容 OpenAI 接口的模型
}

// 可用模型列表
export const AVAILABLE_MODELS = [
  // Anthropic
  { id: 'claude-opus-4-7', name: 'Claude Opus 4.7', provider: 'anthropic', description: '最强推理能力' },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'anthropic', description: '平衡性能' },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', provider: 'anthropic', description: '快速响应' },

  // OpenAI
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', description: '最新 GPT-4' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai', description: '高性能' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai', description: '快速低成本' },

  // DeepSeek
  { id: 'deepseek-chat', name: 'DeepSeek Chat', provider: 'deepseek', description: '深度求索对话模型' },

  // 兼容接口 (需要配置 baseUrl)
  { id: 'compatible', name: '兼容模式', provider: 'compatible', description: '自定义 API 端点' },
] as const;

// 获取模型信息
export function getModelInfo(modelId: string) {
  return AVAILABLE_MODELS.find(m => m.id === modelId) || AVAILABLE_MODELS[0];
}

// 获取环境变量中的配置
export function getEnvConfig(provider: string): Partial<LLMConfig> {
  const configs: Record<string, Partial<LLMConfig>> = {
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-7',
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      baseUrl: process.env.OPENAI_BASE_URL,
    },
    deepseek: {
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      baseUrl: 'https://api.deepseek.com',
    },
    compatible: {
      apiKey: process.env.COMPATIBLE_API_KEY || '',
      model: process.env.COMPATIBLE_MODEL || 'gpt-4o',
      baseUrl: process.env.COMPATIBLE_BASE_URL || '',
    },
  };

  return configs[provider] || configs.anthropic;
}

// LLM 客户端接口
export interface LLMResponse {
  content: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  model: string;
}

export interface LLMClient {
  generate(prompt: string, options?: {
    maxTokens?: number;
    temperature?: number;
  }): Promise<LLMResponse>;
}

// Anthropic 客户端
export class AnthropicClient implements LLMClient {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async generate(prompt: string, options?: { maxTokens?: number; temperature?: number }): Promise<LLMResponse> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature ?? 0.7,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    return {
      content: content.type === 'text' ? content.text : '',
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      model: this.model,
    };
  }
}

// OpenAI 兼容客户端
export class OpenAIClient implements LLMClient {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string, baseUrl?: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: baseUrl,
    });
    this.model = model;
  }

  async generate(prompt: string, options?: { maxTokens?: number; temperature?: number }): Promise<LLMResponse> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature ?? 0.7,
      messages: [{ role: 'user', content: prompt }],
    });

    const choice = response.choices[0];
    return {
      content: choice.message.content || '',
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
      },
      model: this.model,
    };
  }
}

// DeepSeek 客户端
export class DeepSeekClient extends OpenAIClient {
  constructor(apiKey: string, model: string = 'deepseek-chat') {
    super(apiKey, model, 'https://api.deepseek.com');
  }
}

// LLM 工厂函数
export function createLLMClient(config: LLMConfig): LLMClient {
  switch (config.provider) {
    case 'anthropic':
      return new AnthropicClient(config.apiKey, config.model);
    case 'openai':
      return new OpenAIClient(config.apiKey, config.model, config.baseUrl);
    case 'deepseek':
      return new DeepSeekClient(config.apiKey, config.model);
    case 'compatible':
      return new OpenAIClient(config.apiKey, config.model, config.baseUrl);
    default:
      throw new Error(`不支持的提供商: ${config.provider}`);
  }
}

// 便捷函数：使用环境变量创建客户端
export function createLLMClientFromEnv(modelId: string = 'claude-opus-4-7'): LLMClient {
  const modelInfo = getModelInfo(modelId);
  const envConfig = getEnvConfig(modelInfo.provider);

  const config: LLMConfig = {
    provider: modelInfo.provider,
    model: modelId === 'compatible' ? (process.env.COMPATIBLE_MODEL || 'gpt-4o') : modelId,
    apiKey: envConfig.apiKey || '',
    baseUrl: envConfig.baseUrl,
  };

  return createLLMClient(config);
}

// 检查是否配置了 API 密钥
export function isLLMConfigured(modelId: string = 'claude-opus-4-7'): boolean {
  const modelInfo = getModelInfo(modelId);
  const envConfig = getEnvConfig(modelInfo.provider);
  return !!envConfig.apiKey;
}

// 获取所有可用模型列表（用于前端）
export function getModelsForUI(): Array<{
  id: string;
  name: string;
  provider: string;
  description: string;
  configured: boolean;
}> {
  return AVAILABLE_MODELS.map(model => {
    const envConfig = getEnvConfig(model.provider);
    return {
      id: model.id,
      name: model.name,
      provider: model.provider,
      description: model.description,
      configured: !!envConfig.apiKey,
    };
  });
}
