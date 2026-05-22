# Ultimátum dashboard

Online vezethető tréningjáték-platform az Ultimátumjáték, Diktátorjáték, Bizalomjáték és Közös kassza / közjavak játék digitális levezetéséhez.

A cél a papíralapú játékvezetés kiváltása: a résztvevők QR-kóddal lépnek be a saját telefonjukon, ott küldik be a döntéseiket, ott látják a saját vagyonukat és a játék végén ott kapnak rövid szakmai visszajelzést. A tréner külön dashboardon vezérli a játékot, látja az összes döntést, vagyont, befizetést és körállapotot.

## A játék íve

1. **Ultimátumjáték** – méltányosság, vétó, igazságérzet.
2. **Diktátorjáték** – döntés hatalmi helyzetben, vétó nélkül.
3. **Bizalomjáték** – kockázat, viszonzás, bizalom alakulása.
4. **Közös kassza / közjavak** – közös érdek, egyéni racionalitás, rendszerfenntartás.

Az első három játék minden döntési fordulójában új 1 000 000 Ft-os játékkeret indul. A fordulókban megszerzett pénz hozzáadódik a résztvevő összesített vagyonához. A negyedik játékba mindenki az addig összegyűjtött saját tőkéjével lép be.

## Fő működés

- QR-kódos belépés.
- Résztvevői mobilfelület.
- Tréneri dashboard.
- Firebase-alapú élő adatkezelés.
- Automatikus párosítás ismétlés nélkül.
- Opcionális névtelen mód.
- Páratlan létszámnál rejtett Normatükör Bot.
- Közös kasszánál tréneri minimumkassza-üzenet.
- Tréner által zárt befizetés és külön kiküldött visszaosztás.
- Játék végi rövid, játékelméleti alapú személyes visszajelzés.

## Dokumentáció

- [`docs/GAME_SPEC.md`](docs/GAME_SPEC.md) – teljes játéklogika.
- [`docs/SCREEN_FLOW.md`](docs/SCREEN_FLOW.md) – résztvevői és tréneri képernyőfolyam.
- [`docs/STATE_MACHINE.md`](docs/STATE_MACHINE.md) – session-, forduló- és közös kassza állapotok.
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) – Firestore adatmodell első váz.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) – fejlesztési sorrend.
