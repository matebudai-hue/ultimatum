# Explorer – 9. évfolyam

Build nélküli, GitHub Pages-kompatibilis tanulási felület. A meglévő alkalmazásoktól függetlenül az `/explorer/` útvonalon működik.

20 feladat az első nap anyagának első 16 oldalából; rövid megoldásmagyarázatokkal. Az infografikákat nem adjuk ki a résztvevői oldalon. Három eredeti esettanulmány olvasható (Ebédszünet, Tűzjelzés, Új résztvevő), két-két szabad szöveges, helyben mentett válasszal. A jegyzetek az eredményexportba és tréneri importba is bekerülnek. A teljes teszt lezárásakor jár pont; addig a válaszok átírhatók, megoldást és pontot nem mutatunk. Javítani kizárólag új, üres válaszokkal kezdődő teljes körrel lehet. Feladatonként 10 pont, részpontok többválaszos kérdéseknél: helyes mínusz téves jelölések aránya, minimum nulla. Az első válasz, a legutóbbi válasz, a legjobb pont és a próbálkozások száma megmarad. Csak a korábbi legjobb eredmény feletti különbség növeli a közös egyenleget.

A terem tárgyai megvehetők, kattintással és billentyűzettel elhelyezhetők. A név, válaszok, pontok és terem localStorage-ban maradnak. Az eredmények JSON-ként menthetők, másik eszközön visszatölthetők, tréneri nézetbe csoportosan beolvashatók.

## Anyagok és új napok

A `content.json` tartalmazza a napokat. Meglévő nap/kérdés azonosítót ne használj fel új feladathoz: ezekhez kötődnek a korábbi válaszok. Új naphoz új `id`, új kérdésekhez a napon belül egyedi `id` szükséges. A `type` single, multi, match vagy classify; párosításnál és besorolásnál a `rows` adja az állításokat, a `correct` nullától indexelt válaszlista, a `max` 10. Az `open` kapcsolja a feladatsort. Ez megjelenítési kapcsoló, nem hozzáférés-védelem: a publikus repó fájljai olvashatók.

A tréneri műhelyben új nap és tananyaglink készíthető, majd a tartalomfájl letölthető. A közös közzétételhez az új fájlt a GitHubon az `explorer/content.json` helyére kell menteni. A tananyagok az `explorer/materials/` mappába tölthetők fel GitHub-belépéssel; a feltöltési gomb erre vezet.

## Jelenlegi korlát

Ez böngészőben mentő változat, az Omotenashihoz hasonlóan. Nincs központi adatbázis, résztvevői bejelentkezés vagy automatikus tréneri szinkron. Az eredményfájlok felhasználó által szerkeszthetők, ezért fejlesztő visszajelzésre alkalmas, hitelesített vizsgának nem tekinthető. A későbbi központi mentés nincs bekötve, meglévő Firebase-projektet nem használ.

## Ellenőrzés

`node --test explorer/tests/*.mjs` a repó gyökeréből. Helyi kiszolgálás: `python -m http.server 8000` a repó gyökeréből, majd `/explorer/`.

## Második kérdéssor (v2)

A felülvizsgált 20 kérdés 11 egyválaszos, 6 többválaszos és 3 párosító/besoroló feladatból áll. A párosítás soronként lenyíló választót, a besorolás két érinthető kategóriát használ. Minden feladat 10 pontos; a párosítás helyes sorainak arányából egész pontra kerekített részpont jár. A többválaszos feladat pontosan megadja a jelölések számát, és a téves jelöléseket levonja a helyesekből (minimum 0).

A korábbi kérdések a `questionArchives` alatt maradnak; az új kérdések azonosítói `v2-q…` alakúak. A régi és új első/aktuális válaszok nem keverednek, a korábbi eredmény a résztvevői és tréneri riportban külön lenyitható. A meglévő tárgyak és egyenleg megmaradnak. A régi verziókra korábban jóváírt jutalmakat az átállás megőrzi, és az új kérdéssor nem fizeti ki őket még egyszer. A későbbi napok önállóan adnak további pontokat.

## Személyre szabható tréningterem (roomVersion 2)

