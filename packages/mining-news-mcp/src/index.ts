/**
 * 矿业新闻聚合MCP服务器
 *
 * 提供的工具:
 * - search: 搜索矿业相关新闻
 * - fetch_article: 获取文章详细内容
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import Parser from 'rss-parser';
import axios from 'axios';
import * as cheerio from 'cheerio';

interface NewsArticle {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  summary: string;
  content?: string;
}

interface NewsSearchResult {
  articles: NewsArticle[];
  totalResults: number;
  query: string;
}

const parser = new Parser();

// 中文关键词
const CHINESE_KEYWORDS = [
  '锂', '锂矿', '锂盐', '锂价', '碳酸锂', '氢氧化锂', '锂辉石',
  '矿业', '矿业新闻', '金属', '矿产资源', '稀土', '铜', '金', '银',
];

// 英文关键词
const ENGLISH_KEYWORDS = [
  'lithium', 'lithium carbonate', 'spodumene',
  'mining', 'mineral', 'copper', 'iron ore', 'gold', 'silver',
  'rare earth', 'cobalt', 'nickel', 'bauxite', 'zinc',
];

// 严格排除关键词
const EXCLUDE_KEYWORDS = [
  'kazakhstan', 'iran', 'russia', 'ukraine', 'sanction',
  'alberta', 'british columbia', 'canada', 'afghanistan',
  'tungsten', '钨', 'uranium', '铀', 'coal', '煤',
];

// RSS新闻源
const RSS_SOURCES = [
  { name: 'Mining.com', url: 'https://www.mining.com/feed/' },
  { name: 'Reuters Business', url: 'https://feeds.reuters.com/reuters/businessNews' },
  { name: 'SMM锂电', url: 'https://news.metal.com/?rss=1' },
];

/**
 * 检查文本是否匹配关键词
 */
function matchesKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some(kw => lower.includes(kw.toLowerCase()));
}

/**
 * 计算新闻相关性分数
 */
function calculateRelevance(
  title: string,
  snippet: string,
  query: string,
  mineralType?: string
): number {
  const text = `${title} ${snippet}`.toLowerCase();
  const queryLower = query.toLowerCase();
  let score = 0;

  // 精确匹配矿种
  if (mineralType === 'lithium') {
    if (text.includes('lithium')) score += 15;
    if (text.includes('锂')) score += 15;
    if (text.includes('spodumene') || text.includes('锂辉石')) score += 10;
    if (text.includes('碳酸锂') || text.includes('lithium carbonate')) score += 8;
  }

  if (mineralType === 'copper') {
    if (text.includes('copper') || text.includes('铜')) score += 15;
  }

  // 查询词匹配
  if (queryLower.includes('pilbara')) {
    if (text.includes('pilbara')) score += 10;
  }
  if (queryLower.includes('atacama')) {
    if (text.includes('atacama') || text.includes('智利')) score += 10;
  }

  // 严格排除不相关关键词
  const strictExcludes = [
    'tungsten', '钨', 'uranium', '铀', 'coal', '煤',
    'gold mine', '金矿', 'diamond', '钻石',
    'alberta', 'british columbia', 'kazakhstan',
  ];

  for (const kw of strictExcludes) {
    if (text.includes(kw.toLowerCase())) {
      return -100; // 直接排除
    }
  }

  // 软排除
  const softExcludes = ['iran', 'russia', 'ukraine', 'sanction', 'afghanistan'];
  for (const kw of softExcludes) {
    if (text.includes(kw)) score -= 10;
  }

  return score;
}

/**
 * 搜索矿业新闻
 */
