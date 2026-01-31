/**
 * Info Panel Overlay for Bilkostnadskalkyl extension
 * Uses direct DOM injection instead of custom elements for maximum compatibility
 */

// Panel styles
const panelStyles = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');

.bkk-panel-wrapper {
  --bkk-bg: rgba(15, 23, 42, 0.72);
  --bkk-bg-solid: rgba(15, 23, 42, 0.85);
  --bkk-surface: rgba(255, 255, 255, 0.06);
  --bkk-surface-hover: rgba(255, 255, 255, 0.10);
  --bkk-text: #ffffff;
  --bkk-text-secondary: #e2e8f0;
  --bkk-text-muted: #94a3b8;
  --bkk-accent: #34d399;
  --bkk-accent-hover: #10b981;
  --bkk-accent-glow: rgba(52, 211, 153, 0.25);
  --bkk-border: rgba(255, 255, 255, 0.18);
  --bkk-border-strong: rgba(255, 255, 255, 0.28);
  --bkk-radius: 16px;
  --bkk-radius-sm: 10px;
  --bkk-font: 'DM Sans', system-ui, -apple-system, sans-serif;

  all: initial;
  font-family: var(--bkk-font);
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2147483647;
  pointer-events: none;
}

.bkk-panel-wrapper * {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.bkk-panel-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 2147483647;
  width: 340px;
  max-height: calc(100vh - 40px);
  font-family: var(--bkk-font);
  font-size: 14px;
  line-height: 1.5;
  color: var(--bkk-text);
  animation: bkkPanelSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: auto;
}

@keyframes bkkPanelSlideIn {
  from {
    opacity: 0;
    transform: translateY(-10px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes bkkPanelSlideOut {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(-10px) scale(0.95);
  }
}

.bkk-panel-container.bkk-closing {
  animation: bkkPanelSlideOut 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.bkk-panel {
  background: var(--bkk-bg);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid var(--bkk-border);
  border-radius: var(--bkk-radius);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 40px);
}

.bkk-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--bkk-border);
  background: var(--bkk-surface);
}

.bkk-panel-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 600;
  font-size: 14px;
  color: var(--bkk-text);
  letter-spacing: -0.01em;
}

.bkk-panel-logo-icon {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, var(--bkk-accent) 0%, var(--bkk-accent-hover) 100%);
  border-radius: var(--bkk-radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px var(--bkk-accent-glow);
}

.bkk-panel-logo-icon svg {
  width: 18px;
  height: 18px;
  color: white;
}

.bkk-panel-close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--bkk-text-muted);
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
}

.bkk-panel-close:hover {
  background: var(--bkk-surface-hover);
  color: var(--bkk-text);
}

.bkk-panel-close svg {
  width: 18px;
  height: 18px;
}

.bkk-panel-tabs {
  display: flex;
  background: var(--bkk-surface);
  border-bottom: 1px solid var(--bkk-border);
}

.bkk-panel-tab {
  flex: 1;
  padding: 14px 16px;
  background: none;
  border: none;
  color: var(--bkk-text-muted);
  font-size: 13px;
  font-family: inherit;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.bkk-panel-tab:hover {
  color: var(--bkk-text-secondary);
  background: var(--bkk-surface-hover);
}

.bkk-panel-tab.bkk-active {
  color: var(--bkk-text);
  background: var(--bkk-surface-hover);
}

.bkk-panel-tab.bkk-active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--bkk-accent);
}

.bkk-panel-badge {
  background: var(--bkk-accent);
  color: white;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
}

.bkk-panel-content {
  padding: 16px;
  overflow-y: auto;
  flex: 1;
}

.bkk-panel-content::-webkit-scrollbar {
  width: 6px;
}

.bkk-panel-content::-webkit-scrollbar-track {
  background: transparent;
}

.bkk-panel-content::-webkit-scrollbar-thumb {
  background: var(--bkk-border);
  border-radius: 3px;
}

.bkk-tab-content {
  display: none;
}

.bkk-tab-content.bkk-active {
  display: block;
}

.bkk-section {
  background: var(--bkk-surface);
  border-radius: var(--bkk-radius-sm);
  padding: 14px 16px;
  margin-bottom: 10px;
  border: 1px solid transparent;
  transition: all 0.2s;
}

.bkk-section:hover {
  background: var(--bkk-surface-hover);
  border-color: var(--bkk-border);
}

