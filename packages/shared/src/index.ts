// 共享类型定义

export interface NewsArticle {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  summary: string;
  content?: string;
}

export interface NewsSearchResult {
  articles: NewsArticle[];
  totalResults: number;
  query: string;
}

export interface MineralResource {
  mineralType: string;
  indicatedReserves: number;
  inferredReserves: number;
  unit: string;
  location: string;
  reportDate: string;
  reportType: string;
}

export interface PdfExtractionResult {
  url: string;
  resources: MineralResource[];
  metadata: {
    title: string;
    author: string;
    reportDate: string;
    company: string;
  };
}

export interface PriceData {
  commodity: string;
  date: string;
  price: number;
  currency: string;
  unit: string;
  change: number;
  changePercent: number;
}

export interface PriceTrend {
  commodity: string;
  startDate: string;
  endDate: string;
  prices: PriceData[];
  average: number;
  high: number;
  low: number;
  trend: 'up' | 'down' | 'stable';
}

export interface DailyReport {
  title: string;
  date: string;
  miningArea: string;
  sections: {
    newsSummary: string;
    newsArticles: NewsArticle[];
    resources: MineralResource[];
    priceTrends: PriceTrend[];
    riskWarnings: RiskWarning[];
  };
  sources: string[];
  generatedAt: string;
}

export interface RiskWarning {
  level: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  source?: string;
}

// MCP工具类型
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: object;
}

export interface MCPServerConfig {
  name: string;
  version: string;
  tools: MCPTool[];
}
