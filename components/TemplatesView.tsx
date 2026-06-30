'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import TemplateModal from './TemplateModal';
import AppShell from './AppShell';

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
    if (!confirm('Удалить шаблон?')) return;
    await supabase.from('templates').delete().eq('id', id);
    setTemplates(templates.filter((t) => t.id !== id));
  }

  return (
    <AppShell>
      <div className="templates-page">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>{templates.length} шаблонов</div>
          <button className="btn btn-primary" style={{ width: 'auto', padding: '10px 18px' }} onClick={() => { setEditing(null); setShowModal(true); }}>
            + Новый шаблон
          </button>
        </div>

        {templates.length === 0 && (
          <div className="empty">
            <div className="empty-icon">🗂️</div>
            <p>Создай первый шаблон, чтобы быстро добавлять дела</p>
          </div>
        )}

        {templates.map((t) => (
          <div key={t.id} className="template-card">
            <div className="template-card-icon" style={{ borderColor: t.color }}>{t.icon}</div>
            <div className="template-card-info">
              <div className="template-card-name" style={{ color: t.color }}>{t.name}</div>
              <div className="template-card-fields">
                {t.fields.length ? t.fields.map((f) => f.name).join(' · ') : 'Без полей'}
              </div>
            </div>
            <div className="template-card-actions">
              <button className="btn-icon" onClick={() => { setEditing(t); setShowModal(true); }}>✏️</button>
              <button className="btn-icon" style={{ color: 'var(--red)' }} onClick={() => handleDelete(t.id)}>🗑</button>
            </div>
          </div>
        ))}
      </div>

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
