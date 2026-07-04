import { notFound } from 'next/navigation';
import { formatDateRu, addDays } from '@/lib/utils';
import { requireUserId } from '@/lib/session';
import { getDay, getDayTasks, getPlanned, getTemplates, getProducts, getPrevWeight } from '@/lib/queries';
import DayView from '@/components/DayView';
import AppShell from '@/components/AppShell';

export default async function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const uid = await requireUserId();
  const tomorrow = addDays(date, 1);

  const [day, tasks, planned, templates, products, prevWeight] = await Promise.all([
    getDay(uid, date),
    getDayTasks(uid, date),
    getPlanned(uid, [date, tomorrow]),
    getTemplates(uid),
    getProducts(uid),
    getPrevWeight(uid, date),
  ]);

  return (
    <AppShell title={formatDateRu(date)}>
      <DayView
        userId={uid}
        date={date}
        initialTasks={tasks}
        initialDay={day}
        initialPlannedToday={planned.filter((p) => p.date === date)}
        initialPlannedTomorrow={planned.filter((p) => p.date === tomorrow)}
        templates={templates}
        initialProducts={products}
        prevWeight={prevWeight}
        backHref="/history"
      />
    </AppShell>
  );
}
