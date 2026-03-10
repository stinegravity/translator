export type Direction = 'tw-en' | 'en-tw';
export type InputMode = 'text' | 'audio';

export interface TranscriptionSegment {
  id: string;
  speaker: string;
  start: number;
  end: number;
  text: string;
  translatedText?: string;
}

export interface TranslationResult {
  transcribed?: string;
  translated: string;
  source: string;
  target: string;
  segments?: TranscriptionSegment[];
}
