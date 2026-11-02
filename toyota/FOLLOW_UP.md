# Toyota megfigyelőalkalmazás · állapot és következő lépések

## Elkészült: betekintő szerep

Az admin az **Osztály beállításai → Betekintő hozzáférés** ablakban engedélyezhet egy e-mail-címet az aktuális osztályhoz. Lejárat: 7, 30, 90 nap vagy visszavonásig. A saját adminbelépés nem osztható meg.

A Toyota munkatársa a megosztható belépési linken saját fiókot hoz létre az engedélyezett e-mail-címmel, megerősíti a címét, majd belép. Ha már van fiókja, regisztráció helyett belép. A regisztráció és a link birtoklása önmagában nem ad jogosultságot.

A betekintő csak az engedélyezett osztályok eredményeit látja. Külön választhat megfigyelést és vizsgát; eléri az áttekintést, a megfigyelői értékeléseket és a kivetítést. Nem módosíthat névsort, nem hozhat létre vagy törölhet osztályt/alkalmat, nem zárhat le és nem oszthat tovább hozzáférést. Ezeket szerveroldali ellenőrzések is tiltják.

Alapból a résztvevők és megfigyelők jelölésekkel szerepelnek, a szabad szöveges visszajelzések nem kerülnek lekérésre. Az admin külön engedélyezheti a neveket és a visszajelzéseket. A résztvevők kapcsolattartási e-mail-címe soha nem szerepel a betekintő adatválaszában. Az osztály és alkalom saját elnevezése látható marad, ezért a név nélküli megjelenítés nem teljes anonimizálás.

A visszavonás az új adatlekéréseket azonnal tiltja; a megnyitott betekintő felület a következő, legfeljebb 20 másodpercen belüli frissítéskor törli az eredményeket és a nyitott részleteket. A kimerevített kivetítést is kiüríti. A már látott vagy más módon megőrzött információ természetesen nem vonható vissza.

Automatikus meghívólevél nincs: az admin kimásolja és maga küldi el a belépési linket. A fejlesztés és ellenőrzés nem hozott létre valódi külső fiókot, nem engedélyezett valós címzettnek betekintést és nem küldött levelet.

## Elkészült: jelszóhelyreállítás és értékelésenkénti törlés

A belépőoldal **Elfelejtettem a jelszavam** művelete levélben kér helyreállító hivatkozást. A recovery-visszatérés külön új-jelszó felületre vezet, nem léptet automatikusan az adminba. A helyreállító token csak memóriában marad; az új jelszó nincs helyi adattárolásban. Hibás/lejárt hivatkozásnál új levél kérhető. Ha a levél gombja rossz oldalra irányít, a hivatkozás az alkalmazásban is ellenőrizhető. A saját fiók helyreállítása nem ad új admin- vagy betekintési jogosultságot.

A valódi levelezőszolgáltatás, címzettengedélyek és átirányítások továbbra is a Supabase Auth konfigurációjától függenek. A fejlesztés során valódi címre nem küldtünk helyreállító levelet és valódi jelszót nem változtattunk meg.

Az admin **Eredmények** nézetében egyetlen beküldést is törölhet. A megerősítés megmutatja a résztvevőt, a megfigyelőt, a beküldés időpontját és pontszámát. A törlés kiveszi az értékelést az aktív eredményekből, és a saját kivetítő frissül. **További műveletek → Törölt értékelések** alatt visszaállítható. A betekintő sem törölni, sem visszaállítani, sem a törölt értékeléseket listázni nem tudja.

Az értékelés fizikai adatsora megmarad; a végleges megőrzési/törlési szabály továbbra is külön feladat. Az osztály végleges törlése a töröltként jelölt értékeléseit is törli, és ezek számát is belefoglalja a megerősítésbe.

## Korábban elkészült

- Alkalom és teljes osztály lezárása/újranyitása, eredmények megőrzésével.
- Megbízható beküldési állapot és biztonságos ismétlés.
- E-mail-címek megőrzése névsor beillesztésekor, UTF-8 és Windows-1250 import.
- Kivetítő frissességjelzése és név szerinti lapozás.

## Később, külön kezelendő

Saját origin/domain; részletes adatkezelési tájékoztató és megőrzési szabály; vizsga végső tréneri döntése.


## Elkészült: visszajelzések és szempontlisták összehasonlítása

Az értékesítő nevére kattintva a szöveges visszajelzések kerülnek előre. Ezt a megfigyelők ponteltérései követik, legnagyobb eltéréssel kezdve. Az egész húszas lap lenyitható. A 0–1–2 értékek számot, feliratot és eltérő formát is kapnak. Több mint két értékelésnél a többi visszajelzés lenyitható; mindegyik időbélyeggel, megfigyelővel és alkalommal szerepel. A betekintő visszajelzést csak külön engedéllyel lát.

Az áttekintés, a kivetítés és a levélösszesítés kizárólag azonos szempontlistát használó értékeléseket összesít. A váltó csak több lista esetén látható. A mentett stabil szempontazonosítók rendezik az áthelyezett sorok pontjait; eltérő tartalom vagy verzió külön csoport. A korai, snapshot nélküli v1 adatok külön befagyasztott eredeti listával értelmezhetők, nem a mindenkori aktuális listával. Ismeretlen lista esetén nem találunk ki szempontcímeket. A meglévő adatokat, pontszámokat és szempontszövegeket nem írjuk át.

A verzióváltás a kivetítési kimerevítést feloldja és az első szempontra áll, hogy más listához tartozó kiválasztás ne maradjon aktív. A listaváltó az adminban és a kivetítő vezérlőjében együtt változik. Az adatbázisban továbbra is csak a kanonikus aktuális listával lehet új értékelést beküldeni; a módosított listák előnézeti minták. Új valódi lista bevezetésekor külön szerveroldali regisztráció szükséges.
