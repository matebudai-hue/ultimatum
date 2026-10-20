# Toyota Omotenashi Manager – kétnapos tanulási napló

Mobilon használható, bejelentkezést nem kérő résztvevői webapp. A jegyzetek automatikusan, helyben mentődnek. A gyári megfigyelési kérdések az Omotenashi Manager képzési anyag 2026 v3 témáiból és a záróprogram Andon/vezetői feladataiból készültek.

## A buszos program négy feladata

1. Mit szeretnél hazavinni ebből a két napból? Szabad jegyzet, választható tanulási fókuszok és saját fókusz.
2. Toyota Way Challenge – beépített, saját tempóban játszható 30 kérdéses kvíz. Egyénileg, párban vagy kiscsoportban is kitölthető. 16 kiemelt fogalom, 1 pont/helyes válasz, nincs időbónusz. A helyes megoldásokat és a kérdésenkénti magyarázatokat csak a végleges lezárás után mutatja.
3. Páros beszélgetések párcserékkel. Három konkrét kérdéshez külön jegyzet, további forduló is felvehető. A párcserét a tréner vezeti, biztonságos megállásnál.
4. Felkészülés a gyárlátogatásra. A tíz megfigyelési szempontból a buszon egyetlen koppintással kiválasztható 2–3 saját fókusz. Itt nem kell jegyzetelni; a kiválasztott kérdések a következő „Mit láttunk?” oldalon automatikusan megjelennek. A saját szempontok hozzáadása és szerkesztése továbbra is elérhető.

## Beépített Toyota Way Challenge

A Toyota on the Road képernyőről a **Kvíz indítása vagy folytatása** hivatkozás a `kviz.html` belső nézetre visz. A résztvevői app linkje változatlan. A kitöltéshez nem kell Kahoot, belépés vagy regisztráció.

- A válaszok között a lezárásig szabad visszalépni; mind a 30 kérdésre válaszolni kell a pontozáshoz.
- Két kutatós kérdés közvetlen Google-keresési hivatkozással segíti az utánanézést.
- A lezárás egy megerősítő lépés; utána a válaszok zárolva vannak, megjelenik a 0–30 pontos eredmény és az összes kérdés indoklása.
- A játékos vagy csapat neve opcionális. Az eredmény másolható. A játék csak helyben mentődik, központi ranglista és központi eredménygyűjtés nincs.
- A kvíz mentési kulcsa `toyota-omotenashi-quiz-v1`, **elkülönül** a jegyzetek változatlan `toyota-omotenashi-notebook-v1` kulcsától. Az új játék kizárólag a kvíz válaszait törli.
- Az alkalmazás offline gyorsítótára az index és a kvíz oldalt is tartalmazza; az első betöltéshez hálózat kell. A Google-keresésekhez természetesen internet szükséges.

## Gyárban és a gyárlátogatás után

A **Gyári megfigyelések** oldalon a buszon csak a megfigyelési fókuszokat jelölik ki. A következő **Mit láttunk?** oldal automatikusan megmutatja ezek címét és kérdését, és külön forrásjelölőt (láttam / a kísérőtől hallottam / nem volt megfigyelhető), valamint egy jegyzetmezőt ad mindegyikhez. A forrás és a jegyzet az eredeti megfigyelési adatokba mentődik, ezért megmarad a riportban, exportban és biztonsági másolatban. A régi, de most nem kijelölt szempontokhoz tartozó feljegyzések az oldalon külön lenyitható blokkban megtalálhatók.

A feldolgozás lépései:

- Mit láttunk? A buszon kijelölt kérdésekhez rövid, konkrét jegyzetek rögzítése; az egykori összegző kérdések külön lenyitható blokkban továbbra is kitölthetők.
- Kaizen a kereskedésben. Négy egyszerű kérdés: miből indulok, hol van hasonló helyzet nálunk, mit próbálok ki, miből látom a javulást?
- Személyes vezetői terv. Az elfogadott hét kérdés, a teljes képzésből választott egyetlen alkalmazással.
- Páros transzfer. Négy segítő kérdés és az első lépés/időpont pontosítása, 4–4 perces munkához.

## Résztvevői használat

Indulás előtt internet mellett nyisd meg a linket. Várd meg az „Offline használatra kész” jelzést. Ugyanazon a telefonon, ugyanabban a böngészőben nyisd újra az oldalt: az előző jegyzeteid és saját szempontjaid visszatérnek. A progrészek között a felső választóval és az alsó Előző/Következő gombokkal léphetsz.

