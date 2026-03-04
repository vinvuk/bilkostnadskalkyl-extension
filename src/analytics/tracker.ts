/**
 * Anonymous PostHog tracker for the Chrome extension.
 * No PII is collected — all events share a single 'anon' distinct ID,
 * persistence is memory-only (nothing saved between sessions),
 * and IP logging is disabled server-side.
 */
import posthog from 'posthog-js';

const POSTHOG_KEY = 'phc_bxqRsVpWs3mENNvluG19JKMyt4pH5j4q6ujmLJw7nfY';
const POSTHOG_HOST = 'https://eu.i.posthog.com';

let initialized = false;

/**
 * Initializes the PostHog tracker with anonymous, memory-only config.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function initTracker(): void {
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
 * Captures an anonymous event. No-op if tracker is not initialized.
 * @param event - Event name (e.g. 'ext_overlay_shown')
 * @param properties - Optional event properties
 */
export function trackEvent(
  event: string,
  properties?: Record<string, string | number | boolean>
): void {
  if (!initialized) return;
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
