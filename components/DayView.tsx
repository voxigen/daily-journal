'use client';

import { useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import AppShell from './AppShell';

type Props = {
  userId: string;
  date: string;
  initial: { done?: string; planned_next?: string; notes?: string } | null;
  plannedFromYesterday: string | null;
};

export default function DayView({ userId, date, initial, plannedFromYesterday }: Props) {
  const [done, setDone] = useState(initial?.done ?? '');
  const [plannedNext, setPlannedNext] = useState(initial?.planned_next ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabase = createClient();
  const router = useRouter();

  const save = useCallback(
    async (d: string, pn: string, n: string) => {
      setSaveStatus('saving');
      await supabase.from('daily_entries').upsert(
        { user_id: userId, date, done: d, planned_next: pn, notes: n },
        { onConflict: 'user_id,date' }
      );
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    },
    [supabase, userId, date]
  );

  function scheduleAutoSave(d: string, pn: string, n: string) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => save(d, pn, n), 1500);
  }

  function handleDone(v: string) {
    setDone(v);
    scheduleAutoSave(v, plannedNext, notes);
  }
  function handlePlanned(v: string) {
    setPlannedNext(v);
    scheduleAutoSave(done, v, notes);
  }
  function handleNotes(v: string) {
    setNotes(v);
    scheduleAutoSave(done, plannedNext, v);
  }

  const displayDate = new Date(date + 'T12:00:00').toLocaleDateString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <AppShell activeTab="today" date={displayDate}>
      <div className="day-page">
        {/* Что планировал (из вчера) */}
        <div className="section-card">
          <div className="section-header">
            <span className="section-dot dot-plan" />
            <span className="section-title">Планировал на сегодня</span>
            <span className="section-from">← вчера</span>
          </div>
          {plannedFromYesterday ? (
            <div className="planned-preview">{plannedFromYesterday}</div>
          ) : (
            <div className="planned-preview planned-empty">Вчера ничего не запланировано</div>
          )}
        </div>

        {/* Что сделал */}
        <div className="section-card">
          <div className="section-header">
            <span className="section-dot dot-done" />
            <span className="section-title">Что сделал сегодня</span>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <textarea
              value={done}
              onChange={(e) => handleDone(e.target.value)}
              placeholder="Опиши что удалось сделать сегодня..."
              rows={5}
            />
          </div>
        </div>

        {/* Планы на завтра */}
        <div className="section-card">
          <div className="section-header">
            <span className="section-dot dot-plan" />
            <span className="section-title">Планы на завтра</span>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <textarea
              value={plannedNext}
              onChange={(e) => handlePlanned(e.target.value)}
              placeholder="Что планируешь сделать завтра?"
              rows={4}
            />
          </div>
        </div>

        {/* Заметки */}
        <div className="section-card">
          <div className="section-header">
            <span className="section-dot dot-note" />
            <span className="section-title">Дополнительные заметки</span>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <textarea
              value={notes}
              onChange={(e) => handleNotes(e.target.value)}
              placeholder="Мысли, наблюдения, важные детали..."
              rows={4}
            />
          </div>
        </div>

        <div style={{ height: 80 }} />
      </div>

      <div className="save-bar">
        <button
          className="btn btn-primary"
          style={{ maxWidth: 160 }}
          onClick={() => save(done, plannedNext, notes)}
          disabled={saveStatus === 'saving'}
        >
          {saveStatus === 'saving' ? 'Сохраняю...' : 'Сохранить'}
        </button>
        <span className={`save-status${saveStatus === 'saved' ? ' saved' : ''}`}>
          {saveStatus === 'saved' ? '✓ Сохранено' : saveStatus === 'saving' ? '' : ''}
        </span>
      </div>
    </AppShell>
  );
}
