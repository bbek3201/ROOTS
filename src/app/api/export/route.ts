import { assertFamilyAccess } from '@/lib/auth/guards';
import { getActiveFamily } from '@/lib/family-context';
import { createClient } from '@/lib/supabase/server';
import { handle } from '@/lib/api';
import { NextResponse } from 'next/server';

/**
 * Full family export.
 *
 * A family's history belongs to the family, not to this application. Admins can
 * take the entire archive out as JSON at any time — people, relationships,
 * memories, events, transcripts, sources and the storage paths of every file.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const url = new URL(request.url);
    const requested = url.searchParams.get('familyId');
    const active = await getActiveFamily();

    const membership = await assertFamilyAccess(requested ?? active?.family_id, 'admin');

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('export_family', { p_family_id: membership.family_id });
    if (error) throw new Error(error.message);

    const filename = `roots-${membership.family.name.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}-${
      new Date().toISOString().slice(0, 10)
    }.json`;

    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="${filename}"`,
        'cache-control': 'no-store',
      },
    });
  });
}
