# Toyota ellenőrzések

`node --test toyota/tests/review.test.cjs`

A Node beépített tesztfuttatójával, külső függőség nélkül. Valódi függvények és eseménykezelők izolált környezetben: névsor/e-mail megőrzése, két CSV-kódolás, beküldési állapot és vizuális prioritás, végleges elutasítás kontra bizonytalan hálózati eredmény, szerverhibák, lejárt belépés, kivetítő névadatvédelme. A DOM-helyettesítő nem helyettesíti a böngészős tördelésellenőrzést.

`closure.sql`: csak szintetikus adat, tranzakció és visszagörgetés. Lezárás/újranyitás, lezárás utáni ismételt nyugta, hamisított szempontlista, érvénytelen pontok és jogosulatlan lezárás ellenőrzése. Soha nem olvas valódi felhasználói munkamenetet, nem állít be felhasználói JWT-t.

Böngésző: `design-concept.html?screen=admin#preview=1`, `phone-review.html`, `phone-review.html?view=result`, `projection-check.html`. Mintaadatok, az API-módosítások blokkolva. Az admin előnézetből valódi külön kivetítőablak nyitható. A névvel megjelenített egy szempont nézet hat értékelést mutat oldalanként, a lapozást az admin vezérli. A Frissítés megőrzi a vezérlőpanelt és az aktuális névoldalt.

Adatbázis-frissítés: `database/review_hardening.sql`. Additív kiadás; meglévő adatsorokat nem töröl és nem ír át. A privát szemponttábla elutasít minden klienshozzáférést; csak az ellenőrzött beküldő függvény olvassa. A publikus QR-függvények szándékosan használhatók bejelentkezés nélkül. A lezárás és a többi adminművelet külön jogosultságellenőrzést követel.
