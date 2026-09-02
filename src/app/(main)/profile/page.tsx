import Link from 'next/link';
import { requireActiveFamily } from '@/lib/family-context';
import { getMemberships, getProfile, requireUser } from '@/lib/auth/session';
import { getFamilyGraph } from '@/lib/data/family';
import { aiStatus } from '@/lib/ai';
import { Display, Eyebrow, SectionLead } from '@/components/ui/Editorial';
import { Avatar } from '@/components/ui/Avatar';
import { ProfileSettings } from '@/components/profile/ProfileSettings';
import { FamilySwitcher } from '@/components/profile/FamilySwitcher';
import { SignOutButton } from '@/components/profile/SignOutButton';
import { ArchiveIcon, ChevronRightIcon, ShieldIcon, SparkIcon } from '@/components/icons';
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

  const me = membership.person_id ? graph.people.find((p) => p.id === membership.person_id) : null;

  return (
    <main id="main" className="px-5 pb-12 pt-10">
      {/* The person, before the settings. Even the account screen is about
          somebody in the family rather than about a login. */}
      <header className="flex items-center gap-4">
        <Avatar person={me ?? null} size="xl" />
        <div className="min-w-0">
          <Eyebrow>{ROLE_LABELS[membership.role] ?? membership.role}</Eyebrow>
          <Display size="md" className="mt-1.5">
            {profile?.display_name ?? 'Гэр бүлийн гишүүн'}
          </Display>
          <p className="mt-1 truncate text-sm text-muted">{user.email}</p>
        </div>
      </header>

      <p className="mt-6 text-sm text-ink-soft">
        {membership.family.name} · {graph.people.length} хүн
      </p>

      <section className="mt-10">
        <SectionLead label="Өөрийгөө холбох" title="Та модны хэн бэ?" />
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
        <section className="mt-10">
          <SectionLead label="Танай архивууд" title="Гэр бүлүүд" />
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

      <section className="mt-10">
        <SectionLead label="Тохиргоо" title="Архив" />
        <ul className="divide-y divide-line/70">
          <li>
            <Link href="/settings/family" className="flex items-center gap-3.5 py-4">
              <ShieldIcon size={19} className="shrink-0 text-sage" />
              <span className="min-w-0 flex-1">
                <span className="block text-[0.95rem] text-ink">Гишүүд ба эрх</span>
                <span className="block text-xs text-muted">Урих, эрх өөрчлөх, аюулгүй байдал</span>
              </span>
              <ChevronRightIcon size={17} className="shrink-0 text-muted" />
            </Link>
          </li>
          <li>
            <a href="/api/export" className="flex items-center gap-3.5 py-4">
              <ArchiveIcon size={19} className="shrink-0 text-olive" />
              <span className="min-w-0 flex-1">
                <span className="block text-[0.95rem] text-ink">Архивыг татах</span>
                <span className="block text-xs text-muted">
                  Бүх мэдээлэл JSON хэлбэрээр — таны гэр бүлийн өмч
                </span>
              </span>
              <ChevronRightIcon size={17} className="shrink-0 text-muted" />
            </a>
          </li>
          <li>
            <Link href="/family/story" className="flex items-center gap-3.5 py-4">
              <SparkIcon size={19} className="shrink-0 text-forest" />
              <span className="min-w-0 flex-1">
                <span className="block text-[0.95rem] text-ink">Гэр бүлийн түүх бичүүлэх</span>
                <span className="block text-xs text-muted">
                  Зөвхөн архивт байгаа мэдээллээс эмхэтгэнэ
                </span>
              </span>
              <ChevronRightIcon size={17} className="shrink-0 text-muted" />
            </Link>
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <SectionLead label="Туслах" title="AI тохиргоо" />
        <div className="rounded-(--radius-card) bg-parchment-deep/50 px-5 py-4">
          <p className="text-[0.95rem] text-ink">
            {ai.configured ? `AI холбогдсон (${ai.model})` : 'AI тохируулагдаагүй'}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
            {ai.configured
              ? 'Яриа таних, баримт унших, түүх эмхэтгэх боломжтой. AI зөвхөн танай архивт байгаа мэдээллийг ашиглана — шинэ баримт зохиохгүй.'
              : 'ROOTS бүрэн ажиллаж байна. AI-гүйгээр ч дуу хоолой, зураг, дурсамж, хамаарал бүгд хадгалагдана. AI-тай холбоотой хэсгүүд «туршилтын горим» гэж тэмдэглэгдэнэ.'}
          </p>
        </div>
      </section>

      <div className="mt-10">
        <SignOutButton />
      </div>

      <p className="mt-8 text-center text-xs leading-relaxed text-muted">
        ROOTS — танай гэр бүлийн хувийн архив.
        <br />
        Танай гэр бүл өөрийн түүхээ хэзээ ч мартах ёсгүй.
      </p>
    </main>
  );
}
