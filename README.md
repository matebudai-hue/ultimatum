# Budai Máté – programok és tanulási felületek

**Közös indítóoldal:** https://matebudai-hue.github.io/ultimatum/kozpont/

A teljes programjegyzék, fejlesztési címekkel és karbantartási szabályokkal: [PROGRAMTAR.md](PROGRAMTAR.md).

## Ebben a repóban

| Program | Forrás | Online |
|---|---|---|
| Programtár | `kozpont/index.html` | https://matebudai-hue.github.io/ultimatum/kozpont/ |
| Kreditjáték | `app/`; publikált build: `dashboard/` | https://matebudai-hue.github.io/ultimatum/dashboard/ |
| Explorer / Kikötő | `explorer/` | https://matebudai-hue.github.io/ultimatum/explorer/ |
| Toyota Omotenashi | `omotenashi/` | https://matebudai-hue.github.io/ultimatum/omotenashi/ |
| Toyota megfigyelő és pontozó | `toyota/` | https://matebudai-hue.github.io/ultimatum/toyota/ |
| Matek-sziget | `matek/` | https://matebudai-hue.github.io/ultimatum/matek/ |
| Autós Bajnokok Ligája | `autos-bajnokok-ligaja` ág, `games/autos-bajnokok-ligaja/` | https://autos-bajnokok-ligaja.mbudai.chatgpt.site |

A repó gyökércíme továbbra is a Kreditjátékhoz irányít. A Programtár külön útvonalat kapott, ezért a korábbi belépők változatlanok. A programok adatmentése és jogosultsága alkalmazásonként eltér; az indítóoldal nem egyesíti az adatokat vagy a belépéseket.

## Karbantartás

- Új vagy átnevezett program esetén frissítsd a `kozpont/index.html` kártyáját és a `PROGRAMTAR.md` nyilvántartását.
- Útvonalat, régi belépőt, QR-címet, localStorage-kulcsot vagy szolgáltatási beállítást csak külön megtervezett átállással változtass.
- A `dashboard/` a Kreditjáték buildelt kimenete; a forrás az `app/`. Ne kezeld két önálló programként.
- A Programtár build nélküli statikus HTML/CSS/JavaScript. Nincs függőség, követő, távoli betűtípus vagy résztvevői adatmentés.
- A repó dokumentációja a meglévő GitHub Pages-közzétételt használja. Az egyes alkalmazások tesztfolyamatai külön élnek.

Utolsó leltár: 2026. október 25. A programjegyzék nem jelent teljes funkcionális auditot.
