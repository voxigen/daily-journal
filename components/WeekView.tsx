'use client';

import { useState } from 'react';
import * as api from '@/app/actions/data';
import AddTaskModal from './AddTaskModal';
import TemplateIcon from './TemplateIcon';
import { MONTHS_RU } from '@/lib/utils';
import { Plus, Trash2 } from 'lucide-react';

type Planned = {
  id: string; date: string; title: string;
  template_id?: string; template_name?: string; template_color?: string; template_icon?: string;
};
type Template = {
  id: string; name: string; color: string; icon: string;
  fields: { name: string; placeholder: string; type: string }[];
};
// Данные из AddTaskModal (planMode отдаёт только заголовок + шаблон, остальное пустое).
type PlanData = {
  title: string; template_id?: string; template_name?: string; template_color?: string; template_icon?: string;
  fields_data?: Record<string, string>; duration_minutes?: number;
};

const WEEKDAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

export default function WeekView({ today, dates, initialPlanned, templates }: {
  today: string; dates: string[]; initialPlanned: Planned[]; templates: Template[];
}) {
  const [planned, setPlanned] = useState<Planned[]>(initialPlanned);
  const [addDate, setAddDate] = useState<string | null>(null);

  async function add(date: string, data: PlanData) {
    const row = await api.addPlanned(date, data);
    setPlanned((p) => [...p, row]);
  }
  async function remove(id: string) {
    setPlanned((p) => p.filter((x) => x.id !== id));
    await api.deletePlanned(id);
  }

  function dayMonth(date: string) {
    return `${Number(date.slice(8, 10))} ${MONTHS_RU[Number(date.slice(5, 7)) - 1]}`;
  }

  return (
    <>
      {dates.map((date, i) => {
        const items = planned.filter((p) => p.date === date);
        const isToday = date === today;
        const isPast = date < today;
        return (
          <div key={date} className={`section week-day${isToday ? ' today' : ''}${isPast ? ' past' : ''}`}>
            <div className="week-day-head">
              <span className="week-wd">
                {WEEKDAYS[i]}
                {isToday && <span className="week-today-badge">сегодня</span>}
              </span>
              <span className="week-dm">{dayMonth(date)}</span>
            </div>
            <div className={`task-list${items.length === 0 ? ' task-list-empty' : ''}`}>
              {items.map((p) => {
                const color = p.template_color ?? 'var(--accent)';
                return (
                  <div key={p.id} className="task-row">
                    <span className="task-dot" style={{ background: color, opacity: 0.6 }} />
                    <div className="task-body">
                      <div className="task-top">
                        <span className="task-title">{p.title}</span>
                        {p.template_name && (
                          <span className="task-chip" style={{ '--chip-bg': `${color}1f`, '--chip-fg': color } as React.CSSProperties}>
                            <TemplateIcon icon={p.template_icon} className="chip-ico" /> {p.template_name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="task-actions">
                      <button className="task-action del" onClick={() => remove(p.id)} aria-label="Удалить"><Trash2 /></button>
                    </div>
                  </div>
                );
              })}
              <button className="add-row" onClick={() => setAddDate(date)}><Plus /> Добавить план</button>
            </div>
          </div>
        );
      })}

      {addDate && (
        <AddTaskModal
          templates={templates}
          planMode
          titleLabel="Что нужно сделать"
          submitLabel="Добавить в планы"
          onSave={(d) => add(addDate, d)}
          onClose={() => setAddDate(null)}
        />
      )}
    </>
  );
}
