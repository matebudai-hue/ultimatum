-- Reversible state changes on synthetic rows only. Identity stubs are transaction-local and rolled back.
begin;
create or replace function toyota_private.is_admin() returns boolean language sql stable security definer set search_path='' as $$select true$$;
create or replace function toyota_private.verified_viewer_email() returns text language sql stable security definer set search_path='' as $$select 'withdrawal-test@example.invalid'::text$$;
do $$declare c uuid;a uuid;r uuid:=gen_random_uuid();items jsonb;stamp timestamptz;begin
 insert into public.classes(name,kind,roster,contacts) values('WITHDRAWAL TEST','passenger',array['Minta Anna'],'{}') returning id into c;
 insert into public.occasions(class_id,name,mode) values(c,'Gyakorlás','practice') returning id into a;
 select v.items into items from toyota_private.criteria_versions v where kind='passenger' and version='toyota-2026-11-v1';
 stamp:=public.submit_occasion_versioned(a,'Minta Péter','toyota-2026-11-v1',items,r,'Minta Anna',array_fill(2::smallint,array[20]),'Teszt');
 insert into toyota_private.viewer_grants(class_id,email,show_names) values(c,'withdrawal-test@example.invalid',true);
 perform set_config('toyota_test.withdrawal_class',c::text,true);perform set_config('toyota_test.withdrawal_occasion',a::text,true);perform set_config('toyota_test.withdrawal_record',r::text,true);perform set_config('toyota_test.withdrawal_stamp',stamp::text,true);
 perform public.set_observation_withdrawn(r,true,stamp,'Minta Anna','Téves résztvevő');
end$$;
set local role authenticated;
do $$declare r uuid:=current_setting('toyota_test.withdrawal_record')::uuid;a uuid:=current_setting('toyota_test.withdrawal_occasion')::uuid;stamp timestamptz:=current_setting('toyota_test.withdrawal_stamp')::timestamptz;denied boolean:=false;begin
 if exists(select 1 from public.observations where id=r) then raise exception 'Withdrawn row leaked through owner SELECT';end if;
 if jsonb_array_length(public.list_withdrawn_observations(a,0))<>1 then raise exception 'Trash list missing row';end if;
 begin perform public.set_observation_withdrawn(r,false,stamp,'Másik Név','');exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Stale identity confirmation accepted';end if;
 perform public.set_observation_withdrawn(r,false,stamp,'Minta Anna','');
 if (select count(*) from public.observations where id=r)<>1 then raise exception 'Restored row missing';end if;
 if jsonb_array_length(public.list_withdrawn_observations(a,0))<>0 then raise exception 'Restored row remains in trash';end if;
 perform public.set_observation_withdrawn(r,true,stamp,'Minta Anna','Teszt');
end$$;
reset role;
do $$declare r uuid:=current_setting('toyota_test.withdrawal_record')::uuid;a uuid:=current_setting('toyota_test.withdrawal_occasion')::uuid;items jsonb;begin
 select v.items into items from toyota_private.criteria_versions v where kind='passenger' and version='toyota-2026-11-v1';
 perform public.submit_occasion_versioned(a,'Minta Péter','toyota-2026-11-v1',items,r,'Minta Anna',array_fill(2::smallint,array[20]),'Teszt');
 if not exists(select 1 from public.observations where id=r and withdrawn_at is not null) then raise exception 'Public retry resurrected withdrawn row';end if;
end$$;
create or replace function toyota_private.is_admin() returns boolean language sql stable security definer set search_path='' as $$select false$$;
set local role authenticated;
do $$declare data jsonb;denied boolean:=false;begin
 data:=public.viewer_workspace(current_setting('toyota_test.withdrawal_class')::uuid,md5(current_setting('toyota_test.withdrawal_occasion')),0);
 if jsonb_array_length(data->'entries')<>0 then raise exception 'Withdrawn score leaked to viewer aggregate';end if;
 begin perform public.list_withdrawn_observations(current_setting('toyota_test.withdrawal_occasion')::uuid,0);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Viewer read trash';end if;
 denied:=false;begin perform public.set_observation_withdrawn(current_setting('toyota_test.withdrawal_record')::uuid,false,current_setting('toyota_test.withdrawal_stamp')::timestamptz,'Minta Anna','');exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Viewer restored row';end if;
end$$;
reset role;
set local role anon;
do $$declare denied boolean:=false;begin
 begin perform public.list_withdrawn_observations(gen_random_uuid(),0);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Anonymous trash access';end if;
end$$;
reset role;
rollback;
select 'PASS: withdraw, restore, stale identity check, hidden from old admin reads and viewer results, no retry resurrection, access guards' as result;
