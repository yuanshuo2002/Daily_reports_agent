# 矿权日报 Agent

基于 MCP (Model Context Protocol) 协议的矿业信息聚合智能代理系统。

## 项目概述

24小时用 MCP 协议搭建的"矿权日报 Agent"，整合矿业新闻、储量数据、价格行情，生成专业的矿业日报。

## 功能特性

- **新闻聚合**: 自动抓取全球矿业新闻源
- **储量分析**: 支持 NI 43-101 标准报告解析
- **价格监控**: LME 金属价格实时查询
- **AI增强**: 可选 Claude API 生成专业分析
- **风险预警**: 自动识别市场风险

## MCP 服务架构

| # | MCP Server | 工具 | 说明 |
|---|------------|------|------|
| 1 | mining-news-mcp | search, fetch_article | 新闻聚合 |
| 2 | mineral-pdf-mcp | extract_resources | PDF解析 (NI 43-101) |
| 3 | lme-price-mcp | get_price, get_trend | 价格行情 |

## 快速开始

### 安装依赖

```bash
npm install
```

### 生成日报

```bash
cd packages/mining-agent
npx tsx src/cli.ts "给我生成一份关于 Pilbara 锂矿的今日简报"
```

### Docker 部署

```bash
docker-compose up
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| ANTHROPIC_API_KEY | Claude API 密钥 | - |
| ANTHROPIC_MODEL | Claude 模型 | claude-opus-4-7 |

## 项目结构

```
├── packages/
│   ├── shared/              # 共享类型定义
│   ├── mining-news-mcp/     # 新闻MCP服务器
│   ├── mineral-pdf-mcp/     # PDF解析MCP服务器
│   ├── lme-price-mcp/       # 价格MCP服务器
│   └── mining-agent/        # 主Agent编排
├── docker-compose.yml       # Docker编排
├── mcp-config.json          # Claude Desktop配置
├── RUN.md                   # 快速启动指南
└── README.md
```

## 技术栈

- **MCP SDK** - Model Context Protocol
- **LangGraph** - Agent 状态机
- **TypeScript** - 类型安全
- **Docker** - 容器化部署