A Jegyzeteim részből a teljes szöveg letölthető, másolható, a böngésző nyomtatásával PDF-be menthető és a telefon saját megosztójával/e-mail kliensével továbbadható. A letöltött JSON biztonsági másolat a napló adatait és az elérhető kvízállást is megőrzi; másik eszközön visszatölthető. A kvízállás továbbra is külön tárolódik, de az új biztonsági másolat az összes adatot egyetlen fájlban tartalmazza. A hosszú szöveg nem csonkolódik e-mail-küldéskor: az app ilyenkor fájlcsatolást ajánl.

A privát böngészési mód és a böngészőadatok törlése nem alkalmas két napon át megőrzött jegyzetelésre. Ha a helyi mentés nem működik, az app külön jelzi. Az adatokat nem gyűjtjük központilag.

## A gyári kérdések szakmai alapja

Gemba/Genchi Genbutsu, Muda, vizuális menedzsment, sztenderdek, átadási pontok, Andon-jelzés és támogatás, okfeltárás, munkatársi bevonás, PDCA és Kaizen, vezetői szerep, tanítás és Yokoten. A kérdések nem állítják előre, hogy az adott gyári folyamat látható lesz, és nem pontozzák a gyárat. A gyári tényt, a hallott magyarázatot és a résztvevő saját következtetését elkülönítjük.

## Frissítés és adatmegőrzés

