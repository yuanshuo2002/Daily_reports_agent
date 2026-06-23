/**
 * LME金属价格行情MCP服务器
 *
 * 提供工具:
 * - get_price: 获取特定日期的金属价格
 * - get_trend: 获取历史价格趋势
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// 支持的金属商品
const COMMODITIES: Record<string, {
  name: string;
  lmeCode: string;
  unit: string;
  currency: string;
}> = {
  'lithium': { name: 'Lithium Carbonate', lmeCode: 'LI', unit: 'USD/tonne', currency: 'USD' },
  'lithium-carbonate': { name: 'Lithium Carbonate', lmeCode: 'LI', unit: 'USD/tonne', currency: 'USD' },
  'spodumene': { name: 'Spodumene', lmeCode: 'SP', unit: 'USD/tonne', currency: 'USD' },
  'copper': { name: 'Copper', lmeCode: 'CA', unit: 'USD/tonne', currency: 'USD' },
  'aluminum': { name: 'Aluminum', lmeCode: 'AL', unit: 'USD/tonne', currency: 'USD' },
  'zinc': { name: 'Zinc', lmeCode: 'ZN', unit: 'USD/tonne', currency: 'USD' },
  'nickel': { name: 'Nickel', lmeCode: 'NI', unit: 'USD/tonne', currency: 'USD' },
  'lead': { name: 'Lead', lmeCode: 'PB', unit: 'USD/tonne', currency: 'USD' },
  'tin': { name: 'Tin', lmeCode: 'SN', unit: 'USD/tonne', currency: 'USD' },
  'iron-ore': { name: 'Iron Ore', lmeCode: 'FE', unit: 'USD/tonne', currency: 'USD' },
  'gold': { name: 'Gold', lmeCode: 'AU', unit: 'USD/oz', currency: 'USD' },
  'silver': { name: 'Silver', lmeCode: 'AG', unit: 'USD/oz', currency: 'USD' },
  'cobalt': { name: 'Cobalt', lmeCode: 'CO', unit: 'USD/tonne', currency: 'USD' },
};

// 基础价格数据 (用于演示)
const BASE_PRICES: Record<string, number> = {
  'lithium': 13500,
  'lithium-carbonate': 13500,
  'spodumene': 980,
  'copper': 8450,
  'aluminum': 2250,
  'zinc': 2650,
  'nickel': 16200,
  'lead': 2100,
  'tin': 28500,
  'iron-ore': 118,
  'gold': 2320,
  'silver': 29.5,
  'cobalt': 33500,
};

/**
 * 获取金属价格
 */
async function getPrice(commodity: string, date?: string): Promise<{
  commodity: string;
  date: string;
  price: number;
  currency: string;
  unit: string;
  change: number;
  changePercent: number;
} | null> {
  const commodityLower = commodity.toLowerCase();
  const commodityInfo = COMMODITIES[commodityLower];

  if (!commodityInfo) {
    return null;
  }

  // 获取基础价格
  const basePrice = BASE_PRICES[commodityLower] || 1000;

  // 根据日期添加一些随机波动 (模拟)
  const targetDate = date ? new Date(date) : new Date();
  const dayOfYear = Math.floor((targetDate.getTime() - new Date(targetDate.getFullYear(), 0, 0).getTime()) / 86400000);
  const seed = dayOfYear + targetDate.getFullYear();

  // 简单的伪随机变化 (-5% 到 +5%)
  const variation = ((Math.sin(seed) * 0.5 + 0.5) * 0.1 - 0.05);
  const price = Math.round(basePrice * (1 + variation));

  // 计算与前一天的变化
  const prevVariation = ((Math.sin(seed - 1) * 0.5 + 0.5) * 0.1 - 0.05);
  const prevPrice = Math.round(basePrice * (1 + prevVariation));
  const change = price - prevPrice;
  const changePercent = (change / prevPrice) * 100;

  return {
    commodity: commodityInfo.name,
    date: targetDate.toISOString().split('T')[0],
    price,
    currency: commodityInfo.currency,
    unit: commodityInfo.unit,
    change: Math.round(change * 100) / 100,
    changePercent: Math.round(changePercent * 100) / 100,
  };
}

