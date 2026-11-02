-- Additive upgrade. No existing class or observation is deleted or rewritten.
alter table public.classes add column if not exists closed_at timestamptz;
alter table public.occasions add column if not exists closed_at timestamptz;
create table if not exists toyota_private.criteria_versions (
 kind text not null check(kind in ('fleet','passenger')),
 version text not null,
 items jsonb not null check(jsonb_typeof(items)='array' and jsonb_array_length(items)=20),
 primary key(kind,version)
);
alter table toyota_private.criteria_versions enable row level security;
revoke all on toyota_private.criteria_versions from public,anon,authenticated;

create or replace function public.set_observation_closed(target uuid,target_type text,closed boolean)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not toyota_private.is_admin() then raise exception 'Adminbelépés szükséges.';end if;
 if closed is null then raise exception 'Hiányzó lezárási állapot.';end if;
 if target_type='class' then
  update public.classes set closed_at=case when closed then coalesce(closed_at,now()) else null end where id=target;
 elsif target_type='occasion' then
  perform 1 from public.classes c join public.occasions a on a.class_id=c.id where a.id=target and c.closed_at is null for share of c;
  if not found then raise exception 'Előbb az osztályt kell újranyitni.';end if;
  update public.occasions set closed_at=case when closed then coalesce(closed_at,now()) else null end where id=target;
 else raise exception 'Ismeretlen lezárási cél.';end if;
 if not found then raise exception 'A lezárandó elem nem található.';end if;
 return true;
end$$;
revoke all on function public.set_observation_closed(uuid,text,boolean) from public,anon;
grant execute on function public.set_observation_closed(uuid,text,boolean) to authenticated;

-- Serializes new submissions with closing. A committed submission may be retried after closing.
create or replace function public.submit_observation(link uuid,submission uuid,person text,marks smallint[],feedback text)
returns boolean language plpgsql security definer set search_path='' as $$
declare class_closed timestamptz;occasion_closed timestamptz;
begin
 select c.closed_at,a.closed_at into class_closed,occasion_closed from public.observers o join public.occasions a on a.id=o.occasion_id join public.classes c on c.id=a.class_id where o.token=link and person=any(c.roster) for share of c,a;
 if not found then raise exception 'Érvénytelen meghívó vagy név.';end if;
 if exists(select 1 from public.observations where id=submission) then
  if exists(select 1 from public.observations where id=submission and observer_token=link and seller=person and scores=marks and notes=feedback) then return true;end if;
  raise exception 'Eltérő beküldés.';
 end if;
 if class_closed is not null or occasion_closed is not null then raise exception 'Ez az alkalom lezárult. Új értékelés már nem küldhető be.';end if;
 insert into public.observations(id,observer_token,seller,scores,notes) values(submission,link,person,marks,feedback) on conflict(id) do nothing;
 if not exists(select 1 from public.observations where id=submission and observer_token=link and seller=person and scores=marks and notes=feedback) then raise exception 'Eltérő beküldés.';end if;
 return true;
end$$;

create or replace function public.occasion_context(link uuid)
returns jsonb language sql stable security definer set search_path='' as $$
select jsonb_build_object('occasion',a.name,'mode',a.mode,'className',c.name,'kind',c.kind,'roster',case when c.closed_at is null and a.closed_at is null then c.roster else array[]::text[] end,'closed',c.closed_at is not null or a.closed_at is not null) from public.occasions a join public.classes c on c.id=a.class_id where a.id=link
$$;
create or replace function public.observation_context(link uuid)
returns jsonb language sql stable security definer set search_path='' as $$
select public.occasion_context(o.occasion_id)||jsonb_build_object('observer',o.name) from public.observers o where o.token=link
$$;

create or replace function toyota_private.check_open_class()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.classes where id=new.class_id and closed_at is null for share;
 if not found then raise exception 'A lezárt osztályban nem indítható új alkalom.';end if;
 return new;
