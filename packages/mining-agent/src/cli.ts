/**
 * CLI命令行工具
 */

import { MiningAgent } from './agent.js';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
矿权日报Agent CLI

用法:
  npx tsx src/cli.ts <查询语句>

示例:
  npx tsx src/cli.ts "给我生成一份关于 Pilbara 锂矿的今日简报"
  npx tsx src/cli.ts "分析一下 Atacama 盐湖的锂矿情况"

环境变量:
  ANTHROPIC_API_KEY - Anthropic API密钥 (可选，用于AI增强报告)
  ANTHROPIC_MODEL  - Claude模型 (默认: claude-opus-4-7)

可用矿区关键词:
  - Pilbara, Atacama, Lithium Triangle, Nevada, Greenbushes

可用矿种关键词:
  - lithium/锂, copper/铜, nickel/镍, cobalt/钴, gold/金, iron/铁
    `);
    return;
  }

  const query = args.join(' ');
  console.error(`正在生成矿权日报...`);
  console.error(`查询: ${query}`);

  const agent = new MiningAgent();

  try {
    const report = await agent.generateDailyReport(query);
    console.log(report);
  } catch (error) {
    console.error('生成报告时出错:', error);
    process.exit(1);
  } finally {
    await agent.cleanup();
  }
}

main();
