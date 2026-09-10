# CloudShield Google Cloud Run Dockerfile
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application sources
COPY . .

# Build Vite frontend and bundled Node server.ts
RUN npm run build

# Production runtime stage
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled assets and server
COPY --from=builder /app/dist ./dist

EXPOSE 3000

# Start CloudShield full-stack server
CMD ["node", "dist/server.cjs"]
