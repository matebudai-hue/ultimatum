# GAME_SPEC v0.1

## 1. Projektcél

A rendszer célja a papíralapú játékvezetés kiváltása egy QR-kóddal elérhető résztvevői mobilfelülettel és egy tréneri dashboarddal.

A résztvevő a saját telefonján lép be, döntéseket küld be, fogad vagy elutasít ajánlatot, visszaküld összeget, követi a saját vagyonát, majd a játék végén rövid szakmai visszajelzést kap.

A tréner dashboardon indítja, vezérli és zárja a köröket, látja az összes döntést, vagyont, befizetést és eredményt.

## 2. Játékok

A rendszer négy egymásra épülő játékot vezet:

1. Ultimátumjáték.
2. Diktátorjáték.
3. Bizalomjáték.
4. Közös kassza / közjavak.

Az első három játék minden döntési fordulójában új 1 000 000 Ft-os játékkeret indul. A játékos nem a korábbi vagyonából játszik. A forduló végén megszerzett összeg hozzáadódik az összesített vagyonához.

Képlet:

```text
új vagyon = korábbi vagyon + forduló eredménye
```

A harmadik játék végén kialakult vagyon lesz a közös kassza nyitótőkéje.

## 3. Szereplők

### Tréner

A tréner létrehozza a játékalkalmat, QR-kódot mutat, elindítja és lezárja a fordulókat, látja az összes döntést és vagyont, kontrollálja a közös kassza köreit, minimumkassza-üzenetet küld, majd a végén kiküldi a személyes visszajelzéseket.

### Résztvevő

A résztvevő QR-kóddal belép, megadja a nevét, látja az aktuális szerepét, beküldi a döntését, látja a saját eredményét, követi a saját vagyonát, majd a játék végén visszajelzést kap.

### Normatükör Bot

Páratlan létszám esetén a kimaradó játékos a géppel játszik. A résztvevő ezt nem látja. A bot belső szerepe: Normatükör Bot.

A bot a csoport aktuális emberi döntéseinek mediánját tükrözi. A bot döntései nem számítanak bele a későbbi mediánokba.

## 4. Session működés

A tréner új játékalkalmat indít. A rendszer létrehoz egy egyedi sessiont, például `ULTI-482`, és QR-kódot generál. A résztvevők belépnek, nevet adnak meg, majd váróképernyőre kerülnek.

A tréner dashboardon látja a belépett résztvevőket, az aktív/inaktív státuszt, a névtelen mód kapcsolóját és a résztvevői lista lezárásának lehetőségét.

## 5. Névtelen mód

Alapértelmezett működés: névtelen játék.

A résztvevő nem látja, kivel játszik. Résztvevői szövegek például:

- „Ajánlatot kaptál egy játékostárstól.”
- „A játékostársad döntésére várunk.”
- „A játékostársad elfogadta az ajánlatot.”
- „A játékostársad elutasította az ajánlatot.”

A tréner dashboardon minden párosítás név szerint látszik. Későbbi opcióként kapcsolható legyen a névvel játszott mód.

## 6. Párosítási logika

A rendszer minden fordulóban automatikusan párosít.

Alapszabály: ugyanaz a két résztvevő csak egyszer játszhat egymással.

A rendszer figyeli, ki kivel játszott már, ki milyen szerepben volt, kinek kell ajánlattevőnek / fogadónak / küldőnek / visszaküldőnek lennie, és van-e ismétlés nélküli párosítási lehetőség.

Ha nincs több ismétlés nélküli párosítás, a tréner figyelmeztetést kap: „Nincs több ismétlés nélküli párosítás. Kézi döntés szükséges.”

## 7. Páratlan létszám kezelése

Ha páratlan a létszám, egy játékos a Normatükör Bottal játszik. A résztvevő ezt nem látja.

A tréner látja, melyik résztvevő játszik géppel, a bot milyen szerepben van, és milyen szabály alapján döntött.

A botnak nincs saját vagyona. A bothoz kerülő vagy a bottól érkező összeg csak az emberi játékos eredményének elszámolására szolgál.

## 8. Ultimátumjáték

Az ajánlattevő kap 1 000 000 Ft játékkeretet, majd megadja, mennyit ajánl fel a fogadónak. A fogadó elfogadja vagy elutasítja az ajánlatot.

Elfogadás esetén:

```text
ajánlattevő eredménye = 1 000 000 - ajánlat
fogadó eredménye = ajánlat
```

Elutasítás esetén:

```text
ajánlattevő eredménye = 0
fogadó eredménye = 0
```

### Bot ajánlattevőként

