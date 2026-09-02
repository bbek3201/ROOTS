import { requireActiveFamily } from '@/lib/family-context';
import { createClient } from '@/lib/supabase/server';
import { AppHeader } from '@/components/nav/AppHeader';
import { SearchScreen } from '@/components/search/SearchScreen';

export const dynamic = 'force-dynamic';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const membership = await requireActiveFamily();
  const { q } = await searchParams;

  let results: Array<{
    result_type: string; result_id: string; title: string;
    subtitle: string | null; snippet: string | null; event_date: string | null; rank: number;
  }> = [];

  if (q && q.trim().length > 0) {
    const supabase = await createClient();
    // One SQL function searches people, memories, transcripts and OCR'd
    // documents together. No AI, no embeddings — just indexes doing their job.
    const { data } = await supabase.rpc('search_family', {
      p_family_id: membership.family_id,
      p_query: q.trim(),
      p_limit: 40,
    });
    results = data ?? [];
  }

  return (
    <>
      <AppHeader title="Хайх" subtitle={membership.family.name} />
      <main id="main" className="px-4 pb-8 pt-4">
        <SearchScreen
          query={q ?? ''}
          results={results}
          hasSelfLink={Boolean(membership.person_id)}
        />
      </main>
    </>
  );
}
