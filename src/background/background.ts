/**
 * Background service worker for Bilkostnadskalkyl extension
 * Handles extension icon clicks and injects the info panel overlay
 */

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

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getHistory') {
    // Forward history request
    chrome.storage.local.get(['bkk_history'], (result) => {
      sendResponse(result.bkk_history || []);
    });
    return true; // Keep channel open for async response
  }
});
