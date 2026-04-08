/**
 * Content script entry point for Bilkostnadskalkyl
 * Runs on supported car listing sites (Carla.se, Wayke.se, etc.)
 *
 * Uses a simple generation counter to handle race conditions:
 * each new requestInit() increments the counter, and init() checks
 * before creating the overlay that its generation is still current.
 */

// Prevent duplicate script execution (can happen on extension reload)
declare global {
  interface Window {
    __bilkostnadskalkylLoaded?: boolean;
  }
}

if (window.__bilkostnadskalkylLoaded) {
  document.querySelectorAll('#bilkostnadskalkyl-overlay').forEach(el => el.remove());
}
window.__bilkostnadskalkylLoaded = true;

// Enforce single overlay at all times — catches duplicates from any source
function enforceSingleOverlay(): void {
  const overlays = document.querySelectorAll('#bilkostnadskalkyl-overlay');
  if (overlays.length > 1) {
    // Keep the first (from newest code), remove later duplicates (from stale instances)
    for (let i = 1; i < overlays.length; i++) overlays[i].remove();
  }
}

const dedupObserver = new MutationObserver(enforceSingleOverlay);
if (document.body) {
  dedupObserver.observe(document.body, { childList: true });
} else {
  document.addEventListener('DOMContentLoaded', () => {
    dedupObserver.observe(document.body, { childList: true });
  });
}

import { isCarlaListingPage, extractCarlaData, getOverlayAnchor as getCarlaAnchor } from '../adapters/carla';
import { isWaykeListingPage, extractWaykeData, getWaykeOverlayAnchor } from '../adapters/wayke';
import { isBlocketListingPage, extractBlocketData, getBlocketOverlayAnchor } from '../adapters/blocket';
import { loadPreferences, onPreferencesChange } from '../storage/preferences';
import { saveToHistory } from '../storage/history';
import { calculateCosts, createCalculatorInput } from '../core/calculator';
import { CostOverlay } from '../overlay/overlay';
import { VehicleData, UserPreferences, SiteName } from '../types';

interface SiteAdapter {
  name: string;
  isListingPage: () => boolean;
  extractData: () => Promise<VehicleData | null>;
  getAnchor: () => HTMLElement | null;
}

const siteAdapters: SiteAdapter[] = [
  { name: 'Carla.se', isListingPage: isCarlaListingPage, extractData: extractCarlaData, getAnchor: getCarlaAnchor },
  { name: 'Wayke.se', isListingPage: isWaykeListingPage, extractData: extractWaykeData, getAnchor: getWaykeOverlayAnchor },
  { name: 'Blocket.se', isListingPage: isBlocketListingPage, extractData: extractBlocketData, getAnchor: getBlocketOverlayAnchor },
];

let currentOverlay: CostOverlay | null = null;
let currentVehicleData: VehicleData | null = null;
let currentAdapter: SiteAdapter | null = null;
let lastProcessedUrl: string = '';
let urlPollingInterval: ReturnType<typeof setInterval> | null = null;
let urlChangeTimeout: ReturnType<typeof setTimeout> | null = null;
let contentObserver: MutationObserver | null = null;

/**
 * Generation counter — incremented every time we want a fresh init.
 * Any in-flight init whose generation doesn't match is stale and must bail.
 */
let currentGeneration: number = 0;

/**
 * Detects which site adapter to use based on current page
 */
function detectSiteAdapter(): SiteAdapter | null {
  for (const adapter of siteAdapters) {
    if (adapter.isListingPage()) return adapter;
  }
  return null;
}

/**
 * Converts adapter name to SiteName type for history
 */
function getSiteName(adapterName: string): SiteName {
  const nameMap: Record<string, SiteName> = {
    'Carla.se': 'carla',
    'Wayke.se': 'wayke',
    'Blocket.se': 'blocket',
  };
  return nameMap[adapterName] || 'blocket';
}

/**
 * Destroys current overlay and removes any orphaned DOM elements.
 */
function cleanup(): void {
  if (currentOverlay) {
    currentOverlay.destroy();
    currentOverlay = null;
  }
  document.querySelectorAll('#bilkostnadskalkyl-overlay').forEach(el => el.remove());
  currentVehicleData = null;
  currentAdapter = null;
}

/**
 * Starts a new init cycle. Bumps the generation counter so any
 * in-flight init from a previous cycle will bail out.
 */
function requestInit(): void {
  currentGeneration++;
  cleanup();
  lastProcessedUrl = '';
  init(0, currentGeneration);
}

/**
 * Main initialization. Checks generation before every async resume
 * to ensure a newer requestInit() hasn't superseded this one.
 */
