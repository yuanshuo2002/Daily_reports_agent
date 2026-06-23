# 快速启动指南

本指南将帮助你在5分钟内运行矿权日报Agent。

## 前置要求

- Node.js >= 20.0.0
- npm >= 10.0.0
- Docker & Docker Compose (可选，用于Docker部署)

## 方法一：本地运行

### 1. 安装依赖

```bash
# 克隆或解压项目后，在根目录执行
npm install
```

### 2. 配置环境变量 (可选)

创建 `.env` 文件启用AI增强报告：

```bash
# .env
ANTHROPIC_API_KEY=your_api_key_here
ANTHROPIC_MODEL=claude-opus-4-7
```

### 3. 运行Agent

```bash
# 使用npm workspaces一次性安装所有包
npm run build

# 进入agent目录运行
cd packages/mining-agent

# 生成关于Pilbara锂矿的日报
npx tsx src/cli.ts "给我生成一份关于 Pilbara 锂矿的今日简报"

# 或分析其他矿区
npx tsx src/cli.ts "分析 Atacama 盐湖锂矿"
npx tsx src/cli.ts "查看 Nevada 铜矿情况"
```

## 方法二：Docker运行 (推荐)

### 1. 一键启动

```bash
# 设置API密钥 (可选)
export ANTHROPIC_API_KEY=your_api_key_here

# 启动所有服务并生成日报
docker-compose up
```

### 2. 查看报告

报告将输出到控制台，同时保存在 `reports/` 目录。

### 3. 停止服务

```bash
docker-compose down
```

## MCP服务器

### mining-news-mcp
新闻聚合服务，提供以下工具：
- `search(query, days)` - 搜索矿业新闻
- `fetch_article(url)` - 获取文章详情

### mineral-pdf-mcp
PDF解析服务(NI 43-101标准)，提供：
- `extract_resources(pdf_url)` - 从PDF提取储量数据

### lme-price-mcp
价格行情服务，提供：
- `get_price(commodity, date)` - 获取特定日期价格
- `get_trend(commodity, days)` - 获取价格趋势

## Claude Desktop / Cursor 集成

将 `mcp-config.json` 复制到你的MCP配置目录：

**Claude Desktop**:
```bash
# macOS
~/Library/Application Support/Claude/claude_desktop_config.json

# Windows
%APPDATA%\Claude\claude_desktop_config.json
```

**Cursor**:
```bash
# macOS
~/Library/Application Support/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/
```

## 常见问题

### Q: 提示 "npx: command not found"
确保已安装 Node.js 并将其添加到 PATH。

### Q: 报告生成失败
检查网络连接，MCP服务器需要访问RSS源和API。

### Q: 如何指定不同的矿区？
支持以下关键词：
- Pilbara, Atacama, Lithium Triangle, Nevada, Greenbushes

### Q: 如何指定矿种？
支持：lithium/锂, copper/铜, nickel/镍, cobalt/钴, gold/金

## 架构说明

```
┌─────────────────────────────────────────────────────────────┐
│                      Mining Agent                            │
│                  (LangGraph 编排)                            │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│mining-news-mcp│    │mineral-pdf-mcp│    │lme-price-mcp  │
│   新闻聚合     │    │   PDF解析     │    │   价格行情     │
└───────────────┘    └───────────────┘    └───────────────┘
        │                     │                     │
        ▼                     ▼                     ▼
   RSS Feeds           NI 43-101 PDFs          LME APIs
```

## 技术栈

- **MCP SDK**: Model Context Protocol 实现
- **LangGraph**: Agent 状态机编排
- **TypeScript**: 类型安全
- **Docker**: 容器化部署