end$$;
revoke all on function toyota_private.check_open_class() from public,anon,authenticated;
drop trigger if exists check_open_class on public.occasions;
create trigger check_open_class before insert on public.occasions for each row execute function toyota_private.check_open_class();

create or replace function public.submit_occasion_versioned(link uuid,evaluator text,schema_version text,criteria jsonb,submission uuid,person text,marks smallint[],feedback text)
returns timestamptz language plpgsql security definer set search_path='' as $$
declare class_kind text;canonical jsonb;stamp timestamptz;
begin
 select c.kind into class_kind from public.occasions a join public.classes c on c.id=a.class_id where a.id=link;
 select items into canonical from toyota_private.criteria_versions where kind=class_kind and version=schema_version;
 if canonical is null or criteria is distinct from canonical then raise exception 'Ismeretlen vagy módosított szempontlista. Nyisd meg újra a megfigyelési linket; a kitöltésed megmarad.';end if;
 stamp:=public.submit_occasion_receipt(link,evaluator,submission,person,marks,feedback);
 update public.observations set criteria_version=schema_version,criteria_snapshot=canonical where id=submission and criteria_snapshot is null;
 if not exists(select 1 from public.observations where id=submission and criteria_version=schema_version and criteria_snapshot=canonical) then raise exception 'Eltérő szempontverzió.';end if;
 return stamp;
end$$;
-- Public QR endpoints are deliberately callable without registration; admin-only RPCs are not.
revoke all on function public.delete_observation_class(uuid,text),public.update_class_roster(uuid,jsonb) from public,anon;
grant execute on function public.delete_observation_class(uuid,text),public.update_class_roster(uuid,jsonb) to authenticated;

