'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import TemplateModal from './TemplateModal';
import AppShell from './AppShell';
import { Plus, Pencil, Trash2, LayoutGrid } from 'lucide-react';

type Field = { name: string; placeholder: string; type: string };
type Template = { id: string; name: string; color: string; icon: string; fields: Field[] };

export default function TemplatesView({ userId, initialTemplates }: { userId: string; initialTemplates: Template[] }) {
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const supabase = createClient();

  async function handleCreate(data: Omit<Template, 'id'>) {
    const { data: t } = await supabase.from('templates').insert({ ...data, user_id: userId }).select().single();
    if (t) setTemplates([...templates, t]);
  }

  async function handleEdit(data: Omit<Template, 'id'>) {
    if (!editing) return;
    const { data: t } = await supabase.from('templates').update(data).eq('id', editing.id).select().single();
    if (t) setTemplates(templates.map((x) => x.id === t.id ? t : x));
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить шаблон? Уже добавленные дела останутся.')) return;
    setTemplates(templates.filter((t) => t.id !== id));
    await supabase.from('templates').delete().eq('id', id);
  }

  return (
    <AppShell title="Шаблоны">
      <div className="page-head">
        <span className="page-head-count">{templates.length} шаблонов</span>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditing(null); setShowModal(true); }}>
          <Plus className="icon-sm" /> Новый шаблон
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="empty">
          <div className="empty-icon"><LayoutGrid /></div>
          <div className="empty-title">Пока нет шаблонов</div>
          <p>Создай шаблон, чтобы добавлять однотипные дела с нужными полями</p>
        </div>
      ) : (
        <div className="tpl-list">
          {templates.map((t) => (
            <div key={t.id} className="tpl-row">
              <div className="tpl-row-icon">{t.icon}</div>
              <div className="tpl-row-info">
                <div className="tpl-row-name" style={{ color: t.color }}>{t.name}</div>
                <div className="tpl-row-meta">
                  {t.fields.length ? t.fields.map((f) => f.name).join(' · ') : 'Без дополнительных полей'}
                </div>
              </div>
              <div className="tpl-row-actions">
                <button className="icon-btn" onClick={() => { setEditing(t); setShowModal(true); }} aria-label="Изменить"><Pencil className="icon-sm" /></button>
                <button className="icon-btn danger" onClick={() => handleDelete(t.id)} aria-label="Удалить"><Trash2 className="icon-sm" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <TemplateModal
          initial={editing ?? undefined}
          onSave={editing ? handleEdit : handleCreate}
          onClose={() => { setShowModal(false); setEditing(null); }}
        />
      )}
    </AppShell>
  );
}
