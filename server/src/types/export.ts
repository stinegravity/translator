export interface ExportSegment {
  start: number;
  end: number;
  text: string;
  translatedText?: string | null;
}

export interface HistoryItemForExport {
  id: string;
  source: string;
  target: string;
  input: string;
  output: string;
  mode: string;
  createdAt: Date;
  transcribed?: string | null;
  segments: ExportSegment[];
}

export interface ConversationForExport {
  id: string;
  title: string;
  histories: HistoryItemForExport[];
}
