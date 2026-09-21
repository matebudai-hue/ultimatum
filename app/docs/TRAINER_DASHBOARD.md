# Tréneri dashboard – kötelező működési specifikáció

A Kreditjáték tréneri felülete **pilótafülke**, nem résztvevői app kinagyítva. A tréner egy képernyőről látja és vezérli a teljes játékot.

## 1. Indulás előtti setup

A tréner megadja:

- játékosok száma: 2–100 fő;
- induló kredit: 1 000–1 000 000, 100-as lépésekben.

A dashboard mutatja:

- belépett / várt játékosok;
- online játékosok;
- játékkód;
- QR-kód és belépési link.

A játék csak akkor indul, amikor a beállított létszám bent van. Indulás előtt a létszám módosítható.

## 2. Felső vezérlősáv

Mindig látható:

- aktuális játék és kör;
- elsődleges tréneri akció: játék indítása / kör lezárása / következő kör indítása / kasszakör indítása / kasszakör lezárása / játék lezárása;
- aktuális készültség;
- belépett és online játékosok száma;
- induló kredit;
- játékkód;
- riport letöltése;
- QR / belépési link.

## 3. Játékos áttekintő tábla

50 főnél is használható, görgethető táblázat sticky fejléccel és sticky játékos-oszloppal.

Oszlopok:

1. **Játékos / státusz**
   - név;
   - online / offline;
   - aktuális döntési státusz.

2. **Ultimátum – 1a és 1b**
   - adott ajánlat;
   - ajánlat elfogadva / elutasítva;
   - kapott ajánlat;
   - saját döntése: elfogadta / elutasította.

3. **Diktátor – 2a és 2b**
   - mennyit adott;
   - mennyit kapott.

4. **Bizalom – 3a és 3b**
   - mennyit küldött;
   - mennyit kapott vissza;
   - mennyi érkezett hozzá a háromszorozás után;
   - mennyit adott vissza.

5. **Aktuális vagyon**

6. **Párosítási előzmény**
   - 1a, 1b, 2a, 2b, 3a, 3b partner neve.

## 4. Párosítási algoritmus

A hat stratégiai kör párosítását a játék indulásakor round-robin / 1-factorization alapú algoritmus készíti.

Cél:

- minden körben minden résztvevőnek legyen párja;
- páratlan létszámnál rendszerjátékos egészíti ki a mezőnyt;
- ugyanazon játék a/b körében mindenki szerepet vált;
- a partnerismétlés minimális legyen.

Matematikai tulajdonság:

- 7 vagy több valódi résztvevőnél a hat 1a–3b kör teljesen ismétlésmentesre készíthető;
- 5–6 főnél hat kör alatt legalább egy ismétlés elkerülhetetlen;
- 50 és 100 főnél az automatizált párosítási teszt 0 ismételt párt ad.

## 5. Közös kassza

A játékos tábla alatt külön szekció.

A tréner beállítja:

- csapatok száma;
- véletlen vagy kézi csoportosítás;
- kasszakörök száma: 1–20;
- minden kasszakör minimumszabálya:
  - nincs minimum;
  - a csoport aktuális vagyonának 80%-a;
  - a csoport aktuális vagyonának 90%-a;
  - egyedi összeg.

A 80/90%-os minimumot a rendszer az adott kasszakör indulásakor, az adott csoport **akkori aktuális vagyonából** számolja.

Minden csapat külön box.

Csapatboxban látszik:

- résztvevők;
- Közös kassza induláskori egyéni vagyon;
- aktuális egyéni vagyon;
- minden kasszakör egyéni befizetése;
- minden kasszakör egyéni visszaosztása;
- a csoport aktuális teljes vagyona;
- körönként a minimum, összes befizetés és siker / sikertelenség.

## 6. Riport

A riport futás közben is letölthető, a végén teljes.

Tartalmazza:

- játékosonkénti végső vagyon;
- teljes párosítási történet;
- Ultimátum ajánlatok és elfogadás/elutasítás;
- Diktátor átadások;
- Bizalom küldött / háromszorozott / visszaadott összegek;
- teljes kreditnapló;
- Közös kassza csoport- és köreredmények;
- egyéni kasszabefizetések és visszaosztások.

## 7. Kapacitás

- termékoldali hard cap: **100 résztvevő**;
- teljes játékmenet automatikusan tesztelve: **50 fő**;
- párosítás automatikusan tesztelve: **100 fő**;
- a végleges többtelefonos backend adatmodellje nem egyetlen nagy session dokumentumba ír minden adatot, hanem session meta + players + pairings + decisions + transactions + public-goods alkollekciókra bontva készül.
