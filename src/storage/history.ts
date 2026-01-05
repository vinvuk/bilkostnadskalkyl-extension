/**
 * Chrome storage wrapper for vehicle history
 * Uses local storage for more space (sync has 100KB limit)
 */

import { HistoryItem, VehicleData, CostBreakdown, SiteName } from '../types';

const STORAGE_KEY = 'bilkostnadskalkyl_history';
const MAX_HISTORY_ITEMS = 50;

/**
 * Generates a unique ID for a history item
 * @returns Unique ID string
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Safely gets chrome.storage.local if available
 * @returns chrome.storage.local or null if not available
 */
function getStorage(): chrome.storage.LocalStorageArea | null {
  try {
    // Check chrome exists
    if (typeof chrome === 'undefined' || chrome === null) return null;
    // Check storage exists and is not null
    if (typeof chrome.storage === 'undefined' || chrome.storage === null) return null;
    // Check local exists and is not null
    if (typeof chrome.storage.local === 'undefined' || chrome.storage.local === null) return null;
    // Check get method exists and is a function
    if (typeof chrome.storage.local.get === 'undefined' || chrome.storage.local.get === null) return null;
    if (typeof chrome.storage.local.get !== 'function') return null;
    return chrome.storage.local;
  } catch {
    return null;
  }
}

/**
 * Loads history from Chrome storage
 * @returns Promise resolving to array of history items
 */
export async function loadHistory(): Promise<HistoryItem[]> {
  try {
    const storage = getStorage();
    if (!storage) {
      console.warn('[Bilkostnadskalkyl] Chrome storage not available');
      return [];
    }
    // Double-check .get exists right before calling
    if (!storage.get || typeof storage.get !== 'function') {
      console.warn('[Bilkostnadskalkyl] storage.get not available');
      return [];
    }
    const result = await storage.get(STORAGE_KEY);
    return result[STORAGE_KEY] || [];
  } catch (error) {
    console.error('[Bilkostnadskalkyl] Failed to load history:', error);
    return [];
  }
}

/**
 * Saves a vehicle to history
 * @param vehicleData - Vehicle data from the listing
 * @param costs - Calculated cost breakdown
 * @param site - Which site the car was viewed on
 * @param url - URL of the listing
 */
export async function saveToHistory(
  vehicleData: VehicleData,
  costs: CostBreakdown,
  site: SiteName,
  url: string
): Promise<void> {
  try {
    const history = await loadHistory();

    // Check if this URL already exists in history
    const existingIndex = history.findIndex(item => item.url === url);

    const historyItem: HistoryItem = {
      id: existingIndex >= 0 ? history[existingIndex].id : generateId(),
      url,
      site,
      vehicleName: vehicleData.vehicleName,
      purchasePrice: vehicleData.purchasePrice,
      fuelType: vehicleData.fuelType,
      fuelTypeLabel: vehicleData.fuelTypeLabel,
      vehicleYear: vehicleData.vehicleYear,
      mileage: vehicleData.mileage,
      monthlyTotal: costs.monthlyTotal,
      costPerMil: costs.costPerMil,
      timestamp: Date.now(),
    };

    // Remove existing entry if present (will be re-added at top)
    if (existingIndex >= 0) {
      history.splice(existingIndex, 1);
    }

    // Add new item at the beginning (most recent first)
    history.unshift(historyItem);

    // Limit history size
    const trimmedHistory = history.slice(0, MAX_HISTORY_ITEMS);

    const storage = getStorage();
    if (!storage) {
      console.warn('[Bilkostnadskalkyl] Chrome storage not available for save');
      return;
    }
    await storage.set({ [STORAGE_KEY]: trimmedHistory });
    console.log('[Bilkostnadskalkyl] Saved to history:', historyItem.vehicleName);
  } catch (error) {
    console.error('[Bilkostnadskalkyl] Failed to save to history:', error);
  }
}

/**
 * Removes a single item from history
 * @param id - ID of the item to remove
 */
export async function removeFromHistory(id: string): Promise<void> {
  try {
    const history = await loadHistory();
    const filtered = history.filter(item => item.id !== id);
    const storage = getStorage();
    if (!storage) {
      console.warn('[Bilkostnadskalkyl] Chrome storage not available for remove');
      return;
    }
    await storage.set({ [STORAGE_KEY]: filtered });
  } catch (error) {
    console.error('[Bilkostnadskalkyl] Failed to remove from history:', error);
  }
}

/**
 * Clears all history
 */
export async function clearHistory(): Promise<void> {
  try {
    const storage = getStorage();
    if (!storage) {
      console.warn('[Bilkostnadskalkyl] Chrome storage not available for clear');
      return;
    }
    await storage.set({ [STORAGE_KEY]: [] });
  } catch (error) {
    console.error('[Bilkostnadskalkyl] Failed to clear history:', error);
  }
}

/**
 * Gets the count of items in history
 * @returns Promise resolving to number of history items
 */
export async function getHistoryCount(): Promise<number> {
  const history = await loadHistory();
  return history.length;
}
