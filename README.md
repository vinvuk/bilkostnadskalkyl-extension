# Bilkostnadskalkyl Chrome Extension

Chrome-tillagg som visar totalkostnaden direkt pa bilannonser fran svenska bilsajter.

## Funktioner

- **Automatisk kostnadsberakning** — Ser direkt vad bilen kostar per manad
- **Stod for flera sajter** — Blocket, Wayke och Carla
- **Detaljerad kostnadsfordelning** — Bransle, vardeminskning, skatt, underhall, dack, forsakring, parkering, tvatt & skotsel och finansiering
- **Aldersbaserad vardeminskning** — Kurva justerad for bilens alder, bransletyp och anvandarens val (Lag/Normal/Hog)
- **Finansieringsberakning** — Kontant, restvardelslan, annuitetslan och leasing (privat/foretag)
- **PDF-export** — Exportera kostnadssammanstallning med bilbild till PDF
- **Historik** — Spara och jamfor tidigare visade bilar
- **Automatisk dataextraktion** — Pris, bransletyp, fordonsskatt, registreringsnummer och effektiv ranta
- **Konto & inloggning** — Magic link-autentisering via dinbilkostnad.se med saker token exchange
- **Datadelning** — Valfri synk av bilvisningar till molnet med GDPR-samtycke

## Sajter som stods

