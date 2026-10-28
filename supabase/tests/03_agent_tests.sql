-- AI agent upgrade tests: run after 00_local_stub.sql and schema.sql on a throw-away local PostgreSQL.
\set ON_ERROR_STOP 0
insert into auth.users(id,email) values
 ('b0000000-0000-0000-0000-000000000001','amy@x.com'),
 ('b0000000-0000-0000-0000-000000000002','ben@x.com'),
 ('b0000000-0000-0000-0000-000000000003','staff@x.com');
update public.users set role='admin' where email='staff@x.com';
create or replace function public.try_(label text, stmt text) returns void language plpgsql as $f$
begin execute stmt; raise notice '% -> ALLOWED', label; exception when others then raise notice '% -> BLOCKED (%)', label, sqlerrm; end $f$;
grant execute on function public.try_(text,text) to anon, authenticated;

set role authenticated;
select set_config('request.jwt.claim.sub','b0000000-0000-0000-0000-000000000001',false);
insert into public.agent_conversations(id,title) values ('c0000000-0000-0000-0000-00000000000a','Amy chat');
select public.try_('amy: add message to own chat', $$insert into public.agent_messages(conversation_id,role,content) values ('c0000000-0000-0000-0000-00000000000a','user','hi')$$);
select public.try_('amy: receipt in own folder', $$insert into public.transactions(user_id,description,amount,type,receipt_path) values ('b0000000-0000-0000-0000-000000000001','coffee',5,'expense','b0000000-0000-0000-0000-000000000001/r.jpg')$$);
select public.try_('amy: receipt pointing at ben folder (expect BLOCKED)', $$insert into public.transactions(user_id,description,amount,type,receipt_path) values ('b0000000-0000-0000-0000-000000000001','x',5,'expense','b0000000-0000-0000-0000-000000000002/r.jpg')$$);
select public.try_('amy: upload to own folder', $$insert into storage.objects(bucket_id,name) values ('agent-files','b0000000-0000-0000-0000-000000000001/a.png')$$);
select public.try_('amy: upload to ben folder (expect BLOCKED)', $$insert into storage.objects(bucket_id,name) values ('agent-files','b0000000-0000-0000-0000-000000000002/evil.png')$$);
select public.try_('amy: upload to bucket root (expect BLOCKED)', $$insert into storage.objects(bucket_id,name) values ('agent-files','root.png')$$);
select public.try_('amy: read agent_usage directly (expect BLOCKED)', $$select count(*) from public.agent_usage$$);
select public.try_('amy: reset usage (expect BLOCKED)', $$delete from public.agent_usage$$);
select public.try_('amy: agent stats (expect BLOCKED)', $$select public.admin_agent_stats()$$);
select 'amy first quota' t, public.agent_take_quota();

select set_config('request.jwt.claim.sub','b0000000-0000-0000-0000-000000000002',false);
select 'ben sees amy chats (expect 0)' t, count(*) from public.agent_conversations;
select 'ben sees amy messages (expect 0)' t, count(*) from public.agent_messages;
select 'ben sees amy files (expect 0)' t, count(*) from storage.objects;
select public.try_('ben: post into amy chat (expect BLOCKED)', $$insert into public.agent_messages(conversation_id,role,content) values ('c0000000-0000-0000-0000-00000000000a','assistant','spoof')$$);
select public.try_('ben: post into amy chat as amy (expect BLOCKED)', $$insert into public.agent_messages(conversation_id,user_id,role,content) values ('c0000000-0000-0000-0000-00000000000a','b0000000-0000-0000-0000-000000000001','assistant','spoof')$$);
select public.try_('ben: delete amy file', $$delete from storage.objects where name like 'b0000000-0000-0000-0000-000000000001/%'$$);
do $$ declare r jsonb; begin for i in 1..31 loop r := public.agent_take_quota(); end loop; raise notice 'ben 31st quota -> %', r; end $$;

select set_config('request.jwt.claim.sub','b0000000-0000-0000-0000-000000000003',false);
select 'staff agent stats' t, public.admin_agent_stats();
do $$ declare r jsonb; begin for i in 1..31 loop r := public.agent_take_quota(); end loop; raise notice 'staff 31st quota (expect ok, 3x limit) -> %', r->'ok'; end $$;

reset role;
select 'amy file still there (expect 1)' t, count(*) from storage.objects where name like 'b0000000-0000-0000-0000-000000000001/%';
update public.users set status='suspended' where email='amy@x.com';
set role authenticated; select set_config('request.jwt.claim.sub','b0000000-0000-0000-0000-000000000001',false);
select public.try_('suspended amy: quota (expect BLOCKED)', $$select public.agent_take_quota()$$);
reset role;
set role anon; select set_config('request.jwt.claim.sub','',false);
select public.try_('anon: quota (expect BLOCKED)', $$select public.agent_take_quota()$$);
select public.try_('anon: read chats (expect BLOCKED)', $$select count(*) from public.agent_conversations$$);
reset role;
delete from auth.users where email='amy@x.com';
select 'amy chats removed with account (expect 0)' t, count(*) from public.agent_conversations;
