# GAME_SPEC v0.2

## 1. Alapjáték

A játék négy egymásra épülő szakaszból áll:

1. Ultimátumjáték.
2. Diktátorjáték.
3. Bizalomjáték.
4. Közös kassza / közjavak.

Az első három szakaszban a résztvevők tőkét gyűjtenek. Ezekben minden új játékhelyzet 1 000 000 Ft-os kerettel indul. A résztvevők nem a korábbi vagyonukat kockáztatják, hanem az adott szakaszban megszerzett összeget hozzáadják az addig gyűjtött vagyonukhoz.

A negyedik szakaszban, a közös kasszában, már ebből az addig összegyűjtött saját vagyonból játszanak.

## 2. Első szakasz: Ultimátumjáték

Két játékos játszik.

Az egyik játékos az ajánlattevő. Nála van 1 000 000 Ft. Eldönti, ebből mennyit ajánl fel a másik játékosnak.

A másik játékos a fogadó. Ő látja az ajánlatot, majd dönt:

- elfogadja,
- vagy elutasítja.

Ha elfogadja, a pénz az ajánlat szerint oszlik meg.

Példa:

```text
ajánlattevő megtart: 700 000 Ft
fogadó kap: 300 000 Ft
```

Ha elutasítja, mindketten 0 Ft-ot kapnak.

Ez a szakasz a méltányosságról, az igazságérzetről, az elfogadható és elfogadhatatlan ajánlatokról szól.

## 3. Második szakasz: Diktátorjáték

Két játékos játszik.

Az egyik játékosnál van 1 000 000 Ft. Eldönti, mennyit ad a másiknak.

A másik játékos véleménye nem számít. Nem fogadhat el, nem utasíthat el. Csak megkapja, amit a döntő játékos ad neki.

A döntő játékos akár 0 Ft-ot is adhat.

Példa:

```text
döntő játékos megtart: 1 000 000 Ft
másik játékos kap: 0 Ft
```

vagy:

```text
döntő játékos megtart: 600 000 Ft
másik játékos kap: 400 000 Ft
```

Ez a szakasz azt mutatja, hogyan dönt valaki akkor, amikor a másik félnek nincs vétójoga.

## 4. Harmadik szakasz: Bizalomjáték

Két játékos játszik.

Az első játékosnál van 1 000 000 Ft. Eldönti, mennyit küld a másik játékosnak.

A bank a küldött összeget megháromszorozza.

A második játékos a háromszorozott összeget kapja meg, majd eldönti, mennyit ad vissza az első játékosnak. Annyit ad vissza, amennyit akar, akár 0 Ft-ot is.

Példa:

```text
első játékos küld: 400 000 Ft
a bank megháromszorozza: 1 200 000 Ft
második játékos visszaad: 500 000 Ft
```

Ekkor:

```text
első játékos eredménye = 1 000 000 - 400 000 + 500 000 = 1 100 000 Ft
második játékos eredménye = 1 200 000 - 500 000 = 700 000 Ft
```

Ez a szakasz a bizalomról, a kockázatról és a viszonzásról szól.

## 5. Negyedik szakasz: Közös kassza / közjavak

Ebben a szakaszban már nem párokban játszanak, hanem csoportban.

Minden játékos az első három szakaszban összegyűjtött saját vagyonával lép be.

Mindenki eldönti, mennyit tesz be a közös kasszába a saját vagyonából.

A bank a közös kasszába tett teljes összeget megduplázza, majd egyenlően visszaosztja minden résztvevő között.

Képlet:

```text
összes befizetés × 2 = duplázott közös kassza
duplázott közös kassza / résztvevők száma = fejenkénti visszaosztás
```

Példa 5 résztvevővel:

```text
összes befizetés: 4 000 000 Ft
bank duplázása után: 8 000 000 Ft
fejenkénti visszaosztás: 1 600 000 Ft
```

A játékos saját eredménye ebben a körben:

```text
új vagyon = korábbi vagyon - saját befizetés + fejenkénti visszaosztás
```

## 6. Minimumkassza a közös kasszában

A közös kassza első egy-két köre még mehet minimum nélkül.

Később a bank minimumösszeget határoz meg.

Ha a csoport összes befizetése eléri vagy meghaladja ezt a minimumot, a bank dupláz, és a duplázott összeget egyenlően visszaosztja.

Ha a csoport összes befizetése nem éri el a minimumot, akkor a teljes befizetett összeg a banké. Ilyenkor nincs duplázás és nincs visszaosztás.

Példa:

```text
minimum: 5 000 000 Ft
összes befizetés: 4 800 000 Ft
eredmény: sikertelen kassza, a teljes 4 800 000 Ft a banké
```

## 7. A játék tanulási íve

A négy szakasz együtt mutatja meg, hogyan változik a döntéshelyzet:

- az első szakaszban van ajánlat és vétó,
- a másodikban van döntés, de nincs vétó,
- a harmadikban megjelenik a bizalom és a viszonzás,
- a negyedikben már a közös rendszer fenntartása a kérdés.

Az első három szakaszban az egyéni tőke gyűlik. A negyedikben ez a tőke kerül be egy közösségi döntési helyzetbe.

## 8. Tréneri fókusz

A játék nem egyszerű pénzosztós feladat. A fókusz a döntési mintákon van:

- mit tartanak korrekt ajánlatnak,
- mikor büntetik az igazságtalanságot,
- hogyan viselkednek, ha a másik félnek nincs beleszólása,
- mennyit kockáztatnak bizalmi helyzetben,
- mennyit viszonoznak, ha valaki bízott bennük,
- hogyan döntenek, amikor a saját érdek és a közös érdek szétválik,
- mi történik, ha a közös rendszer fennmaradásához minimumszint kell.
