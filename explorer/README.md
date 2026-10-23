# Explorer – 9. évfolyam

Build nélküli, GitHub Pages-kompatibilis tanulási felület. A meglévő alkalmazásoktól függetlenül az `/explorer/` útvonalon működik.

20 feladat az első nap anyagának első 16 oldalából; oldalszámos visszajelzések. Az infografikákat nem adjuk ki a résztvevői oldalon. Három eredeti esettanulmány olvasható (Ebédszünet, Tűzjelzés, Új résztvevő), két-két szabad szöveges, helyben mentett válasszal. A jegyzetek az eredményexportba és tréneri importba is bekerülnek. Az első teljes kitöltés után javítható. Feladatonként 10 pont, részpontok többválaszos kérdéseknél: helyes mínusz téves jelölések aránya, minimum nulla. Az első válasz, a legutóbbi válasz, a legjobb pont és a próbálkozások száma megmarad. Csak a korábbi legjobb eredmény feletti különbség növeli a közös egyenleget.

A terem tárgyai megvehetők, kattintással és billentyűzettel elhelyezhetők. A név, válaszok, pontok és terem localStorage-ban maradnak. Az eredmények JSON-ként menthetők, másik eszközön visszatölthetők, tréneri nézetbe csoportosan beolvashatók.

## Anyagok és új napok

A `content.json` tartalmazza a napokat. Meglévő nap/kérdés azonosítót ne használj fel új feladathoz: ezekhez kötődnek a korábbi válaszok. Új naphoz új `id`, új kérdésekhez a napon belül egyedi `id` szükséges. A `type` single vagy multi, a `correct` nullától indexelt válaszlista, a `max` 10. Az `open` kapcsolja a feladatsort. Ez megjelenítési kapcsoló, nem hozzáférés-védelem: a publikus repó fájljai olvashatók.

A tréneri műhelyben új nap és tananyaglink készíthető, majd a tartalomfájl letölthető. A közös közzétételhez az új fájlt a GitHubon az `explorer/content.json` helyére kell menteni. A tananyagok az `explorer/materials/` mappába tölthetők fel GitHub-belépéssel; a feltöltési gomb erre vezet.

## Jelenlegi korlát

Ez böngészőben mentő változat, az Omotenashihoz hasonlóan. Nincs központi adatbázis, résztvevői bejelentkezés vagy automatikus tréneri szinkron. Az eredményfájlok felhasználó által szerkeszthetők, ezért fejlesztő visszajelzésre alkalmas, hitelesített vizsgának nem tekinthető. A későbbi központi mentés nincs bekötve, meglévő Firebase-projektet nem használ.

## Ellenőrzés

`node --test explorer/tests/*.mjs` a repó gyökeréből. Helyi kiszolgálás: `python -m http.server 8000` a repó gyökeréből, majd `/explorer/`.

## Második kérdéssor (v2)

A felülvizsgált 20 kérdés 11 egyválaszos, 6 többválaszos és 3 párosító/besoroló feladatból áll. A párosítás soronként lenyíló választót, a besorolás két érinthető kategóriát használ. Minden feladat 10 pontos; a párosítás helyes sorainak arányából egész pontra kerekített részpont jár. A többválaszos feladat pontosan megadja a jelölések számát, és a téves jelöléseket levonja a helyesekből (minimum 0).

A korábbi kérdések a `questionArchives` alatt maradnak; az új kérdések azonosítói `v2-q…` alakúak. A régi és új első/aktuális válaszok nem keverednek, a korábbi eredmény a résztvevői és tréneri riportban külön lenyitható. A meglévő tárgyak és egyenleg megmaradnak. Ugyanazon nap különböző kérdéssorai közös jutalomkeretet használnak: az adott nap verziónkénti legjobb pontösszegei közül a legmagasabb után jár jutalom. Így a v1-ben megszerzett 200 pont után a v2 nem ad újabb 200-at. A későbbi napok önállóan adnak további pontokat.

## Személyre szabható tréningterem (roomVersion 2)

- 36 tárgytípus, mindegyik 3 szinttel (108 állapot), 8 egyéni színnel és a terem színét követő változattal. Az eredeti 8 típus azonosítói és alapárai megmaradnak.
- Külön katalógus: `room-catalog.mjs`. Tartalmazza az árakat, felárakat, kategóriákat, méreteket, darabkorlátokat, elhelyezési rétegeket és szintneveket. Egy-egy teljesen fejlesztett tárgy minden típusból összesen 4380 pont; a darabkorlátokig bővítve 10630 pont költhető el. A terem nem ad új pontokat: a képzési feladatok egyenlegét használja.
- Szabad színváltás, 4 keverhető kiinduló stílus, 5 falszín, 4 padló, 4 kilátás, saját teremnév és legfeljebb 100 karakteres felirat. A kilátás az ablakon/teraszajtón, a felirat a terem alatt és a megvett trénertáblán látszik.
- A rajzolt SVG tárgyak állandó, 24×18 egységes alaprajzon vannak; a terem és a tárgyak együtt skálázódnak. Az elhelyezés fél egységhez igazodik. Fal, padló, bútor és asztali tárgy külön réteg; a szőnyeg alatt lehet szék, két bútor azonban nem helyezhető egymásba. Az asztali eszközök asztalra, kocsira vagy kávépultra kerülnek, és követik annak mozgását.
- Kijelölés, mobilos elhelyezési előnézet és jóváhagyás; egérrel húzás, billentyűzetes mozgatás, forgatás, ingyenes raktár és visszahelyezés. Nagyobb, oldalon belüli rendezőnézet, 100–300% nagyítás, teljes nézet. A rendezőnézetben kétujjas nagyítás/eltolás is kezelhető; a normál teremnézet függőlegesen görgethető marad.
- Legfeljebb 25 elrendezési/szín/stílusváltozás visszavonható a nyitott munkamenetben. Vásárlás és fizetős fejlesztés után a visszavonási sor újraindul, mert az nem pénzvisszatérítés. Az undo-sor nincs az exportban.
- A boltnak kategóriái, keresője, külön fejlesztési és raktári nézete van. Nincs szabad hely? A megvett tárgy raktárba kerül. A darabkorlát az összes birtokolt darabra vonatkozik.
- `migrateRoom` átveszi a régi százalékos helyeket, megőrzi az azonosítókat, az egyenleget, a vásárlásokat, a kérdésválaszokat és esetjegyzeteket. Ahol egy régi tárgy nem fér el, szabad helyet keres; ha nincs megfelelő hely vagy asztal, megőrzi a raktárban. Újra lefuttatva nem von le pontot és nem mozgatja újra a termet.
- A `ledger` csak a vásárlásokat és fizetős fejlesztéseket naplózza. A régi költések egy nyitó összesítő bejegyzést kapnak. A mentés/visszatöltés tartalmazza a szinteket, színeket, forgatást, raktári állapotot, asztali kapcsolódásokat, terem-beállításokat és naplót.

Teszt: `node --test explorer/tests/*.mjs`. A terem tesztjei a régi adatok átvételét, a visszatöltést, a pontlevonásokat, a darabkorlátokat, az ütközést, az asztali tárgyak mozgatását, a forgatást, raktárt és visszavonást is ellenőrzik.
