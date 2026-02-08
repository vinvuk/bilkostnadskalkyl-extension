/**
 * Authentication storage for managing backend session tokens.
 * Stores auth state in chrome.storage.local for persistence across sessions.
 */

const AUTH_KEY = 'bilkostnadskalkyl_auth';
const API_BASE = 'https://dinbilkostnad.se';

/**
 * Authentication state stored in chrome.storage.local
 */
export interface AuthState {
  /** Session token for API calls */
  token: string | null;
  /** User's email address */
  email: string | null;
  /** User ID from the backend */
  userId: string | null;
  /** Timestamp when authentication was completed */
  authenticatedAt: number | null;
}

/** Default unauthenticated state */
const DEFAULT_AUTH: AuthState = {
  token: null,
  email: null,
  userId: null,
  authenticatedAt: null,
};

/**
 * Gets chrome.storage.local if available
 * @returns chrome.storage.local or null if not available
 */
function getLocalStorage(): chrome.storage.LocalStorageArea | null {
  try {
    if (typeof chrome === 'undefined') return null;
    if (!chrome.storage?.local) return null;
    if (typeof chrome.storage.local.get !== 'function') return null;
    return chrome.storage.local;
  } catch {
    return null;
  }
}

/**
 * Loads the current authentication state from Chrome storage.
 * @returns The current auth state
 */
export async function loadAuthState(): Promise<AuthState> {
  try {
    const storage = getLocalStorage();
    if (!storage) return DEFAULT_AUTH;
    const result = await storage.get(AUTH_KEY);
    const stored = result[AUTH_KEY] || {};
    return { ...DEFAULT_AUTH, ...stored };
  } catch (error) {
    console.error('[Bilkostnadskalkyl] Failed to load auth state:', error);
    return DEFAULT_AUTH;
  }
}

/**
 * Saves authentication state to Chrome storage.
 * @param state - Partial state to merge with current state
 */
export async function saveAuthState(state: Partial<AuthState>): Promise<void> {
  try {
    const storage = getLocalStorage();
    if (!storage) return;
    const current = await loadAuthState();
    const updated = { ...current, ...state };
    await storage.set({ [AUTH_KEY]: updated });
  } catch (error) {
    console.error('[Bilkostnadskalkyl] Failed to save auth state:', error);
  }
}

/**
 * Clears all authentication state (logout).
 */
export async function clearAuthState(): Promise<void> {
  try {
    const storage = getLocalStorage();
    if (!storage) return;
    await storage.set({ [AUTH_KEY]: DEFAULT_AUTH });
  } catch (error) {
    console.error('[Bilkostnadskalkyl] Failed to clear auth state:', error);
  }
}

/**
 * Checks if the user is currently authenticated.
 * @returns True if a valid token exists
 */
export async function isAuthenticated(): Promise<boolean> {
  const auth = await loadAuthState();
  return auth.token !== null;
}

/** Default request timeout in milliseconds */
const REQUEST_TIMEOUT_MS = 8000;

/**
 * Fetch wrapper with timeout support using AbortController.
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @param timeoutMs - Timeout in milliseconds (default 8s)
 * @returns Fetch response
 * @throws Error if request times out
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Makes an authenticated API call to the backend with Bearer token.
 * Includes timeout protection to prevent hanging requests.
 * @param path - API path (e.g. "/api/auth/me")
 * @param options - Fetch options
 * @returns Fetch response
 * @throws Error if not authenticated or request times out
 */
export async function authenticatedFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const auth = await loadAuthState();
  if (!auth.token) {
    throw new Error('Not authenticated');
  }

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${auth.token}`);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  return fetchWithTimeout(url, { ...options, headers });
}

/**
 * Returns the API base URL.
 * @returns The base URL for API calls
 */
export function getApiBaseUrl(): string {
  return API_BASE;
}
