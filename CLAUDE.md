# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

矿权日报 Agent - 基于 MCP (Model Context Protocol) 协议的矿业信息聚合智能代理系统。

## 项目架构

```
├── packages/
│   ├── shared/               # 共享类型定义 (@mining-agent/shared)
│   ├── mining-news-mcp/      # 新闻MCP服务器 (RSS聚合)
│   ├── mineral-pdf-mcp/      # PDF解析MCP服务器 (NI 43-101报告)
│   ├── lme-price-mcp/        # 价格MCP服务器 (LME金属行情)
│   └── mining-agent/         # 主Agent编排层
│       ├── src/
│       │   ├── agent.ts      # LangGraph编排引擎
│       │   ├── cli.ts        # 命令行工具入口
│       │   ├── server.ts     # Express Web服务器
│       │   ├── mcp-client.ts # MCP客户端(stdio通信)
│       │   └── llm-client.ts # LLM统一抽象层
│       └── public/
│           └── index.html    # Web界面
├── docker-compose.yml         # 多容器编排
├── mcp-config.json            # Claude Desktop/Cursor MCP配置
└── tsconfig.json              # TypeScript配置(继承结构)
```

### 核心模块

- **MiningAgent** (`agent.ts`): 使用 LangGraph 编排数据收集流程
  - `parseQuery()` - 解析矿区(Pilbara, Atacama等)和矿种(锂/铜/金等)
  - `collectNews/Resources/Prices()` - 并行调用MCP服务获取数据
  - `generateRiskWarnings()` - 基于新闻和价格生成风险分析
  - `generateFinalReport()` - 调用LLM生成专业日报

- **LLMClient** (`llm-client.ts`): 统一抽象多模型提供商
  - 支持 Anthropic/OpenAI/DeepSeek/兼容模式
  - `AVAILABLE_MODELS` 数组定义支持的模型
  - `createLLMClient()` 工厂函数创建客户端

- **MCPToolClient** (`mcp-client.ts`): 通过子进程stdio与MCP服务通信
  - Windows: 使用 `cmd /c npx tsx` 启动
  - Unix: 直接使用 `tsx` 启动

## 常用命令

```bash
# 安装依赖
npm install

# 开发模式 (tsx热重载)
cd packages/mining-agent && npm run dev     # 主Agent
cd packages/mining-news-mcp && npm run dev  # 新闻MCP
cd packages/mining-agent && npm run web     # Web界面

# 构建 (TypeScript编译)
npm run build --workspaces    # 全部包
cd packages/mining-agent && npm run build   # 仅主包

# 命令行使用
cd packages/mining-agent
npx tsx src/cli.ts "Pilbara锂矿日报"
npx tsx src/cli.ts "铜矿行情分析" --save     # 保存到文件

# Docker
docker-compose up              # 启动所有MCP服务
docker-compose down            # 停止服务
```

### MCP服务器独立运行

```bash
# 新闻服务
cd packages/mining-news-mcp && npm run dev

# PDF解析服务
cd packages/mineral-pdf-mcp && npm run dev

# 价格行情服务
cd packages/lme-price-mcp && npm run dev
```

### MCP服务器工具

| 服务 | 工具 | 参数 | 说明 |
|------|------|------|------|
| mining-news-mcp | search | query, days | 搜索矿业新闻 |
| mining-news-mcp | fetch_article | url | 获取文章详情 |
| mineral-pdf-mcp | extract_resources | pdf_url | 提取NI 43-101储量 |
| lme-price-mcp | get_price | commodity, date | 单日金属价格 |
| lme-price-mcp | get_trend | commodity, days | 价格趋势统计 |

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| ANTHROPIC_API_KEY | Claude API密钥 | - |
| OPENAI_API_KEY | OpenAI API密钥 | - |
| DEEPSEEK_API_KEY | DeepSeek API密钥 | - |
| COMPATIBLE_API_KEY | 兼容模式API密钥 | - |
| COMPATIBLE_BASE_URL | 兼容模式端点 | - |
| COMPATIBLE_MODEL | 兼容模式模型名 | gpt-4o |
| DEFAULT_MODEL | 默认模型ID | claude-opus-4-7 |
| ANTHROPIC_MODEL | Claude模型 | claude-opus-4-7 |
| OPENAI_MODEL | OpenAI模型 | gpt-4o |
| DEEPSEEK_MODEL | DeepSeek模型 | deepseek-chat |
| PORT | Web服务端口 | 3000 |

### 兼容模式 (硅基流动/阿里云)

```bash
COMPATIBLE_API_KEY=your_key
COMPATIBLE_BASE_URL=https://api.siliconflow.cn/v1
COMPATIBLE_MODEL=gpt-4o
```

## LLM 支持

支持多种大模型，通过 `llm-client.ts` 统一抽象：

| 提供商 | 模型ID | 说明 |
|--------|--------|------|
| Anthropic | claude-opus-4-7 | 最强推理能力 |
| Anthropic | claude-sonnet-4-6 | 平衡性能 |
| Anthropic | claude-haiku-4-5 | 快速响应 |
| OpenAI | gpt-4o, gpt-4-turbo, gpt-3.5-turbo | GPT系列 |
| DeepSeek | deepseek-chat | 深度求索 |
| 兼容模式 | custom | 硅基流动/阿里云等 |

Web UI 可通过下拉菜单自由切换模型，Agent在 `generateDailyReport(query, modelId)` 时也支持指定模型。

## 开发说明

- **npm workspaces**: 根目录 `package.json` 管理所有子包，`npm run build --workspaces` 批量构建
- **TypeScript**: 每个包独立编译，共享配置继承根目录 `tsconfig.json`
- **MCP通信**: 子进程stdio方式，`MCPToolClient` 处理进程生命周期
- **模拟数据**: MCP连接失败时自动降级使用模拟数据，确保功能可用
- **Web界面**: Express + 原生HTML/CSS/JS，无需构建直接服务静态文件