A bot az aktuális emberi ajánlatok mediánját küldi. Fallback: ha még nincs emberi adat, 500 000 Ft. Ha van korábbi ultimátum-medián, az előző medián.

### Bot fogadóként

A bot elfogadási küszöbe:

```text
emberi ajánlatok mediánja × 0,8
```

Korlátok:

```text
minimum küszöb = 250 000 Ft
maximum küszöb = 450 000 Ft
```

Ha az ajánlat eléri a küszöböt, a bot elfogadja. Ha alatta marad, elutasítja.

## 9. Diktátorjáték

A döntő kap 1 000 000 Ft játékkeretet, majd megadja, mennyit ad a fogadónak. A fogadó nem dönt, csak látja az eredményt.

Elszámolás:

```text
döntő eredménye = 1 000 000 - adott összeg
fogadó eredménye = adott összeg
```

### Bot döntőként

A bot az aktuális emberi adások mediánját adja. Fallback: ha még nincs emberi adat, 400 000 Ft. Ha van korábbi diktátor-medián, az előző medián.

### Bot fogadóként

A bot csak megkapja az összeget. Nincs döntés. A botnak adott összeg naplózódik, de nem kerül be emberi vagyonba.

## 10. Bizalomjáték

A küldő kap 1 000 000 Ft játékkeretet. Megadja, mennyit küld a fogadónak. A rendszer a küldött összeget megháromszorozza. A fogadó megadja, mennyit ad vissza.

Elszámolás:

```text
küldő eredménye = 1 000 000 - küldött összeg + visszakapott összeg
fogadó eredménye = küldött összeg × 3 - visszaadott összeg
```

A visszaadott összeg nem lehet nagyobb, mint a háromszorozott összeg.

### Bot küldőként

A bot az aktuális emberi küldések mediánját küldi. Fallback: ha még nincs emberi adat, 500 000 Ft. Ha van korábbi bizalomküldés-medián, az előző medián.

### Bot fogadóként

A bot az emberi visszaadási arány mediánját használja.

```text
visszaadási arány = visszaadott összeg / háromszorozott kapott összeg
```

Fallback: ha még nincs emberi adat, 50%.

## 11. Közös kassza

A közös kasszába mindenki az első három játék után kialakult saját vagyonával lép be. Itt már nincs új 1 000 000 Ft-os játékkeret.

Mindenki beküld egy befizetést. A rendszer összeadja a befizetéseket. Ha nincs minimumkassza, a rendszer dupláz és egyenlően visszaoszt:

```text
összes befizetés × 2 = duplázott kassza
duplázott kassza / résztvevők száma = fejenkénti visszaosztás
```

### Minimumkassza

A tréner minden kör előtt megadhat minimumkasszát.

Ha az összes befizetés eléri vagy meghaladja a minimumot, a kassza sikeres, az összes befizetés duplázódik, majd egyenlő visszaosztás történik.

Ha az összes befizetés nem éri el a minimumot, a kassza sikertelen, nincs duplázás, nincs visszaosztás, a befizetett összegek elvesznek.

## 12. Közös kassza láthatóság

A résztvevő nem látja mások vagyonát, mások befizetését, kör előtt sem, kör után sem, név szerint sem, összesített rangsorként sem játék közben.

A résztvevő látja a saját aktuális vagyonát, saját befizetését, a tréneri minimumkassza-üzenetet, a kassza sikerességét vagy sikertelenségét, a saját visszaosztását és az új saját vagyonát.

A tréner látja mindenki aktuális vagyonát, minden befizetést, az összesített kasszát, a minimum teljesülését, a visszaosztást és a körönkénti nyereség/veszteség adatokat.

## 13. Záró visszajelzés

A visszajelzés csak a 4. játék végén jelenhet meg. Hossza 3–5 mondat. Hangneme szakmai, játékbeli működésre fókuszáló, nem minősítő és nem pszichologizáló.

Használható keretek:

- játékelmélet,
- kölcsönösség,
- egyéni és közös racionalitás,
- bizalom alakulása,
- Axelrod Tit for Tat elve,
- közjavak fenntartása.

A rendszer figyeli az ultimátum ajánlati arányt, az elfogadási/elutasítási viselkedést, a diktátorjátékban adott arányt, a bizalomjátékban küldött és visszaadott arányt, a közös kasszába fizetett arányt, a vagyon alakulását és a közös rendszerhez való hozzájárulást.

A visszajelzés nem címkézheti a játékost. Nem használható: „önző voltál”, „bizalmatlan vagy”, „jó csapatjátékos vagy”, „rossz döntéseket hoztál”.
