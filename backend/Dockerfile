# TIXXGO Production Dockerfile
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./
RUN npm ci --only=production

# Copy source code and frontend assets
COPY src/ ./src/
COPY ../frontend/ ./frontend/

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

# Copy application artifacts
COPY --from=builder /app ./

EXPOSE 4000

# Non-root user for security
USER node

CMD ["node", "src/server.js"]
