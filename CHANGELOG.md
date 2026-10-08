# Kreditjáték – frissítési napló

## 2026. október 8. – Technikai audit alapján végzett javítások

Állapot: élesítve és a nyilvános oldalon ellenőrizve 2026. október 8-án.
A dokumentáció rögzítése: 2026. október 9.

- [Kapcsolódó PR: #2](https://github.com/matebudai-hue/ultimatum/pull/2)
- [Éles játék](https://matebudai-hue.github.io/ultimatum/dashboard/)
- Egyesítési commit: `97c89db7aec5be2660e867692e90ed4d1d6a98f9`
- A közzétett dashboard commitja: `32c0172bbc03cd9177d833c77c58f94df2e5bfbd`

### Résztvevői felület

- QR-kóddal vagy meghívólinkkel belépve csak a résztvevő nevét kell megadni. A külön szobakódmező megszűnt; meghívó nélküli belépéskor az oldal a QR-kódhoz vagy linkhez irányít. A játék belső azonosítója és a linkben szereplő kód megmaradt.
- Az összegmező gépelés közben nem tagolja újra a számot, így nem tolja el a kurzort. A mező elhagyásakor ezres tagolást kap.
- Külön előnézet mutatja a tagolt összeget és a vagyonhoz viszonyított arányát; összegbeküldés előtt megerősítés jelenik meg.
- A félbehagyott összeg helyi piszkozatként megmarad, játékhoz, résztvevőhöz és körhöz kötve.
- Közös kasszánál a „Beérkezett” állapot csak a visszaigazolt tét után jelenik meg. A változtatást a „Módosítom” gomb indítja; változatlan összeg nem küldhető újra a gombbal.
- Egy már beküldött tét félbehagyott módosítása újratöltés után is látható és szerkeszthető. A felület jelzi, hogy addig a korábbi beérkezett tét érvényes.
- A közvetlen beküldési kivétel hibaüzenetet ad, és feloldja a küldés közbeni állapotot.
- A hiányzó döntés és a ténylegesen beküldött nulla elkülönül a tréneri kasszatáblában és a résztvevő lezárt nézetében.

### Elszámolás, riport és audit

- A közös kassza új elszámolása egész kreditekkel, pontos maradékelosztással működik: a visszaosztott összeg egésze a játékosokhoz kerül. A maradék kiosztását a rendezett játékosazonosítók határozzák meg.
- Játékosonkénti visszaosztás szerepel a könyvelésben, korrekcióban, riportban, CSV-ben és személyes nézetben. A régi, ilyen adatot nem tartalmazó körök az eredeti visszaosztásukkal olvashatók.
- Kézi kasszakorrekció után az egyéni kimutatás a korrigált nettó eredményt mutatja, nem az eredeti tranzakció összegét.
- A résztvevői adatnézet nem adja át más játékosok egyéni visszaosztását.
- A páros játékok összesítője alapból az ember–ember párokat mutatja. A gépi partnerrel játszott párok bekapcsolhatók és jelöltek; a teljes CSV minden döntést tartalmaz.
- A kasszariport csoportonként mutatja a befizetés és kezdővagyon arányát, a kör végi és eleji vagyon arányát, valamint a létszámtól függő egyéni határhozamot.
- Az audit 3-as verziója külön számolja a kasszaköröket és a csoportelszámolásokat.
- Megmarad a parancsesemény időpontja; külön adat a feldolgozás ideje és az időbélyeg forrása. Eltérő eszközórák időbélyegeiből nem állítunk megbízható hálózati késleltetést.

### Kifejezetten kihagyott funkciók

A felhasználó kérésére nem került a kiadásba:

- „Teljes összeg” gomb.
- Az ultimátumos elutasítás külön megerősítése (a korábbi javaslat 5. pontja). Az elutasítás egy kattintással működik.

### Kiadási folyamat és függőségek

- A GitHub-ellenőrzések már a PR-on, az éles ágba egyesítés előtt is lefutnak.
- A dashboard közzététele csak a main ágról történik.
- A Safari/WebKit teszt a production buildet vizsgálja.
- A package-lock.json rögzíti a csomagverziókat; a munkafolyamatok npm ci paranccsal telepítenek.
- Az audit által jelzett sérülékeny függőséget az @grpc/grpc-js 1.14.6 verziójára vonatkozó override kezeli.

### Ellenőrzési eredmények

A végleges csomaggal, majd az éles ágon is sikeres:

- Teljes automatizált tesztcsomag: 2–100 fős játékmenetek, 10 és 27 fős szimulált végigjátszás, 99 fős terhelési eset, újracsatlakozás, riportok és résztvevői adatvédelem.
- Új regressziós tesztek: pontos kreditelosztás, régi adatok kezelése, időbélyegek, körszám, gépi párok szűrése, kézi korrekció utáni egyenlegek és egyéni kimutatás.
- DOM-tesztek: nagy összeg bevitele, formázás, százalékos előnézet, piszkozat visszaállítása és körönkénti elkülönítése, megerősítés lemondása, késleltetett visszaigazolás és beküldési kivétel.
- Firestore-emulátoros szabályteszt.
- Safari/WebKit böngészőteszt iPhone-emulációval: ultimátum elfogadása és elutasítása tényleges Firebase-kapcsolaton keresztül.
- TypeScript-ellenőrzés és production build.
- Éles függőségek biztonsági auditja: 0 jelzett sérülékenység a kiadás ellenőrzésekor.

Bizonyítékok:

- [PR kiadási ellenőrzései](https://github.com/matebudai-hue/ultimatum/actions/runs/37828599229)
- [PR Safari/WebKit tesztje](https://github.com/matebudai-hue/ultimatum/actions/runs/37828599348)
- [Éles ág ellenőrzése és dashboard közzététele](https://github.com/matebudai-hue/ultimatum/actions/runs/37828964997)
- [Éles ág Safari/WebKit tesztje](https://github.com/matebudai-hue/ultimatum/actions/runs/37828965020)
- [GitHub Pages közzététel](https://github.com/matebudai-hue/ultimatum/actions/runs/37829244221)

A nyilvános oldal az ellenőrzéskor HTTP 200 választ adott, és az új `index-CKI1TxJ5.js`, illetve `index-CiMEuwwd.css` fájlokat hivatkozta. Mindkét fájl elérhető volt.

### Az ellenőrzés határai

A Safari-próba automatizált WebKit-teszt iPhone-emulációval, nem fizikai telefonon végzett próba. A konkrét régi Safari 14 verziót nem teszteltük; a Firebase buildje erre a célverzióra BigInt-kompatibilitási figyelmeztetést adott. A sikeres tesztek nem jelentenek minden eszközre és minden helyzetre szóló hibamentességi garanciát.

A résztvevői audit nyers adatai nem kerültek a repóba.
