\set A '''11111111-1111-1111-1111-111111111111'''
\set B '''22222222-2222-2222-2222-222222222222'''
\set C '''33333333-3333-3333-3333-333333333333'''
insert into auth.users(id,email,raw_user_meta_data) values (:A,'alice@x.com','{"full_name":"Alice"}'),(:B,'bob@x.com','{}'),(:C,'root@x.com','{}');
update public.users set role='superadmin' where id=:C;   -- bootstrap as owner
update public.users set role='admin' where id=:B;
create or replace function public.try_(label text, stmt text) returns void language plpgsql security invoker as $f$
begin execute stmt; raise notice '% -> ALLOWED', label; exception when others then raise notice '% -> BLOCKED (%)', label, sqlerrm; end $f$;
grant execute on function public.try_(text,text) to anon, authenticated;
set role authenticated; select set_config('request.jwt.claim.sub',:A,false) \gset
select public.try_('alice: set own role superadmin', $$update public.users set role='superadmin' where id='11111111-1111-1111-1111-111111111111'$$);
select public.try_('alice: set own status', $$update public.users set status='suspended' where id='11111111-1111-1111-1111-111111111111'$$);
select public.try_('alice: change own email', $$update public.users set email='z@z.com' where id='11111111-1111-1111-1111-111111111111'$$);
select public.try_('alice: change own name', $$update public.users set name='Alice A' where id='11111111-1111-1111-1111-111111111111'$$);
select public.try_('alice: insert fake profile', $$insert into public.users(id,email,role) values (gen_random_uuid(),'f@f.com','superadmin')$$);
select public.try_('alice: delete profile', $$delete from public.users where id='11111111-1111-1111-1111-111111111111'$$);
select public.try_('alice: call admin_set_role', $$select public.admin_set_role('22222222-2222-2222-2222-222222222222','user')$$);
select public.try_('alice: call admin_set_status', $$select public.admin_set_status('22222222-2222-2222-2222-222222222222','suspended')$$);
select public.try_('alice: insert tx as self', $$insert into public.transactions(user_id,description,amount,type) values ('11111111-1111-1111-1111-111111111111','coffee',4.5,'expense')$$);
select public.try_('alice: insert tx amount 0', $$insert into public.transactions(user_id,description,amount,type) values ('11111111-1111-1111-1111-111111111111','x',0,'expense')$$);
select public.try_('alice: insert tx for bob', $$insert into public.transactions(user_id,description,amount,type) values ('22222222-2222-2222-2222-222222222222','x',1,'expense')$$);
select public.try_('alice: make system category', $$insert into public.categories(user_id,name,is_system) values ('11111111-1111-1111-1111-111111111111','Mine',true)$$);
select 'alice sees users rows (expect 1)' t, count(*) from public.users;
select public.try_('alice: touch_last_login', $$select public.touch_last_login()$$);
select set_config('request.jwt.claim.sub',:B,false) \gset
select 'admin(bob) sees users rows (expect 3)' t, count(*) from public.users;
select 'admin(bob) sees alice tx (expect 0)' t, count(*) from public.transactions;
select public.try_('admin: set_role', $$select public.admin_set_role('11111111-1111-1111-1111-111111111111','support')$$);
select public.try_('admin: suspend alice', $$select public.admin_set_status('11111111-1111-1111-1111-111111111111','suspended')$$);
select public.try_('admin: suspend superadmin', $$select public.admin_set_status('33333333-3333-3333-3333-333333333333','suspended')$$);
select set_config('request.jwt.claim.sub',:C,false) \gset
select public.try_('superadmin: set alice support', $$select public.admin_set_role('11111111-1111-1111-1111-111111111111','support')$$);
select public.try_('superadmin: demote self', $$select public.admin_set_role('33333333-3333-3333-3333-333333333333','user')$$);
select public.try_('superadmin: bad role', $$select public.admin_set_role('11111111-1111-1111-1111-111111111111','god')$$);
reset role; select 'final roles' t, string_agg(email||'='||role||'/'||status, ', ' order by email) from public.users;
set role anon;
select public.try_('anon: read transactions', $$select count(*) from public.transactions$$);
select public.try_('anon: read categories', $$select count(*) from public.categories$$);
select public.try_('anon: read users', $$select count(*) from public.users$$);
select public.try_('anon: admin_set_role', $$select public.admin_set_role('11111111-1111-1111-1111-111111111111','admin')$$);
