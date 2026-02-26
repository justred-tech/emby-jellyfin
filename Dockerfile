# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

# Install runtime dependencies including build tools for better-sqlite3
RUN apk add --no-cache curl python3 make g++ sqlite-dev

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy package files
COPY --from=builder /app/package*.json ./

# Copy node_modules (will rebuild native modules)
COPY --from=builder /app/node_modules ./node_modules

# Rebuild native modules for this platform
RUN npm rebuild better-sqlite3

# Copy built application from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/tsconfig.json ./

# Create data directory for SQLite database
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Set port
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/status || exit 1

# Start the application
CMD ["npm", "start"]
