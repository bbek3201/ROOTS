import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { FamilyRole } from '@/types/database';

export interface JoinCode {
  code: string;
  role: FamilyRole;
  isEnabled: boolean;
  useCount: number;
}

/**
 * The family's join code, for an admin looking at their own archive.
 *
 * Returns null rather than throwing for anyone who may not see it: this is
 * called from pages that render for every member, and a viewer hitting a
 * permission error on the home screen would be a bug, not a security event.
 * The RPC is the real gate — it refuses non-admins on the server.
 */
export async function getJoinCode(familyId: string): Promise<JoinCode | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('get_join_code', { p_family_id: familyId });
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return null;
  return { code: row.code, role: row.role, isEnabled: row.is_enabled, useCount: row.use_count };
}
