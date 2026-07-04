import { todayStr } from '@/lib/utils';
import { getTz } from '@/lib/tz';
import { requireUserId } from '@/lib/session';
import { getStatsData } from '@/lib/queries';
import StatsView from '@/components/StatsView';

export default async function StatsPage() {
  const uid = await requireUserId();
  const { tasks, days } = await getStatsData(uid);

  // Sum calories per day from the stored meals for long-term tracking.
  const kcalByDate: Record<string, number> = {};
  const weightByDate: Record<string, number> = {};
  for (const d of days) {
    const meals = Array.isArray(d.meals) ? (d.meals as { items?: { kcal?: number | string }[] }[]) : [];
    let k = 0;
    for (const m of meals) for (const it of m.items ?? []) k += Number(it.kcal) || 0;
    if (k > 0) kcalByDate[d.date] = k;
    if (typeof d.weight === 'number' && d.weight > 0) weightByDate[d.date] = d.weight;
  }

  return (
    <StatsView
      today={todayStr(await getTz())}
      tasks={tasks}
      dayDates={days.map((d) => d.date)}
      kcalByDate={kcalByDate}
      weightByDate={weightByDate}
    />
  );
}
