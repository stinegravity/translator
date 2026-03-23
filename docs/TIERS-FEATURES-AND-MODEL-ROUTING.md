# Tiers, Features & Model Routing

This document describes KyereAse's tier system, feature gating, usage limits, and how translation requests are routed between OpenAI and Google Translate.

---

## 1. Tier Overview

| Tier | Chars/day | Transcribe/day | TTS/day | History | Folders |
|------|-----------|---------------|---------|---------|---------|
| **FREE** | 500 | 3 | 3 | 50 | 1 |
| **PRO** | 10,000 | 50 | 30 | ∞ | ∞ |
| **TEAM** | 50,000 | 200 | 100 | ∞ | ∞ |
| **ENTERPRISE** | ∞ | ∞ | ∞ | ∞ | ∞ |

---

## 2. Feature Gating by Tier

| Feature | FREE | PRO | TEAM | ENTERPRISE |
|---------|------|-----|------|------------|
| **Audio trim (edit)** | ❌ | ✅ | ✅ | ✅ |
| **YouTube link** | ❌ | ✅ | ✅ | ✅ |
| **Conversations** | ❌ | ✅ | ✅ | ✅ |
| **Folders** | 1 | ∞ | ∞ | ∞ |
| **Export** (SRT/VTT/TXT) | ❌ | ❌ | ✅ | ✅ |
| **API access** | ❌ | ❌ | ✅ | ✅ |
| **Review queue** | ❌ | ❌ | ❌ | ❌ |
| **Portal access** | ❌ | ❌ | ❌ | ❌ |
| **Rate limit (req/min)** | 60 | 120 | 300 | 1000 |

### Audit logs

Audit logs are **not** tier-gated. They use `requirePortalAccess`, which is a separate admin/operations flag (`portalAccess: true`). Only internal ops accounts can view audit logs.

### Internal ops access

Internal operations access is **not** part of any commercial tier.

- `tier` controls product entitlements in the main app
- `internalRole` controls internal staff classification: `CUSTOMER`, `OPS`, or `ADMIN`
- `portalAccess` is kept in sync from `internalRole` for compatibility, but `internalRole` is now the primary admin model
- an internal admin account may still have a normal tier like `TEAM`, but portal access comes from internal role, not from the tier itself

---

## 3. Implementation Reference

### Config

- **Tier limits:** `server/src/config/tiers.ts`
- **Feature flags (frontend):** `src/lib/tierFeatures.ts`
- **Auth middleware:** `server/src/middleware/auth.ts`
  - `requireTier(minTier)` – enforces minimum tier
  - `requirePortalAccess` – enforces admin/portal access
  - `requireInternalAdmin` – enforces admin-only internal management actions

### Route gating

| Route | Middleware |
|-------|------------|
| `/conversations/*` | `requireTier('PRO')` |
| `/history/:id/export` | `requireTier('TEAM')` |
| `/conversations/:id/export` | `requireTier('TEAM')` |
| `/transcribe-url` | `requireTier('PRO')` |
| `/exports`, `/exports/:id/download` | `requireTier('TEAM')` |
| `/audit-logs`, `/review-queue`, `/feedback/export`, `/feedback-stats`, `/app-feedback` (list), `/internal-users` | `requirePortalAccess` |
| `/internal-users/:id` | `requireInternalAdmin` |
| `/feedback` | `requireReviewerAccess` |
| `/reviewer-access/request` | signed-in user |
| `/reviewer-access/requests` | `requirePortalAccess` |
| `/reviewer-access/requests/:id` | `requireInternalAdmin` |

### Frontend feature flags

`getTierFeatures(tier)` returns:

- `conversationsEnabled`
- `audioTrimming`
- `apiAccess`
- `exportEnabled`

These control customer-facing UI visibility in the main app (e.g. trim slider, YouTube input, export buttons).

---

## 4. Model Routing (OpenAI vs Google Translate)

KyereAse uses both **OpenAI (GPT-4o)** and **Google Cloud Translation** for text translation. The routing logic chooses the best model for each request.

### Current logic

| Condition | Model |
|-----------|-------|
| Tier PRO+ AND OpenAI key present AND (context ≠ Casual OR Twi involved) | **OpenAI (GPT-4o)** |
| FREE tier OR otherwise | **Google Translate** |

FREE tier users always receive Google Translate to control cost. PRO, TEAM, and ENTERPRISE users receive GPT-4o for Twi and non-Casual contexts.

### When each model is best

