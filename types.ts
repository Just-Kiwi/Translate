export interface LanguageOption {
  code: string;
  name: string;
  flag: string;
}

export interface TranslationState {
  status: 'idle' | 'recording' | 'processing' | 'completed' | 'error';
  transcript: string;
  translation: string;
  audioUrl: string | null;
  logs: string[];
  error?: string;
}

export type ProcessingStep = 'transcribing' | 'translating' | 'synthesizing' | 'idle';

export interface ApiRequestPayload {
  audio: Blob;
  sourceLang: string;
  targetLang: string;
}

export interface ApiResponse {
  transcript: string;
  translation: string;
  audio: string; // Base64 or URL
  logs: string;
}
