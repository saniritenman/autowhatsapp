FROM node:24-bookworm-slim
ENV NODE_ENV=production PUPPETEER_SKIP_DOWNLOAD=true CHROME_PATH=/usr/bin/chromium
RUN apt-get update && apt-get install -y --no-install-recommends chromium ca-certificates fonts-noto-core && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY bridge/package.json bridge/package-lock.json ./bridge/
RUN cd bridge && npm ci --omit=dev --ignore-scripts
COPY supabase/functions/_shared ./supabase/functions/_shared
COPY supabase/functions/dispatch/core.ts ./supabase/functions/dispatch/core.ts
COPY bridge/index.mjs ./bridge/index.mjs
RUN mkdir -p /data/whatsapp && chown -R node:node /data /app
USER node
ENV SESSION_PATH=/data/whatsapp PORT=10000
EXPOSE 10000
CMD ["node","bridge/index.mjs"]
