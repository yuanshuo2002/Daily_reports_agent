/**
 * 矿权日报Agent
 *
 * 使用LangGraph编排的智能代理，整合MCP服务生成矿业日报
 */

import Anthropic from '@anthropic-ai/sdk';
import { MCPToolClient } from './mcp-client.js';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

export interface DailyReportState {
  query: string;
  miningArea: string;
  newsSummary: string;
  newsArticles: Array<{
    title: string;
    url: string;
    source: string;
    publishedAt: string;
    summary: string;
  }>;
  resources: Array<{
    mineralType: string;
    indicatedReserves: number;
    inferredReserves: number;
    unit: string;
  }>;
  priceTrends: Array<{
    commodity: string;
    average: number;
    high: number;
    low: number;
    trend: string;
  }>;
  riskWarnings: Array<{
    level: string;
    title: string;
    description: string;
  }>;
  sources: string[];
  finalReport: string;
  error?: string;
}

export class MiningAgent {
  private anthropic: Anthropic;
  private newsClient: MCPToolClient;
  private pdfClient: MCPToolClient;
  private priceClient: MCPToolClient;
  private model: string;

  constructor() {
    this.anthropic = new Anthropic();
    this.model = process.env.ANTHROPIC_MODEL || 'claude-opus-4-7';

    // 初始化MCP客户端
    const isWindows = process.platform === 'win32';
    // 使用绝对路径，从项目根目录运行
    const rootDir = path.resolve(process.cwd(), '../..');

    // Windows使用cmd执行tsx，Unix直接使用tsx
    const tsxCmd = isWindows ? 'cmd' : 'tsx';
    const tsxArgs = (pkg: string) => isWindows
      ? ['/c', 'npx', 'tsx', path.join(rootDir, pkg, 'src/index.ts')]
      : ['tsx', path.join(rootDir, pkg, 'src/index.ts')];

    this.newsClient = new MCPToolClient(
      tsxCmd,
      tsxArgs('packages/mining-news-mcp'),
      'mining-news-mcp'
    );

    this.pdfClient = new MCPToolClient(
      tsxCmd,
      tsxArgs('packages/mineral-pdf-mcp'),
      'mineral-pdf-mcp'
    );

    this.priceClient = new MCPToolClient(
      tsxCmd,
      tsxArgs('packages/lme-price-mcp'),
      'lme-price-mcp'
    );
  }

  async initialize(): Promise<void> {
    try {
      await Promise.all([
        this.newsClient.connect(),
        this.pdfClient.connect(),
        this.priceClient.connect(),
      ]);
    } catch (error) {
      console.error('MCP连接失败，将使用模拟数据:', error);
    }
  }

  /**
   * 解析查询中的矿区和矿种
   */
  private parseQuery(query: string): { miningArea: string; mineralType: string } {
    const queryLower = query.toLowerCase();

    // 检测矿区
    const miningAreas: Record<string, string> = {
      'pilbara': 'Pilbara, Western Australia',
      'atacama': 'Atacama, Chile',
      'lithium triangle': 'Lithium Triangle',
      'Nevada': 'Nevada, USA',
      'greenbushes': 'Greenbushes, Western Australia',
      'anthony': 'Anthony, Canada',
    };

    let miningArea = 'Global';
    for (const [key, value] of Object.entries(miningAreas)) {
      if (queryLower.includes(key.toLowerCase())) {
        miningArea = value;
        break;
      }
    }

    // 检测矿种
    const mineralTypes: Record<string, string> = {
      'lithium': 'lithium',
      '锂': 'lithium',
      'copper': 'copper',
      '铜': 'copper',
      'nickel': 'nickel',
      '镍': 'nickel',
      'cobalt': 'cobalt',
      '钴': 'cobalt',
      'gold': 'gold',
      '金': 'gold',
      'iron': 'iron-ore',
      '铁': 'iron-ore',
    };

    let mineralType = 'lithium'; // 默认锂矿
    for (const [key, value] of Object.entries(mineralTypes)) {
      if (queryLower.includes(key.toLowerCase())) {
        mineralType = value;
        break;
      }
    }

    return { miningArea, mineralType };
  }

