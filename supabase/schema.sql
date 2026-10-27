-- SmartBudget schema  (safe to run more than once, including on a database
-- that already ran an older version of this file)
--
-- Paste this entire file into Supabase: SQL Editor → New query → Run
--
-- Before signing up from the app, also go to:
-- Authentication → Providers → Email → set a minimum password length of 8.
-- For development you may turn OFF "Confirm email"; keep it ON in production.
--
-- To create the first administrator, sign up in the app, then run (as the
-- project owner, in the SQL Editor):
--   update public.users set role = 'superadmin' where email = 'you@example.com';

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Users  (profile row; passwords live in auth.users, never here)
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  name          text not null default '',
  email         text not null unique,
  role          text not null default 'user'
                  check (role in ('user', 'support', 'admin', 'superadmin')),
  status        text not null default 'active'
                  check (status in ('active', 'suspended')),
  last_login    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.users(id) on delete cascade,
  name          text not null,
  type          text not null default 'expense'
                  check (type in ('income', 'expense')),
  color         text not null default '#64748B',
  icon          text,
  is_system     boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (user_id, name)
);

-- ---------------------------------------------------------------------------
-- Transactions
-- ---------------------------------------------------------------------------
create table if not exists public.transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  category_id   uuid references public.categories(id) on delete set null,
  date          date not null default current_date,
  description   text not null default '',
  amount        numeric(12, 2) not null,
  type          text not null check (type in ('income', 'expense')),
  recurring     boolean not null default false,
  note          text,
  created_at    timestamptz not null default now()
);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, date desc);

-- ---------------------------------------------------------------------------
-- Budgets
-- ---------------------------------------------------------------------------
create table if not exists public.budgets (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,
  category_id       uuid references public.categories(id) on delete set null,
  period_start      date not null,
  amount_budgeted   numeric(12, 2) not null default 0,
  amount_spent      numeric(12, 2) not null default 0,
  created_at        timestamptz not null default now(),
  unique (user_id, category_id, period_start)
);

create index if not exists budgets_user_period_idx
  on public.budgets (user_id, period_start desc);

-- ---------------------------------------------------------------------------
-- SavingsGoals
-- ---------------------------------------------------------------------------
create table if not exists public.savings_goals (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references public.users(id) on delete cascade,
  name                    text not null,
  target_amount           numeric(12, 2) not null,
  current_amount          numeric(12, 2) not null default 0,
  deadline                date,
  color                   text not null default '#10B981',
  icon                    text not null default '💰',
  monthly_contribution    numeric(12, 2) not null default 0,
  created_at              timestamptz not null default now()
);

create index if not exists savings_goals_user_idx
  on public.savings_goals (user_id);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  type          text not null default 'info'
                  check (type in ('warning', 'success', 'info', 'error', 'security')),
  title         text not null,
  body          text not null default '',
  category      text not null default 'system'
                  check (category in ('budget', 'savings', 'report', 'security', 'system')),
  is_read       boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- AIInsights
-- ---------------------------------------------------------------------------
create table if not exists public.ai_insights (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  title         text not null,
  body          text not null,
  insight_type  text not null default 'general'
                  check (insight_type in ('spending', 'budget', 'savings', 'general')),
  created_at    timestamptz not null default now()
);

