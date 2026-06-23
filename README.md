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
- **Web界面**: 简洁美观的浏览器操作界面

## 快速开始

### 方式一：Web 界面（推荐）

```bash
cd packages/mining-agent
npm run web
```

然后打开浏览器访问 **http://localhost:3000**

### 方式二：命令行

```bash
cd packages/mining-agent
npx tsx src/cli.ts "给我生成一份关于 Pilbara 锂矿的今日简报"
```

### 方式三：Docker 部署

```bash
docker-compose up
```

## MCP 服务架构

| # | MCP Server | 工具 | 说明 |
|---|------------|------|------|
| 1 | mining-news-mcp | search, fetch_article | 新闻聚合 |
| 2 | mineral-pdf-mcp | extract_resources | PDF解析 (NI 43-101) |
| 3 | lme-price-mcp | get_price, get_trend | 价格行情 |

## 项目结构

```
├── packages/
│   ├── shared/              # 共享类型定义
│   ├── mining-news-mcp/     # 新闻MCP服务器
│   ├── mineral-pdf-mcp/     # PDF解析MCP服务器
│   ├── lme-price-mcp/       # 价格MCP服务器
│   └── mining-agent/        # 主Agent编排
│       ├── src/
│       │   ├── agent.ts     # Agent核心逻辑
│       │   ├── cli.ts       # 命令行工具
│       │   ├── server.ts    # Web服务器
│       │   └── mcp-client.ts # MCP客户端
│       └── public/
│           └── index.html   # Web界面
├── docker-compose.yml       # Docker编排
├── mcp-config.json          # Claude Desktop配置
├── RUN.md                  # 快速启动指南
└── README.md
```

## 环境变量配置

### 快速配置

1. 复制示例配置文件：
```bash
cd packages/mining-agent
cp .env.example .env
```

2. 编辑 `.env` 文件，填入你的 API 密钥

3. 启动服务：
```bash
npm run web
```

### 详细配置

| 变量 | 说明 | 默认值 |
|------|------|--------|
| ANTHROPIC_API_KEY | Claude API 密钥 | - |
| OPENAI_API_KEY | OpenAI API 密钥 | - |
| DEEPSEEK_API_KEY | DeepSeek API 密钥 | - |
| DEFAULT_MODEL | 默认模型 | claude-opus-4-7 |
| ANTHROPIC_MODEL | Claude 模型 | claude-opus-4-7 |
| OPENAI_MODEL | OpenAI 模型 | gpt-4o |
| DEEPSEEK_MODEL | DeepSeek 模型 | deepseek-chat |
| PORT | Web服务端口 | 3000 |

### 获取 API 密钥

**Anthropic (Claude)**
1. 访问 https://console.anthropic.com/
2. 注册/登录账号
3. 在 API Keys 中创建新密钥

**OpenAI**
1. 访问 https://platform.openai.com/
2. 注册/登录账号
3. 在 API Keys 中创建新密钥

**DeepSeek**
1. 访问 https://platform.deepseek.com/
2. 注册/登录账号
3. 在 API Keys 中创建新密钥

**硅基流动 (SiliconFlow)** - 国内用户推荐
1. 访问 https://siliconflow.cn/
2. 注册/登录账号
3. 在 API 密钥中创建新密钥

## 支持的大模型

系统支持多种大模型提供商，可在 Web UI 中自由切换：

| 提供商 | 模型 | 说明 |
|--------|------|------|
| Anthropic | Claude Opus 4.7 | 最强推理能力 |
| Anthropic | Claude Sonnet 4.6 | 平衡性能 |
| Anthropic | Claude Haiku 4.5 | 快速响应 |
| OpenAI | GPT-4o | 最新 GPT-4 |
| OpenAI | GPT-4 Turbo | 高性能 |
| OpenAI | GPT-3.5 Turbo | 快速低成本 |
| DeepSeek | DeepSeek Chat | 深度求索对话模型 |
| 兼容模式 | 自定义端点 | 支持硅基流动、阿里云等 |

### 兼容模式配置

如需使用其他兼容 OpenAI 接口的模型（如硅基流动、阿里云等），配置以下环境变量：

```bash
COMPATIBLE_API_KEY=your_api_key
COMPATIBLE_BASE_URL=https://api.siliconflow.cn/v1
COMPATIBLE_MODEL=gpt-4o
```

## 生成的日报示例

```markdown
# 🏔️ Pilbara 矿业日报
> 📅 2026年6月23日 | 🤖 自动生成

---

## 📰 今日要点
[3-5句话总结最重要的新闻]

## 📊 储量与价格
| 商品 | 当前均价 | 30日区间 | 趋势 |
|------|--------:|--------:|:----:|
| Lithium | ¥14K | ¥13K~¥15K | ➡️ 平稳 |

## ⚠️ 风险提示
| 🔴/🟡/🟢 | 风险等级 | 描述 |
```

## 技术栈

- **MCP SDK** - Model Context Protocol
- **Express** - Web 服务器
- **TypeScript** - 类型安全
- **Docker** - 容器化部署
