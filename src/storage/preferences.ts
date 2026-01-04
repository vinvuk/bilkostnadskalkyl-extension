/**
 * Chrome storage wrapper for user preferences
 */

import { UserPreferences } from '../types';
import { DEFAULT_PREFERENCES } from '../core/constants';

const STORAGE_KEY = 'bilkostnadskalkyl_preferences';

/**
 * Loads user preferences from Chrome storage
 * @returns Promise resolving to user preferences merged with defaults
 */
export async function loadPreferences(): Promise<UserPreferences> {
  try {
    const result = await chrome.storage.sync.get(STORAGE_KEY);
    const stored = result[STORAGE_KEY] || {};
    return { ...DEFAULT_PREFERENCES, ...stored };
  } catch (error) {
    console.error('[Bilkostnadskalkyl] Failed to load preferences:', error);
    return DEFAULT_PREFERENCES;
  }
}

/**
 * Saves user preferences to Chrome storage
 * @param preferences - Partial preferences to update
 */
export async function savePreferences(
  preferences: Partial<UserPreferences>
): Promise<void> {
  try {
    const current = await loadPreferences();
    const updated = { ...current, ...preferences };
    await chrome.storage.sync.set({ [STORAGE_KEY]: updated });
  } catch (error) {
    console.error('[Bilkostnadskalkyl] Failed to save preferences:', error);
    throw error;
  }
}

/**
 * Resets all preferences to defaults
 */
export async function resetPreferences(): Promise<void> {
  try {
    await chrome.storage.sync.set({ [STORAGE_KEY]: DEFAULT_PREFERENCES });
  } catch (error) {
    console.error('[Bilkostnadskalkyl] Failed to reset preferences:', error);
    throw error;
  }
}

/**
 * Listens for preference changes
 * @param callback - Function called when preferences change
 */
export function onPreferencesChange(
  callback: (newPrefs: UserPreferences) => void
): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync' && changes[STORAGE_KEY]) {
      const newPrefs = { ...DEFAULT_PREFERENCES, ...changes[STORAGE_KEY].newValue };
      callback(newPrefs);
    }
  });
}
