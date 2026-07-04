'use server';

import { and, eq, inArray } from 'drizzle-orm';
import { promises as fs } from 'fs';
import path from 'path';
import { db, schema } from '@/lib/db';
import { requireUserId } from '@/lib/session';
import { toTask, toPlanned, toRecurring, toProduct, toVocab, toTemplate } from '@/lib/dto';

const { dailyDays, dayTasks, plannedTasks, recurringPlans, products, templates, vocabCards } = schema;

// ── Day (notes / photos / meals / weight autosave) ──
export async function saveDay(input: {
  date: string; notes: string; photoUrls: string[]; meals: unknown[]; weight: number | null;
}) {
  const uid = await requireUserId();
  const set = { notes: input.notes, photoUrls: input.photoUrls, meals: input.meals, weight: input.weight };
  await db.insert(dailyDays)
    .values({ userId: uid, date: input.date, ...set })
    .onConflictDoUpdate({ target: [dailyDays.userId, dailyDays.date], set });
}

// ── Done tasks ──
type TaskInput = {
  title: string; template_id?: string; template_name?: string;
  template_color?: string; template_icon?: string;
  fields_data?: Record<string, string>; duration_minutes?: number;
};
function taskValues(uid: string, date: string, t: TaskInput) {
  return {
    userId: uid, date, title: t.title,
    templateId: t.template_id ?? null, templateName: t.template_name ?? null,
    templateColor: t.template_color ?? null, templateIcon: t.template_icon ?? null,
    fieldsData: t.fields_data ?? {}, durationMinutes: t.duration_minutes ?? null,
  };
}

export async function addTask(date: string, t: TaskInput) {
  const uid = await requireUserId();
  const [row] = await db.insert(dayTasks).values(taskValues(uid, date, t)).returning();
  return toTask(row);
}
export async function updateTask(id: string, date: string, t: TaskInput) {
  const uid = await requireUserId();
  const { userId: _u, ...set } = taskValues(uid, date, t);
  const [row] = await db.update(dayTasks).set(set)
    .where(and(eq(dayTasks.id, id), eq(dayTasks.userId, uid))).returning();
  return row ? toTask(row) : null;
}
export async function deleteTask(id: string) {
  const uid = await requireUserId();
  await db.delete(dayTasks).where(and(eq(dayTasks.id, id), eq(dayTasks.userId, uid)));
}

// ── Planned ──
type PlanInput = { title: string; template_id?: string; template_name?: string; template_color?: string; template_icon?: string };
export async function addPlanned(date: string, t: PlanInput) {
  const uid = await requireUserId();
  const [row] = await db.insert(plannedTasks).values({
    userId: uid, date, title: t.title,
    templateId: t.template_id ?? null, templateName: t.template_name ?? null,
    templateColor: t.template_color ?? null, templateIcon: t.template_icon ?? null,
  }).returning();
  return toPlanned(row);
}
export async function deletePlanned(id: string) {
  const uid = await requireUserId();
  await db.delete(plannedTasks).where(and(eq(plannedTasks.id, id), eq(plannedTasks.userId, uid)));
}
export async function completePlanned(plannedId: string, date: string, t: TaskInput) {
  const uid = await requireUserId();
  const [row] = await db.insert(dayTasks).values(taskValues(uid, date, t)).returning();
  await db.delete(plannedTasks).where(and(eq(plannedTasks.id, plannedId), eq(plannedTasks.userId, uid)));
  return toTask(row);
}

// ── Recurring ──
type RecInput = { title: string; template_id?: string; template_name?: string; template_color?: string; template_icon?: string; freq: 'daily' | 'weekly'; weekdays: number[] };

// Materialize due recurring rules into today's planned tiles (once per day).
export async function spawnRecurring(date: string, due: (PlanInput & { id: string })[]) {
  const uid = await requireUserId();
  if (!due.length) return [];
  const rows = await db.insert(plannedTasks).values(due.map((r) => ({
    userId: uid, date, title: r.title,
    templateId: r.template_id ?? null, templateName: r.template_name ?? null,
    templateColor: r.template_color ?? null, templateIcon: r.template_icon ?? null,
    recurringId: r.id,
  }))).onConflictDoNothing().returning();
  await db.update(recurringPlans).set({ lastSpawned: date })
    .where(and(eq(recurringPlans.userId, uid), inArray(recurringPlans.id, due.map((r) => r.id))));
  return rows.map(toPlanned);
}

