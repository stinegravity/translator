import express, { Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI, { toFile } from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type Direction = 'tw-en' | 'en-tw';

const app = express();
const isProd = process.env.NODE_ENV === 'production';
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

app.use(cors());
app.use(express.json());

if (isProd) {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
}

async function translateText(text: string, target: string, source?: string): Promise<string> {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_TRANSLATE_API_KEY is not set');
  }
  const params = new URLSearchParams({ key: apiKey });
  const body: { q: string[]; target: string; source?: string } = {
    q: [text],
    target,
  };
  if (source) body.source = source;
  const res = await fetch(
    `https://translation.googleapis.com/language/translate/v2?${params}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || 'Translation failed');
  }
  const data = (await res.json()) as { data: { translations: { translatedText: string }[] } };
  return data.data.translations[0].translatedText;
}

app.post('/api/translate', async (req: Request, res: Response) => {
  try {
    const { text, direction } = req.body as { text?: string; direction?: Direction };
    if (!text?.trim()) {
      return res.status(400).json({ error: 'Text is required' });
    }
    const [source, target] = direction === 'tw-en' ? (['tw', 'en'] as const) : (['en', 'tw'] as const);
    const translated = await translateText(text, target, source);
    res.json({ translated, source, target });
  } catch (err) {
    console.error('Translate error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Translation failed',
    });
  }
});

app.post('/api/transcribe', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required' });
    }
    const direction = (req.body.direction as Direction) || 'tw-en';
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OPENAI_API_KEY is not set' });
    }
    const openai = new OpenAI({ apiKey });
    const file = await toFile(
      req.file.buffer,
      req.file.originalname || 'audio.webm',
      { type: req.file.mimetype }
    );
    const transcript = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
    });
    const transcribedText = transcript.text?.trim() ?? '';
    if (!transcribedText) {
      const [source, target] = direction.split('-');
      return res.json({ transcribed: '', translated: '', source, target });
    }
    const [source, target] = direction === 'tw-en' ? (['tw', 'en'] as const) : (['en', 'tw'] as const);
    const translated = await translateText(transcribedText, target, source);
    res.json({ transcribed: transcribedText, translated, source, target });
  } catch (err) {
    console.error('Transcribe error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Transcription failed',
    });
  }
});

app.get('/api/health', (_req: Request, res: Response) => {
  const hasGoogle = !!process.env.GOOGLE_TRANSLATE_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  res.json({
    ok: true,
    config: {
      translation: hasGoogle ? 'ready' : 'missing GOOGLE_TRANSLATE_API_KEY',
      transcription: hasOpenAI ? 'ready' : 'missing OPENAI_API_KEY',
    },
  });
});

if (isProd) {
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (isProd) console.log('Serving static frontend from /dist');
});
