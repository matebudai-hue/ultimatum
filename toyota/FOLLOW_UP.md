# Toyota megfigyelőalkalmazás · állapot és következő lépések

## Elkészült: betekintő szerep

Az admin az **Osztály beállításai → Betekintő hozzáférés** ablakban engedélyezhet egy e-mail-címet az aktuális osztályhoz. Lejárat: 7, 30, 90 nap vagy visszavonásig. A saját adminbelépés nem osztható meg.

A Toyota munkatársa a megosztható belépési linken saját fiókot hoz létre az engedélyezett e-mail-címmel, megerősíti a címét, majd belép. Ha már van fiókja, regisztráció helyett belép. A regisztráció és a link birtoklása önmagában nem ad jogosultságot.

A betekintő csak az engedélyezett osztályok eredményeit látja. Külön választhat megfigyelést és vizsgát; eléri az áttekintést, a megfigyelői értékeléseket és a kivetítést. Nem módosíthat névsort, nem hozhat létre vagy törölhet osztályt/alkalmat, nem zárhat le és nem oszthat tovább hozzáférést. Ezeket szerveroldali ellenőrzések is tiltják.

Alapból a résztvevők és megfigyelők jelölésekkel szerepelnek, a szabad szöveges visszajelzések nem kerülnek lekérésre. Az admin külön engedélyezheti a neveket és a visszajelzéseket. A résztvevők kapcsolattartási e-mail-címe soha nem szerepel a betekintő adatválaszában. Az osztály és alkalom saját elnevezése látható marad, ezért a név nélküli megjelenítés nem teljes anonimizálás.

A visszavonás az új adatlekéréseket azonnal tiltja; a megnyitott betekintő felület a következő, legfeljebb 20 másodpercen belüli frissítéskor törli az eredményeket és a nyitott részleteket. A kimerevített kivetítést is kiüríti. A már látott vagy más módon megőrzött információ természetesen nem vonható vissza.

Automatikus meghívólevél nincs: az admin kimásolja és maga küldi el a belépési linket. A fejlesztés és ellenőrzés nem hozott létre valódi külső fiókot, nem engedélyezett valós címzettnek betekintést és nem küldött levelet.

## Korábban elkészült

- Alkalom és teljes osztály lezárása/újranyitása, eredmények megőrzésével.
- Megbízható beküldési állapot és biztonságos ismétlés.
- E-mail-címek megőrzése névsor beillesztésekor, UTF-8 és Windows-1250 import.
- Kivetítő frissességjelzése és név szerinti lapozás.

## Később, külön kezelendő

Saját origin/domain; jelszó-visszaállítás; részletes adatkezelési tájékoztató és megőrzési szabály; célzott értékeléstörlés; vizsga végső tréneri döntése; szempontverziók szerinti elkülönített összesítés a szempontok következő módosítása előtt.