| Job type | Best model | Reason |
|----------|------------|--------|
| **Twi ↔ English** | OpenAI | Dialect-aware, Asante/Akuapem support |
| **Context ≠ Casual** (formal, medical, etc.) | OpenAI | Tone and context control |
| **Diarization** (speaker IDs) | OpenAI | Whisper only |
| **Simple en↔en (Casual)** | Google | Lower cost, fast |
| **Long text** | Google | Cost-effective at scale |
| **Transcription** | OpenAI | Whisper only |
| **TTS** | OpenAI | OpenAI only |

### Implementation

- **Model config:** Managed in admin portal (Models tab) or via env vars. DB values take precedence; env vars and defaults fall back when DB is empty. Keys: `OPENAI_TRANSLATION_MODEL`, `OPENAI_TRANSCRIPTION_MODEL`, `OPENAI_TRANSCRIPTION_DIARIZE_MODEL`, `OPENAI_TTS_MODEL`
- **Translation routing:** `server/src/services/translationService.ts` – `translateText()` / `translateWithAI()` / `translateWithGoogle()`
- **Transcription:** Always OpenAI (`server/src/services/transcriptionService.ts`)
- **TTS:** Always OpenAI (`server/src/services/speakerService.ts`)

---

## 5. Usage vs ChatGPT

| Aspect | KyereAse | ChatGPT |
|--------|----------|---------|
| **Unit** | Characters + counts (transcribe/TTS) | Tokens (input + output) |
| **Reset** | Daily | Monthly |
| **Tracking** | Per action (translate, transcribe, TTS) | Single token bucket |
| **Enforcement** | `usageService.checkLimit()` before action | Token budget per plan |

### Why characters + counts

- Aligns with how Google/OpenAI bill (chars, API calls)
- Easy for users to understand (“500 characters/day”)
- Per-action limits fit translation workflows

---

## 6. API Keys & Costs

### Google Cloud Translation (Basic v2)