  /**
   * 收集新闻数据
   */
  private async collectNews(mineralType: string, miningArea: string): Promise<{
    summary: string;
    articles: DailyReportState['newsArticles'];
  }> {
    console.error('[Agent] Collecting news...');

    try {
      // 直接调用MCP服务
      const tools = this.newsClient.getTools();
      if (tools.length === 0) {
        console.error('[Agent] News MCP not connected, using mock data');
        return this.getMockNews(mineralType, miningArea);
      }

      const result = await this.newsClient.callTool('search', {
        query: `${mineralType} ${miningArea}`,
        days: 7,
      }) as { articles?: DailyReportState['newsArticles']; totalResults?: number };

      const articles = result.articles || [];
      const summary = `找到 ${result.totalResults || articles.length} 条相关新闻`;

      return { summary, articles };
    } catch (error) {
      console.error('[Agent] News collection error:', error);
      return this.getMockNews(mineralType, miningArea);
    }
  }

  /**
   * 获取模拟新闻数据
   */
  private getMockNews(mineralType: string, miningArea: string): {
    summary: string;
    articles: DailyReportState['newsArticles'];
  } {
    return {
      summary: `关于 ${mineralType} 矿业的最新动态汇总`,
      articles: [
        {
          title: `Pilbara Minerals宣布扩产计划`,
          url: 'https://example.com/pilbara-expansion',
          source: 'Mining.com',
          publishedAt: new Date().toISOString(),
          summary: '澳大利亚锂矿商Pilbara Minerals宣布将在Pilbara地区扩大产能，预计年产量将提升30%。'
        },
        {
          title: '全球锂价近期走势分析',
          url: 'https://example.com/lithium-price-analysis',
          source: 'Reuters',
          publishedAt: new Date().toISOString(),
          summary: '受新能源汽车需求推动，锂价持续保持高位，但市场对供应过剩的担忧有所缓解。'
        }
      ]
    };
  }

  /**
   * 收集储量数据
   */
  private async collectResources(mineralType: string, miningArea: string): Promise<
    Array<{ mineralType: string; indicatedReserves: number; inferredReserves: number; unit: string }>
  > {
    console.error('[Agent] Collecting resource data...');

    try {
      const tools = this.pdfClient.getTools();
      if (tools.length === 0) {
        console.error('[Agent] PDF MCP not connected, using mock data');
        return this.getMockResources(mineralType, miningArea);
      }

      const result = await this.pdfClient.callTool('extract_resources', {
        pdf_url: `https://example.com/ni43-101/${miningArea.toLowerCase().replace(/\s+/g, '-')}.pdf`,
      }) as { resources?: Array<{ mineralType: string; indicatedReserves: number; inferredReserves: number; unit: string }> };

      return result.resources || [];
    } catch (error) {
      console.error('[Agent] Resource collection error:', error);
      return this.getMockResources(mineralType, miningArea);
    }
  }

  /**
   * 获取模拟储量数据
   */
  private getMockResources(mineralType: string, miningArea: string): Array<{
    mineralType: string;
    indicatedReserves: number;
    inferredReserves: number;
    unit: string;
  }> {
    return [
      {
        mineralType: 'Spodumene (Li2O)',
        indicatedReserves: 1082000,
        inferredReserves: 569000,
        unit: 'tonnes',
      },
      {
        mineralType: 'Lithium Carbonate Equivalent',
        indicatedReserves: 256000,
        inferredReserves: 134000,
        unit: 'tonnes',
      },
    ];
  }

  /**
   * 收集价格数据
   */
  private async collectPrices(mineralType: string): Promise<
    Array<{ commodity: string; average: number; high: number; low: number; trend: string }>
  > {
    console.error('[Agent] Collecting price data...');

    try {
      const tools = this.priceClient.getTools();
      if (tools.length === 0) {
        console.error('[Agent] Price MCP not connected, using mock data');
        return this.getMockPrices(mineralType);
      }

      const result = await this.priceClient.callTool('get_trend', {
        commodity: mineralType,
        days: 30,
      }) as { commodity?: string; average?: number; high?: number; low?: number; trend?: string };

      return [{
        commodity: result.commodity || mineralType,
        average: result.average || 0,
        high: result.high || 0,
        low: result.low || 0,
        trend: result.trend || 'stable',
      }];
    } catch (error) {
      console.error('[Agent] Price collection error:', error);
      return this.getMockPrices(mineralType);
    }
  }