A résztvevői napló és a kvíz a szinkron, minden szerkesztésnél azonnal frissülő \`localStorage\` mentés mellett egy második, \`IndexedDB\`-ben tárolt példányt is készít (a \`data-safety.js\` segédmodullal). A helyi főmentés hiányakor, sérülésekor vagy a másodlagos mentés újabb verziójánál az alkalmazás vissza tudja tölteni a jó állapotot. Az új kód automatikus háttérszerverre **nem** küld adatot.

A két helyi tároló ugyanazon böngészőeredethez tartozik, ezért egy böngésző-adattörlés, privát mód vége vagy böngésző általi teljes adattár-eviction **mindkettőt egyszerre** eltávolíthatja. A „Jegyzeteim és mentés” résznél kérhető \`navigator.storage.persist()\` védelem (a böngésző dönt a jóváhagyásáról), illetve letölthető a **napló + kvíz** JSON-másolat. A fájlt a résztvevőnek a Fájlok alkalmazásban, felhőmeghajtón vagy más saját biztonságos helyen meg kell őriznie. Az alkalmazás nem garantálhatja az adatmegőrzést, ha maga a böngésző törli az összes helyi adatot.

A `toyota-omotenashi-notebook-v1` helyi mentési kulcs verziófrissítéskor változatlan marad. A meglévő megfigyelési listát és annak szerkesztéseit nem cseréljük vissza az alaplistára. Az offline gyorsítótár csak ehhez az almappához tartozik, és nem módosítja a többi játékot vagy a Toyota értékesítői megfigyelőappot.

Frissítéskor az `APP_VERSION` és a service worker `CACHE` verziója együtt emelendő. Adatszerkezeti változásnál külön, nem destruktív migráció és mentési teszt szükséges. A böngészőben a Jegyzeteim / Az app frissítése rész kezdeményezhet ellenőrzést.

## Tesztek

A `tests/smoke.mjs` Playwright-alapú ellenőrzés lefedi a két független helyi mentést, a lap bezárását és újranyitását, a teljes böngésző újraindítását, az offline újranyitást, egy appfrissítést, a saját szempontok megtartását, az export/importot és a mentési hibát. A kapcsolódó GitHub Actions workflow kizárólag az Omotenashi-app változásainál fut.

## UX-finomítás – 2026-10-19

- Páros beszélgetések: egy párcsere kártyáján a kérdés és a rövid jegyzet jelenik meg először; a partner és a törlés külön nyitható.
- Gyári megfigyelések: a kiválasztott fókuszok oldalnyitáskor felül jelennek meg; a navigációt az alsó léptető végzi.
- Személyes vezetői terv: a hét mező két sorral indul, és gépelés közben nő. A korábbi adatok változatlanok.
- Páros transzfer: a négy kérdés az oldal elejére került, a korábbi vezetői terv és a beszélgetőtárs külön nyitható.
- Jegyzeteim és mentés: két elsődleges művelet (jegyzetek megosztása, teljes JSON-mentés). A többi beállítás és visszatöltés lenyitható, megmaradt. A jegyzetelőnézet alapból csukva.
- Kvíz: a kérdésugrás összecsukható. A lezárás utáni képernyő elsőként a tévesztett kérdések magyarázatait mutatja, minden válasz külön megnyitható.
- Alsó navigáció: a következő programrész megnevezése látható, nincs külön ismételt tovább gomb a gyári megfigyelések között.

**Git-visszaállítási pont:** `backup/omotenashi-ux-elotti-20261019` (`26fc052159f7520594954d1814ca025cd067f81d`). Az app adatsémája és tárolási kulcsai változatlanok; a visszatérési pont a kódot rögzíti, nem a résztvevők egyéni böngészőadatait.

## Páros beszélgetések – 2026-10-20

- Egy beszélgetési lap mutatja mind a négy kérdést, és egy közös jegyzetmezőt biztosít. A partner neve opcionálisan rögzíthető.
- Egyetlen beszélgetési lap jelenik meg új naplónál; „+ Új beszélgetés másik párral” gombbal lehet másodikat, harmadikat stb. felvenni.
- Korábbi mentésekben a három, automatikusan létrejött, teljesen üres kérdéskártya egyetlen lapra egyszerűsödik. Bármely ténylegesen kitöltött korábbi beszélgetési jegyzet megmarad, az eredeti hozzá tartozó kérdés külön jelezve marad.
- A meglévő `pairs[].question / partner / note` adatmezők, a JSON és a TXT export, valamint a helyi automatikus mentés változatlan adatszerkezettel működik.
- Visszatérési pont: `backup/omotenashi-pares-beszelgetesek-elott-20261020` a `ec6e2b195ff2d29d04a3ec800bddbd36904bef92` commiton.

## Ichigo Ichie – olvasnivaló és öt teljes történet (2026-10-20)

- Külön statikus `ichigo-ichie.html` oldal a résztvevőknek: jelentés és történeti eredet, öt teljes történet feldolgozókérdésekkel, `dokuza kannen` történeti kiegészítés, Omotenashi–Ichigo Ichie összehasonlítás; eredeti szöveggel, hivatalos forráslinkekkel.
- A tanulási napló valamennyi programrészének tetején megjelenik az „Ichigo Ichie – elmélet és öt történet” hivatkozás. Az anyag külön is megnyitható, a „Vissza a tanulási naplóhoz” megőrzi az aktuális programrészt.
- A statikus olvasnivaló nem olvas és nem ír résztvevői adatot. A napló és a kvíz adattárolása, képernyői és sémái változatlanok.
- A service worker verziózott offline csomagjába az olvasnivaló külön cache-bejegyzésként került, külön útvonalkezeléssel: offline a történetek nyílnak meg, nem véletlenül a napló kezdőlapja.
- Regressziós teszt: mind az öt történet, a négy tartalmi fejezet, mobilos tördelés, visszalépés, jegyzetmegőrzés és offline újranyitás.
- Visszaállítási pont: `backup/omotenashi-ichigo-tananyag-elott-20261020`, eredeti kód: `92fb0be4a310349399325f9c239a72c61ee0dc75`.

## Ichigo Ichie – hét gondolatébresztő kérdés (2026-10-20)

- A meglévő Ichigo Ichie tananyaghoz a négy fejezet után, a források elé bekerült a „Gondolatébresztő kérdések” rész.
- Az eredetileg megadott alapgondolat és mind a hét kérdés teljes, módosítatlan szöveggel olvasható. A már meglévő öt történet és a négy fejezet tartalma érintetlen.
- A napló helyi jegyzeteinek, a 30 kérdéses kvíznek és a mentési rendszernek nincs új állapota vagy adatmódosítása. Az offline cache verziója frissült.
- Visszaállítás: `backup/omotenashi-ichigo-kerdesek-elott-20261020` az `69b92b3dd9579659eebc99fa29fae6854534888e` commiton.

## Ichigo Ichie – 3 kérdésre egyszerűsített zárás (2026-10-20)

- A korábbi hét, több helyen ismétlődő összegző kérdés helyén három, eltérő funkciójú kérdés található: a rutin felismerése; egy elmaradt kérdezés következményének felidézése; konkrét következő vezetői beszélgetés kijelölése.
- Az öt történet és a hozzájuk tartozó eredeti feldolgozó kérdések megmaradtak, a négy tananyagfejezet változatlan. A „Gondolatébresztő kérdések” hivatkozás ugyanarra a `#kerdesek` szakaszra mutat.
- A résztvevői mentés és a 30 kérdéses kvíz adatszerkezetét nem módosítottuk; csak az offline shell cache verziója frissült.
- Előző éles változat visszaállítási pontja: `backup/omotenashi-ichigo-7kerdes-elott-20261020` (`08d5f95377b4369554f3c3293b8605f13b6c3060`).

