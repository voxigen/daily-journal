import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import HistoryView from '@/components/HistoryView';

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: tasks } = await supabase
    .from('day_tasks')
    .select('date, title, template_color, template_icon, duration_minutes')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .order('created_at', { ascending: true });

  // Group tasks by date
  const daysMap = new Map<string, typeof tasks>();
  for (const task of tasks ?? []) {
    if (!daysMap.has(task.date)) daysMap.set(task.date, []);
    daysMap.get(task.date)!.push(task);
  }

  const days = Array.from(daysMap.entries()).map(([date, t]) => ({ date, tasks: t! }));
  const totalTasks = tasks?.length ?? 0;

  return <HistoryView days={days} totalDays={days.length} totalTasks={totalTasks} />;
}
