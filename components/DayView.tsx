'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatDuration, compressImage } from '@/lib/utils';
import AddTaskModal from './AddTaskModal';
import {
  CheckCircle2, Clock, ArrowRight, Pencil, Trash2, Plus,
  Camera, X, Image as ImageIcon, ChevronLeft, Calendar, StickyNote,
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

type DayData = { planned_next?: string; notes?: string; photo_urls?: string[] };

type Props = {
  userId: string;
  date: string;
  displayDate: string;
  initialTasks: Task[];
  initialDay: DayData | null;
  plannedFromYesterday: string | null;
  templates: Template[];
  backHref?: string;
};

const BUCKET = 'day-photos';

// Extract storage path from a public URL: .../object/public/day-photos/<path>
function pathFromUrl(url: string): string | null {
  const marker = `/${BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}

export default function DayView({
  userId, date, displayDate, initialTasks, initialDay, plannedFromYesterday, templates, backHref,
}: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [plannedNext, setPlannedNext] = useState(initialDay?.planned_next ?? '');
  const [notes, setNotes] = useState(initialDay?.notes ?? '');
  const [photoUrls, setPhotoUrls] = useState<string[]>(initialDay?.photo_urls ?? []);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [dayStatus, setDayStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Refs always hold the latest values, so a debounced save can never
  // clobber the row with stale data (the photo-delete bug).
  const plannedRef = useRef(plannedNext); plannedRef.current = plannedNext;
  const notesRef = useRef(notes); notesRef.current = notes;
  const photosRef = useRef(photoUrls); photosRef.current = photoUrls;

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const router = useRouter();

  // ── Persist the day row (always reads latest via refs) ──
  async function saveDay(showStatus = true) {
    if (showStatus) setDayStatus('saving');
    await supabase.from('daily_days').upsert(
      {
        user_id: userId,
        date,
        planned_next: plannedRef.current,
        notes: notesRef.current,
        photo_urls: photosRef.current,
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
    const { data, error } = await supabase
      .from('day_tasks')
      .insert({ ...taskData, user_id: userId, date })
      .select()
      .single();
    if (!error && data) setTasks((p) => [...p, data]);
  }

  async function handleEditTask(taskData: Omit<Task, 'id'>) {
    if (!editingTask) return;
    const { data, error } = await supabase
      .from('day_tasks')
      .update(taskData)
      .eq('id', editingTask.id)
      .select()
      .single();
    if (!error && data) setTasks((p) => p.map((t) => (t.id === data.id ? data : t)));
  }

  async function handleDeleteTask(id: string) {
    setTasks((p) => p.filter((t) => t.id !== id));
    await supabase.from('day_tasks').delete().eq('id', id);
  }

  // ── Photos ──
  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const compressed = await compressImage(file);
      const path = `${userId}/${date}/${Date.now()}.jpg`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, compressed, {
        contentType: 'image/jpeg',
      });
      if (error) { alert('Не удалось загрузить фото: ' + error.message); return; }
      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const next = [...photosRef.current, publicUrl];
      photosRef.current = next; // keep ref current so saveDay sees the new photo immediately
      setPhotoUrls(next);
      await saveDay(false);
    } finally {
      setUploadingPhoto(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleDeletePhoto(url: string) {
    // Optimistic UI + keep refs honest before persisting
    const next = photosRef.current.filter((u) => u !== url);
    photosRef.current = next;
    setPhotoUrls(next);
    const path = pathFromUrl(url);
    if (path) await supabase.storage.from(BUCKET).remove([path]);
    await saveDay(false);
  }

  const totalMinutes = tasks.reduce((s, t) => s + (t.duration_minutes ?? 0), 0);

  return (
    <>
      <div className="day-page">
        {backHref && (
          <button className="back-link" onClick={() => router.push(backHref)}>
            <ChevronLeft /> Назад
          </button>
        )}

        {/* Stats */}
        <div className="stats-bar">
          <div className="stat-item">
            <div className="stat-val">{tasks.length}</div>
            <div className="stat-lbl">дел сделано</div>
          </div>
          <div className="stat-item">
            <div className="stat-val">{totalMinutes ? formatDuration(totalMinutes) : '—'}</div>
            <div className="stat-lbl">времени</div>
          </div>
        </div>

        {/* Planned from yesterday */}
        {plannedFromYesterday && (
          <div className="day-section">
            <div className="section-label"><ArrowRight /> Планировал на этот день</div>
            <div className="planned-box">
              <div className="planned-box-label"><Calendar /> со вчера</div>
              <div className="planned-box-text">{plannedFromYesterday}</div>
            </div>
          </div>
        )}

        {/* Tasks */}
        <div className="day-section">
          <div className="section-label"><CheckCircle2 /> Выполненные дела</div>
          <div className="tasks-list">
            {tasks.map((task) => {
              const color = task.template_color ?? 'var(--accent)';
              const fields = task.fields_data ? Object.entries(task.fields_data).filter(([, v]) => v) : [];
              return (
                <div
                  key={task.id}
                  className="task-card"
                  style={{ '--card-color': color, '--badge-bg': `${color}22`, '--badge-color': color } as React.CSSProperties}
                >
                  <div className="task-card-header">
                    {task.template_name && (
                      <span className="task-badge">{task.template_icon} {task.template_name}</span>
                    )}
                    <span className="task-title">{task.title}</span>
                    <div className="task-actions">
                      <button className="task-action-btn" onClick={() => { setEditingTask(task); setShowModal(true); }} aria-label="Изменить">
                        <Pencil />
                      </button>
                      <button className="task-action-btn delete" onClick={() => handleDeleteTask(task.id)} aria-label="Удалить">
                        <Trash2 />
                      </button>
                    </div>
                  </div>
                  {fields.length > 0 && (
                    <div className="task-fields">
                      {fields.map(([k, v]) => (
                        <div key={k} className="task-field-item">
                          <span className="task-field-name">{k}:</span>{v}
                        </div>
                      ))}
                    </div>
                  )}
                  {task.duration_minutes ? (
                    <div className="task-meta">
                      <span className="task-time"><Clock /> {formatDuration(task.duration_minutes)}</span>
                    </div>
                  ) : null}
                </div>
              );
            })}

            <button className="add-task-btn" onClick={() => { setEditingTask(null); setShowModal(true); }}>
              <Plus /> Добавить дело
            </button>
          </div>
        </div>

        {/* Photos */}
        <div className="day-section">
          <div className="section-label"><Camera /> Фото дня</div>
          <div className="photo-grid">
            {photoUrls.map((url) => (
              <div key={url} className="photo-thumb">
                <img src={url} alt="" />
                <button className="photo-delete" onClick={() => handleDeletePhoto(url)} aria-label="Удалить фото">
                  <X />
                </button>
              </div>
            ))}
            <button className="photo-upload-btn" onClick={() => fileRef.current?.click()} disabled={uploadingPhoto}>
              {uploadingPhoto ? <Clock className="icon-lg" /> : <ImageIcon />}
              {uploadingPhoto ? 'Загрузка…' : 'Добавить'}
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
        </div>

        {/* Plans for tomorrow */}
        <div className="day-section">
          <div className="section-label"><ArrowRight /> Планы на завтра</div>
          <textarea
            className="day-textarea"
            value={plannedNext}
            onChange={(e) => { setPlannedNext(e.target.value); scheduleSave(); }}
            placeholder="Что планируешь сделать завтра?"
            rows={4}
          />
        </div>

        {/* Notes */}
        <div className="day-section">
          <div className="section-label"><StickyNote /> Заметки дня</div>
          <textarea
            className="day-textarea"
            value={notes}
            onChange={(e) => { setNotes(e.target.value); scheduleSave(); }}
            placeholder="Мысли, наблюдения, важные детали…"
            rows={3}
          />
        </div>

        <div className="save-row">
          <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => saveDay(true)} disabled={dayStatus === 'saving'}>
            {dayStatus === 'saving' ? 'Сохраняю…' : 'Сохранить'}
          </button>
          {dayStatus === 'saved' && <span className="save-hint ok">✓ Сохранено</span>}
        </div>
      </div>

      {showModal && (
        <AddTaskModal
          templates={templates}
          initial={editingTask ?? undefined}
          onSave={editingTask ? handleEditTask : handleAddTask}
          onClose={() => { setShowModal(false); setEditingTask(null); }}
        />
      )}
    </>
  );
}
