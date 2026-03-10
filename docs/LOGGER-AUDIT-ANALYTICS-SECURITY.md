# Logger, Audit, Analytics & Security

## Logger

- **Location**: `server/src/infrastructure/logger.ts`
- **Library**: Pino (JSON in prod, pretty in dev)
- **Env**: `LOG_LEVEL` (default: `info` in prod, `debug` in dev)
- **Usage**: `import { logger } from '../infrastructure/logger'`

## Audit Log

- **Model**: `AuditLog` (Prisma)
- **Repository**: `server/src/repositories/auditRepository.ts`
- **Middleware**: `auditMiddleware` – logs all `/api/*` requests on `res.finish`
- **Fields**: action, userId, userEmail, resourceId, ip, method, path, statusCode, durationMs, metadata

## Analytics

- **Model**: `AnalyticsEvent` (Prisma)
- **Repository**: `server/src/repositories/analyticsRepository.ts`
- **Event types**: `translation`, `transcription`, `tts`, `favorite_add`, `favorite_remove`
- **Tracked**: Translation, transcription, TTS, favorites (add/remove)

## Validation (Zod)

- **Location**: `server/src/middleware/validate.ts`
- **Schemas**: translate, transcribe, speak, history, addFavorite, removeFavoriteParams, saveSettings
- **Input sanitization**: All strings trimmed, control chars stripped, max lengths enforced
- **requireUserEmail**: Middleware for GET /favorites and GET /settings – validates userEmail from query or x-user-email header
- **Usage**: `validate(schemas.translate, 'body')` – validates and sanitizes, returns 400 on failure

## File Validation

- **Location**: `server/src/middleware/fileValidation.ts`
- **validateAudioUpload**: Checks file exists, size ≤ 25MB, mimetype starts with `audio/`

## Security

- **Helmet**: Security headers (CSP in prod)
- **Rate limit**: 100 req/15min (prod), 1000 (dev) on `/api`
- **Error handler**: Central handler, 500 errors logged, no stack traces to client

## Migration

Run `npx prisma migrate deploy` (or `prisma migrate dev` locally) to apply the AuditLog and AnalyticsEvent tables.
