# Autós Bajnokok Ligája

Mobilbarát versenysegéd 32 játékautóhoz. Élő oldal: https://autos-bajnokok-ligaja.mbudai.chatgpt.site

## Játék

1. A négy kalapba írj 8–8 különböző autónevet. Kalaponként egy 8 soros lista is beilleszthető.
2. A sorsolás 8 fordulót és összesen 128 alapszakasz-mérkőzést készít. Minden autónak kalaponként két különböző ellenfele van, a saját kalapból is.
3. A Játék nézetben koppints a győztesre. A következő meccs és a tabella automatikusan frissül. Győzelem: 2 pont; vereség: 0.
4. 1–8.: közvetlen továbbjutás. 9–24.: playoff (9–24, 10–23, …, 16–17). 25–32.: kiesés.
5. A playoff után új, teljesen szabad sorsolás a legjobb 16 között, majd rögzített kieséses ág. Playoff és nyolcaddöntő 1 győzelemig; negyeddöntő 2; elődöntő 3; döntő 5 győzelemig. Teljes torna: 163–175 mérkőzés.

Pontazonosság: pont → összes kisorsolt ellenfél alapszakaszpontjainak összege → legyőzött ellenfelek pontjainak összege → induláskor kisorsolt és végig rögzített holtversenysorrend. Játék közben az ellenfélpontok változnak, így az alapszakasz lezárásáig a helyezések ideiglenesek.

## Mentés

Az autólista (32 autó és a négy kalap) a bajnokság indításakor külön automatikusan elmentődik. Az **Autólista mentése** gombbal indulás előtt is elmenthető. Az **Új bajnokság** megtartja a korábbi autókat és a kalapbeosztást; az új sorsolás előtt a névmezők már ki vannak töltve. A kezdőoldalon a **Mentett autók betöltése** gombbal bármikor visszatölthető az elmentett lista.

Az **Autólista letöltése** eredmények nélküli `autos-bl-autolista.json` fájlt készít. A **Mentés / autólista betöltése** ezt másik eszközön is beolvassa egy új bajnokság előkészítéséhez. A jelenleg futó bajnokság cseréje előtt megerősítést kér. A korábbi bajnokságmentések továbbra is használhatók.

A játék automatikusan a használt böngésző helyi tárhelyén mentődik; nincs szerveres vagy eszközök közötti automatikus szinkron. Mentés és beállítások → Mentés letöltése / betöltése. A mentés JSON fájl, azonos sorsolást és teljes eseménynaplót tartalmaz. Az Állás másolása a chathez gomb a tabellát és a teljes versenyállást is másolja.

Az utolsó eredmény visszavonható. Korábbi meccs javításakor az attól kezdve bevitt eredmények és továbbjutási lépések törlődnek, mert hatással lehetnek a későbbi ellenfelekre.

## Technika

Függőség nélküli statikus HTML/CSS/JavaScript. A `dist/` könyvtár tetszőleges statikus tárhelyen kiszolgálható. Az ellenőrzésekhez Node.js 24+, `npm ci`, majd `npm test` és `npm run check` használható. A jsdom kizárólag fejlesztési tesztfüggőség, az online oldal nem tölti be. A Sites saját tárhelyén owner-private online oldal fut.

A tesztek 2000 sorsolást, teljes minimum- és maximumhosszú versenyeket, mentést/betöltést és a valódi JavaScript-gombkezelőket ellenőrzik. A DOM-teszt 175 eredményt visz be a felületen, eljut a döntőig, majd ugyanazokkal az autókkal új bajnokságot indít. Ellenőrzi azonos seedű bajnokság importját és a másik lapon indított új játék szinkronját is. A DOM-teszt nem ellenőrzi a CSS vizuális megjelenítését valódi mobilböngészőben.

A bajnokságot determinisztikus sorsolás és eseménynaplóból újraszámolt állapot vezeti. A `dist/engine.js` a külön tesztelhető motor, `dist/app.js` a mobilfelület. Nincsenek API-kulcsok, külső betűtípusok vagy követők.
