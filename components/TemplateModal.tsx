'use client';

import { useState } from 'react';
import { COLORS } from '@/lib/utils';
import TemplateIcon, { ICON_KEYS } from './TemplateIcon';
import { Plus, X, Check } from 'lucide-react';

type Field = { name: string; placeholder: string; type: string };
type Template = { id?: string; name: string; color: string; icon: string; fields: Field[] };

type Props = {
  initial?: Template;
  onSave: (t: Omit<Template, 'id'>) => Promise<void>;
  onClose: () => void;
};

export default function TemplateModal({ initial, onSave, onClose }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);
  const [icon, setIcon] = useState(initial?.icon ?? ICON_KEYS[0]);
  const [fields, setFields] = useState<Field[]>(initial?.fields ?? []);
  const [saving, setSaving] = useState(false);

  function addField() { setFields([...fields, { name: '', placeholder: '', type: 'text' }]); }
  function removeField(i: number) { setFields(fields.filter((_, idx) => idx !== i)); }
  function updateField(i: number, key: keyof Field, val: string) {
    setFields(fields.map((f, idx) => idx === i ? { ...f, [key]: val } : f));
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    await onSave({ name: name.trim(), color, icon, fields: fields.filter((f) => f.name.trim()) });
    setSaving(false);
    onClose();
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet">
        <div className="sheet-handle" />
        <div className="sheet-head">
          <span className="sheet-title">{initial ? 'Редактировать шаблон' : 'Новый шаблон'}</span>
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть"><X className="icon" /></button>
        </div>
        <div className="sheet-body">

          <div className="field">
            <label>Название</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Тренировка, Учёба, Работа" autoFocus />
          </div>

          <div className="field">
            <label>Иконка</label>
            <div className="icon-row">
              {ICON_KEYS.map((key) => (
                <button key={key} type="button" className={`icon-pick${icon === key ? ' active' : ''}`} onClick={() => setIcon(key)}>
                  <TemplateIcon icon={key} />
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Цвет</label>
            <div className="color-row">
              {COLORS.map((c) => (
                <button key={c} type="button" className={`color-sw${color === c ? ' active' : ''}`} style={{ background: c, color: c }} onClick={() => setColor(c)} aria-label={`Цвет ${c}`}>
                  {color === c && <Check className="icon-sm" style={{ color: '#fff' }} />}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Поля шаблона</label>
            <div className="fields-list">
              {fields.map((f, i) => (
                <div key={i} className="field-row">
                  <input value={f.name} onChange={(e) => updateField(i, 'name', e.target.value)} placeholder="Название поля" />
                  <select value={f.type} onChange={(e) => updateField(i, 'type', e.target.value)} style={{ width: 100, flex: 'none' }}>
                    <option value="text">Текст</option>
                    <option value="number">Число</option>
                    <option value="textarea">Абзац</option>
                  </select>
                  <button type="button" className="icon-btn" onClick={() => removeField(i)} aria-label="Удалить поле"><X className="icon-sm" /></button>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-secondary btn-sm btn-block" onClick={addField}>
              <Plus className="icon-sm" /> Добавить поле
            </button>
          </div>

          <button className="btn btn-primary btn-block" style={{ marginTop: 6 }} onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Сохраняю…' : initial ? 'Сохранить' : 'Создать шаблон'}
          </button>
        </div>
      </div>
    </div>
  );
}