| Sajt | URL |
|------|-----|
| Blocket | blocket.se/annons/* |
| Wayke | wayke.se/* |
| Carla | carla.se/* |

## Installation

### Utveckling

```bash
# Installera dependencies
npm install

# Bygg for utveckling (med watch)
npm run dev

# Bygg for produktion
npm run build
```

### Ladda tillaget i Chrome

1. Oppna `chrome://extensions/`
2. Aktivera "Utvecklarlage"
3. Klicka "Ladda uppackad"
4. Valj `dist`-mappen

## Projektstruktur

```
src/
├── adapters/       # Sajt-specifika datautdragare
│   ├── blocket.ts
│   ├── carla.ts
│   └── wayke.ts
├── background/     # Service worker (auth callback, consent sync)
├── content/        # Content script entrypoint
├── core/           # Berakningslogik och konstanter
│   ├── calculator.ts
│   ├── calculator.test.ts
│   ├── constants.ts
│   └── fuelDetection.test.ts
├── overlay/        # UI-overlay som visas pa sidor
├── panel/          # Detaljpanel med alla kostnader
├── popup/          # Extension popup (Om, Historik, Konto)
│   ├── popup.ts
│   ├── popup.html
│   └── popup.css
├── storage/        # Chrome storage hantering
│   ├── auth.ts         # Autentisering + fetchWithTimeout
│   ├── emailGate.ts    # Email gate (magic link-initiering)
│   ├── history.ts      # Visningshistorik
│   └── preferences.ts  # Anvandarprefenser
└── types/          # TypeScript typedefinitioner
```

## Autentisering

Tillaget stoder inloggning via dinbilkostnad.se med magic link:

1. Anvandaren anger e-post i popup → magic link skickas
2. Anvandaren klickar lanken → dinbilkostnad.se genererar en **exchange code**
3. Anvandaren omdirigeras till `/auth/extension-callback?code=xxx`
4. Background script fangar URL:en, POSTar koden till `/api/auth/exchange`
5. Servern returnerar session-token → sparas i `chrome.storage.local`

Exchange code-flodet sakerstarler att session-tokens aldrig exponeras i URL:er, webbhistorik eller serverloggar.

### Sakerhet

- **Scoped permissions** — `host_permissions` begransade till blocket.se, wayke.se, carla.se och dinbilkostnad.se
- **Exakt URL-matchning** — Callback-URL valideras med exakt `pathname`-kontroll, inte `startsWith`
- **Request timeouts** — Alla fetch-anrop anvander `fetchWithTimeout` (8s default) via AbortController
- **authenticatedFetch** — Popup och background script anvander gemensam auth-wrapper
- **web_accessible_resources** — Begransade till enbart bilsajterna, inte `<all_urls>`

## Kostnadsberakning

Kalkylatorn raknar ut foljande kostnader:

### Rorliga kostnader
- **Bransle** — Baserat pa forbrukning, bransletyp och arlig korstracka. Laddhybrider viktas mellan bensin och el.
- **Underhall** — Skalat efter biltyp (enkel/normal/stor/lyx), underhallsniva och korstracka
- **Dack** — Baserat pa biltyp och dacklivslangd (~60 000 km)

### Fasta kostnader
- **Vardeminskning** — Aldersbaserad kurva (25%→15%→10%→6%→4%) justerad med bransletypsfaktor och anvandarens val
- **Skatt** — Fordonsskatt (extraheras automatiskt fran annonser) med stod for malusskatt
- **Forsakring** — Manatlig kostnad
- **Parkering** — Manatlig kostnad
- **Tvatt & skotsel** — Manatlig kostnad
- **Finansiering** — Lanebetalning eller leasingavgift

### Vardeminskning

Modellen bygger pa tre faktorer:

1. **Alderskurva** — Arlig vardeminskning baserad pa bilens alder:
   | Alder | Takt |
   |-------|------|
   | 0-1 ar | 25% |
   | 1-3 ar | 15% |
   | 3-5 ar | 10% |
   | 5-8 ar | 6% |
   | 8+ ar | 4% |

2. **Bransletypsfaktor** — Justerar baserat pa drivmedel (bensin x0,75, diesel x1,0, el x1,25 m.fl.)

3. **Anvandarjustering** — Lag (x0,75), Normal (x1,0), Hog (x1,3)

### Finansieringsalternativ

**Kontant** — Ingen finansieringskostnad

**Restvardelslan**
- Lagre manatliga betalningar
- Restvarde betalas vid periodens slut
- Kontantinsats minimum 20%

**Annuitetslan**
- Fullstandig avbetalning under laneperioden
- Fast manatlig betalning
- Kontantinsats minimum 20%

**Leasing** (privat/foretag)
- Manuellt angiven manadsavgift

*Obs: Administrativ avgift ar inkluderad i den effektiva rantan.*

## Drivmedelstyper

- Bensin
- Diesel
- El
- Laddhybrid (dubbla branslen)
- Hybrid/Elhybrid
- E85/Etanol
- Biogas

## Skript

| Kommando | Beskrivning |
|----------|-------------|
| `npm run dev` | Bygg med watch for utveckling |
| `npm run build` | Bygg for produktion |
| `npm run clean` | Ta bort dist-mappen |
| `npm run test` | Kor tester |
| `npm run test:watch` | Kor tester med watch |

## Teknisk stack

- TypeScript
- Webpack
- Chrome Extension Manifest V3
- Vitest for testning

## Versionshistorik

### v1.2.5
- **Nytt:** Konto-flik i popup — inloggning, utloggning, e-postvisning
- **Nytt:** Datadelnings-toggle med GDPR-samtycke i popup
- **Nytt:** `fetchWithTimeout` utility (8s default) med AbortController
- **Nytt:** `authenticatedFetch` wrapper for API-anrop
- **Sakerhet:** `host_permissions` begransade fran `<all_urls>` till enbart bilsajter + dinbilkostnad.se
- **Sakerhet:** `web_accessible_resources` begransade till enbart bilsajter
- **Sakerhet:** Callback-URL valideras med exakt pathname-kontroll
- **Sakerhet:** Exchange code-flode — session-tokens skickas aldrig i URL:er
- **Fix:** Popup anvander `authenticatedFetch` istallet for ra `fetch`
- **Fix:** Consent-toggle atergar vid fel och inaktiveras under synk
- Borttagen: Keep-alive alarm (onodigt med MV3 event-driven service workers)
- Borttagen: `alarms`-permission

### v1.2.4
- **Nytt:** Aldersbaserad vardeminskning med bransletypsjustering (ersatter statisk 3-nivamodell)
- **Nytt:** Dropdown for vardeminskningtakt (Lag/Normal/Hog) med info-tooltip
- **Nytt:** Tvatt & skotsel som kostnadskategori
- **Nytt:** Leasing-stod (privatleasing/foretagsleasing)
- **Nytt:** Malusskatt-toggle med manuellt belopp
- **Nytt:** Email gate-system med visningsraknare
- **Nytt:** Automatisk extraktion av fordonsskatt, registreringsnummer och effektiv ranta
- **Nytt:** Content scripts aterinjiceras vid installation/uppdatering
- **Nytt:** Uppdaterad metodiksida ("Sa har raknar vi") med fullstandig modellbeskrivning
- **Fix:** Forbattrad elbilsdetektering — korrekt enhet (kr/kWh) visas nu
- Borttagen: "Forsakring ingar i leasingavgiften"-checkbox

### v1.2.3
- Minimum kontantinsats satt till 20%
- Administrativ avgift borttagen (inkluderad i effektiv ranta)
- Bilbild laggs till i PDF-export
- Bildextraktion for alla stodda sajter

## Licens

Proprietar - Alla rattigheter forbehallna.
