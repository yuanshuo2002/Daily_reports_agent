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

// 矿业新闻RSS源
const RSS_SOURCES = [
  { name: 'Mining.com', url: 'https://www.mining.com/feed/', type: 'rss' },
  { name: 'Reuters Mining', url: 'https://feeds.reuters.com/reuters/businessNews', type: 'rss' },
  // 国内矿业新闻源
  { name: '中国矿业网', url: 'http://www.chinamining.org.cn/rss', type: 'rss' },
  { name: '矿业圈', url: 'https://www.mining-circle.com/rss', type: 'rss' },
];

// 关键词匹配规则
const MINING_KEYWORDS = [
  'lithium', 'lithium', '锂矿', 'mining', 'mineral', 'mining', 'mining',
  'copper', 'iron ore', 'gold', 'silver', 'coal', 'rare earth', '稀土',
  'bauxite', 'nickel', 'zinc', 'lead', '矿', '矿业', '锂电池',
  'Pilbara', '锂', 'cobalt', '钴', 'spodumene', '锂辉石'
];

/**
 * 搜索矿业新闻
 */
async function searchNews(query: string, days: number = 7): Promise<NewsSearchResult> {
  const articles: NewsArticle[] = [];
  const queryLower = query.toLowerCase();
  const minDate = new Date();
  minDate.setDate(minDate.getDate() - days);

  const timeout = (ms: number) => new Promise<void>((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), ms)
  );

  for (const source of RSS_SOURCES) {
    try {
      // 每个源最多5秒超时
      const feed = await Promise.race([
        parser.parseURL(source.url),
        timeout(5000)
      ]);

      for (const item of feed.items) {
        const title = item.title || '';
        const link = item.link || '';
        const pubDate = item.pubDate ? new Date(item.pubDate) : null;

        // 检查是否匹配查询
        const matchesQuery = title.toLowerCase().includes(queryLower) ||
                            (item.contentSnippet || '').toLowerCase().includes(queryLower);

        // 检查是否是矿业相关内容
        const matchesMining = MINING_KEYWORDS.some(
          kw => title.toLowerCase().includes(kw.toLowerCase()) ||
                (item.contentSnippet || '').toLowerCase().includes(kw.toLowerCase())
        );

        if ((matchesQuery || matchesMining) && pubDate && pubDate >= minDate) {
          articles.push({
            title,
            url: link,
            source: source.name,
            publishedAt: pubDate.toISOString(),
            summary: item.contentSnippet || item.content || '',
          });
        }
      }
    } catch (err) {
      // 单个源失败不影响其他源
      console.error(`Skipping ${source.name} (${err instanceof Error ? err.message : 'error'})`);
    }
  }

  // 按日期排序
  articles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  return {
    articles: articles.slice(0, 20),
    totalResults: articles.length,
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
