import { requireUserId } from '@/lib/session';
import { getHistory } from '@/lib/queries';
import HistoryView from '@/components/HistoryView';

export default async function HistoryPage() {
  const uid = await requireUserId();
  const tasks = await getHistory(uid);

  // Group tasks by date (already ordered date desc, created asc).
  const daysMap = new Map<string, typeof tasks>();
  for (const task of tasks) {
    if (!daysMap.has(task.date)) daysMap.set(task.date, []);
    daysMap.get(task.date)!.push(task);
  }

  const days = Array.from(daysMap.entries()).map(([date, t]) => ({ date, tasks: t }));

  return <HistoryView days={days} totalDays={days.length} totalTasks={tasks.length} />;
}
