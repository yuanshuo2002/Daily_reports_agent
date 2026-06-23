/**
 * mining-news-mcp 服务测试脚本
 *
 * 使用方法: npx tsx scripts/test-news-mcp.ts
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function testNewsMCP() {
  console.log('🔍 测试 mining-news-mcp 服务...\n');

  const client = new Client(
    { name: 'test-client', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', '../packages/mining-news-mcp/src/index.ts'],
  });

  await client.connect(transport);
  console.log('✅ MCP 服务器已连接\n');

  // 测试1: 列出可用工具
  console.log('📋 测试1: 列出工具');
  const toolsResponse = await client.request(
    { method: 'tools/list' },
    { method: 'tools/list', params: {} }
  );
  console.log('可用工具:', JSON.stringify(toolsResponse.tools, null, 2));
  console.log();

  // 测试2: 搜索新闻
  console.log('📰 测试2: 搜索 "lithium" 新闻');
  const searchResult = await client.request(
    { method: 'tools/call', params: { name: 'search', arguments: { query: 'lithium', days: 7 } } },
    { method: 'tools/call', params: { name: 'search', arguments: { query: 'lithium', days: 7 } } }
  );
  console.log('搜索结果:', JSON.stringify(searchResult, null, 2));
  console.log();

  // 测试3: 获取文章详情 (如果有结果)
  const content = searchResult as { content?: Array<{ text: string }> };
  if (content.content && content.content[0]) {
    try {
      const parsed = JSON.parse(content.content[0].text);
      if (parsed.articles && parsed.articles.length > 0) {
        console.log('📄 测试3: 获取文章详情');
        const articleUrl = parsed.articles[0].url;
        console.log('URL:', articleUrl);

        const articleResult = await client.request(
          { method: 'tools/call', params: { name: 'fetch_article', arguments: { url: articleUrl } } },
          { method: 'tools/call', params: { name: 'fetch_article', arguments: { url: articleUrl } } }
        );
        console.log('文章内容:', JSON.stringify(articleResult, null, 2));
      }
    } catch (e) {
      console.log('解析结果失败或无文章:', e);
    }
  }

  await client.close();
  console.log('\n✅ 测试完成');
}

testNewsMCP().catch(console.error);
