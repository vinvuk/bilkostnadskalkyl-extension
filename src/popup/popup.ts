/**
 * Popup script for Bilkostnadskalkyl extension settings
 * Handles user preference input and synchronization with Chrome storage
 */

import { UserPreferences } from '../types';
import { loadPreferences, savePreferences, resetPreferences } from '../storage/preferences';
import { DEFAULT_PREFERENCES, FUEL_TYPES } from '../core/constants';

/**
 * Input field configuration mapping preference keys to DOM elements
 */
const FIELD_CONFIG: Array<{
  id: string;
  key: keyof UserPreferences;
}> = [
  { id: 'annualMileage', key: 'annualMileage' },
  { id: 'ownershipYears', key: 'ownershipYears' },
  { id: 'primaryFuelPrice', key: 'primaryFuelPrice' },
  { id: 'insurance', key: 'insurance' },
  { id: 'parking', key: 'parking' },
  { id: 'annualTax', key: 'annualTax' },
];

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Initializes the popup with current preferences
 */
async function init(): Promise<void> {
  const preferences = await loadPreferences();
  populateFields(preferences);
  attachEventListeners();
}

/**
 * Populates form fields with preference values
 * @param preferences - Current user preferences
 */
function populateFields(preferences: UserPreferences): void {
  for (const field of FIELD_CONFIG) {
    const input = document.getElementById(field.id) as HTMLInputElement;
    if (!input) continue;

    const value = preferences[field.key];
    input.value = String(value ?? '');
  }
}

/**
 * Attaches event listeners to all form inputs
 */
function attachEventListeners(): void {
  // Input change listeners with debounced save
  for (const field of FIELD_CONFIG) {
    const input = document.getElementById(field.id) as HTMLInputElement;
    if (!input) continue;

    input.addEventListener('input', () => {
      debouncedSave();
    });
  }

  // Reset button
  const resetBtn = document.getElementById('resetBtn');
  resetBtn?.addEventListener('click', handleReset);
}

/**
 * Debounces save operation to avoid excessive storage writes
 */
function debouncedSave(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(saveCurrentValues, 300);
}

/**
 * Saves current form values to Chrome storage
 */
async function saveCurrentValues(): Promise<void> {
  try {
    const preferences = await loadPreferences();

    for (const field of FIELD_CONFIG) {
      const input = document.getElementById(field.id) as HTMLInputElement;
      if (!input) continue;

      const value = parseFloat(input.value);
      if (isNaN(value)) continue;

      // Use type assertion to allow dynamic property assignment
      (preferences as unknown as Record<string, unknown>)[field.key] = value;
    }

    await savePreferences(preferences);
    showStatus('Sparad!', 'success');
  } catch (error) {
    console.error('[Bilkostnadskalkyl] Save error:', error);
    showStatus('Fel vid sparning', 'error');
  }
}

/**
 * Handles reset button click - restores default values
 */
async function handleReset(): Promise<void> {
  try {
    await resetPreferences();
    populateFields(DEFAULT_PREFERENCES);
    showStatus('Återställd!', 'success');
  } catch (error) {
    console.error('[Bilkostnadskalkyl] Reset error:', error);
    showStatus('Fel vid återställning', 'error');
  }
}

/**
 * Shows a status message briefly
 * @param message - Message to display
 * @param type - Type of message (success/error)
 */
function showStatus(message: string, type: 'success' | 'error'): void {
  const status = document.getElementById('status');
  if (!status) return;

  status.textContent = message;
  status.className = `status ${type}`;
  status.style.opacity = '1';

  setTimeout(() => {
    status.style.opacity = '0';
  }, 2000);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