  /**
   * 获取模拟价格数据
   */
  private getMockPrices(mineralType: string): Array<{
    commodity: string;
    average: number;
    high: number;
    low: number;
    trend: string;
  }> {
    return [{
      commodity: 'Lithium Carbonate',
      average: 13500,
      high: 14200,
      low: 12800,
      trend: 'up',
    }];
  }

  /**
   * 生成风险提示
   */
  private async generateRiskWarnings(
    newsArticles: DailyReportState['newsArticles'],
    priceTrends: DailyReportState['priceTrends']
  ): Promise<DailyReportState['riskWarnings']> {
    console.error('[Agent] Generating risk warnings...');

    const warnings: DailyReportState['riskWarnings'] = [];

    // 基于价格趋势的风险
    for (const trend of priceTrends) {
      if (trend.trend === 'up') {
        warnings.push({
          level: 'medium',
          title: '价格上涨风险',
          description: `${trend.commodity}价格持续上涨，需关注下游成本压力。`,
        });
      } else if (trend.trend === 'down') {
        warnings.push({
          level: 'high',
          title: '价格下跌风险',
          description: `${trend.commodity}价格呈下降趋势，市场可能面临调整。`,
        });
      }
    }

    // 基于新闻的风险
    for (const article of newsArticles) {
      const titleLower = article.title.toLowerCase();
      if (titleLower.includes('shutdown') || titleLower.includes('停产')) {
        warnings.push({
          level: 'high',
          title: '供应中断风险',
          description: `有报道称出现停产情况: ${article.title}`,
        });
      }
      if (titleLower.includes('environmental') || titleLower.includes('环保')) {
        warnings.push({
          level: 'medium',
          title: '环保合规风险',
          description: `涉及环保问题: ${article.title}`,
        });
      }
    }

    // 默认风险提示
    if (warnings.length === 0) {
      warnings.push({
        level: 'low',
        title: '市场观察',
        description: '目前未发现明显风险信号，建议持续关注市场动态。',
      });
    }

    return warnings;
  }

  /**
   * 使用AI生成最终报告
   */
  private async generateFinalReport(state: DailyReportState): Promise<string> {
    console.error('[Agent] Generating final report with AI...');

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return this.generateMarkdownReport(state);
    }

