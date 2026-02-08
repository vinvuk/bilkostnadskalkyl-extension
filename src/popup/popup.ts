/**
 * Popup script for Bilkostnadskalkyl extension
 * Handles About info, History display, and Account management
 */

import { HistoryItem } from '../types';
import { loadHistory, clearHistory } from '../storage/history';
import { loadAuthState, clearAuthState, authenticatedFetch } from '../storage/auth';
import { initiateLogin } from '../storage/emailGate';

let currentTab: 'about' | 'history' | 'account' = 'about';

/**
 * Initializes the popup
 */
async function init(): Promise<void> {
  attachEventListeners();
  await updateHistoryBadge();
  await updateAccountTab();
}

/**
 * Attaches event listeners to UI elements
 */
function attachEventListeners(): void {
  // Clear history button
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  clearHistoryBtn?.addEventListener('click', handleClearHistory);

  // Tab switching
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-tab') as 'about' | 'history' | 'account';
      switchTab(tabName);
    });
  });

  // Login button
  const loginBtn = document.getElementById('loginBtn');
  loginBtn?.addEventListener('click', handleLogin);

  // Login email enter key
  const loginEmail = document.getElementById('loginEmail') as HTMLInputElement;
  loginEmail?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
  });

  // Logout button
  const logoutBtn = document.getElementById('logoutBtn');
  logoutBtn?.addEventListener('click', handleLogout);

  // Data sharing toggle
  const dataSharingToggle = document.getElementById('dataSharingToggle') as HTMLInputElement;
  dataSharingToggle?.addEventListener('change', handleDataSharingToggle);

  // Listen for auth completion from background script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'authCompleted') {
      updateAccountTab();
    }
  });
}

/**
 * Switches between tabs
 * @param tabName - Name of the tab to switch to
 */
async function switchTab(tabName: 'about' | 'history' | 'account'): Promise<void> {
  currentTab = tabName;

  // Update tab buttons
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    const isActive = tab.getAttribute('data-tab') === tabName;
    tab.classList.toggle('active', isActive);
  });

  // Update tab content
  const aboutTab = document.getElementById('aboutTab');
  const historyTab = document.getElementById('historyTab');
  const accountTab = document.getElementById('accountTab');

  if (aboutTab) aboutTab.classList.toggle('active', tabName === 'about');
  if (historyTab) historyTab.classList.toggle('active', tabName === 'history');
  if (accountTab) accountTab.classList.toggle('active', tabName === 'account');

  // Update footer buttons
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  if (clearHistoryBtn) clearHistoryBtn.style.display = tabName === 'history' ? 'block' : 'none';

  // Load history if switching to history tab
  if (tabName === 'history') {
    await renderHistory();
  }

  // Refresh account state when switching to account tab
  if (tabName === 'account') {
    await updateAccountTab();
  }
}

/**
 * Updates the account tab based on authentication state
 */
async function updateAccountTab(): Promise<void> {
  const auth = await loadAuthState();
  const loggedOut = document.getElementById('accountLoggedOut');
  const loggedIn = document.getElementById('accountLoggedIn');
  const emailDisplay = document.getElementById('accountEmail');

  if (!loggedOut || !loggedIn) return;

  if (auth.token && auth.email) {
    loggedOut.style.display = 'none';
    loggedIn.style.display = 'block';
    if (emailDisplay) emailDisplay.textContent = auth.email;

    // Fetch current data sharing consent
    try {
      const res = await authenticatedFetch('/api/consent');
      if (res.ok) {
        const data = await res.json();
        const dataSharing = data.consents?.find(
          (c: { type: string }) => c.type === 'data_sharing'
        );
        const toggle = document.getElementById('dataSharingToggle') as HTMLInputElement;
        if (toggle && dataSharing) {
          toggle.checked = dataSharing.granted;
        }
      }
    } catch {
      // Non-critical, ignore
    }
  } else {
    loggedOut.style.display = 'block';
    loggedIn.style.display = 'none';
  }
}

/**
 * Handles login button click — initiates magic link flow
 */
