alter table public.classes add column inactive_roster text[] not null default array[]::text[];
-- Keep historical identity/order for reports and anonymous viewer aliases. Only active names are offered in QR forms.
create function public.set_class_participant_active(target uuid,participant text,active boolean,expected_roster_revision integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare c public.classes%rowtype;
begin
 if not toyota_private.is_admin() then raise exception using errcode='42501',message='Csak a tréner módosíthatja az osztály névsorát.';end if;
 select * into c from public.classes where id=target for update;
 if not found or participant is null or not participant=any(c.roster) or active is null then raise exception 'A résztvevő nem található az osztályban.';end if;
 if c.closed_at is not null then raise exception 'A névsor módosításához előbb nyisd újra az osztályt.';end if;
 if (not participant=any(c.inactive_roster))=active then return true;end if;
 if expected_roster_revision is null or expected_roster_revision<>c.roster_revision then raise exception 'A névsor közben megváltozott. Frissítsd az oldalt.';end if;
 update public.classes set inactive_roster=case when active then array_remove(inactive_roster,participant) else array_append(inactive_roster,participant) end,roster_revision=roster_revision+1 where id=target;
 return true;
end$$;
revoke all on function public.set_class_participant_active(uuid,text,boolean,integer) from public,anon;
grant execute on function public.set_class_participant_active(uuid,text,boolean,integer) to authenticated;
