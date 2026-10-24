# Programtár – nyilvántartás

Ellenőrzés: 2026. október 25. Fiók: `matebudai-hue`.

Közös indítóoldal: https://matebudai-hue.github.io/ultimatum/kozpont/

## Használati rend

A központban a tréningprogramok, a személyes játékok, a fejlesztési változatok és a korábbi oldalak külön jelennek meg. A régi változatok megmaradnak; a központ nem töröl adatot és nem írja át a programok belépőcímeit. A korábbi Mátra-verziók külön lenyitható listában találhatók.

## Fő programok

| Név | Repó és hely | Indítás |
|---|---|---|
| Halastó – eredeti | `halasto`, `main`, `halasto-2/` | https://matebudai-hue.github.io/halasto/ |
| Kreditjáték | `ultimatum`, `main`, forrás `app/`, build `dashboard/` | https://matebudai-hue.github.io/ultimatum/dashboard/ |
| Explorer / Kikötő | `ultimatum`, `main`, `explorer/` | https://matebudai-hue.github.io/ultimatum/explorer/ |
| Omotenashi | `ultimatum`, `main`, `omotenashi/` | https://matebudai-hue.github.io/ultimatum/omotenashi/ |
| Toyota-pontozó | `ultimatum`, `main`, `toyota/` | https://matebudai-hue.github.io/ultimatum/toyota/ |
| Mátra – alapjáték | `matra-hardtrail`, `main`, `matra-v11.html` | https://matebudai-hue.github.io/matra-hardtrail/ |
| Mátra – vezetői | `matra-hardtrail`, `main`, `matra-leader.html` | https://matebudai-hue.github.io/matra-hardtrail/matra-leader.html |
| Skorpió | `skorpio`, `main` | https://matebudai-hue.github.io/skorpio/ |
| Matek-sziget | `ultimatum`, `main`, `matek/` | https://matebudai-hue.github.io/ultimatum/matek/ |
| Autós Bajnokok Ligája | `ultimatum`, `autos-bajnokok-ligaja` ág, `games/autos-bajnokok-ligaja/` | https://autos-bajnokok-ligaja.mbudai.chatgpt.site |

Az Autós BL külön tárhelyen, a dokumentáció szerint tulajdonosi hozzáféréssel fut. A linkjegyzék nem változtatja meg az oldal közönségét.

## Fejlesztés, technikai címek

| Név | Forrás / szerep | Cím |
|---|---|---|
| Halastó 2 – utód | `halasto` repó, `halasto-3` ág, `halasto-3/` | https://matebudai-hue.github.io/halasto/halasto-3/ |
| Halastó sandbox | `halasto` repó, `halasto-sandbox` ág, `halasto-2/` | https://matebudai-hue.github.io/halasto/sandbox/ |
| Mátra sandbox | `matra_sandbox`, `main`, `matra-v24-single-report.html` | https://matebudai-hue.github.io/matra_sandbox/ |
| Eredeti Halastó alternatív címe | Ugyanaz a publikált eredeti program | https://matebudai-hue.github.io/halasto/halasto-2/ |
| Régi Halastó sandbox | Átirányító a jelenlegi sandboxhoz | https://matebudai-hue.github.io/halasto-sandbox/ |
| Halastó RC | Korábbi külön kiadási workflow; legutóbb ellenőrzött futása sikertelen | https://github.com/matebudai-hue/halasto-rc |
| Mátra megfigyelő | Külön ágban lévő eszköz; élő közzététel nem igazolt | https://github.com/matebudai-hue/halasto/blob/feature/matra-observer-dashboard/matra-observer.html |

## Közvetlen segédoldalak

- Omotenashi-kvíz: https://matebudai-hue.github.io/ultimatum/omotenashi/kviz.html
- Ichigo Ichie: https://matebudai-hue.github.io/ultimatum/omotenashi/ichigo-ichie.html
- Andon: https://matebudai-hue.github.io/ultimatum/omotenashi/andon.html
- Sztenderdizálás: https://matebudai-hue.github.io/ultimatum/omotenashi/sztenderdizalas.html
- Mátra tréneri leírás: https://matebudai-hue.github.io/matra-hardtrail/treneri-leiras.html
- Mátra vezetői leírás: https://matebudai-hue.github.io/matra-hardtrail/treneri-leiras-leader.html
- Mátra vezetői kártyák: https://matebudai-hue.github.io/matra-hardtrail/vezeto-kartyak.html

## Mi nem külön program?

A Kreditjáték négy játéka egy alkalmazásban fut. A dashboard a forrásból épülő kimenet. Az Omotenashi tananyagoldalai egy képzési csomag részei. A régi Mátra-változatok és a Halastó kiadási környezetei nem új önálló termékek. Az eredeti és az utód Halastó neve a technikai útvonalaktól eltér: ezeket nem szabad automatikusan átnevezni.

## Leltár és ellenőrzési határ

A központ felvétele előtti leltár 7 saját repót, a főágakon összesen 358 fájlt és 46 HTML-fájlt talált. Ezek pillanatfelvételi adatok, nem automatikus számlálók; az új Programtár fájljai növelik őket. Több ág biztonsági mentés vagy ugyanannak a programnak a kísérlete. A Mélyvíznek még nincs itt implementációja.

A fájlok megléte és az utolsó sikeres közzététel nem jelent teljes működési tesztet. Új linknél ellenőrizd a forrásfájlt és a publikálási útvonalat; hibás közzétételt ne jelölj működő alkalmazásnak.

## Következő rendezési szabályok

1. Új program kapjon egyértelmű nevet, forráshelyet és kanonikus indítócímet ebben a nyilvántartásban.
2. Az éles alkalmazás, sandbox, RC és archívum szerepe legyen egyértelmű; az elnevezés önmagában nem bizonyít státuszt.
3. Régi ágakat és fájlokat tömegesen ne töröljünk leltár és szükség esetén mentés nélkül. A jelen rendezés linkeket és dokumentációt rendszerez.
4. A Halastó `AGENTS.md` védelmi szabályai érvényesek; az eredeti játékhoz ez a rendezés nem nyúl.
5. A központ, a nyilvántartás és a repók README-je ugyanarra az aktuális indítócímre mutasson.
