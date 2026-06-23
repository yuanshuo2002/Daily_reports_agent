/**
 * CLI命令行工具
 */

import { MiningAgent } from './agent.js';
import { AVAILABLE_MODELS } from './llm-client.js';
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
  --model <模型>   指定使用的AI模型 (默认: claude-opus-4-7)

可用模型:
${AVAILABLE_MODELS.map(m => `  ${m.id.padEnd(20)} - ${m.name} (${m.description})`).join('\n')}

示例:
  npx tsx src/cli.ts "给我生成一份关于 Pilbara 锂矿的今日简报"
  npx tsx src/cli.ts "给我生成一份关于 Pilbara 锂矿的今日简报" --save ./reports
  npx tsx src/cli.ts "分析 Atacama 盐湖的锂矿情况" --model gpt-4o
  npx tsx src/cli.ts "分析铜矿情况" --model deepseek-chat --save

环境变量:
  ANTHROPIC_API_KEY   - Anthropic API密钥
  OPENAI_API_KEY      - OpenAI API密钥
  DEEPSEEK_API_KEY    - DeepSeek API密钥
  DEFAULT_MODEL       - 默认模型

可用矿区关键词:
  - Pilbara, Atacama, Lithium Triangle, Nevada, Greenbushes

可用矿种关键词:
  - lithium/锂, copper/铜, nickel/镍, cobalt/钴, gold/金, iron/铁
    `);
    return;
  }

  // 解析参数
  let queryArgs = args;
  let saveDir: string | null = null;
  let modelId: string | undefined;

  // 处理 --save
  const saveIndex = args.indexOf('--save');
  if (saveIndex !== -1) {
    queryArgs = args.filter((arg, i) => i !== saveIndex && !(i === saveIndex + 1 && !arg.startsWith('--')));
    saveDir = args[saveIndex + 1] && !args[saveIndex + 1].startsWith('--') ? args[saveIndex + 1] : './reports';
  }

  // 处理 --model
  const modelIndex = args.indexOf('--model');
  if (modelIndex !== -1 && args[modelIndex + 1] && !args[modelIndex + 1].startsWith('--')) {
    modelId = args[modelIndex + 1];
    queryArgs = queryArgs.filter((_, i) => i !== modelIndex && i !== modelIndex + 1);
  }

  const query = queryArgs.join(' ');

  if (!query) {
    console.error('错误: 请提供查询内容');
    process.exit(1);
  }

  console.error(`正在生成矿权日报...`);
  console.error(`查询: ${query}`);
  if (modelId) {
    console.error(`模型: ${modelId}`);
  }

  const agent = new MiningAgent({ modelId });

  try {
    const startTime = Date.now();
    const report = await agent.generateDailyReport(query);
    console.error(`[Time] 生成耗时: ${Date.now() - startTime}ms`);

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