async function searchNews(query: string, days: number = 7): Promise<NewsSearchResult> {
  const articles: NewsArticle[] = [];
  const queryLower = query.toLowerCase();
  const minDate = new Date();
  minDate.setDate(minDate.getDate() - days);

  // 从查询中提取矿种
  let mineralType = '';
  if (queryLower.includes('锂') || queryLower.includes('lithium')) {
    mineralType = 'lithium';
  } else if (queryLower.includes('铜') || queryLower.includes('copper')) {
    mineralType = 'copper';
  }

  const timeout = (ms: number) => new Promise<void>((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), ms)
  );

  for (const source of RSS_SOURCES) {
    try {
      const feed = await Promise.race([
        parser.parseURL(source.url),
        timeout(5000)
      ]);

      for (const item of feed.items) {
        const title = item.title || '';
        const link = item.link || '';
        const snippet = item.contentSnippet || '';
        const pubDate = item.pubDate ? new Date(item.pubDate) : null;

        // 计算相关性分数
        const relevance = calculateRelevance(title, snippet, query, mineralType);

        // 跳过低相关性的新闻
        if (relevance < 3) continue;

        // 日期过滤
        if (!pubDate || pubDate < minDate) continue;

        articles.push({
          title,
          url: link,
          source: source.name,
          publishedAt: pubDate.toISOString(),
          summary: snippet,
          // @ts-ignore - 自定义属性
          _relevance: relevance,
        });
      }
    } catch (err) {
      // 单个源失败不影响其他源
      console.error(`Skipping ${source.name}`);
    }
  }

  // 按相关性分数排序，然后按日期
  articles.sort((a, b) => {
    // @ts-ignore
    const relevanceDiff = (b._relevance || 0) - (a._relevance || 0);
    if (relevanceDiff !== 0) return relevanceDiff;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  // 移除内部属性
  const cleanArticles = articles.map(({ _relevance, ...rest }) => rest);

  return {
    articles: cleanArticles.slice(0, 10), // 限制返回数量
    totalResults: cleanArticles.length,
    query,
  };
}

/**
 * 获取文章详细内容
 */
async function fetchArticleContent(url: string): Promise<NewsArticle | null> {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const $ = cheerio.load(response.data);

    // 移除脚本和样式
    $('script, style, nav, footer, header, aside').remove();

    const title = $('h1').first().text().trim() ||
                  $('title').first().text().trim() ||
                  'Untitled';

    const content = $('article').first().html() ||
                   $('main').first().html() ||
                   $('body').first().html() || '';

    // 提取纯文本
    const cleanContent = $(content).text().trim().slice(0, 5000);

    // 提取发布日期
    const publishedAt = $('time').first().attr('datetime') ||
                      $('[itemprop="datePublished"]').first().attr('content') ||
                      new Date().toISOString();

    // 提取来源
    const source = $('meta[property="og:site_name"]').attr('content') ||
                  new URL(url).hostname;

    return {
      title,
      url,
      source,
      publishedAt,
      summary: cleanContent.slice(0, 500),
      content: cleanContent,
    };
  } catch (err) {
    console.error(`Error fetching article from ${url}:`, err);
    return null;
  }
}

// MCP服务器实现
const server = new Server(
  {
    name: 'mining-news-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 注册工具列表
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search',
        description: '搜索矿业相关新闻文章',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: '搜索关键词，如矿种名称、公司名称或地区',
            },
            days: {
              type: 'number',
              description: '搜索最近几天的新闻，默认7天',
              default: 7,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'fetch_article',
        description: '获取新闻文章的详细内容',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: '文章URL链接',
            },
          },
          required: ['url'],
        },
      },
    ],
  };
});

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'search') {
      const { query, days = 7 } = args as { query: string; days?: number };
      const result = await searchNews(query, days);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    if (name === 'fetch_article') {
      const { url } = args as { url: string };
      const article = await fetchArticleContent(url);

      if (!article) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: '无法获取文章内容' }, null, 2),
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(article, null, 2),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: `Unknown tool: ${name}` }, null, 2),
        },
      ],
      isError: true,
    };
  } catch (error) {
    console.error('Tool error:', error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: String(error) }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Mining News MCP Server running on stdio');
}

main().catch(console.error);
