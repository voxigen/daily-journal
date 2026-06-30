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

-- RLS
alter table templates   enable row level security;
alter table daily_days  enable row level security;
alter table day_tasks   enable row level security;

create policy "own templates"  on templates  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own days"       on daily_days using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own tasks"      on day_tasks  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Storage bucket для фото (выполни отдельно или создай вручную)
-- insert into storage.buckets (id, name, public) values ('day-photos', 'day-photos', false);
-- create policy "own photos upload" on storage.objects for insert with check (bucket_id = 'day-photos' and auth.uid()::text = (storage.foldername(name))[1]);
-- create policy "own photos read"   on storage.objects for select using (bucket_id = 'day-photos' and auth.uid()::text = (storage.foldername(name))[1]);
-- create policy "own photos delete" on storage.objects for delete using (bucket_id = 'day-photos' and auth.uid()::text = (storage.foldername(name))[1]);
