FROM node:20-alpine

WORKDIR /app

# 安装PDF处理依赖
RUN apk add --no-cache python3 make g++

# 安装pdfkit依赖
COPY package*.json ./
RUN npm ci --only=production

# 复制源代码
COPY src/ ./src/
COPY tsconfig.json ./

# 全局安装tsx
RUN npm install -g tsx typescript

# 启动命令
CMD ["npx", "tsx", "src/index.ts"]
