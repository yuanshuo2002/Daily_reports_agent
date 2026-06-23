# 快速启动指南

本指南将帮助你在5分钟内运行矿权日报Agent。

## 前置要求

- Node.js >= 20.0.0
- npm >= 10.0.0
- Docker & Docker Compose (可选)

## 方法一：Web 界面（推荐）

简洁美观的浏览器界面，无需命令行操作。

```bash
# 1. 安装依赖
npm install

# 2. 启动Web服务
cd packages/mining-agent
npm run web
```

然后打开浏览器访问 **http://localhost:3000**

### Web界面功能

- 预设快捷按钮（一键查询常见矿区）
- 实时显示日报生成状态
- Markdown 格式渲染
- 一键下载保存报告

---

## 方法二：命令行

```bash
cd packages/mining-agent

# 生成关于Pilbara锂矿的日报
npx tsx src/cli.ts "给我生成一份关于 Pilbara 锂矿的今日简报"

# 保存报告到文件
npx tsx src/cli.ts "给我生成一份关于 Pilbara 锂矿的今日简报" --save

# 或分析其他矿区
npx tsx src/cli.ts "分析 Atacama 盐湖锂矿"
npx tsx src/cli.ts "查看 Nevada 铜矿情况"
```

---

## 方法三：Docker 运行

```bash
# 设置API密钥 (可选)
export ANTHROPIC_API_KEY=your_api_key_here

# 启动所有服务
docker-compose up
```

---

## MCP 服务

| 服务 | 工具 | 说明 |
|------|------|------|
| mining-news-mcp | search, fetch_article | 新闻聚合 |
| mineral-pdf-mcp | extract_resources | PDF解析 (NI 43-101) |
| lme-price-mcp | get_price, get_trend | 价格行情 |

---

## Claude Desktop / Cursor 集成

将 `mcp-config.json` 复制到配置目录：

**Claude Desktop**:
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

**Cursor**:
- macOS: `~/Library/Application Support/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/`

---

## 环境变量

```bash
# .env
ANTHROPIC_API_KEY=your_api_key_here  # 可选，用于AI增强
ANTHROPIC_MODEL=claude-opus-4-7     # 可选
PORT=3000                           # Web服务端口
```

---

## 常见问题

**Q: Web界面打不开？**
检查端口是否被占用：`lsof -i :3000`

**Q: 报告内容为空？**
网络限制可能导致RSS获取失败，会自动使用模拟数据。

**Q: 如何指定矿区？**
支持关键词：Pilbara, Atacama, Lithium Triangle, Nevada, Greenbushes

**Q: 如何指定矿种？**
支持：lithium/锂, copper/铜, nickel/镍, cobalt/钴, gold/金

---

## 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     Web UI / CLI                            │
│                  http://localhost:3000                       │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│mining-news-mcp│    │mineral-pdf-mcp│    │lme-price-mcp  │
│   新闻聚合     │    │   PDF解析     │    │   价格行情     │
└───────────────┘    └───────────────┘    └───────────────┘
```

---

## 技术栈

- **MCP SDK** - Model Context Protocol
- **Express** - Web 服务器
- **TypeScript** - 类型安全
- **Docker** - 容器化部署
