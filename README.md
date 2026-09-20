# Kreditjáték

Online, több résztvevős tréninggyakorlat.

## Jelenlegi tiszta állapot

A GitHub repository a projekt egyetlen fejlesztési forrása.

Megmaradt:
- a részletes játékspecifikáció a `docs/` könyvtárban;
- a már elkészült számolási/játékmotor-alap a `src/` könyvtárban;
- a jelenlegi statikus prototípus, amíg az új belépési folyamatot nem igazoltuk.

A korábbi félkész hosting- és szerverpróbák nincsenek bekötve a projektbe.

A `kreditjatek-live` ág tiszta fejlesztési ág, a `main` állapotából indul.

## Következő működési kapu

1. tréner játékot indít;
2. kap egy játékkódot;
3. résztvevő névvel és játékkóddal belép;
4. a tréner valós időben látja a belépőket;
5. frissítés után a játékállapot megmarad.

Csak ennek működése után kerül rá az 1a Ultimátum, majd a teljes 1a–3b folyamat és a Közös kassza.
