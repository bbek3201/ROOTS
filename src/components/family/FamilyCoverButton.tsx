'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { uploadToArchive } from '@/lib/media/upload-client';
import { describeRpcError } from '@/lib/supabase/errors';
import { cn } from '@/lib/cn';

/**
 * Choosing the photograph the whole family is shown under.
 *
 * One control, and it does the whole job: pick a file, it uploads into the
 * archive like any other photograph and is then pinned as the family's cover.
 * The picture is not a separate kind of object with its own storage — it lands
 * in `media` under this family, which means it obeys the same access rules and
 * can later be found, captioned or removed like anything else.
 *
 * Deliberately quiet: it sits over the photograph as a single line of type and
 * only becomes visible on hover or focus, because this is a control an editor
 * uses twice a year on a screen everyone else is reading.
 */
export function FamilyCoverButton({
  familyId,
  hasCover,
  className,
}: {
  familyId: string;
  hasCover: boolean;
  className?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const uploaded = await uploadToArchive({ file, filename: file.name, scope: 'photos' });

      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc('set_family_cover', {
        p_family_id: familyId,
        p_media_id: uploaded.mediaId,
      });
      if (rpcError) throw rpcError;

      router.refresh();
    } catch (caught) {
      setError(
        describeRpcError(
          caught,
          caught instanceof Error ? caught.message : 'Зураг тавихад алдаа гарлаа.',
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    if (!window.confirm('Гэр бүлийн нүүр зургийг авах уу?')) return;
    setBusy(true);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc('set_family_cover', {
      p_family_id: familyId,
      p_media_id: null,
    });
    if (rpcError) setError(describeRpcError(rpcError, 'Зургийг авахад алдаа гарлаа.'));
    else router.refresh();
    setBusy(false);
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="sr-only-text"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void choose(file);
        }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="rounded-full border border-white/35 bg-black/20 px-4 py-2 text-[0.8rem] text-[#fbf9f4] backdrop-blur-md transition-colors hover:bg-black/35 disabled:opacity-60"
      >
        {busy ? 'Байршуулж байна…' : hasCover ? 'Нүүр зураг солих' : 'Нүүр зураг оруулах'}
      </button>

      {hasCover && !busy ? (
        <button
          type="button"
          onClick={clear}
          className="rounded-full px-3 py-2 text-[0.8rem] text-[rgb(251_249_244/0.72)] transition-colors hover:text-[#fbf9f4]"
        >
          Авах
        </button>
      ) : null}

      {error ? (
        <p role="alert" className="w-full rounded-xl bg-black/45 px-3 py-2 text-[0.8rem] text-[#fbf9f4]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