.bkk-section:last-child {
  margin-bottom: 0;
}

.bkk-section-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--bkk-text-muted);
  margin-bottom: 12px;
}

.bkk-about-intro {
  text-align: center;
  padding: 20px 16px;
}

.bkk-about-description {
  font-size: 14px;
  color: var(--bkk-text-secondary);
  line-height: 1.6;
}

.bkk-about-usage {
  font-size: 13px;
  color: var(--bkk-text-muted);
  line-height: 1.6;
}

.bkk-supported-sites {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bkk-site-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: var(--bkk-bg-solid);
  border-radius: 8px;
  text-decoration: none;
  color: inherit;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.bkk-site-item:hover {
  background: var(--bkk-surface-hover);
  border-color: var(--bkk-accent);
  box-shadow: 0 0 12px var(--bkk-accent-glow);
}

.bkk-site-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--bkk-text);
}

.bkk-site-status {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 3px 8px;
  border-radius: 4px;
  background: rgba(52, 211, 153, 0.15);
  color: var(--bkk-accent);
}

.bkk-history-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  color: var(--bkk-text-muted);
}

.bkk-history-empty svg {
  width: 40px;
  height: 40px;
  opacity: 0.3;
  margin-bottom: 14px;
  stroke: var(--bkk-accent);
}

.bkk-history-empty p {
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 4px;
  color: var(--bkk-text-secondary);
}

.bkk-history-empty span {
  font-size: 11px;
  opacity: 0.7;
}

.bkk-panel-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--bkk-border);
  background: var(--bkk-surface);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.bkk-panel-version {
  font-size: 11px;
  color: var(--bkk-text-muted);
  font-weight: 500;
}

