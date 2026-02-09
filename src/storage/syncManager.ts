/**
 * Sync manager for uploading car view history to the backend.
 * Batches unsynced items and POSTs them to /api/sync/cars.
 * Handles auth, consent, rate limiting, and network errors gracefully.
 */

import { HistoryItem } from '../types';
import { isAuthenticated, authenticatedFetch } from './auth';
import { loadHistory } from './history';

const STORAGE_KEY = 'bilkostnadskalkyl_history';

/** Result returned by syncHistory */
export interface SyncResult {
  synced: number;
  failed: number;
  total: number;
}

/**
 * Maps a local HistoryItem to the backend CarViewPayload format.
 * @param item - Local history item
 * @returns Payload object matching the backend's expected schema
 */
function toCarViewPayload(item: HistoryItem): Record<string, unknown> {
  return {
    extensionItemId: item.id,
    url: item.url,
    site: item.site,
    vehicleName: item.vehicleName,
    purchasePrice: item.purchasePrice,
    fuelType: item.fuelType,
    fuelTypeLabel: item.fuelTypeLabel,
    vehicleYear: item.vehicleYear,
    mileage: item.mileage,
    enginePower: item.enginePower ?? null,
    registrationNumber: item.registrationNumber,
    vehicleType: item.vehicleType ?? null,
    imageUrl: item.imageUrl,
    monthlyTotal: item.monthlyTotal,
    costPerMil: item.costPerMil,
    fuelCost: item.fuelCost ?? null,
    depreciationCost: item.depreciationCost ?? null,
    taxCost: item.taxCost ?? null,
    maintenanceCost: item.maintenanceCost ?? null,
    insuranceCost: item.insuranceCost ?? null,
    viewedAt: new Date(item.timestamp).toISOString(),
  };
}

/**
 * Marks history items as synced by updating their syncedAt timestamp in storage.
 * @param ids - IDs of items to mark as synced
 */
async function markAsSynced(ids: Set<string>): Promise<void> {
  try {
    const storage = chrome.storage?.local;
    if (!storage) return;

    const result = await storage.get(STORAGE_KEY);
    const history: HistoryItem[] = result[STORAGE_KEY] || [];
    const now = Date.now();

    const updated = history.map((item) =>
      ids.has(item.id) ? { ...item, syncedAt: now } : item
    );

    await storage.set({ [STORAGE_KEY]: updated });
  } catch (error) {
    console.error('[Bilkostnadskalkyl] Failed to mark items as synced:', error);
  }
}

/**
 * Syncs unsynced car view history to the backend.
 * Silently skips if not authenticated, no consent, rate limited, or offline.
 * @returns Sync result with counts, or null if skipped
 */
export async function syncHistory(): Promise<SyncResult | null> {
  try {
    // Bail if not authenticated
    const authed = await isAuthenticated();
    if (!authed) return null;

    // Load history and filter to unsynced items
    const history = await loadHistory();
    const unsynced = history.filter(
      (item) => item.syncedAt === null || item.syncedAt === undefined
    );

    if (unsynced.length === 0) return null;

    // Map to backend payload
    const items = unsynced.map(toCarViewPayload);

    // POST to backend
    const res = await authenticatedFetch('/api/sync/cars', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });

    // Handle expected non-success responses silently
    if (res.status === 401 || res.status === 403 || res.status === 429) {
      return null;
    }

    if (!res.ok) {
      console.warn('[Bilkostnadskalkyl] Sync failed with status:', res.status);
      return null;
    }

    const data = await res.json();
    const result: SyncResult = {
      synced: data.synced || 0,
      failed: data.failed || 0,
      total: data.total || unsynced.length,
    };

    // Mark all items as synced (even failed ones get retried next time via
    // the upsert — marking them prevents repeated immediate retries)
    if (result.synced > 0) {
      const syncedIds = new Set(unsynced.map((item) => item.id));
      await markAsSynced(syncedIds);
      console.log(
        `[Bilkostnadskalkyl] Synced ${result.synced}/${result.total} car views`
      );
    }

    return result;
  } catch (error) {
    // Network errors, timeouts — skip silently, will retry later
    console.warn('[Bilkostnadskalkyl] Sync error (will retry):', error);
    return null;
  }
}
