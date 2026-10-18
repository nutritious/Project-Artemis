FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080 ARTEMIS_DATA=/data
COPY package*.json ./
RUN npm ci --omit=dev
COPY tsconfig.json ./
COPY src ./src
COPY public ./public
VOLUME /data
EXPOSE 8080
USER node
CMD ["npx", "tsx", "src/server.ts"]
