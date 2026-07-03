'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatDuration, compressImage, uid, addDays, mondayIndex } from '@/lib/utils';
import AddTaskModal from './AddTaskModal';
import RecurringModal, { RecurringInput } from './RecurringModal';
import ProductsModal from './ProductsModal';
import TemplateIcon from './TemplateIcon';
import {
  Clock, Pencil, Trash2, Plus, ImagePlus, X, ChevronLeft, StickyNote, ListTodo, UtensilsCrossed, CalendarPlus, Repeat,
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

type Planned = {
  id: string;
  title: string;
  template_id?: string;
  template_name?: string;
  template_color?: string;
  template_icon?: string;
  recurring_id?: string;
};

type Recurring = {
  id: string;
  title: string;
  template_id?: string;
  template_name?: string;
  template_color?: string;
  template_icon?: string;
  freq: 'daily' | 'weekly';
  weekdays?: number[];
  active?: boolean;
  last_spawned?: string | null;
};

type MealItem = { id: string; name: string; grams: string; kcal: string; kpg: string };
type Meal = { id: string; name: string; items: MealItem[] };
type MealRaw = { name?: string; items?: { name?: string; grams?: number | string; kcal?: number | string; kpg?: number | string }[] };
type Product = { id: string; name: string; kcal_per_gram: number };

type DayData = { notes?: string; photo_urls?: string[]; meals?: MealRaw[] };

type Props = {
  userId: string;
  date: string;
  initialTasks: Task[];
  initialDay: DayData | null;
  initialPlannedToday: Planned[];
  initialPlannedTomorrow: Planned[];
  templates: Template[];
  initialRecurring?: Recurring[];
  initialProducts?: Product[];
  backHref?: string;
};

type ModalState =
  | { mode: 'add' }
  | { mode: 'edit'; task: Task }
  | { mode: 'plan' }
  | { mode: 'complete'; planned: Planned };

const WD_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
function scheduleLabel(r: Recurring): string {
  if (r.freq === 'daily') return 'Каждый день';
  const days = (r.weekdays ?? []).slice().sort((a, b) => a - b);
  if (days.length === 0) return 'Дни не выбраны';
  if (days.length === 7) return 'Каждый день';
  return days.map((d) => WD_SHORT[d]).join(', ');
}

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
      ? m.items.map((it) => ({
          id: uid(),
          name: it.name ?? '',
          grams: it.grams != null ? String(it.grams) : '',
          kcal: it.kcal != null ? String(it.kcal) : '',
          kpg: it.kpg != null ? String(it.kpg) : '',
        }))
      : [],
  }));
}
function serializeMeals(meals: Meal[]): MealRaw[] {
  return meals.map((m) => ({
    name: m.name,
    items: m.items.map((it) => ({ name: it.name, grams: Number(it.grams) || 0, kcal: Number(it.kcal) || 0, kpg: Number(it.kpg) || 0 })),
  }));
}
function mealKcal(m: Meal): number {
  return m.items.reduce((s, it) => s + (Number(it.kcal) || 0), 0);
}

