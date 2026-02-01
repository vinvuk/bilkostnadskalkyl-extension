# Källor och beräkningsunderlag

Dokumentation över källor för beräkningarna i Bilkostnadskalkyl.

---

## Värdeminskning

### Modell (v1.2.4)

Åldersbaserad kurva justerad med bränsletyp och användarval:

**Faktor 1 — Ålderskurva:**

| Bilens ålder | Årlig takt |
|--------------|------------|
| 0–1 år | 25% |
| 1–3 år | 15% |
| 3–5 år | 10% |
| 5–8 år | 6% |
| 8+ år | 4% |

**Faktor 2 — Bränsletypsmultiplikator:**

| Bränsle | Faktor | Motivering |
|---------|--------|------------|
| Bensin | ×0,75 | Håller värdet bäst (stor andrahandsmarknad) |
| Hybrid | ×0,80 | Nära bensin |
| Laddhybrid | ×0,90 | Viss teknikrisk |
| Diesel | ×1,00 | Referensvärde |
| HVO | ×1,00 | Som diesel |
| El | ×1,25 | Snabb teknikutveckling, batterioro |
| E85 | ×1,10 | Liten marknad |
| Biogas/CNG | ×1,10 | Liten marknad |

**Faktor 3 — Användarjustering:**

| Val | Faktor | Användning |
|-----|--------|------------|
| Låg | ×0,75 | Populära modeller (Toyota, Volvo) |
| Normal | ×1,00 | Standardantagande |
| Hög | ×1,30 | Lyxbilar, ovanliga modeller |

**Formel:** `effektiv takt = ålderskurva × bränslemultiplikator × användarjustering`

### Källor

| Källa | Typ | Länk |
|-------|-----|------|
| **M Sverige (Riksförbundet)** | Motororganisation | [msverige.se](https://msverige.se/allt-om-bilen/vad-kostar-det-att-ha-bil/sa-har-vi-raknat/) |
| **KVD/Bilpriser** | Branschdata (15 000+ modeller) | [kvd.se](https://www.kvd.se/ovriga-tjanster/bilvardering) |
| **Bilpriser.se** | Verklig värdeminskning per modell | [bilpriser.se](https://www.bilpriser.se) |
| **Carup.se** | Genomsnittlig värdeminskning per biltyp | [carup.se](https://www.carup.se) |
| **Testfakta** | Oberoende test | [testfakta.se](https://www.testfakta.se/sv/motor/article/exempel-pa-milkostnader-tre-av-sveriges-vanligaste-bilar) |
| **CARFAX** | Internationell fordonsdata | [carfax.eu](https://www.carfax.eu/sv/blog/vardeminskning-bil) |

### Branschkonsensus (2025–2026)

- **Nya bilar:** 20–30% första året, sedan 10–15% per år
- **Begagnade bilar (3+ år):** ~6–10% per år
- **Elbilar:** 37–55% över 3 år (snabb teknikutveckling)
- **Bensinbilar:** 7–25% över 3 år (bäst värdehållning)
- **Toyota/Volvo:** Håller sig i underkant av respektive kategori

---

## Bränslepriser

Standardpriser uppdaterade 2025:

| Bränsle | Pris | Källa |
|---------|------|-------|
| Bensin | 18,50 kr/l | Genomsnitt Sverige |
| Diesel | 19,50 kr/l | Genomsnitt Sverige |
| El | 2,50 kr/kWh | Hushållsel snitt |
| HVO | 25,00 kr/l | Premiumdiesel |
| E85 | 14,50 kr/l | Genomsnitt |

---

## Fordonsskatt

Baserat på Transportstyrelsens uppgifter:
- [transportstyrelsen.se](https://www.transportstyrelsen.se/)

---

## Underhållskostnader

Uppskattningar baserade på:
- Verkstadspriser Sverige
- Märkesspecifika serviceintervall
- Bilprovningen statistik

---

## Officiell statistik

| Myndighet | Data | Länk |
|-----------|------|------|
| **Trafikanalys** | Fordonsstatistik, körsträckor | [trafa.se](https://www.trafa.se/vagtrafik/fordon/) |
| **Transportstyrelsen** | Fordonsregister, skatt | [transportstyrelsen.se](https://www.transportstyrelsen.se/sv/om-oss/statistik-och-analys/) |
| **SCB** | Fordonsbestånd | [scb.se](https://www.scb.se/hitta-statistik/statistik-efter-amne/transporter-och-kommunikationer/vagtrafik/fordon/) |

---

## Feature-förslag från användare

### Ränteförlust / Alternativkostnad
**Status:** Ej implementerat
**Källa:** Användarfeedback (RikaTillsammans forum)

> "Du har glömt 'ränteförlust', 2-3% idag. Kostar bilen 300k, så har du en förlust på 6-9k netto"

**Beräkning:**
- Kontantinsats × förväntad avkastning = årlig ränteförlust
- Exempel: 300 000 kr × 3% = 9 000 kr/år (750 kr/mån)

**Implementation:** Kan läggas till som valfri "avancerad" kostnad för kontantköpare.

---

*Senast uppdaterad: 2026-02-01*
