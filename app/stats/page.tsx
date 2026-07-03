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
    supabase.from('daily_days').select('date, meals, weight').eq('user_id', user.id),
  ]);

  // Sum calories per day from the stored meals for long-term tracking.
  const kcalByDate: Record<string, number> = {};
  const weightByDate: Record<string, number> = {};
  for (const d of days ?? []) {
    const meals = Array.isArray(d.meals) ? (d.meals as { items?: { kcal?: number | string }[] }[]) : [];
    let k = 0;
    for (const m of meals) for (const it of m.items ?? []) k += Number(it.kcal) || 0;
    if (k > 0) kcalByDate[d.date as string] = k;
    if (typeof d.weight === 'number' && d.weight > 0) weightByDate[d.date as string] = d.weight;
  }

  return (
    <StatsView
      today={todayStr(await getTz())}
      tasks={tasks ?? []}
      dayDates={(days ?? []).map((d) => d.date as string)}
      kcalByDate={kcalByDate}
      weightByDate={weightByDate}
    />
  );
}
