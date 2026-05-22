# STATE_MACHINE v0.1

## 1. Session állapotok

### `created`

A tréner létrehozta a játékalkalmat. A session létezik, de a lobby még nem feltétlenül aktív.

### `lobby_open`

A belépés nyitva van. A résztvevők QR-kóddal belépnek, megadják a nevüket és várakoznak.

### `lobby_closed`

A résztvevői lista lezárva. Új résztvevő már nem léphet be. A tréner indíthatja az első játékot.

### `game_active`

Fut valamelyik játék: ultimátum, diktátor, bizalom vagy közös kassza. Az aktuális helyzetet a `currentGame` és `currentRound` mezők határozzák meg.

### `finished`

A teljes játék lezárult. A tréner látja a végső adatokat, előnézheti a visszajelzéseket és kiküldheti a résztvevői záró nézetet.

## 2. Fordulóállapotok az első három játékban

Az ultimátum, diktátor és bizalom hasonló fordulólogikát használ.

### `round_prepared`

A rendszer előkészítette a fordulót. Itt történik az automatikus párosítás, a szerepek kiosztása, a botpárosítás és az ismétlésellenőrzés.

Tréner látja a párokat, szerepeket, botot és az indítás gombot. Résztvevő még várakozik.

### `round_open`

A forduló nyitva van. Résztvevők megkapják a saját aktuális feladatukat.

### `waiting_for_responses`

A rendszer várja a hiányzó döntéseket. A tréner látja, ki küldött már, ki nem küldött, melyik párosnál áll a folyamat, és a botdöntés megtörtént-e.

### `round_ready_to_close`

Minden szükséges döntés beérkezett. A tréner látja a teljes döntési listát, az előzetes elszámolást és a lezárás gombot.

Fontos: a rendszer itt még ne írja véglegesen a vagyont, csak előkészíti az elszámolást.

### `round_closed`

A tréner lezárta a fordulót. Itt történik a végleges számolás, a tranzakciók létrehozása, a vagyonok frissítése és az eredmények rögzítése.

### `results_released`

A résztvevők megkapják az adott forduló saját eredményét. Látják az adott kör saját eredményét, az aktuális saját vagyonukat és várakoznak a következő körre.

## 3. Közös kassza állapotok

### `public_goods_prepared`

A tréner előkészíti a közös kassza körét. Beállítja a kör számát, a minimumkasszát, ha van, és a résztvevői üzenetet.

### `public_goods_open`

A kör nyitva van. Résztvevők látják a saját aktuális vagyonukat, a minimumkassza-üzenetet és a befizetési mezőt.

### `public_goods_waiting`

A rendszer várja a befizetéseket. A tréner látja, ki küldött, ki nem küldött, ki mennyit küldött, mennyi az aktuális összes kassza, és teljesülne-e a minimum.

### `public_goods_contributions_locked`

A tréner lezárta a befizetést. Ettől kezdve a résztvevő már nem módosíthat. A rendszer kiszámolja a várható eredményt, a tréner látja az összes adatot, de a résztvevő még nem kap eredményt.

Ez a dramaturgiai tartás helye: a tréner kérdezhet, feszültséget építhet, közben még nem derül ki semmi a résztvevőknek.

### `public_goods_calculated`

A rendszer kiszámolta az összes befizetést, a minimum teljesülését, a kassza sikerességét vagy sikertelenségét, a visszaosztást és az új egyéni vagyonokat.

A tréner látja az eredményt, de még nem küldte ki.

### `public_goods_results_released`

A tréner kiküldte az eredményt. A résztvevő látja a saját befizetését, a kassza sikerességét vagy sikertelenségét, a saját visszaosztását és az új saját vagyonát.

Nem látja mások befizetését, mások vagyonát vagy a rangsort.

## 4. Záró visszajelzés állapotai

### `feedback_draft`

A rendszer előkészíti a személyes visszajelzéseket. A tréner látja előnézetben, a résztvevő még semmit nem lát.

### `feedback_reviewed`

A tréner átnézte a visszajelzéseket. Szükség esetén módosíthatja vagy újragenerálhatja.

### `feedback_released`

A tréner kiküldte a visszajelzéseket. A résztvevő látja a végső saját vagyonát, a rövid szakmai visszajelzést és opcionálisan a saját játékadatait.

## 5. Kritikus szabályok

### Vagyont csak lezárt forduló írhat

A vagyon nem frissül minden kattintásnál. Csak akkor frissülhet, amikor a forduló státusza `round_closed` vagy `public_goods_results_released`.

Így elkerülhető a dupla számolás.

### Döntés csak nyitott körben küldhető

Résztvevő csak akkor küldhet be döntést, ha a kör státusza `round_open`, `waiting_for_responses`, `public_goods_open` vagy `public_goods_waiting`.

Lezárt körben már nem módosíthat.

### Tréneri korrekció csak naplózva

Ha hibás beküldés történik, a tréner módosíthat, de minden korrekciót naplózni kell:

- ki módosította,
- mikor,
- mit módosított,
- mi volt az eredeti érték,
- mi lett az új érték.

### Botdöntés nem számít emberi normába

A Normatükör Bot az emberi döntések mediánjából számol, de a saját döntése nem kerül vissza a mediánalapba.

Így a bot nem kezdi el önmagát tükrözni.
