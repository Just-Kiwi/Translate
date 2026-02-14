import { LanguageOption } from './types';

export const SOURCE_LANGUAGES: LanguageOption[] = [
  { code: 'English', name: 'English', flag: '🇺🇸' },
  { code: 'Chinese (Mandarin)', name: 'Chinese (Mandarin)', flag: '🇨🇳' },
  { code: 'Cantonese', name: 'Cantonese', flag: '🇭🇰' },
  { code: 'Malay', name: 'Malay', flag: '🇲🇾' },
  { code: 'Hindi', name: 'Hindi', flag: '🇮🇳' },
  { code: 'Singlish', name: 'Singlish', flag: '🇸🇬' },
];

export const TARGET_LANGUAGES: LanguageOption[] = [
  { code: 'English', name: 'English', flag: '🇺🇸' },
  { code: 'Chinese (Mandarin)', name: 'Chinese (Mandarin)', flag: '🇨🇳' },
  { code: 'Cantonese', name: 'Cantonese', flag: '🇭🇰' },
  { code: 'Malay', name: 'Malay', flag: '🇲🇾' },
  { code: 'Hindi', name: 'Hindi', flag: '🇮🇳' },
  { code: 'Singlish', name: 'Singlish', flag: '🇸🇬' },
];

// This should point to your Gradio backend URL.
// If running locally with default Gradio settings, it is usually http://localhost:7860
export const API_BASE_URL = 'http://localhost:7860';
