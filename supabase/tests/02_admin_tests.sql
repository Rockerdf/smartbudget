-- Admin upgrade tests: run after 00_local_stub.sql and schema.sql on a throw-away local PostgreSQL.
\set ON_ERROR_STOP 0
select set_config('request.headers','{"x-forwarded-for":"203.0.113.7, 10.0.0.1","user-agent":"TestBrowser/1.0"}',false);
insert into auth.users(id,email,raw_user_meta_data) values
 ('a0000000-0000-0000-0000-000000000001','root@x.com','{"full_name":"Root"}'),
 ('a0000000-0000-0000-0000-000000000002','adm@x.com','{}'),
 ('a0000000-0000-0000-0000-000000000003','sup@x.com','{}'),
 ('a0000000-0000-0000-0000-000000000004','u1@x.com','{}'),
 ('a0000000-0000-0000-0000-000000000005','u2@x.com','{}'),
 ('a0000000-0000-0000-0000-000000000006','u3@x.com','{}');
update public.users set role='superadmin' where email='root@x.com';
update public.users set role='admin' where email='adm@x.com';
update public.users set role='support' where email='sup@x.com';
select 'signup events (expect 6)' t, count(*), max(ip) ip, max(user_agent) ua from public.auth_events where event='signup';
create or replace function public.try_(label text, stmt text) returns void language plpgsql as $f$
begin execute stmt; raise notice '% -> ALLOWED', label; exception when others then raise notice '% -> BLOCKED (%)', label, sqlerrm; end $f$;
grant execute on function public.try_(text,text) to anon, authenticated;

-- user data for 3 users so categories pass the 3-person rule
set role authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000004',false);
insert into public.transactions(user_id,category_id,description,amount,type) select 'a0000000-0000-0000-0000-000000000004',id,'food',20,'expense' from public.categories where name='Food & Dining';
insert into public.lesson_progress(user_id,lesson_id,completed_at) values ('a0000000-0000-0000-0000-000000000004',1,now()),('a0000000-0000-0000-0000-000000000004',2,null);
select public.touch_last_login();
select public.try_('user: read audit_log directly', $$select count(*) from public.audit_log$$);
select public.try_('user: read auth_events directly', $$select count(*) from public.auth_events$$);
select public.try_('user: dashboard stats', $$select public.admin_dashboard_stats()$$);
select public.try_('user: reports', $$select public.admin_reports()$$);
select public.try_('user: security overview', $$select public.admin_security_overview()$$);
select public.try_('user: activity log', $$select public.admin_activity_log()$$);
select public.try_('user: update settings', $$select public.admin_update_settings('{"maintenance_mode":true}')$$);
select public.try_('user: set content', $$select public.admin_set_content('lesson:1',true,false)$$);
select public.try_('user: log admin action', $$select public.log_admin_action('report_exported')$$);
select public.try_('user: write other user lesson', $$insert into public.lesson_progress(user_id,lesson_id) values ('a0000000-0000-0000-0000-000000000005',3)$$);
select public.try_('user: change app_settings directly', $$update public.app_settings set value='true' where key='maintenance_mode'$$);
select public.try_('user: record logout', $$select public.record_auth_event('logout','someoneelse@x.com')$$);

select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000005',false);
insert into public.transactions(user_id,category_id,description,amount,type) select 'a0000000-0000-0000-0000-000000000005',id,'food',30,'expense' from public.categories where name='Food & Dining';
insert into public.transactions(user_id,category_id,description,amount,type) select 'a0000000-0000-0000-0000-000000000005',id,'rent',900,'expense' from public.categories where name='Housing';
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000006',false);
insert into public.transactions(user_id,category_id,description,amount,type) select 'a0000000-0000-0000-0000-000000000006',id,'food',50,'expense' from public.categories where name='Food & Dining';
insert into public.transactions(user_id,description,amount,type) values ('a0000000-0000-0000-0000-000000000006','pay',2000,'income');

