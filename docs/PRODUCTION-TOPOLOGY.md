# KyereAse Production Topology

## Architecture Overview

```
                          ┌─────────────┐
                          │  Cloudflare  │
                          │   (future)   │
                          └──────┬───────┘
                                 │
                          ┌──────▼───────┐
                          │    Nginx     │
                          │  Reverse     │
                          │  Proxy + SSL │
                          └──────┬───────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                   │
     ┌────────▼──────┐  ┌───────▼───────┐  ┌───────▼───────┐
     │  Static Files │  │  Express API  │  │  Better Auth  │
     │  (Vite dist)  │  │  :3001        │  │  /api/auth/*  │
     └───────────────┘  └───────┬───────┘  └───────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                  │
     ┌────────▼──────┐ ┌───────▼───────┐ ┌───────▼───────┐
     │  PostgreSQL   │ │    Redis      │ │  OpenAI API   │
     │  (Prisma ORM) │ │  Cache + Jobs │ │  GPT / Whisper│
     └───────────────┘ └───────┬───────┘ └───────────────┘
                               │
                      ┌────────▼────────┐
                      │  Bull Queue     │
                      │  Transcription  │
                      │  Worker         │
                      └─────────────────┘
```

## Components

### Application Server
- **Runtime:** Node.js 20+ with tsx
- **Framework:** Express 5
- **Port:** 3001 (configurable via PORT env)
- **Process manager:** PM2 (ecosystem.config.cjs)

### Database
- **Engine:** PostgreSQL 15+
- **ORM:** Prisma 7 with PrismaPg driver adapter
- **Pool size:** Configurable via DB_POOL_SIZE (default: 10)
- **Backups:** scripts/backup-db.sh (pg_dump, gzip, rotation)

### Cache & Queue
- **Engine:** Redis 7+
- **Usage:** Session rate limiting, usage counters, cache, Bull job queue
- **Key namespaces:**
  - `rl:*` — Rate limiting
  - `usage:*` — Daily usage counters
  - `cache:*` — Translation cache
  - `transcription:*` — Job results + ownership
  - `bull:transcription:*` — Bull queue internals

### Reverse Proxy
- **Engine:** Nginx
- **SSL:** Let's Encrypt (certbot)
- **Config:** nginx/test.graviticreatives.com.conf
- **Features:** Proxy pass, WebSocket upgrade, static file serving

### External Services
- **OpenAI API:** Translation (GPT-4), Transcription (Whisper), TTS
- **Google Translate:** Fallback for FREE tier translations
- **SMTP:** Email notifications (Nodemailer)
- **Sentry:** Error monitoring (optional, via SENTRY_DSN)

## Deployment

### Current Setup
- Single DigitalOcean droplet
- Deploy via scripts/deploy-kyerease.sh (SSH + rsync)
- PM2 process management

### Scaling Path
1. **Vertical:** Increase droplet size
2. **Horizontal (app):** Multiple app instances behind Nginx load balancer, shared Redis + PostgreSQL
3. **Queue workers:** Separate transcription worker process(es)
4. **CDN:** Cloudflare for static assets (I8)
5. **Managed DB:** Move to managed PostgreSQL (DigitalOcean, Supabase, Neon)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| DATABASE_URL | Yes | PostgreSQL connection string |
| REDIS_URL | Yes | Redis connection string |
| OPENAI_API_KEY | Yes | OpenAI API key |
| BETTER_AUTH_SECRET | Yes | Session signing secret |
| ALLOWED_ORIGINS | Prod | Comma-separated CORS origins |
| SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS | Prod | Email delivery |
| SENTRY_DSN | No | Sentry error monitoring |
| DB_POOL_SIZE | No | PostgreSQL pool size (default: 10) |
| PORT | No | Server port (default: 3001) |
| NODE_ENV | No | development/staging/production |
| LOG_LEVEL | No | Pino log level |
