'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { describeRpcError } from '@/lib/supabase/errors';
import { cn } from '@/lib/cn';

/**
 * Writing the family's own words about itself.
 *
 * The name and the story are the only text on the tree page that is not derived
 * from the graph — everything else is a date, a count or a person — so this is
 * the one place a family says who they are in their own voice. That makes it
 * worth an editor rather than a settings field buried three screens away: the
 * person who started the archive should be able to write it while looking at
 * the photograph it sits under.
 *
 * It writes straight to the `families` row. No RPC is involved because none is
 * needed: the table's own policy already restricts updates to admins, so the
 * database enforces the same rule this button is shown by.
 */
export function FamilyStoryEditor({
  familyId,
  name,
  story,
  variant = 'onPhotograph',
  label,
}: {
  familyId: string;
  name: string;
  story: string;
  /** On the cover the control is light; in the story section it is ink. */
  variant?: 'onPhotograph' | 'onPaper';
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [draftStory, setDraftStory] = useState(story);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = draftName.trim();
    if (trimmed.length === 0) {
      setError('Гэр бүлийн нэрийг хоосон үлдээж болохгүй.');
      return;
    }

    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from('families')
      .update({ name: trimmed, description: draftStory.trim() || null })
      .eq('id', familyId);

    if (updateError) {
      setError(describeRpcError(updateError, 'Хадгалахад алдаа гарлаа. Дахин оролдоно уу.'));
      setSaving(false);
      return;
    }

    setSaving(false);
    setOpen(false);
    router.refresh();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraftName(name);
          setDraftStory(story);
          setOpen(true);
        }}
        className={cn(
          'rounded-full px-4 py-2 text-[0.8rem] transition-colors',
          variant === 'onPhotograph'
            ? 'border border-white/35 bg-black/20 text-[#fbf9f4] backdrop-blur-md hover:bg-black/35'
            : 'border border-[color-mix(in_srgb,#183b32_16%,transparent)] text-[color-mix(in_srgb,#183b32_70%,transparent)] hover:border-[#183b32] hover:text-[#183b32]',
        )}
      >
        {label ?? 'Нэр, түүхийг засах'}
      </button>
    );
  }

  return (
    <form
      onSubmit={save}
      className="w-full max-w-xl rounded-[24px] border border-[color-mix(in_srgb,#183b32_12%,transparent)] bg-[#fffcf8]/97 p-5 shadow-[0_30px_70px_-40px_rgba(24,59,50,0.55)] backdrop-blur-xl sm:p-6"
    >
      <label className="block">
        <span className="ed-eyebrow">Гэр бүлийн нэр</span>
        <input
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          maxLength={160}
          required
          autoFocus
          className="mt-2.5 w-full rounded-2xl border border-[color-mix(in_srgb,#183b32_12%,transparent)] bg-white px-4 py-3 font-display text-[1.15rem] tracking-[-0.03em] text-[#183b32] focus:border-[color-mix(in_srgb,#183b32_40%,transparent)] focus:outline-none"
        />
      </label>

      <label className="mt-5 block">
        <span className="ed-eyebrow">Гэр бүлийн түүх</span>
        <textarea
          value={draftStory}
          onChange={(event) => setDraftStory(event.target.value)}
          rows={7}
          placeholder="Хаанаас гаралтай, хэн хэнээс эхэлсэн, юугаараа онцлог гэр бүл вэ? Хүссэн хэмжээгээрээ бичээрэй."
          className="mt-2.5 w-full resize-y rounded-2xl border border-[color-mix(in_srgb,#183b32_12%,transparent)] bg-white px-4 py-3 text-[16px] leading-relaxed text-[#183b32] placeholder:text-[color-mix(in_srgb,#183b32_38%,transparent)] focus:border-[color-mix(in_srgb,#183b32_40%,transparent)] focus:outline-none"
        />
        <span className="mt-2 block text-[0.78rem] text-[color-mix(in_srgb,#183b32_50%,transparent)]">
          Мөр таслалт хадгалагдана. Энэ текст модны дээр, гэр бүлийн зургийн доор харагдана.
        </span>
      </label>

      {error ? (
        <p role="alert" className="mt-4 rounded-xl bg-danger-wash px-3 py-2.5 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={saving}
          className="min-h-12 rounded-full bg-[#183b32] px-6 text-[0.92rem] text-[#fbf9f4] transition-colors hover:bg-[#12302a] disabled:opacity-60"
        >
          {saving ? 'Хадгалж байна…' : 'Хадгалах'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-12 rounded-full px-5 text-[0.92rem] text-[color-mix(in_srgb,#183b32_62%,transparent)] transition-colors hover:text-[#183b32]"
        >
          Болих
        </button>
      </div>
    </form>
  );
}
