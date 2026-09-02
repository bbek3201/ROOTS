'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { SparkIcon } from '@/components/icons';

/**
 * The natural-language family assistant.
 *
 * The badge on each answer is the important detail: "Өгөгдлийн сангаас" means
 * the relationship graph computed it and it is exact; "AI" means a model only
 * phrased facts the database supplied. An answer is never presented without
 * saying which of the two it was, and "not recorded" is shown as a real answer
 * rather than being papered over.
 */

const SUGGESTIONS = [
  'Аавын минь аав хэн бэ?',
  'Элэнц эмээ минь хэн бэ?',
  'Өвөөгийн минь хүүхдүүд хэн бэ?',
  'Би Доржтой ямар хамааралтай вэ?',
];

interface Answer {
  source: 'database' | 'ai';
  answer: string;
  facts: string[];
  unknown: boolean;
  isMock: boolean;
  people: Array<{ id: string; name: string; birthDate: string | null; deathDate: string | null }>;
}

export function AssistantPanel() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = async (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < 2) return;

    setLoading(true);
    setError(null);
    setAnswer(null);

    const response = await fetch('/api/ai/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: trimmed }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? 'Хариулт авахад алдаа гарлаа.');
      setLoading(false);
      return;
    }

    setAnswer((await response.json()) as Answer);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <form
        onSubmit={(event) => { event.preventDefault(); void ask(question); }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Гэр бүлийнхээ талаар асуугаарай…"
          aria-label="Гэр бүлийн талаар асуух"
          className="min-h-12 flex-1 rounded-full border border-line bg-surface px-4 text-[16px] text-ink placeholder:text-muted/70 focus:border-ember focus:outline-none"
        />
        <Button type="submit" loading={loading} disabled={question.trim().length < 2}>
          Асуух
        </Button>
      </form>

      {!answer && !loading ? (
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => { setQuestion(suggestion); void ask(suggestion); }}
              className="rounded-pill border border-line bg-surface px-3 py-1.5 text-sm text-ink-soft"
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-xl bg-danger-wash px-3 py-2.5 text-sm text-danger">{error}</p>
      ) : null}

      {answer ? (
        <Card className={answer.unknown ? 'border-gold/30 bg-gold-wash' : ''}>
          <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
            {answer.source === 'database' ? (
              <Badge tone="sage">Өгөгдлийн сангаас тооцоолсон</Badge>
            ) : (
              <Badge tone="ember" icon={<SparkIcon size={12} />}>
                {answer.isMock ? 'AI (туршилтын горим)' : 'AI-аар үгчилсэн'}
              </Badge>
            )}
            {answer.unknown ? <Badge tone="gold">Мэдээлэл дутуу</Badge> : null}
          </div>

          <p className="whitespace-pre-line text-[0.98rem] leading-relaxed text-ink">{answer.answer}</p>

          {answer.people.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {answer.people.map((person) => (
                <li key={person.id}>
                  <Link
                    href={`/person/${person.id}`}
                    className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5"
                  >
                    <span className="text-sm font-medium text-ink">{person.name}</span>
                    <span className="text-xs text-muted">
                      {[person.birthDate?.slice(0, 4), person.deathDate?.slice(0, 4)]
                        .filter(Boolean).join(' – ')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}

          {answer.unknown ? (
            <p className="mt-3 text-xs leading-relaxed text-muted">
              ROOTS зөвхөн архивт хадгалагдсан мэдээллээр хариулдаг. Мэдэхгүй зүйлээ таамаглаж
              хэлдэггүй — тиймээс энэ хариулт «мэдэгдэхгүй» гэж гарч байна.
            </p>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
