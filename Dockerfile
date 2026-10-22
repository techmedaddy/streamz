FROM node:20-alpine AS base

WORKDIR /app

# Install build tools for native packages
RUN apk add --no-cache libc6-compat python3 make g++

# Copy workspace package manifests for optimized Docker layer caching
COPY package*.json ./
COPY packages/contracts/package*.json ./packages/contracts/
COPY packages/kafka-client/package*.json ./packages/kafka-client/
COPY packages/order-service/package*.json ./packages/order-service/
COPY packages/inventory-service/package*.json ./packages/inventory-service/
COPY packages/notification-worker/package*.json ./packages/notification-worker/
COPY packages/observability-service/package*.json ./packages/observability-service/
COPY packages/dashboard-ui/package*.json ./packages/dashboard-ui/

# Install all monorepo dependencies
RUN npm install

# Copy complete project source code
COPY . .

# Build all TypeScript microservices & Next.js dashboard
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000

# Expose Web Dashboard (3000), Order API (3001), Inventory API (3002), Notification (3003), Observability (3004)
EXPOSE 3000 3001 3002 3003 3004

CMD ["npm", "start"]
