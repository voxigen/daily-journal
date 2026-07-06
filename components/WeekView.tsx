'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '@/app/actions/data';
import AddTaskModal from './AddTaskModal';
import TemplateIcon from './TemplateIcon';
import { MONTHS_RU, mondayIndex } from '@/lib/utils';
import { Plus, Trash2, ChevronLeft, ChevronRight, CalendarRange } from 'lucide-react';

type Planned = {
  id: string; date: string; title: string;
  template_id?: string; template_name?: string; template_color?: string; template_icon?: string;
};
type Template = {
  id: string; name: string; color: string; icon: string;
  fields: { name: string; placeholder: string; type: string }[];
};
type PlanData = {
  title: string; template_id?: string; template_name?: string; template_color?: string; template_icon?: string;
  fields_data?: Record<string, string>; duration_minutes?: number;
};

const WD_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const WD_FULL = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

const dayNum = (d: string) => Number(d.slice(8, 10));
const monthShort = (d: string) => MONTHS_RU[Number(d.slice(5, 7)) - 1];

export default function WeekView({ today, offset, dates, initialPlanned, templates }: {
  today: string; offset: number; dates: string[]; initialPlanned: Planned[]; templates: Template[];
}) {
  const router = useRouter();
  const [planned, setPlanned] = useState<Planned[]>(initialPlanned);
  // На текущей неделе стартуем с сегодня, на других — с понедельника.
  const [selected, setSelected] = useState<number>(offset === 0 ? mondayIndex(today) : 0);
  const [addDate, setAddDate] = useState<string | null>(null);

  async function add(date: string, data: PlanData) {
    const row = await api.addPlanned(date, data);
    setPlanned((p) => [...p, row]);
  }
  async function remove(id: string) {
    setPlanned((p) => p.filter((x) => x.id !== id));
    await api.deletePlanned(id);
  }

  const countFor = (date: string) => planned.filter((p) => p.date === date).length;
  const goWeek = (o: number) => router.push(o === 0 ? '/week' : `/week?offset=${o}`);

  const first = dates[0], last = dates[6];
  const range = monthShort(first) === monthShort(last)
    ? `${dayNum(first)}–${dayNum(last)} ${monthShort(last)}`
    : `${dayNum(first)} ${monthShort(first)} – ${dayNum(last)} ${monthShort(last)}`;

  const selDate = dates[selected];
  const selItems = planned.filter((p) => p.date === selDate);

  return (
    <>
      {/* Навигация по неделям */}
      <div className="wk-nav">
        <span className="wk-nav-range">
          {range}
          {offset === 0 && <span className="wk-nav-tag">эта неделя</span>}
        </span>
        <div className="wk-nav-btns">
          {offset !== 0 && <button className="wk-today-btn" onClick={() => goWeek(0)}>Сегодня</button>}
          <button className="icon-btn" onClick={() => goWeek(offset - 1)} aria-label="Прошлая неделя"><ChevronLeft className="icon" /></button>
          <button className="icon-btn" onClick={() => goWeek(offset + 1)} aria-label="Следующая неделя"><ChevronRight className="icon" /></button>
        </div>
      </div>

      {/* Полоса дней недели */}
      <div className="wk-strip">
        {dates.map((date, i) => {
          const n = countFor(date);
          const isToday = date === today;
          const isPast = date < today;
          return (
            <button
              key={date}
              className={`wk-cell${i === selected ? ' sel' : ''}${isToday ? ' today' : ''}${isPast ? ' past' : ''}${i >= 5 ? ' weekend' : ''}`}
              onClick={() => setSelected(i)}
            >
              <span className="wk-cell-wd">{WD_SHORT[i]}</span>
              <span className="wk-cell-day">{dayNum(date)}</span>
              <span className="wk-cell-dot">
                {Array.from({ length: Math.min(n, 3) }).map((_, k) => <i key={k} />)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Планы выбранного дня */}
      <div className="section">
        <div className="section-head">
          <span className="section-label">
            <CalendarRange /> {WD_FULL[selected]}, {dayNum(selDate)} {monthShort(selDate)}
            {selDate === today && <span className="wk-nav-tag">сегодня</span>}
          </span>
          {selItems.length > 0 && <span className="section-aside">{selItems.length}</span>}
        </div>
        <div className={`task-list${selItems.length === 0 ? ' task-list-empty' : ''}`}>
          {selItems.length === 0 && (
            <div className="wk-empty">
              <span className="wk-empty-icon"><CalendarRange /></span>
              <span>На этот день планов пока нет</span>
            </div>
          )}
          {selItems.map((p) => {
            const color = p.template_color ?? 'var(--accent)';
            return (
              <div key={p.id} className="task-row">
                <span className="task-dot" style={{ background: color, opacity: 0.65 }} />
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
          <button className="add-row" onClick={() => setAddDate(selDate)}><Plus /> Добавить план</button>
        </div>
      </div>

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
