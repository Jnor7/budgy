-- Budgy V3 — smoke tests de structure RLS (à exécuter via `supabase test db`).
begin;
select plan(10);

select has_table('public', 'airports', 'airports existe');
select has_table('public', 'travel_friend_requests', 'travel_friend_requests existe');
select has_table('public', 'travel_friends', 'travel_friends existe');

select ok((select relrowsecurity from pg_class where oid = 'public.airports'::regclass), 'RLS airports active');
select ok((select relrowsecurity from pg_class where oid = 'public.travel_friend_requests'::regclass), 'RLS demandes active');
select ok((select relrowsecurity from pg_class where oid = 'public.travel_friends'::regclass), 'RLS amis active');

select policies_are('public', 'travel_friend_requests', array['travel_friend_requests_select_concerned']);
select policies_are('public', 'travel_friends', array['travel_friends_select_concerned']);
select function_privs_are('public', 'send_travel_friend_request', array['text'], 'authenticated', array['EXECUTE']);
select function_privs_are('public', 'respond_travel_friend_request', array['uuid','boolean'], 'authenticated', array['EXECUTE']);

select * from finish();
rollback;
