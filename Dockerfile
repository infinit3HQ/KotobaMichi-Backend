# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install pnpm
RUN npm install -g pnpm

# Install build dependencies for native modules (e.g., bcrypt)
RUN apk add --no-cache python3 make g++ libc6-compat

# Install dependencies
RUN pnpm install

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN pnpm run build

# Prune dev dependencies to keep only production deps
RUN pnpm prune --prod

# Production stage
FROM node:18-alpine AS production

# Set working directory
WORKDIR /app

# Copy production node_modules from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/prisma ./prisma

# Install runtime utilities
RUN apk add --no-cache curl

# Create a non-root user
RUN addgroup -g 1001 -S nodejs \
  && adduser -S nestjs -u 1001

# Change ownership of the app directory
USER nestjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "dist/main"]
