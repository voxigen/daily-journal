import { notFound } from 'next/navigation';
import { todayStr } from '@/lib/utils';
import { getTz } from '@/lib/tz';
import { requireUserId } from '@/lib/session';
import { getTemplate, getTemplateTasks } from '@/lib/queries';
import TemplateDashboard from '@/components/TemplateDashboard';

export default async function TemplateStatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const uid = await requireUserId();
  const template = await getTemplate(uid, id);
  if (!template) notFound();

  const tasks = await getTemplateTasks(uid, id);

  return <TemplateDashboard template={template} tasks={tasks} today={todayStr(await getTz())} />;
}
