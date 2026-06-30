'use client';

import AppShell from './AppShell';

type Entry = { date: string; done?: string; notes?: string };

export default function HistoryView({ entries }: { entries: Entry[] }) {
  return (
    <AppShell activeTab="history" date="История">
      <div className="history-page">
        {entries.length === 0 ? (
          <div className="empty-state">
            <p>Записей пока нет. Начни сегодня!</p>
          </div>
        ) : (
          entries.map((e) => {
            const label = new Date(e.date + 'T12:00:00').toLocaleDateString('ru-RU', {
              weekday: 'long', day: 'numeric', month: 'long',
            });
            return (
              <div key={e.date} className="history-entry">
                <div className="history-entry-date">{label}</div>
                {e.done && (
                  <div className="history-snippet" style={{ color: 'var(--done)', marginBottom: 4 }}>
                    ✓ {e.done}
                  </div>
                )}
                {e.notes && (
                  <div className="history-snippet" style={{ color: 'var(--note)' }}>
                    📝 {e.notes}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </AppShell>
  );
}
