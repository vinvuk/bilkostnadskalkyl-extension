/**
 * Background service worker for Bilkostnadskalkyl extension
 * Handles extension icon clicks, injects the info panel overlay,
 * and monitors for auth callback from the landing page.
 */
import { saveAuthState, clearAuthState, authenticatedFetch, fetchWithTimeout } from '../storage/auth';
import { saveEmailGateState } from '../storage/emailGate';
import { syncHistory } from '../storage/syncManager';
import { initTrackerIfConsented, enableTracker, disableTracker, trackEvent } from '../analytics/tracker';
import { onAnalyticsConsentChange } from '../storage/analyticsConsent';

// Initialize tracker only if user has previously consented
initTrackerIfConsented();

// React to consent changes from popup or content script
onAnalyticsConsentChange((granted) => {
  if (granted) {
    enableTracker();
  } else {
    disableTracker();
  }
});

/**
 * Log extension install/update events.
 * We intentionally do NOT re-inject content scripts here — doing so creates
 * a second webpack runtime with its own module scope, causing duplicate overlays.
 * The manifest content_scripts declaration handles injection on page navigation.
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Bilkostnadskalkyl BG] Extension installed/updated:', details.reason);
});

/**
 * Periodic sync alarm — retries unsynced car views every 30 minutes.
 * Handles cases where individual sync attempts failed (network, rate limit).
 */
chrome.alarms.create('syncCarViews', { periodInMinutes: 30 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'syncCarViews') {
    syncHistory().catch(() => {});
  }
});

/**
 * Handles extension icon click - injects or toggles the info panel
 */
chrome.action.onClicked.addListener(async (tab) => {
  console.log('[Bilkostnadskalkyl BG] Icon clicked, tab:', tab.id, tab.url);

  if (!tab.id || !tab.url) {
    console.log('[Bilkostnadskalkyl BG] No tab id or url');
    return;
  }

  // Don't run on chrome:// or other restricted pages
  if (tab.url.startsWith('chrome://') ||
      tab.url.startsWith('chrome-extension://') ||
      tab.url.startsWith('about:')) {
    console.log('[Bilkostnadskalkyl BG] Cannot inject on restricted page');
    return;
  }

  try {
    // Always inject the panel script directly
    // The panel script itself handles toggle logic (creates or removes panel)
    console.log('[Bilkostnadskalkyl BG] Injecting panel script...');
    await injectPanelScript(tab.id);
    console.log('[Bilkostnadskalkyl BG] Panel script injected successfully');
  } catch (error) {
    console.error('[Bilkostnadskalkyl BG] Error handling icon click:', error);
  }
});

/**
 * Injects the info panel script into the page
 * @param tabId - ID of the tab to inject into
 */
async function injectPanelScript(tabId: number): Promise<void> {
  try {
    // Inject CSS first
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['panel/panel.css']
    });

    // Then inject the script
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['panel/panel.js']
    });
  } catch (error) {
    console.error('[Bilkostnadskalkyl] Failed to inject panel:', error);
  }
}

/**
 * Monitor tabs for the extension auth callback URL.
 * When the user completes the magic link flow, this detects the callback page,
 * extracts the exchange code, exchanges it for a session token via POST, and stores it.
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;

  try {
    const url = new URL(tab.url);
    // Exact pathname match to prevent spoofing
    if (url.origin !== 'https://dinbilkostnad.se' || url.pathname !== '/auth/extension-callback') {
      return;
    }

    const code = url.searchParams.get('code');
    if (!code) return;

    // Exchange the code for a session token via secure POST
    const res = await fetchWithTimeout('https://dinbilkostnad.se/api/auth/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    if (res.ok) {
      const data = await res.json();
      await saveAuthState({
        token: data.token,
        email: data.email,
        userId: data.userId,
        authenticatedAt: Date.now(),
      });
      await saveEmailGateState({
        isUnlocked: true,
        email: data.email,
        unlockedAt: Date.now(),
      });

      // Track successful authentication
      trackEvent('ext_auth_completed');

      // Close the callback tab
      chrome.tabs.remove(tabId);

      // Notify any open popups that auth is complete
      chrome.runtime.sendMessage({ action: 'authCompleted', user: data }).catch(() => {});

      // Trigger initial sync of any existing unsynced history
      syncHistory().catch(() => {});
    }
  } catch (error) {
    console.error('[Bilkostnadskalkyl BG] Auth callback error:', error);
  }
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getHistory') {
    // Forward history request
    chrome.storage.local.get(['bkk_history'], (result) => {
      sendResponse(result.bkk_history || []);
    });
    return true; // Keep channel open for async response
  }

  if (message.action === 'syncConsent') {
    // Sync a consent decision to the backend
    authenticatedFetch('/api/consent', {
      method: 'PUT',
      body: JSON.stringify({
        consentType: message.consentType,
        granted: message.granted,
        source: 'extension',
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        // If data_sharing was just granted, trigger a car view sync
        if (message.consentType === 'data_sharing' && message.granted) {
          syncHistory().catch(() => {});
        }
        sendResponse({ success: true, data });
      })
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // async
  }

  if (message.action === 'syncCarViews') {
    // Sync unsynced car view history to the backend
    syncHistory()
      .then((result) => sendResponse({ success: true, ...(result || {}) }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // async
  }

  if (message.action === 'logout') {
    clearAuthState()
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
});