insert into toyota_private.criteria_versions(kind,version,items) values('fleet','toyota-2026-11-v1','[{"title":"Felkészülés a cégből és a partnerből","help":"A beszélgetés alapján mennyire látszik, hogy ismeri a céget és a tárgyalópartnerét? Figyeld, használ-e konkrét, releváns információkat, és kapcsolja-e ezeket az ügyfél helyzetéhez.","id":"fleet-01"},{"title":"Tudatos beszélgetési felkészülés","help":"A beszélgetés alapján mennyire látszik az átgondolt felkészülés? Figyeld, vannak-e célzott kérdései, tudja-e, mit szeretne megtudni, és használ-e a helyzethez illő kapcsolódási pontokat.","id":"fleet-02"},{"title":"Kapcsolatteremtés","help":"Köszöntsd és szólítsd meg az ügyfelet. Figyelmed, testbeszéded és a beszélgetés kezdése igazodjon hozzá. Reagálj arra, amit mond és ahogyan jelen van.","id":"fleet-03"},{"title":"Cél, menet és időkeret","help":"Egyeztesd, mi a találkozó célja, hogyan fogtok haladni és mennyi időtök van. Kérdezd meg, ő mit szeretne elérni a beszélgetés végére.","id":"fleet-04"},{"title":"Bemutatkozás és pozicionálás","help":"Röviden mutasd be magadat, a márkakereskedést és a Toyota releváns értékeit. Derüljön ki, miben tudtok segíteni ennek az üzleti ügyfélnek.","id":"fleet-05"},{"title":"Céghelyzet, kihívások és tervek","help":"Ismerd meg a cég működését, kihívásait és terveit. Kérdezz rá, ezek hogyan befolyásolják az autóhasználatot és a flottával kapcsolatos döntéseket.","id":"fleet-06"},{"title":"A flotta szerepe és használata","help":"Tisztázd, kik, mire és milyen körülmények között használják az autókat. Ismerd meg a releváns összetételt és futásteljesítményt.","id":"fleet-07"},{"title":"Üzemeltetés és finanszírozás","help":"Kérdezz rá a jelenlegi flottaüzemeltetőre és finanszírozási konstrukcióra. Tudd meg, milyen szempontok alapján tartanák meg vagy változtatnának rajta.","id":"fleet-08"},{"title":"Elégedettség és problémák","help":"Kérj konkrét példákat arra, mi működik jól, mi hiányzik vagy okoz nehézséget a flottánál és a szolgáltatásoknál. Tisztázd a következményeket is.","id":"fleet-09"},{"title":"Kötelező és választható elvárások","help":"Különítsd el a kizáró feltételeket (KO kritériumokat) a „jó, ha van” igényektől. Ellenőrizd, mely szempontok a legfontosabbak az ügyfélnek.","id":"fleet-10"},{"title":"Döntési folyamat és időzítés","help":"Tisztázd a partnered szerepét, a további érintetteket, a döntés menetét és időzítését. Derüljön ki, mikorra tervezik az autók beszerzését.","id":"fleet-11"},{"title":"Smart Talk és személyes kapcsolódás","help":"Természetes kapaszkodóból indulva ismerd meg a partnert emberként is. Építs a válaszaira, saját tapasztalataira és számára fontos szempontokra. Tartsd tiszteletben a határait.","id":"fleet-12"},{"title":"Aktív figyelem és továbbkérdezés","help":"Használj nyitott kérdéseket, pontosíts és kérdezz tovább a válaszok alapján. Hagyj időt a megszólalásra. Jelezd vissza, mit értettél meg.","id":"fleet-13"},{"title":"Ügyfélre szabott autóbemutatás","help":"A feltárt prioritások alapján válaszd ki, mit és milyen sorrendben mutatsz meg. Mondd ki, melyik részlet hogyan kapcsolódik az ügyfél elmondott igényéhez.","id":"fleet-14"},{"title":"Tulajdonságból ügyfélelőny","help":"Mutasd meg, egy felszereltség vagy műszaki megoldás hogyan segíti a cég működését, illetve az autó használójának mindennapjait. Használj konkrét haszonérveket.","id":"fleet-15"},{"title":"Bevonás és kipróbálás","help":"Az ügyfél maga is próbáljon ki számára fontos részleteket. Hagyj teret a felfedezésnek, figyeld a reakcióit, és azokhoz igazítsd a bemutatás folytatását.","id":"fleet-16"},{"title":"Élmény és érzések megfogalmazása","help":"Konkrét kipróbálás után kérdezz rá a személyes élményére: például „Milyen érzés volt?” Hagyj csendet, majd a válaszából kiindulva kérdezz tovább.","id":"fleet-17"},{"title":"Kérdések és bizonytalanságok kezelése","help":"Szükség esetén pontosítsd az ügyfél kérdését, adj hiteles, releváns választ, és ellenőrizd, segített-e. Amit nem tudsz, annak konkrét utánajárást vállalj.","id":"fleet-18"},{"title":"Összefoglalás és visszaellenőrzés","help":"Kapcsold össze a fő igényeket a bemutatott megoldással. Jelezd a nyitott kérdéseket, és ellenőrizd az ügyféllel, hogy jól értetted-e a helyzetét.","id":"fleet-19"},{"title":"Megállapodás a következő lépésről","help":"Közösen rögzítsétek, ki, mit és mikorra tesz. Legyen egyértelmű, hogyan és mikor folytatjátok az egyeztetést.","id":"fleet-20"}]'::jsonb) on conflict(kind,version) do nothing;