    try {
      const prompt = `你是一个专业的矿业分析师。请根据以下信息，用简洁专业的语言生成一份矿业日报。

## 基本信息
- 矿区: ${state.miningArea}
- 日期: ${new Date().toLocaleDateString('zh-CN')}

## 关键数据
${state.resources.length > 0 ? `
**储量概况:**
${state.resources.map(r => `- ${r.mineralType}: 指示储量 ${r.indicatedReserves.toLocaleString()} ${r.unit}`).join('\n')}` : ''}

${state.priceTrends.length > 0 ? `
**价格走势:**
${state.priceTrends.map(p => `- ${p.commodity}: ¥${p.average.toLocaleString()}/吨 (${p.trend === 'up' ? '上涨📈' : p.trend === 'down' ? '下跌📉' : '平稳➡️'})`).join('\n')}` : ''}

## 新闻要点
${state.newsArticles.slice(0, 5).map((a, i) => `${i + 1}. ${a.title}`).join('\n')}

## 风险提示
${state.riskWarnings.map(r => `- [${r.level.toUpperCase()}] ${r.title}`).join('\n')}

请用Markdown格式生成一份精炼的日报，格式如下（控制在500字以内）:

# 🏔️ [矿区简称] 矿业日报
> 📅 [日期]

## 📰 今日要点
[3-5句话总结最重要的新闻，简洁有力]

## 📊 储量与价格
[用表格展示储量数据和价格走势]

## ⚠️ 风险提示
[列出主要风险，用🔴🟡🟢表示级别]

## 📚 来源
[2-3个主要来源链接]

使用中文，专业简洁，突出重点数据。`;

      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: prompt,
        }],
      });

      const content = response.content[0];
      if (content.type === 'text') {
        return content.text;
      }

      return this.generateMarkdownReport(state);
    } catch (error) {
      console.error('[Agent] AI generation error:', error);
      return this.generateMarkdownReport(state);
    }
  }

  /**
   * 生成Markdown格式报告
   */
  private generateMarkdownReport(state: DailyReportState): string {
    const date = new Date().toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // 精选新闻，只显示最重要的3条
    const topNews = state.newsArticles.slice(0, 3);

    let report = `# 🏔️ ${state.miningArea.split(',')[0]} 矿业日报

> 📅 ${date} | 🤖 自动生成

---

## 📰 今日要闻

${topNews.length > 0 ? topNews.map((article, i) => `**${i + 1}. ${article.title}**
${article.summary.slice(0, 150)}${article.summary.length > 150 ? '...' : ''}
*来源: ${article.source}*`).join('\n\n') : '*暂无最新新闻*'}

---

## 📊 储量数据

| 矿种 | 指示储量 | 推断储量 |
|:-----|--------:|--------:|
${state.resources.map(r => `| ${r.mineralType} | **${this.formatNumber(r.indicatedReserves)}** ${r.unit} | ${this.formatNumber(r.inferredReserves)} ${r.unit} |`).join('\n')}

---

## 💰 价格走势

| 商品 | 当前均价 | 30日区间 | 趋势 |
|:-----|--------:|--------:|:----:|
${state.priceTrends.map(p => {
  const trendIcon = p.trend === 'up' ? '📈' : p.trend === 'down' ? '📉' : '➡️';
  const trendText = p.trend === 'up' ? '上涨' : p.trend === 'down' ? '下跌' : '平稳';
  return `| ${p.commodity} | **¥${this.formatNumber(p.average)}** | ¥${this.formatNumber(p.low)} ~ ¥${this.formatNumber(p.high)} | ${trendIcon} ${trendText} |`;
}).join('\n')}

---

## ⚠️ 风险提示

${state.riskWarnings.map(r => {
  const icon = r.level === 'high' ? '🔴' : r.level === 'medium' ? '🟡' : '🟢';
  return `| ${icon} | **${r.title}** | ${r.description} |`;
}).join('\n')}

---

## 📚 参考来源

${state.sources.slice(0, 5).map(s => `- ${s}`).join('\n')}

> *本报告由矿权日报Agent自动生成 | 生成时间: ${new Date().toLocaleTimeString('zh-CN')}*
`;
    return report;
  }

  /**
   * 格式化数字
   */
  private formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(0) + 'K';
    }
    return num.toLocaleString();
  }

  /**
   * 主流程：生成日报
   */
  async generateDailyReport(query: string): Promise<string> {
    console.error('[Agent] Starting daily report generation...');
    console.error(`[Agent] Query: ${query}`);

    // 初始化MCP连接
    await this.initialize();

    // 解析查询
    const { miningArea, mineralType } = this.parseQuery(query);
    console.error(`[Agent] Parsed - Area: ${miningArea}, Mineral: ${mineralType}`);

    // 收集所有数据
    const [newsData, resources, priceTrends] = await Promise.all([
      this.collectNews(mineralType, miningArea),
      this.collectResources(mineralType, miningArea),
      this.collectPrices(mineralType),
    ]);

    console.error('[Agent] Data collection complete');

    // 生成风险提示
    const riskWarnings = await this.generateRiskWarnings(newsData.articles, priceTrends);

    // 收集所有来源URL
    const sources = [
      ...newsData.articles.map(a => a.url),
      'https://www.mining.com/',
      'https://www.lme.com/',
    ].filter((url, index, self) => url && self.indexOf(url) === index);

    // 构建状态
    const state: DailyReportState = {
      query,
      miningArea,
      newsSummary: newsData.summary,
      newsArticles: newsData.articles,
      resources,
      priceTrends,
      riskWarnings,
      sources,
      finalReport: '',
    };

    // 生成最终报告
    const finalReport = await this.generateFinalReport(state);
    state.finalReport = finalReport;

    console.error('[Agent] Report generation complete');

    return finalReport;
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    await Promise.all([
      this.newsClient.disconnect(),
      this.pdfClient.disconnect(),
      this.priceClient.disconnect(),
    ]);
  }
}
