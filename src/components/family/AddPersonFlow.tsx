'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { buildFamilyIndex, getCouples } from '@/lib/relationships/graph';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SelectField, TextField } from '@/components/ui/Field';
import { Avatar } from '@/components/ui/Avatar';
import { displayName, lifespan } from '@/lib/format';
import type { FamilyGraph } from '@/lib/relationships/types';
import { cn } from '@/lib/cn';

/**
 * Guided "add a person" flow.
 *
 * The first question is not "what is their name" but "who are they to someone
 * already here" — because that single answer is what lets ROOTS derive every
 * other relationship instead of asking for it. Adding a child to a couple
 * creates the parent links, the sibling links and the generation in one write.
 *
 * The alternative — a blank person form followed by a relationship builder — is
 * how genealogy software makes people feel like they are doing data entry.
 */

type Relation = 'first' | 'child' | 'partner' | 'parent';

export function AddPersonFlow({ familyId, graph }: { familyId: string; graph: FamilyGraph }) {
  const router = useRouter();
  const index = useMemo(() => buildFamilyIndex(graph), [graph]);
  const hasPeople = graph.people.length > 0;

  const [relation, setRelation] = useState<Relation>(hasPeople ? 'child' : 'first');
  const [anchorId, setAnchorId] = useState<string>('');
  const [coupleId, setCoupleId] = useState<string>('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | 'unknown'>('unknown');
  const [birthYear, setBirthYear] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const people = useMemo(
    () => [...index.people.values()].sort((a, b) => (a.generation ?? 9) - (b.generation ?? 9)),
    [index],
  );

  const anchorCouples = useMemo(
    () => (anchorId ? getCouples(index, anchorId) : []),
    [index, anchorId],
  );

  const birthDate = /^\d{4}$/.test(birthYear.trim()) ? `${birthYear.trim()}-01-01` : null;

  const submit = async () => {
    if (firstName.trim().length === 0) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();

    try {
      // --- child of an existing couple ---------------------------------------
      if (relation === 'child') {
        let targetCoupleId = coupleId;

        // A single parent with no recorded partner still needs a couple to hang
        // the child from — create a one-partner couple rather than refusing.
        if (!targetCoupleId && anchorId) {
          const { data: created, error: coupleError } = await supabase.rpc('create_couple', {
            p_family_id: familyId,
            p_person_one: anchorId,
            p_person_two: null,
          });
          if (coupleError || !created) throw new Error(coupleError?.message ?? 'couple');
          targetCoupleId = created;
        }

        if (!targetCoupleId) throw new Error('couple-missing');

        const { data: childId, error: childError } = await supabase.rpc('add_child_to_couple', {
          p_couple_id: targetCoupleId,
          p_first_name: firstName.trim(),
          p_last_name: lastName.trim() || null,
          p_gender: gender,
          p_birth_date: birthDate,
        });
        if (childError || !childId) throw new Error(childError?.message ?? 'child');
        router.push(`/person/${childId}`);
        return;
      }

      // --- everything else starts by creating the person ---------------------
      const { data: personId, error: personError } = await supabase.rpc('add_person', {
        p_family_id: familyId,
        p_first_name: firstName.trim(),
        p_last_name: lastName.trim() || null,
        p_gender: gender,
        p_birth_date: birthDate,
      });
      if (personError || !personId) throw new Error(personError?.message ?? 'person');

      if (relation === 'partner' && anchorId) {
        const { error: coupleError } = await supabase.rpc('create_couple', {
          p_family_id: familyId,
          p_person_one: anchorId,
          p_person_two: personId,
        });
        if (coupleError) throw new Error(coupleError.message);
      }

      if (relation === 'parent' && anchorId) {
        const { error: parentError } = await supabase.rpc('add_parent_couple', {
          p_family_id: familyId,
          p_child_id: anchorId,
          p_parent_one_id: personId,
        });
        if (parentError) throw new Error(parentError.message);
      }

      router.push(`/person/${personId}`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '';
      setError(
        message.includes('permission') || message.includes('42501')
          ? 'Танд хүн нэмэх эрх байхгүй байна.'
          : message.includes('ancestor')
            ? 'Энэ холболт нь хүнийг өөрийнх нь өвөг дээдэс болгож байна.'
            : 'Хадгалахад алдаа гарлаа. Дахин оролдоно уу.',
      );
      setSaving(false);
    }
  };

  const needsAnchor = relation !== 'first';
  const canSubmit =
    firstName.trim().length > 0 && (!needsAnchor || anchorId.length > 0) && !saving;

  return (
    <div className="space-y-4">
      {hasPeople ? (
        <Card>
          <p className="mb-3 text-sm font-medium text-ink-soft">Энэ хүн хэн бэ?</p>
          <div className="grid grid-cols-2 gap-2">
            <RelationChoice
              active={relation === 'child'} onClick={() => setRelation('child')}
              title="Хүүхэд" detail="Хосын хүүхэд"
            />
            <RelationChoice
              active={relation === 'partner'} onClick={() => setRelation('partner')}
              title="Хань" detail="Хэн нэгний эхнэр/нөхөр"
            />
            <RelationChoice
              active={relation === 'parent'} onClick={() => setRelation('parent')}
              title="Эцэг/эх" detail="Хэн нэгний аав, ээж"
            />
            <RelationChoice
              active={relation === 'first'} onClick={() => setRelation('first')}
              title="Холбоогүй" detail="Дараа холбоно"
            />
          </div>
        </Card>
      ) : (
        <Card className="border-gold/30 bg-gold-wash">
          <p className="font-display text-base text-ink">Эхний хүн</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            Хамгийн ахмад мэдэх хүнээсээ эхлэхийг зөвлөж байна — өвөө, элэнц өвөө. Тэндээс доош
            хос, хүүхдүүдийг нэмэхэд мод өөрөө ургана.
          </p>
        </Card>
      )}

      {needsAnchor ? (
        <Card className="space-y-3.5">
          <SelectField
            label={
              relation === 'child' ? 'Аль эцэг эхийн хүүхэд вэ?'
                : relation === 'partner' ? 'Хэний хань вэ?'
                : 'Хэний эцэг/эх вэ?'
            }
            value={anchorId}
            onChange={(event) => { setAnchorId(event.target.value); setCoupleId(''); }}
            required
          >
            <option value="">— Хүн сонгох —</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {displayName(person)} {lifespan(person) ? `(${lifespan(person)})` : ''}
              </option>
            ))}
          </SelectField>

          {relation === 'child' && anchorId ? (
            anchorCouples.length > 0 ? (
              <SelectField
                label="Аль хосын хүүхэд вэ?"
                value={coupleId}
                onChange={(event) => setCoupleId(event.target.value)}
                hint="Хос сонгосноор ах дүү, өвөө эмээгийн хамаарал зөв тооцогдоно."
              >
                <option value="">— Хос сонгох —</option>
                {anchorCouples.map((couple) => {
                  const partnerId = couple.person_a_id === anchorId ? couple.person_b_id : couple.person_a_id;
                  const partner = partnerId ? index.people.get(partnerId) : null;
                  return (
                    <option key={couple.id} value={couple.id}>
                      {displayName(index.people.get(anchorId))} ❤ {partner ? displayName(partner) : 'Тодорхойгүй'}
                      {couple.marriage_date ? ` (${couple.marriage_date.slice(0, 4)})` : ''}
                    </option>
                  );
                })}
              </SelectField>
            ) : (
              <p className="rounded-xl bg-gold-wash px-3 py-2.5 text-sm text-ink-soft">
                Энэ хүнд хос бүртгэгдээгүй байна. Хадгалахад ганц эцэг/эхтэй хос автоматаар үүсгэж,
                хүүхдийг холбоно. Дараа нь ханийг нь нэмж болно.
              </p>
            )
          ) : null}

          {anchorId ? (
            <div className="flex items-center gap-2.5 rounded-xl bg-parchment-deep px-3 py-2.5">
              <Avatar person={index.people.get(anchorId)} size="xs" />
              <span className="text-sm text-ink-soft">
                {displayName(index.people.get(anchorId))}
              </span>
            </div>
          ) : null}
        </Card>
      ) : null}

      <Card className="space-y-3.5">
        <TextField
          label="Нэр"
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          placeholder="Жишээ: Дорж"
          required
        />
        <TextField
          label="Овог"
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
          placeholder="Заавал биш"
          hint="Хүүхэд нэмэх үед аавын нэрээр автоматаар бөглөгдөнө."
        />
        <SelectField
          label="Хүйс"
          value={gender}
          onChange={(event) => setGender(event.target.value as typeof gender)}
          hint="Монгол хэлний ах/эгч/дүү, ач/зээ гэх мэт нэршлийг зөв тодорхойлоход хэрэгтэй."
        >
          <option value="unknown">Тодорхойгүй</option>
          <option value="male">Эрэгтэй</option>
          <option value="female">Эмэгтэй</option>
          <option value="other">Бусад</option>
        </SelectField>
        <TextField
          label="Төрсөн он"
          value={birthYear}
          onChange={(event) => setBirthYear(event.target.value.replace(/\D/g, '').slice(0, 4))}
          inputMode="numeric"
          placeholder="1930"
          hint="Мэдэхгүй бол хоосон орхиж болно."
        />
      </Card>

      {error ? (
        <p role="alert" className="rounded-xl bg-danger-wash px-3 py-2.5 text-sm text-danger">{error}</p>
      ) : null}

      <Button size="lg" fullWidth onClick={submit} loading={saving} disabled={!canSubmit}>
        Хадгалах
      </Button>
    </div>
  );
}

function RelationChoice({
  active, onClick, title, detail,
}: {
  active: boolean; onClick: () => void; title: string; detail: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'min-h-16 rounded-2xl border px-3 py-2.5 text-left transition-colors',
        active ? 'border-ember bg-ember-wash' : 'border-line bg-surface',
      )}
    >
      <span className={cn('block text-sm font-medium', active ? 'text-ember' : 'text-ink')}>{title}</span>
      <span className="block text-xs text-muted">{detail}</span>
    </button>
  );
}
