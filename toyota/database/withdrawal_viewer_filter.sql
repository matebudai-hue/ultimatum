CREATE OR REPLACE FUNCTION public.viewer_workspace(target_class uuid DEFAULT NULL::uuid, target_occasion text DEFAULT NULL::text, row_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  where a.id=selected_occasion and s.withdrawn_at is null order by s.created_at,s.id limit 500 offset row_offset
 ) q;
 return jsonb_build_object('classes',allowed_classes,'occasions',visible_occasions,'entries',visible_entries,'class_id',selected_class,'occasion_id',md5(selected_occasion::text));
end$function$

