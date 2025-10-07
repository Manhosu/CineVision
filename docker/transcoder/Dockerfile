# Multi-stage build for FFmpeg transcoder service
FROM node:18-alpine AS base

# Install FFmpeg and dependencies
RUN apk add --no-cache \
    ffmpeg \
    ffmpeg-dev \
    python3 \
    make \
    g++ \
    pkgconfig \
    && rm -rf /var/cache/apk/*

# Verify FFmpeg installation
RUN ffmpeg -version && ffprobe -version

FROM base AS dependencies

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

FROM base AS production

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S transcoder && \
    adduser -S transcoder -u 1001 -G transcoder

# Copy dependencies from previous stage
COPY --from=dependencies /app/node_modules ./node_modules

# Copy application code
COPY src/ ./src/
COPY package*.json ./
COPY tsconfig.json ./

# Create directories for transcoding work
RUN mkdir -p /tmp/transcoding /app/logs && \
    chown -R transcoder:transcoder /tmp/transcoding /app/logs /app

# Switch to non-root user
USER transcoder

# Environment variables
ENV NODE_ENV=production
ENV TRANSCODING_WORK_DIR=/tmp/transcoding
ENV LOG_LEVEL=info
ENV WORKER_CONCURRENCY=2
ENV FFMPEG_THREADS=0
ENV SEGMENT_DURATION=6

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node src/healthcheck.js || exit 1

# Expose port for metrics/status
EXPOSE 3001

# Start the transcoding worker
CMD ["node", "src/worker.js"]