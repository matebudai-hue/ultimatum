alter table public.classes add column roster_revision integer not null default 0 check(roster_revision>=0);

-- One explicit trainer decision per participant and exam occasion. No score-derived backfill.
create table toyota_private.exam_decisions (
 occasion_id uuid not null references public.occasions(id) on delete cascade,
 seller text not null check(length(seller) between 1 and 160),
 status text not null check(status in ('passed','failed','pending')),
 revision integer not null default 1 check(revision>0),
 updated_at timestamptz not null default now(),
 updated_by uuid,
 primary key(occasion_id,seller)
);
alter table toyota_private.exam_decisions enable row level security;
revoke all on toyota_private.exam_decisions from public,anon,authenticated;

create function public.get_exam_results(target uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a public.occasions%rowtype;c public.classes%rowtype;decisions jsonb;
begin
 if not toyota_private.is_admin() then raise exception using errcode='42501',message='Adminbelépés szükséges a vizsgaeredményekhez.';end if;
 select * into a from public.occasions where id=target;
 if not found or a.mode<>'exam' then raise exception 'Válassz vizsgaalkalmat.';end if;
 select * into c from public.classes where id=a.class_id;
 select coalesce(jsonb_agg(jsonb_build_object('seller',d.seller,'status',d.status,'revision',d.revision,'updated_at',d.updated_at) order by array_position(c.roster,d.seller)),'[]'::jsonb)
 into decisions from toyota_private.exam_decisions d where d.occasion_id=target and d.seller=any(c.roster);
 return jsonb_build_object('occasion_id',a.id,'class_name',c.name,'kind',c.kind,'roster_revision',c.roster_revision,'occasion_name',a.name,'roster',c.roster,'decisions',decisions);
end$$;
create function public.set_exam_result(target uuid,participant text,outcome text,expected_revision integer,expected_roster_revision integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare parent uuid;a public.occasions%rowtype;names text[];roster_version integer;original toyota_private.exam_decisions%rowtype;result toyota_private.exam_decisions%rowtype;
begin
 if not toyota_private.is_admin() then raise exception using errcode='42501',message='Csak a tréner rögzíthet vizsgaeredményt.';end if;
 if outcome is null or outcome not in ('passed','failed','pending') or expected_revision is null or expected_revision<0 then raise exception 'Érvénytelen vizsgaeredmény.';end if;
 select class_id into parent from public.occasions where id=target;
 select roster,roster_revision into names,roster_version from public.classes where id=parent for update;
 select * into a from public.occasions where id=target for update;
 if not found or a.mode<>'exam' then raise exception 'Vizsgaeredmény csak vizsgához rögzíthető.';end if;
 if expected_roster_revision is null or expected_roster_revision is distinct from roster_version then raise exception 'A névsor közben megváltozott. Frissítsd az oldalt a döntés előtt.';end if;
 if participant is null or not participant=any(names) then raise exception 'A résztvevő már nem szerepel a névsorban. Frissítsd az oldalt.';end if;
 select * into original from toyota_private.exam_decisions where occasion_id=target and seller=participant for update;
 -- Safe retry after an uncertain response; identical current decisions need no new write.
 if original.status=outcome then return jsonb_build_object('seller',original.seller,'status',original.status,'revision',original.revision,'updated_at',original.updated_at);end if;
 if coalesce(original.revision,0)<>expected_revision then raise exception using errcode='P0001',message='A vizsgaeredményt közben módosították. Zárd be az ablakot, frissítsd a listát, majd ellenőrizd az aktuális döntést.';end if;
 insert into toyota_private.exam_decisions(occasion_id,seller,status,revision,updated_at,updated_by)
 values(target,participant,outcome,coalesce(original.revision,0)+1,clock_timestamp(),auth.uid())
 on conflict(occasion_id,seller) do update set status=excluded.status,revision=excluded.revision,updated_at=excluded.updated_at,updated_by=excluded.updated_by returning * into result;
 return jsonb_build_object('seller',result.seller,'status',result.status,'revision',result.revision,'updated_at',result.updated_at);
end$$;
revoke all on function public.get_exam_results(uuid),public.set_exam_result(uuid,text,text,integer,integer) from public,anon;
grant execute on function public.get_exam_results(uuid),public.set_exam_result(uuid,text,text,integer,integer) to authenticated;
