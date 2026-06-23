/**
 * CLI命令行工具
 */

import { MiningAgent } from './agent.js';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
矿权日报Agent CLI

用法:
  npx tsx src/cli.ts <查询语句>

选项:
  --save [目录]    保存报告到文件 (默认: ./reports)

示例:
  npx tsx src/cli.ts "给我生成一份关于 Pilbara 锂矿的今日简报"
  npx tsx src/cli.ts "给我生成一份关于 Pilbara 锂矿的今日简报" --save ./reports
  npx tsx src/cli.ts "分析 Atacama 盐湖的锂矿情况" --save

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

  // 解析参数
  const saveIndex = args.indexOf('--save');
  let queryArgs = args;
  let saveDir: string | null = null;

  if (saveIndex !== -1) {
    queryArgs = args.filter((arg, i) => i !== saveIndex && i !== saveIndex + 1 && !arg.startsWith('--'));
    saveDir = args[saveIndex + 1] || './reports';
  }

  const query = queryArgs.join(' ');
  console.error(`正在生成矿权日报...`);
  console.error(`查询: ${query}`);

  const agent = new MiningAgent();

  try {
    const report = await agent.generateDailyReport(query);

    // 保存报告
    if (saveDir) {
      const reportsDir = path.resolve(saveDir);
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }

      // 生成文件名
      const date = new Date();
      const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD
      const filename = `mining-report-${dateStr}-${Date.now()}.md`;
      const filepath = path.join(reportsDir, filename);

      fs.writeFileSync(filepath, report, 'utf-8');
      console.error(`\n报告已保存到: ${filepath}`);
    }

    // 输出到控制台
    console.log(report);
  } catch (error) {
    console.error('生成报告时出错:', error);
    process.exit(1);
  } finally {
    await agent.cleanup();
  }
}

main();
