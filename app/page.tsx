import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { todayStr, addDays, formatDateRu } from '@/lib/utils';
import { getTz } from '@/lib/tz';
import DayView from '@/components/DayView';
import AppShell from '@/components/AppShell';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const today = todayStr(await getTz());
  const tomorrow = addDays(today, 1);

  const [
    { data: todayDay },
    { data: tasks },
    { data: planned },
    { data: templates },
    { data: recurring },
    { data: products },
  ] = await Promise.all([
    supabase.from('daily_days').select('*').eq('user_id', user.id).eq('date', today).maybeSingle(),
    supabase.from('day_tasks').select('*').eq('user_id', user.id).eq('date', today).order('created_at'),
    supabase.from('planned_tasks').select('*').eq('user_id', user.id).in('date', [today, tomorrow]).order('created_at'),
    supabase.from('templates').select('*').eq('user_id', user.id).order('created_at'),
    supabase.from('recurring_plans').select('*').eq('user_id', user.id).eq('active', true).order('created_at'),
    supabase.from('products').select('id, name, kcal_per_gram').eq('user_id', user.id).order('name'),
  ]);

  const all = planned ?? [];

  return (
    <AppShell title="Сегодня" subtitle={formatDateRu(today)}>
      <DayView
        userId={user.id}
        date={today}
        initialTasks={tasks ?? []}
        initialDay={todayDay ?? null}
        initialPlannedToday={all.filter((p) => p.date === today)}
        initialPlannedTomorrow={all.filter((p) => p.date === tomorrow)}
        templates={templates ?? []}
        initialRecurring={recurring ?? []}
        initialProducts={products ?? []}
      />
    </AppShell>
  );
}
