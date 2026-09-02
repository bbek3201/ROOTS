import { isSupabaseConfigured } from '@/lib/env';
import { redirect } from 'next/navigation';

/**
 * Shown when ROOTS has no Supabase credentials.
 *
 * A blank crash screen would be the easy option here. This tells the person
 * setting it up exactly what is missing and where to put it, because the first
 * five minutes of a self-hosted archive decide whether it ever gets used.
 */
export default function SetupPage() {
  if (isSupabaseConfigured()) redirect('/');

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-12">
      <p className="font-display text-sm tracking-[0.3em] text-gold">ROOTS</p>
      <h1 className="mt-3 font-display text-3xl leading-tight text-ink">Тохиргоо дутуу байна</h1>
      <p className="mt-3 text-ink-soft">
        ROOTS ажиллахын тулд Supabase холболт шаардлагатай. Төслийн үндсэн хавтсанд{' '}
        <code className="rounded bg-parchment-deep px-1.5 py-0.5 text-sm">.env.local</code> файл
        үүсгээд дараах утгуудыг оруулна уу.
      </p>

      <pre className="mt-5 overflow-x-auto rounded-2xl border border-line bg-surface p-4 text-xs leading-relaxed text-ink-soft">
{`NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>

# Зөвхөн сервер талд. Хөтөч рүү хэзээ ч илгээгддэггүй.
SUPABASE_SERVICE_ROLE_KEY=<service role key>`}
      </pre>

      <div className="card mt-5 p-4">
        <h2 className="font-display text-base text-ink">Дараа нь</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-ink-soft">
          <li><code className="text-xs">supabase db push</code> — өгөгдлийн сан, RLS бодлогуудыг үүсгэнэ.</li>
          <li><code className="text-xs">npm run dev</code> — дахин ажиллуулна.</li>
          <li>Бүртгүүлж, эхний гэр бүлээ үүсгэнэ.</li>
        </ol>
      </div>

      <p className="mt-5 text-sm text-muted">
        AI үйлчилгээ заавал шаардлагагүй. Тохируулаагүй үед ROOTS бүрэн ажиллах бөгөөд AI-тай
        холбоотой хэсгүүд «туршилтын горим» гэж тодоор тэмдэглэгдэнэ.
      </p>
    </main>
  );
}
