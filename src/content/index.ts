/**
 * Content script entry point for Bilkostnadskalkyl
 * Runs on supported car listing sites (Carla.se, Wayke.se, etc.)
 */

// Prevent duplicate script execution (can happen in Safari)
declare global {
  interface Window {
    __bilkostnadskalkylLoaded?: boolean;
  }
}

if (window.__bilkostnadskalkylLoaded) {
  throw new Error('[Bilkostnadskalkyl] Script already loaded, skipping duplicate initialization');
}
window.__bilkostnadskalkylLoaded = true;

import { isCarlaListingPage, extractCarlaData, getOverlayAnchor as getCarlaAnchor } from '../adapters/carla';
import { isWaykeListingPage, extractWaykeData, getWaykeOverlayAnchor } from '../adapters/wayke';
import { isBlocketListingPage, extractBlocketData, getBlocketOverlayAnchor } from '../adapters/blocket';
import { loadPreferences, onPreferencesChange } from '../storage/preferences';
import { saveToHistory } from '../storage/history';
import { calculateCosts, createCalculatorInput } from '../core/calculator';
import { CostOverlay } from '../overlay/overlay';
import { VehicleData, UserPreferences, SiteName } from '../types';

/**
 * Site adapter interface for extracting data from different car listing sites
 */
interface SiteAdapter {
  name: string;
  isListingPage: () => boolean;
  extractData: () => Promise<VehicleData | null>;
  getAnchor: () => HTMLElement | null;
}

/**
 * Available site adapters
 * Add new adapters here to support additional sites
 */
const siteAdapters: SiteAdapter[] = [
  {
    name: 'Carla.se',
    isListingPage: isCarlaListingPage,
    extractData: extractCarlaData,
    getAnchor: getCarlaAnchor,
  },
  {
    name: 'Wayke.se',
    isListingPage: isWaykeListingPage,
    extractData: extractWaykeData,
    getAnchor: getWaykeOverlayAnchor,
  },
  {
    name: 'Blocket.se',
    isListingPage: isBlocketListingPage,
    extractData: extractBlocketData,
    getAnchor: getBlocketOverlayAnchor,
  },
];

let currentOverlay: CostOverlay | null = null;
let currentVehicleData: VehicleData | null = null;
let currentAdapter: SiteAdapter | null = null;
let lastProcessedUrl: string = '';
let initInProgress: boolean = false;
let urlPollingInterval: ReturnType<typeof setInterval> | null = null;
let contentObserver: MutationObserver | null = null;

/**
 * Detects which site adapter to use based on current page
 * @returns The matching site adapter or null if no match
 */
function detectSiteAdapter(): SiteAdapter | null {
  for (const adapter of siteAdapters) {
    if (adapter.isListingPage()) {
      return adapter;
    }
  }
  return null;
}

/**
 * Converts adapter name to SiteName type for history
 * @param adapterName - Name of the adapter (e.g., "Blocket.se")
 * @returns SiteName type
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
 * Cleans up the current overlay
 */
function cleanup(): void {
  if (currentOverlay) {
    currentOverlay.destroy();
    currentOverlay = null;
  }
  currentVehicleData = null;
  currentAdapter = null;
}

/**
 * Main initialization function
 * @param retryCount - Number of retries attempted
 */