create index if not exists ai_insights_user_idx
  on public.ai_insights (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Chatbot  (one row per message)
-- ---------------------------------------------------------------------------
create table if not exists public.chatbot (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  conversation_id uuid not null default gen_random_uuid(),
  role          text not null check (role in ('user', 'assistant')),
  message       text not null,
  created_at    timestamptz not null default now()
);

create index if not exists chatbot_user_idx
  on public.chatbot (user_id, created_at);

-- ---------------------------------------------------------------------------
-- Auto-create a public.users profile when someone signs up
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, name, email, role, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    'user',
    'active'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Keep updated_at current
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_touch_updated_at on public.users;
create trigger users_touch_updated_at
  before update on public.users
  for each row execute function public.touch_updated_at();


-- Column added after the first version of this schema (safe on old databases).
alter table public.budgets add column if not exists color text not null default '#2563EB';

-- ---------------------------------------------------------------------------
-- Extra integrity rules (NOT VALID = applies to new/changed rows only, so an
-- older database with existing rows does not fail)
-- ---------------------------------------------------------------------------
do $$ begin
  alter table public.transactions add constraint transactions_amount_positive check (amount > 0) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.budgets add constraint budgets_amount_nonneg check (amount_budgeted >= 0) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.savings_goals add constraint savings_goals_target_positive check (target_amount > 0 and current_amount >= 0) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.transactions add constraint transactions_description_len check (char_length(description) <= 200) not valid;
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Helper functions in a schema that is NOT exposed through the API
-- ---------------------------------------------------------------------------
create schema if not exists private;
grant usage on schema private to authenticated;

-- Role of the signed-in user, read from the database (never from the browser).
create or replace function private.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.users where id = (select auth.uid());
$$;
revoke execute on function private.current_user_role() from public, anon;
grant  execute on function private.current_user_role() to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.users          enable row level security;
alter table public.categories     enable row level security;
alter table public.transactions   enable row level security;
alter table public.budgets        enable row level security;
alter table public.savings_goals  enable row level security;
alter table public.notifications  enable row level security;
alter table public.ai_insights    enable row level security;
alter table public.chatbot        enable row level security;

-- users: you read your own row; support/admin/superadmin may read all rows.
drop policy if exists "users_select_own" on public.users;
drop policy if exists "users_select_own_or_staff" on public.users;
create policy "users_select_own_or_staff" on public.users
  for select to authenticated
  using (
    (select auth.uid()) = id
    or (select private.current_user_role()) in ('support', 'admin', 'superadmin')
  );

-- users: you may update your own row, but the column grants below allow
-- ONLY the name column, so role / status / email cannot be changed here.
drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- No insert policy and no delete policy on users: profile rows are created
-- only by the sign-up trigger, and removed only when the auth user is removed.
drop policy if exists "users_insert_own" on public.users;

drop policy if exists "categories_select" on public.categories;
create policy "categories_select" on public.categories
  for select to authenticated
  using (user_id is null or (select auth.uid()) = user_id);

drop policy if exists "categories_insert_own" on public.categories;
create policy "categories_insert_own" on public.categories
  for insert to authenticated
  with check ((select auth.uid()) = user_id and is_system = false);

drop policy if exists "categories_update_own" on public.categories;
create policy "categories_update_own" on public.categories
  for update to authenticated
  using ((select auth.uid()) = user_id and is_system = false)
  with check ((select auth.uid()) = user_id and is_system = false);

drop policy if exists "categories_delete_own" on public.categories;
create policy "categories_delete_own" on public.categories
  for delete to authenticated
  using ((select auth.uid()) = user_id and is_system = false);

drop policy if exists "transactions_all_own" on public.transactions;
create policy "transactions_all_own" on public.transactions
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "budgets_all_own" on public.budgets;
create policy "budgets_all_own" on public.budgets
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "savings_goals_all_own" on public.savings_goals;
create policy "savings_goals_all_own" on public.savings_goals
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "notifications_all_own" on public.notifications;
create policy "notifications_all_own" on public.notifications
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "ai_insights_all_own" on public.ai_insights;
create policy "ai_insights_all_own" on public.ai_insights
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "chatbot_all_own" on public.chatbot;
create policy "chatbot_all_own" on public.chatbot
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Built-in categories (shared, user_id is null)
-- ---------------------------------------------------------------------------
insert into public.categories (name, type, color, is_system)
select * from (values
  ('Housing',        'expense', '#2563EB', true),
  ('Food & Dining',  'expense', '#16A34A', true),
  ('Transport',      'expense', '#D97706', true),
  ('Entertainment',  'expense', '#9333EA', true),
  ('Healthcare',     'expense', '#0D9488', true),
  ('Shopping',       'expense', '#EA580C', true),
  ('Education',      'expense', '#4F46E5', true),
  ('Utilities',      'expense', '#7C3AED', true),
  ('Savings',        'expense', '#0891B2', true),
  ('Travel',         'expense', '#0EA5E9', true),
  ('Subscriptions',  'expense', '#DB2777', true),
  ('Personal Care',  'expense', '#14B8A6', true),
  ('Other',          'expense', '#64748B', true),
  ('Income',         'income',  '#22C55E', true)
) as seed(name, type, color, is_system)
where not exists (
  select 1 from public.categories c
  where c.user_id is null and c.name = seed.name
);

-- ---------------------------------------------------------------------------
-- Table privileges. Start from nothing, then grant only what is needed.
-- ---------------------------------------------------------------------------
revoke all on public.users, public.categories, public.transactions, public.budgets,
              public.savings_goals, public.notifications, public.ai_insights, public.chatbot
  from anon, authenticated;

grant usage on schema public to anon, authenticated;

-- Profiles: read, and change the display name only.
grant select on public.users to authenticated;
grant update (name) on public.users to authenticated;

grant select, insert, update, delete on
  public.categories,
  public.transactions,
  public.budgets,
  public.savings_goals,
  public.notifications,
  public.ai_insights,
  public.chatbot
to authenticated;

-- Visitors who are not signed in can reach nothing.

-- ---------------------------------------------------------------------------
-- Controlled administrator actions. These run with elevated rights, so each
-- one checks the caller's role inside the database.
-- ---------------------------------------------------------------------------

-- Only a superadmin may change a role. Cannot change your own role, and the
-- last superadmin cannot be demoted.
create or replace function public.admin_set_role(target uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text := private.current_user_role();
  target_role text;
begin
  if caller_role is distinct from 'superadmin' then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if new_role not in ('user', 'support', 'admin', 'superadmin') then
    raise exception 'invalid role' using errcode = '22023';
  end if;
  if target = (select auth.uid()) then
    raise exception 'you cannot change your own role' using errcode = '42501';
  end if;
  select role into target_role from public.users where id = target;
  if target_role is null then
    raise exception 'user not found' using errcode = 'P0002';
  end if;
  if target_role = 'superadmin' and new_role <> 'superadmin'
     and (select count(*) from public.users where role = 'superadmin') <= 1 then
    raise exception 'cannot remove the last superadmin' using errcode = '42501';
  end if;
  update public.users set role = new_role where id = target;
end;
$$;
revoke execute on function public.admin_set_role(uuid, text) from public, anon;
grant  execute on function public.admin_set_role(uuid, text) to authenticated;

-- Admin and superadmin may suspend / reactivate accounts. An admin cannot act
-- on another admin or a superadmin, and nobody can suspend themselves.
create or replace function public.admin_set_status(target uuid, new_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text := private.current_user_role();
  target_role text;
begin
  if caller_role not in ('admin', 'superadmin') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if new_status not in ('active', 'suspended') then
    raise exception 'invalid status' using errcode = '22023';
  end if;
  if target = (select auth.uid()) then
    raise exception 'you cannot change your own status' using errcode = '42501';
  end if;
  select role into target_role from public.users where id = target;
  if target_role is null then
    raise exception 'user not found' using errcode = 'P0002';
  end if;
  if caller_role = 'admin' and target_role in ('admin', 'superadmin') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.users set status = new_status where id = target;
end;
$$;
revoke execute on function public.admin_set_status(uuid, text) from public, anon;
grant  execute on function public.admin_set_status(uuid, text) to authenticated;

-- Records the sign-in time for the signed-in user only.
create or replace function public.touch_last_login()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.users set last_login = now() where id = (select auth.uid());
$$;
revoke execute on function public.touch_last_login() from public, anon;
grant  execute on function public.touch_last_login() to authenticated;

-- Lets a signed-in user permanently delete their own account. Removing the
-- auth user cascades to the profile and to every row that belongs to them.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if private.current_user_role() = 'superadmin'
     and (select count(*) from public.users where role = 'superadmin') <= 1 then
    raise exception 'cannot remove the last superadmin' using errcode = '42501';
  end if;
  delete from auth.users where id = (select auth.uid());
end;
$$;
revoke execute on function public.delete_my_account() from public, anon;
grant  execute on function public.delete_my_account() to authenticated;

-- ===== Admin upgrade (included from admin_upgrade.sql) =====
-- ===========================================================================
-- SmartBudget admin upgrade: real data for the admin panel.
-- Safe to run more than once. Run AFTER schema.sql (schema.sql also includes
-- this file's contents at the end, so a fresh install only needs schema.sql).
--
-- Adds:
--   audit_log         every administrator action (role/status changes, settings, content, exports)
--   auth_events       sign-ins, failed sign-ins, sign-ups, password-reset requests, sign-outs
--   lesson_progress   which lessons each user started/completed (replaces browser-only storage)
--   content_settings  hide / feature lessons, videos and books from the admin panel
--   app_settings      site switches: maintenance mode, sign-ups, assistant, announcement
-- and staff-only functions that return the admin statistics. Individual users'
-- financial records are never returned to staff; only anonymised totals.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  actor_id      uuid,
  actor_email   text,
  actor_role    text,
  action        text not null,
  target_type   text,
  target_id     text,
  target_label  text,
  details       jsonb not null default '{}'::jsonb,
  ip            text
);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
create index if not exists audit_log_action_idx on public.audit_log (action, created_at desc);

create table if not exists public.auth_events (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  user_id       uuid,
  email         text,
  event         text not null check (event in (
                  'login_success', 'login_failed', 'signup', 'password_reset_requested',
                  'logout', 'suspended_login_blocked')),
  ip            text,
  user_agent    text
);
create index if not exists auth_events_created_idx on public.auth_events (created_at desc);
create index if not exists auth_events_email_idx on public.auth_events (email, created_at desc);
create index if not exists auth_events_event_idx on public.auth_events (event, created_at desc);

create table if not exists public.lesson_progress (
  user_id       uuid not null references public.users(id) on delete cascade,
  lesson_id     int  not null,
  started_at    timestamptz not null default now(),
  completed_at  timestamptz,
  primary key (user_id, lesson_id)
);

create table if not exists public.content_settings (
  content_key   text primary key check (content_key ~ '^(lesson|video|book):[A-Za-z0-9_/-]{1,80}$'),
  hidden        boolean not null default false,
  featured      boolean not null default false,
  updated_at    timestamptz not null default now(),
  updated_by    uuid
);

create table if not exists public.app_settings (
  key           text primary key,
  value         jsonb not null,
  updated_at    timestamptz not null default now(),
  updated_by    uuid
);

insert into public.app_settings (key, value) values
  ('maintenance_mode',     'false'::jsonb),
  ('maintenance_message',  '"SmartBudget is down for a short maintenance break. Please try again soon."'::jsonb),
  ('signups_enabled',      'true'::jsonb),
  ('assistant_enabled',    'true'::jsonb),
  ('announcement_enabled', 'false'::jsonb),
  ('announcement',         '""'::jsonb)
on conflict (key) do nothing;

alter table public.audit_log        enable row level security;
alter table public.auth_events      enable row level security;
alter table public.lesson_progress  enable row level security;
alter table public.content_settings enable row level security;
alter table public.app_settings     enable row level security;

revoke all on public.audit_log, public.auth_events, public.lesson_progress,
              public.content_settings, public.app_settings from anon, authenticated;

-- Logs are only reachable through the staff functions below (no direct grants).

-- Lesson progress: each user reads and writes only their own rows.
grant select, insert, update, delete on public.lesson_progress to authenticated;
drop policy if exists "lesson_progress_own" on public.lesson_progress;
create policy "lesson_progress_own" on public.lesson_progress
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Content visibility: everyone signed in can read; changes go through admin_set_content.
grant select on public.content_settings to authenticated;
drop policy if exists "content_settings_read" on public.content_settings;
create policy "content_settings_read" on public.content_settings
  for select to authenticated using (true);

-- Site settings: readable by everyone (the sign-up and maintenance screens need
-- them before sign-in). They contain no secrets. Changes go through admin_update_settings.
grant select on public.app_settings to anon, authenticated;
drop policy if exists "app_settings_read" on public.app_settings;
create policy "app_settings_read" on public.app_settings
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- Private helpers
-- ---------------------------------------------------------------------------

-- Visitor IP and browser from the API request headers (null when unavailable).
create or replace function private.request_ip()
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(trim(split_part(coalesce(
    (nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for'),
    (nullif(current_setting('request.headers', true), '')::json ->> 'x-real-ip'),
    ''), ',', 1)), '');
$$;

create or replace function private.request_user_agent()
returns text
language sql
stable
set search_path = ''
as $$
  select left(nullif(current_setting('request.headers', true), '')::json ->> 'user-agent', 300);
$$;

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_user_role() in ('support', 'admin', 'superadmin'), false);
$$;

-- Writes one audit entry for the signed-in caller.
create or replace function private.write_audit(
  p_action text, p_target_type text default null, p_target_id text default null,
  p_target_label text default null, p_details jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.users%rowtype;
begin
  select * into me from public.users where id = (select auth.uid());
  insert into public.audit_log (actor_id, actor_email, actor_role, action, target_type, target_id, target_label, details, ip)
  values ((select auth.uid()), me.email, me.role, p_action, p_target_type, p_target_id, p_target_label,
          coalesce(p_details, '{}'::jsonb), private.request_ip());
end;
$$;

grant execute on function private.request_ip(), private.request_user_agent(), private.is_staff() to authenticated;
revoke execute on function private.write_audit(text, text, text, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Sign-ups: respect the "sign-ups enabled" switch and record the event
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce((select value from public.app_settings where key = 'signups_enabled'), 'true'::jsonb) = 'false'::jsonb then
    raise exception 'New sign-ups are currently closed.' using errcode = '42501';
  end if;
  insert into public.users (id, name, email, role, status)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email, 'user', 'active')
  on conflict (id) do nothing;
  insert into public.auth_events (user_id, email, event, ip, user_agent)
  values (new.id, lower(new.email), 'signup', private.request_ip(), private.request_user_agent());
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Existing functions, now with audit records
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_role(target uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text := private.current_user_role();
  target_row public.users%rowtype;
begin
  if caller_role is distinct from 'superadmin' then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if new_role not in ('user', 'support', 'admin', 'superadmin') then
    raise exception 'invalid role' using errcode = '22023';
  end if;
  if target = (select auth.uid()) then
    raise exception 'you cannot change your own role' using errcode = '42501';
  end if;
  select * into target_row from public.users where id = target;
  if target_row.id is null then
    raise exception 'user not found' using errcode = 'P0002';
  end if;
  if target_row.role = 'superadmin' and new_role <> 'superadmin'
     and (select count(*) from public.users where role = 'superadmin') <= 1 then
    raise exception 'cannot remove the last superadmin' using errcode = '42501';
  end if;
  if target_row.role = new_role then return; end if;
  update public.users set role = new_role where id = target;
  perform private.write_audit('role_changed', 'user', target::text, target_row.email,
    jsonb_build_object('from', target_row.role, 'to', new_role));
end;
$$;

create or replace function public.admin_set_status(target uuid, new_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text := private.current_user_role();
  target_row public.users%rowtype;
begin
  if caller_role not in ('admin', 'superadmin') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if new_status not in ('active', 'suspended') then
    raise exception 'invalid status' using errcode = '22023';
  end if;
  if target = (select auth.uid()) then
    raise exception 'you cannot change your own status' using errcode = '42501';
  end if;
  select * into target_row from public.users where id = target;
  if target_row.id is null then
    raise exception 'user not found' using errcode = 'P0002';
  end if;
  if caller_role = 'admin' and target_row.role in ('admin', 'superadmin') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if target_row.status = new_status then return; end if;
  update public.users set status = new_status where id = target;
  perform private.write_audit(case when new_status = 'suspended' then 'user_suspended' else 'user_reactivated' end,
    'user', target::text, target_row.email, '{}'::jsonb);
end;
$$;

create or replace function public.touch_last_login()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.users%rowtype;
begin
  update public.users set last_login = now() where id = (select auth.uid()) returning * into me;
  if me.id is not null then
    insert into public.auth_events (user_id, email, event, ip, user_agent)
    values (me.id, me.email, 'login_success', private.request_ip(), private.request_user_agent());
  end if;
  -- Keep security records for 12 months only (see the Privacy Policy).
  delete from public.auth_events where created_at < now() - interval '12 months';
  delete from public.audit_log  where created_at < now() - interval '12 months';
end;
$$;
revoke execute on function public.touch_last_login() from public, anon;
grant  execute on function public.touch_last_login() to authenticated;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.users%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select * into me from public.users where id = (select auth.uid());
  if me.role = 'superadmin'
     and (select count(*) from public.users where role = 'superadmin') <= 1 then
    raise exception 'cannot remove the last superadmin' using errcode = '42501';
  end if;
  insert into public.audit_log (actor_id, actor_email, actor_role, action, target_type, target_id, target_label, details, ip)
  values (me.id, me.email, me.role, 'account_deleted', 'user', me.id::text, me.email, '{}'::jsonb, private.request_ip());
  delete from auth.users where id = (select auth.uid());
end;
$$;
revoke execute on function public.delete_my_account() from public, anon;
grant  execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------------
-- Recording sign-in events from the app (rate limited)
-- ---------------------------------------------------------------------------
create or replace function public.record_auth_event(p_event text, p_email text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  em text := lower(left(trim(coalesce(p_email, '')), 254));
begin
  -- Visitors who are not signed in may only report failed sign-ins and reset requests.
  if p_event not in ('login_failed', 'password_reset_requested', 'logout', 'suspended_login_blocked') then
    raise exception 'invalid event' using errcode = '22023';
  end if;
  if uid is null and p_event not in ('login_failed', 'password_reset_requested') then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if uid is not null then
    select email into em from public.users where id = uid;  -- never trust a passed email when signed in
  end if;
  if em is null or em = '' or em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return;
  end if;
  -- Throttle: ignore floods for one address, and overall.
  if (select count(*) from public.auth_events where email = em and created_at > now() - interval '15 minutes') >= 30 then
    return;
  end if;
  if (select count(*) from public.auth_events where created_at > now() - interval '1 hour') >= 2000 then
    return;
  end if;
  insert into public.auth_events (user_id, email, event, ip, user_agent)
  values (coalesce(uid, (select id from public.users where email = em)), em, p_event,
          private.request_ip(), private.request_user_agent());
end;
$$;
revoke execute on function public.record_auth_event(text, text) from public;
grant  execute on function public.record_auth_event(text, text) to anon, authenticated;

-- Staff actions that happen outside the database (exports, reset emails, resolving alerts).
create or replace function public.log_admin_action(p_action text, p_target_label text default null, p_details jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_staff() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_action not in ('password_reset_sent', 'report_exported', 'users_exported', 'alert_resolved', 'audit_exported') then
    raise exception 'invalid action' using errcode = '22023';
  end if;
  perform private.write_audit(p_action, null, null, left(p_target_label, 254), coalesce(p_details, '{}'::jsonb));
end;
$$;
revoke execute on function public.log_admin_action(text, text, jsonb) from public, anon;
grant  execute on function public.log_admin_action(text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Superadmin controls
-- ---------------------------------------------------------------------------
create or replace function public.admin_update_settings(p_settings jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k text;
  v jsonb;
  old jsonb;
  changes jsonb := '{}'::jsonb;
begin
  if private.current_user_role() is distinct from 'superadmin' then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  for k, v in select * from jsonb_each(coalesce(p_settings, '{}'::jsonb)) loop
    if k in ('maintenance_mode', 'signups_enabled', 'assistant_enabled', 'announcement_enabled') then
      if jsonb_typeof(v) <> 'boolean' then raise exception 'invalid value for %', k using errcode = '22023'; end if;
    elsif k in ('maintenance_message', 'announcement') then
      if jsonb_typeof(v) <> 'string' or char_length(v #>> '{}') > 300 then
        raise exception 'invalid value for %', k using errcode = '22023';
      end if;
    else
      raise exception 'unknown setting %', k using errcode = '22023';
    end if;
    select value into old from public.app_settings where key = k;
    if old is distinct from v then
      insert into public.app_settings (key, value, updated_at, updated_by)
      values (k, v, now(), (select auth.uid()))
      on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by;
      changes := changes || jsonb_build_object(k, jsonb_build_object('from', old, 'to', v));
    end if;
  end loop;
  if changes <> '{}'::jsonb then
    perform private.write_audit('settings_changed', 'settings', null, 'Site settings', changes);
  end if;
end;
$$;
revoke execute on function public.admin_update_settings(jsonb) from public, anon;
grant  execute on function public.admin_update_settings(jsonb) to authenticated;

create or replace function public.admin_set_content(p_key text, p_hidden boolean, p_featured boolean, p_label text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.current_user_role() is distinct from 'superadmin' then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.content_settings (content_key, hidden, featured, updated_at, updated_by)
  values (p_key, coalesce(p_hidden, false), coalesce(p_featured, false), now(), (select auth.uid()))
  on conflict (content_key) do update set hidden = excluded.hidden, featured = excluded.featured,
    updated_at = now(), updated_by = excluded.updated_by;
  perform private.write_audit('content_updated', 'content', p_key, left(coalesce(p_label, p_key), 200),
    jsonb_build_object('hidden', coalesce(p_hidden, false), 'featured', coalesce(p_featured, false)));
end;
$$;
revoke execute on function public.admin_set_content(text, boolean, boolean, text) from public, anon;
grant  execute on function public.admin_set_content(text, boolean, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Staff read functions (statistics). Totals only; no individual finances.
-- ---------------------------------------------------------------------------
create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not private.is_staff() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'generated_at', now(),
    'users_total', (select count(*) from public.users),
    'users_active', (select count(*) from public.users where status = 'active'),
    'users_suspended', (select count(*) from public.users where status = 'suspended'),
    'users_by_role', (select coalesce(jsonb_object_agg(role, n), '{}'::jsonb) from (select role, count(*) n from public.users group by role) r),
    'new_users_7d', (select count(*) from public.users where created_at > now() - interval '7 days'),
    'new_users_prev_7d', (select count(*) from public.users where created_at <= now() - interval '7 days' and created_at > now() - interval '14 days'),
    'new_users_30d', (select count(*) from public.users where created_at > now() - interval '30 days'),
    'active_users_7d', (select count(*) from public.users where last_login > now() - interval '7 days'),
    'active_users_30d', (select count(*) from public.users where last_login > now() - interval '30 days'),
    'transactions_total', (select count(*) from public.transactions),
    'transactions_30d', (select count(*) from public.transactions where created_at > now() - interval '30 days'),
    'goals_total', (select count(*) from public.savings_goals),
    'goals_completed', (select count(*) from public.savings_goals where current_amount >= target_amount),
    'budgets_this_month', (select count(*) from public.budgets where period_start = date_trunc('month', current_date)::date),
    'lessons_started', (select count(*) from public.lesson_progress),
    'lessons_completed', (select count(*) from public.lesson_progress where completed_at is not null),
    'logins_24h', (select count(*) from public.auth_events where event = 'login_success' and created_at > now() - interval '24 hours'),
    'failed_logins_24h', (select count(*) from public.auth_events where event = 'login_failed' and created_at > now() - interval '24 hours'),
    'feature_adoption', jsonb_build_object(
      'transactions', (select count(distinct user_id) from public.transactions),
      'budgets', (select count(distinct user_id) from public.budgets),
      'goals', (select count(distinct user_id) from public.savings_goals),
      'lessons', (select count(distinct user_id) from public.lesson_progress)),
    'signups_by_day', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'signups', coalesce(s.n, 0), 'logins', coalesce(l.n, 0)) order by d), '[]'::jsonb)
      from generate_series(current_date - 29, current_date, interval '1 day') d
      left join (select created_at::date dd, count(*) n from public.users where created_at > current_date - 30 group by 1) s on s.dd = d::date
      left join (select created_at::date dd, count(distinct user_id) n from public.auth_events where event = 'login_success' and created_at > current_date - 30 group by 1) l on l.dd = d::date),
    'recent_activity', (
      select coalesce(jsonb_agg(x order by at desc), '[]'::jsonb) from (
        select x, at from (
          (select created_at at, jsonb_build_object('at', created_at, 'kind', 'admin', 'action', action, 'who', actor_email, 'target', target_label, 'details', details) x
             from public.audit_log order by created_at desc limit 12)
          union all
          (select created_at, jsonb_build_object('at', created_at, 'kind', 'auth', 'action', event, 'who', email, 'target', null, 'details', '{}'::jsonb)
             from public.auth_events where event in ('signup', 'login_failed', 'suspended_login_blocked') order by created_at desc limit 12)
        ) u order by at desc limit 12
      ) t)
  ) into result;
  return result;
end;
$$;
revoke execute on function public.admin_dashboard_stats() from public, anon;
grant  execute on function public.admin_dashboard_stats() to authenticated;

create or replace function public.admin_reports(p_months int default 6)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  m int := greatest(1, least(coalesce(p_months, 6), 24));
  start_month date := (date_trunc('month', current_date) - make_interval(months => m - 1))::date;
  result jsonb;
begin
  if not private.is_staff() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'generated_at', now(),
    'months', m,
    'user_activity', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'month', to_char(mo, 'YYYY-MM'),
        'signups', (select count(*) from public.users u where date_trunc('month', u.created_at) = mo),
        'active_users', (select count(distinct e.user_id) from public.auth_events e where e.event = 'login_success' and date_trunc('month', e.created_at) = mo),
        'logins', (select count(*) from public.auth_events e where e.event = 'login_success' and date_trunc('month', e.created_at) = mo),
        'users_with_transactions', (select count(distinct t.user_id) from public.transactions t where date_trunc('month', t.date) = mo)
      ) order by mo), '[]'::jsonb)
      from generate_series(start_month, date_trunc('month', current_date)::date, interval '1 month') mo),
    'financial_trends', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'month', to_char(mo, 'YYYY-MM'),
        'transactions', (select count(*) from public.transactions t where date_trunc('month', t.date) = mo),
        'income_total', (select coalesce(sum(amount), 0) from public.transactions t where t.type = 'income' and date_trunc('month', t.date) = mo),
        'expense_total', (select coalesce(sum(amount), 0) from public.transactions t where t.type = 'expense' and date_trunc('month', t.date) = mo),
        'active_trackers', (select count(distinct user_id) from public.transactions t where date_trunc('month', t.date) = mo)
      ) order by mo), '[]'::jsonb)
      from generate_series(start_month, date_trunc('month', current_date)::date, interval '1 month') mo),
    -- Only categories used by at least 3 different people are shown, so no single person can be identified.
    'spending_by_category', (
      select coalesce(jsonb_agg(jsonb_build_object('category', category, 'total', total, 'people', people, 'transactions', n) order by total desc), '[]'::jsonb)
      from (
        select coalesce(c.name, 'Uncategorised') category, sum(t.amount) total, count(distinct t.user_id) people, count(*) n
        from public.transactions t left join public.categories c on c.id = t.category_id
        where t.type = 'expense' and t.date >= start_month
        group by 1 having count(distinct t.user_id) >= 3
      ) s),
    'education', (
      select coalesce(jsonb_agg(jsonb_build_object('lesson_id', lesson_id, 'started', started, 'completed', completed) order by lesson_id), '[]'::jsonb)
      from (select lesson_id, count(*) started, count(completed_at) completed from public.lesson_progress group by lesson_id) e),
    'security', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'month', to_char(mo, 'YYYY-MM'),
        'logins', (select count(*) from public.auth_events e where e.event = 'login_success' and date_trunc('month', e.created_at) = mo),
        'failed_logins', (select count(*) from public.auth_events e where e.event = 'login_failed' and date_trunc('month', e.created_at) = mo),
        'password_resets', (select count(*) from public.auth_events e where e.event = 'password_reset_requested' and date_trunc('month', e.created_at) = mo),
        'admin_actions', (select count(*) from public.audit_log a where date_trunc('month', a.created_at) = mo)
      ) order by mo), '[]'::jsonb)
      from generate_series(start_month, date_trunc('month', current_date)::date, interval '1 month') mo)
  ) into result;
  return result;
