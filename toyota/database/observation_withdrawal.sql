-- Reversible exclusion from results. No existing observation is physically deleted.
alter table public.observations add column if not exists withdrawn_at timestamptz;
alter table public.observations add column if not exists withdrawn_by uuid;
alter table public.observations add column if not exists withdrawn_reason text check(withdrawn_reason is null or length(withdrawn_reason)<=1000);
create policy active_observations_select on public.observations as restrictive for select to authenticated using (withdrawn_at is null);

create function public.set_observation_withdrawn(target uuid,withdrawn boolean,expected_created_at timestamptz,expected_seller text,reason text default '')
returns boolean language plpgsql security definer set search_path='' as $$
declare original public.observations%rowtype;
begin
 if not toyota_private.is_admin() then raise exception using errcode='42501',message='Csak az adminisztrátor törölhet vagy állíthat vissza értékelést.';end if;
 if withdrawn is null or length(coalesce(reason,''))>1000 then raise exception 'Érvénytelen törlési adat.';end if;
 select * into original from public.observations where id=target for update;
 if not found then raise exception 'Az értékelés már nem található.';end if;
 if original.created_at is distinct from expected_created_at or original.seller is distinct from expected_seller then raise exception 'Az értékelés adatai közben változtak. Frissítsd a listát.';end if;
 update public.observations set
  withdrawn_at=case when withdrawn then coalesce(original.withdrawn_at,now()) else null end,
  withdrawn_by=case when withdrawn then coalesce(original.withdrawn_by,auth.uid()) else null end,
  withdrawn_reason=case when withdrawn then case when original.withdrawn_at is null then trim(coalesce(reason,'')) else original.withdrawn_reason end else null end
 where id=target;
 return true;
end$$;
create function public.list_withdrawn_observations(target uuid,row_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not toyota_private.is_admin() then raise exception using errcode='42501',message='Adminbelépés szükséges.';end if;
 if row_offset is null or row_offset<0 then raise exception 'Érvénytelen lapozás.';end if;
 return coalesce((select jsonb_agg(item order by withdrawn_at desc,id) from (
  select s.id,s.withdrawn_at,jsonb_build_object('id',s.id,'seller',s.seller,'scores',s.scores,'created_at',s.created_at,'withdrawn_at',s.withdrawn_at,'withdrawn_reason',s.withdrawn_reason,'observers',jsonb_build_object('name',o.name,'occasion_id',o.occasion_id)) as item
  from public.observations s join public.observers o on o.token=s.observer_token where o.occasion_id=target and s.withdrawn_at is not null order by s.withdrawn_at desc,s.id limit 500 offset row_offset
 ) q),'[]'::jsonb);
end$$;
revoke all on function public.set_observation_withdrawn(uuid,boolean,timestamptz,text,text),public.list_withdrawn_observations(uuid,integer) from public,anon;
grant execute on function public.set_observation_withdrawn(uuid,boolean,timestamptz,text,text),public.list_withdrawn_observations(uuid,integer) to authenticated;
