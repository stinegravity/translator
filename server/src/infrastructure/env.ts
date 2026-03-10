const REQUIRED = ['DATABASE_URL', 'BETTER_AUTH_SECRET'] as const;
const AT_LEAST_ONE = ['OPENAI_API_KEY', 'GOOGLE_TRANSLATE_API_KEY'] as const;

export function validateEnv(): void {
  const missing: string[] = [];

  for (const key of REQUIRED) {
    if (!process.env[key]?.trim()) {
      missing.push(key);
    }
  }

  const hasApiKey = AT_LEAST_ONE.some((key) => process.env[key]?.trim());
  if (!hasApiKey) {
    missing.push(`one of ${AT_LEAST_ONE.join(' or ')}`);
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        'Check DATABASE_URL and at least one of OPENAI_API_KEY or GOOGLE_TRANSLATE_API_KEY.'
    );
  }
}
