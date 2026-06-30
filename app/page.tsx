import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { todayStr, yesterdayStr, formatDateRu } from '@/lib/utils';
import DayView from '@/components/DayView';
import AppShell from '@/components/AppShell';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const today = todayStr();
  const yesterday = yesterdayStr();

  const [
    { data: todayDay },
    { data: yesterdayDay },
    { data: tasks },
    { data: templates },
  ] = await Promise.all([
    supabase.from('daily_days').select('*').eq('user_id', user.id).eq('date', today).maybeSingle(),
    supabase.from('daily_days').select('planned_next').eq('user_id', user.id).eq('date', yesterday).maybeSingle(),
    supabase.from('day_tasks').select('*').eq('user_id', user.id).eq('date', today).order('created_at'),
    supabase.from('templates').select('*').eq('user_id', user.id).order('created_at'),
  ]);

  return (
    <AppShell date={formatDateRu(today)}>
      <DayView
        userId={user.id}
        date={today}
        displayDate={formatDateRu(today)}
        initialTasks={tasks ?? []}
        initialDay={todayDay ?? null}
        plannedFromYesterday={yesterdayDay?.planned_next ?? null}
        templates={templates ?? []}
      />
    </AppShell>
  );
}
