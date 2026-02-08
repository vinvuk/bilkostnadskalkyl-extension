/**
 * Background service worker for Bilkostnadskalkyl extension
 * Handles extension icon clicks, injects the info panel overlay,
 * and monitors for auth callback from the landing page.
 */
import { saveAuthState, clearAuthState, authenticatedFetch, fetchWithTimeout } from '../storage/auth';
import { saveEmailGateState } from '../storage/emailGate';

/**
 * Re-inject content scripts on extension install/update
 * This ensures the extension works immediately after install without page refresh
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Bilkostnadskalkyl BG] Extension installed/updated:', details.reason);

  if (details.reason === 'install' || details.reason === 'update') {
    // Get all tabs matching our content script URLs
    const tabs = await chrome.tabs.query({
      url: [
        'https://www.blocket.se/*',
        'https://blocket.se/*',
        'https://www.wayke.se/*',
        'https://wayke.se/*',
        'https://www.carla.se/*',
        'https://carla.se/*'
      ]
    });

    // Re-inject content script into matching tabs
    for (const tab of tabs) {
      if (tab.id) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content/index.js']
          });
          console.log('[Bilkostnadskalkyl BG] Re-injected content script into tab:', tab.id);
        } catch (error) {
          console.warn('[Bilkostnadskalkyl BG] Failed to re-inject:', error);
        }
      }
    }
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

      // Close the callback tab
      chrome.tabs.remove(tabId);

      // Notify any open popups that auth is complete
      chrome.runtime.sendMessage({ action: 'authCompleted', user: data }).catch(() => {});
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
      .then((data) => sendResponse({ success: true, data }))
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
