-- Scoped read-only access. Existing admin RLS and anonymous QR flows are unchanged.
create table toyota_private.viewer_grants (
 id uuid primary key default gen_random_uuid(),
 class_id uuid not null references public.classes(id) on delete cascade,
 email text not null check(email=lower(trim(email)) and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' and length(email)<=254),
 show_names boolean not null default false,
 expires_at timestamptz,
 revoked_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 created_by uuid,
 unique(class_id,email)
);
alter table toyota_private.viewer_grants enable row level security;
revoke all on toyota_private.viewer_grants from public,anon,authenticated;
create index viewer_grants_active_email on toyota_private.viewer_grants(email) where revoked_at is null;

create function toyota_private.verified_viewer_email()
returns text language sql stable security definer set search_path='' as $$
 select lower(u.email) from auth.users u join auth.sessions s on s.user_id=u.id
 where u.id=auth.uid() and s.id::text=auth.jwt()->>'session_id' and u.email_confirmed_at is not null
$$;
revoke all on function toyota_private.verified_viewer_email() from public,anon,authenticated;

create function public.toyota_app_role()
returns text language sql stable security definer set search_path='' as $$
 select case when toyota_private.is_admin() then 'admin'
 when exists(select 1 from toyota_private.viewer_grants g where g.email=toyota_private.verified_viewer_email() and g.revoked_at is null and (g.expires_at is null or g.expires_at>now())) then 'viewer' else null end
$$;
revoke all on function public.toyota_app_role() from public,anon;
grant execute on function public.toyota_app_role() to authenticated;

create function public.manage_viewer_access(target uuid,recipient text,names_visible boolean,lifetime_days integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;normalized text:=lower(trim(recipient));
begin
 if not toyota_private.is_admin() then raise exception using errcode='42501',message='Csak az adminisztrátor adhat betekintő hozzáférést.';end if;
 if normalized is null or normalized !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(normalized)>254 or names_visible is null or (lifetime_days is not null and lifetime_days not between 1 and 365) then raise exception 'Ellenőrizd az e-mail-címet és a lejáratot.';end if;
 if not exists(select 1 from public.classes where id=target) then raise exception 'Az osztály nem található.';end if;
 insert into toyota_private.viewer_grants(class_id,email,show_names,expires_at,created_by)
 values(target,normalized,names_visible,case when lifetime_days is null then null else now()+make_interval(days=>lifetime_days) end,auth.uid())
 on conflict(class_id,email) do update set show_names=excluded.show_names,expires_at=excluded.expires_at,revoked_at=null,updated_at=now(),created_by=excluded.created_by returning id into result;
 return result;
end$$;
create function public.revoke_viewer_access(target uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not toyota_private.is_admin() then raise exception using errcode='42501',message='Csak az adminisztrátor vonhat vissza hozzáférést.';end if;
 update toyota_private.viewer_grants set revoked_at=now(),updated_at=now() where id=target;
 return found;
end$$;
create function public.list_viewer_access(target uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not toyota_private.is_admin() then raise exception using errcode='42501',message='Adminbelépés szükséges.';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'email',g.email,'show_names',g.show_names,'expires_at',g.expires_at,'revoked_at',g.revoked_at,'created_at',g.created_at) order by g.created_at desc) from toyota_private.viewer_grants g where g.class_id=target),'[]'::jsonb);
end$$;
revoke all on function public.manage_viewer_access(uuid,text,boolean,integer),public.revoke_viewer_access(uuid),public.list_viewer_access(uuid) from public,anon;
grant execute on function public.manage_viewer_access(uuid,text,boolean,integer),public.revoke_viewer_access(uuid),public.list_viewer_access(uuid) to authenticated;

