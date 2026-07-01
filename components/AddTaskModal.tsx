'use client';

import { useState } from 'react';
import { formatDuration, MAX_TASK_MINUTES } from '@/lib/utils';
import TemplateIcon from './TemplateIcon';
import { Clock, X } from 'lucide-react';

type Template = {
  id: string; name: string; color: string; icon: string;
  fields: { name: string; placeholder: string; type: string }[];
};

type Task = {
  id?: string;
  template_id?: string;
  template_name?: string;
  template_color?: string;
  template_icon?: string;
  title: string;
  fields_data?: Record<string, string>;
  duration_minutes?: number;
};

type Props = {
  templates: Template[];
  initial?: Task;
  onSave: (task: Omit<Task, 'id'>) => Promise<void>;
  onClose: () => void;
  planMode?: boolean;
  submitLabel?: string;
  titleLabel?: string;
};

const clamp = (n: number) => Math.max(0, Math.min(MAX_TASK_MINUTES, n));

// Map stored name-keyed data onto field positions so identical field names never collide.
function indexFromNames(fields: Template['fields'], data?: Record<string, string>): Record<number, string> {
  const out: Record<number, string> = {};
  if (!data) return out;
  fields.forEach((f, i) => { if (data[f.name] != null) out[i] = data[f.name]; });
  return out;
}

export default function AddTaskModal({ templates, initial, onSave, onClose, planMode = false, submitLabel, titleLabel }: Props) {
  const initialTemplate = initial?.template_id ? templates.find((t) => t.id === initial.template_id) ?? null : null;
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(initialTemplate);
  const [title, setTitle] = useState(initial?.title ?? '');
  // Keyed by field index (not name) so two fields sharing a name don't share a value.
  const [fieldsData, setFieldsData] = useState<Record<number, string>>(
    () => (initialTemplate ? indexFromNames(initialTemplate.fields, initial?.fields_data) : {})
  );
  const [minutes, setMinutes] = useState<number>(clamp(initial?.duration_minutes ?? 0));
  const [saving, setSaving] = useState(false);

  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const pct = (minutes / MAX_TASK_MINUTES) * 100;

  function setHours(val: string) {
    const hh = Math.max(0, Math.min(15, parseInt(val || '0')));
    setMinutes(clamp(hh * 60 + m));
  }
  function setMins(val: string) {
    const mm = Math.max(0, Math.min(59, parseInt(val || '0')));
    setMinutes(clamp(h * 60 + mm));
  }

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    // Fold the index-keyed values back into a name-keyed record for storage/display.
    const named: Record<string, string> = {};
    selectedTemplate?.fields.forEach((f, i) => {
      const v = fieldsData[i];
      if (v != null && v !== '') named[f.name] = v;
    });
    await onSave({
      template_id: selectedTemplate?.id,
      template_name: selectedTemplate?.name,
      template_color: selectedTemplate?.color,
      template_icon: selectedTemplate?.icon,
      title: title.trim(),
      fields_data: planMode ? {} : named,
      duration_minutes: planMode ? undefined : (minutes || undefined),
    });
    setSaving(false);
    onClose();
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet">
        <div className="sheet-handle" />
        <div className="sheet-head">
          <span className="sheet-title">{planMode ? 'Новый план' : initial ? 'Дело' : 'Новое дело'}</span>
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
                    className={`tpl-pick${selectedTemplate?.id === t.id ? ' sel' : ''}`}
                    onClick={() => {
                      const isSame = selectedTemplate?.id === t.id;
                      setSelectedTemplate(isSame ? null : t);
                      if (isSame) setFieldsData({});
                      else setFieldsData(initial?.template_id === t.id ? indexFromNames(t.fields, initial?.fields_data) : {});
                    }}
                  >
                    <span className="tpl-pick-icon"><TemplateIcon icon={t.icon} color={t.color} /></span>
                    <span className="tpl-pick-name">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="field">
            <label>{titleLabel ?? (planMode ? 'Что нужно сделать' : 'Что сделал')}</label>
            <input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder={planMode ? 'Опиши задачу' : 'Опиши выполненное дело'} autoFocus />
          </div>

          {!planMode && selectedTemplate?.fields.map((f, i) => (
            <div key={i} className="field">
              <label>{f.name}</label>
              {f.type === 'textarea' ? (
                <textarea value={fieldsData[i] ?? ''} onChange={(e) => setFieldsData({ ...fieldsData, [i]: e.target.value })} placeholder={f.placeholder} rows={3} />
              ) : (
                <input type={f.type === 'number' ? 'number' : 'text'} value={fieldsData[i] ?? ''} onChange={(e) => setFieldsData({ ...fieldsData, [i]: e.target.value })} placeholder={f.placeholder} />
              )}
            </div>
          ))}

          {/* Time spent */}
          {!planMode && (
          <div className="field">
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Clock className="icon-sm" /> Затраченное время
            </label>
            <div className="slider-readout">
              {minutes > 0 ? formatDuration(minutes) : <span className="muted">не указано</span>}
            </div>
            <input
              className="range"
              type="range"
              min={0}
              max={MAX_TASK_MINUTES}
              step={5}
              value={minutes}
              onChange={(e) => setMinutes(clamp(parseInt(e.target.value)))}
              style={{ background: `linear-gradient(to right, var(--accent) ${pct}%, var(--surface-3) ${pct}%)` }}
            />
            <div className="range-ends"><span>0</span><span>15 ч</span></div>
            <div className="time-row" style={{ marginTop: 12 }}>
              <div className="time-wrap">
                <input type="number" min="0" max="15" value={h || ''} onChange={(e) => setHours(e.target.value)} placeholder="0" />
                <span className="time-unit">ч</span>
              </div>
              <div className="time-wrap">
                <input type="number" min="0" max="59" value={m || ''} onChange={(e) => setMins(e.target.value)} placeholder="0" />
                <span className="time-unit">мин</span>
              </div>
            </div>
          </div>
          )}

          <button className="btn btn-primary btn-block" style={{ marginTop: 6 }} onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? 'Сохраняю…' : submitLabel ?? (planMode ? 'Добавить в планы' : initial ? 'Сохранить' : 'Добавить дело')}
          </button>
        </div>
      </div>
    </div>
  );
}
