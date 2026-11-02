-- Synthetic fixtures, transaction-local identity stub, and ROLLBACK only.
-- Never reads real auth rows, creates an external account, or changes real grants.
begin;
create or replace function toyota_private.verified_viewer_email()
returns text language sql stable security definer set search_path='' as $$select 'toyota-viewer-test@example.invalid'::text$$;
do $$
declare a uuid;b uuid;c uuid;occasion_a uuid;occasion_exam uuid;occasion_b uuid;canonical jsonb;
begin
 insert into public.classes(name,kind,roster,contacts) values('VIEWER TEST A','passenger',array['Titkos Anna','Rejtett Péter'],'{"Titkos Anna":"never-share@example.invalid"}') returning id into a;
 insert into public.classes(name,kind,roster,contacts) values('VIEWER TEST B','passenger',array['Másik Csapat'],'{}') returning id into b;
 insert into public.classes(name,kind,roster,contacts) values('VIEWER TEST EXPIRED','fleet',array['Lejárt Név'],'{}') returning id into c;
 insert into public.occasions(class_id,name,mode) values(a,'Gyakorlás','practice') returning id into occasion_a;
 insert into public.occasions(class_id,name,mode) values(a,'Vizsga','exam') returning id into occasion_exam;
 insert into public.occasions(class_id,name,mode) values(b,'Másik osztály','practice') returning id into occasion_b;
 select items into canonical from toyota_private.criteria_versions where kind='passenger' and version='toyota-2026-11-v1';
 perform public.submit_occasion_versioned(occasion_a,'Titkos Megfigyelő','toyota-2026-11-v1',canonical,gen_random_uuid(),'Titkos Anna',array_fill(2::smallint,array[20]),'Azonosító szabad szöveg');
 perform public.submit_occasion_versioned(occasion_exam,'Titkos Megfigyelő','toyota-2026-11-v1',canonical,gen_random_uuid(),'Rejtett Péter',array_fill(1::smallint,array[20]),'Vizsgás visszajelzés');
 insert into toyota_private.viewer_grants(class_id,email,show_names,expires_at) values(a,'toyota-viewer-test@example.invalid',false,now()+interval '30 days'),(c,'toyota-viewer-test@example.invalid',false,now()-interval '1 day');
 perform set_config('toyota_test.class_a',a::text,true);perform set_config('toyota_test.class_b',b::text,true);perform set_config('toyota_test.class_expired',c::text,true);
 perform set_config('toyota_test.occasion_a',occasion_a::text,true);perform set_config('toyota_test.occasion_b',occasion_b::text,true);
end$$;
set local role authenticated;
do $$
declare data jsonb;denied boolean;class_a uuid:=current_setting('toyota_test.class_a')::uuid;
begin
 if public.toyota_app_role()<>'viewer' then raise exception 'Viewer role missing';end if;
 data:=public.viewer_workspace(class_a,md5(current_setting('toyota_test.occasion_a')),0);
 if jsonb_array_length(data->'classes')<>1 or jsonb_array_length(data->'occasions')<>2 or jsonb_array_length(data->'entries')<>1 then raise exception 'Scope or mode separation failed';end if;
 if data::text like '%Titkos%' or data::text like '%Rejtett%' or data::text like '%never-share%' or data::text like '%Azonosító szabad%' or data::text like '%'||current_setting('toyota_test.occasion_a')||'%' then raise exception 'Private fields or QR identifier leaked';end if;
 if data->'entries'->0->>'seller'<>'Résztvevő 01' then raise exception 'Pseudonym missing';end if;
 denied:=false;begin perform public.viewer_workspace(current_setting('toyota_test.class_b')::uuid,null,0);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Unassigned class accessible';end if;
 denied:=false;begin perform public.viewer_workspace(current_setting('toyota_test.class_expired')::uuid,null,0);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Expired class accessible';end if;
 denied:=false;begin perform public.viewer_workspace(class_a,md5(current_setting('toyota_test.occasion_b')),0);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Cross-class occasion accessible';end if;
 denied:=false;begin perform public.manage_viewer_access(class_a,'new@example.invalid',true,30);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Viewer granted access';end if;
 denied:=false;begin perform public.revoke_viewer_access(gen_random_uuid());exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Viewer revoked access';end if;
 denied:=false;begin perform public.list_viewer_access(class_a);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Viewer listed grant emails';end if;
 denied:=false;begin perform public.set_observation_closed(class_a,'class',true);exception when raise_exception then denied:=true;end;if not denied then raise exception 'Viewer closed class';end if;
 if exists(select 1 from public.classes) then raise exception 'Direct class RLS bypass';end if;
 denied:=false;begin insert into public.classes(name,kind,roster) values('Forbidden','fleet',array['Test']);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Viewer inserted class';end if;
end$$;
reset role;
update toyota_private.viewer_grants set show_names=true where class_id=current_setting('toyota_test.class_a')::uuid;
set local role authenticated;
do $$declare data jsonb;begin
 data:=public.viewer_workspace(current_setting('toyota_test.class_a')::uuid,md5(current_setting('toyota_test.occasion_a')),0);
 if data->'entries'->0->>'seller'<>'Titkos Anna' or data->'entries'->0->'observers'->>'name'<>'Titkos Megfigyelő' or data->'entries'->0->>'notes'<>'Azonosító szabad szöveg' then raise exception 'Authorized named detail missing';end if;
 if data::text like '%never-share%' then raise exception 'Contact email leaked with names';end if;
end$$;
reset role;
update toyota_private.viewer_grants set revoked_at=now() where class_id=current_setting('toyota_test.class_a')::uuid;
set local role authenticated;
do $$declare denied boolean:=false;begin
 if public.toyota_app_role() is not null then raise exception 'Role remains after revocation';end if;
 begin perform public.viewer_workspace(current_setting('toyota_test.class_a')::uuid,null,0);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Revoked grant still reads data';end if;
end$$;
reset role;
set local role anon;
do $$declare denied boolean:=false;begin
 begin perform public.viewer_workspace(null,null,0);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Anonymous viewer access';end if;
end$$;
reset role;
rollback;
select 'PASS: scoped reads, pseudonyms, no contacts/QR IDs, names opt-in, read-only authorization, expiry, revocation, anonymous denial' as result;
