'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { relativeTime } from '@/lib/format';
import type { FamilyRole } from '@/types/database';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Эзэн', admin: 'Админ', editor: 'Засварлагч',
  contributor: 'Хувь нэмэр', viewer: 'Үзэгч',
};

const ASSIGNABLE: FamilyRole[] = ['viewer', 'contributor', 'editor', 'admin'];

/**
 * Members and their roles.
 *
 * The owner's role is not editable here and the owner cannot be removed — the
 * database enforces both (a partial unique index guarantees exactly one active
 * owner, and the delete policy excludes them), so this UI is reflecting a real
 * constraint rather than inventing one.
 */
export function MemberList({
  members,
  currentMemberId,
  isOwner,
}: {
  members: Array<{ id: string; role: string; status: string; joinedAt: string; name: string }>;
  currentMemberId: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const changeRole = async (memberId: string, role: FamilyRole) => {
    setBusyId(memberId);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from('family_members').update({ role }).eq('id', memberId);
    if (updateError) setError('Эрх өөрчлөхөд алдаа гарлаа.');
    setBusyId(null);
    router.refresh();
  };

  const remove = async (memberId: string) => {
    setBusyId(memberId);
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase.from('family_members').delete().eq('id', memberId);
    if (deleteError) setError('Гишүүнийг хасахад алдаа гарлаа.');
    setBusyId(null);
    router.refresh();
  };

  return (
    <>
      {error ? (
        <p role="alert" className="mb-2 rounded-xl bg-danger-wash px-3 py-2.5 text-sm text-danger">{error}</p>
      ) : null}

      <Card className="p-0">
        <ul className="divide-y divide-line">
          {members.map((member) => {
            const isSelf = member.id === currentMemberId;
            const locked = member.role === 'owner' || (!isOwner && member.role === 'admin');

            return (
              <li key={member.id} className="px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {member.name}
                      {isSelf ? <span className="ml-1.5 text-xs text-muted">(та)</span> : null}
                    </p>
                    <p className="text-xs text-muted">
                      {relativeTime(member.joinedAt)}
                      {member.status !== 'active' ? ` · ${member.status}` : ''}
                    </p>
                  </div>
                  {locked ? <Badge tone="sage">{ROLE_LABELS[member.role]}</Badge> : null}
                </div>

                {!locked ? (
                  <div className="mt-2.5 flex items-center gap-2">
                    <select
                      value={member.role}
                      disabled={busyId === member.id}
                      onChange={(event) => changeRole(member.id, event.target.value as FamilyRole)}
                      aria-label={`${member.name}-ийн эрх`}
                      className="min-h-10 flex-1 rounded-xl border border-line bg-surface px-3 text-sm text-ink focus:border-ember focus:outline-none"
                    >
                      {ASSIGNABLE.map((role) => (
                        <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => remove(member.id)}
                      disabled={busyId === member.id}
                      className="shrink-0 rounded-pill border border-danger/30 px-3 py-2 text-xs font-medium text-danger"
                    >
                      Хасах
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Card>

      <p className="mt-2 px-1 text-xs leading-relaxed text-muted">
        Гишүүнийг хассан ч түүний нэмсэн дурсамж, зураг архивт үлдэж, нэр нь хадгалагдана —
        гэр бүл өөрийн дурсамжаа алдах ёсгүй.
      </p>
    </>
  );
}
