export interface LanguageVariant {
  code: string;
  name: string;
}

export interface LanguageProfile {
  code: string;
  name: string;
  variants: LanguageVariant[];
}

export const languages: Record<string, LanguageProfile> = {
  tw: {
    code: 'tw',
    name: 'Twi',
    variants: [
      { code: 'Asante Twi', name: 'Asante Twi' },
      { code: 'Akuapem Twi', name: 'Akuapem Twi' },
      { code: 'Fante', name: 'Fante' },
      { code: 'Akyem Twi', name: 'Akyem Twi' },
      { code: 'Bono Twi', name: 'Bono Twi' },
    ],
  },
  en: {
    code: 'en',
    name: 'English',
    variants: [{ code: 'English', name: 'Standard English' }],
  },
};

export const getLanguageName = (code: string) => languages[code]?.name || code;