-- Dedicated allowlist of returned fields: no contact addresses, observer tokens or invitation IDs.
create function public.viewer_workspace(target_class uuid default null,target_occasion text default null,row_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare viewer_email text:=toyota_private.verified_viewer_email();
 allowed_classes jsonb;visible_occasions jsonb;visible_entries jsonb;selected_class uuid;selected_occasion uuid;names_allowed boolean;
begin
 if viewer_email is null then raise exception using errcode='42501',message='A betekintéshez saját, megerősített fiókkal kell belépni.';end if;
 if row_offset is null or row_offset<0 or row_offset>500000 then raise exception 'Érvénytelen lapozás.';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'kind',c.kind,'closed_at',c.closed_at,'created_at',c.created_at,'show_names',g.show_names,'access_expires_at',g.expires_at,'roster',
 case when g.show_names then to_jsonb(c.roster) else (select jsonb_agg('Résztvevő '||lpad(n.i::text,2,'0') order by n.i) from unnest(c.roster) with ordinality n(name,i)) end) order by c.created_at desc),'[]'::jsonb)
 into allowed_classes from public.classes c join toyota_private.viewer_grants g on g.class_id=c.id
 where g.email=viewer_email and g.revoked_at is null and (g.expires_at is null or g.expires_at>now());
 if target_class is not null and not exists(select 1 from jsonb_array_elements(allowed_classes) x where x->>'id'=target_class::text) then raise exception using errcode='42501',message='Ehhez az osztályhoz nincs érvényes betekintő hozzáférésed.';end if;
 selected_class:=coalesce(target_class,(allowed_classes->0->>'id')::uuid);
 if selected_class is null then return jsonb_build_object('classes','[]'::jsonb,'occasions','[]'::jsonb,'entries','[]'::jsonb,'class_id',null,'occasion_id',null);end if;
 select (x->>'show_names')::boolean into names_allowed from jsonb_array_elements(allowed_classes) x where x->>'id'=selected_class::text;
 -- Opaque display IDs are intentionally not the public UUIDs used in participant QR links.
 select coalesce(jsonb_agg(jsonb_build_object('id',md5(a.id::text),'class_id',a.class_id,'name',a.name,'mode',a.mode,'closed_at',a.closed_at,'created_at',a.created_at) order by a.created_at desc),'[]'::jsonb)
 into visible_occasions from public.occasions a where a.class_id=selected_class;
 select a.id into selected_occasion from public.occasions a where a.class_id=selected_class and (target_occasion is null or md5(a.id::text)=target_occasion) order by a.created_at desc,a.id limit 1;
 if target_occasion is not null and selected_occasion is null then raise exception using errcode='42501',message='Ez az alkalom nem tartozik az engedélyezett osztályhoz.';end if;
 select coalesce(jsonb_agg(row_data order by created_at,id),'[]'::jsonb) into visible_entries from (
  select s.id,s.created_at,jsonb_build_object('id',s.id,'seller',case when names_allowed then s.seller else coalesce('Résztvevő '||lpad(array_position(c.roster,s.seller)::text,2,'0'),'Korábbi résztvevő') end,
  'scores',s.scores,'notes',case when names_allowed then s.notes else '' end,'created_at',s.created_at,'criteria_version',s.criteria_version,'criteria_snapshot',s.criteria_snapshot,
  'observers',jsonb_build_object('occasion_id',md5(a.id::text),'name',case when names_allowed then o.name else 'Megfigyelő '||left(md5(o.token::text),8) end)) as row_data
  from public.observations s join public.observers o on o.token=s.observer_token join public.occasions a on a.id=o.occasion_id join public.classes c on c.id=a.class_id
  where a.id=selected_occasion order by s.created_at,s.id limit 500 offset row_offset
 ) q;
 return jsonb_build_object('classes',allowed_classes,'occasions',visible_occasions,'entries',visible_entries,'class_id',selected_class,'occasion_id',md5(selected_occasion::text));
end$$;
revoke all on function public.viewer_workspace(uuid,text,integer) from public,anon;
grant execute on function public.viewer_workspace(uuid,text,integer) to authenticated;
