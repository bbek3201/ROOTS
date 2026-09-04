'use client';

import { useState } from 'react';
import { uploadToCoupleSpace } from '@/lib/media/couple-upload';

/**
 * One optional photograph, attached to a letter, a place, a first, or a message
 * to the future.
 *
 * Uploads as soon as a file is chosen and hands the id back, rather than
 * waiting for the surrounding form to be submitted. Two reasons: the bytes are
 * the slow part and there is no sense making someone watch them go up after
 * they have finished writing, and a form that fails to save should not also
 * lose the photograph.
 */
export function PhotoAttachment({
  spaceId,
  label = 'Зураг хавсаргах',
  onChange,
}: {
  spaceId: string;
  label?: string;
  onChange: (mediaId: string | null) => void;
}) {
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const choose = async (file: File) => {
    setBusy(true);
    setError(null);
    setProgress('Байршуулж байна…');
    try {
      const uploaded = await uploadToCoupleSpace({
        spaceId,
        file,
        filename: file.name,
        onRetry: () => setProgress('Сүлжээ саатлаа, дахин оролдож байна…'),
      });
      setName(file.name);
      onChange(uploaded.mediaId);
      setProgress(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Байршуулж чадсангүй.');
      setProgress(null);
    } finally {
      setBusy(false);
    }
  };

  if (name) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-sage-wash px-3 py-2.5 text-sm">
        <span className="min-w-0 flex-1 truncate text-sage">{name}</span>
        <button
          type="button"
          onClick={() => { setName(null); onChange(null); }}
          className="shrink-0 text-xs text-muted underline"
        >
          Хасах
        </button>
      </div>
    );
  }

  return (
    <div>
      <label
        className={`flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-dashed border-line px-3 text-sm ${
          busy ? 'text-muted' : 'text-ink-soft'
        }`}
      >
        {progress ?? label}
        <input
          type="file"
          accept="image/*"
          disabled={busy}
          className="sr-only-text"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void choose(file);
          }}
        />
      </label>
      {error ? <p role="alert" className="mt-1.5 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
