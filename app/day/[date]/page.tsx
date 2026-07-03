import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { formatDateRu, addDays } from '@/lib/utils';
import DayView from '@/components/DayView';
import AppShell from '@/components/AppShell';

export default async function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const tomorrow = addDays(date, 1);

  const [
    { data: day },
    { data: tasks },
    { data: planned },
    { data: templates },
    { data: products },
    { data: prevW },
  ] = await Promise.all([
    supabase.from('daily_days').select('*').eq('user_id', user.id).eq('date', date).maybeSingle(),
    supabase.from('day_tasks').select('*').eq('user_id', user.id).eq('date', date).order('created_at'),
    supabase.from('planned_tasks').select('*').eq('user_id', user.id).in('date', [date, tomorrow]).order('created_at'),
    supabase.from('templates').select('*').eq('user_id', user.id).order('created_at'),
    supabase.from('products').select('id, name, kcal_per_gram').eq('user_id', user.id).order('name'),
    supabase.from('daily_days').select('weight').eq('user_id', user.id).lt('date', date).not('weight', 'is', null).order('date', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const all = planned ?? [];

  return (
    <AppShell title={formatDateRu(date)}>
      <DayView
        userId={user.id}
        date={date}
        initialTasks={tasks ?? []}
        initialDay={day ?? null}
        initialPlannedToday={all.filter((p) => p.date === date)}
        initialPlannedTomorrow={all.filter((p) => p.date === tomorrow)}
        templates={templates ?? []}
        initialProducts={products ?? []}
        prevWeight={prevW?.weight ?? null}
        backHref="/history"
      />
    </AppShell>
  );
}
