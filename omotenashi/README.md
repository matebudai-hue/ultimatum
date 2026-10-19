# Toyota Omotenashi Manager – kétnapos tanulási napló

Mobilon használható, bejelentkezést nem kérő résztvevői webapp. A jegyzetek automatikusan, helyben mentődnek. A gyári megfigyelési kérdések az Omotenashi Manager képzési anyag 2026 v3 témáiból és a záróprogram Andon/vezetői feladataiból készültek.

## A buszos program négy feladata

1. Mit szeretnél hazavinni ebből a két napból? Szabad jegyzet, választható tanulási fókuszok és saját fókusz.
2. Toyota Way Challenge – beépített, saját tempóban játszható 30 kérdéses kvíz. Egyénileg, párban vagy kiscsoportban is kitölthető. 16 kiemelt fogalom, 100 pont/helyes válasz, nincs időbónusz. A helyes megoldásokat és a kérdésenkénti magyarázatokat csak a végleges lezárás után mutatja.
3. Páros beszélgetések párcserékkel. Három konkrét kérdéshez külön jegyzet, további forduló is felvehető. A párcserét a tréner vezeti, biztonságos megállásnál.
4. Felkészülés a gyárlátogatásra. Tíz konkrét megfigyelési szempontból 2–3 saját fókusz választható. A résztvevő átírhatja, törölheti és bővítheti a saját listáját.

## Beépített Toyota Way Challenge

A Toyota on the Road képernyőről a **Kvíz indítása vagy folytatása** hivatkozás a `kviz.html` belső nézetre visz. A résztvevői app linkje változatlan. A kitöltéshez nem kell Kahoot, belépés vagy regisztráció.

- A válaszok között a lezárásig szabad visszalépni; mind a 30 kérdésre válaszolni kell a pontozáshoz.
- Két kutatós kérdés közvetlen Google-keresési hivatkozással segíti az utánanézést.
- A lezárás egy megerősítő lépés; utána a válaszok zárolva vannak, megjelenik a 0–3000 pontos eredmény és az összes kérdés indoklása.
- A játékos vagy csapat neve opcionális. Az eredmény másolható. A játék csak helyben mentődik, központi ranglista és központi eredménygyűjtés nincs.
- A kvíz mentési kulcsa `toyota-omotenashi-quiz-v1`, **elkülönül** a jegyzetek változatlan `toyota-omotenashi-notebook-v1` kulcsától. Az új játék kizárólag a kvíz válaszait törli.
- Az alkalmazás offline gyorsítótára az index és a kvíz oldalt is tartalmazza; az első betöltéshez hálózat kell. A Google-keresésekhez természetesen internet szükséges.

## Gyárban és a gyárlátogatás után

A Gyári megfigyelések részben minden szemponthoz külön rögzíthető a forrás (láttam / a kísérőtől hallottam / nem volt megfigyelhető), a konkrét megfigyelés és a kereskedési kapcsolat.

A feldolgozás lépései:

- Mit láttunk? Konkrét megfigyelés, értelmezés, visszatérés az induló várakozáshoz.
- Kaizen a kereskedésben. Négy egyszerű kérdés: miből indulok, hol van hasonló helyzet nálunk, mit próbálok ki, miből látom a javulást?
- Személyes vezetői terv. Az elfogadott hét kérdés, a teljes képzésből választott egyetlen alkalmazással.
- Páros transzfer. Négy segítő kérdés és az első lépés/időpont pontosítása, 4–4 perces munkához.

## Résztvevői használat

Indulás előtt internet mellett nyisd meg a linket. Várd meg az „Offline használatra kész” jelzést. Ugyanazon a telefonon, ugyanabban a böngészőben nyisd újra az oldalt: az előző jegyzeteid és saját szempontjaid visszatérnek. A progrészek között a felső választóval és az alsó Előző/Következő gombokkal léphetsz.

A Jegyzeteim részből a teljes szöveg letölthető, másolható, a böngésző nyomtatásával PDF-be menthető és a telefon saját megosztójával/e-mail kliensével továbbadható. A letöltött JSON biztonsági másolat minden adatot megőriz és visszatölthető másik eszközön. A hosszú szöveg nem csonkolódik e-mail-küldéskor: az app ilyenkor fájlcsatolást ajánl.

A privát böngészési mód és a böngészőadatok törlése nem alkalmas két napon át megőrzött jegyzetelésre. Ha a helyi mentés nem működik, az app külön jelzi. Az adatokat nem gyűjtjük központilag.

## A gyári kérdések szakmai alapja

Gemba/Genchi Genbutsu, Muda, vizuális menedzsment, sztenderdek, átadási pontok, Andon-jelzés és támogatás, okfeltárás, munkatársi bevonás, PDCA és Kaizen, vezetői szerep, tanítás és Yokoten. A kérdések nem állítják előre, hogy az adott gyári folyamat látható lesz, és nem pontozzák a gyárat. A gyári tényt, a hallott magyarázatot és a résztvevő saját következtetését elkülönítjük.

## Frissítés és adatmegőrzés

A `toyota-omotenashi-notebook-v1` helyi mentési kulcs verziófrissítéskor változatlan marad. A meglévő megfigyelési listát és annak szerkesztéseit nem cseréljük vissza az alaplistára. Az offline gyorsítótár csak ehhez az almappához tartozik, és nem módosítja a többi játékot vagy a Toyota értékesítői megfigyelőappot.

Frissítéskor az `APP_VERSION` és a service worker `CACHE` verziója együtt emelendő. Adatszerkezeti változásnál külön, nem destruktív migráció és mentési teszt szükséges. A böngészőben a Jegyzeteim / Az app frissítése rész kezdeményezhet ellenőrzést.

## Tesztek

A `tests/smoke.mjs` Playwright-alapú ellenőrzés lefedi a helyi mentést, a lap bezárását és újranyitását, a teljes böngésző újraindítását, az offline újranyitást, egy appfrissítést, a saját szempontok megtartását, az export/importot és a mentési hibát. A kapcsolódó GitHub Actions workflow kizárólag az Omotenashi-app változásainál fut.
