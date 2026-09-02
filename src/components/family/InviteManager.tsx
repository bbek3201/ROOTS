'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { describeRpcError } from '@/lib/supabase/errors';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { SelectField, TextField } from '@/components/ui/Field';
import type { FamilyRole } from '@/types/database';

/**
 * Create and manage invitations.
 *
 * The plaintext token is returned by the RPC exactly ONCE and only the sha256
 * hash is stored. That is why the link is shown in a copy box here and can
 * never be retrieved again: if it could be, a leaked database would be a set of
 * working keys to every family in the system.
 */

const ROLES: Array<{ value: FamilyRole; label: string; detail: string }> = [
  { value: 'viewer', label: 'Үзэгч', detail: 'Зөвхөн харна' },
  { value: 'contributor', label: 'Хувь нэмэр', detail: 'Дурсамж, зураг нэмнэ' },
  { value: 'editor', label: 'Засварлагч', detail: 'Хүн, хос, хамаарал засна' },
  { value: 'admin', label: 'Админ', detail: 'Гишүүд, урилгыг удирдана' },
];

export function InviteManager({
  familyId,
  pending,
}: {
  familyId: string;
  pending: Array<{ id: string; email: string | null; role: string; expiresAt: string }>;
}) {
  const router = useRouter();
  const [role, setRole] = useState<FamilyRole>('contributor');
  const [email, setEmail] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invite = async () => {
    setLoading(true);
    setError(null);
    setLink(null);

    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc('create_invitation', {
      p_family_id: familyId,
      p_role: role,
      p_email: email.trim() || null,
    });

    const row = Array.isArray(data) ? data[0] : null;
    if (rpcError || !row) {
      setError(describeRpcError(rpcError, 'Урилга үүсгэхэд алдаа гарлаа.'));
      setLoading(false);
      return;
    }

    setLink(`${window.location.origin}/invite/${row.token}`);
    setEmail('');
    setLoading(false);
    router.refresh();
  };

  const revoke = async (invitationId: string) => {
    const supabase = createClient();
    await supabase.from('invitations')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', invitationId);
    router.refresh();
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-3">
      <Card className="space-y-3.5">
        <SelectField
          label="Ямар эрхээр урих вэ?"
          value={role}
          onChange={(event) => setRole(event.target.value as FamilyRole)}
          hint={ROLES.find((entry) => entry.value === role)?.detail}
        >
          {ROLES.map((entry) => (
            <option key={entry.value} value={entry.value}>{entry.label}</option>
          ))}
        </SelectField>

        <TextField
          label="Имэйл"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Заавал биш"
          hint="Хоосон орхивол холбоосыг өөрөө хуваалцаж болно."
        />

        {error ? (
          <p role="alert" className="rounded-xl bg-danger-wash px-3 py-2.5 text-sm text-danger">{error}</p>
        ) : null}

        <Button onClick={invite} loading={loading}>Урилга үүсгэх</Button>
      </Card>

      {link ? (
        <Card className="border-sage/30 bg-sage-wash">
          <p className="text-sm font-medium text-ink">Урилгын холбоос бэлэн</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">
            Энэ холбоос дахин харагдахгүй. Одоо хуулж аваад тухайн хүнд илгээнэ үү.
          </p>
          <p className="mt-2.5 break-all rounded-xl border border-line bg-surface px-3 py-2.5 text-xs text-ink-soft">
            {link}
          </p>
          <Button className="mt-2.5" variant="secondary" onClick={copy}>
            {copied ? 'Хуулагдлаа' : 'Холбоосыг хуулах'}
          </Button>
        </Card>
      ) : null}

      {pending.length > 0 ? (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {pending.map((invitation) => (
              <li key={invitation.id} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">
                    {invitation.email ?? 'Холбоосоор урих'}
                  </span>
                  <span className="block text-xs text-muted">
                    Дуусах: {new Date(invitation.expiresAt).toLocaleDateString('mn-MN')}
                  </span>
                </span>
                <Badge tone="olive">{roleLabel(invitation.role)}</Badge>
                <button
                  type="button"
                  onClick={() => revoke(invitation.id)}
                  className="shrink-0 text-xs font-medium text-danger"
                >
                  Цуцлах
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function roleLabel(role: string): string {
  return ROLES.find((entry) => entry.value === role)?.label ?? role;
}
