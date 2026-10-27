# Ibeline · bevegelse & balanse

En personlig, mobilvennlig treningsapp i rosa og hvitt. Frontend er bygget med HTML, CSS og JavaScript uten rammeverk og publiseres med GitHub Pages. Valgfrie pushvarslinger bruker en separat Cloudflare Worker med Durable Objects.

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

### Styrke · 45–60 minutter

Tre økter roterer i rekkefølgen A → B → C. Hver har én hovedøvelse for bein, to isolasjonsøvelser for bein, én brystøvelse, én–to ryggøvelser og tre mageøvelser. Banken inneholder 19 øvelser. A har knebøy som hovedøvelse, B hip thrust og C beinpress. Bakoverutfall er en ekstra tilleggsøvelse i C, ikke en isolasjonsøvelse. Øktene har henholdsvis 9, 8 og 10 øvelser; C er den lengste, nærmere 60 minutter. «Leg raise» betyr beinhev for mage; beinstrekk i maskin er en separat øvelse.

5–8 minutter oppvarming og 1–2 lette oppvarmingssett før hovedøvelsen. Hovedøvelsen har tre arbeidssett og 2–3 minutter pause; tilleggsøvelser har to sett og 60–90 sekunder pause. Bryst og rygg kan veksles for å spare tid. Mageøktene gjøres som to runder med tre øvelser. Tiden er et anslag, inkludert oppvarming og apparatbytte. Belastningen tilpasses slik at 2–3 repetisjoner gjenstår med god teknikk. Når øvre repetisjonsantall nås i alle settene, foreslås minste økning i vekt ved neste økt. Appen registrerer foreløpig ikke vekter.

Gjennomførte styrkeøkter før dagens dato bestemmer rotasjonen. Fremtidige forslag inkluderer planlagte styrkedager, men justeres når historikken endres. Første registrering eller eksplisitte øktvalg lagrer `workoutId`, så påbegynte økter ikke endrer øvelser. Opprinnelige seksøvelsesøkter som allerede var startet eller fullført, vises og valideres som før. Tomme, upåbegynte økter får det nye programmet. Gamle sikkerhetskopier støttes fortsatt.

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

Kjør `npm ci --prefix backend` før testene; varslingstestene bruker biblioteket `web-push`. GitHub-workflowen installerer dette automatisk.

## GitHub Pages

Workflowen `.github/workflows/pages.yml` kjører tester, bygger appen og publiserer `dist/` ved push til `main`. Velg **GitHub Actions** som kilde i repositoryets **Settings → Pages**. Alle appstier er relative og fungerer under `/ibeline-move/`.

## På telefonen

Åpne den publiserte lenken på telefonen. På iPhone: Safari → Del → Legg til på Hjem-skjerm. På Android: Chrome → menyen → Installer app / Legg til på startskjermen. Etter første besøk kan de lagrede appfilene brukes offline. Skrifttypene lastes fra Google Fonts når nett er tilgjengelig; lokale systemskrifter brukes uten nett.

## Lagring og personvern

Det er ingen brukerkonto, analyseverktøy eller synkronisering av treningshistorikk mellom enheter. Fremgangen lagres i `localStorage` under `ibeline-move-v1` på enheten og nettadressen hun bruker. Treningshistorikk lastes ikke opp til GitHub. Den publiserte appen og kildekoden er offentlig tilgjengelig. Bruk «Last ned sikkerhetskopi» under Min side før du sletter nettleserdata eller bytter enhet.

Pushvarslinger er frivillige. Ved aktivering lagres et teknisk pushabonnement, klokkeslett, tidssone og et lite utdrag av øktvalg/fullføring (i går til 14 dager frem) i en Cloudflare Durable Object. Øvelser, vekter og den øvrige historikken sendes ikke. Hver enhet identifiseres av en tilfeldig 256-bits nøkkel som bare lagres på telefonen; serveren bruker en hash av nøkkelen som lagringsnavn. Varslingsnøkkelen følger ikke med i sikkerhetskopien. Avslåing sletter serverdata og alarm, og avregistrerer abonnementet på telefonen. Ved manglende nett forsøkes sletting igjen når appen er åpen med nett. Hvis nettleserdata slettes uten at varslinger slås av først, kan serveren først rydde abonnementet når pushtjenesten melder det ugyldig.

Importer kontrolleres for gyldige datoer, tillatte øktvalg, øvelser og belønninger. Gjenoppretting viser en bekreftelse før lokal fremgang erstattes.

Serviceworker bruker nettverk først og lokale kopier uten nett. Ved større oppdateringer endres cache-versjonen i `sw.js`.

## Pushvarslinger · oppsett

Produksjon: `https://ibeline-reminders.ibeline-reminders.workers.dev`. Appen ligger fortsatt på GitHub Pages. Cloudflare-koblingen i Codex er et separat utviklingsverktøy; varslingstjenesten er ikke avhengig av at Codex er åpent.

1. Opprett en Cloudflare-konto. Fra `backend/`, kjør `npm ci` og `npx wrangler login --scopes account:read user:read workers:write`.
2. Publiser med `npm run deploy` fra `backend/`. Worker opprettes med navnet `ibeline-reminders`; den krever ingen domeneendring.
3. Fra prosjektroten: `node backend/initialize-keys.js https://<worker-url>.workers.dev`. Dette lager VAPID-nøkler én gang og sender dem direkte til Cloudflares secret-lager. Nøkler skrives ikke til disk, Git eller konsollen. Eksisterende nøkler beholdes ved senere kjøringer.
4. Sett den offentlige Worker-URL-en i `push-config.js`, bygg og publiser frontend som vanlig. Worker-URL-en er offentlig; private signeringsnøkler skal aldri inn i frontend eller repositoryet.
5. Åpne appen fra telefonens hjemskjerm → Min side → velg klokkeslett → Aktiver varslinger → tillat. På iPhone kreves iOS 16.4+. Bruk «Send et testvarsel» for å kontrollere levering på selve telefonen.

Én Durable Object per enhet lagrer preferanser og planlegger neste daglige alarm. Tiden følger telefonens tidssone, som oppdateres når appen åpnes; sommer- og vintertid håndteres. Alarmen sender bare ved en treningsøkt som ikke er registrert fullført, og søndag bare hvis løping er valgt. Fredag og andre hviledager hoppes over. Midlertidige leveringsfeil prøves igjen inntil tre ganger med ti minutters mellomrom; varsler sendes ikke mer enn to timer etter valgt tid. Push har 30 minutters TTL, og leveringen er ikke en garanti om nøyaktig klokkeslett.

Endringer synkroniseres når appen er åpen og på nett. Registreres en økt uten nett, kan tjenesten fremdeles sende den gamle påminnelsen inntil fullføringen er synkronisert. Samtidige oppdateringer sendes i rekkefølge. Pushtjenestene Apple, Google, Mozilla og Microsoft er de eneste tillatte leveringsvertene, og omdirigeringer følges ikke.

`npm run check --prefix backend` kontrollerer Cloudflare-bundlingen uten å publisere. Backend-endringer publiseres separat med `npm run deploy --prefix backend`; GitHub-workflowen publiserer bare frontend. Etter første oppsett må ende-til-ende-levering bekreftes med et testvarsel på telefonen. Browser-tester i en innfelt nettleser bekrefter ikke låseskjermlevering på iPhone.
