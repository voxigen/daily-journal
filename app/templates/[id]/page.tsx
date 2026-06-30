import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { todayStr } from '@/lib/utils';
import TemplateDashboard from '@/components/TemplateDashboard';

export default async function TemplateStatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: template } = await supabase
    .from('templates')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!template) notFound();

  const { data: tasks } = await supabase
    .from('day_tasks')
    .select('date, title, duration_minutes, fields_data, created_at')
    .eq('user_id', user.id)
    .eq('template_id', id)
    .order('date', { ascending: true })
    .order('created_at', { ascending: true });

  return <TemplateDashboard template={template} tasks={tasks ?? []} today={todayStr()} />;
}
