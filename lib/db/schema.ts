// Drizzle schema — mirrors db/init.sql. Single source of truth for queries.
// All user data is scoped by user_id (enforced in the data layer, since we no
// longer have Supabase RLS).
import { pgTable, uuid, text, timestamp, date, jsonb, integer, doublePrecision, boolean, unique } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const templates = pgTable('templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color').default('#6366f1'),
  icon: text('icon').default('📋'),
  fields: jsonb('fields').$type<{ name: string; placeholder: string; type: string }[]>().default([]),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const dailyDays = pgTable('daily_days', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  plannedNext: text('planned_next'),
  notes: text('notes'),
  photoUrls: text('photo_urls').array().default([]),
  meals: jsonb('meals').$type<unknown[]>().default([]),
  weight: doublePrecision('weight'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => ({ userDate: unique('daily_days_user_date').on(t.userId, t.date) }));

export const dayTasks = pgTable('day_tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  templateId: uuid('template_id').references(() => templates.id, { onDelete: 'set null' }),
  templateName: text('template_name'),
  templateColor: text('template_color').default('#6366f1'),
  templateIcon: text('template_icon').default('📋'),
  title: text('title').notNull(),
  fieldsData: jsonb('fields_data').$type<Record<string, string>>().default({}),
  durationMinutes: integer('duration_minutes'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const plannedTasks = pgTable('planned_tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  title: text('title').notNull(),
  templateId: uuid('template_id').references(() => templates.id, { onDelete: 'set null' }),
  templateName: text('template_name'),
  templateColor: text('template_color').default('#5a63d8'),
  templateIcon: text('template_icon').default(''),
  recurringId: uuid('recurring_id').references(() => recurringPlans.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const recurringPlans = pgTable('recurring_plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  templateId: uuid('template_id').references(() => templates.id, { onDelete: 'set null' }),
  templateName: text('template_name'),
  templateColor: text('template_color').default('#5a63d8'),
  templateIcon: text('template_icon').default(''),
  freq: text('freq').notNull().default('daily'),
  weekdays: integer('weekdays').array().default([]),
  active: boolean('active').default(true),
  lastSpawned: date('last_spawned'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const vocabCards = pgTable('vocab_cards', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  en: text('en').notNull(),
  ru: text('ru').notNull(),
  due: timestamp('due', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  fsrs: jsonb('fsrs').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  kcalPerGram: doublePrecision('kcal_per_gram').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
});
