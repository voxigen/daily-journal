-- Подтверждение почты + сброс пароля.
-- init.sql выполняется только при первом старте Postgres, поэтому на проде
-- эту миграцию нужно прогнать вручную:
--   cd /root/almanax && git pull
--   docker exec -i almanax-db-1 psql -U almanax -d almanax < db/migrations/2026-07-05-email-auth.sql
--   docker compose up -d --build

alter table users add column if not exists email_verified boolean not null default false;

-- Существующие аккаунты считаем подтверждёнными — они входили ещё при Supabase.
update users set email_verified = true;

create table if not exists email_tokens (
  token_hash text primary key,
  user_id    uuid not null references users(id) on delete cascade,
  purpose    text not null, -- 'verify' | 'reset'
  expires_at timestamptz not null,
  created_at timestamptz default now()
);
create index if not exists email_tokens_user_idx on email_tokens (user_id);
