import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { todayStr } from '@/lib/utils';
import { getTz } from '@/lib/tz';
import StatsView from '@/components/StatsView';

export default async function StatsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: tasks }, { data: days }] = await Promise.all([
    supabase.from('day_tasks').select('date, template_name, template_color, template_icon, duration_minutes').eq('user_id', user.id),
    supabase.from('daily_days').select('date').eq('user_id', user.id),
  ]);

  return (
    <StatsView
      today={todayStr(await getTz())}
      tasks={tasks ?? []}
      dayDates={(days ?? []).map((d) => d.date as string)}
    />
  );
}
