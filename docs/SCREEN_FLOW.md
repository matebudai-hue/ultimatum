# SCREEN_FLOW v0.1

## 1. Tréneri kezdőképernyő

Funkciók:

- új játékalkalom létrehozása,
- játék neve / csoport neve megadása,
- névtelen mód kapcsoló,
- QR-kód generálása,
- belépett résztvevők listája,
- játék indítása gomb.

Tréner látja, hányan léptek be, mi a résztvevők neve, aktív-e a státuszuk, és van-e duplikált név.

## 2. Résztvevői belépés

QR-kód beolvasása után a résztvevő megadja a nevét, majd váróképernyőre kerül.

Váróképernyő szövege:

> Beléptél a játékba. Várjuk, hogy a tréner elindítsa az első kört.

Látható:

- saját név,
- session neve,
- várakozó státusz.

## 3. Tréneri párosítás képernyő

A tréner elindítja az adott játékot. A rendszer automatikusan párosít.

Dashboard mutatja:

- párok,
- szerepek,
- botpárosítás, ha van,
- ismétlésfigyelés,
- kör indítása gomb.

Résztvevők ebből semmit nem látnak név szerint, ha névtelen mód aktív.

## 4. Ultimátumjáték képernyők

### Ajánlattevő

Szöveg:

> 1 000 000 Ft áll rendelkezésedre. Mennyit ajánlasz fel a játékostársadnak?

Mező:

- ajánlat összege.

Gomb:

- ajánlat elküldése.

Beküldés után:

> Ajánlat elküldve. Várjuk a játékostársad döntését.

### Fogadó

Szöveg:

> Ajánlatot kaptál egy játékostárstól.

Látható:

- ajánlat összege.

Gombok:

- elfogadom,
- elutasítom.

### Eredmény

Elfogadás esetén:

> Az ajánlat elfogadásra került.

Elutasítás esetén:

> Az ajánlat elutasításra került. Ebben a körben mindkét fél 0 Ft-ot kapott.

Látható:

- adott kör saját eredménye,
- aktuális saját vagyon.

## 5. Diktátorjáték képernyők

### Döntő

Szöveg:

> 1 000 000 Ft áll rendelkezésedre. Mennyit adsz a játékostársadnak?

Mező:

- adott összeg.

Gomb:

- döntés elküldése.

### Fogadó

Szöveg:

> A játékostársad döntött.

Látható:

- kapott összeg,
- aktuális saját vagyon frissítés után.

Nincs elfogadás vagy elutasítás.

## 6. Bizalomjáték képernyők

### Küldő

Szöveg:

> 1 000 000 Ft áll rendelkezésedre. Mennyit küldesz a játékostársadnak?

Mező:

- küldött összeg.

Segítő szöveg:

> A küldött összeg háromszorosan érkezik meg a másik félhez.

Gomb:

- küldés.

### Fogadó

Szöveg:

> A játékostársad pénzt küldött neked. Az összeg háromszorozva érkezett meg.

Látható:

- érkezett összeg.

Mező:

- visszaadott összeg.

Gomb:

- visszaküldés.

### Eredmény

Látható:

- ebben a körben szerzett összeg,
- aktuális saját vagyon.

## 7. Közös kassza képernyők

### Tréneri előkészítés

A tréner beállítja:

- közös kassza kör száma,
- minimumkassza összege, ha van,
- résztvevői üzenet.

Példa üzenet:

> Ebben a körben a közös kasszának legalább 5 000 000 Ft-ot kell elérnie. Ha ez nem jön össze, a bank benyeli a befizetéseket.

Gomb:

- kör megnyitása.

### Résztvevői befizetés

Látható:

- saját aktuális vagyon,
- tréneri üzenet,
- minimumkassza, ha van,
- befizetési mező.

Szöveg:

> Mennyit fizetsz be a közös kasszába?

Gomb:

- befizetés elküldése.

Beküldés után:

> Befizetésed rögzítve. Várjuk a kör lezárását.

A résztvevő nem látja mások befizetését.

### Tréneri közös kassza dashboard

Látható:

- játékosonkénti aktuális vagyon,
- játékosonkénti befizetés,
- beküldési státusz,
- összes befizetés,
- minimum teljesülése,
- várakozó játékosok,
- befizetés lezárása gomb,
- eredmény kiküldése gomb.

Fontos: a befizetés lezárása és a pénz visszaküldése két külön gomb.

### Közös kassza eredmény

Résztvevő látja:

- saját befizetés,
- közös kassza sikeres / sikertelen,
- saját visszaosztás,
- saját új vagyon.

Nem látja:

- mások nevét,
- mások vagyonát,
- mások befizetését,
- név szerinti rangsort.

## 8. Záró képernyő

### Tréneri záró dashboard

Látható:

- végső vagyonok,
- döntési mintázatok,
- közös kassza hozzájárulások,
- záró visszajelzések előnézete,
- visszajelzések kiküldése gomb.

PM-döntés: a visszajelzést a rendszer generálja, de a tréner előnézet után küldi ki.

### Résztvevői záró képernyő

Látható:

- végső saját vagyon,
- rövid személyes visszajelzés,
- opcionálisan saját játékadatok.
