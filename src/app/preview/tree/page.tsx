import { AppShell, PagePlate } from '@/components/nav/AppShell';
import { Rail, RailCard, RailCta, RailRow } from '@/components/nav/Rail';
import { BookIcon, ImageIcon, MicIcon } from '@/components/icons';
import { HeritageTree } from '@/components/tree/HeritageTree';
import { FAMILY_NAME, FAMILY_STORY, HERITAGE_LEVELS, SCENES, VIEWER } from '@/app/preview/fixture';

const META = '7 үе · 128 хүн · 1918 оноос';

/** The tree, on the desk, with the rail beside it. */
export default function PreviewHeritageTree() {
  return (
    <AppShell viewer={VIEWER} family={FAMILY_NAME} vista={SCENES[0]} layout="self">
      <PagePlate>
        <section className="relative isolate flex min-h-[clamp(16rem,42svh,26rem)] items-end overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element -- fixture file in /public. */}
          <img src={SCENES[2]} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-[rgb(10_26_21/0.82)] via-[rgb(10_26_21/0.34)] to-transparent"
          />
          <div className="rt-gutters relative w-full pt-20 pb-8">
            <p className="text-[0.68rem] font-medium uppercase tracking-[0.3em] text-[rgb(251_249_244/0.74)]">
              {META}
            </p>
            <h1 className="ed-display mt-3 text-[clamp(1.9rem,3vw,2.9rem)] text-[#fbf9f4]">
              {FAMILY_NAME}
            </h1>
          </div>
        </section>

        <HeritageTree levels={HERITAGE_LEVELS} deeper={14} canEdit hasStory meta={META}>
          <div className="flex h-full items-center justify-center text-sm text-muted">
            (pan/zoom canvas)
          </div>
        </HeritageTree>
      </PagePlate>

      <Rail>
        <RailCard title="Гэр бүлийн түүх" href="#" linkLabel="Бүтнээр">
          <div className="px-5 pb-5">
            <p className="whitespace-pre-line text-[0.95rem] leading-relaxed text-ink-soft">
              {FAMILY_STORY.split('\n\n').slice(0, 2).join('\n\n')}
            </p>
          </div>
        </RailCard>

        <div className="rt-rail-card overflow-hidden">
          <RailRow href="#" icon={BookIcon} title="Он цагийн хэлхээ" note={META} />
          <RailRow href="#" icon={MicIcon} title="Дуу хоолойн архив" note="Ахмадуудынхаа түүхийг сонс" />
          <RailRow href="#" icon={ImageIcon} title="Зураг ба бичлэг" note="Бүх дурсамж" />
        </div>

        <RailCta href="#">
          Дутуу хүнээ
          <br />
          модондоо нэм
        </RailCta>
      </Rail>
    </AppShell>
  );
}
