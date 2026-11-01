'use strict';
const fleetItems=[{"title": "Felkészülés a cégből és a partnerből", "help": "A beszélgetés alapján mennyire látszik, hogy ismeri a céget és a tárgyalópartnerét? Figyeld, használ-e konkrét, releváns információkat, és kapcsolja-e ezeket az ügyfél helyzetéhez."}, {"title": "Tudatos beszélgetési felkészülés", "help": "A beszélgetés alapján mennyire látszik az átgondolt felkészülés? Figyeld, vannak-e célzott kérdései, tudja-e, mit szeretne megtudni, és használ-e a helyzethez illő kapcsolódási pontokat."}, {"title": "Kapcsolatteremtés", "help": "Köszöntsd és szólítsd meg az ügyfelet. Figyelmed, testbeszéded és a beszélgetés kezdése igazodjon hozzá. Reagálj arra, amit mond és ahogyan jelen van."}, {"title": "Cél, menet és időkeret", "help": "Egyeztesd, mi a találkozó célja, hogyan fogtok haladni és mennyi időtök van. Kérdezd meg, ő mit szeretne elérni a beszélgetés végére."}, {"title": "Bemutatkozás és pozicionálás", "help": "Röviden mutasd be magadat, a márkakereskedést és a Toyota releváns értékeit. Derüljön ki, miben tudtok segíteni ennek az üzleti ügyfélnek."}, {"title": "Céghelyzet, kihívások és tervek", "help": "Ismerd meg a cég működését, kihívásait és terveit. Kérdezz rá, ezek hogyan befolyásolják az autóhasználatot és a flottával kapcsolatos döntéseket."}, {"title": "A flotta szerepe és használata", "help": "Tisztázd, kik, mire és milyen körülmények között használják az autókat. Ismerd meg a releváns összetételt és futásteljesítményt."}, {"title": "Üzemeltetés és finanszírozás", "help": "Kérdezz rá a jelenlegi flottaüzemeltetőre és finanszírozási konstrukcióra. Tudd meg, milyen szempontok alapján tartanák meg vagy változtatnának rajta."}, {"title": "Elégedettség és problémák", "help": "Kérj konkrét példákat arra, mi működik jól, mi hiányzik vagy okoz nehézséget a flottánál és a szolgáltatásoknál. Tisztázd a következményeket is."}, {"title": "Kötelező és választható elvárások", "help": "Különítsd el a kizáró feltételeket (KO kritériumokat) a „jó, ha van” igényektől. Ellenőrizd, mely szempontok a legfontosabbak az ügyfélnek."}, {"title": "Döntési folyamat és időzítés", "help": "Tisztázd a partnered szerepét, a további érintetteket, a döntés menetét és időzítését. Derüljön ki, mikorra tervezik az autók beszerzését."}, {"title": "Smart Talk és személyes kapcsolódás", "help": "Természetes kapaszkodóból indulva ismerd meg a partnert emberként is. Építs a válaszaira, saját tapasztalataira és számára fontos szempontokra. Tartsd tiszteletben a határait."}, {"title": "Aktív figyelem és továbbkérdezés", "help": "Használj nyitott kérdéseket, pontosíts és kérdezz tovább a válaszok alapján. Hagyj időt a megszólalásra. Jelezd vissza, mit értettél meg."}, {"title": "Ügyfélre szabott autóbemutatás", "help": "A feltárt prioritások alapján válaszd ki, mit és milyen sorrendben mutatsz meg. Mondd ki, melyik részlet hogyan kapcsolódik az ügyfél elmondott igényéhez."}, {"title": "Tulajdonságból ügyfélelőny", "help": "Mutasd meg, egy felszereltség vagy műszaki megoldás hogyan segíti a cég működését, illetve az autó használójának mindennapjait. Használj konkrét haszonérveket."}, {"title": "Bevonás és kipróbálás", "help": "Az ügyfél maga is próbáljon ki számára fontos részleteket. Hagyj teret a felfedezésnek, figyeld a reakcióit, és azokhoz igazítsd a bemutatás folytatását."}, {"title": "Élmény és érzések megfogalmazása", "help": "Konkrét kipróbálás után kérdezz rá a személyes élményére: például „Milyen érzés volt?” Hagyj csendet, majd a válaszából kiindulva kérdezz tovább."}, {"title": "Kérdések és bizonytalanságok kezelése", "help": "Szükség esetén pontosítsd az ügyfél kérdését, adj hiteles, releváns választ, és ellenőrizd, segített-e. Amit nem tudsz, annak konkrét utánajárást vállalj."}, {"title": "Összefoglalás és visszaellenőrzés", "help": "Kapcsold össze a fő igényeket a bemutatott megoldással. Jelezd a nyitott kérdéseket, és ellenőrizd az ügyféllel, hogy jól értetted-e a helyzetét."}, {"title": "Megállapodás a következő lépésről", "help": "Közösen rögzítsétek, ki, mit és mikorra tesz. Legyen egyértelmű, hogyan és mikor folytatjátok az egyeztetést."}];
const fleetGroups=[{name:'Felkészülés',start:0,end:2},{name:'Indítás',start:2,end:5},{name:'Igényfeltárás',start:5,end:13},{name:'Bemutatás',start:13,end:18},{name:'Lezárás',start:18,end:20}];
const exams = {
 fleet: {name:'Flotta', items:fleetItems, groups:fleetGroups},
 passenger: {name:'Személyautó', items:[
 {
  "title": "A hívás indítása",
  "help": "Köszön, bemutatkozik, megnevezi a kereskedést és elmondja, melyik érdeklődés miatt telefonál."
 },
 {
  "title": "Az eredeti érdeklődés",
  "help": "Felhasználja, amit a leadből már tud. A konkrét kérdésre válaszol, vagy vállalja, hogy utánanéz, és megmondja, mikor jelez vissza."
 },
 {
  "title": "Kérdezés és figyelem",
  "help": "Célzott kérdéssel megtud valamit arról, mi fontos az ügyfélnek. A következő megszólalásában épít a válaszra."
 },
 {
  "title": "Meghívás a kereskedésbe",
  "help": "Az ügyfél szempontjához köti, mit érdemes személyesen megnézni vagy kipróbálni. Meghívja, és konkrét időpontot ajánl vagy kér."
 },
 {
  "title": "A hívás lezárása",
  "help": "Összefoglalja, miben maradtak, és elköszön. Ha nincs még időpont, egyezteti, hogyan folytatják."
 },
 {
  "title": "Résztvevők a döntésben",
  "help": "Tisztázza, ki használja majd az autót, és ki vesz részt a vásárlási döntésben."
 },
 {
  "title": "A keresés állása és időzítése",
  "help": "Kiderül, hol tart az ügyfél a választásban, és mikorra tervezi a vásárlást."
 },
 {
  "title": "Jelenlegi autó és használat",
  "help": "Konkrétumot tud meg a jelenlegi autóról, annak használatáról vagy a csere okáról."
 },
 {
  "title": "Személyes kapcsolódás",
  "help": "A munka, a család és a szabadidő közül legalább két területről megtud valamit. Követi az ügyfél által felhozott témát, tiszteletben tartja a határait."
 },
 {
  "title": "Elvárások az új autóval szemben",
  "help": "Megtudja, mi fontos az ügyfélnek, és legalább egy elvárásnál tisztázza, mit jelent az a hétköznapokban."
 },
 {
  "title": "Finanszírozási elképzelés",
  "help": "Tisztázza, hogyan tervezi az ügyfél finanszírozni a vásárlást, vagy milyen lehetőségeket mérlegel."
 },
 {
  "title": "Nyitott kérdések és továbbkérdezés",
  "help": "Legalább három nyitott kérdést tesz fel. Az autó mellett vagy benne ülve legalább egyszer az ügyfél válaszából indul tovább."
 },
 {
  "title": "Az ügyfélhez illő autó",
  "help": "Visszautal egy feltárt igényre, és megmutatja, miért ezt a modellt vagy változatot javasolja."
 },
 {
  "title": "Bevonás és saját élmény",
  "help": "Az ügyfél maga is kipróbál egy számára fontos részletet. Az értékesítő megkérdezi, mit tapasztalt, és hagyja válaszolni."
 },
 {
  "title": "Tulajdonságból ügyfélelőny",
  "help": "Legalább három konkrét haszonérvet mond. Mindegyiknél érthető, miben segíti az adott tulajdonság ezt az ügyfelet."
 },
 {
  "title": "A bemutató menete",
  "help": "Egyezteti az ügyféllel, mit és milyen sorrendben érdemes megnézniük. Helyet ad a telefonon felmerült kérésnek."
 },
 {
  "title": "Kapcsolódó szolgáltatások",
  "help": "Legalább négy kapcsolódó lehetőséget röviden bemutat a megfigyelési lap listájáról: finanszírozás, biztosítás, beszámítás vagy bizomány, hibrid alternatíva, hibrid szervizprogram, garancia, tartozék, szerelt kerék, MyT."
 },
 {
  "title": "Alkalmazkodás az ügyfélhez",
  "help": "Az ügyfél jelzésére alakít a tempón, a részletességen vagy a sorrenden. Például ha az ügyfél beülne, átengedi neki a vezetőülést."
 },
 {
  "title": "Ellenvetés kezelése",
  "help": "Legalább egy tisztázó kérdéssel feltárja az ügyfél fenntartását, majd arra ad érdemi választ vagy megoldást."
 },
 {
  "title": "Közös következő lépés",
  "help": "Az ügyfél számára fontos szempont alapján folytatást javasol. Megállapodnak abban, ki mit tesz és mikor."
 }
], groups:[
  {name:'Lead felhívása',start:0,end:5},
  {name:'Igényfeltárás',start:5,end:12},
  {name:'Autóbemutatás',start:12,end:19},
  {name:'Lezárás',start:19,end:20}
 ]}
};
function exam(){const base=exams[state.type];return state.criteriaSnapshot?{...base,items:state.criteriaSnapshot}:base;}
function lastStep(){return exam().groups.length-1;}
function breakdown(){
 if(state.type!=='passenger')return '';
 const phone=state.scores.slice(0,5).reduce((sum,n)=>sum+n,0);
 return 'Telefon: '+phone+'/10 · Autóbemutatás: '+(total()-phone)+'/30';
}
const CRITERIA_VERSION='toyota-2026-11-v1';
for(const [kind,definition] of Object.entries(exams))definition.items.forEach((item,index)=>{item.id=kind+'-'+String(index+1).padStart(2,'0');});
const LABELS=['Nem látható','Részben látható','Rendben van'];
