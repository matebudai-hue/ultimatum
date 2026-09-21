# Kreditjáték – résztvevői kliensszövegek

## 1. játék – Ultimátum (rögzített)

### Felajánló – kör indul

**Kapsz X kreditet.** A rendszer összesorsol egy idegennel, aki ugyanazt tudja, mint Te. Ebből az összegből te döntöd el, mennyit ajánlasz fel neki.

Ha elfogadja az ajánlatodat, a bank mindkettőtöknek jóváírja az elosztást: ő megkapja a felajánlott összeget, nálad marad a többi. **Ha elutasítja, egyikőtök sem kap semmit.**

**Alku nincs.**

Döntési kérdés: **Mennyit ajánlasz fel a másik játékosnak?**

Döntési idő: **30 másodperc.** Az idő a feladat tényleges megjelenésekor indul, és a küldés gomb megnyomásakor megáll. Hálózati továbbítási idő nem okozhat 0–0 eredményt.

### Felajánló – ajánlat elküldve

**Ajánlat elküldve: X kredit.**

A másik játékosnak 30 másodperce van elfogadni vagy elutasítani.

Állapot: **Várakozás a másik játékos döntésére.**

### Fogadó – amíg nincs ajánlat

**A másik játékos X kreditet kapott.** Ebből az összegből ő dönti el, mennyit ajánl fel neked.

Ha elfogadod az ajánlatát, a bank mindkettőtöknek jóváírja az elosztást. **Ha elutasítod, egyikőtök sem kap semmit.**

**Alku nincs.**

Állapot: **Várakozás a másik játékos ajánlatára… A te 30 másodperced még nem indult el.**

### Fogadó – ajánlat megérkezett

**A másik játékos Y kreditet ajánlott neked. Elfogadod?**

Döntési idő: **30 másodperc**, az ajánlat tényleges megjelenésétől.

Gombok:
- **Elfogadom**
- **Elutasítom**

### Eredmények

Elfogadásnál mindkét játékos megkapja a megállapodás szerinti összeget.

Elutasításnál: **Ebből a körből egyikőtök sem kap kreditet.**

Valódi döntési időtúllépésnél: **0–0**. Technikai vagy hálózati hiba nem számít döntési időtúllépésnek.

---

## 2. játék – Diktátor (rögzített)

### Döntéshozó

**Most is kapsz X kreditet.** A rendszer összesorsol egy idegennel, aki ugyanazt tudja, mint Te. A kapott kreditből eldöntheted, mennyit adsz neki.

**A döntés kizárólag a tiéd. A másik félnek nincs döntési lehetősége: azt az összeget kapja, amit te adsz neki.**

Amit neki adsz, azt a bank az ő vagyonához írja. Ami nálad marad, azt a te vagyonodhoz írja. **Alku nincs.**

Döntési kérdés: **Mennyit adsz a másik játékosnak?**

Döntési idő: **30 másodperc.** Ha nem döntesz ennyi idő alatt, a rendszer úgy rögzíti, hogy **0 kreditet adtál**. Az idő a feladat tényleges kliens-megjelenésekor indul; az időben megnyomott gomb utáni technikai továbbítás nem számít időtúllépésnek.

### Fogadó

**Most is kapsz X kreditet.** A rendszer összesorsol egy idegennel, aki ugyanazt tudja, mint Te. A kapott kreditből ő dönti el, mennyit ad neked.

**Neked ebben a körben nincs döntési lehetőséged:** azt az összeget kapod, amit ő ad neked. Amit neked ad, azt a bank a vagyonodhoz írja.

Állapot: **Várakozás a másik játékos döntésére…**

---

## 3. játék – Bizalom (rögzített)

### Küldő – döntés előtt

**Kapsz X kreditet.** A rendszer összesorsol egy idegennel, aki ugyanazt tudja, mint Te.

Eldöntheted, hogy a kapott kreditből mennyit küldesz neki. **A bank az elküldött összeget megháromszorozza**, és ezt kapja meg a másik játékos.

Ezután ő dönt arról, hogy a hozzá került összegből mennyit ad vissza neked. Akár semmit is visszaadhat.

Ami nálad maradt, az a tiéd. Ehhez hozzáadódik az az összeg, amit a másik játékos visszaad.

Döntési kérdés: **Mennyit küldesz a másik játékosnak?**

A kliens élőben mutatja:
- **Te küldesz: Y kredit**
- **A bank átad neki: 3 × Y kredit**

Döntési idő: **30 másodperc.** Ha nem döntesz időben, **0 kreditet küldesz**. Az idő a feladat tényleges kliens-megjelenésekor indul; a technikai továbbítás nem vesz el az idődből.

### Küldő – elküldés után

**Elküldtél Y kreditet.**

A bank **3 × Y kreditet** adott a másik játékosnak.

Állapot: **Várakozás arra, hogy eldöntse, mennyit ad vissza.**

### Küldő – visszaadás után

