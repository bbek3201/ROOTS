'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { uploadToArchive } from '@/lib/media/upload-client';
import { describeRpcError } from '@/lib/supabase/errors';
import { Button } from '@/components/ui/Button';
import { Photo } from '@/components/ui/Photo';
import { TextAreaField, TextField } from '@/components/ui/Field';
import type { PersonRow } from '@/types/database';

/**
 * Your own page in the archive.
 *
 * The account screen used to be a display name and a dropdown — a login, not a
 * person. But everyone in this product is a person in the tree, and the fastest
 * way to make an archive feel alive is for the people using it to put their own
 * face and their own sentence into it on day one.
 *
 * Three things, in the order they matter: the photograph, the name, the story.
 * All three belong to the PERSON you are linked to, not to the account — your
 * portrait here is the portrait your grandchildren will see on the tree.
 *
 * Saving prefers `update_my_person()`, which lets anybody edit themselves
 * whatever their role. If that function is not in the database yet, it falls
 * back to a direct update, which succeeds for editors — so this screen works
 * before and after that migration is applied, it simply reaches fewer people.
 */
export function MyProfileCard({
  personId,
  personName,
  displayName,
  nickname,
  biography,
  portraitUrl,
}: {
  personId: string;
  personName: string;
  displayName: string;
  nickname: string;
  biography: string;
  portraitUrl: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(displayName);
  const [nick, setNick] = useState(nickname);
  const [story, setStory] = useState(biography);
  const [portrait, setPortrait] = useState(portraitUrl);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = name !== displayName || nick !== nickname || story !== biography;

  /** The RPC first, then the plain update. Whichever the database has. */
  const writePerson = async (fields: { biography?: string; nickname?: string; photoMediaId?: string }) => {
    const supabase = createClient();

    const rpc = await supabase.rpc('update_my_person', {
      p_person_id: personId,
      p_biography: fields.biography ?? null,
      p_nickname: fields.nickname ?? null,
      p_photo_media_id: fields.photoMediaId ?? null,
    });
    if (!rpc.error) return;

    const missing = rpc.error.code === 'PGRST202';
    if (!missing) throw rpc.error;

    // Typed as a person patch rather than a loose record, so a typo in a
    // column name is a compile error instead of a silent no-op.
    const patch: Partial<Pick<PersonRow, 'biography' | 'nickname' | 'profile_photo_media_id'>> = {};
    if (fields.biography !== undefined) patch.biography = fields.biography.trim() || null;
    if (fields.nickname !== undefined) patch.nickname = fields.nickname.trim() || null;
    if (fields.photoMediaId) patch.profile_photo_media_id = fields.photoMediaId;

    const { error: updateError } = await supabase.from('people').update(patch).eq('id', personId);
    if (updateError) throw updateError;
  };

  const uploadPortrait = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadToArchive({
        file,
        filename: file.name,
        scope: 'people',
        scopeId: personId,
        personId,
      });
      await writePerson({ photoMediaId: uploaded.mediaId });
      setPortrait(URL.createObjectURL(file));
      router.refresh();
    } catch (caught) {
      setError(describeRpcError(caught, 'Зураг оруулахад алдаа гарлаа.'));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error('Дахин нэвтэрнэ үү.');

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ display_name: name.trim() || 'Гэр бүлийн гишүүн' })
        .eq('id', auth.user.id);
      if (profileError) throw profileError;

      await writePerson({ biography: story, nickname: nick });

      setSaved(true);
      router.refresh();
    } catch (caught) {
      setError(describeRpcError(caught, 'Хадгалахад алдаа гарлаа.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-7">
      {/* ---- the face ---- */}
      <div className="flex items-center gap-4">
        <Photo
          src={portrait}
          alt={personName}
          ratio="square"
          initial={personName.slice(0, 1)}
          className="w-24 shrink-0 rounded-3xl"
        />
        <div className="min-w-0">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="sr-only-text"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void uploadPortrait(file);
            }}
          />
          <Button
            type="button"
            variant="secondary"
            loading={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {portrait ? 'Зургаа солих' : 'Зургаа тавих'}
          </Button>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Энэ зураг гэр бүлийн модонд, таны нэрийн хажууд харагдана.
          </p>
        </div>
      </div>

      {/* ---- the name ---- */}
      <TextField
        label="Харагдах нэр"
        value={name}
        onChange={(event) => setName(event.target.value)}
        hint="Таны нэмсэн дурсамж, зураг энэ нэрээр тэмдэглэгдэнэ."
        maxLength={120}
      />

      <TextField
        label="Хоч"
        value={nick}
        onChange={(event) => setNick(event.target.value)}
        hint="Гэрийнхэн тань юу гэж дууддаг вэ?"
        maxLength={120}
      />

      {/* ---- the story ---- */}
      <TextAreaField
        label="Миний түүх"
        value={story}
        onChange={(event) => setStory(event.target.value)}
        placeholder="Хаана төрсөн, юу хийдэг, юуг хамгийн их санадаг вэ? Хэдхэн өгүүлбэр ч гэсэн үр хойчид үлдэнэ."
        className="min-h-44"
        hint="Энэ бол таны хуудсан дээрх намтар."
      />

      {error ? (
        <p role="alert" className="rounded-xl bg-danger-wash px-3 py-2.5 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {saved && !dirty ? (
        <p role="status" className="rounded-xl bg-sage-wash px-3 py-2.5 text-sm text-sage">
          Хадгалагдлаа.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <Button onClick={save} loading={saving} disabled={!dirty}>
          Хадгалах
        </Button>
        <Link
          href={`/person/${personId}`}
          className="text-sm text-ink-soft underline decoration-line underline-offset-4 transition-colors hover:text-ink"
        >
          Миний хуудсыг үзэх
        </Link>
      </div>
    </div>
  );
}
