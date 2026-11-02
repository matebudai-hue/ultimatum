-- Synthetic exams only. All test data and identity helpers are rolled back.
begin;
create or replace function toyota_private.is_admin() returns boolean language sql stable security definer set search_path='' as $$select true$$;
create or replace function toyota_private.verified_viewer_email() returns text language sql stable security definer set search_path='' as $$select 'exam-test@example.invalid'::text$$;
do $$declare c uuid;a uuid;p uuid;other_class uuid;other_exam uuid;data jsonb;denied boolean;begin
 insert into public.classes(name,kind,roster) values('EXAM RESULT TEST','passenger',array['Minta Anna','Minta Béla','Minta Csilla']) returning id into c;
 insert into public.occasions(class_id,name,mode) values(c,'Vizsga','exam') returning id into a;
 insert into public.occasions(class_id,name,mode) values(c,'Gyakorlás','practice') returning id into p;
 insert into public.classes(name,kind,roster) values('OTHER EXAM TEST','fleet',array['Másik Név']) returning id into other_class;
 insert into public.occasions(class_id,name,mode) values(other_class,'Másik vizsga','exam') returning id into other_exam;
 perform set_config('toyota_test.exam_class',c::text,true);perform set_config('toyota_test.exam_occasion',a::text,true);perform set_config('toyota_test.other_exam',other_exam::text,true);
 insert into toyota_private.viewer_grants(class_id,email,show_names) values(c,'exam-test@example.invalid',false);
 data:=public.get_exam_results(a);
 if data->'decisions'<>'[]'::jsonb or jsonb_array_length(data->'roster')<>3 then raise exception 'Unexpected automatic results';end if;
 data:=public.set_exam_result(a,'Minta Anna','passed',0,0);
 if data->>'status'<>'passed' or (data->>'revision')::integer<>1 or data->>'updated_at' is null then raise exception 'Missing persisted result';end if;
 data:=public.set_exam_result(a,'Minta Anna','passed',0,0);
 if (data->>'revision')::integer<>1 then raise exception 'Identical retry changed revision';end if;
 denied:=false;begin perform public.set_exam_result(a,'Minta Anna','failed',0,0);exception when raise_exception then denied:=true;end;if not denied then raise exception 'Concurrent change overwritten';end if;
 data:=public.set_exam_result(a,'Minta Anna','pending',1,0);
 if data->>'status'<>'pending' then raise exception 'Cannot reset pending';end if;
 perform public.set_exam_result(a,'Minta Anna','passed',2,0);
 perform public.set_exam_result(a,'Minta Béla','failed',0,0);
 denied:=false;begin perform public.set_exam_result(p,'Minta Anna','passed',0,0);exception when raise_exception then denied:=true;end;if not denied then raise exception 'Practice accepted decision';end if;
 denied:=false;begin perform public.set_exam_result(a,'Másik Név','passed',0,0);exception when raise_exception then denied:=true;end;if not denied then raise exception 'Unknown participant accepted';end if;
 denied:=false;begin perform public.set_exam_result(a,'Minta Anna','anything',0,0);exception when raise_exception then denied:=true;end;if not denied then raise exception 'Unknown outcome accepted';end if;
 update public.classes set closed_at=now() where id=c;update public.occasions set closed_at=now() where id=a;
 perform public.set_exam_result(a,'Minta Csilla','passed',0,0);
 update public.classes set closed_at=null where id=c;
 -- Rename two people in opposite directions. Their decisions follow the people atomically.
 perform public.update_class_roster(c,'[{"original":"Minta Anna","name":"Minta Béla","email":""},{"original":"Minta Béla","name":"Minta Anna","email":""},{"original":"Minta Csilla","name":"Minta Csilla","email":""}]');
 data:=public.get_exam_results(a);
 if not exists(select 1 from jsonb_array_elements(data->'decisions') d where d->>'seller'='Minta Béla' and d->>'status'='passed' and (d->>'revision')::integer=3) then raise exception 'Rename lost passed decision';end if;
 if not exists(select 1 from jsonb_array_elements(data->'decisions') d where d->>'seller'='Minta Anna' and d->>'status'='failed') then raise exception 'Rename lost failed decision';end if;
 denied:=false;begin perform public.set_exam_result(a,'Minta Anna','passed',1,0);exception when raise_exception then denied:=true;end;if not denied then raise exception 'Stale roster identity accepted';end if;
end$$;
create or replace function toyota_private.is_admin() returns boolean language sql stable security definer set search_path='' as $$select false$$;
set local role authenticated;
do $$declare data jsonb;denied boolean:=false;begin
 data:=public.viewer_workspace(current_setting('toyota_test.exam_class')::uuid,md5(current_setting('toyota_test.exam_occasion')),0);
 if jsonb_array_length(data->'exam_results'->'decisions')<>3 then raise exception 'Viewer decision summary missing';end if;
 if data::text like '%Minta Anna%' or data::text like '%Minta Béla%' or data::text like '%updated_by%' then raise exception 'Private exam identity leaked';end if;
 if (data->'exam_results'->'decisions'->0->>'seller')<>'Résztvevő 01' then raise exception 'Viewer aliases mismatch';end if;
 begin perform public.set_exam_result(current_setting('toyota_test.exam_occasion')::uuid,'Minta Béla','failed',3,0);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Viewer changed outcome';end if;
 denied:=false;begin perform public.get_exam_results(current_setting('toyota_test.exam_occasion')::uuid);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Viewer read owner report';end if;
 denied:=false;begin perform public.viewer_workspace(current_setting('toyota_test.exam_class')::uuid,md5(current_setting('toyota_test.other_exam')),0);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Viewer crossed occasion boundary';end if;
end$$;
reset role;
update toyota_private.viewer_grants set show_names=true where class_id=current_setting('toyota_test.exam_class')::uuid and email='exam-test@example.invalid';
do $$declare data jsonb;begin
 data:=public.viewer_workspace(current_setting('toyota_test.exam_class')::uuid,md5(current_setting('toyota_test.exam_occasion')),0);
 if (data->'exam_results'->'decisions'->0->>'seller')<>'Minta Béla' then raise exception 'Shared names missing';end if;
end$$;
set local role anon;
do $$declare denied boolean:=false;begin
 begin perform public.get_exam_results(gen_random_uuid());exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Anonymous report access';end if;
 denied:=false;begin perform public.set_exam_result(gen_random_uuid(),'Minta Anna','passed',0,0);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Anonymous decision write';end if;
end$$;
reset role;
do $$begin if not exists(select 1 from pg_constraint where conrelid='toyota_private.exam_decisions'::regclass and contype='f' and confdeltype='c') then raise exception 'Missing cascade constraint';end if;end$$;
rollback;
select 'PASS: explicit outcomes, retry, stale edits, pending reset, exam scope, roster rename, closed exams, scoped viewers, anonymous denial, cascade' as result;
