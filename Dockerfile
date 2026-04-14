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

# 將 data/ 下的設定檔打包為預設值；entrypoint 在 volume 缺檔時自動複製
COPY --from=builder /app/data/survey.json /app/defaults/survey.json
COPY --from=builder /app/data/assignment.json /app/defaults/assignment.json

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

RUN mkdir -p /data/output

# 以 root 執行，避免 bind mount 到 /data 時權限無法寫入（自架常見情境）
EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