async function init(retryCount: number, generation: number): Promise<void> {
  if (generation !== currentGeneration) return;

  const currentUrl = location.href;
  console.log('[Bilkostnadskalkyl] init() called, retry:', retryCount, 'gen:', generation, 'url:', currentUrl);

  // Skip if we already have an overlay for this exact URL
  if (currentUrl === lastProcessedUrl && currentOverlay) {
    return;
  }

  const adapter = detectSiteAdapter();
  if (!adapter) {
    cleanup();
    return;
  }

  currentAdapter = adapter;

  // Extract vehicle data
  const vehicleData = await adapter.extractData();
  if (generation !== currentGeneration) return;

  if (!vehicleData) {
    if (retryCount < 5) {
      const delay = retryCount < 2 ? 500 : 1000 * (retryCount - 1);
      await new Promise(r => setTimeout(r, delay));
      if (generation !== currentGeneration) return;
      return init(retryCount + 1, generation);
    }
    console.warn(`[Bilkostnadskalkyl] Could not extract data from ${adapter.name} after retries`);
    return;
  }

  currentVehicleData = vehicleData;

  // Load preferences
  let preferences = await loadPreferences();
  if (generation !== currentGeneration) return;

  if (vehicleData.effectiveInterestRate !== null && vehicleData.effectiveInterestRate > 0) {
    preferences = { ...preferences, interestRate: vehicleData.effectiveInterestRate };
  }

  const input = createCalculatorInput(vehicleData, preferences);
  const costs = calculateCosts(input);

  // Find anchor
  const anchor = adapter.getAnchor();
  if (!anchor) {
    if (retryCount < 5) {
      const delay = retryCount < 2 ? 500 : 1000 * (retryCount - 1);
      await new Promise(r => setTimeout(r, delay));
      if (generation !== currentGeneration) return;
      return init(retryCount + 1, generation);
    }
    console.warn(`[Bilkostnadskalkyl] Could not find anchor on ${adapter.name} after retries`);
    return;
  }

  // Final generation check before creating overlay
  if (generation !== currentGeneration) return;

  // Clean up and create overlay
  cleanup();
  currentAdapter = adapter;
  currentOverlay = new CostOverlay(costs, vehicleData, preferences, anchor, adapter.name);
  lastProcessedUrl = currentUrl;

  // Save to history (fire-and-forget)
  const siteName = getSiteName(adapter.name);
  saveToHistory(vehicleData, costs, siteName, currentUrl)
    .then(() => chrome.runtime.sendMessage({ action: 'syncCarViews' }).catch(() => {}))
    .catch(err => console.warn('[Bilkostnadskalkyl] Failed to save to history:', err));
}

/**
 * Handle preference changes - recalculate and update overlay
 */
function handlePreferencesChange(newPrefs: UserPreferences): void {
  if (!currentVehicleData || !currentOverlay) return;
  const input = createCalculatorInput(currentVehicleData, newPrefs);
  const costs = calculateCosts(input);
  currentOverlay.update(costs, newPrefs);
}

onPreferencesChange(handlePreferencesChange);

/**
 * Handles URL changes from SPA navigation. Debounces with 500ms.
 */
function handleUrlChange(): void {
  if (urlChangeTimeout) clearTimeout(urlChangeTimeout);

  // Bump generation to invalidate any in-flight init immediately
  currentGeneration++;
  cleanup();

  urlChangeTimeout = setTimeout(() => {
    urlChangeTimeout = null;
    requestInit();
  }, 500);
}

// Intercept history.pushState for SPA navigation
const originalPushState = history.pushState;
history.pushState = function(...args) {
  originalPushState.apply(this, args);
  handleUrlChange();
};

// Intercept history.replaceState for SPA navigation
const originalReplaceState = history.replaceState;
history.replaceState = function(...args) {
  originalReplaceState.apply(this, args);
  handleUrlChange();
};

// Listen for popstate (back/forward navigation)
window.addEventListener('popstate', () => handleUrlChange());

/**
 * Starts polling and initial setup once DOM is ready
 */
function startWhenReady(): void {
  if (urlPollingInterval) clearInterval(urlPollingInterval);

  let lastKnownUrl = location.href;
  urlPollingInterval = setInterval(() => {
    if (location.href !== lastKnownUrl) {
      lastKnownUrl = location.href;
      handleUrlChange();
    }
  }, 500);

  requestInit();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startWhenReady);
} else {
  startWhenReady();
}

/**
 * Extra fallback: Watch for significant DOM changes on Blocket
 */
function setupContentObserver(): void {
  let lastMainContent = '';
  let lastH1Content = '';

  const checkForNewContent = (): void => {
    if (!location.hostname.includes('blocket.se')) return;

    const isListingUrl = /^\/mobility\/item\/\d+/.test(location.pathname);
    const adScript = document.getElementById('advertising-initial-state');
    const currentContent = adScript?.textContent || '';
    const h1 = document.querySelector('h1');
    const h1Content = h1?.textContent || '';

    const contentChanged = currentContent && currentContent !== lastMainContent;
    const h1Changed = h1Content && h1Content !== lastH1Content;

    if (contentChanged || h1Changed) {
      if (contentChanged) lastMainContent = currentContent;
      if (h1Changed) lastH1Content = h1Content;
      if (isListingUrl && !currentOverlay) requestInit();
    }
  };

  if (contentObserver) contentObserver.disconnect();
  contentObserver = new MutationObserver(() => checkForNewContent());

  if (document.body) {
    contentObserver.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      contentObserver?.observe(document.body, { childList: true, subtree: true });
    });
  }
}

/**
 * Watch for click events that might trigger SPA navigation on Blocket
 */
function setupClickObserver(): void {
  document.addEventListener('click', (event: MouseEvent) => {
    if (!location.hostname.includes('blocket.se')) return;

    const link = (event.target as HTMLElement).closest('a');
    if (link?.href) {
      const url = new URL(link.href);
      if (url.hostname.includes('blocket.se') && /^\/mobility\/item\/\d+/.test(url.pathname)) {
        setTimeout(() => {
          if (location.pathname === url.pathname && !currentOverlay) requestInit();
        }, 300);
        setTimeout(() => {
          if (location.pathname === url.pathname && !currentOverlay) requestInit();
        }, 800);
      }
    }
  }, true);
}

setupContentObserver();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupClickObserver);
} else {
  setupClickObserver();
}

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  try {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.action === 'toggleInfoPanel') {
        sendResponse({ success: true, contentScriptActive: true });
        return true;
      }
    });
  } catch (error) {
    console.warn('[Bilkostnadskalkyl] Could not set up message listener:', error);
  }
}
