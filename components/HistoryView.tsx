'use client';

import { useRouter } from 'next/navigation';
import AppShell from './AppShell';
import TemplateIcon from './TemplateIcon';
import { formatDateRu, formatDuration } from '@/lib/utils';
import { CalendarDays, Clock } from 'lucide-react';

type Task = { title: string; template_color?: string; template_icon?: string; duration_minutes?: number };
type Day  = { date: string; tasks: Task[] };

export default function HistoryView({ days, totalDays, totalTasks }: { days: Day[]; totalDays: number; totalTasks: number }) {
  const router = useRouter();

  return (
    <AppShell title="История">
      <div className="metrics">
        <div className="metric">
          <div className="metric-val">{totalDays}</div>
          <div className="metric-lbl">дней с записями</div>
        </div>
        <div className="metric">
          <div className="metric-val">{totalTasks}</div>
          <div className="metric-lbl">дел всего</div>
        </div>
      </div>

      {days.length === 0 ? (
        <div className="empty">
          <div className="empty-icon"><CalendarDays /></div>
          <div className="empty-title">История пуста</div>
          <p>Записывай дела на вкладке «Сегодня», и они появятся здесь</p>
        </div>
      ) : (
        days.map((day) => {
          const totalMin = day.tasks.reduce((s, t) => s + (t.duration_minutes ?? 0), 0);
          return (
            <button key={day.date} className="hist-day" onClick={() => router.push(`/day/${day.date}`)}>
              <div className="hist-top">
                <span className="hist-date">{formatDateRu(day.date)}</span>
                {totalMin > 0 && <span className="hist-time"><Clock /> {formatDuration(totalMin)}</span>}
              </div>
              <div className="hist-tasks">
                {day.tasks.slice(0, 4).map((t, i) => (
                  <div key={i} className="hist-task">
                    <span className="hist-task-dot" style={{ background: t.template_color ?? 'var(--accent)' }} />
                    {t.template_icon && <span className="hist-task-emoji"><TemplateIcon icon={t.template_icon} color={t.template_color} /></span>}
                    <span className="hist-task-label">{t.title}</span>
                  </div>
                ))}
                {day.tasks.length > 4 && <div className="hist-more">+ ещё {day.tasks.length - 4}</div>}
              </div>
            </button>
          );
        })
      )}
    </AppShell>
  );
}