end;
$$;
revoke execute on function public.admin_reports(int) from public, anon;
grant  execute on function public.admin_reports(int) to authenticated;

create or replace function public.admin_lesson_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_staff() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return (select coalesce(jsonb_object_agg(lesson_id::text, jsonb_build_object('started', started, 'completed', completed)), '{}'::jsonb)
          from (select lesson_id, count(*) started, count(completed_at) completed from public.lesson_progress group by lesson_id) s);
end;
$$;
revoke execute on function public.admin_lesson_stats() from public, anon;
grant  execute on function public.admin_lesson_stats() to authenticated;

-- Security overview: admin and superadmin.
create or replace function public.admin_security_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if private.current_user_role() not in ('admin', 'superadmin') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'generated_at', now(),
    'failed_24h', (select count(*) from public.auth_events where event = 'login_failed' and created_at > now() - interval '24 hours'),
    'failed_7d', (select count(*) from public.auth_events where event = 'login_failed' and created_at > now() - interval '7 days'),
    'success_24h', (select count(*) from public.auth_events where event = 'login_success' and created_at > now() - interval '24 hours'),
    'resets_7d', (select count(*) from public.auth_events where event = 'password_reset_requested' and created_at > now() - interval '7 days'),
    'suspended_accounts', (select count(*) from public.users where status = 'suspended'),
    'staff_accounts', (select count(*) from public.users where role in ('support', 'admin', 'superadmin')),
    'repeated_failures', (
      select coalesce(jsonb_agg(jsonb_build_object('email', email, 'attempts', n, 'last_at', last_at, 'last_ip', last_ip, 'ips', ips) order by n desc), '[]'::jsonb)
      from (
        select email, count(*) n, max(created_at) last_at,
               (array_agg(ip order by created_at desc))[1] last_ip, count(distinct ip) ips
        from public.auth_events
        where event = 'login_failed' and created_at > now() - interval '24 hours'
        group by email having count(*) >= 5
      ) f),
    'blocked_suspended', (
      select coalesce(jsonb_agg(jsonb_build_object('email', email, 'at', created_at, 'ip', ip) order by created_at desc), '[]'::jsonb)
      from (select email, created_at, ip from public.auth_events where event = 'suspended_login_blocked' and created_at > now() - interval '7 days' order by created_at desc limit 50) b),
    'privilege_changes', (
      select coalesce(jsonb_agg(jsonb_build_object('id', id, 'at', created_at, 'by', actor_email, 'target', target_label, 'details', details) order by created_at desc), '[]'::jsonb)
      from (select id, created_at, actor_email, target_label, details from public.audit_log
            where action = 'role_changed' and details->>'to' in ('admin', 'superadmin', 'support')
              and created_at > now() - interval '7 days' order by created_at desc limit 50) p),
    'resolved_keys', (
      select coalesce(jsonb_agg(distinct details->>'key'), '[]'::jsonb)
      from public.audit_log where action = 'alert_resolved' and created_at > now() - interval '30 days'),
    'recent_failed', (
      select coalesce(jsonb_agg(jsonb_build_object('email', email, 'at', created_at, 'ip', ip, 'agent', user_agent, 'known_user', user_id is not null) order by created_at desc), '[]'::jsonb)
      from (select email, created_at, ip, user_agent, user_id from public.auth_events where event = 'login_failed' order by created_at desc limit 100) f),
    'recent_logins', (
      select coalesce(jsonb_agg(jsonb_build_object('email', email, 'at', created_at, 'ip', ip, 'agent', user_agent) order by created_at desc), '[]'::jsonb)
      from (select email, created_at, ip, user_agent from public.auth_events where event = 'login_success' order by created_at desc limit 100) s)
  ) into result;
  return result;
