import { requireUserId } from '@/lib/session';
import { getVocab } from '@/lib/queries';
import LearnView from '@/components/LearnView';

export default async function LearnPage() {
  const uid = await requireUserId();
  const cards = await getVocab(uid);
  return <LearnView userId={uid} initialCards={cards} />;
}
