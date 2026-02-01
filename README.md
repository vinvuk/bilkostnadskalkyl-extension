# Bilkostnadskalkyl Chrome Extension

Chrome-tillägg som visar totalkostnaden direkt på bilannonser från svenska bilsajter.

## Funktioner

- **Automatisk kostnadsberäkning** — Ser direkt vad bilen kostar per månad
- **Stöd för flera sajter** — Blocket, Wayke och Carla
- **Detaljerad kostnadsfördelning** — Bränsle, värdeminskning, skatt, underhåll, däck, försäkring, parkering, tvätt & skötsel och finansiering
- **Åldersbaserad värdeminskning** — Kurva justerad för bilens ålder, bränsletyp och användarens val (Låg/Normal/Hög)
- **Finansieringsberäkning** — Kontant, restvärdelån, annuitetslån och leasing (privat/företag)
- **PDF-export** — Exportera kostnadssammanställning med bilbild till PDF
- **Historik** — Spara och jämför tidigare visade bilar
- **Automatisk dataextraktion** — Pris, bränsletyp, fordonsskatt, registreringsnummer och effektiv ränta

## Sajter som stöds

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

# Bygg för utveckling (med watch)
npm run dev

# Bygg för produktion
npm run build
```

### Ladda tillägget i Chrome

1. Öppna `chrome://extensions/`
2. Aktivera "Utvecklarläge"
3. Klicka "Ladda uppackad"
4. Välj `dist`-mappen

## Projektstruktur

```
src/
├── adapters/       # Sajt-specifika datautdragare
│   ├── blocket.ts
│   ├── carla.ts
│   └── wayke.ts
├── background/     # Service worker
├── content/        # Content script entrypoint
├── core/           # Beräkningslogik och konstanter
│   ├── calculator.ts
│   ├── calculator.test.ts
│   ├── constants.ts
│   └── fuelDetection.test.ts
├── overlay/        # UI-overlay som visas på sidor
├── panel/          # DevTools panel
├── popup/          # Extension popup
├── storage/        # Chrome storage hantering
│   ├── emailGate.ts
│   ├── history.ts
│   └── preferences.ts
└── types/          # TypeScript typedefinitioner
```

## Kostnadsberäkning

Kalkylatorn räknar ut följande kostnader:

### Rörliga kostnader
- **Bränsle** — Baserat på förbrukning, bränsletyp och årlig körsträcka. Laddhybrider viktas mellan bensin och el.
- **Underhåll** — Skalat efter biltyp (enkel/normal/stor/lyx), underhållsnivå och körsträcka
- **Däck** — Baserat på biltyp och däcklivslängd (~60 000 km)

### Fasta kostnader
- **Värdeminskning** — Åldersbaserad kurva (25%→15%→10%→6%→4%) justerad med bränsletypsfaktor och användarens val
- **Skatt** — Fordonsskatt (extraheras automatiskt från annonser) med stöd för malusskatt
- **Försäkring** — Månatlig kostnad
- **Parkering** — Månatlig kostnad
- **Tvätt & skötsel** — Månatlig kostnad
- **Finansiering** — Lånebetalning eller leasingavgift

### Värdeminskning

Modellen bygger på tre faktorer:

1. **Ålderskurva** — Årlig värdeminskning baserad på bilens ålder:
   | Ålder | Takt |
   |-------|------|
   | 0–1 år | 25% |
   | 1–3 år | 15% |
   | 3–5 år | 10% |
   | 5–8 år | 6% |
   | 8+ år | 4% |

2. **Bränsletypsfaktor** — Justerar baserat på drivmedel (bensin ×0,75, diesel ×1,0, el ×1,25 m.fl.)

3. **Användarjustering** — Låg (×0,75), Normal (×1,0), Hög (×1,3)

### Finansieringsalternativ

**Kontant** — Ingen finansieringskostnad

**Restvärdelån**
- Lägre månatliga betalningar
- Restvärde betalas vid periodens slut
- Kontantinsats minimum 20%

**Annuitetslån**
- Fullständig avbetalning under låneperioden
- Fast månatlig betalning
- Kontantinsats minimum 20%

**Leasing** (privat/företag)
- Manuellt angiven månadsavgift

*Obs: Administrativ avgift är inkluderad i den effektiva räntan.*

## Drivmedelstyper

- Bensin
- Diesel
- El
- Laddhybrid (dubbla bränslen)
- Hybrid/Elhybrid
- E85/Etanol
- Biogas

## Skript

| Kommando | Beskrivning |
|----------|-------------|
| `npm run dev` | Bygg med watch för utveckling |
| `npm run build` | Bygg för produktion |
| `npm run clean` | Ta bort dist-mappen |
| `npm run test` | Kör tester |
| `npm run test:watch` | Kör tester med watch |

## Teknisk stack

- TypeScript
- Webpack
- Chrome Extension Manifest V3
- Vitest för testning

## Versionshistorik

### v1.2.4
- **Nytt:** Åldersbaserad värdeminskning med bränsletypsjustering (ersätter statisk 3-nivåmodell)
- **Nytt:** Dropdown för värdeminskningstakt (Låg/Normal/Hög) med info-tooltip
- **Nytt:** Tvätt & skötsel som kostnadskategori
- **Nytt:** Leasing-stöd (privatleasing/företagsleasing)
- **Nytt:** Malusskatt-toggle med manuellt belopp
- **Nytt:** Email gate-system med visningsräknare
- **Nytt:** Automatisk extraktion av fordonsskatt, registreringsnummer och effektiv ränta
- **Nytt:** Content scripts återinjiceras vid installation/uppdatering
- **Nytt:** Uppdaterad metodiksida ("Så här räknar vi") med fullständig modellbeskrivning
- **Fix:** Service worker keep-alive för att förhindra att extension avaktiveras
- **Fix:** Förbättrad elbilsdetektering — korrekt enhet (kr/kWh) visas nu
- Borttagen: "Försäkring ingår i leasingavgiften"-checkbox

### v1.2.3
- Minimum kontantinsats satt till 20%
- Administrativ avgift borttagen (inkluderad i effektiv ränta)
- Bilbild läggs till i PDF-export
- Bildextraktion för alla stödda sajter

## Licens

Proprietär - Alla rättigheter förbehållna.
