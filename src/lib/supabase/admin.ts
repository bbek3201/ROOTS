import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { publicEnv, serverEnv } from '@/lib/env';
import type { Database } from '@/types/database';

/**
 * Service-role client. BYPASSES ROW LEVEL SECURITY.
 *
 * Only two things may use it, and both check permissions themselves first:
 *   · writing ai_outputs rows (no client-facing INSERT policy exists for them)
 *   · signing storage URLs after an explicit membership check
 *
 * Never hand this client a family_id that came straight from a request without
 * verifying the caller belongs to that family. `assertFamilyAccess` in
 * lib/auth/guards.ts is the only sanctioned way to do that.
 */
export function createAdminClient() {
  const { SUPABASE_SERVICE_ROLE_KEY } = serverEnv();
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. It is required for server-side AI and signed media URLs.',
    );
  }
  const env = publicEnv();
  return createSupabaseClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function hasServiceRole(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
