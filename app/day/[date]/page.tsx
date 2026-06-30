import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { formatDateRu } from '@/lib/utils';
import DayView from '@/components/DayView';
import AppShell from '@/components/AppShell';

function prevDateStr(date: string): string {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export default async function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const prev = prevDateStr(date);

  const [
    { data: day },
    { data: prevDay },
    { data: tasks },
    { data: templates },
  ] = await Promise.all([
    supabase.from('daily_days').select('*').eq('user_id', user.id).eq('date', date).maybeSingle(),
    supabase.from('daily_days').select('planned_next').eq('user_id', user.id).eq('date', prev).maybeSingle(),
    supabase.from('day_tasks').select('*').eq('user_id', user.id).eq('date', date).order('created_at'),
    supabase.from('templates').select('*').eq('user_id', user.id).order('created_at'),
  ]);

  return (
    <AppShell date={formatDateRu(date)}>
      <DayView
        userId={user.id}
        date={date}
        displayDate={formatDateRu(date)}
        initialTasks={tasks ?? []}
        initialDay={day ?? null}
        plannedFromYesterday={prevDay?.planned_next ?? null}
        templates={templates ?? []}
        backHref="/history"
      />
    </AppShell>
  );
}
