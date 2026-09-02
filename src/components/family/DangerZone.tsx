'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/Field';

/**
 * Leaving and deletion.
 *
 * Deleting a family archive is permanent and cascades to every person, memory
 * and recording in it, so it requires typing the family's name — and only the
 * owner can do it. `delete_family` re-checks both server-side; this form is a
 * speed bump, not the guard.
 */
export function DangerZone({
  familyId,
  familyName,
  isOwner,
}: {
  familyId: string;
  familyName: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const leave = async () => {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc('leave_family', { p_family_id: familyId });
    if (rpcError) {
      setError('Гарахад алдаа гарлаа. Эзэн эхлээд эрхээ шилжүүлэх шаардлагатай.');
      setBusy(false);
      return;
    }
    router.replace('/');
    router.refresh();
  };

  const destroy = async () => {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc('delete_family', {
      p_family_id: familyId,
      p_confirm_name: confirmation.trim(),
    });
    if (rpcError) {
      setError('Устгаж чадсангүй. Нэр яг таарч байгаа эсэхийг шалгана уу.');
      setBusy(false);
      return;
    }
    router.replace('/');
    router.refresh();
  };

  return (
    <div className="space-y-3">
      <Card>
        <p className="text-sm font-medium text-ink">Архиваас гарах</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Таны нэмсэн дурсамж, зураг архивт үлдэнэ. Та зөвхөн хандах эрхээ алдана.
        </p>
        <Button className="mt-3" variant="secondary" onClick={leave} loading={busy} disabled={isOwner}>
          {isOwner ? 'Эзэн эхлээд эрхээ шилжүүлнэ' : 'Гарах'}
        </Button>
      </Card>

      {isOwner ? (
        <Card className="border-danger/30 bg-danger-wash">
          <p className="text-sm font-medium text-danger">Архивыг бүрмөсөн устгах</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">
            Бүх хүн, дурсамж, зураг, дуу хоолойн бичлэг устана. Энэ үйлдлийг буцаах боломжгүй.
            Устгахаасаа өмнө архиваа татаж авахыг зөвлөж байна.
          </p>

          <div className="mt-3">
            <TextField
              label="Баталгаажуулахын тулд архивын нэрийг бичнэ үү"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={familyName}
            />
          </div>

          {error ? (
            <p role="alert" className="mt-2 text-sm text-danger">{error}</p>
          ) : null}

          <Button
            className="mt-3"
            variant="danger"
            onClick={destroy}
            loading={busy}
            disabled={confirmation.trim() !== familyName}
          >
            Бүрмөсөн устгах
          </Button>
        </Card>
      ) : null}
    </div>
  );
}
