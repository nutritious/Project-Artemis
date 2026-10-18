FROM node:22-alpine
RUN apk add --no-cache su-exec
WORKDIR /app
ENV NODE_ENV=production PORT=8080 ARTEMIS_DATA=/data
COPY package*.json ./
RUN npm ci --omit=dev
COPY tsconfig.json ./
COPY src ./src
COPY public ./public
VOLUME /data
EXPOSE 8080
# Render mounts the disk as root; fix its owner, then run the app as the unprivileged "node" user.
CMD ["sh", "-c", "mkdir -p /data && chown -R node:node /data; exec su-exec node npx tsx src/server.ts"]