async function init(retryCount: number = 0): Promise<void> {
  const currentUrl = location.href;
  console.log('[Bilkostnadskalkyl] init() called, retry:', retryCount, 'url:', currentUrl);

  // Check if overlay already exists in DOM (prevents duplicates in Safari)
  if (document.getElementById('bilkostnadskalkyl-overlay')) {
    console.log('[Bilkostnadskalkyl] Overlay already exists in DOM, skipping duplicate');
    return;
  }

  // Prevent duplicate initialization for same URL
  if (currentUrl === lastProcessedUrl && currentOverlay) {
    console.log('[Bilkostnadskalkyl] Skipping init - already processed this URL');
    return;
  }

  // Prevent concurrent initialization - set flag IMMEDIATELY to prevent race condition
  if (initInProgress) {
    console.log('[Bilkostnadskalkyl] Skipping init - already in progress');
    return;
  }
  initInProgress = true;

  // Detect which site we're on
  const adapter = detectSiteAdapter();
  if (!adapter) {
    console.log('[Bilkostnadskalkyl] No adapter detected for this page');
    cleanup();
    lastProcessedUrl = '';
    initInProgress = false;
    return;
  }
  console.log('[Bilkostnadskalkyl] Detected adapter:', adapter.name);
  currentAdapter = adapter;

  try {
    // Extract vehicle data from page using the appropriate adapter
    const vehicleData = await adapter.extractData();
    if (!vehicleData) {
      // Retry up to 5 times with increasing delays (more aggressive for SPAs)
      if (retryCount < 5) {
        initInProgress = false;
        const delay = retryCount < 2 ? 500 : 1000 * (retryCount - 1);
        setTimeout(() => init(retryCount + 1), delay);
        return;
      }
      console.warn(`[Bilkostnadskalkyl] Could not extract vehicle data from ${adapter.name} after retries`);
      initInProgress = false;
      return;
    }

    currentVehicleData = vehicleData;

    // Load user preferences
    let preferences = await loadPreferences();

    // Override interest rate with extracted effective rate from listing if available
    if (vehicleData.effectiveInterestRate !== null && vehicleData.effectiveInterestRate > 0) {
      preferences = {
        ...preferences,
        interestRate: vehicleData.effectiveInterestRate,
      };
    }

    // Calculate costs
    const input = createCalculatorInput(vehicleData, preferences);
    const costs = calculateCosts(input);

    // Find anchor and inject overlay using the appropriate adapter
    const anchor = adapter.getAnchor();
    if (!anchor) {
      if (retryCount < 5) {
        initInProgress = false;
        const delay = retryCount < 2 ? 500 : 1000 * (retryCount - 1);
        setTimeout(() => init(retryCount + 1), delay);
        return;
      }
      console.warn(`[Bilkostnadskalkyl] Could not find anchor element on ${adapter.name} after retries`);
      initInProgress = false;
      return;
    }

    // Remove existing overlay if present
    cleanup();
    currentAdapter = adapter;

    // Create and inject new overlay
    currentOverlay = new CostOverlay(costs, vehicleData, preferences, anchor, adapter.name);
    lastProcessedUrl = currentUrl;

    // Save to history (async, don't await to not block UI)
    const siteName = getSiteName(adapter.name);
    saveToHistory(vehicleData, costs, siteName, currentUrl).catch(err => {
      console.warn('[Bilkostnadskalkyl] Failed to save to history:', err);
    });
  } finally {
    initInProgress = false;
  }
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

// Listen for preference changes
onPreferencesChange(handlePreferencesChange);

/**
 * Debounced URL change handler to prevent multiple rapid initializations
 */
let urlChangeTimeout: ReturnType<typeof setTimeout> | null = null;

function handleUrlChange(): void {
  // Clear any pending initialization
  if (urlChangeTimeout) {
    clearTimeout(urlChangeTimeout);
  }

  // Clean up existing overlay before navigating
  cleanup();
  lastProcessedUrl = '';

  // Wait for new content to load before initializing
  urlChangeTimeout = setTimeout(() => {
    urlChangeTimeout = null;
    init();
  }, 500);
}

// Intercept history.pushState for SPA navigation - do this IMMEDIATELY
// This must run before the SPA router sets up to catch all navigations
const originalPushState = history.pushState;
history.pushState = function(...args) {
  const previousUrl = location.href;
  originalPushState.apply(this, args);
  console.log('[Bilkostnadskalkyl] history.pushState intercepted:', previousUrl, '->', location.href);
  handleUrlChange();
};

// Intercept history.replaceState for SPA navigation
const originalReplaceState = history.replaceState;
history.replaceState = function(...args) {
  const previousUrl = location.href;
  originalReplaceState.apply(this, args);
  console.log('[Bilkostnadskalkyl] history.replaceState intercepted:', previousUrl, '->', location.href);
  handleUrlChange();
};

// Listen for popstate (back/forward navigation)
window.addEventListener('popstate', () => {
  handleUrlChange();
});

/**
 * Starts polling and initial setup once DOM is ready
 */
function startWhenReady(): void {
  // Clear any existing interval to prevent duplicates
  if (urlPollingInterval) {
    clearInterval(urlPollingInterval);
  }

  // Fallback: Poll for URL changes every 500ms (more aggressive for SPAs)
  let lastKnownUrl = location.href;
  urlPollingInterval = setInterval(() => {
    if (location.href !== lastKnownUrl) {
      console.log('[Bilkostnadskalkyl] URL change detected via polling:', lastKnownUrl, '->', location.href);
      lastKnownUrl = location.href;
      handleUrlChange();
    }
  }, 500);

  // Initialize if we're already on a car listing page
  init();
}

// Wait for DOM to be ready before initializing
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startWhenReady);
} else {
  // DOM is already ready
  startWhenReady();
}

