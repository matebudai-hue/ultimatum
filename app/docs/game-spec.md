# Kreditjáték – kanonikus játékspecifikáció

Ez a dokumentum a Firebase bekötése előtti, jóváhagyott játékmenetet rögzíti. A kód és a tesztek ettől nem térhetnek el külön döntés nélkül.

## 1. Alapbeállítás

- Résztvevők: 2–100 fő.
- A tréner indulás előtt megadja a résztvevők számát és az induló kreditet.
- Induló kredit: 1 000–1 000 000, 100-as lépésekben.
- Az első három játék minden egyes körében minden döntéshozó ugyanazt a friss induló kreditkeretet kapja.
- A körök eredménye hozzáadódik az addig felhalmozott személyes vagyonhoz.
- 1a–3b alatt minden játékos mindkét szerepet megtapasztalja.
- Minden körben új pár készül. A rendszer a párismétlést minimalizálja; 7 főtől felfelé a hat stratégiai körben nincs ismételt ember–ember pár.
- Páratlan létszámnál rendszerjátékos használható. A rendszerjátékos az adott játék korábbi emberi döntéseinek átlagából dolgozik, adat hiányában alapértéket használ.
- A rendszerjátékos nem része a Közös kasszának és nincs emberi végső vagyona.

## 2. Ultimátum – 1a és 1b

### Felajánló

- X kreditet kap az adott körre.
- Eldönti, mennyit ajánl a másik játékosnak.
- Elfogadásnál: felajánló = X − ajánlat; fogadó = ajánlat.
- Elutasításnál: 0–0.
- Alku nincs.

### Fogadó

- Látja a konkrét ajánlatot.
- Elfogad vagy elutasít.
- Alku nincs.

### Idő

- Felajánló: 30 mp.
- Fogadó: 30 mp.
- A 30 mp akkor indul, amikor a feladat ténylegesen megjelent az adott résztvevő kliensén.
- A küldés/elfogadás/elutasítás gomb időben történő megnyomása megállítja az emberi döntési időt.
- Technikai továbbítási késés nem eredményezhet 0–0-t.
- 5 mp technikai türelmi idő után a rendszer technikai hibát / függő döntést jelez a trénernek.
- A tréner 30 mp-re újranyithatja a technikai hibás döntést.
- Valódi emberi időtúllépésnél 0–0.

## 3. Diktátor – 2a és 2b

- A döntéshozó X kreditet kap.
- Eldönti, mennyit ad a másik játékosnak.
- A fogadónak nincs döntési lehetősége: azt az összeget kapja, amit a döntéshozó ad.
- Döntéshozó eredménye: X − átadott összeg.
- Fogadó eredménye: átadott összeg.
- Alku nincs.
- Döntési idő: **30 másodperc**, a döntési feladat tényleges kliens-megjelenésétől.
- Ha a döntéshozó nem dönt időben, a rendszer **0 kredit átadást** rögzít.
- Az időben megnyomott küldés technikai továbbítása nem számít időtúllépésnek; technikai hiba külön állapotként jelenik meg.
- Az a/b körben a szerepek felcserélődnek és új pár jön.

## 4. Bizalom – 3a és 3b

- A küldő X kreditet kap.
- Eldönti, mennyit küld.
- A bank a küldött összeget háromszorozza.
- A fogadó a háromszorozott összegből eldönti, mennyit ad vissza.
- Akár 0 kreditet is visszaadhat.
- Küldő eredménye: X − küldött + visszakapott.
- Fogadó eredménye: 3 × küldött − visszaadott.
- A kliens élőben mutatja a háromszorozást és a döntés következményét.
- A küldő döntési ideje **30 másodperc**. Ha nem dönt időben, **0 kreditet küld**.
- A visszaadó döntési ideje az összeg tényleges kliens-megjelenésétől **30 másodperc**. Ha nem dönt időben, **0 kreditet ad vissza**.
- Az időben megnyomott döntés technikai továbbítása nem számít időtúllépésnek; technikai hiba külön állapotként jelenik meg.
- Az a/b körben a szerepek felcserélődnek és új pár jön.

## 5. Első szakasz lezárása

- A 3b könyvelése után az első szakasz végi személyes vagyon rögzül.
- Ez a Közös kassza induló személyes vagyona.
- A tréner ezután készíti el a csoportokat.
- Csoportképzés: véletlen vagy kézi.
- A rendszer minden csoportnak automatikusan egyedi, könnyen megkülönböztethető magyar helynevet ad (pl. Balaton, Badacsony, Hortobágy, Dunakanyar, Tokaj).
- A résztvevő a saját telefonján nagy méretben látja a csoportnevét, és azt az instrukciót kapja, hogy keresse meg azokat, akik ugyanazt a nevet kapták.
- A tréneri dashboardon a helynév a csoport fő azonosítója.
- A Közös kasszában legfeljebb **25 csoport** hozható létre.
- 100 résztvevő és 25 csoport esetén a rendszer 25 különböző helynevet oszt ki; **4 fő kerül minden csoportba**.
- A csoportok az első Közös kassza-kör elindítása után már nem módosíthatók.

## 6. Közös kassza

### Körök

- Nincs előre rögzített körszám.
- A tréner indít új kört, és a tréner zárja le a játékot.
- Minden kör 60 mp-es döntési ablakkal indul.
- A résztvevő a saját aktuális vagyonából adhat be 0 és a teljes vagyona közötti összeget.
- A 60 mp alatt a tét többször módosítható; az utolsó mentett tét számít.
- Tétzárás után a döntés nem módosítható.
- A banki elszámolás külön tréneri művelet.
- A személyes vagyon csak a banki elszámoláskor könyvelődik.

