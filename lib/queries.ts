import 'server-only';
import { and, eq, inArray, lt, isNotNull, asc, desc } from 'drizzle-orm';
import { db, schema } from './db';
import { toTemplate, toTask, toPlanned, toRecurring, toProduct, toVocab, toDay } from './dto';

const { dailyDays, dayTasks, plannedTasks, recurringPlans, products, templates, vocabCards } = schema;

export async function getTemplates(uid: string) {
  const rows = await db.select().from(templates).where(eq(templates.userId, uid)).orderBy(asc(templates.createdAt));
  return rows.map(toTemplate);
}

export async function getTemplate(uid: string, id: string) {
  const [row] = await db.select().from(templates).where(and(eq(templates.id, id), eq(templates.userId, uid))).limit(1);
  return row ? toTemplate(row) : null;
}

export async function getDay(uid: string, date: string) {
  const [row] = await db.select().from(dailyDays).where(and(eq(dailyDays.userId, uid), eq(dailyDays.date, date))).limit(1);
  return row ? toDay(row) : null;
}

export async function getDayTasks(uid: string, date: string) {
  const rows = await db.select().from(dayTasks)
    .where(and(eq(dayTasks.userId, uid), eq(dayTasks.date, date))).orderBy(asc(dayTasks.createdAt));
  return rows.map(toTask);
}

// Planned rows for a set of dates (today/tomorrow). Keeps the `date` field so the
// caller can split into today/tomorrow buckets.
export async function getPlanned(uid: string, dates: string[]) {
  const rows = await db.select().from(plannedTasks)
    .where(and(eq(plannedTasks.userId, uid), inArray(plannedTasks.date, dates))).orderBy(asc(plannedTasks.createdAt));
  return rows.map(toPlanned);
}

export async function getRecurring(uid: string) {
  const rows = await db.select().from(recurringPlans)
    .where(and(eq(recurringPlans.userId, uid), eq(recurringPlans.active, true))).orderBy(asc(recurringPlans.createdAt));
  return rows.map(toRecurring);
}

export async function getProducts(uid: string) {
  const rows = await db.select().from(products).where(eq(products.userId, uid)).orderBy(asc(products.name));
  return rows.map(toProduct);
}

export async function getPrevWeight(uid: string, beforeDate: string): Promise<number | null> {
  const [row] = await db.select({ weight: dailyDays.weight }).from(dailyDays)
    .where(and(eq(dailyDays.userId, uid), lt(dailyDays.date, beforeDate), isNotNull(dailyDays.weight)))
    .orderBy(desc(dailyDays.date)).limit(1);
  return row?.weight ?? null;
}

export async function getVocab(uid: string) {
  const rows = await db.select().from(vocabCards).where(eq(vocabCards.userId, uid)).orderBy(asc(vocabCards.due));
  return rows.map(toVocab);
}

// ── Aggregate reads (already-shaped for the view components) ──
export async function getStatsData(uid: string) {
  const tasks = await db.select({
    date: dayTasks.date,
    template_name: dayTasks.templateName,
    template_color: dayTasks.templateColor,
    template_icon: dayTasks.templateIcon,
    duration_minutes: dayTasks.durationMinutes,
  }).from(dayTasks).where(eq(dayTasks.userId, uid));

  const days = await db.select({
    date: dailyDays.date,
    meals: dailyDays.meals,
    weight: dailyDays.weight,
  }).from(dailyDays).where(eq(dailyDays.userId, uid));

  return { tasks, days };
}

export async function getHistory(uid: string) {
  const rows = await db.select({
    date: dayTasks.date,
    title: dayTasks.title,
    template_color: dayTasks.templateColor,
    template_icon: dayTasks.templateIcon,
    duration_minutes: dayTasks.durationMinutes,
  }).from(dayTasks).where(eq(dayTasks.userId, uid))
    .orderBy(desc(dayTasks.date), asc(dayTasks.createdAt));
  return rows.map((r) => ({
    date: r.date, title: r.title,
    template_color: r.template_color ?? undefined,
    template_icon: r.template_icon ?? undefined,
    duration_minutes: r.duration_minutes ?? undefined,
  }));
}

export async function getTemplateTasks(uid: string, templateId: string) {
  const rows = await db.select({
    date: dayTasks.date,
    title: dayTasks.title,
    duration_minutes: dayTasks.durationMinutes,
    fields_data: dayTasks.fieldsData,
    created_at: dayTasks.createdAt,
  }).from(dayTasks).where(and(eq(dayTasks.userId, uid), eq(dayTasks.templateId, templateId)))
    .orderBy(asc(dayTasks.date), asc(dayTasks.createdAt));
  return rows.map((r) => ({
    date: r.date, title: r.title,
    duration_minutes: r.duration_minutes ?? undefined,
    fields_data: r.fields_data ?? undefined,
    created_at: r.created_at ?? undefined,
  }));
}
