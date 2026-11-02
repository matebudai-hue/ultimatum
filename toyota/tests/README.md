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