### Minimum

- Minden kör előtt, minden csoportnál külön állítható.
- Opciók: nincs minimum, 80%, 90%, 95%, egyedi összeg.
- A százalékos gyorsgomb a csoport kör eleji teljes vagyonából számolja ki a konkrét minimumot.
- Minden elszámolt kör után a következő kör minimuma alapból visszaáll „nincs minimum” állapotra.
- Minimumos körben a résztvevő látja a minimum pontos kreditösszegét.
- Nem látja a 80/90/95% tréneri segédértéket.
- Döntés közben nem látja a többiek téteit, az aktuális közös kasszát vagy a minimumtól való eltérést.

### Sikeres kör

- Teljes befizetés = K.
- Bank = 2 × K.
- A 2 × K összeget a csoport tagjai egyenlően kapják vissza.
- Személyes változás = − saját befizetés + fejenkénti visszaosztás.

### Sikertelen minimumos kör

- Ha a teljes kassza kisebb a minimumnál, nincs visszaosztás.
- Mindenki elveszíti a saját befizetését.
- A résztvevő csak azt látja, hogy a minimum nem lett meg, mennyit fizetett be, 0-t kapott vissza és mennyi az új vagyona.
- Nem látja, mennyi gyűlt össze ténylegesen és mennyivel maradt el a minimumtól.
- A tréner látja a minimumot, a tényleges kasszát és a hiányzó összeget.

## 7. Résztvevői kliens

- Mobilra optimalizált.
- A játék elején sikeresen belépett résztvevő azonosítója az adott telefon/böngésző Firebase anonim azonosítójához kötődik.
- Ha a résztvevő a játék közben megszakad, bezárja a böngészőt vagy más alkalmazás miatt leesik, ugyanazon a telefonon és böngészőprofilban a QR-kód újbóli megnyitásakor a rendszer automatikusan felismeri és visszakapcsolja a már elfogadott résztvevőként.
- A visszakapcsolódás nem számít új belépésnek, ezért a játék indulása után is engedélyezett a már korábban elfogadott résztvevőnek.
- Új résztvevő a játék elindítása után továbbra sem csatlakozhat.
- Visszatéréskor az aktuális játékállapot, kör, szerep, vagyon és feladat töltődik vissza; a korábban már elindult döntési időablak nem indul újra.
- Ha a telefon böngészőadatait/Firebase anonim azonosítóját törölték, vagy másik böngészőből/másik eszközről próbál visszatérni, a rendszer biztonsági okból nem tekinti automatikusan ugyanannak a résztvevőnek.
- Csak az aktuális feladat és a döntéshez szükséges információ látszik.
- Saját aktuális vagyon mindig látszik.
- Saját kreditnapló visszanézhető.
- Az első három játék kliensszövegeit a `docs/client-copy.md` rögzíti.
- Közös kasszánál a résztvevő látja a saját tétet és annak vagyonhatását.
- Körzárás után látja a saját eredményt.
- Játék végén: első három játék utáni vagyon, Közös kassza nettó eredménye, végső vagyon.

## 8. Tréneri dashboard

Egyetlen vezérlőfelület:
- aktuális kör és állapot;
- játék/kör indítása;
- stratégiai kör lezárása és könyvelése;
- Közös kassza tétzárás;
- külön Bank elszámol;
- játék lezárása;
- riport;
- játékkód, QR és belépési link;
- belépett/online résztvevők;
- játékosonként Ultimátum, Diktátor, Bizalom adatok;
- aktuális vagyon;
- teljes párosítási előzmény;
- Közös kassza csoportdobozok;
- csoport induló és aktuális vagyon;
- egyéni befizetések és visszaosztások;
- minimum, aktuális kassza és minimum alatti hiány;
- bármely stratégiai játék technikai döntéshibája külön állapot és 30 mp-es újranyitás;
- kézi korrekció: vagyon, 1a–3b meglévő döntés és Közös kassza-befizetés;
- minden kézi korrekció kötelező indoklással, előtte/utána értékkel és időbélyeggel naplózódik.

## 9. Riport

A CSV tartalmazza:
- játékinformációkat;
- Ultimátum elfogadott/elutasított ajánlatokat és időtúllépéseket;
- Diktátor átadásokat;
- Bizalom küldéseket, háromszorozást, visszaadásokat;
- első szakasz végi és végső vagyont;
- párosításokat;
- döntéseket;
- tranzakciókat;
- Közös kassza köröket;
- csoportminimumokat;
- egyéni Közös kassza-befizetéseket.

## 10. Kézi korrekció

- A tréner javíthatja egy résztvevő aktuális vagyonát.
- A tréner javíthat meglévő 1a–3b döntést.
- A tréner javíthat Közös kassza-befizetést, elszámolt körben is.
- Lezárt kör utólagos döntés- vagy tétkorrekciója a jelenlegi vagyonokra külön korrekciós tranzakcióval átvezetődik.
- Minden korrekcióhoz kötelező rövid indoklás.
- A korrekciók külön auditnaplóban és a CSV-riportban is megjelennek.

## 11. Backend


- Jelenleg a játékmotor és a UI lokális adapterrel működik.
- Firebase csak a játékmenet véglegesítése után következik.
- A Firebase bekötésekor a fenti játékszabályok nem változhatnak.