/**
 * Extra fallback: Watch for significant DOM changes that might indicate
 * SPA content has loaded (especially for Blocket which loads content dynamically)
 */
function setupContentObserver(): void {
  let lastMainContent = '';
  let lastH1Content = '';

  const checkForNewContent = (): void => {
    // Only check on Blocket URLs
    if (!location.hostname.includes('blocket.se')) {
      return;
    }

    // Check if we're on a listing page based on URL
    const isListingUrl = /^\/mobility\/item\/\d+/.test(location.pathname);

    // Check if advertising-initial-state script appeared or changed
    const adScript = document.getElementById('advertising-initial-state');
    const currentContent = adScript?.textContent || '';

    // Also watch for H1 changes (indicates page content has changed)
    const h1 = document.querySelector('h1');
    const h1Content = h1?.textContent || '';

    const contentChanged = currentContent && currentContent !== lastMainContent;
    const h1Changed = h1Content && h1Content !== lastH1Content;

    if (contentChanged || h1Changed) {
      if (contentChanged) {
        lastMainContent = currentContent;
      }
      if (h1Changed) {
        lastH1Content = h1Content;
        console.log('[Bilkostnadskalkyl] H1 content changed:', h1Content);
      }

      // If we're on a listing page and don't have an overlay, initialize
      if (isListingUrl && !currentOverlay && !initInProgress) {
        console.log('[Bilkostnadskalkyl] Content observer triggering init on listing page');
        init();
      }
    }
  };

  // Disconnect existing observer to prevent duplicates
  if (contentObserver) {
    contentObserver.disconnect();
  }

  // Observe DOM changes
  contentObserver = new MutationObserver(() => {
    checkForNewContent();
  });

  // Start observing once DOM is ready
  if (document.body) {
    contentObserver.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      contentObserver?.observe(document.body, { childList: true, subtree: true });
    });
  }
}

/**
 * Watch for click events that might trigger SPA navigation
 * This helps catch navigation that bypasses history.pushState interception
 */
function setupClickObserver(): void {
  const handleClick = (event: MouseEvent): void => {
    // Only track on Blocket
    if (!location.hostname.includes('blocket.se')) {
      return;
    }

    const target = event.target as HTMLElement;
    const link = target.closest('a');

    if (link?.href) {
      const url = new URL(link.href);
      // Check if this is a navigation to a listing page
      if (url.hostname.includes('blocket.se') && /^\/mobility\/item\/\d+/.test(url.pathname)) {
        console.log('[Bilkostnadskalkyl] Click on listing link detected:', url.pathname);
        // Schedule a check after the navigation happens
        setTimeout(() => {
          if (location.pathname === url.pathname && !currentOverlay && !initInProgress) {
            console.log('[Bilkostnadskalkyl] Post-click init trigger');
            init();
          }
        }, 300);
        setTimeout(() => {
          if (location.pathname === url.pathname && !currentOverlay && !initInProgress) {
            init();
          }
        }, 800);
      }
    }
  };

  // Use capture phase to catch events before they're handled by SPA
  document.addEventListener('click', handleClick, true);
}

// Start the content observer for Blocket SPA support
setupContentObserver();

// Start the click observer for navigation detection
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupClickObserver);
} else {
  setupClickObserver();
}

/**
 * Listen for messages from background script
 * The background script handles panel injection directly,
 * so we just acknowledge the message here.
 */
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  try {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.action === 'toggleInfoPanel') {
        // Background script will inject the panel directly
        // We just acknowledge that the content script is active
        sendResponse({ success: true, contentScriptActive: true });
        return true;
      }
    });
  } catch (error) {
    console.warn('[Bilkostnadskalkyl] Could not set up message listener:', error);
  }
}
