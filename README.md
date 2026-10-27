# Ibeline · bevegelse & balanse

En personlig, mobilvennlig treningsapp i rosa og hvitt. Bygget med HTML, CSS og JavaScript, uten rammeverk, pakkedependencies eller server. Publiseres med GitHub Pages.

## Funksjoner

- Dagens økt, ukesoversikt og månedskalender.
- Styrkeøvelser som krysses av og strykes ut underveis. Fullføringsknappen blir tilgjengelig når alle øvelsene er krysset av.
- Valg mellom økter torsdag, lørdag og søndag. Fremtidige økter kan planlegges, men ikke registreres som gjennomført.
- Streak for planlagte økter, ukesmål og belønninger ved 1, 5, 10, 20 og 40 fullførte økter.
- Lokal lagring, eksport/import av sikkerhetskopier og offline-støtte.
- Hjemskjermikon for iPhone og Android.

## Ukeplan

| Dag | Plan |
| --- | --- |
| Mandag | Ballett |
| Tirsdag | Gåtur |
| Onsdag | Styrke |
| Torsdag | Ballett som standard, styrke som alternativ |
| Fredag | Hvile |
| Lørdag | Løping eller styrke |
| Søndag | Løping eller fri, valgfritt |

Anbefalingen ser på **gjennomført** økt dagen før. Etter løping anbefales styrke hvis dagens valg inkluderer styrke. Søndag etter løping lørdag anbefales hvile, fordi styrke ikke inngår i søndagsplanen. Torsdag er ballett førstevalget. Egne valg overstyrer anbefalingen. Det er en enkel regelbasert planlegger, ikke en individuell treningsfaglig vurdering.

Streaken teller gjennomførte planlagte økter på rad fra første bruksdag. Fredag og valgfri søndag bryter ikke streaken. En manglende planlagt økt bryter streaken ved dagens slutt. Søndagsøkter teller mot belønninger, men ikke mot ukens fem planlagte økter eller streaken. Hvile gir ikke poeng. Datoer følger telefonens lokale tid.

Styrkeopplegget og belønningsforslagene er utgangspunkter som kan endres i `planner.js`.

## Kjør lokalt

Krever Node.js 22+ for tester/bygg og Python 3 for lokal server.

```sh
npm run dev
```

Åpne http://127.0.0.1:4173. Appen kan også serveres med en annen statisk HTTP-server. Direkte åpning av `index.html` via `file://` støttes ikke på grunn av JavaScript-moduler.

```sh
npm test
npm run build
```

`dist/` inneholder alle filer som skal publiseres. `tests/responsive.html` er en lokal testside med en 390 piksler bred mobilramme og blir ikke publisert.

## GitHub Pages

Workflowen `.github/workflows/pages.yml` kjører tester, bygger appen og publiserer `dist/` ved push til `main`. Velg **GitHub Actions** som kilde i repositoryets **Settings → Pages**. Alle appstier er relative og fungerer under `/ibeline-move/`.

## På telefonen

Åpne den publiserte lenken på telefonen. På iPhone: Safari → Del → Legg til på Hjem-skjerm. På Android: Chrome → menyen → Installer app / Legg til på startskjermen. Etter første besøk kan de lagrede appfilene brukes offline. Skrifttypene lastes fra Google Fonts når nett er tilgjengelig; lokale systemskrifter brukes uten nett.

## Lagring og personvern

Det er ingen konto, database, analyseverktøy eller synkronisering mellom enheter. Fremgangen lagres i `localStorage` under `ibeline-move-v1` på enheten og nettadressen hun bruker. Treningshistorikk lastes ikke opp til GitHub. Den publiserte appen og kildekoden er offentlig tilgjengelig. Bruk «Last ned sikkerhetskopi» under Min side før du sletter nettleserdata eller bytter enhet.

Importer kontrolleres for gyldige datoer, tillatte øktvalg, øvelser og belønninger. Gjenoppretting viser en bekreftelse før lokal fremgang erstattes.

Serviceworker bruker nettverk først og lokale kopier uten nett. Ved større oppdateringer endres cache-versjonen i `sw.js`.
