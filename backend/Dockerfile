FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --workspace backend --include-workspace-root=false
COPY backend ./backend
RUN npm run db:generate -w backend && npm run build -w backend

FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/backend ./backend
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node
WORKDIR /app/backend
EXPOSE 4000
CMD ["sh", "-c", "node ../node_modules/prisma/build/index.js migrate deploy && node dist/src/server.js"]