-- anonymous visitor
reset role; set role anon; select set_config('request.jwt.claim.sub','',false);
select public.try_('anon: record failed login', $$select public.record_auth_event('login_failed','U1@x.com ')$$);
select public.try_('anon: record logout', $$select public.record_auth_event('logout','u1@x.com')$$);
select public.try_('anon: bogus event', $$select public.record_auth_event('login_success','u1@x.com')$$);
select public.try_('anon: read settings', $$select count(*) from public.app_settings$$);
select public.try_('anon: dashboard', $$select public.admin_dashboard_stats()$$);
do $$ begin for i in 1..40 loop perform public.record_auth_event('login_failed','victim@x.com'); end loop; end $$;
reset role;
select 'failed logins for victim (expect 30, throttled)' t, count(*) from public.auth_events where email='victim@x.com';
select 'failed login normalised email + ip' t, email, ip from public.auth_events where event='login_failed' and email='u1@x.com';

-- support
set role authenticated; select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000003',false);
select public.try_('support: dashboard', $$select public.admin_dashboard_stats()$$);
select public.try_('support: reports', $$select public.admin_reports()$$);
select public.try_('support: security overview', $$select public.admin_security_overview()$$);
select public.try_('support: activity log', $$select public.admin_activity_log()$$);
select public.try_('support: log reset sent', $$select public.log_admin_action('password_reset_sent','u1@x.com')$$);
select public.try_('support: settings', $$select public.admin_update_settings('{"signups_enabled":false}')$$);

-- admin
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002',false);
select public.try_('admin: suspend u2', $$select public.admin_set_status('a0000000-0000-0000-0000-000000000005','suspended')$$);
select public.try_('admin: security overview', $$select public.admin_security_overview()$$);
select public.try_('admin: content', $$select public.admin_set_content('lesson:1',true,false)$$);
select public.try_('admin: bad log action', $$select public.log_admin_action('drop_everything')$$);

-- superadmin
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',false);
select public.try_('super: promote u1 to support', $$select public.admin_set_role('a0000000-0000-0000-0000-000000000004','support')$$);
select public.try_('super: settings valid', $$select public.admin_update_settings('{"announcement_enabled":true,"announcement":"Hello all"}')$$);
select public.try_('super: settings bad key', $$select public.admin_update_settings('{"evil":true}')$$);
select public.try_('super: settings bad type', $$select public.admin_update_settings('{"maintenance_mode":"yes"}')$$);
select public.try_('super: hide lesson 3', $$select public.admin_set_content('lesson:3',true,false,'Zero-Based')$$);
select public.try_('super: bad content key', $$select public.admin_set_content('x; drop table',true,false)$$);
select public.try_('super: resolve alert', $$select public.log_admin_action('alert_resolved','victim@x.com','{"key":"repeated:victim@x.com"}')$$);
reset role;
select 'settings now' t, jsonb_object_agg(key,value) from public.app_settings;
set role authenticated; select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',false);
select 'dash' t, d->'users_total' total, d->'users_by_role' roles, d->'users_suspended' susp, d->'transactions_total' tx, d->'lessons_completed' lc, d->'logins_24h' li, d->'failed_logins_24h' fl, jsonb_array_length(d->'signups_by_day') days, jsonb_array_length(d->'recent_activity') act, d->'feature_adoption' fa from (select public.admin_dashboard_stats() d) s;
select 'reports' t, r->'spending_by_category' cats, jsonb_array_length(r->'user_activity') months, r->'education' edu, (r->'financial_trends'->-1) last_month from (select public.admin_reports(6) r) s;
select 'security' t, s->'failed_24h' f24, s->'suspended_accounts' susp, s->'repeated_failures' rep, jsonb_array_length(s->'privilege_changes') priv, s->'resolved_keys' res from (select public.admin_security_overview() s) x;
select 'activity all' t, a->'total' total, a->'rows'->0->>'action' latest from (select public.admin_activity_log('all',null,5,0) a) x;
select 'activity search victim' t, a->'total' total from (select public.admin_activity_log('auth','victim',5,0) a) x;
select 'activity admin only' t, (select string_agg(r->>'action', ',') from jsonb_array_elements(a->'rows') r) from (select public.admin_activity_log('admin',null,20,0) a) x;
-- signups closed enforcement
reset role;
update public.app_settings set value='false' where key='signups_enabled';
select public.try_('signup while closed', $$insert into auth.users(email) values ('late@x.com')$$);
update public.app_settings set value='true' where key='signups_enabled';
-- account deletion audited
set role authenticated; select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000006',false);
select public.delete_my_account();
reset role;
select 'deletion audited' t, action, target_label from public.audit_log where action='account_deleted';
select 'lesson rows for deleted user' t, count(*) from public.lesson_progress where user_id='a0000000-0000-0000-0000-000000000006';