insert into toyota_private.criteria_versions(kind,version,items) values('passenger','toyota-2026-11-v1','[{"title":"A hívás indítása","help":"Köszön, bemutatkozik, megnevezi a kereskedést és elmondja, melyik érdeklődés miatt telefonál.","id":"passenger-01"},{"title":"Az eredeti érdeklődés","help":"Felhasználja, amit a leadből már tud. A konkrét kérdésre válaszol, vagy vállalja, hogy utánanéz, és megmondja, mikor jelez vissza.","id":"passenger-02"},{"title":"Kérdezés és figyelem","help":"Célzott kérdéssel megtud valamit arról, mi fontos az ügyfélnek. A következő megszólalásában épít a válaszra.","id":"passenger-03"},{"title":"Meghívás a kereskedésbe","help":"Az ügyfél szempontjához köti, mit érdemes személyesen megnézni vagy kipróbálni. Meghívja, és konkrét időpontot ajánl vagy kér.","id":"passenger-04"},{"title":"A hívás lezárása","help":"Összefoglalja, miben maradtak, és elköszön. Ha nincs még időpont, egyezteti, hogyan folytatják.","id":"passenger-05"},{"title":"Résztvevők a döntésben","help":"Tisztázza, ki használja majd az autót, és ki vesz részt a vásárlási döntésben.","id":"passenger-06"},{"title":"A keresés állása és időzítése","help":"Kiderül, hol tart az ügyfél a választásban, és mikorra tervezi a vásárlást.","id":"passenger-07"},{"title":"Jelenlegi autó és használat","help":"Konkrétumot tud meg a jelenlegi autóról, annak használatáról vagy a csere okáról.","id":"passenger-08"},{"title":"Személyes kapcsolódás","help":"A munka, a család és a szabadidő közül legalább két területről megtud valamit. Követi az ügyfél által felhozott témát, tiszteletben tartja a határait.","id":"passenger-09"},{"title":"Elvárások az új autóval szemben","help":"Megtudja, mi fontos az ügyfélnek, és legalább egy elvárásnál tisztázza, mit jelent az a hétköznapokban.","id":"passenger-10"},{"title":"Finanszírozási elképzelés","help":"Tisztázza, hogyan tervezi az ügyfél finanszírozni a vásárlást, vagy milyen lehetőségeket mérlegel.","id":"passenger-11"},{"title":"Nyitott kérdések és továbbkérdezés","help":"Legalább három nyitott kérdést tesz fel. Az autó mellett vagy benne ülve legalább egyszer az ügyfél válaszából indul tovább.","id":"passenger-12"},{"title":"Az ügyfélhez illő autó","help":"Visszautal egy feltárt igényre, és megmutatja, miért ezt a modellt vagy változatot javasolja.","id":"passenger-13"},{"title":"Bevonás és saját élmény","help":"Az ügyfél maga is kipróbál egy számára fontos részletet. Az értékesítő megkérdezi, mit tapasztalt, és hagyja válaszolni.","id":"passenger-14"},{"title":"Tulajdonságból ügyfélelőny","help":"Legalább három konkrét haszonérvet mond. Mindegyiknél érthető, miben segíti az adott tulajdonság ezt az ügyfelet.","id":"passenger-15"},{"title":"A bemutató menete","help":"Egyezteti az ügyféllel, mit és milyen sorrendben érdemes megnézniük. Helyet ad a telefonon felmerült kérésnek.","id":"passenger-16"},{"title":"Kapcsolódó szolgáltatások","help":"Legalább négy kapcsolódó lehetőséget röviden bemutat a megfigyelési lap listájáról: finanszírozás, biztosítás, beszámítás vagy bizomány, hibrid alternatíva, hibrid szervizprogram, garancia, tartozék, szerelt kerék, MyT.","id":"passenger-17"},{"title":"Alkalmazkodás az ügyfélhez","help":"Az ügyfél jelzésére alakít a tempón, a részletességen vagy a sorrenden. Például ha az ügyfél beülne, átengedi neki a vezetőülést.","id":"passenger-18"},{"title":"Ellenvetés kezelése","help":"Legalább egy tisztázó kérdéssel feltárja az ügyfél fenntartását, majd arra ad érdemi választ vagy megoldást.","id":"passenger-19"},{"title":"Közös következő lépés","help":"Az ügyfél számára fontos szempont alapján folytatást javasol. Megállapodnak abban, ki mit tesz és mikor.","id":"passenger-20"}]'::jsonb) on conflict(kind,version) do nothing;
