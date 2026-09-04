import { HeritageTree } from '@/components/tree/HeritageTree';
import { HERITAGE_LEVELS } from '@/app/preview/fixture';

export default function PreviewHeritageTree() {
  return (
    <HeritageTree levels={HERITAGE_LEVELS} deeper={14} canEdit hasStory>
      <div className="flex h-full items-center justify-center text-sm text-muted">
        (pan/zoom canvas)
      </div>
    </HeritageTree>
  );
}