## Andon és sztenderdizálás – résztvevői olvasnivalók (2026-10-20)

- Két önálló, mobilra optimalizált, négyfejezetes tananyag készült az Ichigo Ichie-oldal tipográfiájával és szerkezetével: `andon.html` és `sztenderdizalas.html`.
- Mindkettő a képzés négy lépésére épül: „Megtanulod → Átadod → Megtanítod → Sztenderdizálsz”. A technikai Toyota fogalmakat és a kereskedési tréningpéldát következetesen elkülönítik; az Andonhoz vezetői jelzés/reakció, a sztenderdhez rögzítendő viselkedés, tanítás és Kaizen kapcsolódik.
- A programválasztó alatt egyetlen kompakt „Elméleti háttér” navigáció tartalmazza az Ichigo Ichie, Andon és Sztenderdizálás linkjeit, minden progrésznél elérhetően. Az Ichigo oldalon keresztlinkek vannak; az öt történet és az eredeti három összegző kérdés szövege változatlan.
- Az offline service worker külön cache-célponttal rendelkezik mindhárom olvasnivalóhoz; offline navigáció esetén nem véletlenül a napló nyílik meg. A fájlok teljes HTML-ként, külső JavaScript és font nélkül is olvashatók.
- Jegyzetek, 30 kérdéses kvíz, jelentések, JSON-mentések, importadat-szerkezet és minden felhasználói adat érintetlen; kizárólag a shell/appverzió és a statikus tartalom módosult.
- Teszt: mindkét új oldal négy szakmai része, kulcsmondatok és teljes mobilos oldalszélesség; offline újranyitás; megőrzött meglévő jegyzetek; előző modulok és kvíz teljes regressziója.
- Visszaállítás: `backup/omotenashi-andon-sztenderd-elott-20261020` a `1e640c9919e84b2d020af3263831fdcded89c75e` commiton.

## Workshop-kártyák mobilon (2026-10-20)

- A 40 fős nyomtatási csomag (`Toyota_Nyomtatasi_Csomag_40fo_v2.1.pdf`, Drive ID `104Yt8Pnf7s8U7xZLcihaVTHO6YVf1Fmz`) A1–A4 és M1–M6 esetei kerültek be változatlan megfogalmazásban, a PDF sortöréseit mobileszközre normalizálva.
- Az `andon.html` 3. fejezetében négy A-kártya nyitható külön mobilmodális ablakban, a helyzet és az eredeti vezetői döntési kérdés teljes szövegével.
- Az `ichigo-ichie.html` végén, a forrásjegyzék előtt hat M-kártya van, az eredeti munkaköri helyzetekkel. Kattintásra teljes kártya és két tanítási tervmező nyílik.
- Kártyánként két szöveges válaszmező tölthető ki; minden változtatás azonnal a böngésző `toyota-omotenashi-workshop-cases-v1` helyi kulcsába mentődik. A mezők újranyitáskor visszatöltődnek, válasz nincs központilag beküldve. A `Megoldás megosztása` gomb mobilos megosztást, ha nem támogatott, vágólapra másolást próbál.
- A független adatkör nem ír a meglévő tanulási naplóba és a Toyota Way Challenge kvízbe, és az eredeti dokumentumokat sem módosítja.
- A közös `workshop-cards.js` offline cache-elve van; a napló `2026.10.20.7` és a service-worker cache `20261020-7` frissült.
- E2E: tíz kártya megnyitása, szöveg/jelzés, lokális válaszmentés, újratöltés, offline megnyitás, más progrészek jegyzeteinek megőrzése.
- Visszaállítási pont: `backup/omotenashi-ws-kartyak-elott-20261020` (`32690dec59d25e652bac1500d24455c31614617c`).
