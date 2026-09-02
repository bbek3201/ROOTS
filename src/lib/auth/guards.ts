import 'server-only';

import { getActiveMembership, hasRoleAtLeast, type Membership } from './session';
import type { FamilyRole } from '@/types/database';

/**
 * A refusal that route handlers turn into an HTTP status.
 *
 * Deliberately says "not found" for a family the caller is not a member of:
 * telling an outsider that a family EXISTS is already a leak.
 */
export class AccessError extends Error {
  readonly status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = 'AccessError';
    this.status = status;
  }
}

/**
 * The single sanctioned way to turn an untrusted family_id from a request into
 * a membership. Server code that skips this and passes the id straight to the
 * admin client is the one way this application could leak another family's data.
 */
export async function assertFamilyAccess(
  familyId: string | null | undefined,
  minimumRole: FamilyRole = 'viewer',
): Promise<Membership> {
  if (!familyId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(familyId)) {
    throw new AccessError('Гэр бүл олдсонгүй.', 404);
  }

  const membership = await getActiveMembership(familyId);
  if (!membership) {
    throw new AccessError('Гэр бүл олдсонгүй.', 404);
  }
  if (!hasRoleAtLeast(membership.role, minimumRole)) {
    throw new AccessError('Танд энэ үйлдлийг хийх эрх байхгүй байна.', 403);
  }
  return membership;
}

/** Map an AccessError (or anything else) onto a safe JSON response body. */
export function errorResponse(error: unknown): { status: number; body: { error: string } } {
  if (error instanceof AccessError) {
    return { status: error.status, body: { error: error.message } };
  }
  // Never echo a raw database error to the client: they carry table and column
  // names, and sometimes values.
  console.error('[roots] unhandled error', error);
  return { status: 500, body: { error: 'Алдаа гарлаа. Дахин оролдоно уу.' } };
}
