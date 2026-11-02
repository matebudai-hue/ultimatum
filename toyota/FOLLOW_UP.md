# Következő fejlesztés: Toyota betekintő hozzáférés

A tulajdonos külön, Toyota számára megosztható hozzáférést kért. Ez még nincs aktiválva; nincs létrehozott külső fiók vagy megosztott éles adat.

A tervezett szerep: **Betekintő**, csak olvasási joggal. Saját belépés; a tréner saját adminfiókja nem osztható meg. A tréner kijelöli a látható osztályokat, visszavonhatja a hozzáférést, és opcionális lejáratot állíthat be. A hozzáférést az adatbázis-jogosultságoknak kell érvényesíteniük, nem pusztán elrejtett gomboknak.

Látható: a kijelölt osztályok megfigyelési és vizsgaeredményei, erősségek, fejlesztési fókuszok, 0–1–2 megoszlás. A megfigyelés és vizsga szétválasztása megmarad. Személyes eredményekhez külön névmegjelenítési jogosultság ajánlott; e-mail-címek alapból rejtve.

Nem engedélyezett: névsor módosítása, új osztály/alkalom létrehozása, lezárás/újranyitás, törlés, jogosultságok továbbadása. A végső megosztás előtt a címzettet és az osztályok körét kell kijelölni.

## Elkészült ebben a kiadásban

- Egy alkalom lezárása és újranyitása.
- Teljes osztály lezárása és újranyitása; az eredmények megmaradnak.
- A lezárást a szerver minden jelenlegi beküldési útvonalon ellenőrzi; a már befogadott értékelés biztonságosan újrapróbálható.

## Későbbi, külön kezelendő feladatok

Saját origin/domain; jelszó-visszaállítás és egyszerűbb adminbelépő; részletes adatkezelési tájékoztató és megőrzési szabály; célzott értékeléstörlés; vizsga végső tréneri döntése; szempontverziók szerinti elkülönített összesítés a szempontok következő módosítása előtt. Ezek nincsenek ebben a javításcsomagban.
