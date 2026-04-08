/**
 * Anonymous PostHog tracker for the Chrome extension.
 * No PII is collected — all events share a single 'anon' distinct ID,
 * persistence is memory-only (nothing saved between sessions),
 * and IP logging is disabled server-side.
 *
 * Analytics are gated behind explicit user consent (opt-in).
 * No PostHog initialization or network requests occur until the user consents.
 */
import posthog from 'posthog-js';
import { loadAnalyticsConsent } from '../storage/analyticsConsent';

const POSTHOG_KEY = 'phc_bxqRsVpWs3mENNvluG19JKMyt4pH5j4q6ujmLJw7nfY';
const POSTHOG_HOST = 'https://eu.i.posthog.com';

let initialized = false;
let consentGranted = false;

/**
 * Initializes PostHog internally. Only called when consent is confirmed.
 */
function initPostHog(): void {
  if (initialized) return;
  try {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      persistence: 'memory',
      ip: false,
      disable_session_recording: true,
      disable_surveys: true,
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      bootstrap: { distinctID: 'anon' },
    });
    initialized = true;
  } catch (error) {
    console.warn('[Bilkostnadskalkyl] Failed to init tracker:', error);
  }
}

/**
 * Reads analytics consent from storage and initializes PostHog only if opted in.
 * Safe to call multiple times — subsequent calls are no-ops if already initialized.
 */
export async function initTrackerIfConsented(): Promise<void> {
  if (initialized && consentGranted) return;
  const consent = await loadAnalyticsConsent();
  if (consent === true) {
    consentGranted = true;
    initPostHog();
  }
}

/**
 * Enables tracking immediately. Called when user opts in via consent banner or toggle.
 */
export function enableTracker(): void {
  consentGranted = true;
  initPostHog();
}

/**
 * Disables tracking. Called when user opts out via toggle.
 * PostHog SDK stays in memory but trackEvent becomes a no-op.
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
}

/**
 * Captures an anonymous event. No-op if consent has not been granted.
 * @param event - Event name (e.g. 'ext_overlay_shown')
 * @param properties - Optional event properties
 */
export function trackEvent(
  event: string,
  properties?: Record<string, string | number | boolean>
): void {
  if (!initialized || !consentGranted) return;
  try {
    posthog.capture(event, {
      ...properties,
      source: 'extension',
      extension_version: chrome.runtime.getManifest().version,
    });
  } catch {
    // Silently ignore tracking errors — never break the extension
  }
}
