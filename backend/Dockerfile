# LUNA-01 Core Simulation & Multiverse Engine
# Dockerfile for backend service & test runner (build context: backend/)

FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency specifications
COPY package*.json ./

# Install development & runtime dependencies
RUN npm ci

# Copy source code, tests, and configuration
COPY src/ ./src/
COPY tests/ ./tests/
COPY tsconfig*.json ./

# Compile TypeScript domain engine, API server, and test suites to CommonJS
RUN npx tsc --ignoreConfig --types node \
    --target ES2022 \
    --module CommonJS \
    --moduleResolution bundler \
    --outDir dist \
    src/server.ts src/domain/index.ts tests/domain/*.test.ts \
    && echo '{"type": "commonjs"}' > dist/package.json

# Execute all 53 automated tests during build to ensure engine integrity
RUN node --test dist/tests/domain/*.test.js

# Production runtime stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy compiled build artifacts from builder
COPY --from=builder /app/dist ./dist

# Non-root user for security
USER node

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('node:http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "dist/src/server.js"]
