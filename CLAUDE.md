# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

矿权日报 Agent - 基于 MCP (Model Context Protocol) 协议的矿业信息聚合智能代理系统。

## 项目架构

```
├── packages/
│   ├── mining-news-mcp/     # 矿业新闻聚合服务 (TypeScript)
│   ├── mineral-pdf-mcp/     # NI 43-101 PDF解析服务 (TypeScript)
│   ├── lme-price-mcp/       # LME金属价格行情服务 (TypeScript)
│   ├── mining-agent/        # 主Agent编排层
│   └── shared/              # 共享类型定义
├── docker-compose.yml       # Docker编排
├── mcp-config.json          # Claude Desktop/Cursor MCP配置
├── RUN.md                   # 快速启动指南
└── README.md
```

## 常用命令

```bash
# 安装依赖
npm install

# 构建所有包
npm run build

# 运行开发模式
docker-compose up

# 清理构建产物
npm run clean

# TypeScript类型检查
npx tsc --noEmit
```

## MCP服务器工具

### mining-news-mcp
- `search(query, days)` - 搜索矿业新闻
- `fetch_article(url)` - 获取文章详细内容

### mineral-pdf-mcp
- `extract_resources(pdf_url)` - 从NI 43-101报告提取储量数据

### lme-price-mcp
- `get_price(commodity, date)` - 获取金属价格
- `get_trend(commodity, days)` - 获取价格趋势

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| ANTHROPIC_API_KEY | Claude API密钥 | - |
| ANTHROPIC_MODEL | Claude模型 | claude-opus-4-7 |

## 开发说明

- 使用 `npm workspaces` 管理多包项目
- MCP服务器通过 stdio 通信
- Agent使用TypeScript开发，支持tsx热重载
- Docker容器化部署，支持docker-compose一键启动
