# Toyota ellenőrzések

`node --test toyota/tests/review.test.cjs`

A Node beépített tesztfuttatójával, külső függőség nélkül. Valódi függvények és eseménykezelők izolált környezetben: névsor/e-mail megőrzése, két CSV-kódolás, beküldési állapot és vizuális prioritás, végleges elutasítás kontra bizonytalan hálózati eredmény, szerverhibák, lejárt belépés, kivetítő névadatvédelme. A DOM-helyettesítő nem helyettesíti a böngészős tördelésellenőrzést.

`closure.sql`: csak szintetikus adat, tranzakció és visszagörgetés. Lezárás/újranyitás, lezárás utáni ismételt nyugta, hamisított szempontlista, érvénytelen pontok és jogosulatlan lezárás ellenőrzése. Soha nem olvas valódi felhasználói munkamenetet, nem állít be felhasználói JWT-t.

Böngésző: `design-concept.html?screen=admin#preview=1`, `phone-review.html`, `phone-review.html?view=result`, `projection-check.html`. Mintaadatok, az API-módosítások blokkolva. Az admin előnézetből valódi külön kivetítőablak nyitható. A névvel megjelenített egy szempont nézet hat értékelést mutat oldalanként, a lapozást az admin vezérli. A Frissítés megőrzi a vezérlőpanelt és az aktuális névoldalt.

Adatbázis-frissítés: `database/review_hardening.sql`. Additív kiadás; meglévő adatsorokat nem töröl és nem ír át. A privát szemponttábla elutasít minden klienshozzáférést; csak az ellenőrzött beküldő függvény olvassa. A publikus QR-függvények szándékosan használhatók bejelentkezés nélkül. A lezárás és a többi adminművelet külön jogosultságellenőrzést követel.


## Betekintő hozzáférés

`viewer-access.sql`: kizárólag generált mintaosztályok és `.invalid` tesztcímek, visszagörgetett tranzakcióban. Az azonosítás segédfüggvényét a teszt tranzakcióján belül szintetikus tesztazonosságra cseréli; a rollback az eredeti függvényt is visszaállítja. Nem olvas valódi hitelesítési adatot, munkamenetet vagy tokent. Ellenőrzi a megosztott/nem megosztott osztályt, alkalomhatárt, lejáratot, visszavonást, nevek és visszajelzések kapcsolását, kapcsolattartási címek és nyilvános meghívóazonosítók kizárását, a közvetlen táblahozzáférés és az adminműveletek tiltását.

A `viewer_access.sql` adatbázis-frissítés nem módosítja a meglévő táblák RLS-szabályait. Az eredményeket külön, engedélyezett mezőket visszaadó RPC szolgálja ki. A résztvevői QR-azonosító helyett nem használható alkalomjelölést ad a betekintőnek. A jogosultságot minden lekéréskor aktuális szerveroldali állapotból ellenőrzi, nem módosítható felhasználói metadatából vagy korábban kiadott szerepkörből.

Új Node-próbák: a csak olvasható felület, hozzáférés visszavonása, nevek letiltása kimerevített kivetítésnél is, jogosultságváltás lapozás közben, admin/betekintő/nem engedélyezett belépési ágak. A név nélküli tesztadat megfigyelőket is jelöléssel ad vissza.

Böngészős mintaoldalak: `design-concept.html?screen=viewer#preview=1` (név nélkül), `?screen=viewer&names=1#preview=1` (névvel), `?screen=access#preview=1` (engedélyezés és visszavonás kizárólag memóriában, szerverhívás nélkül). A minták nem hoznak létre valódi külső hozzáférést.


## Jelszóhelyreállítás és visszaállítható törlés

A Node-próbák már a recovery callback helyes elágazását, a helyreállító token elkülönítését, a jelszóegyezést, az ismeretlen mentési eredményt, a megengedett hivatkozásokat és az adminnak kizárólagosan látható törlési gombokat is ellenőrzik. A tesztben szereplő jelszavak kizárólag szintetikus szövegek, nem fiókhoz tartozó hitelesítő adatok.

`withdrawal.sql`: visszagörgetett szintetikus adatbázisteszt. Csak a teszt tranzakciójában helyettesíti a jogosultságvizsgáló függvényeket; nincs valódi munkamenet- vagy tokenhasználat. Ellenőrzi az aktív SELECT szűrését régebbi admin kliensnél is, a törölt listát, a visszaállítást, a megváltozott sorazonosság visszautasítását, a publikus újrapróbálás változatlanul törölt állapotát és a betekintő/anon tiltásokat. A rollback a jogosultságvizsgáló függvényeket is visszaállítja.

A kiadás SQL-sorrendje: a korábbi `review_hardening.sql`, majd `viewer_access.sql` után `observation_withdrawal.sql`, végül `withdrawal_viewer_filter.sql`. A natív migrációtörténet ezeket sorrendben őrzi. A restrictive SELECT policy a megmaradó admin RLS mellett minden authenticated közvetlen lekérésből kiszűri a törölt sorokat; a külön töröltlista-RPC csak az adminnak ad hozzáférést. A betekintő security-definer olvasófüggvénye külön szűr, mert a tábla RLS-ét megkerüli.

Új böngészős minták: `design-concept.html?screen=login#preview=1`, `?screen=recover#preview=1`, `?screen=new-password#preview=1`. Az előnézet hitelesítési hívásai is helyben szimuláltak; nem küld levelet, nem módosít valódi jelszót. Az adminelőnézetben a törlés és a visszaállítás szintén csak memóriában történik.


## Szempontverziók és összehasonlítás

A Node-próbák ellenőrzik az átrendezett snapshot pontjainak azonosító szerinti illesztését, az eredeti adatok változatlanságát, a v1 legacy csoportot, az eltérő tartalmak és ismeretlen listák elkülönítését, az admin és kivetítés egyező kiválasztását, valamint a visszajelzések escape-elését és jogosultságfüggő megjelenítését.

Böngészős minta: `design-concept.html?screen=admin&versions=1#preview=1` két eltérő listával; `&unresolved=1` ismeretlen eredeti listával. Ezek a szintetikus értékelések kizárólag a helyi előnézeti adatsorban léteznek. A szerverbe nem írnak új szempontverziót vagy értékelést.


## Tréneri vizsgaeredmények

`exam-results.sql`: visszagörgetett tranzakció szintetikus osztályokkal és tesztazonosság-segédfüggvényekkel. Ellenőrzi az explicit eredményt, az ismételt mentést, a régi módosítási/névsorverzió visszautasítását, a döntésre váró állapotot, a vizsga–gyakorlás határt, a lezárt vizsgát, a névcseréket és a betekintői/anon jogosultságokat. A törlési kaszkádot sémaszinten ellenőrzi. Nem olvas vagy használ valódi felhasználói tokent, és nem állít be valódi vizsgaeredményt.

Node: személyenként egy riportrekord, döntésre várók szerepeltetése, a pontszámtól független végső döntés, Excel-kompatibilis CSV és képletvédelem, sikeres és elutasított mentés, friss szerveradatból készülő letöltés, csak olvasható betekintői felület.

Böngészős minta: `design-concept.html?screen=exam-results&exam=1#preview=1`. A döntések csak memóriában változnak. A CSV-gomb valódi fájlt tölt le a mintaadatokból. A `closed=class` paraméter a lezárt osztály utólagos eredményrögzítését mutatja. `screen=viewer&exam=1` a név nélküli betekintő, `names=1` névvel.
