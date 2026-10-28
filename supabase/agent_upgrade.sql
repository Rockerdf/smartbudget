-- ===========================================================================
-- SmartBudget AI agent upgrade  (safe to run more than once)
--
-- Adds: chat history for the AI agent, private file storage for uploads
-- (receipts, photos, PDFs, spreadsheets, videos), receipt links on
-- transactions, and a per-person usage limit so the free AI quota is shared
-- fairly.
--
-- Paste the whole file into Supabase: SQL Editor -> New query -> Run.
-- (schema.sql already includes it, so a brand-new project only needs schema.sql.)
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Receipts on transactions (path of the file inside the private bucket)
-- ---------------------------------------------------------------------------
alter table public.transactions add column if not exists receipt_path text;
do $$ begin
  alter table public.transactions add constraint transactions_receipt_path_own
    check (receipt_path is null or (char_length(receipt_path) <= 300 and receipt_path like user_id::text || '/%')) not valid;
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Conversations and messages
-- ---------------------------------------------------------------------------
create table if not exists public.agent_conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.users(id) on delete cascade,
  title       text not null default 'New chat' check (char_length(title) <= 120),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists agent_conversations_user_idx on public.agent_conversations (user_id, updated_at desc);

create table if not exists public.agent_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.agent_conversations(id) on delete cascade,
  user_id          uuid not null default auth.uid() references public.users(id) on delete cascade,
  role             text not null check (role in ('user', 'assistant')),
  content          text not null default '' check (char_length(content) <= 40000),
  attachments      jsonb not null default '[]'::jsonb,
  actions          jsonb not null default '[]'::jsonb,
  created_at       timestamptz not null default now()
);
create index if not exists agent_messages_conv_idx on public.agent_messages (conversation_id, created_at);

-- A message can only be filed under one of your own conversations.
create or replace function private.agent_message_owner_ok()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.agent_conversations c where c.id = new.conversation_id and c.user_id = new.user_id) then
    raise exception 'conversation not found' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists agent_messages_owner on public.agent_messages;
create trigger agent_messages_owner before insert or update on public.agent_messages
  for each row execute function private.agent_message_owner_ok();

alter table public.agent_conversations enable row level security;
alter table public.agent_messages      enable row level security;
revoke all on public.agent_conversations, public.agent_messages from anon, authenticated;
grant select, insert, update, delete on public.agent_conversations, public.agent_messages to authenticated;

drop policy if exists "agent_conversations_own" on public.agent_conversations;
create policy "agent_conversations_own" on public.agent_conversations
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "agent_messages_own" on public.agent_messages;
create policy "agent_messages_own" on public.agent_messages
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Fair-use limit. Not reachable directly by users (no grants); only through
-- agent_take_quota(), which the AI agent calls once per message.
-- ---------------------------------------------------------------------------
create table if not exists public.agent_usage (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index if not exists agent_usage_user_idx on public.agent_usage (user_id, created_at desc);
alter table public.agent_usage enable row level security;
revoke all on public.agent_usage from anon, authenticated;

insert into public.app_settings (key, value) values
  ('agent_hourly_limit', '30'::jsonb),
  ('agent_daily_limit',  '150'::jsonb)
on conflict (key) do nothing;

create or replace function public.agent_take_quota()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  r  text;
  per_hour int;
  per_day  int;
  used_hour int;
  used_day  int;
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select role into r from public.users where id = me and status = 'active';
  if r is null then raise exception 'not allowed' using errcode = '42501'; end if;

  select coalesce((select (value #>> '{}')::int from public.app_settings where key = 'agent_hourly_limit'), 30) into per_hour;
  select coalesce((select (value #>> '{}')::int from public.app_settings where key = 'agent_daily_limit'), 150) into per_day;
  if r in ('support', 'admin', 'superadmin') then
    per_hour := per_hour * 3; per_day := per_day * 3;
  end if;

  select count(*) filter (where created_at > now() - interval '1 hour'), count(*)
    into used_hour, used_day
    from public.agent_usage where user_id = me and created_at > now() - interval '1 day';

  if used_hour >= per_hour then
    return jsonb_build_object('ok', false, 'message', format('You have reached the limit of %s AI messages per hour. Please try again a bit later.', per_hour));
  end if;
  if used_day >= per_day then
    return jsonb_build_object('ok', false, 'message', format('You have reached the limit of %s AI messages per day. It resets within 24 hours.', per_day));
  end if;

  insert into public.agent_usage (user_id) values (me);
  delete from public.agent_usage where created_at < now() - interval '2 days';
  return jsonb_build_object('ok', true, 'remaining_hour', per_hour - used_hour - 1, 'remaining_day', per_day - used_day - 1, 'role', r);
end;
$$;
revoke execute on function public.agent_take_quota() from public, anon;
grant  execute on function public.agent_take_quota() to authenticated;

-- Staff-only: how much the agent is being used (totals only, no message content).
create or replace function public.admin_agent_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.current_user_role() not in ('support', 'admin', 'superadmin') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'messages_today', (select count(*) from public.agent_usage where created_at > now() - interval '1 day'),
    'people_today',   (select count(distinct user_id) from public.agent_usage where created_at > now() - interval '1 day'),
    'conversations',  (select count(*) from public.agent_conversations)
  );
end;
$$;
revoke execute on function public.admin_agent_stats() from public, anon;
grant  execute on function public.admin_agent_stats() to authenticated;

-- ---------------------------------------------------------------------------
-- Private file storage: bucket "agent-files". Every person has their own
-- folder named after their user id and can only see or change files in it.
-- 50 MB per file (the Supabase free-plan maximum).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('agent-files', 'agent-files', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists "agent_files_select_own" on storage.objects;
create policy "agent_files_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'agent-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "agent_files_insert_own" on storage.objects;
create policy "agent_files_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'agent-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "agent_files_update_own" on storage.objects;
create policy "agent_files_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'agent-files' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'agent-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "agent_files_delete_own" on storage.objects;
create policy "agent_files_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'agent-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Site settings: same as the admin upgrade, plus the two AI usage limits.
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
    elsif k in ('agent_hourly_limit', 'agent_daily_limit') then
      if jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric not between 1 and 5000 or (v #>> '{}')::numeric <> trunc((v #>> '{}')::numeric) then
        raise exception 'invalid value for %', k using errcode = '22023';
      end if;
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
