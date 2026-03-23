export type Direction = string; // e.g., 'tw-en', 'en-tw', 'fr-en'
export type InputMode = 'text' | 'audio';

export interface UserProfile {
  email: string;
  name?: string;
}

export interface TranslationResult {
  id?: string;
  inputText?: string;
  transcribed?: string;
  translated: string;
  source: string;
  target: string;
  segments?: TranscriptionSegment[];
}

export interface TranscriptionSegment {
  id: string;
  speaker: string;
  start: number;
  end: number;
  text: string;
  translatedText?: string;
}

export interface HistoryItem {
  id: string;
  source: string;
  target: string;
  input: string;
  output: string;
  mode: InputMode;
  createdAt: string;
  archivedAt?: string | null;
  transcribed?: string | null;
  audioAsset?: {
    id: string;
    originalName: string;
    mimeType: string;
    sizeBytes?: number | null;
  } | null;
  favorites?: Array<{
    id: string;
    userId: string;
  }>;
  folder?: {
    id: string;
    name: string;
  };
  conversation?: ConversationItem | null;
  segments?: TranscriptionSegment[];
}

export interface FavoriteItem {
  id: string;
  historyId: string;
  createdAt: string;
  history: HistoryItem;
}

export interface FolderItem {
  id: string;
  name: string;
}

export interface ConversationItem {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  folder?: {
    id: string;
    name: string;
  } | null;
  _count?: {
    histories: number;
  };
}

export interface ExportItem {
  id: string;
  format: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  completedAt?: string | null;
  history?: {
    id: string;
    mode: string;
    createdAt: string;
  } | null;
  conversation?: {
    id: string;
    title: string;
    createdAt: string;
  } | null;
}

export interface AppFeedbackItem {
  id: string;
  overallRating: number;
  performanceRating: number;
  reliabilityRating: number;
  easeRating: number;
  notes?: string | null;
  currentPath?: string | null;
  createdAt: string;
  user?: {
    email: string;
    name?: string | null;
    tier: TierName;
  } | null;
}

export interface UserSettings {
  preferredDirection?: Direction;
  preferredInputMode?: InputMode;
  diarizationEnabled?: boolean;
  preferredVoice?: string;
}

export interface HealthStatus {
  ok: boolean;
  timestamp: string;
  checks: Record<string, string>;
}

export type TierName = 'FREE' | 'PRO' | 'TEAM' | 'ENTERPRISE';
export type InternalRole = 'CUSTOMER' | 'OPS' | 'ADMIN';
export type ReviewerAccessStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  tier: TierName;
  portalAccess?: boolean;
  internalRole?: InternalRole;
  reviewerAccess?: boolean;
  reviewerAccessStatus?: ReviewerAccessStatus;
  emailVerified?: boolean;
}

export interface UsageBucket {
  used: number;
  limit: number;
}

export interface UsageData {
  date: string;
  tier: TierName;
  usage: {
    translate: UsageBucket;
    transcribe: UsageBucket;
    tts: UsageBucket;
  };
  features: {
    conversationsEnabled: boolean;
    audioTrimming: boolean;
    apiAccess: boolean;
    exportEnabled: boolean;
  };
}

export interface InternalUserItem {
  id: string;
  email: string;
  name?: string | null;
  tier: TierName;
  portalAccess: boolean;
  internalRole: InternalRole;
  createdAt: string;
}

export interface ReviewerApplicationItem {
  id: string;
  status: ReviewerAccessStatus;
  organization?: string | null;
  roleTitle?: string | null;
  languages?: string | null;
  credentials: string;
  reviewUseCase?: string | null;
  portfolioUrl?: string | null;
  notes?: string | null;
  reviewerDecisionNotes?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  user: {
    id: string;
    email: string;
    name?: string | null;
    tier: TierName;
    reviewerAccess: boolean;
    reviewerAccessStatus: ReviewerAccessStatus;
  };
}
