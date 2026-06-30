'use client';

import { useRouter } from 'next/navigation';
import AppShell from './AppShell';
import { formatDateRu, formatDuration } from '@/lib/utils';
import { CalendarDays, Clock } from 'lucide-react';

type Task = { title: string; template_color?: string; template_icon?: string; duration_minutes?: number };
type Day  = { date: string; tasks: Task[] };

export default function HistoryView({ days, totalDays, totalTasks }: { days: Day[]; totalDays: number; totalTasks: number }) {
  const router = useRouter();

  return (
    <AppShell>
      <div className="history-page">
        <div className="stats-bar">
          <div className="stat-item">
            <div className="stat-val">{totalDays}</div>
            <div className="stat-lbl">дней</div>
          </div>
          <div className="stat-item">
            <div className="stat-val">{totalTasks}</div>
            <div className="stat-lbl">дел всего</div>
          </div>
        </div>

        {days.length === 0 && (
          <div className="empty">
            <div className="empty-icon"><CalendarDays /></div>
            <p>История пока пуста — начни записывать дела на вкладке «Сегодня»</p>
          </div>
        )}

        {days.map((day) => {
          const totalMin = day.tasks.reduce((s, t) => s + (t.duration_minutes ?? 0), 0);
          return (
            <div key={day.date} className="history-day" onClick={() => router.push(`/day/${day.date}`)}>
              <div className="history-day-top">
                <span className="history-day-date">{formatDateRu(day.date)}</span>
                {totalMin > 0 && (
                  <span className="history-day-time"><Clock /> {formatDuration(totalMin)}</span>
                )}
              </div>
              <div className="history-day-tasks">
                {day.tasks.slice(0, 4).map((t, i) => (
                  <div key={i} className="history-task-row">
                    <span className="history-task-dot" style={{ background: t.template_color ?? 'var(--accent)' }} />
                    {t.template_icon && <span className="history-task-emoji">{t.template_icon}</span>}
                    <span className="history-task-label">{t.title}</span>
                  </div>
                ))}
                {day.tasks.length > 4 && <div className="history-more">+ ещё {day.tasks.length - 4}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
