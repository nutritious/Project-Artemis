FROM node:22-bookworm-slim
# gosu drops root after the data disk is fixed. Chromium and Firefox power the built-in cloud browser.
RUN apt-get update && apt-get install -y --no-install-recommends gosu ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production PORT=8080 ARTEMIS_DATA=/data PLAYWRIGHT_BROWSERS_PATH=/ms-playwright CLOUD_NOSANDBOX=1 CLOUD_MAX=1
COPY package*.json ./
RUN npm ci --omit=dev
RUN npx playwright install --with-deps chromium firefox && chmod -R a+rX /ms-playwright && rm -rf /var/lib/apt/lists/*
COPY tsconfig.json ./
COPY src ./src
COPY public ./public
EXPOSE 8080
# Render mounts the disk as root; fix its owner, then run the app as the unprivileged "node" user.
CMD ["sh", "-c", "mkdir -p /data && chown -R node:node /data; exec gosu node npx tsx src/server.ts"]