export default function DayView({
  userId, date, initialTasks, initialDay, initialPlannedToday, initialPlannedTomorrow, templates, initialRecurring, initialProducts, backHref,
}: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [plannedToday, setPlannedToday] = useState<Planned[]>(initialPlannedToday);
  const [plannedTomorrow, setPlannedTomorrow] = useState<Planned[]>(initialPlannedTomorrow);
  const [recurring, setRecurring] = useState<Recurring[]>(initialRecurring ?? []);
  const [recModal, setRecModal] = useState(false);
  const [notes, setNotes] = useState(initialDay?.notes ?? '');
  const [photoUrls, setPhotoUrls] = useState<string[]>(initialDay?.photo_urls ?? []);
  const [meals, setMeals] = useState<Meal[]>(() => loadMeals(initialDay?.meals));
  const [products, setProducts] = useState<Product[]>(initialProducts ?? []);
  const [prodModal, setProdModal] = useState(false);
  const [focusedItem, setFocusedItem] = useState<string | null>(null);
  const [quickKpg, setQuickKpg] = useState('');
  const [modal, setModal] = useState<ModalState | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const notesRef = useRef(notes); notesRef.current = notes;
  const photosRef = useRef(photoUrls); photosRef.current = photoUrls;
  const mealsRef = useRef(meals); mealsRef.current = meals;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const router = useRouter();
  const tomorrow = addDays(date, 1);

  async function saveDay() {
    await supabase.from('daily_days').upsert(
      { user_id: userId, date, notes: notesRef.current, photo_urls: photosRef.current, meals: serializeMeals(mealsRef.current) },
      { onConflict: 'user_id,date' }
    );
  }
  function scheduleSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveDay(), 1500);
  }
  // Flush pending autosave when leaving the tab/page (no manual save button anymore).
  useEffect(() => {
    const flush = () => {
      if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; void saveDay(); }
    };
    const onVis = () => { if (document.hidden) flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Done tasks ──
  async function handleAddTask(taskData: Omit<Task, 'id'>) {
    const { data, error } = await supabase.from('day_tasks').insert({ ...taskData, user_id: userId, date }).select().single();
    if (!error && data) setTasks((p) => [...p, data]);
  }
  async function handleEditTask(taskData: Omit<Task, 'id'>) {
    if (modal?.mode !== 'edit') return;
    const { data, error } = await supabase.from('day_tasks').update(taskData).eq('id', modal.task.id).select().single();
    if (!error && data) setTasks((p) => p.map((t) => (t.id === data.id ? data : t)));
  }
  async function handleDeleteTask(id: string) {
    setTasks((p) => p.filter((t) => t.id !== id));
    await supabase.from('day_tasks').delete().eq('id', id);
  }

  // ── Planned ──
  async function addPlanned(data: Omit<Task, 'id'>) {
    const { data: row, error } = await supabase.from('planned_tasks').insert({
      user_id: userId, date: tomorrow, title: data.title,
      template_id: data.template_id, template_name: data.template_name,
      template_color: data.template_color, template_icon: data.template_icon,
    }).select().single();
    if (!error && row) setPlannedTomorrow((p) => [...p, row]);
  }
  async function deletePlanned(id: string, which: 'today' | 'tomorrow') {
    if (which === 'today') setPlannedToday((p) => p.filter((x) => x.id !== id));
    else setPlannedTomorrow((p) => p.filter((x) => x.id !== id));
    await supabase.from('planned_tasks').delete().eq('id', id);
  }
  async function completePlanned(planned: Planned, data: Omit<Task, 'id'>) {
    const { data: row, error } = await supabase.from('day_tasks').insert({ ...data, user_id: userId, date }).select().single();
    if (!error && row) setTasks((p) => [...p, row]);
    setPlannedToday((p) => p.filter((x) => x.id !== planned.id));
    await supabase.from('planned_tasks').delete().eq('id', planned.id);
  }

  // ── Recurring plans ──
  // On the "today" view, turn each due rule into a to-do tile once per day. The
  // last_spawned guard stops it re-appearing after you complete or delete it today.
  const didSpawn = useRef(false);
  useEffect(() => {
    if (!initialRecurring || didSpawn.current) return;
    didSpawn.current = true;
    const wd = mondayIndex(date);
    const due = initialRecurring.filter(
      (r) => r.active !== false && r.last_spawned !== date &&
        (r.freq === 'daily' || (r.freq === 'weekly' && (r.weekdays ?? []).includes(wd)))
    );
    if (!due.length) return;
    (async () => {
      const rows = due.map((r) => ({
        user_id: userId, date, title: r.title,
        template_id: r.template_id ?? null, template_name: r.template_name ?? null,
        template_color: r.template_color ?? null, template_icon: r.template_icon ?? null,
        recurring_id: r.id,
      }));
      const { data, error } = await supabase.from('planned_tasks').insert(rows).select();
      if (!error && data?.length) setPlannedToday((p) => [...p, ...data]);
      const ids = due.map((r) => r.id);
      await supabase.from('recurring_plans').update({ last_spawned: date }).in('id', ids);
      setRecurring((prev) => prev.map((r) => (ids.includes(r.id) ? { ...r, last_spawned: date } : r)));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addRecurring(input: RecurringInput) {
    const { data, error } = await supabase.from('recurring_plans').insert({
      user_id: userId, title: input.title,
      template_id: input.template_id ?? null, template_name: input.template_name ?? null,
      template_color: input.template_color ?? null, template_icon: input.template_icon ?? null,
      freq: input.freq, weekdays: input.weekdays, active: true,
    }).select().single();
    if (error || !data) return;
    setRecurring((p) => [...p, data]);
    // If it's due today, drop a to-do tile in right away.
    const wd = mondayIndex(date);
    const dueToday = data.freq === 'daily' || (data.freq === 'weekly' && (data.weekdays ?? []).includes(wd));
    if (dueToday) {
      const { data: row } = await supabase.from('planned_tasks').insert({
        user_id: userId, date, title: data.title,
        template_id: data.template_id ?? null, template_name: data.template_name ?? null,
        template_color: data.template_color ?? null, template_icon: data.template_icon ?? null,
        recurring_id: data.id,
      }).select().single();
      if (row) setPlannedToday((p) => [...p, row]);
      await supabase.from('recurring_plans').update({ last_spawned: date }).eq('id', data.id);
      setRecurring((p) => p.map((x) => (x.id === data.id ? { ...x, last_spawned: date } : x)));
    }
  }

  async function deleteRecurring(id: string) {
    setRecurring((p) => p.filter((r) => r.id !== id));
    await supabase.from('recurring_plans').delete().eq('id', id);
  }

  // ── Meals ──
  const emptyItem = (): MealItem => ({ id: uid(), name: '', grams: '', kcal: '', kpg: '' });
  function updateMeals(next: Meal[]) { mealsRef.current = next; setMeals(next); scheduleSave(); }
  function addMeal() { updateMeals([...meals, { id: uid(), name: `Приём пищи ${meals.length + 1}`, items: [emptyItem()] }]); }
  function removeMeal(id: string) { updateMeals(meals.filter((m) => m.id !== id)); }
  function setMealName(id: string, name: string) { updateMeals(meals.map((m) => (m.id === id ? { ...m, name } : m))); }
  function addItem(mealId: string) { updateMeals(meals.map((m) => (m.id === mealId ? { ...m, items: [...m.items, emptyItem()] } : m))); }
  function removeItem(mealId: string, itemId: string) { updateMeals(meals.map((m) => (m.id === mealId ? { ...m, items: m.items.filter((it) => it.id !== itemId) } : m))); }
  function patchItem(mealId: string, itemId: string, patch: Partial<MealItem>) {
    updateMeals(meals.map((m) => m.id === mealId ? { ...m, items: m.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) } : m));
  }
  const calcKcal = (kpg: number, grams: number) => String(Math.round(kpg * grams));
  function setItemGrams(mealId: string, it: MealItem, grams: string) {
    const kpg = Number(it.kpg) || 0;
    patchItem(mealId, it.id, kpg > 0 ? { grams, kcal: calcKcal(kpg, Number(grams) || 0) } : { grams });
  }
  function setItemKcal(mealId: string, itemId: string, kcal: string) {
    patchItem(mealId, itemId, { kcal, kpg: '' }); // manual kcal unlinks the product
  }
  function pickProduct(mealId: string, it: MealItem, p: Product) {
    const grams = Number(it.grams) || 0;
    patchItem(mealId, it.id, { name: p.name, kpg: String(p.kcal_per_gram), kcal: grams > 0 ? calcKcal(p.kcal_per_gram, grams) : it.kcal });
    setFocusedItem(null);
  }
  async function quickAddProduct(mealId: string, it: MealItem) {
    const name = it.name.trim();
    const kpg = Number(quickKpg);
    if (!name || !(kpg > 0)) return;
    const { data } = await supabase.from('products').insert({ user_id: userId, name, kcal_per_gram: kpg }).select().single();
    if (data) { setProducts((p) => [...p, data]); pickProduct(mealId, it, data); }
    setQuickKpg('');
  }

  // ── Products (кладовая) ──
  async function addProduct(name: string, kpg: number) {
    const { data } = await supabase.from('products').insert({ user_id: userId, name: name.trim(), kcal_per_gram: kpg }).select().single();
    if (data) setProducts((p) => [...p, data]);
  }
  async function editProduct(id: string, name: string, kpg: number) {
    setProducts((p) => p.map((x) => (x.id === id ? { ...x, name: name.trim(), kcal_per_gram: kpg } : x)));
    await supabase.from('products').update({ name: name.trim(), kcal_per_gram: kpg }).eq('id', id);
  }
  async function deleteProduct(id: string) {
    setProducts((p) => p.filter((x) => x.id !== id));
    await supabase.from('products').delete().eq('id', id);
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
      photosRef.current = next; setPhotoUrls(next);
      await saveDay();
    } finally {
      setUploadingPhoto(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }
  async function handleDeletePhoto(url: string) {
    const next = photosRef.current.filter((u) => u !== url);
    photosRef.current = next; setPhotoUrls(next);
    const path = pathFromUrl(url);
    if (path) await supabase.storage.from(BUCKET).remove([path]);
    await saveDay();
  }

  const totalMinutes = tasks.reduce((s, t) => s + (t.duration_minutes ?? 0), 0);
  const totalKcal = meals.reduce((s, m) => s + mealKcal(m), 0);

  // Modal wiring
  const modalInitial: Task | undefined =
    modal?.mode === 'edit' ? modal.task
    : modal?.mode === 'complete'
      ? { id: '', title: modal.planned.title, template_id: modal.planned.template_id, template_name: modal.planned.template_name, template_color: modal.planned.template_color, template_icon: modal.planned.template_icon }
      : undefined;
  const modalOnSave =
    modal?.mode === 'plan' ? addPlanned
    : modal?.mode === 'complete' ? (d: Omit<Task, 'id'>) => completePlanned(modal.planned, d)
    : modal?.mode === 'edit' ? handleEditTask
    : handleAddTask;

  function renderChip(p: { template_name?: string; template_color?: string; template_icon?: string }) {
    if (!p.template_name) return null;
    const color = p.template_color ?? 'var(--accent)';
    return <span className="task-chip" style={{ '--chip-bg': `${color}1f`, '--chip-fg': color } as React.CSSProperties}><TemplateIcon icon={p.template_icon} className="chip-ico" /> {p.template_name}</span>;
  }

  return (
    <>
      {backHref && (
        <button className="back-link" onClick={() => router.push(backHref)}><ChevronLeft /> История</button>
      )}

      <div className="metrics">
        <div className="metric"><div className="metric-val">{tasks.length}</div><div className="metric-lbl">дел сделано</div></div>
        <div className="metric"><div className="metric-val">{totalMinutes ? formatDuration(totalMinutes) : '—'}</div><div className="metric-lbl">времени потрачено</div></div>
      </div>

      {/* Planned for today (carried over) */}
      {plannedToday.length > 0 && (
        <div className="section">
          <div className="section-head">
            <span className="section-label"><ListTodo /> К выполнению</span>
            <span className="section-aside" style={{ color: 'var(--text-3)', fontWeight: 500 }}>нажми, чтобы отметить</span>
          </div>
          <div className="task-list">
            {plannedToday.map((p) => (
              <div key={p.id} className="task-row planned clickable" onClick={() => setModal({ mode: 'complete', planned: p })}>
                <span className="task-check" />
                <div className="task-body">
                  <div className="task-top"><span className="task-title">{p.title}</span>{renderChip(p)}</div>
                </div>
                <div className="task-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="task-action del" onClick={() => deletePlanned(p.id, 'today')} aria-label="Удалить"><Trash2 /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Done tasks */}
      <div className="section">
        <div className="section-head"><span className="section-label"><ListTodo /> Выполненные дела</span></div>
        <div className={`task-list${tasks.length === 0 ? ' task-list-empty' : ''}`}>
          {tasks.map((task) => {
            const color = task.template_color ?? 'var(--accent)';
            const fields = task.fields_data ? Object.entries(task.fields_data).filter(([, v]) => v) : [];
            return (
              <div key={task.id} className="task-row">
                <span className="task-dot" style={{ background: color }} />
                <div className="task-body">
                  <div className="task-top"><span className="task-title">{task.title}</span>{renderChip(task)}</div>
                  {fields.length > 0 && (
                    <div className="task-sub">{fields.map(([k, v]) => (<span key={k} className="task-field"><b>{k}:</b> {v}</span>))}</div>
                  )}
                  {task.duration_minutes ? <span className="task-time"><Clock /> {formatDuration(task.duration_minutes)}</span> : null}
                </div>
                <div className="task-actions">
                  <button className="task-action" onClick={() => setModal({ mode: 'edit', task })} aria-label="Изменить"><Pencil /></button>
                  <button className="task-action del" onClick={() => handleDeleteTask(task.id)} aria-label="Удалить"><Trash2 /></button>
                </div>
              </div>
            );
          })}
          <button className="add-row" onClick={() => setModal({ mode: 'add' })}><Plus /> Добавить дело</button>
        </div>
      </div>

      {/* Plans for tomorrow */}
      <div className="section">
        <div className="section-head"><span className="section-label"><CalendarPlus /> Планы на завтра</span></div>
        <div className={`task-list${plannedTomorrow.length === 0 ? ' task-list-empty' : ''}`}>
          {plannedTomorrow.map((p) => (
            <div key={p.id} className="task-row">
              <span className="task-dot" style={{ background: p.template_color ?? 'var(--accent)', opacity: 0.5 }} />
              <div className="task-body"><div className="task-top"><span className="task-title">{p.title}</span>{renderChip(p)}</div></div>
              <div className="task-actions">
                <button className="task-action del" onClick={() => deletePlanned(p.id, 'tomorrow')} aria-label="Удалить"><Trash2 /></button>
              </div>
            </div>
          ))}
          <button className="add-row" onClick={() => setModal({ mode: 'plan' })}><Plus /> Добавить в планы</button>
        </div>
      </div>

      {/* Recurring plans (today view only) */}
      {initialRecurring && (
        <div className="section">
          <div className="section-head">
            <span className="section-label"><Repeat /> Повторяющиеся планы</span>
          </div>
          <div className={`task-list${recurring.length === 0 ? ' task-list-empty' : ''}`}>
            {recurring.map((r) => (
              <div key={r.id} className="task-row">
                <span className="task-dot" style={{ background: r.template_color ?? 'var(--accent)' }} />
                <div className="task-body">
                  <div className="task-top"><span className="task-title">{r.title}</span>{renderChip(r)}</div>
                  <span className="task-time"><Repeat /> {scheduleLabel(r)}</span>
                </div>
                <div className="task-actions">
                  <button className="task-action del" onClick={() => deleteRecurring(r.id)} aria-label="Удалить"><Trash2 /></button>
                </div>
              </div>
            ))}
            <button className="add-row" onClick={() => setRecModal(true)}><Plus /> Добавить повтор</button>
          </div>
        </div>
      )}

      {/* Meals */}
      <div className="section">
        <div className="section-head">
          <span className="section-label"><UtensilsCrossed /> Питание</span>
          <span className="meal-head-right">
            {totalKcal > 0 && <span className="section-aside">{totalKcal} ккал</span>}
            <button className="link-btn" onClick={() => setProdModal(true)}>Мои продукты</button>
          </span>
        </div>
        {meals.map((m, mi) => (
          <div className="meal" key={m.id}>
            <div className="meal-head">
              <input className="meal-name" value={m.name} maxLength={60} placeholder={`Приём пищи ${mi + 1}`} onChange={(e) => setMealName(m.id, e.target.value)} />
              {mealKcal(m) > 0 && <span className="meal-kcal">{mealKcal(m)} ккал</span>}
              <button className="meal-del" onClick={() => removeMeal(m.id)} aria-label="Удалить приём"><X /></button>
            </div>
            <div className="meal-items">
              {m.items.map((it) => {
                const q = it.name.trim().toLowerCase();
                const matches = q ? products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 6) : [];
                const exact = products.some((p) => p.name.toLowerCase() === q);
                return (
                  <div className="meal-item" key={it.id}>
                    <div className="mi-ac">
                      <input
                        className="mi-name"
                        value={it.name}
                        maxLength={80}
                        placeholder="Начни писать продукт…"
                        onFocus={() => setFocusedItem(it.id)}
                        onChange={(e) => patchItem(m.id, it.id, { name: e.target.value })}
                        onBlur={() => window.setTimeout(() => setFocusedItem((f) => (f === it.id ? null : f)), 160)}
                      />
                      {focusedItem === it.id && q && (matches.length > 0 || !exact) && (
                        <div className="mi-dd">
                          {matches.map((p) => (
                            <button key={p.id} type="button" className="mi-opt" onMouseDown={(e) => { e.preventDefault(); pickProduct(m.id, it, p); }}>
                              <span className="mi-opt-name">{p.name}</span>
                              <span className="mi-opt-kpg">{p.kcal_per_gram} ккал/г</span>
                            </button>
                          ))}
                          {!exact && (
                            <div className="mi-quick" onMouseDown={(e) => e.preventDefault()}>
                              <span className="mi-quick-lbl">Добавить «{it.name.trim()}»</span>
                              <input className="mi-quick-in" type="number" step="0.1" min="0" inputMode="decimal" placeholder="ккал/г" value={quickKpg} onChange={(e) => setQuickKpg(e.target.value)} />
                              <button type="button" className="mi-quick-add" onMouseDown={(e) => { e.preventDefault(); quickAddProduct(m.id, it); }} aria-label="Добавить продукт"><Plus /></button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="mi-num-wrap">
                      <input className="mi-num" type="number" min="0" inputMode="numeric" value={it.grams} placeholder="0" onChange={(e) => setItemGrams(m.id, it, e.target.value)} />
                      <span className="mi-unit">г</span>
                    </div>
                    <div className="mi-num-wrap">
                      <input className="mi-num mi-kcal" type="number" min="0" inputMode="numeric" value={it.kcal} placeholder="0" onChange={(e) => setItemKcal(m.id, it.id, e.target.value)} />
                      <span className="mi-unit">ккал</span>
                    </div>
                    <button className="mi-del" onClick={() => removeItem(m.id, it.id)} aria-label="Удалить продукт"><X /></button>
                  </div>
                );
              })}
            </div>
            <button className="meal-add-item" onClick={() => addItem(m.id)}><Plus /> продукт</button>
          </div>
        ))}
        <button className="add-row add-row-solo" onClick={addMeal}><Plus /> Добавить приём пищи</button>
      </div>

      {/* Photos */}
      <div className="section">
        <div className="section-head"><span className="section-label"><ImagePlus /> Фото дня</span></div>
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

      {/* Notes */}
      <div className="section">
        <div className="section-head"><span className="section-label"><StickyNote /> Заметки дня</span></div>
        <textarea className="day-textarea" value={notes} onChange={(e) => { setNotes(e.target.value); scheduleSave(); }} placeholder="Мысли, наблюдения, важные детали…" rows={3} />
      </div>

      {prodModal && (
        <ProductsModal
          products={products}
          onAdd={addProduct}
          onEdit={editProduct}
          onDelete={deleteProduct}
          onClose={() => setProdModal(false)}
        />
      )}

      {modal && (
        <AddTaskModal
          templates={templates}
          initial={modalInitial}
          planMode={modal.mode === 'plan'}
          submitLabel={modal.mode === 'complete' ? 'Отметить выполненным' : undefined}
          titleLabel={modal.mode === 'complete' ? 'Что сделал' : undefined}
          onSave={modalOnSave}
          onClose={() => setModal(null)}
        />
      )}

      {recModal && (
        <RecurringModal templates={templates} onSave={addRecurring} onClose={() => setRecModal(false)} />
      )}

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}><img src={lightbox} alt="" /></div>
      )}
    </>
  );
}
