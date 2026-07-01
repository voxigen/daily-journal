'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

type Template = {
  id: string; name: string; color: string; icon: string;
  fields: { name: string; placeholder: string; type: string }[];
};

export type RecurringInput = {
  title: string;
  template_id?: string;
  template_name?: string;
  template_color?: string;
  template_icon?: string;
  freq: 'daily' | 'weekly';
  weekdays: number[];
};

type Props = {
  templates: Template[];
  onSave: (r: RecurringInput) => Promise<void>;
  onClose: () => void;
};

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export default function RecurringModal({ templates, onSave, onClose }: Props) {
  const [selected, setSelected] = useState<Template | null>(null);
  const [title, setTitle] = useState('');
  const [freq, setFreq] = useState<'daily' | 'weekly'>('daily');
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const canSave = title.trim() && (freq === 'daily' || weekdays.length > 0);

  function toggleDay(i: number) {
    setWeekdays((p) => (p.includes(i) ? p.filter((d) => d !== i) : [...p, i]));
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    await onSave({
      title: title.trim(),
      template_id: selected?.id,
      template_name: selected?.name,
      template_color: selected?.color,
      template_icon: selected?.icon,
      freq,
      weekdays: freq === 'weekly' ? [...weekdays].sort((a, b) => a - b) : [],
    });
    setSaving(false);
    onClose();
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet">
        <div className="sheet-handle" />
        <div className="sheet-head">
          <span className="sheet-title">Повторяющийся план</span>
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть"><X className="icon" /></button>
        </div>
        <div className="sheet-body">

          {templates.length > 0 && (
            <div className="field">
              <label>Шаблон (необязательно)</label>
              <div className="tpl-grid">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`tpl-pick${selected?.id === t.id ? ' sel' : ''}`}
                    onClick={() => setSelected(selected?.id === t.id ? null : t)}
                  >
                    <span className="tpl-pick-icon">{t.icon}</span>
                    <span className="tpl-pick-name">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="field">
            <label>Что нужно делать</label>
            <input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="Например: Зарядка" autoFocus />
          </div>

          <div className="field">
            <label>Повторять</label>
            <div className="segment">
              <button className={freq === 'daily' ? 'sel' : ''} onClick={() => setFreq('daily')}>Каждый день</button>
              <button className={freq === 'weekly' ? 'sel' : ''} onClick={() => setFreq('weekly')}>По дням недели</button>
            </div>
          </div>

          {freq === 'weekly' && (
            <div className="field">
              <label>Дни недели</label>
              <div className="weekday-row">
                {WEEKDAYS.map((w, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`weekday${weekdays.includes(i) ? ' sel' : ''}`}
                    onClick={() => toggleDay(i)}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button className="btn btn-primary btn-block" style={{ marginTop: 6 }} onClick={handleSave} disabled={saving || !canSave}>
            {saving ? 'Сохраняю…' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  );
}