- 48 tárgytípus, mindegyik 3 szinttel (144 állapot), 24 előre megadott színnel, egyéni színkeverővel és a terem színét követő változattal. Az eredeti 8 típus azonosítói és alapárai megmaradnak.
- Külön katalógus: `room-catalog.mjs`. Tartalmazza az árakat, felárakat, kategóriákat, méreteket és elhelyezési rétegeket és szintneveket. Nincs termékenkénti darabszámkorlát; minden új példány és fizetős fejlesztés a közös egyenlegből vásárolható. A terem nem ad új pontokat: a képzési feladatok egyenlegét használja.
- Szabad színváltás, 4 keverhető kiinduló stílus, 5 falszín, 4 padló, 4 kilátás, saját teremnév és legfeljebb 100 karakteres felirat. A kilátás az ablakon/teraszajtón, a felirat a terem alatt és a megvett trénertáblán látszik.
- A rajzolt SVG tárgyak állandó, 24×18 egységes alaprajzon vannak; a terem és a tárgyak együtt skálázódnak. Az elhelyezés fél egységhez igazodik. Fal, padló, bútor és asztali tárgy külön réteg; a szőnyeg alatt lehet szék, két bútor azonban nem helyezhető egymásba. Az asztali eszközök asztalra, kocsira vagy kávépultra kerülnek, és követik annak mozgását.
- Kijelölés, mobilos elhelyezési előnézet és jóváhagyás; egérrel húzás, billentyűzetes mozgatás, forgatás, ingyenes raktár és visszahelyezés. Nagyobb, oldalon belüli rendezőnézet, 100–300% nagyítás, teljes nézet. A rendezőnézetben kétujjas nagyítás/eltolás is kezelhető; a normál teremnézet függőlegesen görgethető marad.
- Legfeljebb 25 elrendezési/szín/stílusváltozás visszavonható a nyitott munkamenetben. Vásárlás és fizetős fejlesztés után a visszavonási sor újraindul, mert az nem pénzvisszatérítés. Az undo-sor nincs az exportban.
- A boltnak kategóriái, keresője, külön fejlesztési és raktári nézete van. Nincs szabad hely? A megvett tárgy raktárba kerül. Ha a terem megtelik, a további tárgyak megvásárolhatók és a raktárban maradnak.
- `migrateRoom` átveszi a régi százalékos helyeket, megőrzi az azonosítókat, az egyenleget, a vásárlásokat, a kérdésválaszokat és esetjegyzeteket. Ahol egy régi tárgy nem fér el, szabad helyet keres; ha nincs megfelelő hely vagy asztal, megőrzi a raktárban. Újra lefuttatva nem von le pontot és nem mozgatja újra a termet.
- A `ledger` csak a vásárlásokat és fizetős fejlesztéseket naplózza. A régi költések egy nyitó összesítő bejegyzést kapnak. A mentés/visszatöltés tartalmazza a szinteket, színeket, forgatást, raktári állapotot, asztali kapcsolódásokat, terem-beállításokat és naplót.

Teszt: `node --test explorer/tests/*.mjs`. A terem tesztjei a régi adatok átvételét, a visszatöltést, a pontlevonásokat, az ismételt vásárlásokat, az ütközést, az asztali tárgyak mozgatását, a forgatást, raktárt és visszavonást is ellenőrzik.


## Teljes tesztkörök és gyakorlás (testing.version 1)

