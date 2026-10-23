# Explorer – 9. évfolyam

Build nélküli, GitHub Pages-kompatibilis tanulási felület. A meglévő alkalmazásoktól függetlenül az `/explorer/` útvonalon működik.

20 feladat az első nap infografikus anyagának első 16 oldalából; oldalszámos visszajelzések. Az első teljes kitöltés után javítható. Feladatonként 10 pont, részpontok többválaszos kérdéseknél: helyes mínusz téves jelölések aránya, minimum nulla. Az első válasz, a legutóbbi válasz, a legjobb pont és a próbálkozások száma megmarad. Csak a korábbi legjobb eredmény feletti különbség növeli a közös egyenleget.

A terem tárgyai megvehetők, kattintással és billentyűzettel elhelyezhetők. A név, válaszok, pontok és terem localStorage-ban maradnak. Az eredmények JSON-ként menthetők, másik eszközön visszatölthetők, tréneri nézetbe csoportosan beolvashatók.

## Anyagok és új napok

A `content.json` tartalmazza a napokat. Meglévő nap/kérdés azonosítót ne használj fel új feladathoz: ezekhez kötődnek a korábbi válaszok. Új naphoz új `id`, új kérdésekhez a napon belül egyedi `id` szükséges. A `type` single vagy multi, a `correct` nullától indexelt válaszlista, a `max` 10. Az `open` kapcsolja a feladatsort. Ez megjelenítési kapcsoló, nem hozzáférés-védelem: a publikus repó fájljai olvashatók.

A tréneri műhelyben új nap és tananyaglink készíthető, majd a tartalomfájl letölthető. A közös közzétételhez az új fájlt a GitHubon az `explorer/content.json` helyére kell menteni. A tananyagok az `explorer/materials/` mappába tölthetők fel GitHub-belépéssel; a feltöltési gomb erre vezet.

## Jelenlegi korlát

Ez böngészőben mentő változat, az Omotenashihoz hasonlóan. Nincs központi adatbázis, résztvevői bejelentkezés vagy automatikus tréneri szinkron. Az eredményfájlok felhasználó által szerkeszthetők, ezért fejlesztő visszajelzésre alkalmas, hitelesített vizsgának nem tekinthető. A későbbi központi mentés nincs bekötve, meglévő Firebase-projektet nem használ.

## Ellenőrzés

`node --test explorer/tests/*.mjs` a repó gyökeréből. Helyi kiszolgálás: `python -m http.server 8000` a repó gyökeréből, majd `/explorer/`.
