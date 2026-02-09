/**
 * Email gate storage for tracking usage and email collection
 * Uses chrome.storage.local for persistence across sessions
 */

const EMAIL_GATE_KEY = 'bilkostnadskalkyl_email_gate';
const FREE_VIEWS_LIMIT = 10;

/**
 * Email gate state structure
 */
export interface EmailGateState {
  /** Number of car views used */
  viewCount: number;
  /** Whether user has unlocked unlimited access */
  isUnlocked: boolean;
  /** User's email address (if provided) */
  email: string | null;
  /** Timestamp of unlock */
  unlockedAt: number | null;
}

/**
 * Default email gate state
 */
const DEFAULT_STATE: EmailGateState = {
  viewCount: 0,
  isUnlocked: false,
  email: null,
  unlockedAt: null,
};

/**
 * Gets chrome.storage.local if available
 * @returns chrome.storage.local or null if not available
 */
function getLocalStorage(): chrome.storage.LocalStorageArea | null {
  try {
    if (typeof chrome === 'undefined') return null;
    if (!chrome.storage) return null;
    if (!chrome.storage.local) return null;
    if (typeof chrome.storage.local.get !== 'function') return null;
    return chrome.storage.local;
  } catch {
    return null;
  }
}

/**
 * Loads email gate state from Chrome storage
 * @returns Promise resolving to email gate state
 */
export async function loadEmailGateState(): Promise<EmailGateState> {
  try {
    const storage = getLocalStorage();
    if (!storage) {
      console.warn('[Bilkostnadskalkyl] Chrome local storage not available');
      return DEFAULT_STATE;
    }
    const result = await storage.get(EMAIL_GATE_KEY);
    const stored = result[EMAIL_GATE_KEY] || {};
    return { ...DEFAULT_STATE, ...stored };
  } catch (error) {
    console.error('[Bilkostnadskalkyl] Failed to load email gate state:', error);
    return DEFAULT_STATE;
  }
}

/**
 * Saves email gate state to Chrome storage
 * @param state - Partial state to update
 */
export async function saveEmailGateState(
  state: Partial<EmailGateState>
): Promise<void> {
  try {
    const storage = getLocalStorage();
    if (!storage) {
      console.warn('[Bilkostnadskalkyl] Chrome local storage not available for save');
      return;
    }
    const current = await loadEmailGateState();
    const updated = { ...current, ...state };
    await storage.set({ [EMAIL_GATE_KEY]: updated });
  } catch (error) {
    console.error('[Bilkostnadskalkyl] Failed to save email gate state:', error);
    throw error;
  }
}

/**
 * Increments view count and returns updated state
 * @returns Promise resolving to updated state with new view count
 */
export async function incrementViewCount(): Promise<EmailGateState> {
  const current = await loadEmailGateState();
  const updated = {
    ...current,
    viewCount: current.viewCount + 1,
  };
  await saveEmailGateState(updated);
  return updated;
}

/**
 * Unlocks unlimited access with provided email
 * @param email - User's email address
 * @returns Promise resolving to updated state
 */
export async function unlockWithEmail(email: string): Promise<EmailGateState> {
  const current = await loadEmailGateState();
  const updated: EmailGateState = {
    ...current,
    isUnlocked: true,
    email: email.trim(),
    unlockedAt: Date.now(),
  };
  await saveEmailGateState(updated);
  return updated;
}

/**
 * Checks if user should see the email gate
 * @returns Promise resolving to true if gate should be shown
 */
export async function shouldShowEmailGate(): Promise<boolean> {
  const state = await loadEmailGateState();
  return !state.isUnlocked && state.viewCount >= FREE_VIEWS_LIMIT;
}

/**
 * Gets remaining free views
 * @returns Promise resolving to number of remaining free views
 */
export async function getRemainingFreeViews(): Promise<number> {
  const state = await loadEmailGateState();
  if (state.isUnlocked) return Infinity;
  return Math.max(0, FREE_VIEWS_LIMIT - state.viewCount);
}

/**
 * Initiates the magic link authentication flow.
 * Sends the email to the backend to get a magic link via email.
 * @param email - The user's email address
 * @returns Success status and optional error message
 */
export async function initiateLogin(
  email: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { fetchWithTimeout } = await import('./auth');
    const res = await fetchWithTimeout('https://dinbilkostnad.se/api/auth/send-magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), source: 'extension' }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Något gick fel.' };
    }
    // Store email locally while waiting for verification
    await saveEmailGateState({ email: email.trim() });
    return { success: true };
  } catch {
    return { success: false, error: 'Kunde inte nå servern. Försök igen.' };
  }
}

/**
 * Resets email gate state for testing
 * @returns Promise that resolves when state is reset
 */
export async function resetEmailGateState(): Promise<void> {
  try {
    const storage = getLocalStorage();
    if (!storage) {
      console.warn('[Bilkostnadskalkyl] Chrome local storage not available for reset');
      return;
    }
    await storage.set({ [EMAIL_GATE_KEY]: DEFAULT_STATE });
  } catch (error) {
    console.error('[Bilkostnadskalkyl] Failed to reset email gate state:', error);
    throw error;
  }
}

/**
 * Gets the free views limit constant
 * @returns Number of free views allowed
 */
export function getFreeViewsLimit(): number {
  return FREE_VIEWS_LIMIT;
}
