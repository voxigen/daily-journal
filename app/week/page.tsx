import { todayStr, addDays, mondayIndex } from '@/lib/utils';
import { getTz } from '@/lib/tz';
import { requireUserId } from '@/lib/session';
import { getPlanned, getTemplates } from '@/lib/queries';
import WeekView from '@/components/WeekView';
import AppShell from '@/components/AppShell';

export default async function WeekPage() {
  const uid = await requireUserId();
  const today = todayStr(await getTz());
  // Неделя с понедельника текущего дня.
  const weekStart = addDays(today, -mondayIndex(today));
  const dates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const [planned, templates] = await Promise.all([
    getPlanned(uid, dates),
    getTemplates(uid),
  ]);

  return (
    <AppShell title="Неделя" subtitle="Планы на семь дней">
      <WeekView today={today} dates={dates} initialPlanned={planned} templates={templates} />
    </AppShell>
  );
}
