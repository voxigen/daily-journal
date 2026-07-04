// Map Drizzle rows (camelCase) to the snake_case shapes the existing view
// components already consume, so nothing downstream has to change.
import type { InferSelectModel } from 'drizzle-orm';
import type { templates, dayTasks, plannedTasks, recurringPlans, dailyDays, products, vocabCards } from './db/schema';

export function toTemplate(r: InferSelectModel<typeof templates>) {
  return { id: r.id, name: r.name, color: r.color ?? '#6366f1', icon: r.icon ?? '📋', fields: r.fields ?? [] };
}

export function toTask(r: InferSelectModel<typeof dayTasks>) {
  return {
    id: r.id,
    template_id: r.templateId ?? undefined,
    template_name: r.templateName ?? undefined,
    template_color: r.templateColor ?? undefined,
    template_icon: r.templateIcon ?? undefined,
    title: r.title,
    fields_data: r.fieldsData ?? {},
    duration_minutes: r.durationMinutes ?? undefined,
  };
}

export function toPlanned(r: InferSelectModel<typeof plannedTasks>) {
  return {
    id: r.id,
    date: r.date,
    title: r.title,
    template_id: r.templateId ?? undefined,
    template_name: r.templateName ?? undefined,
    template_color: r.templateColor ?? undefined,
    template_icon: r.templateIcon ?? undefined,
    recurring_id: r.recurringId ?? undefined,
  };
}

export function toRecurring(r: InferSelectModel<typeof recurringPlans>) {
  return {
    id: r.id,
    title: r.title,
    template_id: r.templateId ?? undefined,
    template_name: r.templateName ?? undefined,
    template_color: r.templateColor ?? undefined,
    template_icon: r.templateIcon ?? undefined,
    freq: (r.freq as 'daily' | 'weekly') ?? 'daily',
    weekdays: r.weekdays ?? [],
    active: r.active ?? true,
    last_spawned: r.lastSpawned ?? null,
  };
}

export function toProduct(r: InferSelectModel<typeof products>) {
  return { id: r.id, name: r.name, kcal_per_gram: r.kcalPerGram };
}

export function toVocab(r: InferSelectModel<typeof vocabCards>) {
  return { id: r.id, en: r.en, ru: r.ru, due: r.due, fsrs: r.fsrs };
}

export function toDay(r: InferSelectModel<typeof dailyDays>) {
  return { notes: r.notes ?? '', photo_urls: r.photoUrls ?? [], meals: r.meals ?? [], weight: r.weight ?? null };
}
