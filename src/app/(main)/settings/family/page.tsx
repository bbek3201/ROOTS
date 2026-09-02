import { requireActiveFamily } from '@/lib/family-context';
import { createClient } from '@/lib/supabase/server';
import { can } from '@/lib/auth/session';
import { AppHeader } from '@/components/nav/AppHeader';
import { Card, SectionHeading } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/States';
import { InviteManager } from '@/components/family/InviteManager';
import { MemberList } from '@/components/family/MemberList';
import { DangerZone } from '@/components/family/DangerZone';
import { relativeTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function FamilySettingsPage() {
  const membership = await requireActiveFamily();
  const isAdmin = can(membership, 'administer');

  if (!isAdmin) {
    return (
      <>
        <AppHeader title="Гишүүд ба эрх" backHref="/profile" />
        <main id="main" className="p-4">
          <EmptyState
            title="Зөвхөн админ харна"
            description="Гишүүдийн жагсаалт, урилга, аюулгүй байдлын бүртгэлийг архивын админ, эзэн харна."
          />
        </main>
      </>
    );
  }

  const supabase = await createClient();

  const [members, invitations, audit] = await Promise.all([
    supabase.from('family_members')
      .select('id, role, status, joined_at, user_id, person_id, profile:profiles(display_name, avatar_url)')
      .eq('family_id', membership.family_id)
      .order('joined_at', { ascending: true }),
    supabase.from('invitations')
      .select('id, email, role, expires_at, accepted_at, revoked_at, created_at')
      .eq('family_id', membership.family_id)
      .is('accepted_at', null)
      .is('revoked_at', null)
      .order('created_at', { ascending: false }),
    supabase.from('audit_logs')
      .select('id, action, resource_type, created_at, metadata')
      .eq('family_id', membership.family_id)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  return (
    <>
      <AppHeader title="Гишүүд ба эрх" subtitle={membership.family.name} backHref="/profile" />

      <main id="main" className="px-4 pb-8 pt-5">
        <section className="mb-6">
          <SectionHeading title="Урих" subtitle="Урилгын холбоос нэг удаа л харагдана" />
          <InviteManager
            familyId={membership.family_id}
            pending={(invitations.data ?? []).map((invitation) => ({
              id: invitation.id,
              email: invitation.email,
              role: invitation.role,
              expiresAt: invitation.expires_at,
            }))}
          />
        </section>

        <section className="mb-6">
          <SectionHeading title="Гишүүд" subtitle={`${members.data?.length ?? 0} хүн`} />
          <MemberList
            currentMemberId={membership.id}
            isOwner={membership.role === 'owner'}
            members={(members.data ?? []).map((member) => ({
              id: member.id,
              role: member.role,
              status: member.status,
              joinedAt: member.joined_at,
              name:
                (member as unknown as { profile: { display_name: string } | null }).profile?.display_name
                ?? 'Гэр бүлийн гишүүн',
            }))}
          />
        </section>

        <section className="mb-6">
          <SectionHeading
            title="Аюулгүй байдлын бүртгэл"
            subtitle="Хэн юу хийснийг өөрчлөх боломжгүйгээр тэмдэглэнэ"
          />
          {(audit.data ?? []).length === 0 ? (
            <EmptyState title="Бүртгэл хоосон" description="Үйлдэл хийгдэх бүрд энд тэмдэглэгдэнэ." />
          ) : (
            <Card className="p-0">
              <ul className="divide-y divide-line">
                {(audit.data ?? []).map((entry) => (
                  <li key={entry.id} className="flex items-baseline gap-3 px-4 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{auditLabel(entry.action)}</span>
                      <span className="block text-xs text-muted">{relativeTime(entry.created_at)}</span>
                    </span>
                    {entry.resource_type ? (
                      <Badge tone="neutral">{entry.resource_type}</Badge>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>

        <section>
          <SectionHeading title="Аюултай бүс" />
          <DangerZone
            familyId={membership.family_id}
            familyName={membership.family.name}
            isOwner={membership.role === 'owner'}
          />
        </section>
      </main>
    </>
  );
}

function auditLabel(action: string): string {
  const labels: Record<string, string> = {
    'family.created': 'Архив үүсгэсэн',
    'family.exported': 'Архивыг татсан',
    'family.deleted': 'Архивыг устгасан',
    'person.created': 'Хүн нэмсэн',
    'couple.created': 'Хос үүсгэсэн',
    'couple.child_linked': 'Хүүхэд холбосон',
    'invitation.created': 'Урилга илгээсэн',
    'invitation.accepted': 'Урилга хүлээн авсан',
    'memory.deleted': 'Дурсамж устгасан',
    'member.left': 'Гишүүн гарсан',
    'fact.conflict_detected': 'Зөрчилтэй мэдээлэл илэрсэн',
  };
  return labels[action] ?? action;
}
