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
