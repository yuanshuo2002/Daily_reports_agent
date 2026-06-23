FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src/ ./src/
COPY tsconfig.json ./

RUN npm install -g tsx typescript

# 创建报告输出目录
RUN mkdir -p /app/reports

CMD ["npx", "tsx", "src/index.ts"]
