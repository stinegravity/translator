# Technical Debt & Performance

Analysis of cost impact, performance bottlenecks, and tech debt in the KyereAse codebase.

## Money Burning Right Now

| Issue | Cost Impact | Status |
|-------|-------------|--------|
| GPT-4o used for FREE tier Twi translations | ~$2-4K/mo at scale | **Fixed** — FREE gets Google Translate; PRO+ gets GPT-4o |
| Diarization makes 100+ sequential API calls | $10-30 per request | **Fixed** — `translateBatch` batches all segments into one GPT or Google call |
| TTS not cached | 5-10% waste | **Fixed** — Redis cache by text+voice hash, 30-day TTL |
| 24h cache TTL on translations | Re-paying for same text daily | **Fixed** — extended to 30 days |

## Performance Killers

1. ~~**Zero pagination** on `/api/history`, `/api/conversations`, `/api/favorites`~~ — **Fixed** for conversations and favorites (limit/offset, max 200). History already had limit 10-50.

2. ~~**N+1 / unbounded histories** in `getConversation`~~ — **Fixed** — histories paginated (limit 100 default, max 200, offset for pagination).

3. **No background job queue** — transcription, diarization, YouTube download, and exports all block the request thread. Open.

4. ~~**No rate limit** on `/api/translate`~~ — **Fixed** — `strictRateLimiter` (30/min) applied.

## Tech Debt

- ~~`as any` casts~~ — **Fixed** in translationRepository, transcriptionService
- Duplicated logic across `transcribeBasic()` and `transcribeWithDiarization()`
- No tests (test folder exists but empty)
- Local filesystem for uploads (no cleanup, no multi-server support)
- ~~No prompt injection defense~~ — **Fixed** — `sanitizeForPrompt()` strips control chars, trims, truncates to 50k before translation
- ~~Hardcoded model names~~ — **Fixed** — `server/src/config/models.ts` + env vars (`OPENAI_TRANSLATION_MODEL`, etc.)
