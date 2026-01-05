/**
 * Content script entry point for Bilkostnadskalkyl
 * Runs on supported car listing sites (Carla.se, Wayke.se, etc.)
 */

import { isCarlaListingPage, extractCarlaData, getOverlayAnchor as getCarlaAnchor } from '../adapters/carla';
import { isWaykeListingPage, extractWaykeData, getWaykeOverlayAnchor } from '../adapters/wayke';
import { loadPreferences, onPreferencesChange } from '../storage/preferences';
import { calculateCosts, createCalculatorInput } from '../core/calculator';
import { CostOverlay } from '../overlay/overlay';
import { VehicleData, UserPreferences } from '../types';

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
];

let currentOverlay: CostOverlay | null = null;
let currentVehicleData: VehicleData | null = null;
let currentAdapter: SiteAdapter | null = null;
let currentPreferences: UserPreferences | null = null;
let lastProcessedUrl: string = '';
let initInProgress: boolean = false;
let interestRateObserver: MutationObserver | null = null;
let lastExtractedRate: number | null = null;

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
 * Cleans up the current overlay and observers
 */
function cleanup(): void {
  if (currentOverlay) {
    currentOverlay.destroy();
    currentOverlay = null;
  }
  if (interestRateObserver) {
    interestRateObserver.disconnect();
    interestRateObserver = null;
  }
  currentVehicleData = null;
  currentAdapter = null;
  currentPreferences = null;
  lastExtractedRate = null;
}

/**
 * Extracts effective interest rate from page text
 * @returns The extracted rate or null if not found
 */
function extractEffectiveInterestRate(): number | null {
  const text = document.body.innerText;

  const patterns = [
    /effektiv\s*ränta[:\s]*([\d,\.]+)\s*%/i,
    /eff\.?\s*ränta[:\s]*([\d,\.]+)\s*%/i,
    /effektiv\s*ränta[\s\n]*([\d,\.]+)\s*%/i,
    /effektiv[\s\u00a0]*ränta[\s\u00a0:\-]*([\d,\.]+)[\s\u00a0]*%/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const rate = parseFloat(match[1].replace(',', '.'));
      if (rate > 0.1 && rate < 30) {
        return rate;
      }
    }
  }
  return null;
}

/**
 * Debounced handler for interest rate changes
 */
let rateChangeTimeout: ReturnType<typeof setTimeout> | null = null;

function handlePotentialRateChange(): void {
  // Debounce rapid changes
  if (rateChangeTimeout) {
    clearTimeout(rateChangeTimeout);
  }

  rateChangeTimeout = setTimeout(() => {
    rateChangeTimeout = null;

    if (!currentVehicleData || !currentOverlay || !currentPreferences) return;

    const newRate = extractEffectiveInterestRate();

    // Only update if rate actually changed
    if (newRate !== null && newRate !== lastExtractedRate) {
      lastExtractedRate = newRate;
      currentVehicleData.effectiveInterestRate = newRate;

      // Update preferences with new rate
      const updatedPrefs = {
        ...currentPreferences,
        interestRate: newRate,
      };

      // Recalculate and update overlay
      const input = createCalculatorInput(currentVehicleData, updatedPrefs);
      const costs = calculateCosts(input);
      currentOverlay.update(costs, updatedPrefs);
    }
  }, 300); // 300ms debounce
}

/**
 * Sets up observer to watch for interest rate changes on the page
 */
function setupInterestRateObserver(): void {
  if (interestRateObserver) {
    interestRateObserver.disconnect();
  }

  interestRateObserver = new MutationObserver((mutations) => {
    // Check if any mutation might affect the interest rate display
    for (const mutation of mutations) {
      if (mutation.type === 'childList' || mutation.type === 'characterData') {
        // Check if the mutation is in an area that might contain financing info
        const target = mutation.target as Element;
        const text = target.textContent?.toLowerCase() || '';

        if (text.includes('ränta') || text.includes('effektiv') ||
            text.includes('finansiering') || text.includes('lån') ||
            text.includes('%')) {
          handlePotentialRateChange();
          break;
        }
      }
    }
  });

  // Observe the entire body for changes, but filter in the callback
  interestRateObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

/**
 * Main initialization function
 * @param retryCount - Number of retries attempted
 */
async function init(retryCount: number = 0): Promise<void> {
  const currentUrl = location.href;

  // Prevent duplicate initialization for same URL
  if (currentUrl === lastProcessedUrl && currentOverlay) {
    return;
  }

  // Prevent concurrent initialization
  if (initInProgress) {
    return;
  }

  // Detect which site we're on
  const adapter = detectSiteAdapter();
  if (!adapter) {
    cleanup();
    lastProcessedUrl = '';
    return;
  }

  initInProgress = true;
  currentAdapter = adapter;

  try {
    // Extract vehicle data from page using the appropriate adapter
    const vehicleData = await adapter.extractData();
    if (!vehicleData) {
      // Retry up to 3 times with increasing delays
      if (retryCount < 3) {
        initInProgress = false;
        setTimeout(() => init(retryCount + 1), 800 * (retryCount + 1));
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
      // Store initial rate for change detection
      lastExtractedRate = vehicleData.effectiveInterestRate;
    }

    // Store preferences for dynamic updates
    currentPreferences = preferences;

    // Calculate costs
    const input = createCalculatorInput(vehicleData, preferences);
    const costs = calculateCosts(input);

    // Find anchor and inject overlay using the appropriate adapter
    const anchor = adapter.getAnchor();
    if (!anchor) {
      if (retryCount < 3) {
        initInProgress = false;
        setTimeout(() => init(retryCount + 1), 800 * (retryCount + 1));
        return;
      }
      console.warn(`[Bilkostnadskalkyl] Could not find anchor element on ${adapter.name} after retries`);
      initInProgress = false;
      return;
    }

    // Remove existing overlay if present
    cleanup();
    currentAdapter = adapter;
    currentPreferences = preferences;
    lastExtractedRate = vehicleData.effectiveInterestRate;

    // Create and inject new overlay
    currentOverlay = new CostOverlay(costs, vehicleData, preferences, anchor);
    lastProcessedUrl = currentUrl;

    // Start watching for interest rate changes (user changing loan terms)
    setupInterestRateObserver();
  } finally {
    initInProgress = false;
  }
}

/**
 * Handle preference changes - recalculate and update overlay
 */
function handlePreferencesChange(newPrefs: UserPreferences): void {
  if (!currentVehicleData || !currentOverlay) return;

  // Keep current preferences in sync
  currentPreferences = newPrefs;

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
window.addEventListener('popstate', () => {
  handleUrlChange();
});

/**
 * Starts polling and initial setup once DOM is ready
 */
function startWhenReady(): void {
  // Fallback: Poll for URL changes every 1 second
  let lastKnownUrl = location.href;
  setInterval(() => {
    if (location.href !== lastKnownUrl) {
      lastKnownUrl = location.href;
      handleUrlChange();
    }
  }, 1000);

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
