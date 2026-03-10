# KyereAse: Backend vs Frontend & Engineering Gaps

## Backend (What Exists)

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/translate` | POST | Text translation (Twi ↔ English) |
| `/api/transcribe` | POST | Audio → transcribe → translate |
| `/api/health` | GET | Health check + config status |

### Backend Services

| Service | Purpose |
|---------|---------|
| **TranslationService** | Google Translate API, caching (Redis), history persistence |
| **TranscriptionService** | OpenAI Whisper for speech-to-text, then translation |
| **CacheService** | Redis-backed translation cache (1hr TTL) |
| **TranslationRepository** | Prisma – saves to `TranslationHistory` table |
| **StorageService** | File uploads to `uploads/` (not currently used by API) |

### Data Model (Prisma)

```
TranslationHistory
  - id, source, target, input, output, mode, createdAt
```

### Transcription Modes

| Mode | Model | Output |
|------|-------|--------|
| Basic | `whisper-1` | Plain text |
| Diarized | `gpt-4o-transcribe-diarize` | Segments with speaker (A,B,C...), start/end timestamps, per-segment translation |

Pass `diarize=true` in the transcribe request body to enable speaker detection. Speakers are labeled Voice 1, Voice 2, etc. in the UI.

### Env Dependencies

- `GOOGLE_TRANSLATE_API_KEY` – translation
- `OPENAI_API_KEY` – transcription (Whisper + gpt-4o-transcribe-diarize)
- `REDIS_URL` – cache
- `DATABASE_URL` – Prisma/Postgres

---

## Frontend (What Exists)

### Current Implementation

- **Single `App.tsx`** – all logic inline (no hooks, no API layer)
- **Raw `fetch()`** – direct calls to `/api/translate` and `/api/transcribe`
- **State**: `useState` for input, result, loading, error, mode, direction
- **Refs**: `mediaRecorderRef`, `chunksRef` for recording

### API Usage

| Frontend Action | Backend Call |
|-----------------|--------------|
| Translate text | `POST /api/translate` `{ text, direction }` |
| Record/upload audio | `POST /api/transcribe` (FormData: audio, direction) |

---

## Gaps: What Backend Has That Frontend Doesn’t Use

| Backend Feature | Frontend Status |
|-----------------|-----------------|
| **Translation history** | ❌ No API exposed, no UI |
| **Health/config status** | ❌ Not used |
| **StorageService** | ❌ Not used by API |

---

## Frontend Engineering Needs

### 1. API Layer & Hooks

**Current**: Inline `fetch` in `App.tsx`.

**Recommended**:

- `src/api/client.ts` – base fetch wrapper, error handling
- `src/hooks/useTranslate.ts` – `{ translate, loading, error, result }`
- `src/hooks/useTranscribe.ts` – `{ transcribe, loading, error, result }`
- `src/hooks/useHealth.ts` – optional, for status/feature flags

### 2. History Feature (Backend Ready, Frontend Missing)

Backend already saves history via `translationRepository.saveHistory()`. No read endpoint exists.

**Backend work**:

- `GET /api/history` – list recent translations (uses `getRecentHistory()`)

**Frontend work**:

- History panel/sidebar
- `useHistory` hook calling `GET /api/history`
- Optional: “Copy from history”, “Translate again”

### 3. Error Handling & UX

- Retry logic for transient failures
- Clearer error messages (e.g. “Check API keys” vs generic “Translation failed”)
- Optional: `useHealth` to show “Translation unavailable” before user tries

### 4. State Management

- Consider `useReducer` or a small store if state grows (history, favorites, settings)
- Or keep `useState` and add hooks; refactor only when needed

### 5. Types

- Shared types for `TranslationResult`, `Direction`, etc. (e.g. `src/types.ts`)
- Or import from a shared package if backend/frontend split further

---

## Quick Wins

1. **Add `GET /api/history`** – ✅ Done.
2. **Extract `useTranslate` and `useTranscribe`** – ✅ Done.
3. **Use `/api/health`** – Optional; not yet used in UI.
4. **Light flare** – ✅ Added to top of page.
5. **Speaker diarization + timestamps** – ✅ Done (gpt-4o-transcribe-diarize).

---

## Summary

| Area | Status |
|------|--------|
| Core translate/transcribe | ✅ Backend + frontend wired |
| Caching | ✅ Backend only |
| History persistence | ✅ Backend saves, ✅ GET /api/history, ✅ History panel UI |
| API client/hooks | ✅ useTranslate, useTranscribe, useHistory |
| Health/status | ✅ Backend, optional frontend |
| Diarization (Voice 1, 2...) | ✅ gpt-4o-transcribe-diarize, segments with timestamps |