- Az aktív folyamatot az `attempts.mjs`, a felületet a `quiz-ui.mjs` kezeli. Az `engine.mjs` korábbi `answer` függvénye csak a régi formátum kompatibilitásához és a migráció tesztjeihez marad; a felület nem használja.
- `testing.tests[dayId/quizVersion]`: draft, lezárt körök, kérdésenként már jóváírt legjobb pont és a korábbi verziókból átvett jutalmak védelme. A kitöltés nem növeli az egyenleget. Lezárás csak minden kérdés érvényes válasza után lehetséges; ekkor az adott kérdések javulásának összege jár. Rosszabb összeredmény mellett is járhat jutalom egy korábban gyengébben megoldott kérdés javulásáért. Visszaesés nem vesz el pontot.
- A lezárt körök nem szerkeszthetők. Új kör minden kérdést újra felad, üres válaszokkal. A megoldás és magyarázat a lezárt kör áttekintésében látható. A félkész választások és a kész válaszok is megmaradnak újratöltéskor.
- A körök kérdés- és válaszpillanatképet, eredményt, elérhető maximumot, jóváírt különbözetet és időpontot őriznek. A statisztika külön mutatja az első, legutóbbi, legjobb teljes kört, a lezárt körök számát és a feladatonkénti eredményeket. Mindez exportálható és a tréneri importban is olvasható.
- A gyakorlás pontosan 10 különböző kérdést válogat az `open` napok aktív kérdéseiből; archív és lezárt napok kérdéseiből nem. Súlyozott véletlen mintavétel: előnyt kapnak a még jutalmazható, korábban gyengébben megoldott és ritkábban gyakorolt kérdések. A megkezdett kérdéssor rögzített és folytatható. 10-nél kisebb kérdésbankból nem indul gyakorlás.
- `testing.practice` külön keret: kérdésenként 7, körönként legfeljebb 70 pont. A normál tesztekben megszerzett pont ezt nem fogyasztja. Ugyanarra a kérdésre összesen 7 gyakorlópont járhat; újra csak a korábbi legjobb gyakorlóeredmény feletti különbség. A már kimaxolt kérdések ismétlésre előkerülhetnek, de új pont nélkül. A felület a kérdésbank és az aktuális kör még elérhető jutalmát is mutatja. A jelenlegi 20 kérdés összesen 200 normál és 140 gyakorlópontot adhat; új kérdések növelik a keretet.
- A migráció a korábbi egyenleget, költést, tárgyakat, esetjegyzeteket és első válaszokat változatlanul megőrzi. Teljes régi kitöltésnél a megőrzött első válaszokból képzett összesítés külön, korábbi rendszerből átvett adatként jelenik meg, ismert lezárási időpont nélkül; nem állítja, hogy ezek egy tényleges, egyben lezárt tesztkörből származnak. Részleges régi kitöltésből folytatható draft lesz. Az első új teljes lezárás ekkor már tényleges köreredmény.

## Eredményképernyő és kitöltés közbeni visszajelzés

A lezárt napteszt és a gyakorlóteszt közvetlenül a `quiz-results.mjs` által rajzolt eredménytérképre érkezik. Az eredmény és az újonnan jóváírt jutalom külön adat. Minden sorszám az adott lezárt kör pontja szerint zöld (teljes), sárga (részleges) vagy piros (nulla); jel és szöveges akadálymentes címke is tartozik hozzá. A térkép mindig nyitott, mobilon öt oszlopos. Egy kérdésre kattintva egyetlen olvasható kártya jelenik meg a saját válasszal, a helyes megoldással és a meglévő rövid magyarázattal; párosításnál/besorolásnál soronként jelöli az eltéréseket. Az új teljes kitöltés és a teremhez visszatérés a két továbblépés. A részletes körstatisztika továbbra is az Eredmények menüben van.

Kitöltés közben csak az elmentett válaszok száma és semleges jelölése látszik. Sem kérdésenkénti eredmény, sem még megszerezhető jutalom, sem helyességet jelző szín nem jelenik meg. A korábban megszerzett, elkölthető egyenleg a fejlécben marad; az aktuális kör nem növeli azt, még mind a 20 válasz mentése után sem. Pontot csak a teljes teszt kifejezett lezárása írhat jóvá. A lezárt eredmény frissítéskor és visszatéréskor is újra megnyitható.

## Egyszerű Eredmények fül

A résztvevői Eredmények fület a `results-dashboard.mjs` kezeli. A nyitóképernyőn a megszerzett, elköltött és elkölthető pontok, majd tesztenként az első/legutóbbi/legjobb lezárt eredmény és egy megnyitó gomb jelenik meg. A félkész kitöltéshez csak a mentett válaszok száma és folytatásgomb tartozik; a félkész kör nem eredmény.

A részletek ugyanazt a színes kérdéstérképet és megoldáskártyát használják, mint a tesztlezárás. A korábbi körök egyetlen választóval válthatók; minden esetben a kiválasztott kör saját pillanatképe, pontja és jutalma jelenik meg. A történeti nézet nem ír jóvá pontot és nem mutat újrakezdésgombot. A teljes kitöltési előzmény, eredeti válaszok, gyakorlás és első eredmények megmaradnak. Esetjegyzetek, a régi kérdéssorok válaszai és a mentés/visszatöltés külön zárt részbe kerülnek. A tréneri import részletes riportja változatlan.


