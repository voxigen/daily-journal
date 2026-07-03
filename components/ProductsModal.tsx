'use client';

import { useState } from 'react';
import { Plus, X, Trash2 } from 'lucide-react';

type Product = { id: string; name: string; kcal_per_gram: number };
type Props = {
  products: Product[];
  onAdd: (name: string, kpg: number) => void;
  onEdit: (id: string, name: string, kpg: number) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

// Manage the personal food list (kcal per gram) used by the meal autocomplete.
export default function ProductsModal({ products, onAdd, onEdit, onDelete, onClose }: Props) {
  const [name, setName] = useState('');
  const [kpg, setKpg] = useState('');

  const canAdd = name.trim() && Number(kpg) > 0;
  function add() {
    if (!canAdd) return;
    onAdd(name.trim(), Number(kpg));
    setName(''); setKpg('');
  }

  const sorted = [...products].sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet">
        <div className="sheet-handle" />
        <div className="sheet-head">
          <span className="sheet-title">Мои продукты</span>
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть"><X className="icon" /></button>
        </div>
        <div className="sheet-body">
          <div className="prod-add">
            <input value={name} maxLength={80} placeholder="Название продукта" autoFocus onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
            <div className="prod-kpg">
              <input type="number" step="0.1" min="0" inputMode="decimal" value={kpg} onChange={(e) => setKpg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
              <span className="prod-unit">ккал/г</span>
            </div>
            <button className="btn btn-primary" onClick={add} disabled={!canAdd} aria-label="Добавить"><Plus className="icon-sm" /></button>
          </div>
          <div className="setting-hint" style={{ marginTop: 8 }}>
            Калорийность на 1 грамм (например, белый хлеб ≈ 2.6, мёд ≈ 3.1). В приёме пищи начни писать название — продукт подставится, впишешь граммы, калории посчитаются сами.
          </div>

          <div className="prod-list">
            {sorted.length === 0 && <div className="prod-empty">Пока нет продуктов — добавь первый выше.</div>}
            {sorted.map((p) => (
              <div className="prod-row" key={p.id}>
                <input
                  className="prod-name"
                  defaultValue={p.name}
                  maxLength={80}
                  onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== p.name) onEdit(p.id, v, p.kcal_per_gram); }}
                />
                <div className="prod-kpg">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    inputMode="decimal"
                    defaultValue={p.kcal_per_gram}
                    onBlur={(e) => { const v = Number(e.target.value); if (v > 0 && v !== p.kcal_per_gram) onEdit(p.id, p.name, v); }}
                  />
                  <span className="prod-unit">ккал/г</span>
                </div>
                <button className="icon-btn danger" onClick={() => onDelete(p.id)} aria-label="Удалить"><Trash2 className="icon-sm" /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
