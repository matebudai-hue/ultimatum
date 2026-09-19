# Ultimátum dashboard

Online vezethető tréningjáték-platform az Ultimátumjáték, Diktátorjáték, Bizalomjáték és Közös kassza / közjavak játék digitális levezetéséhez.

A cél a papíralapú játékvezetés kiváltása: a résztvevők QR-kóddal lépnek be a saját telefonjukon, ott küldik be a döntéseiket, ott látják a saját vagyonukat és a játék végén ott kapnak rövid szakmai visszajelzést. A tréner külön dashboardon vezérli a játékot, látja az összes döntést, vagyont, befizetést és körállapotot.

## Aktuális fejlesztési verzió

A 2026.09.19-i továbbfejlesztett Kreditjáték futó deploymentje:

https://saddlebrown-mindless-driver--matebudai.replit.app

A GitHub marad a projekt forráshelye; a futó többfelhasználós alkalmazás külön hostingon fut, mert szerveroldali állapotot és adatbázist igényel.

A repository gyökerében lévő korábbi `index.html` egy régi, statikus közös-kassza prototípus, nem a jelenlegi teljes játék.

## A játék íve

1. **Ultimátumjáték** – méltányosság, vétó, igazságérzet.
2. **Diktátorjáték** – döntés hatalmi helyzetben, vétó nélkül.
3. **Bizalomjáték** – kockázat, viszonzás, bizalom alakulása.
4. **Közös kassza / közjavak** – közös érdek, egyéni racionalitás, rendszerfenntartás.

Az első három játék minden döntési fordulójában új játékkeret indul. A fordulókban megszerzett kredit hozzáadódik a résztvevő összesített vagyonához. A negyedik játékba mindenki az addig összegyűjtött saját tőkéjével lép be.

## Fő működés

- Résztvevői mobilfelület.
- Tréneri dashboard.
- Többfelhasználós, szerveroldali közös állapot.
- Automatikus párosítás ismétlésminimalizálással.
- Páratlan létszámnál rendszerjátékos.
- Közös kassza csoportokkal és minimumszabállyal.
- Tréneri riport és CSV-export.

## Dokumentáció

- [`docs/GAME_SPEC.md`](docs/GAME_SPEC.md) – korábbi játéklogika.
- [`docs/SCREEN_FLOW.md`](docs/SCREEN_FLOW.md) – korábbi képernyőfolyam.
- [`docs/STATE_MACHINE.md`](docs/STATE_MACHINE.md) – korábbi állapotmodell.
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) – korábbi adatmodell.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) – korábbi fejlesztési terv.
