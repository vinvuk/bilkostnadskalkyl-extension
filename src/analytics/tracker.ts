/**
 * Anonymous event tracker for the Chrome extension.
 * Uses PostHog Capture API directly via fetch() — no SDK, no remote scripts,
 * no CSP issues in Chrome extension context.
 *
 * No direct identifiers are collected — each installation uses a random ID,
 * and IP logging is disabled via the $ip property.
 *
 * Analytics are gated behind explicit user consent (opt-in).
 * No network requests occur until the user consents.
 */
import { loadAnalyticsConsent, onAnalyticsConsentChange } from '../storage/analyticsConsent';

const POSTHOG_KEY = 'phc_bxqRsVpWs3mENNvluG19JKMyt4pH5j4q6ujmLJw7nfY';
const POSTHOG_CAPTURE_URL = 'https://eu.i.posthog.com/capture/';
const ANON_ID_KEY = 'bkk_anon_id';

let initialized = false;
let consentGranted = false;
let anonId: string | null = null;
let initialization: Promise<void> | null = null;
let consentRevision = 0;
let listening = false;

/**
 * Generates a random anonymous ID (UUID v4 format).
 * No PII — just a random string to distinguish installations.
 */
function generateAnonId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Loads or creates a persistent anonymous ID per installation.
 * Stored in chrome.storage.local — survives extension updates.
 */
async function loadOrCreateAnonId(): Promise<string | null> {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return null;
    const result = await chrome.storage.local.get(ANON_ID_KEY);
    if (result[ANON_ID_KEY]) return result[ANON_ID_KEY];
    const id = generateAnonId();
    await chrome.storage.local.set({ [ANON_ID_KEY]: id });
    return id;
  } catch {
    return null;
  }
}

/**
 * Marks the tracker as initialized and loads the anonymous ID.
 */
async function initTracker(): Promise<void> {
  if (initialized) return;
  if (!initialization) {
    initialization = loadOrCreateAnonId().then((id) => {
      anonId = id;
      initialized = id !== null;
    }).finally(() => { initialization = null; });
  }
  await initialization;
}

/**
 * Reads analytics consent from storage and initializes only if opted in.
 * Safe to call multiple times — subsequent calls are no-ops if already initialized.
 */
export async function initTrackerIfConsented(): Promise<void> {
  if (!listening) {
    listening = true;
    onAnalyticsConsentChange((granted) => {
      if (granted) void enableTracker();
      else disableTracker();
    });
  }
  if (initialized && consentGranted) return;
  const revision = consentRevision;
  const consent = await loadAnalyticsConsent();
  if (revision !== consentRevision) return;
  if (consent === true) {
    consentGranted = true;
    await initTracker();
  }
}

/**
 * Enables tracking immediately. Called when user opts in via consent banner or toggle.
 */
export async function enableTracker(): Promise<void> {
  consentRevision++;
  consentGranted = true;
  await initTracker();
}

/**
 * Disables tracking. Called when user opts out via toggle.
 * trackEvent becomes a no-op.
 */
export function disableTracker(): void {
  consentRevision++;
  consentGranted = false;
}

/**
 * Resets internal tracker state. Only exported for use in tests.
 */
export function resetTrackerState(): void {
  initialized = false;
  consentGranted = false;
  anonId = null;
  initialization = null;
  consentRevision = 0;
  listening = false;
}

/**
 * Captures an anonymous event via PostHog Capture API.
 * No-op if consent has not been granted.
 * @param event - Event name (e.g. 'ext_overlay_shown')
 * @param properties - Optional event properties
 */
export function trackEvent(
  event: string,
  properties?: Record<string, string | number | boolean>
): void {
  if (!initialized || !consentGranted || !anonId) return;
  try {
    const payload = {
      api_key: POSTHOG_KEY,
      event,
      properties: {
        ...properties,
        distinct_id: anonId,
        $ip: null, // Disable IP logging
        $geoip_disable: true,
        analytics_schema: 2,
        measurement_scope: 'consented_installations',
        source: 'extension',
        extension_version: chrome.runtime.getManifest().version,
      },
      timestamp: new Date().toISOString(),
    };

    fetch(POSTHOG_CAPTURE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true, // Ensure request completes even if page unloads
    }).catch(() => {
      // Silently ignore — never break the extension for analytics
    });
  } catch {
    // Silently ignore tracking errors — never break the extension
  }
}

/** Wait for stored consent and identity before observing the current UI. No pre-consent queue. */
export async function trackEventWhenReady(event: string, properties?: Record<string, string | number | boolean>): Promise<void> {
  const revision = consentRevision;
  await initTrackerIfConsented();
  if (revision !== consentRevision) return;
  trackEvent(event, properties);
}
