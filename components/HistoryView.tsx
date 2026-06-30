'use client';

import AppShell from './AppShell';
import { formatDateRu, formatDuration } from '@/lib/utils';

type Task = { title: string; template_color?: string; template_icon?: string; duration_minutes?: number };
type Day  = { date: string; tasks: Task[] };

export default function HistoryView({ days, totalDays, totalTasks }: { days: Day[]; totalDays: number; totalTasks: number }) {
  return (
    <AppShell>
      <div className="history-page">
        <div className="stats-bar" style={{ marginBottom: 20 }}>
          <div className="stat-item">
            <div className="stat-val">{totalDays}</div>
            <div className="stat-lbl">дней записей</div>
          </div>
          <div className="stat-item">
            <div className="stat-val">{totalTasks}</div>
            <div className="stat-lbl">дел всего</div>
          </div>
        </div>

        {days.length === 0 && (
          <div className="empty">
            <div className="empty-icon">📅</div>
            <p>История пока пуста — начни записывать дела</p>
          </div>
        )}

        {days.map((day) => {
          const totalMin = day.tasks.reduce((s, t) => s + (t.duration_minutes ?? 0), 0);
          return (
            <div key={day.date} className="history-day">
              <div className="history-day-date">
                {formatDateRu(day.date)}
                {totalMin > 0 && (
                  <span style={{ fontWeight: 400, color: 'var(--text3)', marginLeft: 8 }}>
                    · {formatDuration(totalMin)}
                  </span>
                )}
              </div>
              <div className="history-day-tasks">
                {day.tasks.slice(0, 4).map((t, i) => (
                  <div key={i} className="history-task-row">
                    <span
                      className="history-task-dot"
                      style={{ background: t.template_color ?? 'var(--accent)' }}
                    />
                    <span>{t.template_icon} {t.title}</span>
                    {t.duration_minutes ? (
                      <span style={{ color: 'var(--text3)', marginLeft: 'auto', fontSize: 12 }}>
                        {formatDuration(t.duration_minutes)}
                      </span>
                    ) : null}
                  </div>
                ))}
                {day.tasks.length > 4 && (
                  <div className="history-more">+ ещё {day.tasks.length - 4} дел</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
