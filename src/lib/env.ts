import { z } from 'zod';

/**
 * Environment access, split by trust boundary.
 *
 * `publicEnv` is safe in the browser. `serverEnv()` throws if it is ever
 * evaluated outside a server context, which is the mechanism that stops a
 * service-role key or an AI API key from being pulled into a client bundle by
 * an innocent-looking import.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is missing'),
});

// Next.js inlines process.env.NEXT_PUBLIC_* at build time only for literal
// property access, so these must be written out rather than looped over.
const publicValues = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

export type PublicEnv = z.infer<typeof publicSchema>;

let cachedPublic: PublicEnv | null = null;

export function publicEnv(): PublicEnv {
  if (cachedPublic) return cachedPublic;
  const parsed = publicSchema.safeParse(publicValues);
  if (!parsed.success) {
    throw new Error(
      `Supabase is not configured. Copy .env.example to .env.local and fill it in.\n${parsed.error.issues
        .map((issue) => `  · ${issue.message}`)
        .join('\n')}`,
    );
  }
  cachedPublic = parsed.data;
  return cachedPublic;
}

/** True when Supabase credentials are present — used to render a setup screen. */
export function isSupabaseConfigured(): boolean {
  return publicSchema.safeParse(publicValues).success;
}

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  ROOTS_AI_PROVIDER: z.enum(['mock', 'anthropic']).default('mock'),
  ANTHROPIC_API_KEY: z.string().optional(),
  ROOTS_AI_MODEL: z.string().default('claude-sonnet-5'),
});

export type ServerEnv = z.infer<typeof serverSchema>;

export function serverEnv(): ServerEnv {
  if (typeof window !== 'undefined') {
    throw new Error('serverEnv() was called in the browser. Secrets must never reach the client.');
  }
  const parsed = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ROOTS_AI_PROVIDER: process.env.ROOTS_AI_PROVIDER || 'mock',
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    ROOTS_AI_MODEL: process.env.ROOTS_AI_MODEL || 'claude-sonnet-5',
  });
  if (!parsed.success) {
    throw new Error(`Invalid server environment:\n${parsed.error.issues.map((i) => `  · ${i.path.join('.')}: ${i.message}`).join('\n')}`);
  }
  return parsed.data;
}
