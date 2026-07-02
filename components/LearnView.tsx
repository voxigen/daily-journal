'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import AppShell from './AppShell';
import { schedule, newCardFields, isNewCard, Rating, type StoredCard } from '@/lib/fsrs';
import { sfx } from '@/lib/sound';
import { Volume2, Upload, Plus, GraduationCap, Check, X, ArrowRight, Trash2, Pencil, PartyPopper } from 'lucide-react';

type Row = { id: string; en: string; ru: string; due: string; fsrs: StoredCard | null };
type Method = 'en_ru' | 'ru_en' | 'type';
type SWord = { row: Row; methods: Method[]; step: number; errors: number };
type Opt = { text: string; correct: boolean };
type Task = { wIdx: number; method: Method; options?: Opt[]; answerEn: string; ru: string };

const SESSION_MAX = 12;

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.!?]+$/, '');
function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}
function speak(text: string) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US'; u.rate = 0.92;
    synth.speak(u);
  } catch { /* speech not available */ }
}

export default function LearnView({ userId, initialCards }: { userId: string; initialCards: Row[] }) {
  const [cards, setCards] = useState<Row[]>(initialCards);
  const [screen, setScreen] = useState<'home' | 'session' | 'done'>('home');
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState('');
  const [addEn, setAddEn] = useState('');
  const [addRu, setAddRu] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editEn, setEditEn] = useState('');
  const [editRu, setEditRu] = useState('');

  const [task, setTask] = useState<Task | null>(null);
  const [phase, setPhase] = useState<'ask' | 'right' | 'wrong'>('ask');
  const [chosen, setChosen] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [, force] = useState(0);

  const sessionRef = useRef<SWord[]>([]);
  const lastIdxRef = useRef(-1);
  const doneRef = useRef({ learned: 0, reviewed: 0 });
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const dueCount = cards.filter((c) => new Date(c.due).getTime() <= Date.now()).length;
  const remaining = sessionRef.current.reduce((n, w) => n + (w.methods.length - w.step), 0);

  // ── Deck management ──
  async function addWord() {
    const en = addEn.trim(), ru = addRu.trim();
    if (!en || !ru) return;
    const nf = newCardFields();
    const { data } = await supabase.from('vocab_cards').insert({ user_id: userId, en, ru, due: nf.due, fsrs: nf.fsrs }).select('id, en, ru, due, fsrs').single();
    if (data) { setCards((p) => [...p, data as Row]); setAddEn(''); setAddRu(''); }
  }

  async function deleteWord(id: string) {
    setCards((p) => p.filter((c) => c.id !== id));
    await supabase.from('vocab_cards').delete().eq('id', id);
  }

  function startEdit(c: Row) { setEditId(c.id); setEditEn(c.en); setEditRu(c.ru); }
  async function saveEdit() {
    const en = editEn.trim(), ru = editRu.trim();
    if (!editId || !en || !ru) { setEditId(null); return; }
    const id = editId;
    setCards((p) => p.map((c) => (c.id === id ? { ...c, en, ru } : c)));
    setEditId(null);
    await supabase.from('vocab_cards').update({ en, ru }).eq('id', id);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setMsg('');
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
      const items: { en: string; ru: string }[] = [];
      for (const r of rows) {
        const en = String(r[0] ?? '').trim();
        const ru = String(r[1] ?? '').trim();
        if (!en || !ru) continue;
        if (['en', 'english', 'word', 'слово', 'англ', 'английский'].includes(en.toLowerCase())) continue;
        items.push({ en, ru });
      }
      if (!items.length) { setMsg('Не нашёл слов. Колонка A — английские, B — перевод.'); return; }
      const nf = newCardFields();
      const payload = items.map((it) => ({ user_id: userId, en: it.en, ru: it.ru, due: nf.due, fsrs: nf.fsrs }));
      const { data, error } = await supabase.from('vocab_cards').insert(payload).select('id, en, ru, due, fsrs');
      if (error) { setMsg('Ошибка импорта: ' + error.message); return; }
      if (data) setCards((p) => [...p, ...(data as Row[])]);
      setMsg(`Добавлено слов: ${data?.length ?? 0}`);
    } catch {
      setMsg('Не удалось прочитать файл — нужен .xlsx/.csv');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  // ── Session ──
  function startSession() {
    const now = Date.now();
    const due = cards.filter((c) => new Date(c.due).getTime() <= now);
    const reviews = due.filter((c) => !isNewCard(c.fsrs));
    const news = due.filter((c) => isNewCard(c.fsrs));
    const picked = [...reviews, ...news].slice(0, SESSION_MAX);
    if (!picked.length) { setMsg('Нет слов к повторению — добавь слова или загляни позже.'); return; }
    sessionRef.current = picked.map((row) => {
      const methods: Method[] = isNewCard(row.fsrs)
        ? [...shuffle<Method>(['en_ru', 'ru_en']), 'type']
        : [...shuffle<Method>(['en_ru', 'ru_en']).slice(0, 1), 'type'];
      return { row, methods, step: 0, errors: 0 };
    });
    lastIdxRef.current = -1;
    doneRef.current = { learned: 0, reviewed: 0 };
    setMsg('');
    setScreen('session');
    pickNext();
  }

  function buildOptions(w: SWord, method: Method): Opt[] {
    const distract = shuffle(cards.filter((c) => c.id !== w.row.id)).slice(0, 3);
    const correct: Opt = method === 'en_ru' ? { text: w.row.ru, correct: true } : { text: w.row.en, correct: true };
    const wrong: Opt[] = distract.map((d) => ({ text: method === 'en_ru' ? d.ru : d.en, correct: false }));
    return shuffle([correct, ...wrong]);
  }

  function pickNext() {
    const s = sessionRef.current;
    const pending = s.map((w, i) => ({ w, i })).filter((x) => x.w.step < x.w.methods.length);
    if (!pending.length) { void finishSession(); return; }
    let choices = pending.filter((x) => x.i !== lastIdxRef.current);
    if (!choices.length) choices = pending;
    const pick = choices[Math.floor(Math.random() * choices.length)];
    lastIdxRef.current = pick.i;
    const method = pick.w.methods[pick.w.step];
    setTask({
      wIdx: pick.i,
      method,
      options: method === 'type' ? undefined : buildOptions(pick.w, method),
      answerEn: pick.w.row.en,
      ru: pick.w.row.ru,
    });
    setPhase('ask'); setChosen(null); setInput('');
    // Only auto-speak when English is the prompt (en_ru). For recall modes (ru_en,
    // type) speaking it aloud would give the answer away — use the 🔊 button.
    if (method === 'en_ru') window.setTimeout(() => speak(pick.w.row.en), 180);
  }

  function grade(correct: boolean) {
    if (!task) return;
    const w = sessionRef.current[task.wIdx];
    if (correct) w.step += 1; else w.errors += 1;
    setPhase(correct ? 'right' : 'wrong');
    sfx(correct ? 'correct' : 'wrong');
    speak(w.row.en);
    force((n) => n + 1);
  }
  function chooseOption(o: Opt) { if (phase === 'ask') { setChosen(o.text); grade(o.correct); } }
  function submitType() { if (phase === 'ask' && task) grade(norm(input) === norm(task.answerEn)); }

  async function finishSession() {
    const s = sessionRef.current;
    const updated: Record<string, Row> = {};
    for (const w of s) {
      const rating = w.errors === 0 ? Rating.Good : Rating.Hard;
      if (isNewCard(w.row.fsrs)) doneRef.current.learned++; else doneRef.current.reviewed++;
      const sched = schedule(w.row.fsrs, rating);
      updated[w.row.id] = { ...w.row, due: sched.due, fsrs: sched.fsrs };
      await supabase.from('vocab_cards').update({ due: sched.due, fsrs: sched.fsrs }).eq('id', w.row.id);
    }
    setCards((prev) => prev.map((c) => updated[c.id] ?? c));
    sfx('success');
    setScreen('done');
  }

  // ── Screens ──
  if (screen === 'session' && task) {
    return (
      <AppShell title="Английский">
        <div className="learn-progress">Осталось шагов: {remaining}</div>
        <div className="learn-card">
          <button className="learn-speak" onClick={() => speak(task.answerEn)} aria-label="Озвучить"><Volume2 /></button>
          <div className={`learn-word${task.method !== 'en_ru' ? ' ru' : ''}`}>{task.method === 'en_ru' ? task.answerEn : task.ru}</div>
          <div className="learn-sub">
            {task.method === 'en_ru' ? 'Выбери перевод' : task.method === 'ru_en' ? 'Выбери слово по-английски' : 'Напиши слово по-английски'}
          </div>

          {task.options && (
            <div className="learn-options">
              {task.options.map((o, i) => {
                const cls = phase === 'ask' ? '' : o.correct ? ' correct' : (o.text === chosen ? ' wrong' : '');
                return (
                  <button key={i} className={`learn-opt${cls}`} disabled={phase !== 'ask'} onClick={() => chooseOption(o)}>{o.text}</button>
                );
              })}
            </div>
          )}

          {task.method === 'type' && (
            <form className="learn-type" onSubmit={(e) => { e.preventDefault(); submitType(); }}>
              <input autoFocus value={input} disabled={phase !== 'ask'} onChange={(e) => setInput(e.target.value)} placeholder="type here…" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
              {phase === 'ask' && <button className="btn btn-primary" type="submit" disabled={!input.trim()}>Проверить</button>}
            </form>
          )}

          {phase !== 'ask' && (
            <div className={`learn-feedback ${phase}`}>
              {phase === 'right' ? <span><Check className="icon-sm" /> Верно</span> : <span><X className="icon-sm" /> Правильно: <b>{task.answerEn}</b></span>}
              <button className="btn btn-primary btn-sm" onClick={pickNext}>Дальше <ArrowRight className="icon-sm" /></button>
            </div>
          )}
        </div>
      </AppShell>
    );
  }

  if (screen === 'done') {
    return (
      <AppShell title="Английский">
        <div className="learn-done">
          <div className="learn-done-icon"><PartyPopper /></div>
          <div className="empty-title">Сессия завершена</div>
          <p>Выучено новых: {doneRef.current.learned} · Повторено: {doneRef.current.reviewed}</p>
          <div className="save-row" style={{ justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => setScreen('home')}>Готово</button>
            {dueCount > 0 && <button className="btn btn-secondary" onClick={startSession}>Ещё ({Math.min(dueCount, SESSION_MAX)})</button>}
          </div>
        </div>
      </AppShell>
    );
  }

  // Home
  return (
    <AppShell title="Английский" subtitle="Интервальное повторение">
      <div className="metrics">
        <div className="metric"><div className="metric-val">{cards.length}</div><div className="metric-lbl">слов всего</div></div>
        <div className="metric"><div className="metric-val">{dueCount}</div><div className="metric-lbl">к повторению</div></div>
      </div>

      <button className="btn btn-primary btn-block" style={{ marginBottom: 22 }} disabled={dueCount === 0} onClick={startSession}>
        <GraduationCap className="icon-sm" /> {dueCount > 0 ? `Начать (${Math.min(dueCount, SESSION_MAX)})` : 'На сегодня всё'}
      </button>

      <div className="section">
        <div className="section-head"><span className="section-label"><Upload /> Импорт из Excel</span></div>
        <div className="setting-card">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleImport} />
          <button className="btn btn-secondary" disabled={importing} onClick={() => fileRef.current?.click()}>
            {importing ? 'Читаю…' : 'Выбрать файл'}
          </button>
          <div className="setting-hint">Колонка A — английские слова, B — перевод. Строка-заголовок пропускается.</div>
          {msg && <div className="setting-hint" style={{ color: 'var(--accent)' }}>{msg}</div>}
        </div>
      </div>

      <div className="section">
        <div className="section-head"><span className="section-label"><Plus /> Добавить вручную</span></div>
        <div className="setting-card">
          <div className="learn-add">
            <input placeholder="English" value={addEn} maxLength={100} onChange={(e) => setAddEn(e.target.value)} />
            <input placeholder="Перевод" value={addRu} maxLength={100} onChange={(e) => setAddRu(e.target.value)} />
            <button className="btn btn-primary" onClick={addWord} disabled={!addEn.trim() || !addRu.trim()}>Добавить</button>
          </div>
        </div>
      </div>

      {cards.length > 0 && (
        <div className="section">
          <div className="section-head"><span className="section-label">Слова ({cards.length})</span></div>
          <div className="tpl-list">
            {cards.slice(0, 60).map((c) => (
              editId === c.id ? (
                <div key={c.id} className="tpl-row">
                  <div className="learn-add" style={{ flex: 1 }}>
                    <input value={editEn} maxLength={100} onChange={(e) => setEditEn(e.target.value)} placeholder="English" />
                    <input value={editRu} maxLength={100} onChange={(e) => setEditRu(e.target.value)} placeholder="Перевод" />
                  </div>
                  <div className="tpl-row-actions">
                    <button className="icon-btn" onClick={saveEdit} aria-label="Сохранить"><Check className="icon-sm" /></button>
                    <button className="icon-btn" onClick={() => setEditId(null)} aria-label="Отмена"><X className="icon-sm" /></button>
                  </div>
                </div>
              ) : (
                <div key={c.id} className="tpl-row">
                  <div className="tpl-row-info">
                    <div className="tpl-row-name">{c.en}</div>
                    <div className="tpl-row-meta">{c.ru}</div>
                  </div>
                  <div className="tpl-row-actions">
                    <button className="icon-btn" onClick={() => speak(c.en)} aria-label="Озвучить"><Volume2 className="icon-sm" /></button>
                    <button className="icon-btn" onClick={() => startEdit(c)} aria-label="Изменить"><Pencil className="icon-sm" /></button>
                    <button className="icon-btn danger" onClick={() => deleteWord(c.id)} aria-label="Удалить"><Trash2 className="icon-sm" /></button>
                  </div>
                </div>
              )
            ))}
          </div>
          {cards.length > 60 && <div className="setting-hint">…и ещё {cards.length - 60}</div>}
        </div>
      )}
    </AppShell>
  );
}
