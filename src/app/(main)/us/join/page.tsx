import { requireActiveFamily } from '@/lib/family-context';
import { createClient } from '@/lib/supabase/server';
import { AppHeader } from '@/components/nav/AppHeader';
import { EmptyState } from '@/components/ui/States';
import { CoupleJoinForm } from '@/components/couple/CoupleJoinForm';

export const dynamic = 'force-dynamic';

/**
 * Accepting an invitation from your person.
 *
 * The preview runs before anything is joined, so the page can say who is asking
 * rather than making someone accept an anonymous link. It reveals only the two
 * names and the expiry — never anything that is inside the space.
 */
export default async function CoupleJoinPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  await requireActiveFamily();
  const { token } = await searchParams;

  if (!token) {
    return (
      <>
        <AppHeader title="Урилга" backHref="/us" />
        <main id="main" className="px-4 pb-8">
          <EmptyState
            title="Урилгын холбоос дутуу байна"
            description="Хань тань илгээсэн холбоосыг бүтнээр нь нээнэ үү."
          />
        </main>
      </>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase.rpc('preview_couple_invitation', { p_token: token });
  const preview = (data as Array<{ inviter_name: string; partner_name: string }> | null)?.[0] ?? null;

  return (
    <>
      <AppHeader title="Хоёулаа" backHref="/us" />
      <main id="main" className="px-4 pb-8">
        {preview ? (
          <CoupleJoinForm token={token} inviterName={preview.inviter_name} />
        ) : (
          <EmptyState
            title="Урилга хүчингүй болжээ"
            description="Хугацаа нь дууссан эсвэл аль хэдийн ашиглагдсан байна. Хань тайгаа шинээр урилга илгээхийг хүсээрэй."
            action={{ label: 'Буцах', href: '/us' }}
          />
        )}
      </main>
    </>
  );
}
