'use client';

import { useState } from 'react';
import { formatDuration } from '@/lib/utils';
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
};

export default function AddTaskModal({ templates, initial, onSave, onClose }: Props) {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    initial?.template_id ? templates.find((t) => t.id === initial.template_id) ?? null : null
  );
  const [title, setTitle] = useState(initial?.title ?? '');
  const [fieldsData, setFieldsData] = useState<Record<string, string>>(initial?.fields_data ?? {});
  const [hours, setHours] = useState(initial?.duration_minutes ? String(Math.floor(initial.duration_minutes / 60)) : '');
  const [mins, setMins] = useState(initial?.duration_minutes ? String(initial.duration_minutes % 60) : '');
  const [saving, setSaving] = useState(false);

  const totalMinutes = (parseInt(hours || '0') * 60) + parseInt(mins || '0');

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    await onSave({
      template_id: selectedTemplate?.id,
      template_name: selectedTemplate?.name,
      template_color: selectedTemplate?.color,
      template_icon: selectedTemplate?.icon,
      title: title.trim(),
      fields_data: fieldsData,
      duration_minutes: totalMinutes || undefined,
    });
    setSaving(false);
    onClose();
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet">
        <div className="sheet-handle" />
        <div className="sheet-head">
          <span className="sheet-title">{initial ? 'Редактировать дело' : 'Новое дело'}</span>
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
                      if (!isSame) setFieldsData(initial?.template_id === t.id ? (initial.fields_data ?? {}) : {});
                    }}
                  >
                    <span className="tpl-pick-icon">{t.icon}</span>
                    <span className="tpl-pick-name">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="field">
            <label>Что сделал</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Опиши выполненное дело" autoFocus />
          </div>

          {selectedTemplate?.fields.map((f) => (
            <div key={f.name} className="field">
              <label>{f.name}</label>
              {f.type === 'textarea' ? (
                <textarea value={fieldsData[f.name] ?? ''} onChange={(e) => setFieldsData({ ...fieldsData, [f.name]: e.target.value })} placeholder={f.placeholder} rows={3} />
              ) : (
                <input type={f.type === 'number' ? 'number' : 'text'} value={fieldsData[f.name] ?? ''} onChange={(e) => setFieldsData({ ...fieldsData, [f.name]: e.target.value })} placeholder={f.placeholder} />
              )}
            </div>
          ))}

          <div className="field">
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Clock className="icon-sm" /> Затраченное время
            </label>
            <div className="time-row">
              <div className="time-wrap">
                <input type="number" min="0" max="23" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="0" />
                <span className="time-unit">ч</span>
              </div>
              <div className="time-wrap">
                <input type="number" min="0" max="59" value={mins} onChange={(e) => setMins(e.target.value)} placeholder="0" />
                <span className="time-unit">мин</span>
              </div>
            </div>
            {totalMinutes > 0 && <div className="time-total">Итого: {formatDuration(totalMinutes)}</div>}
          </div>

          <button className="btn btn-primary btn-block" style={{ marginTop: 6 }} onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? 'Сохраняю…' : initial ? 'Сохранить' : 'Добавить дело'}
          </button>
        </div>
      </div>
    </div>
  );
}
