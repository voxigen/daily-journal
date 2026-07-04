import { requireUserId } from '@/lib/session';
import { getTemplates } from '@/lib/queries';
import TemplatesView from '@/components/TemplatesView';

export default async function TemplatesPage() {
  const uid = await requireUserId();
  const templates = await getTemplates(uid);
  return <TemplatesView userId={uid} initialTemplates={templates} />;
}
