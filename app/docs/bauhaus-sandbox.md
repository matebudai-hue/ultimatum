# Kreditjáték – mobilos próba

A fejlesztési ág a demo-kreditjatek-sandbox emulátorprojektet használja. A kliens a saját eredetén éri el a háttérszolgáltatásokat. A Vite proxy a helyi Auth- és Firestore-emulátornak továbbítja a klienskéréseket. Az adatbázis a repó firestore.rules fájlját használja. A tréner böngészője feldolgozza a játékosoktól beérkező parancsokat, ezért maradjon megnyitva.

## Indítás saját gépen, közös Wi-Fi-n

Node 22.12 vagy újabb és Java 21 szükséges. Az app mappában:

```sh
npm ci
npm run build
npx --yes firebase-tools@15.37.0 emulators:exec --config firebase.sandbox.json --project demo-kreditjatek-sandbox 'npm run preview -- --host 0.0.0.0 --port 4173 --strictPort'
```

A tréner a gép hálózati IP-címével nyissa meg a felületet, például http://192.168.1.20:4173/?role=trainer . Az Új játék után megjelenő QR ugyanarra a címre mutat. A résztvevők közös Wi-Fi-n beolvashatják, vagy a /?role=player oldalon beírhatják a játékkódot. A localhost címmel megnyitott tréneri oldal QR-je csak azon a gépen használható. A példában szereplő IP-címet a tréner gépének címére kell cserélni.

Ez a változat megbízható, privát teszthálózatra készült, szintetikus résztvevőkkel. Az emulátor ideiglenesen tárolja az adatokat, leállításkor elvesznek. Nyilvános internetes kiadáshoz külön felhős Firebase-projekt, Anonymous Auth és tesztelt Firestore-szabályok szükségesek.

## Ellenőrzés

```sh
npm test
npx --yes firebase-tools@15.37.0 emulators:exec --config firebase.sandbox.json --only firestore --project demo-kreditjatek-rules 'npm run test:rules'
npx playwright install --with-deps webkit
npx --yes firebase-tools@15.37.0 emulators:exec --config firebase.sandbox.json --project demo-kreditjatek-sandbox 'npm run test:iphone'
```

A KREDIT_SCREENSHOTS környezeti változóval megadott mappába a többklienses próba elmenti a nyolc mobilos jelenetet.
