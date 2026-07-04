import { todayStr, addDays, formatDateRu } from '@/lib/utils';
import { getTz } from '@/lib/tz';
import { requireUserId } from '@/lib/session';
import { getDay, getDayTasks, getPlanned, getTemplates, getRecurring, getProducts, getPrevWeight } from '@/lib/queries';
import DayView from '@/components/DayView';
import AppShell from '@/components/AppShell';

export default async function Home() {
  const uid = await requireUserId();

  const today = todayStr(await getTz());
  const tomorrow = addDays(today, 1);

  const [day, tasks, planned, templates, recurring, products, prevWeight] = await Promise.all([
    getDay(uid, today),
    getDayTasks(uid, today),
    getPlanned(uid, [today, tomorrow]),
    getTemplates(uid),
    getRecurring(uid),
    getProducts(uid),
    getPrevWeight(uid, today),
  ]);

  return (
    <AppShell title="Сегодня" subtitle={formatDateRu(today)}>
      <DayView
        userId={uid}
        date={today}
        initialTasks={tasks}
        initialDay={day}
        initialPlannedToday={planned.filter((p) => p.date === today)}
        initialPlannedTomorrow={planned.filter((p) => p.date === tomorrow)}
        templates={templates}
        initialRecurring={recurring}
        initialProducts={products}
        prevWeight={prevWeight}
      />
    </AppShell>
  );
}
