/**
 * Analytics consent storage for opt-in tracking.
 * Uses chrome.storage.local — consent does not sync between devices.
 *
 * Values: true = opted in, false = opted out, null = not yet decided.
 * All three states mean no tracking — only explicit true enables it.
 */

const CONSENT_KEY = 'bkk_analytics_consent';

/**
 * Safely gets chrome.storage.local if available
 * @returns chrome.storage.local or null if not available
 */
function getLocalStorage(): chrome.storage.LocalStorageArea | null {
  try {
    if (typeof chrome === 'undefined') return null;
    if (!chrome.storage) return null;
    if (!chrome.storage.local) return null;
    if (typeof chrome.storage.local.get !== 'function') return null;
    return chrome.storage.local;
  } catch {
    return null;
  }
}

/**
 * Loads the current analytics consent state.
 * @returns true if opted in, false if opted out, null if not yet decided
 */
export async function loadAnalyticsConsent(): Promise<boolean | null> {
  try {
    const storage = getLocalStorage();
    if (!storage) return null;
    const result = await storage.get(CONSENT_KEY);
    const value = result[CONSENT_KEY];
    if (value === true || value === false) return value;
    return null;
  } catch (error) {
    console.error('[Bilkostnadskalkyl] Failed to load analytics consent:', error);
    return null;
  }
}

/**
 * Saves the analytics consent choice.
 * @param granted - true to opt in, false to opt out
 */
export async function saveAnalyticsConsent(granted: boolean): Promise<void> {
  try {
    const storage = getLocalStorage();
    if (!storage) return;
    await storage.set({ [CONSENT_KEY]: granted });
  } catch (error) {
    console.error('[Bilkostnadskalkyl] Failed to save analytics consent:', error);
  }
}

/**
 * Listens for analytics consent changes from other contexts (popup, background, content script).
 * @param callback - Called with the new consent value when it changes
 */
export function onAnalyticsConsentChange(
  callback: (granted: boolean) => void
): void {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.onChanged) return;
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes[CONSENT_KEY]) {
        const newValue = changes[CONSENT_KEY].newValue;
        if (newValue === true || newValue === false) {
          callback(newValue);
        }
      }
    });
  } catch (error) {
    console.warn('[Bilkostnadskalkyl] Could not set up analytics consent listener:', error);
  }
}
