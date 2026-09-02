import Link from 'next/link';
import { requireActiveFamily } from '@/lib/family-context';
import { getQuestionSets, listInterviews } from '@/lib/data/interviews';
import { getFamilyGraph } from '@/lib/data/family';
import { can } from '@/lib/auth/session';
import { AppHeader } from '@/components/nav/AppHeader';
import { Card, SectionHeading } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/States';
import { StartInterview } from '@/components/interview/StartInterview';
import { displayName, lifespan, relativeTime } from '@/lib/format';
import { MicIcon } from '@/components/icons';

export const dynamic = 'force-dynamic';

export default async function InterviewIndexPage() {
  const membership = await requireActiveFamily();
  const locale = membership.family.default_locale;

  const [interviews, sets, graph] = await Promise.all([
    listInterviews(membership.family_id),
    getQuestionSets(membership.family_id, locale),
    getFamilyGraph(membership.family_id),
  ]);

  // Living elders first: these are the interviews that cannot wait.
  const candidates = graph.people
    .filter((person) => person.life_status !== 'deceased')
    .sort((a, b) => (a.generation ?? 9) - (b.generation ?? 9));

  return (
    <>
      <AppHeader title="Ярилцлага" subtitle="Дуу хоолой, дурсамжийг хадгалах" />

      <main id="main" className="px-4 pb-8 pt-5">
        <Card className="mb-5 border-forest/25 bg-forest-wash">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-forest">
              <MicIcon size={20} />
            </span>
            <div>
              <h2 className="font-display text-base text-ink">Хамгийн яаралтай зүйл</h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                Зураг хожим ч олдож магадгүй. Харин өвөө эмээгийн дуу хоолой, тэдний өөрсдийнх нь
                үгээр ярьсан түүх — зөвхөн тэднийг байхад л бичигдэнэ.
              </p>
            </div>
          </div>
        </Card>

        {can(membership, 'contribute') ? (
          <section className="mb-6">
            <SectionHeading title="Шинэ ярилцлага" />
            {candidates.length === 0 ? (
              <EmptyState
                title="Хүн бүртгэгдээгүй байна"
                description="Ярилцлага хийхийн тулд эхлээд гэр бүлийн модонд хүн нэмнэ үү."
                action={{ label: 'Хүн нэмэх', href: '/family/add-person' }}
              />
            ) : (
              <StartInterview
                people={candidates.map((person) => ({
                  id: person.id,
                  label: displayName(person),
                  detail: lifespan(person),
                  generation: person.generation,
                }))}
                sets={sets.map((set) => ({
                  id: set.id,
                  title: set.title,
                  description: set.description,
                  questionCount: set.templates.length,
                }))}
              />
            )}
          </section>
        ) : null}

        <section>
          <SectionHeading title="Хийгдсэн ярилцлагууд" />
          {interviews.length === 0 ? (
            <EmptyState
              title="Ярилцлага хараахан алга"
              description="Эхний ярилцлагаа хийхэд 20 асуулт танд тусална. Бүгдийг нь нэг дор хариулах шаардлагагүй — хэдийд ч үргэлжлүүлж болно."
            />
          ) : (
            <ul className="space-y-2.5">
              {interviews.map((interview) => (
                <li key={interview.id}>
                  <Link href={`/interview/${interview.id}`} className="card block p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">
                          {interview.subject ? displayName(interview.subject) : 'Тодорхойгүй'}
                        </p>
                        <p className="truncate text-sm text-muted">{interview.title}</p>
                      </div>
                      <Badge tone={interview.status === 'completed' ? 'sage' : 'forest'}>
                        {statusLabel(interview.status)}
                      </Badge>
                    </div>

                    {interview.total > 0 ? (
                      <div className="mt-3">
                        <div
                          className="h-1.5 overflow-hidden rounded-full bg-parchment-deep"
                          role="progressbar"
                          aria-valuenow={interview.answered}
                          aria-valuemin={0}
                          aria-valuemax={interview.total}
                        >
                          <div
                            className="h-full rounded-full bg-forest"
                            style={{ width: `${Math.round((interview.answered / interview.total) * 100)}%` }}
                          />
                        </div>
                        <p className="mt-1.5 text-xs text-muted">
                          {interview.answered}/{interview.total} асуулт · {relativeTime(interview.updated_at)}
                        </p>
                      </div>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Ноорог', in_progress: 'Үргэлжилж буй', paused: 'Түр зогссон',
    completed: 'Дууссан', archived: 'Архивласан',
  };
  return labels[status] ?? status;
}
