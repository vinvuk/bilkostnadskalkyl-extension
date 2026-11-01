# Web calculator handoff (1.3.3 candidate)

Button in expanded overlay: Öppna i webbkalkylen. Transfers original advert data, not user-modified price or financing preferences. Website computes a cash estimate with its own defaults and explicitly explains the difference. Unsupported fuels/incomplete fields are handled by the receiver.

Versioned fragment payload contains only source site/clean advert URL/name/price/year/fuel/consumption/estimated flag and random per-click UUID. No VIN/registration, photo, seller, person ID or preferences. Fragment is not sent in HTTP requests; receiver validates it, removes it with replaceState before PostHog init, masks imported DOM, and additionally redacts fragments from analytics properties. No persistent transfer storage. Refresh intentionally loses the imported state after the fragment has been cleared.

Consent-gated ext_web_calculator_clicked contains site, handoff_id and handoff_version. Web captures web_handoff_received/web_handoff_calculated with that UUID, only while current transferred state is visible and web consent is granted. These correlate actions without merging extension and web identities. Click does not prove successful navigation; use the receiver event for arrival.

Release ordering: merge/publish landing PR #7, then #8 before publishing extension 1.3.3. Production build defaults to dinbilkostnad.se. A separate dist-handoff-test build uses an explicit preview destination via BKK_WEB_CALCULATOR_URL; never upload that test build to Chrome Web Store. Permissions remain unchanged.
