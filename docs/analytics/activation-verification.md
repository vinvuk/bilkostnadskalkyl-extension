# Activation verification — 25 October 2026

## What is known

- Website desktop Chrome/Edge funnel: 743 tracked identities, 70 subsequent installation-link clicks within 24 hours (28 February–25 October). This is click conversion, not installation conversion.
- Public store listing: 72 users observed 25 October. Not cumulative downloads or measured use of the calculator.
- Extension telemetry: 22 identities observed since 13 March. Tracking is opt-in, so this is a consenting sample, not the installed population.
- No shared PostHog person IDs between the website installation clicks and extension overlay events. Do not divide their totals to claim conversion.
- Production car history: 97 saved records across two accounts, latest sync 24 April. History sync also requires login and separate data-sharing consent.
- Local Chrome profile has both the unpacked and store 1.3.1 extensions enabled. It is not a clean installation test environment.

## Changes in candidate 1.3.2

- Wait for consent/identity initialization for the current rendered overlay; do not replay pre-consent events.
- On explicit banner opt-in, observe only the still-present current overlay.
- Respect consent changes in every tracker context; stale initialization must not undo opt-out.
- Drop events when identity storage fails instead of merging installations into `anon`.
- Preserve existing stored installation IDs. Initialization is shared within each JS context; simultaneous first-time ID creation across separate extension contexts remains a limitation to investigate in clean-profile QA.
- Add `analytics_schema: 2`, `measurement_scope: consented_installations`, and disable GeoIP enrichment.
- Record actual badge expansion separately from passive display.

## Measurement definitions

| Event | Meaning |
|---|---|
| ext_overlay_shown | Current UI rendered/observed with consent; `surface` distinguishes collapsed, expanded, methodology or emailGate; `observation` is render or consent_granted. Not an installation or unique advertisement count. |
| ext_overlay_expanded | User clicked the badge and reached the expanded calculator rather than the email gate. |
| ext_analytics_enabled | User explicitly enabled analytics via the overlay banner. Does not include popup toggle opt-in and must not be used as the denominator for all opt-ins. |

All new analysis must filter analytics_schema=2 and distinguish first observation from actual installation. Existing users upgrading are not new installs. Never replay pre-consent history or silently alias website and extension identities.

Use PostHog first observed overlay -> expansion within 24 hours, plus second distinct active day within 14 days. Compare only complete follow-up cohorts. Label all results “among measured consenting installations”. Do not treat the lifetime viewCount property as views captured by analytics.

## Clean-profile browser acceptance (pending)

Use a dedicated Chrome test profile without either existing copy. No account signup required. Keep analytics declined initially.

1. Install the released store version and verify one valid listing each on Blocket, Wayke and Carla. Record URL locally, version, site, badge appearance, expansion and extraction failures. Do not infer all adapter health from one site.
2. Test candidate 1.3.2 separately as an unpacked extension from dist/. Never enable both versions together.
3. Verify no PostHog requests before consent or after refusal. Grant consent while a badge is visible: current display is measured; earlier listings are not replayed.
4. Expand the badge: one ext_overlay_expanded event, no event for blocked gate/drag. Test opt-out from popup with an already-open listing.
5. Check subsequent navigation preserves the anonymous installation ID, and opening multiple first-time tabs does not split identities. Test a worker restart/update.
6. Verify version=1.3.2 and analytics_schema=2 in PostHog. Record the test identity and exclude it from product analysis. Never report synthetic API events as proof that the browser works.
7. Record network/extraction failures locally. If blocked by site CSP, route capture through the extension worker in a separately tested change.

No end-to-end browser acceptance or live event ingestion for 1.3.2 has been claimed yet. Do not publish until these checks pass.

## Store owner export request (prepared, not sent)

For extension jclbmijbjeoolinbllmajldafbfhaodo, export from Chrome Web Store Developer Dashboard -> Analytics for the entire available period through 25 October 2026:

- Installs and Uninstalls: daily CSV for both.
- Weekly Users: user counts over time, plus version and enabled/disabled breakdowns where available.
- Store impressions/visits: available report and its exact metric definition. Do not label store exposure as page visits.
- If store GA4 was already enabled, share/export acquisition and listing conversion reports for the same period. Enabling it now cannot recover past history.

Provide report timezone, date coverage and any country/OS filters. No credentials, personal user data, or account transfer needed.

## Decisions after collection

1. Reconcile aggregate daily installs and users with releases; avoid cross-source person-level conversion claims.
2. Establish first usable calculator and return rates within the consenting sample.
3. If installs exist but first-use fails, fix onboarding/adapters. If usage works but repeat/value is weak, stop feature investment pending external-user validation.
4. Website click attribution through the store remains a separate consent-aware engineering task; no such attribution is implemented in this PR.

## Wayke regression fix and installation evidence

On 25 October, official store version 1.3.1 was installed successfully in a separate signed-out Chrome profile (`Bilkostnad test`). Existing user-profile installations were left untouched.

The valid listing https://www.wayke.se/objekt/30f58e62-4334-4cd5-b2cc-eb5be1f69237 loaded, but no extension overlay appeared. The adapter required a slash after the listing identifier. Candidate 1.3.2 now accepts end-of-path or a slash after the identifier. Seven regression cases cover bare IDs, trailing slashes, slug paths, invalid suffixes, non-listing pages, and the legacy annons route.

Focused checks: 20 adapter/tracker tests passed, TypeScript passed, production build passed. Browser acceptance for the local candidate is still pending; this does not establish successful extraction or ingestion.
