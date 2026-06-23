FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src/ ./src/
COPY tsconfig.json ./

RUN npm install -g tsx typescript

CMD ["npx", "tsx", "src/index.ts"]
