'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatDuration, compressImage, uid } from '@/lib/utils';
import AddTaskModal from './AddTaskModal';
import {
  Clock, ArrowRight, Pencil, Trash2, Plus, ImagePlus, X, ChevronLeft, StickyNote, ListTodo, UtensilsCrossed,
} from 'lucide-react';

type Template = {
  id: string; name: string; color: string; icon: string;
  fields: { name: string; placeholder: string; type: string }[];
};

type Task = {
  id: string;
  template_id?: string;
  template_name?: string;
  template_color?: string;
  template_icon?: string;
  title: string;
  fields_data?: Record<string, string>;
  duration_minutes?: number;
};

type MealItem = { id: string; name: string; kcal: string };
type Meal = { id: string; name: string; items: MealItem[] };
type MealRaw = { name?: string; items?: { name?: string; kcal?: number | string }[] };

type DayData = { planned_next?: string; notes?: string; photo_urls?: string[]; meals?: MealRaw[] };

type Props = {
  userId: string;
  date: string;
  initialTasks: Task[];
  initialDay: DayData | null;
  plannedFromYesterday: string | null;
  templates: Template[];
  backHref?: string;
};

const BUCKET = 'day-photos';

function pathFromUrl(url: string): string | null {
  const marker = `/${BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}

function loadMeals(raw?: MealRaw[]): Meal[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((m) => ({
    id: uid(),
    name: m.name ?? '',
    items: Array.isArray(m.items)
      ? m.items.map((it) => ({ id: uid(), name: it.name ?? '', kcal: it.kcal != null ? String(it.kcal) : '' }))
      : [],
  }));
}

function serializeMeals(meals: Meal[]): MealRaw[] {
  return meals.map((m) => ({
    name: m.name,
    items: m.items.map((it) => ({ name: it.name, kcal: Number(it.kcal) || 0 })),
  }));
}

function mealKcal(m: Meal): number {
  return m.items.reduce((s, it) => s + (Number(it.kcal) || 0), 0);
}

export default function DayView({
  userId, date, initialTasks, initialDay, plannedFromYesterday, templates, backHref,
}: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [plannedNext, setPlannedNext] = useState(initialDay?.planned_next ?? '');
  const [notes, setNotes] = useState(initialDay?.notes ?? '');
  const [photoUrls, setPhotoUrls] = useState<string[]>(initialDay?.photo_urls ?? []);
  const [meals, setMeals] = useState<Meal[]>(() => loadMeals(initialDay?.meals));
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [dayStatus, setDayStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const plannedRef = useRef(plannedNext); plannedRef.current = plannedNext;
  const notesRef = useRef(notes); notesRef.current = notes;
  const photosRef = useRef(photoUrls); photosRef.current = photoUrls;
  const mealsRef = useRef(meals); mealsRef.current = meals;

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const router = useRouter();

  async function saveDay(showStatus = true) {
    if (showStatus) setDayStatus('saving');
    await supabase.from('daily_days').upsert(
      {
        user_id: userId, date,
        planned_next: plannedRef.current,
        notes: notesRef.current,
        photo_urls: photosRef.current,
        meals: serializeMeals(mealsRef.current),
      },
      { onConflict: 'user_id,date' }
    );
    if (showStatus) {
      setDayStatus('saved');
      setTimeout(() => setDayStatus('idle'), 2000);
    }
  }

  function scheduleSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveDay(false), 1500);
  }

  // ── Tasks ──
  async function handleAddTask(taskData: Omit<Task, 'id'>) {
    const { data, error } = await supabase.from('day_tasks').insert({ ...taskData, user_id: userId, date }).select().single();
    if (!error && data) setTasks((p) => [...p, data]);
  }
  async function handleEditTask(taskData: Omit<Task, 'id'>) {
    if (!editingTask) return;
    const { data, error } = await supabase.from('day_tasks').update(taskData).eq('id', editingTask.id).select().single();
    if (!error && data) setTasks((p) => p.map((t) => (t.id === data.id ? data : t)));
  }
  async function handleDeleteTask(id: string) {
    setTasks((p) => p.filter((t) => t.id !== id));
    await supabase.from('day_tasks').delete().eq('id', id);
  }

  // ── Meals ──
  function updateMeals(next: Meal[]) {
    mealsRef.current = next;
    setMeals(next);
    scheduleSave();
  }
  function addMeal() {
    updateMeals([...meals, { id: uid(), name: `Приём пищи ${meals.length + 1}`, items: [{ id: uid(), name: '', kcal: '' }] }]);
  }
  function removeMeal(id: string) {
    updateMeals(meals.filter((m) => m.id !== id));
  }
  function setMealName(id: string, name: string) {
    updateMeals(meals.map((m) => (m.id === id ? { ...m, name } : m)));
  }
  function addItem(mealId: string) {
    updateMeals(meals.map((m) => (m.id === mealId ? { ...m, items: [...m.items, { id: uid(), name: '', kcal: '' }] } : m)));
  }
  function setItem(mealId: string, itemId: string, field: 'name' | 'kcal', val: string) {
    updateMeals(meals.map((m) => m.id === mealId
      ? { ...m, items: m.items.map((it) => (it.id === itemId ? { ...it, [field]: val } : it)) }
      : m));
  }
  function removeItem(mealId: string, itemId: string) {
    updateMeals(meals.map((m) => (m.id === mealId ? { ...m, items: m.items.filter((it) => it.id !== itemId) } : m)));
  }

  // ── Photos ──
  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const compressed = await compressImage(file);
      const path = `${userId}/${date}/${Date.now()}.jpg`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, compressed, { contentType: 'image/jpeg' });
      if (error) { alert('Не удалось загрузить фото: ' + error.message); return; }
      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const next = [...photosRef.current, publicUrl];
      photosRef.current = next;
      setPhotoUrls(next);
      await saveDay(false);
    } finally {
      setUploadingPhoto(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }
  async function handleDeletePhoto(url: string) {
    const next = photosRef.current.filter((u) => u !== url);
    photosRef.current = next;
    setPhotoUrls(next);
    const path = pathFromUrl(url);
    if (path) await supabase.storage.from(BUCKET).remove([path]);
    await saveDay(false);
  }

  const totalMinutes = tasks.reduce((s, t) => s + (t.duration_minutes ?? 0), 0);
  const totalKcal = meals.reduce((s, m) => s + mealKcal(m), 0);

  return (
    <>
      {backHref && (
        <button className="back-link" onClick={() => router.push(backHref)}>
          <ChevronLeft /> История
        </button>
      )}

      <div className="metrics">
        <div className="metric">
          <div className="metric-val">{tasks.length}</div>
          <div className="metric-lbl">дел сделано</div>
        </div>
        <div className="metric">
          <div className="metric-val">{totalMinutes ? formatDuration(totalMinutes) : '—'}</div>
          <div className="metric-lbl">времени потрачено</div>
        </div>
      </div>

      {plannedFromYesterday && (
        <div className="section">
          <div className="callout">
            <div className="callout-label"><ArrowRight /> планировал на этот день</div>
            <div className="callout-text">{plannedFromYesterday}</div>
          </div>
        </div>
      )}

      {/* Tasks */}
      <div className="section">
        <div className="section-head">
          <span className="section-label"><ListTodo /> Выполненные дела</span>
        </div>
        <div className={`task-list${tasks.length === 0 ? ' task-list-empty' : ''}`}>
          {tasks.map((task) => {
            const color = task.template_color ?? 'var(--accent)';
            const fields = task.fields_data ? Object.entries(task.fields_data).filter(([, v]) => v) : [];
            return (
              <div key={task.id} className="task-row">
                <span className="task-dot" style={{ background: color }} />
                <div className="task-body">
                  <div className="task-top">
                    <span className="task-title">{task.title}</span>
                    {task.template_name && (
                      <span className="task-chip" style={{ '--chip-bg': `${color}1f`, '--chip-fg': color } as React.CSSProperties}>
                        {task.template_icon} {task.template_name}
                      </span>
                    )}
                  </div>
                  {fields.length > 0 && (
                    <div className="task-sub">
                      {fields.map(([k, v]) => (
                        <span key={k} className="task-field"><b>{k}:</b> {v}</span>
                      ))}
                    </div>
                  )}
                  {task.duration_minutes ? (
                    <span className="task-time"><Clock /> {formatDuration(task.duration_minutes)}</span>
                  ) : null}
                </div>
                <div className="task-actions">
                  <button className="task-action" onClick={() => { setEditingTask(task); setShowModal(true); }} aria-label="Изменить"><Pencil /></button>
                  <button className="task-action del" onClick={() => handleDeleteTask(task.id)} aria-label="Удалить"><Trash2 /></button>
                </div>
              </div>
            );
          })}
          <button className="add-row" onClick={() => { setEditingTask(null); setShowModal(true); }}>
            <Plus /> Добавить дело
          </button>
        </div>
      </div>

      {/* Meals */}
      <div className="section">
        <div className="section-head">
          <span className="section-label"><UtensilsCrossed /> Питание</span>
          {totalKcal > 0 && <span className="section-aside">{totalKcal} ккал</span>}
        </div>

        {meals.map((m, mi) => (
          <div className="meal" key={m.id}>
            <div className="meal-head">
              <input
                className="meal-name"
                value={m.name}
                maxLength={60}
                placeholder={`Приём пищи ${mi + 1}`}
                onChange={(e) => setMealName(m.id, e.target.value)}
              />
              {mealKcal(m) > 0 && <span className="meal-kcal">{mealKcal(m)} ккал</span>}
              <button className="meal-del" onClick={() => removeMeal(m.id)} aria-label="Удалить приём"><X /></button>
            </div>
            <div className="meal-items">
              {m.items.map((it) => (
                <div className="meal-item" key={it.id}>
                  <input
                    className="mi-name"
                    value={it.name}
                    maxLength={80}
                    placeholder="Что съел"
                    onChange={(e) => setItem(m.id, it.id, 'name', e.target.value)}
                  />
                  <div className="mi-kcal-wrap">
                    <input
                      className="mi-kcal"
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={it.kcal}
                      placeholder="0"
                      onChange={(e) => setItem(m.id, it.id, 'kcal', e.target.value)}
                    />
                    <span className="mi-unit">ккал</span>
                  </div>
                  <button className="mi-del" onClick={() => removeItem(m.id, it.id)} aria-label="Удалить продукт"><X /></button>
                </div>
              ))}
            </div>
            <button className="meal-add-item" onClick={() => addItem(m.id)}><Plus /> продукт</button>
          </div>
        ))}

        <button className="add-row add-row-solo" onClick={addMeal}>
          <Plus /> Добавить приём пищи
        </button>
      </div>

      {/* Photos */}
      <div className="section">
        <div className="section-head">
          <span className="section-label"><ImagePlus /> Фото дня</span>
        </div>
        <div className="photo-grid">
          {photoUrls.map((url) => (
            <div key={url} className="photo-thumb" onClick={() => setLightbox(url)}>
              <img src={url} alt="" />
              <button className="photo-del" onClick={(e) => { e.stopPropagation(); handleDeletePhoto(url); }} aria-label="Удалить фото"><X /></button>
            </div>
          ))}
          <button className="photo-add" onClick={() => fileRef.current?.click()} disabled={uploadingPhoto}>
            {uploadingPhoto ? <Clock className="icon-lg" /> : <ImagePlus />}
            {uploadingPhoto ? 'Загрузка…' : 'Добавить'}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
      </div>

      {/* Plans */}
      <div className="section">
        <div className="section-head">
          <span className="section-label"><ArrowRight /> Планы на завтра</span>
        </div>
        <textarea
          className="day-textarea"
          value={plannedNext}
          onChange={(e) => { setPlannedNext(e.target.value); scheduleSave(); }}
          placeholder="Что планируешь сделать завтра?"
          rows={4}
        />
      </div>

      {/* Notes */}
      <div className="section">
        <div className="section-head">
          <span className="section-label"><StickyNote /> Заметки дня</span>
        </div>
        <textarea
          className="day-textarea"
          value={notes}
          onChange={(e) => { setNotes(e.target.value); scheduleSave(); }}
          placeholder="Мысли, наблюдения, важные детали…"
          rows={3}
        />
      </div>

      <div className="save-row">
        <button className="btn btn-secondary" onClick={() => saveDay(true)} disabled={dayStatus === 'saving'}>
          {dayStatus === 'saving' ? 'Сохраняю…' : 'Сохранить день'}
        </button>
        {dayStatus === 'saved' && <span className="save-hint ok">Сохранено</span>}
      </div>

      {showModal && (
        <AddTaskModal
          templates={templates}
          initial={editingTask ?? undefined}
          onSave={editingTask ? handleEditTask : handleAddTask}
          onClose={() => { setShowModal(false); setEditingTask(null); }}
        />
      )}

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" />
        </div>
      )}
    </>
  );
}