- **Pricing:** $20 per million characters
- **Free tier:** 500,000 characters/month
- **Auth:** API key in `GOOGLE_TRANSLATE_API_KEY`
- **Setup:** [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Enable Cloud Translation API → Create API key

### OpenAI

- **Translation:** GPT-4o (chat completions)
- **Transcription:** Whisper
- **TTS:** tts-1
- **Auth:** API key in `OPENAI_API_KEY`

---

## 7. Suggested Improvements

### Feature gating

- **YouTube link:** already gated at `PRO+`
- **Export:** Consider moving to PRO if you want a stronger PRO value proposition
- **Portal/admin surfaces:** Keep them on internal role / `portalAccess`, not on customer tier

### FREE tier auth model

The current app still requires authentication for FREE users.

That is intentional for now, because the current product model depends on authenticated identity for:

- usage tracking
- history
- favorites
- folders
- settings
- exports
- conversations

Removing auth for FREE would be a separate product and architecture change, not a small cleanup.

That change would require:

- public translate/transcribe routes
- anonymous rate limiting by IP, device, or session
- clear guest vs signed-in persistence rules
- an optional upgrade path from guest usage to a full account

So FREE is still auth-gated in the current implementation. If guest access is desired, it should be treated as a dedicated roadmap item.

### Model routing

- Centralize routing in `server/src/config/modelRouting.ts`
- Add optional user preference (e.g. “Prefer AI” / “Prefer Google”) for PRO+ users
- Consider length-based routing (e.g. >500 chars → Google for cost)

---

## 8. Related Files

| Purpose | Path |
|---------|------|
| Tier limits | `server/src/config/tiers.ts` |
| Usage service | `server/src/services/usageService.ts` |
| Translation service | `server/src/services/translationService.ts` |
| Transcription service | `server/src/services/transcriptionService.ts` |
| Auth middleware | `server/src/middleware/auth.ts` |
| API routes | `server/src/routes/api.ts` |
| Frontend tier features | `src/lib/tierFeatures.ts` |
| Usage dashboard | `src/components/UsageDashboard.tsx` |

---

## 9. Feedback Architecture Plan

KyereAse should treat feedback as two separate systems:

### A. App feedback

This is the normal product feedback loop for the main app.

Use it for:

- app performance
- usability
- bugs
- feature suggestions
- overall satisfaction after usage

This should remain part of the normal signed-in user experience and should stay connected to the existing app feedback system.

Relevant current surface:

- `AppFeedback`
- `/api/app-feedback`
- app feedback panel in settings

### B. Reviewer feedback

This is the qualified translation-review workflow.

Use it for:

- rating translation quality
- submitting corrections
- improving training and review data
- feeding human review queues

This should **not** be open to all users by default.

It should be limited to approved reviewers only.

Current implementation status:

- implemented

---

## 10. Reviewer Access Model

Reviewer access should not be treated as a normal customer feature toggle.

Recommended model:

- FREE users: no reviewer prompt
- PRO users: can see a reviewer application banner
- TEAM users: can see a reviewer application banner
- ENTERPRISE users: can see a reviewer application banner
- approved reviewers: can submit translation-review feedback

Current implementation status:

- implemented

Internal ops users can approve or reject reviewer applications through the portal.

Important distinction:

- customer tier controls product access
- reviewer approval controls translation-review privileges
- internal role controls portal/admin access

These are three separate axes and should remain separate.

---

## 11. Reviewer Application Workflow

Desired flow:

1. User signs in normally.
2. PRO+ or TEAM users see a banner inviting them to apply as reviewers.
3. User fills a reviewer application form with qualifications and credentials.
4. Application is stored with `PENDING` status.
5. Internal admins review the application in the portal.
6. Admin approves or rejects the request.
7. If approved, the user gains reviewer access and can submit translation-review feedback.
8. If rejected, the normal app still works, but reviewer tools stay disabled.

Current implementation status:

- implemented

Suggested form fields:

- organization
- role title
- languages/dialects covered
- credentials
- review use case
- portfolio or reference URL
- optional notes

---

## 12. UI Rules

### Main app

- normal app feedback remains available as part of the standard signed-in app flow
- translation-review feedback widget should only render for approved reviewers
- non-approved users should not see the review widget directly
- PRO+ and TEAM users should see a reviewer-application banner instead
- FREE users should not be pushed into reviewer workflow by default

Current implementation status:

- implemented

### Portal

- internal ops can see reviewer requests
- internal admins can approve or reject them
- reviewer application decisions should be auditable

Current implementation status:

- implemented

---

## 13. Data Model Direction

Recommended fields and entities:

- user-level reviewer access state
- reviewer application records
- approval status lifecycle:
  - `NONE`
  - `PENDING`
  - `APPROVED`
  - `REJECTED`

Recommended separation:

- `AppFeedback` for product/app feedback
- `TranslationFeedback` for approved reviewer corrections/ratings
- reviewer application entity for access control workflow

Current implementation status:

- implemented

---

## 14. Implementation Order

To avoid dangling half-features, implement in this order:

1. Finalize the data model for reviewer access and reviewer applications
2. Add backend middleware that restricts translation-review feedback to approved reviewers
3. Add reviewer application submission endpoint
4. Add portal review/approval endpoints
5. Add main-app reviewer application banner for PRO+ and TEAM users
6. Hide the translation-review widget for non-approved users
7. Keep app feedback connected to the standard app feedback path
8. Add audit logging for reviewer application submit/approve/reject actions
9. Add docs and test coverage

Status update:

- steps 1 through 8 are now implemented
- test coverage is still pending

---

## 15. Current Decision

The intended product decision is:

- normal app feedback stays with the normal app feedback system
- translation reviewer feedback is reserved for approved reviewers
- reviewer application should be suggested as a banner to PRO+ and TEAM users
- implementation should follow the plan above rather than mixing the two feedback systems together

Current implemented outcome:

- app feedback remains part of the standard app feedback path
- translation reviewer feedback is approval-gated
- PRO, TEAM, and ENTERPRISE users see a reviewer application banner when they are not approved
- FREE users do not see the reviewer application banner
- internal admins can approve or reject reviewer requests from the portal

---

## 16. What Was Implemented

The following feedback/access work is now live:

- reviewer access states on `User`
- `ReviewerApplication` persistence
- reviewer request submission endpoint
- reviewer request review endpoints
- approved-reviewer-only feedback submission guard
- portal reviewer request approval flow
- main-app reviewer application banner for eligible paid users
- reviewer feedback widget hidden for non-approved users
- app feedback remains separate from reviewer feedback
- audit action mapping for reviewer request submit/list/review

Key files:

- `prisma/schema.prisma`
- `server/src/controllers/reviewerAccessController.ts`
- `server/src/middleware/auth.ts`
- `server/src/routes/api.ts`
- `src/components/ReviewerAccessBanner.tsx`
- `src/components/ResultDisplay.tsx`
- `src/components/AdminDashboard.tsx`

---

## 17. Next Steps

The next clean milestone is hardening and polish, not more product branching.

Recommended next steps:

1. Add automated tests for:
   - reviewer request submission
   - approval and rejection
   - reviewer-only feedback submission
   - non-reviewer rejection path
2. Add portal-side decision notes UI so admins can record why a request was approved or rejected
3. Surface reviewer status more clearly in the main app account/settings area
4. Add notifications or email on reviewer approval/rejection
5. If desired later, add guest/free access as a separate dedicated project
