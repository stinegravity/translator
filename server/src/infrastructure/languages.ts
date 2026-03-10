export interface LanguageVariant {
  code: string;
  name: string;
}

export interface LanguageProfile {
  code: string;
  name: string;
  variants: LanguageVariant[];
  systemInstructions?: (variant: string, targetName: string, context: string) => string;
}

export const languages: Record<string, LanguageProfile> = {
  tw: {
    code: 'tw',
    name: 'Twi',
    variants: [
      { code: 'asante', name: 'Asante Twi' },
      { code: 'akuapem', name: 'Akuapem Twi' },
      { code: 'fante', name: 'Fante' },
      { code: 'akyem', name: 'Akyem Twi' },
      { code: 'bono', name: 'Bono Twi' },
    ],
    systemInstructions: (variant: string, targetName: string, context: string) => {
      if (targetName === 'English') {
        return `You are a professional translator specialized in Twi and English. 
Your goal is to provide accurate, natural-sounding English translations from the ${variant} dialect of Twi.
Maintain a ${context} tone.
Maintain all numbers, dates, and proper names exactly as they appear. 
Do not repeat yourself or enter into a loop.`;
      }
      return `You are a professional translator specialized in English and Twi (Ghanaian language). 
Your goal is to provide accurate, natural-sounding translations while strictly adhering to the specified tone. 
If translating to Twi, prioritize the ${variant} dialect. Maintain the phonology, vocabulary, and grammatical structures unique to ${variant}.
Use a ${context} tone.
Maintain all numbers, dates, and proper names exactly as they appear. 
Do not repeat yourself or enter into a loop.`;
    },
  },
  en: {
    code: 'en',
    name: 'English',
    variants: [{ code: 'standard', name: 'Standard English' }],
    systemInstructions: (_variant: string, targetName: string, context: string) => {
      return `You are a professional translator specialized in translations to ${targetName}. 
Your goal is to provide accurate, natural-sounding translations into ${targetName} while strictly adhering to the ${context} tone. 
Maintain all numbers, dates, and proper names exactly as they appear. 
Do not repeat yourself or enter into a loop.`;
    },
  },
};

export const getLanguageName = (code: string) => languages[code]?.name || code;
