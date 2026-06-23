/**
 * Web服务器
 *
 * 提供UI界面和API接口
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// 加载 .env 文件，确保能找到 packages/mining-agent/.env
dotenv.config({ path: path.join(process.cwd(), '.env') });

import express from 'express';
import { MiningAgent } from './agent.js';
import { getModelsForUI, getModelInfo } from './llm-client.js';

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(express.json());
app.use(express.static(path.join(process.cwd(), 'public')));

// API: 获取可用模型列表
app.get('/api/models', (req, res) => {
  const models = getModelsForUI();
  res.json({
    models,
    defaultModel: process.env.DEFAULT_MODEL || 'claude-opus-4-7',
  });
});

// API: 获取模型信息
app.get('/api/models/:modelId', (req, res) => {
  const modelInfo = getModelInfo(req.params.modelId);
  res.json(modelInfo);
});

// API: 生成日报
app.post('/api/generate', async (req, res) => {
  const { query, modelId } = req.body;

  if (!query) {
    return res.status(400).json({ error: '请提供查询内容' });
  }

  const modelInfo = getModelInfo(modelId || 'claude-opus-4-7');
  console.error(`[API] 生成日报: ${query}`);
  console.error(`[API] 使用模型: ${modelInfo.name}`);

  const agent = new MiningAgent({ modelId });

  try {
    const report = await agent.generateDailyReport(query);
    await agent.cleanup();

    res.json({
      report,
      success: true,
      model: modelInfo.name,
    });
  } catch (error) {
    console.error('[API] Error:', error);
    await agent.cleanup();
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🏔️  矿权日报 Agent Web 服务已启动                  ║
║                                                       ║
║   本地:    http://localhost:${PORT}                      ║
║   网络:    http://0.0.0.0:${PORT}                      ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
});
