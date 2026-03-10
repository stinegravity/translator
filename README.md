# Twi ↔ English Translator

A simple web app to translate between Twi and English. Supports **text** and **audio** input.

## Features

- **Text translation**: Type or paste text, translate Twi ↔ English
- **Audio transcription**: Record or upload audio, transcribe with Whisper, then translate
- **Direction toggle**: Twi → English or English → Twi
- **Recording indicator**: Visual feedback while recording
- **Copy to clipboard**: Copy transcribed or translated text
- **Single-command production**: Build + serve with `npm start`

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure API keys** – copy `.env.example` to `.env` and add your keys:
   ```bash
   cp .env.example .env
   ```
   - `GOOGLE_TRANSLATE_API_KEY` – [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (enable Cloud Translation API)
   - `OPENAI_API_KEY` – [OpenAI](https://platform.openai.com/api-keys) (for Whisper transcription)
   - `DATABASE_URL` – direct PostgreSQL connection string, for example `postgresql://postgres:postgres@localhost:5432/translator_dev?sslmode=disable`

3. **Prepare the database**
   ```bash
   npm run db:migrate
   ```
   This project uses direct PostgreSQL on `localhost:5432`, not `prisma dev`.

4. **Run the app**

   **Development** (frontend + backend in separate terminals):
   ```bash
   # Terminal 1 – frontend
   npm run dev

   # Terminal 2 – backend
   npm run server
   ```
   Open http://localhost:5173

   **Production** (single command, serves built app):
   ```bash
   npm start
   ```
   Open http://localhost:3001

## Scripts

| Command        | Description                          |
|----------------|--------------------------------------|
| `npm run dev`  | Start Vite dev server (frontend)     |
| `npm run server`| Start Express API server             |
| `npm run build`| Build frontend for production        |
| `npm start`    | Build + serve (production mode)      |
| `npm run db:migrate` | Apply Prisma migrations to your configured PostgreSQL database |
| `npm run db:status` | Check Prisma migration status     |

## Design System

Dark theme only. Colors: dark (#0a0a0a), white (#ffffff), grey (#333–#888), blue (#3b82f6) for highlight. No emojis. No focus outlines. See `.cursor/rules/design-system.mdc`.

## Tech Stack

- **Frontend**: React, TypeScript, Vite
- **Backend**: Express, TypeScript, tsx
- **Translation**: Google Cloud Translation API
- **Transcription**: OpenAI Whisper API
