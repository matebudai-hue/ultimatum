CREATE OR REPLACE FUNCTION public.update_class_roster(target uuid, changes jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare old_names text[];new_names text[];new_contacts jsonb;begin
if not toyota_private.is_admin() then raise exception 'Adminbelépés szükséges.';end if;
select roster into old_names from public.classes where id=target for update;
if old_names is null or jsonb_typeof(changes)<>'array' or jsonb_array_length(changes) not between 1 and 500 then raise exception 'Hibás névsor.';end if;
select array_agg(x.name),coalesce(jsonb_object_agg(x.name,x.email) filter(where coalesce(x.email,'')<>''),'{}'::jsonb) into new_names,new_contacts from jsonb_to_recordset(changes) as x(original text,name text,email text);
if exists(select 1 from unnest(new_names) n where n is null or length(trim(n)) not between 1 and 160) or cardinality(new_names)<>(select count(distinct n) from unnest(new_names) n) then raise exception 'Minden résztvevőnek egyedi név szükséges.';end if;
if exists(select 1 from unnest(old_names) n where (select count(*) from jsonb_to_recordset(changes) x(original text,name text,email text) where x.original=n)<>1) or exists(select 1 from jsonb_to_recordset(changes) x(original text,name text,email text) where x.original is not null and not x.original=any(old_names)) then raise exception 'A névsor közben változott. Frissítsd az oldalt.';end if;
update public.observations s set seller=x.name from jsonb_to_recordset(changes) x(original text,name text,email text),public.observers o,public.occasions a where s.observer_token=o.token and o.occasion_id=a.id and a.class_id=target and s.seller=x.original;
with moved as (
 delete from toyota_private.exam_decisions d using public.occasions a
 where d.occasion_id=a.id and a.class_id=target
 returning d.*
) insert into toyota_private.exam_decisions(occasion_id,seller,status,revision,updated_at,updated_by)
select d.occasion_id,x.name,d.status,d.revision,d.updated_at,d.updated_by from moved d
join jsonb_to_recordset(changes) x(original text,name text,email text) on x.original=d.seller;
update public.classes set roster=new_names,contacts=new_contacts,roster_revision=roster_revision+1 where id=target;return true;end$function$
;

CREATE OR REPLACE FUNCTION public.viewer_workspace(target_class uuid DEFAULT NULL::uuid, target_occasion text DEFAULT NULL::text, row_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare viewer_email text:=toyota_private.verified_viewer_email();
 allowed_classes jsonb;visible_occasions jsonb;visible_entries jsonb;visible_exam_results jsonb;selected_class uuid;selected_occasion uuid;names_allowed boolean;
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
  where a.id=selected_occasion and s.withdrawn_at is null order by s.created_at,s.id limit 500 offset row_offset
 ) q;
 select jsonb_build_object('roster',c->'roster','decisions',coalesce((
 select jsonb_agg(jsonb_build_object('seller',case when names_allowed then d.seller else 'Résztvevő '||lpad(array_position(original.roster,d.seller)::text,2,'0') end,'status',d.status,'updated_at',d.updated_at) order by array_position(original.roster,d.seller))
 from toyota_private.exam_decisions d join public.classes original on original.id=selected_class
 where d.occasion_id=selected_occasion and d.seller=any(original.roster)
 ),'[]'::jsonb)) into visible_exam_results from jsonb_array_elements(allowed_classes) c where c->>'id'=selected_class::text;
 return jsonb_build_object('classes',allowed_classes,'occasions',visible_occasions,'entries',visible_entries,'class_id',selected_class,'occasion_id',md5(selected_occasion::text),'exam_results',case when exists(select 1 from public.occasions where id=selected_occasion and mode='exam') then visible_exam_results else null end);
end$function$
;

