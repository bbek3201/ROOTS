import Link from 'next/link';
import { requireActiveFamily } from '@/lib/family-context';
import { getMemberships, getProfile, requireUser } from '@/lib/auth/session';
import { getFamilyGraph } from '@/lib/data/family';
import { aiStatus } from '@/lib/ai';
import { AppHeader } from '@/components/nav/AppHeader';
import { Card, SectionHeading } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProfileSettings } from '@/components/profile/ProfileSettings';
import { FamilySwitcher } from '@/components/profile/FamilySwitcher';
import { SignOutButton } from '@/components/profile/SignOutButton';
import { ArchiveIcon, ShieldIcon, SparkIcon } from '@/components/icons';
import { displayName, lifespan } from '@/lib/format';

export const dynamic = 'force-dynamic';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Эзэн', admin: 'Админ', editor: 'Засварлагч',
  contributor: 'Хувь нэмэр оруулагч', viewer: 'Үзэгч',
};

export default async function ProfilePage() {
  const user = await requireUser();
  const membership = await requireActiveFamily();
  const [profile, memberships, graph] = await Promise.all([
    getProfile(),
    getMemberships(),
    getFamilyGraph(membership.family_id),
  ]);

  const ai = aiStatus();

  return (
    <>
      <AppHeader title="Профайл" />

      <main id="main" className="px-4 pb-8 pt-5">
        <Card className="mb-5">
          <p className="font-display text-xl text-ink">{profile?.display_name ?? 'Гэр бүлийн гишүүн'}</p>
          <p className="mt-0.5 text-sm text-muted">{user.email}</p>
          <p className="mt-2">
            <Badge tone="sage">{ROLE_LABELS[membership.role] ?? membership.role}</Badge>
          </p>
        </Card>

        <section className="mb-5">
          <SectionHeading
            title="Та модны хэн бэ?"
            subtitle="Өөрийгөө холбосноор хамаарлыг тань тооцож харуулна"
          />
          <ProfileSettings
            memberId={membership.id}
            currentPersonId={membership.person_id}
            displayName={profile?.display_name ?? ''}
            people={graph.people.map((person) => ({
              id: person.id,
              label: displayName(person),
              detail: lifespan(person),
            }))}
          />
        </section>

        {memberships.length > 1 ? (
          <section className="mb-5">
            <SectionHeading title="Гэр бүлүүд" />
            <FamilySwitcher
              activeFamilyId={membership.family_id}
              families={memberships.map((entry) => ({
                id: entry.family_id,
                name: entry.family.name,
                role: ROLE_LABELS[entry.role] ?? entry.role,
              }))}
            />
          </section>
        ) : null}

        <section className="mb-5">
          <SectionHeading title="Архив" />
          <Card className="p-0">
            <ul className="divide-y divide-line">
              <li>
                <Link href="/settings/family" className="flex items-center gap-3 px-4 py-3.5">
                  <ShieldIcon size={18} className="shrink-0 text-sage" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">Гишүүд ба эрх</span>
                    <span className="block text-xs text-muted">Урих, эрх өөрчлөх, аюулгүй байдал</span>
                  </span>
                </Link>
              </li>
              <li>
                <a href="/api/export" className="flex items-center gap-3 px-4 py-3.5">
                  <ArchiveIcon size={18} className="shrink-0 text-gold" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">Архивыг татах</span>
                    <span className="block text-xs text-muted">
                      Бүх мэдээллийг JSON хэлбэрээр авах — таны гэр бүлийн өмч
                    </span>
                  </span>
                </a>
              </li>
              <li>
                <Link href="/family/story" className="flex items-center gap-3 px-4 py-3.5">
                  <SparkIcon size={18} className="shrink-0 text-ember" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">Гэр бүлийн түүх бичүүлэх</span>
                    <span className="block text-xs text-muted">
                      Зөвхөн архивт байгаа мэдээллээс эмхэтгэнэ
                    </span>
                  </span>
                </Link>
              </li>
            </ul>
          </Card>
        </section>

        <section className="mb-5">
          <SectionHeading title="AI тохиргоо" />
          <Card className={ai.configured ? '' : 'border-gold/30 bg-gold-wash'}>
            <div className="flex items-start gap-3">
              <SparkIcon size={20} className="mt-0.5 shrink-0 text-ember" />
              <div>
                <p className="text-sm font-medium text-ink">
                  {ai.configured ? `AI холбогдсон (${ai.model})` : 'AI тохируулагдаагүй'}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                  {ai.configured
                    ? 'Яриа таних, баримт унших, түүх эмхэтгэх боломжтой. AI зөвхөн танай архивт байгаа мэдээллийг ашиглана — шинэ баримт зохиохгүй.'
                    : 'ROOTS бүрэн ажиллаж байна. AI-гүйгээр ч дуу хоолой, зураг, дурсамж, хамаарал бүгд хадгалагдана. AI-тай холбоотой хэсгүүд «туршилтын горим» гэж тэмдэглэгдэнэ.'}
                </p>
              </div>
            </div>
          </Card>
        </section>

        <SignOutButton />

        <p className="mt-6 text-center text-xs leading-relaxed text-muted">
          ROOTS — танай гэр бүлийн хувийн архив.
          <br />
          Танай гэр бүл өөрийн түүхээ хэзээ ч мартах ёсгүй.
        </p>
      </main>
    </>
  );
}
