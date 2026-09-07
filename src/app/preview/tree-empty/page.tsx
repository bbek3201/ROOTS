import { HeritageTree } from '@/components/tree/HeritageTree';

/** What a family with nobody in the tree yet actually sees. */
export default function PreviewEmptyTree() {
  return (
    <HeritageTree levels={[]} deeper={0} canEdit hasStory={false} meta="Хараахан хэн ч алга">
      <div />
    </HeritageTree>
  );
}
