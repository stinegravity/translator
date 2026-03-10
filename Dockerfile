FROM node:22-alpine AS base

# Install deps
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml* package-lock.json* ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# Build frontend
FROM base AS frontend
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
RUN corepack enable pnpm && pnpm run build

# Prisma generate
FROM base AS prisma
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx prisma generate

# Production image
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable pnpm && addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nodejs

COPY --from=deps /app/node_modules ./node_modules
COPY --from=prisma /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=frontend /app/dist ./dist
COPY package.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY server ./server
COPY tsconfig.json ./

USER nodejs
EXPOSE 3001

# Migrations should be run separately (e.g. in CI or init container)
# prisma migrate deploy
CMD ["pnpm", "run", "server"]
