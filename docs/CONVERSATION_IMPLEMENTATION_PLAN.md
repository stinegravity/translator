# Conversation Implementation Plan

## Goal

Introduce real conversation threads so multiple translations/transcriptions can belong to the same ongoing chat while still being grouped under folders.

Recommended hierarchy:

- `Folder`
- `Conversation`
- `TranslationHistory`

## Current State

- `Folder` exists and currently groups history items directly.
- `TranslationHistory` stores one translation/transcription per row.
- There is no `conversationId` or ordered multi-turn thread model.
- Favorites, settings, folders, and identity already exist.

## Target State

### Data model

- Add `Conversation`
  - `id`
  - `title`
  - `userId`
  - `folderId`
  - `createdAt`
  - `updatedAt`
  - `lastActivityAt`
- Add `conversationId` to `TranslationHistory`

### API

- `GET /api/conversations`
- `POST /api/conversations`
- `GET /api/conversations/:id`
- `GET /api/conversations/:id/history`
- Update translate/transcribe flows to accept optional `conversationId`

### UX

- Folder contains many conversations
- Conversation contains many translation turns
- User can continue translating inside the same conversation
- Recent history remains available as a global feed

## Implementation Order

1. Add Prisma `Conversation` model and `conversationId` on `TranslationHistory`
2. Add migration
3. Add repository methods for conversation CRUD and history listing by conversation
4. Add backend routes/controllers
5. Accept `conversationId` on translate/transcribe
6. Return `conversationId` in responses
7. Add frontend conversation list and active thread view
8. Append new turns to the active conversation
9. Add tests

## Phase 1 Scope

Phase 1 is backend-only foundation:

- Prisma schema
- migration
- repository support
- controller/routes
- request validation
- translate/transcribe request plumbing for `conversationId`

## Notes

- Backward compatibility: old history rows can keep `conversationId = null`
- Folders remain valid and become containers for conversations instead of direct chat substitutes
- Favorites continue to point to `TranslationHistory`
