-- Запусти этот SQL в Supabase > SQL Editor

create table if not exists daily_entries (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users not null,
  date        date not null,
  done        text,
  planned_next text,
  notes       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique(user_id, date)
);

-- Обновляет updated_at при каждом upsert
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger daily_entries_updated_at
before update on daily_entries
for each row execute procedure update_updated_at();

-- RLS: каждый видит только свои записи
alter table daily_entries enable row level security;

create policy "Own entries only" on daily_entries
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