/**
 * 获取价格趋势
 */
async function getTrend(commodity: string, days: number = 30): Promise<{
  commodity: string;
  startDate: string;
  endDate: string;
  prices: Array<{
    date: string;
    price: number;
    currency: string;
    unit: string;
    change: number;
    changePercent: number;
  }>;
  average: number;
  high: number;
  low: number;
  trend: 'up' | 'down' | 'stable';
}> {
  const commodityLower = commodity.toLowerCase();
  const commodityInfo = COMMODITIES[commodityLower];

  if (!commodityInfo) {
    return {
      commodity,
      startDate: '',
      endDate: '',
      prices: [],
      average: 0,
      high: 0,
      low: 0,
      trend: 'stable',
    };
  }

  const basePrice = BASE_PRICES[commodityLower] || 1000;
  const prices: Array<{
    date: string;
    price: number;
    currency: string;
    unit: string;
    change: number;
    changePercent: number;
  }> = [];

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  let total = 0;
  let high = 0;
  let low = Infinity;

  for (let i = 0; i < days; i++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(currentDate.getDate() + i);

    // 生成伪随机价格
    const seed = currentDate.getFullYear() * 1000 + currentDate.getMonth() * 100 + currentDate.getDate();
    const variation = ((Math.sin(seed * 0.7) * 0.5 + 0.5) * 0.15 - 0.05);
    const price = Math.round(basePrice * (1 + variation));

    if (i > 0) {
      const prevPrice = prices[i - 1].price;
      const change = price - prevPrice;
      const changePercent = (change / prevPrice) * 100;

      prices.push({
        date: currentDate.toISOString().split('T')[0],
        price,
        currency: commodityInfo.currency,
        unit: commodityInfo.unit,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(changePercent * 100) / 100,
      });
    } else {
      prices.push({
        date: currentDate.toISOString().split('T')[0],
        price,
        currency: commodityInfo.currency,
        unit: commodityInfo.unit,
        change: 0,
        changePercent: 0,
      });
    }

    total += price;
    high = Math.max(high, price);
    low = Math.min(low, price);
  }

  const average = Math.round(total / days);
  const firstPrice = prices[0].price;
  const lastPrice = prices[prices.length - 1].price;
  const overallChange = lastPrice - firstPrice;

  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (overallChange > basePrice * 0.02) {
    trend = 'up';
  } else if (overallChange < -basePrice * 0.02) {
    trend = 'down';
  }

  return {
    commodity: commodityInfo.name,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    prices,
    average,
    high,
    low,
    trend,
  };
}

// MCP服务器实现
const server = new Server(
  {
    name: 'lme-price-mcp',
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
  const commodityList = Object.keys(COMMODITIES).join(', ');

  return {
    tools: [
      {
        name: 'get_price',
        description: '获取特定日期的金属商品价格',
        inputSchema: {
          type: 'object',
          properties: {
            commodity: {
              type: 'string',
              description: `商品名称，支持: ${commodityList}`,
            },
            date: {
              type: 'string',
              description: '日期 (YYYY-MM-DD格式)，默认为今天',
            },
          },
          required: ['commodity'],
        },
      },
      {
        name: 'get_trend',
        description: '获取金属商品的历史价格趋势',
        inputSchema: {
          type: 'object',
          properties: {
            commodity: {
              type: 'string',
              description: `商品名称，支持: ${commodityList}`,
            },
            days: {
              type: 'number',
              description: '查询天数，默认30天',
              default: 30,
            },
          },
          required: ['commodity'],
        },
      },
    ],
  };
});

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'get_price') {
      const { commodity, date } = args as { commodity: string; date?: string };
      const result = await getPrice(commodity, date);

      if (!result) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: `不支持的商品: ${commodity}`,
                supported: Object.keys(COMMODITIES),
              }, null, 2),
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    if (name === 'get_trend') {
      const { commodity, days = 30 } = args as { commodity: string; days?: number };
      const result = await getTrend(commodity, days);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
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
  console.error('LME Price MCP Server running on stdio');
}

main().catch(console.error);