end;
$$;
revoke execute on function public.admin_security_overview() from public, anon;
grant  execute on function public.admin_security_overview() to authenticated;

-- Activity log: admin actions and sign-in events in one list. Admin and superadmin.
create or replace function public.admin_activity_log(
  p_kind text default 'all', p_search text default null, p_limit int default 50, p_offset int default 0,
  p_since timestamptz default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  lim int := greatest(1, least(coalesce(p_limit, 50), 500));
  off int := greatest(0, coalesce(p_offset, 0));
  q text := nullif(lower(trim(coalesce(p_search, ''))), '');
  result jsonb;
begin
  if private.current_user_role() not in ('admin', 'superadmin') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  with combined as (
    select 'admin'::text kind, a.created_at, a.action, a.actor_email who, a.actor_role who_role,
           a.target_label target, a.details, a.ip, null::text agent
      from public.audit_log a
    union all
    select 'auth'::text, e.created_at, e.event, e.email, null, null, '{}'::jsonb, e.ip, e.user_agent
      from public.auth_events e
  ), filtered as (
    select * from combined
    where (p_kind = 'all' or kind = p_kind
           or (p_kind = 'security' and action in ('login_failed', 'suspended_login_blocked', 'role_changed', 'user_suspended', 'alert_resolved')))
      and (p_since is null or created_at >= p_since)
      and (q is null or lower(coalesce(who, '')) like '%' || q || '%' or lower(coalesce(target, '')) like '%' || q || '%'
           or lower(action) like '%' || q || '%' or coalesce(ip, '') like '%' || q || '%')
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'rows', (select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]'::jsonb)
             from (select * from filtered order by created_at desc limit lim offset off) r)
  ) into result;
  return result;
end;
$$;
revoke execute on function public.admin_activity_log(text, text, int, int, timestamptz) from public, anon;
grant  execute on function public.admin_activity_log(text, text, int, int, timestamptz) to authenticated;
