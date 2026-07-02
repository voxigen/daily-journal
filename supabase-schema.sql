-- Запусти этот SQL в Supabase > SQL Editor
-- ВНИМАНИЕ: сначала удали старую таблицу если уже создавал
drop table if exists daily_entries cascade;

-- Шаблоны дел
create table if not exists templates (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users not null,
  name       text not null,
  color      text default '#6366f1',
  icon       text default '📋',
  fields     jsonb default '[]', -- [{name, placeholder, type}]
  created_at timestamptz default now()
);

-- Дни
create table if not exists daily_days (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references auth.users not null,
  date         date not null,
  planned_next text,
  notes        text,
  photo_urls   text[] default '{}',
  meals        jsonb default '[]',
  created_at   timestamptz default now(),
  unique(user_id, date)
);

-- Если таблица уже создана раньше — добавь колонку питания:
alter table daily_days add column if not exists meals jsonb default '[]';

-- Записи дел (много на один день)
create table if not exists day_tasks (
  id               uuid default gen_random_uuid() primary key,
  user_id          uuid references auth.users not null,
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

-- Запланированные дела (плитки, которые переходят на нужный день)
create table if not exists planned_tasks (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references auth.users not null,
  date           date not null,               -- день, НА который запланировано
  title          text not null,
  template_id    uuid references templates(id) on delete set null,
  template_name  text,
  template_color text default '#5a63d8',
  template_icon  text default '',
  created_at     timestamptz default now()
);

-- Повторяющиеся планы (правила: каждый день / по дням недели)
create table if not exists recurring_plans (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references auth.users not null,
  title          text not null,
  template_id    uuid references templates(id) on delete set null,
  template_name  text,
  template_color text default '#5a63d8',
  template_icon  text default '',
  freq           text not null default 'daily',   -- 'daily' | 'weekly'
  weekdays       int[] default '{}',              -- Monday-based 0..6, used when freq='weekly'
  active         boolean default true,
  last_spawned   date,                             -- защита от повторного создания в тот же день
  created_at     timestamptz default now()
);

-- Ссылка на правило у материализованной задачи (чтобы не дублировать за день)
alter table planned_tasks add column if not exists recurring_id uuid references recurring_plans(id) on delete set null;
create unique index if not exists planned_recurring_day on planned_tasks (user_id, recurring_id, date);

-- RLS
alter table templates       enable row level security;
alter table daily_days      enable row level security;
alter table day_tasks       enable row level security;
alter table planned_tasks   enable row level security;
alter table recurring_plans enable row level security;
create policy "own planned"   on planned_tasks   using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own recurring" on recurring_plans using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own templates"  on templates  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own days"       on daily_days using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own tasks"      on day_tasks  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Словарь для интервального повторения английского (FSRS-карта хранится целиком в jsonb)
create table if not exists vocab_cards (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users not null,
  en         text not null,
  ru         text not null,
  due        timestamptz not null default now(),  -- продублировано из fsrs для выборки «к повторению»
  fsrs       jsonb,                                -- сериализованная ts-fsrs Card
  created_at timestamptz default now()
);
create index if not exists vocab_due_idx on vocab_cards (user_id, due);
alter table vocab_cards enable row level security;
create policy "own vocab" on vocab_cards using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Storage bucket для фото (выполни отдельно или создай вручную)
-- insert into storage.buckets (id, name, public) values ('day-photos', 'day-photos', false);
-- create policy "own photos upload" on storage.objects for insert with check (bucket_id = 'day-photos' and auth.uid()::text = (storage.foldername(name))[1]);
-- create policy "own photos read"   on storage.objects for select using (bucket_id = 'day-photos' and auth.uid()::text = (storage.foldername(name))[1]);
-- create policy "own photos delete" on storage.objects for delete using (bucket_id = 'day-photos' and auth.uid()::text = (storage.foldername(name))[1]);