**A másik játékos Z kreditet adott vissza.**

Az induló X kreditből nálad maradt **X − Y kredit**, és **Z kreditet kaptál vissza**.

**Ebben a körben összesen X − Y + Z kredit kerül a vagyonodhoz.**

### Fogadó – amíg a másik dönt

**A másik játékos most arról dönt, mennyit küld neked.**

A bank az általa elküldött összeget megháromszorozza. Ezután te döntöd el, mennyit adsz vissza neki.

Állapot: **Várakozás a másik játékos döntésére…**

### Fogadó – összeg megérkezett

**A másik játékos Y kreditet küldött neked.**

A bank ezt megháromszorozta, ezért **3 × Y kredit került hozzád.**

Most te döntesz. Ebből az összegből mennyit adsz vissza a másik játékosnak?

**Amit visszaadsz, azt ő kapja meg. Ami megmarad, az a te vagyonodhoz kerül.**

Döntési kérdés: **Mennyit adsz vissza?**

A kliens élőben mutatja:
- **Visszaadsz: Z kredit**
- **Nálad marad: 3 × Y − Z kredit**

Döntési idő: **30 másodperc** az összeg tényleges megjelenésétől. Ha nem döntesz időben, **0 kreditet adsz vissza**. Az időben megnyomott gomb utáni technikai továbbítás nem számít időtúllépésnek.

### Fogadó – döntés után

**3 × Y kredit került hozzád.**

**Z kreditet visszaadtál.**

**3 × Y − Z kredit marad nálad.**

---

## 4. játék – Közös kassza (rögzített)

### Belépés a Közös kasszába

**Az első három játék véget ért.** Az eddig megszerzett vagyonod: **X kredit**.

Mostantól egy csoport tagjaként játszol. A saját vagyonodból döntheted el, mennyit teszel a közös kasszába.

A csoport által befizetett teljes összeget a **bank megduplázza**, majd egyenlő részben osztja vissza a csoport tagjai között. Nem számít, ki mennyit fizetett be: mindenki ugyanakkora összeget kap vissza.

Állapot: **Várakozás a következő körre…**

### Kör indul – nincs minimum

**Közös kassza · N. kör**

Jelenlegi vagyonod: **X kredit**.

Ebben a körben nincs minimum kassza.

**Mennyit teszel a közös kasszába?**

A kliens 60 másodperces visszaszámlálást mutat. A résztvevő ezalatt többször módosíthatja a tétet; mindig az utolsó mentett összeg számít.

A kliens élőben mutatja:
- **Jelenlegi téted: Y kredit**
- **A befizetés után nálad marad: X − Y kredit**

### Kör indul – van minimum

A kliens ugyanazt mutatja, de a résztvevő látja a minimum kassza **pontos összegét**:

**A kör minimum kasszája: M kredit.**

A résztvevő nem látja:
- mennyit fizettek be a többiek;
- hol tart aktuálisan a közös kassza;
- mennyivel van a csoport a minimum alatt vagy felett döntés közben.

A 80% / 90% / 95% tréneri gyorsbeállítás. A résztvevőnek a kiszámolt **konkrét minimumösszeg** jelenik meg.

### Tétek lezárva

**Tét lezárva: Y kredit**

A döntés már nem módosítható.

Állapot: **Várakozás a banki elszámolásra…**

Ha van minimum, annak pontos összege továbbra is látható.

### Sikeres kör

**A kör lezárult.**

A csoport összesen **K kreditet** tett a közös kasszába.

A bank ezt megduplázta: **2 × K kredit**.

Minden csoporttag **P kreditet kapott vissza**.

Személyes eredmény:
- **Te befizettél: Y kredit**
- **Visszakaptál: P kredit**
- **A kör eredménye számodra: P − Y kredit**
- **Új vagyonod: Z kredit**

### Minimumos, sikertelen kör

**A kör lezárult.**

A közös kassza nem érte el a körhöz szükséges minimumot.

A bank ebben a körben **nem fizet vissza**.

Személyes eredmény:
- **Te befizettél: Y kredit**
- **Visszakaptál: 0 kredit**
- **A befizetett összeget elvesztetted**
- **Új vagyonod: Z kredit**

A résztvevő **nem látja**, mennyi gyűlt össze ténylegesen, és mennyivel maradtak el a minimumtól.

### Tréneri dashboard

A tréner körönként és csoportonként látja:
- a minimum pontos összegét;
- a ténylegesen befizetett teljes kasszát;
- sikeres/sikertelen állapotot;
- minimum alatt a **hiányzó összeget**;
- az egyéni befizetéseket;
- sikeres körben a fejenkénti visszaosztást;
- az egyéni és csoportvagyon változását.

### Következő kör / játék vége

Elszámolás után:

**Várakozás a következő körre…**

A tréner tetszőleges számú új kört indíthat.

A játék lezárásakor a kliens megmutatja a résztvevő végső vagyonát.