.bkk-hidden {
  display: none !important;
}
`;

/**
 * Creates the panel HTML structure
 * @returns The panel HTML string
 */
function createPanelHTML(): string {
  // Get version dynamically from manifest
  const version = typeof chrome !== 'undefined' && chrome.runtime?.getManifest
    ? chrome.runtime.getManifest().version
    : '1.2.4';

  return `
    <div class="bkk-panel-container">
      <div class="bkk-panel">
        <header class="bkk-panel-header">
          <div class="bkk-panel-logo">
            <div class="bkk-panel-logo-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="4" y="2" width="16" height="20" rx="2"/>
                <rect x="7" y="5" width="10" height="4" rx="1"/>
                <circle cx="8" cy="13" r="1" fill="currentColor"/>
                <circle cx="12" cy="13" r="1" fill="currentColor"/>
                <circle cx="16" cy="13" r="1" fill="currentColor"/>
                <circle cx="8" cy="17" r="1" fill="currentColor"/>
                <circle cx="12" cy="17" r="1" fill="currentColor"/>
              </svg>
            </div>
            <span>Bilkostnadskalkyl</span>
          </div>
          <button class="bkk-panel-close" id="bkkPanelClose">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </header>

        <nav class="bkk-panel-tabs">
          <button class="bkk-panel-tab bkk-active" data-bkk-tab="about">Om</button>
          <button class="bkk-panel-tab" data-bkk-tab="history">
            Historik
            <span class="bkk-panel-badge bkk-hidden">0</span>
          </button>
        </nav>

        <div class="bkk-panel-content">
          <div class="bkk-tab-content bkk-active" id="bkkAboutTab">
            <section class="bkk-section bkk-about-intro">
              <p class="bkk-about-description">
                Beräkna den verkliga månadskostnaden för bilar direkt på annonssidor.
                Inkluderar värdeminskning, bränsle, försäkring, skatt och mer.
              </p>
            </section>

            <section class="bkk-section">
              <h2 class="bkk-section-title">Fungerar på</h2>
              <div class="bkk-supported-sites">
                <a href="https://www.blocket.se/bilar" target="_blank" class="bkk-site-item">
                  <span class="bkk-site-name">Blocket.se</span>
                  <span class="bkk-site-status">Aktiv</span>
                </a>
                <a href="https://www.wayke.se" target="_blank" class="bkk-site-item">
                  <span class="bkk-site-name">Wayke.se</span>
                  <span class="bkk-site-status">Aktiv</span>
                </a>
                <a href="https://www.carla.se" target="_blank" class="bkk-site-item">
                  <span class="bkk-site-name">Carla.se</span>
                  <span class="bkk-site-status">Aktiv</span>
                </a>
              </div>
            </section>

            <section class="bkk-section">
              <h2 class="bkk-section-title">Användning</h2>
              <p class="bkk-about-usage">
                Besök en bilannons på någon av sidorna ovan. Kalkylatorn visas automatiskt
                med beräknad månadskostnad. Klicka på sektionerna för att justera värden.
              </p>
            </section>
          </div>

          <div class="bkk-tab-content" id="bkkHistoryTab">
            <div class="bkk-history-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <p>Ingen historik ännu</p>
              <span>Besök bilannonser för att börja spara</span>
            </div>
          </div>
        </div>

        <footer class="bkk-panel-footer">
          <span class="bkk-panel-version">v${version}</span>
        </footer>
      </div>
    </div>
  `;
}

/**
 * Closes the panel with animation
 * @param wrapper - The wrapper element containing the panel
 */
function closePanel(wrapper: HTMLElement): void {
  const container = wrapper.querySelector('.bkk-panel-container');
  if (container) {
    container.classList.add('bkk-closing');
    setTimeout(() => {
      wrapper.remove();
    }, 200);
  } else {
    wrapper.remove();
  }
}

/**
 * Attaches event listeners to the panel
 * @param wrapper - The wrapper element containing the panel
 */
function attachEventListeners(wrapper: HTMLElement): void {
  // Close button
  const closeBtn = wrapper.querySelector('#bkkPanelClose');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => closePanel(wrapper));
  }

  // Tab switching
  const tabs = wrapper.querySelectorAll('.bkk-panel-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-bkk-tab');
      if (!tabName) return;

      // Update tab buttons
      tabs.forEach(t => t.classList.remove('bkk-active'));
      tab.classList.add('bkk-active');

      // Update tab content
      const aboutTab = wrapper.querySelector('#bkkAboutTab');
      const historyTab = wrapper.querySelector('#bkkHistoryTab');

      if (tabName === 'about') {
        aboutTab?.classList.add('bkk-active');
        historyTab?.classList.remove('bkk-active');
      } else {
        aboutTab?.classList.remove('bkk-active');
        historyTab?.classList.add('bkk-active');
      }
    });
  });

  // Close on escape
  const escapeHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closePanel(wrapper);
      document.removeEventListener('keydown', escapeHandler);
    }
  };
  document.addEventListener('keydown', escapeHandler);
}

/**
 * Creates or toggles the info panel
 * @returns True if operation was successful
 */
function toggleInfoPanel(): boolean {
  console.log('[Bilkostnadskalkyl Panel] toggleInfoPanel called');

  // Check for existing panel
  const existingWrapper = document.querySelector('.bkk-panel-wrapper');
  if (existingWrapper) {
    console.log('[Bilkostnadskalkyl Panel] Closing existing panel');
    closePanel(existingWrapper as HTMLElement);
    return true;
  }

  console.log('[Bilkostnadskalkyl Panel] Creating new panel');

  // Create wrapper element
  const wrapper = document.createElement('div');
  wrapper.className = 'bkk-panel-wrapper';

  // Add styles
  const styleElement = document.createElement('style');
  styleElement.textContent = panelStyles;
  wrapper.appendChild(styleElement);

  // Add panel HTML
  const panelContainer = document.createElement('div');
  panelContainer.innerHTML = createPanelHTML();

  // Move children from temp container to wrapper
  while (panelContainer.firstChild) {
    wrapper.appendChild(panelContainer.firstChild);
  }

  // Append to body
  document.body.appendChild(wrapper);
  console.log('[Bilkostnadskalkyl Panel] Panel appended to body');

  // Attach event listeners
  attachEventListeners(wrapper);

  return true;
}

// Log that script loaded
console.log('[Bilkostnadskalkyl Panel] Script loaded');

// Listen for messages from background script (if Chrome APIs available)
try {
  if (typeof chrome !== 'undefined' && chrome && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message && message.action === 'toggleInfoPanel') {
        const success = toggleInfoPanel();
        sendResponse({ success });
        return true;
      }
    });
  }
} catch (e) {
  console.log('[Bilkostnadskalkyl Panel] Chrome runtime not available, running in page context');
}

// Toggle panel when script is injected
try {
  toggleInfoPanel();
} catch (error) {
  console.error('[Bilkostnadskalkyl Panel] Error toggling panel:', error);
}
