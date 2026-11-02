-- Synthetic fixtures only; every write is rolled back. No real sessions or JWTs.
begin;
do $$
declare c uuid; a uuid; submission uuid:=gen_random_uuid(); canonical jsonb; stamp timestamptz;blocked boolean;
begin
 insert into public.classes(name,kind,roster,contacts) values('Automatikus teszt · visszagörgetve','passenger',array['Minta Anna'],'{}') returning id into c;
 insert into public.occasions(class_id,name,mode) values(c,'Teszt','practice') returning id into a;
 select items into canonical from toyota_private.criteria_versions where kind='passenger' and version='toyota-2026-11-v1';
 if canonical is null then raise exception 'Missing canonical criteria';end if;
 stamp:=public.submit_occasion_versioned(a,'Minta Péter','toyota-2026-11-v1',canonical,submission,'Minta Anna',array_fill(2::smallint,array[20]),'Teszt');
 if stamp is null then raise exception 'Missing receipt';end if;
 update public.occasions set closed_at=now() where id=a;
 if not (public.occasion_context(a)->>'closed')::boolean then raise exception 'Context did not close';end if;
 if public.occasion_context(a)->'roster'<>'[]'::jsonb then raise exception 'Closed roster is exposed';end if;
 -- Lost receipt retry must return same timestamp even after closing.
 if public.submit_occasion_versioned(a,'Minta Péter','toyota-2026-11-v1',canonical,submission,'Minta Anna',array_fill(2::smallint,array[20]),'Teszt')<>stamp then raise exception 'Receipt changed';end if;
 blocked:=false;
 begin perform public.submit_occasion_versioned(a,'Minta Péter','toyota-2026-11-v1',canonical,gen_random_uuid(),'Minta Anna',array_fill(1::smallint,array[20]),'Teszt');exception when raise_exception then blocked:=sqlerrm like '%lezárult%';end;
 if not blocked then raise exception 'Closed occasion accepted new submission';end if;
 update public.occasions set closed_at=null where id=a;
 update public.classes set closed_at=now() where id=c;
 blocked:=false;
 begin perform public.submit_occasion_versioned(a,'Minta Péter','toyota-2026-11-v1',canonical,gen_random_uuid(),'Minta Anna',array_fill(1::smallint,array[20]),'Teszt');exception when raise_exception then blocked:=sqlerrm like '%lezárult%';end;
 if not blocked then raise exception 'Closed class accepted new submission';end if;
 blocked:=false;
 begin insert into public.occasions(class_id,name,mode) values(c,'Tiltott','exam');exception when raise_exception then blocked:=sqlerrm like '%lezárt osztályban%';end;
 if not blocked then raise exception 'Closed class accepted new occasion';end if;
 update public.classes set closed_at=null where id=c;
 blocked:=false;
 begin perform public.submit_occasion_versioned(a,'Minta Péter','toyota-2026-11-v1',jsonb_set(canonical,'{0,title}','"Hamis szempont"'),gen_random_uuid(),'Minta Anna',array_fill(1::smallint,array[20]),'Teszt');exception when raise_exception then blocked:=sqlerrm like '%szempontlista%';end;
 if not blocked then raise exception 'Forged canonical criteria accepted';end if;
 blocked:=false;
 begin perform public.submit_occasion_versioned(a,'Minta Péter','toyota-2026-11-v1',canonical,gen_random_uuid(),'Minta Anna',array_fill(3::smallint,array[20]),'Teszt');exception when check_violation then blocked:=true;end;
 if not blocked then raise exception 'Invalid marks accepted';end if;
 perform public.submit_occasion_versioned(a,'Minta Péter','toyota-2026-11-v1',canonical,gen_random_uuid(),'Minta Anna',array_fill(1::smallint,array[20]),'Teszt');
 if (select count(*) from public.observations s join public.observers o on o.token=s.observer_token where o.occasion_id=a)<>2 then raise exception 'Unexpected submission count';end if;
end$$;
set local role anon;
do $$declare blocked boolean:=false;begin
 begin perform public.set_observation_closed(gen_random_uuid(),'class',true);exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'Anonymous closure was not denied';end if;
end$$;
reset role;
rollback;
select 'PASS: closure, reopening, replay, canonical criteria, score constraints, anonymous authorization' as result;
