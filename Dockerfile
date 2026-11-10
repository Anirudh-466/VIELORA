# =========================================================================
# VEILORA — Multi-Stage Production Dockerfile
# Optimized for minimal image footprint, high security, and fast cold-starts
# =========================================================================

# Stage 1: Build the frontend bundle
FROM node:20-alpine AS client-builder
WORKDIR /app/client

# Install frontend dependencies
COPY client/package*.json ./
RUN npm ci

# Copy client source and build
COPY client/ ./
RUN npm run build

# Stage 2: Production runtime image
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

# Install server dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy backend server files
COPY server.js ./

# Copy built frontend assets from builder stage
COPY --from=client-builder /app/client/dist ./client/dist

# Security hardening: Run as non-privileged node user
USER node

EXPOSE 3001

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

CMD ["node", "server.js"]
