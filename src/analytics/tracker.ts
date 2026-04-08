/**
 * Anonymous event tracker for the Chrome extension.
 * Uses PostHog Capture API directly via fetch() — no SDK, no remote scripts,
 * no CSP issues in Chrome extension context.
 *
 * No PII is collected — all events share a single 'anon' distinct ID,
 * and IP logging is disabled via the $ip property.
 *
 * Analytics are gated behind explicit user consent (opt-in).
 * No network requests occur until the user consents.
 */
import { loadAnalyticsConsent } from '../storage/analyticsConsent';

const POSTHOG_KEY = 'phc_bxqRsVpWs3mENNvluG19JKMyt4pH5j4q6ujmLJw7nfY';
const POSTHOG_CAPTURE_URL = 'https://eu.i.posthog.com/capture/';
const ANON_ID_KEY = 'bkk_anon_id';

let initialized = false;
let consentGranted = false;
let anonId = 'anon';

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
async function loadOrCreateAnonId(): Promise<string> {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return 'anon';
    const result = await chrome.storage.local.get(ANON_ID_KEY);
    if (result[ANON_ID_KEY]) return result[ANON_ID_KEY];
    const id = generateAnonId();
    await chrome.storage.local.set({ [ANON_ID_KEY]: id });
    return id;
  } catch {
    return 'anon';
  }
}

/**
 * Marks the tracker as initialized and loads the anonymous ID.
 */
async function initTracker(): Promise<void> {
  if (initialized) return;
  anonId = await loadOrCreateAnonId();
  initialized = true;
}

/**
 * Reads analytics consent from storage and initializes only if opted in.
 * Safe to call multiple times — subsequent calls are no-ops if already initialized.
 */
export async function initTrackerIfConsented(): Promise<void> {
  if (initialized && consentGranted) return;
  const consent = await loadAnalyticsConsent();
  if (consent === true) {
    consentGranted = true;
    await initTracker();
  }
}

/**
 * Enables tracking immediately. Called when user opts in via consent banner or toggle.
 */
export async function enableTracker(): Promise<void> {
  consentGranted = true;
  await initTracker();
}

/**
 * Disables tracking. Called when user opts out via toggle.
 * trackEvent becomes a no-op.
 */
export function disableTracker(): void {
  consentGranted = false;
}

/**
 * Resets internal tracker state. Only exported for use in tests.
 */
export function resetTrackerState(): void {
  initialized = false;
  consentGranted = false;
  anonId = 'anon';
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
  if (!initialized || !consentGranted) return;
  try {
    const payload = {
      api_key: POSTHOG_KEY,
      event,
      properties: {
        distinct_id: anonId,
        $ip: null, // Disable IP logging
        ...properties,
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
