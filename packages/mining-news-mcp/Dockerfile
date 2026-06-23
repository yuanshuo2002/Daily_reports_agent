FROM node:20-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci --only=production

# 复制源代码
COPY src/ ./src/
COPY tsconfig.json ./

# 全局安装tsx
RUN npm install -g tsx typescript

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["npx", "tsx", "src/index.ts"]
