'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '@/app/actions/data';
import TemplateModal from './TemplateModal';
import TemplateIcon from './TemplateIcon';
import AppShell from './AppShell';
import { Plus, Pencil, Trash2, LayoutGrid, ChevronRight } from 'lucide-react';

type Field = { name: string; placeholder: string; type: string };
type Template = { id: string; name: string; color: string; icon: string; fields: Field[] };

export default function TemplatesView({ initialTemplates }: { userId: string; initialTemplates: Template[] }) {
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const router = useRouter();

  async function handleCreate(data: Omit<Template, 'id'>) {
    const t = await api.addTemplate(data);
    setTemplates([...templates, t]);
  }

  async function handleEdit(data: Omit<Template, 'id'>) {
    if (!editing) return;
    const t = await api.updateTemplate(editing.id, data);
    if (t) setTemplates(templates.map((x) => x.id === t.id ? t : x));
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить шаблон? Уже добавленные дела останутся.')) return;
    setTemplates(templates.filter((t) => t.id !== id));
    await api.deleteTemplate(id);
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
            <div key={t.id} className="tpl-row clickable" onClick={() => router.push(`/templates/${t.id}`)}>
              <div className="tpl-row-icon"><TemplateIcon icon={t.icon} color={t.color} /></div>
              <div className="tpl-row-info">
                <div className="tpl-row-name" style={{ color: t.color }}>{t.name}</div>
                <div className="tpl-row-meta">
                  {t.fields.length ? t.fields.map((f) => f.name).join(' · ') : 'Без дополнительных полей'}
                </div>
              </div>
              <div className="tpl-row-actions" onClick={(e) => e.stopPropagation()}>
                <button className="icon-btn" onClick={() => { setEditing(t); setShowModal(true); }} aria-label="Изменить"><Pencil className="icon-sm" /></button>
                <button className="icon-btn danger" onClick={() => handleDelete(t.id)} aria-label="Удалить"><Trash2 className="icon-sm" /></button>
                <ChevronRight className="icon-sm tpl-row-chevron" />
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
