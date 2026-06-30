import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DayView from '@/components/DayView';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const today = todayStr();
  const yesterday = yesterdayStr();

  const [{ data: todayEntry }, { data: yesterdayEntry }] = await Promise.all([
    supabase
      .from('daily_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle(),
    supabase
      .from('daily_entries')
      .select('planned_next')
      .eq('user_id', user.id)
      .eq('date', yesterday)
      .maybeSingle(),
  ]);

  return (
    <DayView
      userId={user.id}
      date={today}
      initial={todayEntry ?? null}
      plannedFromYesterday={yesterdayEntry?.planned_next ?? null}
    />
  );
}
