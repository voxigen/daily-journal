import { todayStr, addDays, mondayIndex } from '@/lib/utils';
import { getTz } from '@/lib/tz';
import { requireUserId } from '@/lib/session';
import { getPlanned, getTemplates } from '@/lib/queries';
import WeekView from '@/components/WeekView';
import AppShell from '@/components/AppShell';

export default async function WeekPage({ searchParams }: { searchParams: { offset?: string } }) {
  const uid = await requireUserId();
  const today = todayStr(await getTz());
  // offset — сдвиг недель от текущей (0 = эта неделя, +1 = следующая, …).
  const offset = Math.trunc(Number(searchParams.offset) || 0);
  const weekStart = addDays(addDays(today, -mondayIndex(today)), offset * 7);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const [planned, templates] = await Promise.all([
    getPlanned(uid, dates),
    getTemplates(uid),
  ]);

  return (
    <AppShell title="Неделя" subtitle="Календарь планов">
      <WeekView today={today} offset={offset} dates={dates} initialPlanned={planned} templates={templates} />
    </AppShell>
  );
}
