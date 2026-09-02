'use client';

import { createBrowserClient } from '@supabase/ssr';
import { publicEnv } from '@/lib/env';
import type { Database } from '@/types/database';

/**
 * Browser Supabase client.
 *
 * It carries only the anon key, which is powerless on its own: every table is
 * behind RLS, so the worst an attacker can do with it is ask questions the
 * database refuses to answer.
 */
let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  if (cached) return cached;
  const env = publicEnv();
  cached = createBrowserClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return cached;
}
