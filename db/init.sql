-- Almanax schema. Mounted into the Postgres container's
-- /docker-entrypoint-initdb.d/ so it runs once on first boot.
-- Mirrors lib/db/schema.ts. Schema changes are manual (edit both, run the SQL).

create extension if not exists pgcrypto;

create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  password_hash text not null,
  created_at    timestamptz default now()
);

create table if not exists templates (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  name       text not null,
  color      text default '#6366f1',
  icon       text default '📋',
  fields     jsonb default '[]',
  created_at timestamptz default now()
);

create table if not exists recurring_plans (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users(id) on delete cascade,
  title          text not null,
  template_id    uuid references templates(id) on delete set null,
  template_name  text,
  template_color text default '#5a63d8',
  template_icon  text default '',
  freq           text not null default 'daily',
  weekdays       int[] default '{}',
  active         boolean default true,
  last_spawned   date,
  created_at     timestamptz default now()
);

create table if not exists daily_days (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  date         date not null,
  planned_next text,
  notes        text,
  photo_urls   text[] default '{}',
  meals        jsonb default '[]',
  weight       double precision,
  created_at   timestamptz default now(),
  unique(user_id, date)
);

create table if not exists day_tasks (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users(id) on delete cascade,
  date             date not null,
  template_id      uuid references templates(id) on delete set null,
  template_name    text,
  template_color   text default '#6366f1',
  template_icon    text default '📋',
  title            text not null,
  fields_data      jsonb default '{}',
  duration_minutes int,
  created_at       timestamptz default now()
);

create table if not exists planned_tasks (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users(id) on delete cascade,
  date           date not null,
  title          text not null,
  template_id    uuid references templates(id) on delete set null,
  template_name  text,
  template_color text default '#5a63d8',
  template_icon  text default '',
  recurring_id   uuid references recurring_plans(id) on delete set null,
  created_at     timestamptz default now()
);
create unique index if not exists planned_recurring_day on planned_tasks (user_id, recurring_id, date);
create index if not exists planned_user_date on planned_tasks (user_id, date);
create index if not exists day_tasks_user_date on day_tasks (user_id, date);

create table if not exists vocab_cards (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  en         text not null,
  ru         text not null,
  due        timestamptz not null default now(),
  fsrs       jsonb,
  created_at timestamptz default now()
);
create index if not exists vocab_due_idx on vocab_cards (user_id, due);

create table if not exists products (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  name          text not null,
  kcal_per_gram double precision not null default 0,
  created_at    timestamptz default now()
);
create index if not exists products_user_idx on products (user_id);
