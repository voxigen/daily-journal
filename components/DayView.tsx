'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDuration, compressImage } from '@/lib/utils';
import AddTaskModal from './AddTaskModal';

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

type DayData = {
  planned_next?: string;
  notes?: string;
  photo_urls?: string[];
};

type Props = {
  userId: string;
  date: string;
  displayDate: string;
  initialTasks: Task[];
  initialDay: DayData | null;
  plannedFromYesterday: string | null;
  templates: Template[];
};

export default function DayView({
  userId, date, displayDate, initialTasks, initialDay, plannedFromYesterday, templates,
}: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [plannedNext, setPlannedNext] = useState(initialDay?.planned_next ?? '');
  const [notes, setNotes] = useState(initialDay?.notes ?? '');
  const [photoUrls, setPhotoUrls] = useState<string[]>(initialDay?.photo_urls ?? []);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [savingDay, setSavingDay] = useState(false);
  const [savedDay, setSavedDay] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const planTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  // ── Tasks ──

  async function handleAddTask(taskData: Omit<Task, 'id'>) {
    const { data, error } = await supabase
      .from('day_tasks')
      .insert({ ...taskData, user_id: userId, date })
      .select()
      .single();
    if (!error && data) setTasks((prev) => [...prev, data]);
  }

  async function handleEditTask(taskData: Omit<Task, 'id'>) {
    if (!editingTask) return;
    const { data, error } = await supabase
      .from('day_tasks')
      .update(taskData)
      .eq('id', editingTask.id)
      .select()
      .single();
    if (!error && data) setTasks((prev) => prev.map((t) => (t.id === data.id ? data : t)));
  }

  async function handleDeleteTask(id: string) {
    await supabase.from('day_tasks').delete().eq('id', id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  // ── Day (planned / notes) ──

  function scheduleSaveDay(pn: string, n: string) {
    if (planTimer.current) clearTimeout(planTimer.current);
    planTimer.current = setTimeout(() => saveDay(pn, n), 1500);
  }

  async function saveDay(pn: string, n: string) {
    setSavingDay(true);
    await supabase.from('daily_days').upsert(
      { user_id: userId, date, planned_next: pn, notes: n, photo_urls: photoUrls },
      { onConflict: 'user_id,date' }
    );
    setSavingDay(false);
    setSavedDay(true);
    setTimeout(() => setSavedDay(false), 2000);
  }

  // ── Photos ──

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const compressed = await compressImage(file);
      const path = `${userId}/${date}/${Date.now()}.jpg`;
      const { error } = await supabase.storage.from('day-photos').upload(path, compressed);
      if (error) { alert('Ошибка загрузки фото: ' + error.message); return; }
      const { data: { publicUrl } } = supabase.storage.from('day-photos').getPublicUrl(path);
      const newUrls = [...photoUrls, publicUrl];
      setPhotoUrls(newUrls);
      await supabase.from('daily_days').upsert(
        { user_id: userId, date, planned_next: plannedNext, notes, photo_urls: newUrls },
        { onConflict: 'user_id,date' }
      );
    } finally {
      setUploadingPhoto(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleDeletePhoto(url: string) {
    const newUrls = photoUrls.filter((u) => u !== url);
    setPhotoUrls(newUrls);
    await supabase.from('daily_days').upsert(
      { user_id: userId, date, planned_next: plannedNext, notes, photo_urls: newUrls },
      { onConflict: 'user_id,date' }
    );
  }

  const totalMinutesToday = tasks.reduce((s, t) => s + (t.duration_minutes ?? 0), 0);

  return (
    <>
      <div className="day-page">

        {/* Stats bar */}
        <div className="stats-bar" style={{ marginBottom: 20 }}>
          <div className="stat-item">
            <div className="stat-val">{tasks.length}</div>
            <div className="stat-lbl">дел сделано</div>
          </div>
          <div className="stat-item">
            <div className="stat-val">{totalMinutesToday ? formatDuration(totalMinutesToday) : '—'}</div>
            <div className="stat-lbl">времени потрачено</div>
          </div>
        </div>

        {/* Planned from yesterday */}
        {plannedFromYesterday && (
          <div className="day-section">
            <div className="section-label">Планировал на сегодня</div>
            <div className="planned-box">
              <div className="planned-box-label">← со вчера</div>
              <div className="planned-box-text">{plannedFromYesterday}</div>
            </div>
          </div>
        )}

        {/* Tasks */}
        <div className="day-section">
          <div className="section-label">Выполненные дела — {displayDate}</div>
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
                      <span className="task-badge">
                        {task.template_icon} {task.template_name}
                      </span>
                    )}
                    <span className="task-title">{task.title}</span>
                    <div className="task-actions">
                      <button className="task-action-btn" onClick={() => { setEditingTask(task); setShowModal(true); }}>✏️</button>
                      <button className="task-action-btn delete" onClick={() => handleDeleteTask(task.id)}>🗑</button>
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
                      <span className="task-time">⏱ {formatDuration(task.duration_minutes)}</span>
                    </div>
                  ) : null}
                </div>
              );
            })}

            <button className="add-task-btn" onClick={() => { setEditingTask(null); setShowModal(true); }}>
              + Добавить дело
            </button>
          </div>
        </div>

        {/* Photos */}
        <div className="day-section">
          <div className="section-label">Фото дня</div>
          <div className="photo-grid">
            {photoUrls.map((url) => (
              <div key={url} className="photo-thumb">
                <img src={url} alt="" />
                <button className="photo-delete" onClick={() => handleDeletePhoto(url)}>✕</button>
              </div>
            ))}
            <button className="photo-upload-btn" onClick={() => fileRef.current?.click()} disabled={uploadingPhoto}>
              <span>{uploadingPhoto ? '⏳' : '📷'}</span>
              {uploadingPhoto ? 'Загрузка...' : 'Фото'}
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
        </div>

        {/* Plans for tomorrow */}
        <div className="day-section">
          <div className="section-label">Планы на завтра</div>
          <textarea
            className="day-textarea"
            value={plannedNext}
            onChange={(e) => { setPlannedNext(e.target.value); scheduleSaveDay(e.target.value, notes); }}
            placeholder="Что планируешь сделать завтра?"
            rows={4}
          />
        </div>

        {/* Notes */}
        <div className="day-section">
          <div className="section-label">Заметки дня</div>
          <textarea
            className="day-textarea"
            value={notes}
            onChange={(e) => { setNotes(e.target.value); scheduleSaveDay(plannedNext, e.target.value); }}
            placeholder="Мысли, наблюдения, важные детали..."
            rows={3}
          />
        </div>

        <button
          className="btn btn-primary"
          onClick={() => saveDay(plannedNext, notes)}
          disabled={savingDay}
          style={{ marginTop: 4 }}
        >
          {savingDay ? 'Сохраняю...' : savedDay ? '✓ Сохранено' : 'Сохранить планы и заметки'}
        </button>

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
