# Node 20 + Next.js standalone（Next 14.2.x）
FROM node:20-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Docker 預設：資料與圖檔掛在同一 volume（見 docker-compose）
ENV PICTURE_REVIEW_DATA_DIR=/data
ENV PICTURE_REVIEW_OUTPUT_DIR=/data/output

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

RUN mkdir -p /data/output

# 以 root 執行，避免 bind mount 到 /data 時權限無法寫入（自架常見情境）
EXPOSE 3000
CMD ["node", "server.js"]
