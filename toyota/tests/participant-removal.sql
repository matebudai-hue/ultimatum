begin;
create or replace function toyota_private.is_admin() returns boolean language sql stable security definer set search_path='' as $$select true$$;
create or replace function toyota_private.verified_viewer_email() returns text language sql stable security definer set search_path='' as $$select 'removal-test@example.invalid'::text$$;
do $$declare c uuid;a uuid;r uuid:=gen_random_uuid();items jsonb;denied boolean:=false;payload jsonb;begin
 insert into public.classes(name,kind,roster) values('REMOVAL TEST','passenger',array['Minta Anna','Minta Béla']) returning id into c;
 insert into public.occasions(class_id,name,mode) values(c,'Vizsga','exam') returning id into a;
 select v.items into items from toyota_private.criteria_versions v where kind='passenger' and version='toyota-2026-11-v1';
 perform public.submit_occasion_versioned(a,'Megfigyelő','toyota-2026-11-v1',items,r,'Minta Anna',array_fill(2::smallint,array[20]),'Megőrzendő visszajelzés');
 perform public.set_exam_result(a,'Minta Anna','passed',0,0);
 perform public.set_class_participant_active(c,'Minta Anna',false,0);
 perform public.set_class_participant_active(c,'Minta Anna',false,0);
 if (select roster_revision from public.classes where id=c)<>1 then raise exception 'Retry changed roster revision';end if;
 if public.occasion_context(a)->'roster'<> '["Minta Béla"]'::jsonb then raise exception 'Inactive person offered to participant';end if;
 if not exists(select 1 from public.observations where id=r and seller='Minta Anna') then raise exception 'Historical observation removed';end if;
 if not exists(select 1 from toyota_private.exam_decisions where occasion_id=a and seller='Minta Anna' and status='passed') then raise exception 'Historical exam decision lost';end if;
 -- A committed receipt remains safe to retry even after removal.
 perform public.submit_occasion_versioned(a,'Megfigyelő','toyota-2026-11-v1',items,r,'Minta Anna',array_fill(2::smallint,array[20]),'Megőrzendő visszajelzés');
 begin perform public.submit_occasion_versioned(a,'Megfigyelő','toyota-2026-11-v1',items,gen_random_uuid(),'Minta Anna',array_fill(2::smallint,array[20]),'Új');exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Stale form accepted new inactive observation';end if;
 denied:=false;begin perform public.set_class_participant_active(c,'Minta Béla',false,0);exception when raise_exception then denied:=true;end;if not denied then raise exception 'Stale roster revision accepted';end if;
 perform public.set_class_participant_active(c,'Minta Béla',false,1);
 payload:=public.get_exam_results(a);
 if payload->'roster'<>'["Minta Anna"]'::jsonb then raise exception 'Report failed to preserve decided person or hide inactive undecided person';end if;
 insert into toyota_private.viewer_grants(class_id,email,show_names) values(c,'removal-test@example.invalid',false);
 perform set_config('toyota_test.removal_class',c::text,true);perform set_config('toyota_test.removal_occasion',a::text,true);
 perform public.set_class_participant_active(c,'Minta Anna',true,2);
 if public.occasion_context(a)->'roster'<>'["Minta Anna"]'::jsonb then raise exception 'Restore failed';end if;
 update public.classes set closed_at=now() where id=c;
 denied:=false;begin perform public.set_class_participant_active(c,'Minta Anna',false,3);exception when raise_exception then denied:=true;end;if not denied then raise exception 'Closed class roster changed';end if;
end$$;
create or replace function toyota_private.is_admin() returns boolean language sql stable security definer set search_path='' as $$select false$$;
set local role authenticated;
do $$declare payload jsonb;denied boolean:=false;begin
 payload:=public.viewer_workspace(current_setting('toyota_test.removal_class')::uuid,md5(current_setting('toyota_test.removal_occasion')),0);
 if (payload->'classes'->0->>'active_count')::integer<>1 then raise exception 'Viewer active count wrong';end if;
 if jsonb_array_length(payload->'entries')<>1 or payload::text like '%Minta Anna%' then raise exception 'History missing or real name leaked';end if;
 if payload->'exam_results'->'roster'<>'["Résztvevő 01"]'::jsonb then raise exception 'Viewer report aliases shifted';end if;
 begin perform public.set_class_participant_active(current_setting('toyota_test.removal_class')::uuid,'Minta Anna',false,3);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Viewer removed participant';end if;
end$$;
reset role;
set local role anon;
do $$declare denied boolean:=false;begin
 begin perform public.set_class_participant_active(gen_random_uuid(),'Minta Anna',false,0);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Anonymous removal allowed';end if;
end$$;
reset role;
rollback;
select 'PASS: remove, restore, preserve scores and decisions, reject stale submissions and edits, receipt retry, stable viewer aliases, access guards' as result;