## Bővített, szabadon gyűjthető berendezés

- Minden termék `max: null`; a vásárlási folyamat és a bolt nem állít mennyiségi plafont. Az import korábbi 500 tárgyas küszöbe megszűnt. A pontlevonás és az egyedi tárgyazonosítók megmaradnak, a többlet a raktárban biztonságosan megőrizhető.
- 12 új típus: dobálható plüssmackó/róka/polip, cserepes virág, asztali virágváza, szobafa, pálma, fali futónövény, falra szerelt whiteboard, falióra, nagy szőnyeg és dekorszobor. A mobil írótábla és a fali whiteboard külön termék.
- A meglévő puha szőnyeg 35 pont marad; a 4 × 4 m-es nagy változat 90 pont. A nagy szőnyeg 8 × 8 belső rácsegység, a névben szereplő méterhez 2 rácsegység tartozik. Nincs egész termet egyben lefedő szőnyeg. Mindkét szőnyegből több darab vehető, egymás mellé és egymást részben átfedve rakhatók. A padló rajzolási rétege a terem belső széléhez van vágva, így a szélek is lefedhetők anélkül, hogy a falra lógna a grafika. Vásárláskor először teljesen bent elférő szabad helyet keres; a kézi elhelyezés a szélek fedését is engedi. Bútorok a szőnyegek fölött vannak, egymást továbbra sem fedhetik.
- 24 előre megadott tárgyszín mellett natív színválasztóban tetszőleges `#rrggbb` szín állítható. A kiválasztott szín ténylegesen megjelenik az SVG-ben, megmarad mentés/visszatöltés után és ingyenesen visszavonható. A régi színazonosítók és tárgyak változatlanul megmaradnak.


## Bolt kategóriái

Nyolc funkció szerinti csoport: Ülőhelyek; Asztalok; Táblák és eszközök; Növények és virágok; Szőnyegek és textilek; Terem és kényelem; Dekoráció és saját tárgyak; Játékok és hangszerek. A növények saját csoportot kaptak, a két szőnyeg együtt jelenik meg, a labda és sakk a plüssök/hangszerek mellé került. A teljes kínálat is kategóriafejlécekkel, ebben a sorrendben jelenik meg; a kategóriaválasztó a találatok darabszámát mutatja. A besorolás a vásárlást, árat, birtoklást és elhelyezési réteget nem módosítja.

## Csoportos próba előtti ellenőrzés – 2026-10-23

49 automatikus teszt ellenőrzi a pontozást, a teljes körös javítást, az első eredmény megőrzését, a gyakorlás jutalomkeretét, a terem tranzakcióit és a mentési hibák kezelését. Böngészőben teljes 20 kérdéses kitöltés, lezárás, részleges/hibás/helyes eredmény és magyarázat, 320 px széles mobilnézet, újratöltés és két böngészőfül ütközése is ellenőrizve. Valódi iOS/Android érintőképernyős és több résztvevős terhelési próba nem történt.

Javítások: hibás helyi mentés nem cserélődik le csendben üres állapotra; betöltési hiba újrapróbálható; tárhelyhiba tartós figyelmeztetést és fájlmentést ad; elavult böngészőfül nem írhatja felül a frissebb mentést. Az import ellenőrzi a jegyzetek és a feladatok szerkezetét is. Az export fájlneve nevet és időpontot tartalmaz. A párosító új válaszai minden módszert egyszer engednek; a régi lezárt eredmények olvashatók maradnak. Az önállóan raktárba tett asztali tárgy nem kerül vissza az asztal visszahelyezésével. A név gépelés közben mentődik.

A próba keretei: egy eszköz és normál böngésző használata résztvevőnként; a végén Eredmények → Mentés és átvitel → Mentés letöltése. Nincs bejelentkezés, központi adatgyűjtés vagy automatikus e-mail. A rejtett tréneri műhelynek jelenleg nincs menüből elérhető belépési pontja. Az első nap 20 kérdésével legfeljebb 200 naptesztpont és további 140 gyakorlópont szerezhető; az ismétlés nem korlátlan pontforrás. A kliensoldali megoldások és a szerkeszthető helyi állapot miatt a rendszer fejlesztő visszajelzésre szolgál, nem hitelesített vizsgáztatásra.
