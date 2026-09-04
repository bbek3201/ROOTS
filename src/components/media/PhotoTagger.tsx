'use client';

import { useMemo, useState } from 'react';
import { describeRpcError } from '@/lib/supabase/errors';

export interface TaggedPerson {
  personId: string;
  name: string;
  suggested: boolean;
  confirmed: boolean;
}

export interface TaggablePerson {
  id: string;
  name: string;
  years: string | null;
}

/**
 * Who is in this photograph.
 *
 * This is the one control that turns a pile of scanned prints into an archive:
 * a name here puts the photo on that person's page forever, without anyone
 * filing it there. So it lives inside the viewer, where the face is actually
 * visible, rather than behind an edit screen the photo would have to be left
 * for.
 *
 * Everything is optimistic. A relative going through eighty photographs from a
 * shoebox should never wait for a round trip between two faces; on failure the
 * name comes back off and says why.
 */
export function PhotoTagger({
  mediaId,
  initial,
  people,
  canTag,
}: {
  mediaId: string;
  initial: TaggedPerson[];
  people: TaggablePerson[];
  canTag: boolean;
}) {
  const [tags, setTags] = useState<TaggedPerson[]>(initial);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const tagged = useMemo(() => new Set(tags.map((tag) => tag.personId)), [tags]);

  const candidates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return people
      .filter((person) => !tagged.has(person.id))
      .filter((person) => !needle || person.name.toLowerCase().includes(needle))
      .slice(0, 40);
  }, [people, tagged, query]);

  async function add(person: TaggablePerson) {
    setError(null);
    setQuery('');
    setPicking(false);
    setTags((current) => [...current, { personId: person.id, name: person.name, suggested: false, confirmed: true }]);
    try {
      const response = await fetch(`/api/media/${mediaId}/tags`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ personId: person.id }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error ?? '');
    } catch (cause) {
      setTags((current) => current.filter((tag) => tag.personId !== person.id));
      setError(describeRpcError(cause, 'Тэмдэглэж чадсангүй. Дахин оролдоно уу.'));
    }
  }

  async function remove(tag: TaggedPerson) {
    setError(null);
    setTags((current) => current.filter((item) => item.personId !== tag.personId));
    try {
      const response = await fetch(`/api/media/${mediaId}/tags`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ personId: tag.personId }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error ?? '');
    } catch (cause) {
      setTags((current) => [...current, tag]);
      setError(describeRpcError(cause, 'Устгаж чадсангүй. Дахин оролдоно уу.'));
    }
  }

  // A viewer with no permission and no names has nothing to say.
  if (!canTag && tags.length === 0) return null;

  return (
    <div className="mt-3">
      <ul className="flex flex-wrap items-center justify-center gap-1.5">
        {tags.map((tag) => (
          <li key={tag.personId}>
            <span
              className={`inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-xs ${
                tag.confirmed ? 'bg-white/15 text-white' : 'border border-dashed border-white/40 text-white/70'
              }`}
            >
              {tag.name}
              {!tag.confirmed ? <span className="text-[0.6rem] text-white/50">?</span> : null}
              {canTag ? (
                <button
                  type="button"
                  onClick={() => void remove(tag)}
                  aria-label={`${tag.name} — тэмдэглэгээг арилгах`}
                  className="-mr-1 h-5 w-5 rounded-full text-white/60 hover:text-white"
                >
                  ✕
                </button>
              ) : null}
            </span>
          </li>
        ))}

        {canTag && !picking ? (
          <li>
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="rounded-pill border border-white/30 px-2.5 py-1 text-xs text-white/80"
            >
              + Хүн тэмдэглэх
            </button>
          </li>
        ) : null}
      </ul>

      {picking ? (
        <div className="mx-auto mt-3 max-w-sm text-left">
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Нэрээр хайх"
            aria-label="Тэмдэглэх хүнийг хайх"
            className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40"
          />
          <ul className="mt-1.5 max-h-52 overflow-y-auto rounded-lg bg-white/5">
            {candidates.length === 0 ? (
              <li className="px-3 py-2.5 text-xs text-white/50">Хүн олдсонгүй.</li>
            ) : (
              candidates.map((person) => (
                <li key={person.id}>
                  <button
                    type="button"
                    onClick={() => void add(person)}
                    className="flex w-full items-baseline gap-2 px-3 py-2.5 text-left text-sm text-white hover:bg-white/10"
                  >
                    <span className="min-w-0 flex-1 truncate">{person.name}</span>
                    {person.years ? <span className="text-[0.65rem] text-white/45">{person.years}</span> : null}
                  </button>
                </li>
              ))
            )}
          </ul>
          <button
            type="button"
            onClick={() => { setPicking(false); setQuery(''); }}
            className="mt-1.5 px-1 text-xs text-white/50"
          >
            Болих
          </button>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-xs text-blush">{error}</p> : null}
    </div>
  );
}