export async function addRecurring(input: RecInput, date: string, dueToday: boolean) {
  const uid = await requireUserId();
  const [rec] = await db.insert(recurringPlans).values({
    userId: uid, title: input.title,
    templateId: input.template_id ?? null, templateName: input.template_name ?? null,
    templateColor: input.template_color ?? null, templateIcon: input.template_icon ?? null,
    freq: input.freq, weekdays: input.weekdays, active: true,
  }).returning();

  let planned = null;
  if (dueToday) {
    const [row] = await db.insert(plannedTasks).values({
      userId: uid, date, title: rec.title,
      templateId: rec.templateId, templateName: rec.templateName,
      templateColor: rec.templateColor, templateIcon: rec.templateIcon, recurringId: rec.id,
    }).onConflictDoNothing().returning();
    planned = row ? toPlanned(row) : null;
    await db.update(recurringPlans).set({ lastSpawned: date }).where(eq(recurringPlans.id, rec.id));
    rec.lastSpawned = date;
  }
  return { recurring: toRecurring(rec), planned };
}
export async function deleteRecurring(id: string) {
  const uid = await requireUserId();
  await db.delete(recurringPlans).where(and(eq(recurringPlans.id, id), eq(recurringPlans.userId, uid)));
}

// ── Products ──
export async function addProduct(name: string, kpg: number) {
  const uid = await requireUserId();
  const [row] = await db.insert(products).values({ userId: uid, name: name.trim(), kcalPerGram: kpg }).returning();
  return toProduct(row);
}
export async function updateProduct(id: string, name: string, kpg: number) {
  const uid = await requireUserId();
  await db.update(products).set({ name: name.trim(), kcalPerGram: kpg })
    .where(and(eq(products.id, id), eq(products.userId, uid)));
}
export async function deleteProduct(id: string) {
  const uid = await requireUserId();
  await db.delete(products).where(and(eq(products.id, id), eq(products.userId, uid)));
}

// ── Templates ──
type TemplateInput = { name: string; color: string; icon: string; fields: { name: string; placeholder: string; type: string }[] };
export async function addTemplate(data: TemplateInput) {
  const uid = await requireUserId();
  const [row] = await db.insert(templates).values({ userId: uid, ...data }).returning();
  return toTemplate(row);
}
export async function updateTemplate(id: string, data: TemplateInput) {
  const uid = await requireUserId();
  const [row] = await db.update(templates).set(data)
    .where(and(eq(templates.id, id), eq(templates.userId, uid))).returning();
  return row ? toTemplate(row) : null;
}
export async function deleteTemplate(id: string) {
  const uid = await requireUserId();
  await db.delete(templates).where(and(eq(templates.id, id), eq(templates.userId, uid)));
}

// ── Vocab (spaced repetition) ──
type Fsrs = Record<string, unknown>;
export async function addVocab(en: string, ru: string, due: string, fsrs: Fsrs) {
  const uid = await requireUserId();
  const [row] = await db.insert(vocabCards).values({ userId: uid, en, ru, due, fsrs }).returning();
  return toVocab(row);
}
export async function addVocabBulk(items: { en: string; ru: string; due: string; fsrs: Fsrs }[]) {
  const uid = await requireUserId();
  if (!items.length) return [];
  const rows = await db.insert(vocabCards)
    .values(items.map((it) => ({ userId: uid, en: it.en, ru: it.ru, due: it.due, fsrs: it.fsrs })))
    .returning();
  return rows.map(toVocab);
}
export async function deleteVocab(id: string) {
  const uid = await requireUserId();
  await db.delete(vocabCards).where(and(eq(vocabCards.id, id), eq(vocabCards.userId, uid)));
}
export async function updateVocab(id: string, en: string, ru: string) {
  const uid = await requireUserId();
  await db.update(vocabCards).set({ en, ru }).where(and(eq(vocabCards.id, id), eq(vocabCards.userId, uid)));
}
export async function reviewVocab(id: string, due: string, fsrs: Fsrs) {
  const uid = await requireUserId();
  await db.update(vocabCards).set({ due, fsrs }).where(and(eq(vocabCards.id, id), eq(vocabCards.userId, uid)));
}

// ── Photos (stored on the server's disk volume) ──
function uploadsDir() {
  return process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
}
export async function uploadPhoto(form: FormData): Promise<{ url: string } | { error: string }> {
  const uid = await requireUserId();
  const file = form.get('file');
  const date = String(form.get('date') || '');
  if (!(file instanceof File)) return { error: 'нет файла' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'неверная дата' };
  const buf = Buffer.from(await file.arrayBuffer());
  const name = `${Date.now()}.jpg`;
  const dir = path.join(uploadsDir(), uid, date);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), buf);
  return { url: `/api/uploads/${uid}/${date}/${name}` };
}
export async function deletePhoto(url: string) {
  const uid = await requireUserId();
  const m = url.match(/^\/api\/uploads\/([^/]+)\/(\d{4}-\d{2}-\d{2})\/([^/]+)$/);
  if (!m || m[1] !== uid) return; // only delete your own files
  await fs.rm(path.join(uploadsDir(), m[1], m[2], m[3]), { force: true });
}
