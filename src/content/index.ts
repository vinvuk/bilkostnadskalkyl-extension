/**
 * Content script entry point for Bilkostnadskalkyl
 * Runs on Carla.se car listing pages
 */

import { isCarlaListingPage, extractCarlaData, getOverlayAnchor } from '../adapters/carla';
import { loadPreferences, onPreferencesChange } from '../storage/preferences';
import { calculateCosts, createCalculatorInput } from '../core/calculator';
import { CostOverlay } from '../overlay/overlay';
import { VehicleData, CostBreakdown, UserPreferences } from '../types';

let currentOverlay: CostOverlay | null = null;
let currentVehicleData: VehicleData | null = null;
let lastProcessedUrl: string = '';
let initInProgress: boolean = false;

/**
 * Cleans up the current overlay
 */
function cleanup(): void {
  if (currentOverlay) {
    currentOverlay.destroy();
    currentOverlay = null;
  }
  currentVehicleData = null;
}

/**
 * Main initialization function
 * @param retryCount - Number of retries attempted
 */
async function init(retryCount: number = 0): Promise<void> {
  const currentUrl = location.href;

  // Prevent duplicate initialization for same URL
  if (currentUrl === lastProcessedUrl && currentOverlay) {
    console.log('[Bilkostnadskalkyl] Already initialized for this URL');
    return;
  }

  // Prevent concurrent initialization
  if (initInProgress) {
    console.log('[Bilkostnadskalkyl] Init already in progress');
    return;
  }

  console.log('[Bilkostnadskalkyl] Initializing...', { url: currentUrl, retry: retryCount });

  // Check if we're on a supported page
  if (!isCarlaListingPage()) {
    console.log('[Bilkostnadskalkyl] Not a car listing page, cleaning up');
    cleanup();
    lastProcessedUrl = '';
    return;
  }

  initInProgress = true;

  try {
    console.log('[Bilkostnadskalkyl] Car listing detected, extracting data...');

    // Extract vehicle data from page
    const vehicleData = await extractCarlaData();
    if (!vehicleData) {
      // Retry up to 3 times with increasing delays
      if (retryCount < 3) {
        console.log(`[Bilkostnadskalkyl] Extraction failed, retrying (${retryCount + 1}/3)...`);
        initInProgress = false;
        setTimeout(() => init(retryCount + 1), 800 * (retryCount + 1));
        return;
      }
      console.warn('[Bilkostnadskalkyl] Could not extract vehicle data after retries');
      initInProgress = false;
      return;
    }

    currentVehicleData = vehicleData;
    console.log('[Bilkostnadskalkyl] Extracted vehicle data:', vehicleData);

    // Load user preferences
    const preferences = await loadPreferences();

    // Calculate costs
    const input = createCalculatorInput(vehicleData, preferences);
    const costs = calculateCosts(input);

    console.log('[Bilkostnadskalkyl] Calculated costs:', costs);

    // Find anchor and inject overlay
    const anchor = getOverlayAnchor();
    if (!anchor) {
      if (retryCount < 3) {
        console.log(`[Bilkostnadskalkyl] No anchor found, retrying (${retryCount + 1}/3)...`);
        initInProgress = false;
        setTimeout(() => init(retryCount + 1), 800 * (retryCount + 1));
        return;
      }
      console.warn('[Bilkostnadskalkyl] Could not find anchor element after retries');
      initInProgress = false;
      return;
    }

    // Remove existing overlay if present
    cleanup();

    // Create and inject new overlay
    currentOverlay = new CostOverlay(costs, vehicleData, preferences, anchor);
    lastProcessedUrl = currentUrl;

    console.log('[Bilkostnadskalkyl] Overlay injected successfully');
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

  console.log('[Bilkostnadskalkyl] Overlay updated with new preferences');
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

  console.log('[Bilkostnadskalkyl] URL change detected, scheduling init...');

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

console.log('[Bilkostnadskalkyl] History interception set up');

/**
 * Starts polling and initial setup once DOM is ready
 */
function startWhenReady(): void {
  // Fallback: Poll for URL changes every 1 second
  let lastKnownUrl = location.href;
  setInterval(() => {
    if (location.href !== lastKnownUrl) {
      lastKnownUrl = location.href;
      console.log('[Bilkostnadskalkyl] URL change detected (polling fallback)');
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
