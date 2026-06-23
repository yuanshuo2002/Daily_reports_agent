/**
 * 矿权日报Agent
 *
 * 使用LangGraph编排的智能代理，整合MCP服务生成矿业日报
 */

import { MCPToolClient } from './mcp-client.js';
import { createLLMClient, isLLMConfigured, getModelInfo, LLMClient } from './llm-client.js';
import * as path from 'path';
import * as dotenv from 'dotenv';

// 加载 .env 文件
dotenv.config({ path: path.join(process.cwd(), '.env') });

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

export interface DailyReportOptions {
  modelId?: string;  // 使用的模型 ID，如 'claude-opus-4-7', 'gpt-4o', 'deepseek-chat'
}

export class MiningAgent {
  private llmClient: LLMClient | null = null;
  private newsClient: MCPToolClient;
  private pdfClient: MCPToolClient;
  private priceClient: MCPToolClient;
  private modelId: string;
  private modelInfo: { id: string; name: string; provider: string; description: string };

  constructor(options: DailyReportOptions = {}) {
    this.modelId = options.modelId || process.env.DEFAULT_MODEL || 'claude-opus-4-7';
    this.modelInfo = getModelInfo(this.modelId);

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

  /**
   * 初始化 LLM 客户端
   */
  private async initializeLLM(): Promise<void> {
    if (this.llmClient) return;

    if (!isLLMConfigured(this.modelId)) {
      console.error(`[Agent] ${this.modelInfo.name} 未配置 API 密钥，将使用基础报告格式`);
      return;
    }

    try {
      this.llmClient = createLLMClient({
        provider: this.modelInfo.provider as 'anthropic' | 'openai' | 'deepseek' | 'compatible',
        model: this.getModelName(),
        apiKey: this.getApiKey(),
        baseUrl: this.getBaseUrl(),
      });
      console.error(`[Agent] LLM 客户端初始化成功: ${this.modelInfo.name} (${this.getModelName()})`);
    } catch (error) {
      console.error(`[Agent] LLM 客户端初始化失败:`, error);
    }
  }

  private getApiKey(): string {
    const keyMap: Record<string, string | undefined> = {
      anthropic: process.env.ANTHROPIC_API_KEY,
      openai: process.env.OPENAI_API_KEY,
      deepseek: process.env.DEEPSEEK_API_KEY,
      compatible: process.env.COMPATIBLE_API_KEY,
    };
    return keyMap[this.modelInfo.provider] || '';
  }

  private getBaseUrl(): string | undefined {
    const urlMap: Record<string, string | undefined> = {
      openai: process.env.OPENAI_BASE_URL,
      deepseek: 'https://api.deepseek.com',
      compatible: process.env.COMPATIBLE_BASE_URL,
    };
    return urlMap[this.modelInfo.provider];
  }

  private getModelName(): string {
    // 兼容模式使用环境变量中的实际模型名
    if (this.modelInfo.provider === 'compatible') {
      return process.env.COMPATIBLE_MODEL || 'gpt-4o';
    }
    // DeepSeek 也使用环境变量
    if (this.modelInfo.provider === 'deepseek') {
      return process.env.DEEPSEEK_MODEL || 'deepseek-chat';
    }
    // OpenAI 使用环境变量
    if (this.modelInfo.provider === 'openai') {
      return process.env.OPENAI_MODEL || 'gpt-4o';
    }
    // Anthropic 使用 modelId
    return this.modelId;
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
   * 根据查询确定矿种中文名称
   */
  private getMineralNameCN(query: string): string {
    const queryLower = query.toLowerCase();
    if (queryLower.includes('锂') || queryLower.includes('lithium')) return '锂矿';
    if (queryLower.includes('铜') || queryLower.includes('copper')) return '铜矿';
    if (queryLower.includes('金') || queryLower.includes('gold')) return '金矿';
    if (queryLower.includes('银') || queryLower.includes('silver')) return '银矿';
    if (queryLower.includes('镍') || queryLower.includes('nickel')) return '镍矿';
    if (queryLower.includes('钴') || queryLower.includes('cobalt')) return '钴矿';
    if (queryLower.includes('铁') || queryLower.includes('iron')) return '铁矿';
    return '矿业';
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
    // 根据矿种生成相关mock新闻
    const mineralNews: Record<string, Array<{ title: string; summary: string }>> = {
      lithium: [
        {
          title: `${miningArea}地区锂矿项目进展顺利`,
          summary: `该地区主要锂矿项目持续推进，扩产计划逐步落地，预计将显著提升锂资源供应能力。`
        },
        {
          title: '锂价持稳运行，下游采购情绪回暖',
          summary: `碳酸锂价格保持稳定，新能源汽车需求持续增长，材料厂采购意愿有所提升，市场情绪有所好转。`
        },
        {
          title: '澳洲锂矿出口量同比上升',
          summary: `最新海关数据显示，澳大利亚锂辉石精矿出口量较去年同期增长，锂盐供应链保持平稳。`
        }
      ],
      copper: [
        {
          title: `${miningArea}铜矿开采活跃`,
          summary: `该地区铜矿项目推进中，矿山产量保持增长态势。`
        },
        {
          title: '全球铜价维持高位',
          summary: `受能源转型需求推动，铜价表现强劲，矿商盈利能力提升。`
        },
        {
          title: '铜矿勘探活动增加',
          summary: `全球范围内铜矿勘探投资增加，新项目储备提升。`
        }
      ],
      gold: [
        {
          title: `${miningArea}金矿生产稳定`,
          summary: `该地区金矿项目运营正常，黄金产量保持稳定。`
        },
        {
          title: '金价突破历史高位',
          summary: `避险需求推动金价上涨，突破2400美元/盎司关口。`
        },
        {
          title: '黄金ETF持仓增加',
          summary: `机构投资者增加黄金配置，全球ETF持仓量上升。`
        }
      ],
      nickel: [
        {
          title: `${miningArea}镍矿项目推进中`,
          summary: `该地区镍矿开发进展顺利，电池级镍需求持续增长。`
        },
        {
          title: '镍价震荡上行',
          summary: `不锈钢和电池需求支撑镍价，供应端有扰动。`
        }
      ],
      cobalt: [
        {
          title: '钴价小幅回暖',
          summary: `钴价触底反弹，新能源汽车需求提振市场情绪。`
        }
      ],
      default: [
        {
          title: `${miningArea}矿业动态`,
          summary: `该地区矿业项目正常运营，市场供需基本平衡。`
        },
        {
          title: '金属价格总体平稳',
          summary: `全球金属市场整体平稳，主要品种价格波动不大。`
        },
        {
          title: '矿业投资持续增长',
          summary: `全球矿业投资保持增长态势，新项目陆续启动。`
        }
      ]
    };

    const news = mineralNews[mineralType] || mineralNews['default'];
    const articles = news.map((n, i) => ({
      title: n.title,
      url: `https://example.com/news/${mineralType}-${i}`,
      source: '矿业资讯',
      publishedAt: new Date().toISOString(),
      summary: n.summary
    }));

    return {
      summary: `关于 ${miningArea} ${mineralType} 矿业的最新动态`,
      articles
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

      // 如果返回空数组，说明没有找到相关报告，不要使用mock数据
      if (!result.resources || result.resources.length === 0) {
        console.error('[Agent] No resources found in PDF, returning empty');
        return [];
      }

      return result.resources;
    } catch (error) {
      console.error('[Agent] Resource collection error:', error);
      // PDF解析失败时返回空数据，不要使用幻觉数据
      return [];
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
    // 根据矿种返回不同的mock数据
    const resourceData: Record<string, Array<{ mineralType: string; indicatedReserves: number; inferredReserves: number; unit: string }>> = {
      lithium: [
        { mineralType: '锂辉石 (Spodumene)', indicatedReserves: 1082000, inferredReserves: 569000, unit: '吨' },
        { mineralType: '碳酸锂当量 (LCE)', indicatedReserves: 256000, inferredReserves: 134000, unit: '吨' },
      ],
      copper: [
        { mineralType: '铜精矿', indicatedReserves: 850000, inferredReserves: 420000, unit: '吨' },
        { mineralType: '电解铜', indicatedReserves: 320000, inferredReserves: 180000, unit: '吨' },
      ],
      gold: [
        { mineralType: '金矿石', indicatedReserves: 125000, inferredReserves: 68000, unit: '盎司' },
        { mineralType: '含金量', indicatedReserves: 3886, inferredReserves: 2114, unit: '吨' },
      ],
      nickel: [
        { mineralType: '镍精矿', indicatedReserves: 420000, inferredReserves: 280000, unit: '吨' },
      ],
      cobalt: [
        { mineralType: '钴矿石', indicatedReserves: 85000, inferredReserves: 52000, unit: '吨' },
      ],
      'iron-ore': [
        { mineralType: '铁矿石', indicatedReserves: 125000000, inferredReserves: 68000000, unit: '吨' },
      ],
    };

    return resourceData[mineralType] || [
      { mineralType: `${mineralType}矿石`, indicatedReserves: 500000, inferredReserves: 300000, unit: '吨' },
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
   * 获取模拟价格数据 - 基于实际市场的合理模拟
   */
  private getMockPrices(mineralType: string): Array<{
    commodity: string;
    average: number;
    high: number;
    low: number;
    trend: string;
  }> {
    // 基于实际市场的合理模拟价格 (单位: 美元/吨)
    const mockPrices: Record<string, { commodity: string; average: number; high: number; low: number }> = {
      lithium: { commodity: 'Lithium Carbonate (LME)', average: 13500, high: 14200, low: 12800 },
      'lithium-carbonate': { commodity: 'Lithium Carbonate (LME)', average: 13500, high: 14200, low: 12800 },
      copper: { commodity: 'Copper (LME, USD/吨)', average: 8450, high: 8900, low: 8100 },
      nickel: { commodity: 'Nickel (LME, USD/吨)', average: 16200, high: 17000, low: 15500 },
      cobalt: { commodity: 'Cobalt (MB, USD/吨)', average: 33500, high: 35000, low: 32000 },
      gold: { commodity: 'Gold (COMEX, USD/盎司)', average: 2320, high: 2380, low: 2260 },
      silver: { commodity: 'Silver (COMEX, USD/盎司)', average: 29.5, high: 31, low: 28 },
      'iron-ore': { commodity: 'Iron Ore (62% Fe, CFR)', average: 118, high: 125, low: 110 },
    };

    const data = mockPrices[mineralType] || mockPrices['lithium'];
    return [{
      ...data,
      trend: data.average > (data.high + data.low) / 2 ? 'up' : data.average < (data.high + data.low) / 2 ? 'down' : 'stable',
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
      if (trend.trend === 'up' && trend.high > 0) {
        const changePercent = ((trend.high - trend.low) / trend.low * 100).toFixed(1);
        warnings.push({
          level: 'medium',
          title: '价格波动风险',
          description: `${trend.commodity}近30日价格上涨，波动幅度${changePercent}%，需关注下游采购节奏。`,
        });
      } else if (trend.trend === 'down') {
        warnings.push({
          level: 'high',
          title: '价格下行风险',
          description: `${trend.commodity}价格持续走低，当前均价较周期高点下跌${((1 - trend.average / trend.high) * 100).toFixed(0)}%，市场承压。`,
        });
      }
    }

    // 基于新闻的风险分析
    for (const article of newsArticles.slice(0, 3)) {
      const titleLower = article.title.toLowerCase();

      // 供应相关风险
      if (titleLower.includes('shutdown') || titleLower.includes('停产') ||
          titleLower.includes('curtail') || titleLower.includes('减产')) {
        warnings.push({
          level: 'high',
          title: '供应扰动',
          description: `${article.title}，可能影响短期市场供需格局。`,
        });
      }

      // 政策/环保风险
      if (titleLower.includes('environmental') || titleLower.includes('环保') ||
          titleLower.includes('regulation') || titleLower.includes('policy')) {
        warnings.push({
          level: 'medium',
          title: '政策风险',
          description: `${article.title}，需关注后续政策动向。`,
        });
      }

      // 价格相关风险
      if (titleLower.includes('price') && (titleLower.includes('fall') ||
          titleLower.includes('drop') || titleLower.includes('下跌'))) {
        warnings.push({
          level: 'medium',
          title: '价格压力',
          description: `${article.title}。`,
        });
      }
    }

    // 市场供需风险
    if (newsArticles.length < 3) {
      warnings.push({
        level: 'low',
        title: '信息有限',
        description: '近期相关新闻较少，市场动态需持续跟踪。',
      });
    }

    // 如果没有发现风险，添加一条市场观察
    if (warnings.length === 0) {
      warnings.push({
        level: 'low',
        title: '市场平稳',
        description: '暂未发现明显风险信号，建议持续关注价格走势和供需变化。',
      });
    }

    // 限制风险提示数量
    return warnings.slice(0, 4);
  }

  /**
   * 使用AI生成最终报告
   */
  private async generateFinalReport(state: DailyReportState): Promise<string> {
    console.error(`[Agent] Generating final report with ${this.modelInfo.name}...`);

    await this.initializeLLM();

    if (!this.llmClient) {
      return this.generateMarkdownReport(state);
    }

    // 从查询中提取矿种名称用于标题
    const mineralName = this.getMineralNameCN(state.query);

    // 筛选相关储量数据
    const relevantResources = state.resources.filter(r =>
      state.query.toLowerCase().includes(r.mineralType.toLowerCase()) ||
      state.query.toLowerCase().includes(mineralName)
    );

    // 筛选相关价格数据
    const relevantPrices = state.priceTrends.filter(p =>
      state.query.toLowerCase().includes(p.commodity.toLowerCase()) ||
      state.query.toLowerCase().includes(mineralName)
    );

    // 筛选相关新闻 - 正确实现
    const relevantNews = state.newsArticles.filter(a => {
      const titleLower = a.title.toLowerCase();
      const summaryLower = a.summary.toLowerCase();
      const queryLower = state.query.toLowerCase();

      // 检查是否与查询的矿种相关
      if (queryLower.includes('锂') || queryLower.includes('lithium')) {
        return titleLower.includes('lithium') || titleLower.includes('锂') ||
               summaryLower.includes('lithium') || summaryLower.includes('锂');
      }
      if (queryLower.includes('铜') || queryLower.includes('copper')) {
        return titleLower.includes('copper') || titleLower.includes('铜');
      }
      if (queryLower.includes('金') || queryLower.includes('gold')) {
        return titleLower.includes('gold') || titleLower.includes('金');
      }
      if (queryLower.includes('镍') || queryLower.includes('nickel')) {
        return titleLower.includes('nickel') || titleLower.includes('镍');
      }
      if (queryLower.includes('钴') || queryLower.includes('cobalt')) {
        return titleLower.includes('cobalt') || titleLower.includes('钴');
      }
      // 默认返回全部
      return true;
    });

    try {
      const prompt = `你是一个专业的矿业市场分析师。请根据以下信息生成一份专业的矿业市场分析日报。

## 用户查询
"${state.query}"

## 重要指令
1. 报告标题必须包含矿种名称（如：金价、铜矿、锂矿）
2. 只使用与查询相关的矿种数据，不要混入其他矿种
3. 如果某些数据与查询无关，请忽略它
4. 报告内容要详细全面，至少500字

## 矿区信息
${state.miningArea}

## 相关储量数据
${relevantResources.length > 0 ? relevantResources.map(r => `- ${r.mineralType}: 指示储量 ${r.indicatedReserves.toLocaleString()} ${r.unit}`).join('\n') : '暂无相关储量数据（请提供NI 43-101报告链接）'}

## 相关价格数据
${relevantPrices.length > 0 ? relevantPrices.map(p => `- ${p.commodity}: $${p.average.toLocaleString()}/吨 (${p.trend === 'up' ? '上涨📈' : p.trend === 'down' ? '下跌📉' : '平稳➡️'})`).join('\n') : '暂无相关价格数据'}

## 相关新闻（请详细总结这些新闻要点）
${relevantNews.length > 0 ? relevantNews.map((a, i) => `${i + 1}. ${a.title}\n   ${a.summary}`).join('\n\n') : '暂无相关新闻（可能RSS源暂时不可用）'}

## 风险提示
${state.riskWarnings.slice(0, 2).map(r => `- [${r.level.toUpperCase()}] ${r.title}: ${r.description}`).join('\n')}

请用Markdown格式生成日报，结构如下:

# 🏔️ [矿种简称] 市场日报
> 📅 [日期] | 🤖 AI分析

## 📰 今日要点
[详细总结相关新闻要点和价格走势，3-5句话]

## 📊 今日行情
[只列出与查询相关的矿种数据，用表格展示，包含价格和储量]

## ⚠️ 风险提示
[🔴高风险/🟡中风险/🟢低风险 + 简要描述]

## 📚 来源
[列出新闻来源名称]

重要：只关注查询中提到的矿种，不要混入其他不相关的数据！报告内容要详细，至少500字。`;

      const response = await this.llmClient.generate(prompt, {
        maxTokens: 4096,
        temperature: 0.7,
      });

      return response.content;
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

    // 根据查询确定矿种中文名称
    const mineralName = this.getMineralNameCN(state.query);

    // 精选新闻 - 筛选与矿种相关的
    const relevantNews = state.newsArticles.filter(article => {
      const titleLower = article.title.toLowerCase();
      const summaryLower = article.summary.toLowerCase();
      const queryLower = state.query.toLowerCase();

      if (queryLower.includes('锂') || queryLower.includes('lithium')) {
        return titleLower.includes('lithium') || titleLower.includes('锂');
      }
      if (queryLower.includes('铜') || queryLower.includes('copper')) {
        return titleLower.includes('copper') || titleLower.includes('铜');
      }
      if (queryLower.includes('金') || queryLower.includes('gold')) {
        return titleLower.includes('gold') || titleLower.includes('金');
      }
      return true;
    });
    const topNews = relevantNews.length > 0 ? relevantNews.slice(0, 3) : state.newsArticles.slice(0, 3);

    // 构建新闻摘要
    let newsSection = '';
    if (topNews.length > 0) {
      newsSection = topNews.map((article, i) => `**${i + 1}. ${article.title}**
${article.summary.slice(0, 200)}${article.summary.length > 200 ? '...' : ''}
*来源: ${article.source}*`).join('\n\n');
    } else {
      newsSection = `暂无${mineralName}相关新闻，可能原因:
- RSS源暂时不可用
- 网络连接问题
- 暂无该矿种最新资讯`;
    }

    // 构建储量数据
    let resourceSection = '';
    if (state.resources.length > 0) {
      resourceSection = `| 矿种 | 指示储量 | 推断储量 |
|:-----|--------:|--------:|
${state.resources.map(r => {
  const unit = r.unit === 'tonnes' || r.unit === 'tonne' ? '吨' : r.unit;
  return `| ${r.mineralType} | **${this.formatNumber(r.indicatedReserves)}** ${unit} | ${this.formatNumber(r.inferredReserves)} ${unit} |`;
}).join('\n')}`;
    } else {
      resourceSection = `*暂无${mineralName}储量数据*

如需获取储量信息，请提供:
- NI 43-101技术报告PDF链接
- 或具体矿区名称以便系统查询`;
    }

    // 构建价格数据
    const priceSection = state.priceTrends.length > 0 ? state.priceTrends.map(p => {
      const trendIcon = p.trend === 'up' ? '📈' : p.trend === 'down' ? '📉' : '➡️';
      const trendText = p.trend === 'up' ? '上涨' : p.trend === 'down' ? '下跌' : '平稳';
      return `| ${p.commodity} | **$${this.formatNumber(p.average)}**/吨 | $${this.formatNumber(p.low)} ~ $${this.formatNumber(p.high)} | ${trendIcon} ${trendText} |`;
    }).join('\n') : '| - | - | - | - |';

    // 构建来源
    const sourceSection = state.sources.length > 0
      ? state.sources.slice(0, 5).map(s => `- ${s}`).join('\n')
      : '- 暂无来源数据';

    // LLM警告
    const llmWarning = !this.llmClient
      ? '\n> *⚠️ 提示: 当前未配置LLM API，报告基于模板生成。如需更智能的分析，请配置API密钥。*'
      : '';

    let report = `# 🏔️ ${state.miningArea.split(',')[0]} ${mineralName}日报

> 📅 ${date} | 🤖 自动生成 | 查询: "${state.query}"

---

## 📰 今日要闻

${newsSection}

---

## 📊 储量数据

${resourceSection}

---

## 💰 价格走势

| 商品 | 当前均价 | 30日区间 | 趋势 |
|:-----|--------:|--------:|:----:|
${priceSection}

> *注: 价格数据仅供参考，实际交易价格请以市场为准*

---

## ⚠️ 风险提示

${state.riskWarnings.map(r => {
  const icon = r.level === 'high' ? '🔴' : r.level === 'medium' ? '🟡' : '🟢';
  return `| ${icon} | **${r.title}** | ${r.description} |`;
}).join('\n')}

---

## 📚 参考来源

${sourceSection}

> *本报告由矿权日报Agent自动生成 | 生成时间: ${new Date().toLocaleTimeString('zh-CN')}*${llmWarning}`;
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
   * @param query 查询内容
   * @param modelId 可选，指定使用的模型
   */
  async generateDailyReport(query: string, modelId?: string): Promise<string> {
    // 如果指定了新模型，更新配置
    if (modelId && modelId !== this.modelId) {
      this.modelId = modelId;
      this.modelInfo = getModelInfo(modelId);
      this.llmClient = null;  // 重置 LLM 客户端
      console.error(`[Agent] 模型已切换为: ${this.modelInfo.name}`);
    }

    console.error('[Agent] Starting daily report generation...');
    console.error(`[Agent] Query: ${query}`);
    console.error(`[Agent] Model: ${this.modelInfo.name}`);

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