async function handleLogin(): Promise<void> {
  const emailInput = document.getElementById('loginEmail') as HTMLInputElement;
  const loginBtn = document.getElementById('loginBtn') as HTMLButtonElement;
  const loginError = document.getElementById('loginError');
  const loginHint = document.getElementById('loginHint');

  if (!emailInput || !loginBtn) return;

  const email = emailInput.value.trim();
  if (!email || !email.includes('@')) {
    if (loginError) {
      loginError.textContent = 'Ange en giltig e-postadress.';
      loginError.style.display = 'block';
    }
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = 'Skickar...';
  if (loginError) loginError.style.display = 'none';

  const result = await initiateLogin(email);

  if (result.success) {
    if (loginHint) loginHint.style.display = 'block';
    loginBtn.textContent = 'Länk skickad!';
  } else {
    if (loginError) {
      loginError.textContent = result.error || 'Något gick fel.';
      loginError.style.display = 'block';
    }
    loginBtn.disabled = false;
    loginBtn.textContent = 'Skicka inloggningslänk';
  }
}

/**
 * Handles logout button click
 */
async function handleLogout(): Promise<void> {
  await clearAuthState();
  await updateAccountTab();
}

/**
 * Handles data sharing toggle change
 */
async function handleDataSharingToggle(): Promise<void> {
  const toggle = document.getElementById('dataSharingToggle') as HTMLInputElement;
  if (!toggle) return;

  const newValue = toggle.checked;
  toggle.disabled = true;

  chrome.runtime.sendMessage(
    {
      action: 'syncConsent',
      consentType: 'data_sharing',
      granted: newValue,
    },
    (response) => {
      toggle.disabled = false;
      if (!response?.success) {
        // Revert toggle on failure
        toggle.checked = !newValue;
      }
    }
  );
}

/**
 * Renders the history list
 */
async function renderHistory(): Promise<void> {
  const historyList = document.getElementById('historyList');
  const historyEmpty = document.getElementById('historyEmpty');

  if (!historyList || !historyEmpty) return;

  const history = await loadHistory();

  if (history.length === 0) {
    historyList.style.display = 'none';
    historyEmpty.style.display = 'flex';
    return;
  }

  historyList.style.display = 'flex';
  historyEmpty.style.display = 'none';

  historyList.innerHTML = history.map(item => renderHistoryItem(item)).join('');
}

/**
 * Renders a single history item
 * @param item - History item to render
 * @returns HTML string for the history item
 */
function renderHistoryItem(item: HistoryItem): string {
  const name = item.vehicleName || 'Okänd bil';
  const price = formatPrice(item.purchasePrice);
  const monthly = formatPrice(item.monthlyTotal);
  const perMil = formatPrice(item.costPerMil);
  const time = formatRelativeTime(item.timestamp);
  const siteLabel = escapeHtml(item.site.charAt(0).toUpperCase() + item.site.slice(1));

  return `
    <a href="${sanitizeUrl(item.url)}" target="_blank" class="history-item" data-id="${escapeHtml(item.id)}">
      <div class="history-item-header">
        <span class="history-item-name">${escapeHtml(name)}</span>
        <span class="history-item-site">${siteLabel}</span>
      </div>
      <div class="history-item-details">
        <span class="history-item-detail"><strong>${price}</strong> kr</span>
        <span class="history-item-detail history-item-cost">${monthly} kr/mån</span>
        <span class="history-item-detail">${perMil} kr/mil</span>
      </div>
      <div class="history-item-time">${time}</div>
    </a>
  `;
}

/**
 * Formats a price with thousand separators
 * @param price - Price to format
 * @returns Formatted price string
 */
function formatPrice(price: number): string {
  return Math.round(price).toLocaleString('sv-SE');
}

/**
 * Formats a timestamp as relative time
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Relative time string
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just nu';
  if (minutes < 60) return `${minutes} min sedan`;
  if (hours < 24) return `${hours} tim sedan`;
  if (days === 1) return 'Igår';
  if (days < 7) return `${days} dagar sedan`;

  const date = new Date(timestamp);
  return date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
}

/**
 * Escapes HTML to prevent XSS
 * @param str - String to escape
 * @returns Escaped string
 */
function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Sanitizes a URL to prevent javascript: and data: XSS attacks
 * @param url - URL to sanitize
 * @returns Sanitized URL or # if invalid
 */
function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return escapeHtml(url);
    }
    return '#';
  } catch {
    // Invalid URL
    return '#';
  }
}

/**
 * Updates the history badge count
 */
async function updateHistoryBadge(): Promise<void> {
  const badge = document.getElementById('historyBadge');
  if (!badge) return;

  const history = await loadHistory();
  const count = history.length;

  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}

/**
 * Handles clear history button click
 */
async function handleClearHistory(): Promise<void> {
  if (!confirm('Vill du rensa all historik?')) return;

  try {
    await clearHistory();
    await renderHistory();
    await updateHistoryBadge();
  } catch (error) {
    console.error('[Bilkostnadskalkyl] Clear history error:', error);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
