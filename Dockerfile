# TIXXGO Production Dockerfile (Root Context)
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package manifests from backend
COPY backend/package*.json ./backend/

# Install production dependencies
WORKDIR /app/backend
RUN npm ci --only=production

# Copy source code and frontend assets
WORKDIR /app
COPY backend/src/ ./backend/src/
COPY frontend/ ./frontend/

# Runner Stage
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

# Copy built artifacts
COPY --from=builder /app ./

WORKDIR /app/backend

EXPOSE 4000

# Non-root user for security
USER node

CMD ["node", "src/server.js"]
