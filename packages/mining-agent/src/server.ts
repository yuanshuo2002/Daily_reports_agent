/**
 * Web服务器
 *
 * 提供UI界面和API接口
 */

import express from 'express';
import { MiningAgent } from './agent.js';
import * as path from 'path';
import * as fs from 'fs';

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(express.json());
app.use(express.static(path.join(process.cwd(), 'public')));

// API: 生成日报
app.post('/api/generate', async (req, res) => {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: '请提供查询内容' });
  }

  console.error(`[API] 生成日报: ${query}`);

  const agent = new MiningAgent();

  try {
    const report = await agent.generateDailyReport(query);
    await agent.cleanup();

    res.json({ report, success: true });
  } catch (error) {
    console.error('[API] Error:', error);
    await agent.cleanup();
    res.status(500).json({ error: error.message });
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
║   🏔️  矿权日报 Agent Web 服务已启动                    ║
║                                                       ║
║   本地:    http://localhost:${PORT}                      ║
║   网络:    http://0.0.0.0:${PORT}                      ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
});
