/**
 * Cost overlay UI component using Shadow DOM for style isolation
 * Starts as a small floating badge, expands to full overlay on click
 */

import { CostBreakdown, VehicleData, UserPreferences } from '../types';
import { calculateCosts, createCalculatorInput } from '../core/calculator';
import { isExtensionContextValid } from '../storage/preferences';

type ViewState = 'collapsed' | 'expanded' | 'methodology';

interface OverlayPosition {
  x: number;
  y: number;
}

const overlayStyles = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');

:host {
  --bkk-bg: rgba(15, 23, 42, 0.72);
  --bkk-bg-solid: rgba(15, 23, 42, 0.85);
  --bkk-surface: rgba(255, 255, 255, 0.06);
  --bkk-surface-hover: rgba(255, 255, 255, 0.10);
  --bkk-text: #ffffff;
  --bkk-text-secondary: #e2e8f0;
  --bkk-text-muted: #94a3b8;
  --bkk-accent: #34d399;
  --bkk-accent-glow: rgba(52, 211, 153, 0.25);
  --bkk-accent-secondary: #22d3ee;
  --bkk-border: rgba(255, 255, 255, 0.18);
  --bkk-border-strong: rgba(255, 255, 255, 0.28);
  --bkk-radius: 16px;
  --bkk-radius-sm: 10px;
  --bkk-font: 'DM Sans', system-ui, -apple-system, sans-serif;
  --bkk-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05);
  --bkk-shadow-glow: 0 0 60px rgba(16, 185, 129, 0.1);
  display: block;
  font-family: var(--bkk-font);
  position: fixed;
  top: 100px;
  right: 20px;
  z-index: 999999;
  overflow: visible;
  /* Allow position override via inline styles */
}

:host(.dragging) {
  user-select: none;
  cursor: grabbing !important;
}

:host(.dragging) * {
  cursor: grabbing !important;
}

/* Drag handle indicator */
.bkk-drag-handle {
  cursor: move;
}

.bkk-drag-handle:active {
  cursor: grabbing;
}

/* Collapsed badge state */
.bkk-badge {
  background: var(--bkk-bg);
  color: var(--bkk-text);
  border-radius: 60px;
  padding: 8px 12px 8px 10px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  border: 1px solid var(--bkk-border);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  overflow: visible;
}

.bkk-badge:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.15), 0 0 60px var(--bkk-accent-glow);
  border-color: var(--bkk-accent);
}

.bkk-badge-icon {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, var(--bkk-accent) 0%, #10b981 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 12px var(--bkk-accent-glow);
}

.bkk-badge-icon svg {
  width: 20px;
  height: 20px;
  color: white;
}

.bkk-badge-text {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
  padding-right: 4px;
}

.bkk-badge-value {
  font-size: 18px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  color: var(--bkk-text);
  white-space: nowrap;
}

.bkk-badge-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--bkk-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.bkk-badge-expand {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--bkk-text-muted);
  background: var(--bkk-surface);
  border-radius: 50%;
  transition: all 0.25s ease-out;
}

.bkk-badge-expand svg {
  width: 16px;
  height: 16px;
  transition: transform 0.25s ease-out;
}

.bkk-badge:hover .bkk-badge-expand svg {
  transform: translateY(1px);
}

.bkk-badge:hover .bkk-badge-expand {
  background: var(--bkk-accent);
  color: white;
}

@keyframes badgePulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
}

.bkk-badge {
  animation: badgeFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes badgeFadeIn {
  0% {
    opacity: 0;
    transform: scale(0.95) translateX(8px);
    filter: blur(2px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateX(0);
    filter: blur(0);
  }
}

/* Expanded overlay state */
.bkk-overlay {
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--bkk-bg);
  color: var(--bkk-text);
  border-radius: var(--bkk-radius);
  padding: 0;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  width: 380px;
  max-height: calc(100vh - 140px);
  animation: expandIn 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  border: 1px solid var(--bkk-border);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  overflow: hidden;
}

@keyframes expandIn {
  0% {
    opacity: 0;
    transform: scale(0.92) translateY(-8px);
    filter: blur(4px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
    filter: blur(0);
  }
}

.bkk-header {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--bkk-border);
  background: var(--bkk-surface);
}

.bkk-header-clickable {
  cursor: pointer;
  transition: background 0.2s;
}

.bkk-header-clickable:hover {
  background: var(--bkk-surface-hover);
}

.bkk-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 600;
  font-size: 14px;
  color: var(--bkk-text);
  letter-spacing: -0.01em;
}

.bkk-vehicle-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--bkk-text);
  text-align: center;
  padding: 8px 20px 12px;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: linear-gradient(180deg, var(--bkk-surface) 0%, transparent 100%);
  letter-spacing: 0.02em;
  border-bottom: 1px solid var(--bkk-border);
}

.bkk-logo-icon {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, var(--bkk-accent) 0%, #059669 100%);
  border-radius: var(--bkk-radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.25);
}

.bkk-logo-icon svg {
  width: 18px;
  height: 18px;
  color: white;
}

.bkk-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--bkk-text-muted);
  cursor: pointer;
  transition: all 0.2s;
}

.bkk-close:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.bkk-close svg {
  width: 18px;
  height: 18px;
}

.bkk-back {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--bkk-text-muted);
  cursor: pointer;
  transition: all 0.2s;
  margin-right: 8px;
}

.bkk-back:hover {
  background: var(--bkk-surface-hover);
  color: var(--bkk-text);
}

.bkk-back svg {
  width: 18px;
  height: 18px;
}

.bkk-content {
  flex: 1;
  min-height: 0;
  padding: 24px 20px;
  overflow-y: auto;
}

.bkk-summary {
  text-align: center;
  padding: 0 0 24px;
  margin-bottom: 20px;
  position: relative;
}

.bkk-summary::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 20px;
  right: 20px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--bkk-border-strong), transparent);
}

.bkk-main-cost {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 6px;
}

.bkk-value {
  font-size: 44px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.03em;
  background: linear-gradient(135deg, #fff 0%, var(--bkk-accent) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.bkk-unit {
  font-size: 18px;
  font-weight: 500;
  color: var(--bkk-text-secondary);
}

.bkk-secondary {
  margin-top: 8px;
  font-size: 14px;
  color: var(--bkk-text-secondary);
  display: flex;
  justify-content: center;
  gap: 16px;
}

.bkk-secondary span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.bkk-secondary-divider {
  color: var(--bkk-text-muted);
}

.bkk-breakdown-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--bkk-text-muted);
  margin-bottom: 16px;
}

.bkk-breakdown-item {
  position: relative;
  display: flex;
  align-items: center;
  padding: 12px 14px;
  font-size: 14px;
  background: var(--bkk-surface);
  border-radius: var(--bkk-radius-sm);
  margin-bottom: 6px;
  transition: all 0.2s;
  border: 1px solid transparent;
  overflow: hidden;
  opacity: 0;
  transform: translateX(-10px);
  animation: itemSlideIn 0.4s ease-out forwards;
}

@keyframes itemSlideIn {
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* Staggered item animations */
.bkk-breakdown-item:nth-child(1) { animation-delay: 0.05s; }
.bkk-breakdown-item:nth-child(2) { animation-delay: 0.1s; }
.bkk-breakdown-item:nth-child(3) { animation-delay: 0.15s; }
.bkk-breakdown-item:nth-child(4) { animation-delay: 0.2s; }
.bkk-breakdown-item:nth-child(5) { animation-delay: 0.25s; }
.bkk-breakdown-item:nth-child(6) { animation-delay: 0.3s; }
.bkk-breakdown-item:nth-child(7) { animation-delay: 0.35s; }
.bkk-breakdown-item:nth-child(8) { animation-delay: 0.4s; }

.bkk-breakdown-bar {
  position: absolute;
  left: 0;
  top: 4px;
  bottom: 4px;
  opacity: 0.5;
  border-radius: 0 6px 6px 0;
  transition: opacity 0.2s;
  width: 0;
  animation: barGrow 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes barGrow {
  from {
    width: 0;
  }
}

/* Staggered bar animations */
.bkk-breakdown-item:nth-child(1) .bkk-breakdown-bar { animation-delay: 0.1s; }
.bkk-breakdown-item:nth-child(2) .bkk-breakdown-bar { animation-delay: 0.15s; }
.bkk-breakdown-item:nth-child(3) .bkk-breakdown-bar { animation-delay: 0.2s; }
.bkk-breakdown-item:nth-child(4) .bkk-breakdown-bar { animation-delay: 0.25s; }
.bkk-breakdown-item:nth-child(5) .bkk-breakdown-bar { animation-delay: 0.3s; }
.bkk-breakdown-item:nth-child(6) .bkk-breakdown-bar { animation-delay: 0.35s; }
.bkk-breakdown-item:nth-child(7) .bkk-breakdown-bar { animation-delay: 0.4s; }
.bkk-breakdown-item:nth-child(8) .bkk-breakdown-bar { animation-delay: 0.45s; }

.bkk-breakdown-item:hover {
  background: var(--bkk-surface-hover);
  border-color: var(--bkk-border);
}

.bkk-breakdown-item:hover .bkk-breakdown-bar {
  opacity: 0.55;
}

.bkk-breakdown-item:last-child {
  margin-bottom: 0;
}

.bkk-label {
  position: relative;
  z-index: 1;
  flex: 1;
  color: var(--bkk-text-secondary);
  font-weight: 500;
}

.bkk-amount {
  position: relative;
  z-index: 1;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: var(--bkk-text);
}

.bkk-estimated {
  color: var(--bkk-accent-secondary);
  opacity: 0.9;
}
.bkk-estimated::before {
  content: '~';
  margin-right: 2px;
}

.bkk-footer {
  flex-shrink: 0;
  padding: 14px 20px 16px;
  border-top: 1px solid var(--bkk-border);
  background: rgba(0, 0, 0, 0.2);
}

.bkk-export-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 12px 16px;
  background: var(--bkk-accent);
  border: none;
  border-radius: var(--bkk-radius-sm);
  color: #000;
  font-family: var(--bkk-font);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 12px;
}

.bkk-export-btn:hover {
  background: #2dd4a0;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(52, 211, 153, 0.3);
}

.bkk-export-btn svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.bkk-footer-links {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 8px;
}

.bkk-text-link {
  background: none;
  border: none;
  padding: 4px 8px;
  color: var(--bkk-text-secondary);
  font-family: var(--bkk-font);
  font-size: 12px;
  cursor: pointer;
  transition: color 0.2s;
}

.bkk-text-link:hover {
  color: var(--bkk-accent);
}

.bkk-link-divider {
  color: var(--bkk-text-muted);
  opacity: 0.5;
}

.bkk-footer-info {
  font-size: 11px;
  color: var(--bkk-text-muted);
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  opacity: 0.7;
}

.bkk-footer-info svg {
  width: 14px;
  height: 14px;
  opacity: 0.8;
  stroke: var(--bkk-text-secondary);
  flex-shrink: 0;
}

/* Custom scrollbar styling */
.bkk-content {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
}

.bkk-content::-webkit-scrollbar {
  width: 6px;
  background: transparent;
}

.bkk-content::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 3px;
}

.bkk-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  border: none;
}

.bkk-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

.bkk-content::-webkit-scrollbar-corner {
  background: transparent;
}

.bkk-settings-btn {
  width: 100%;
  padding: 12px 16px;
  background: var(--bkk-surface);
  border: 1px solid var(--bkk-border);
  border-radius: var(--bkk-radius-sm);
  color: var(--bkk-text);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.bkk-settings-btn:hover {
  background: linear-gradient(135deg, var(--bkk-accent) 0%, #059669 100%);
  border-color: transparent;
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);
  transform: translateY(-1px);
}

.bkk-settings-btn svg {
  width: 16px;
  height: 16px;
  transition: transform 0.3s;
}

.bkk-settings-btn:hover svg {
  transform: rotate(90deg);
}

.bkk-note {
  font-size: 11px;
  color: var(--bkk-text-muted);
  text-align: center;
  margin-top: 12px;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Financing section in expanded view */
.bkk-financing-section {
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--bkk-border);
}

.bkk-loan-summary {
  margin-top: 10px;
  text-align: center;
}

.bkk-loan-info {
  font-size: 12px;
  color: var(--bkk-text-muted);
  background: var(--bkk-surface);
  padding: 6px 12px;
  border-radius: 20px;
}

.bkk-loan-monthly {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--bkk-accent);
  margin-bottom: 4px;
}

/* Info tooltip */
.bkk-info-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-left: 6px;
  background: var(--bkk-surface);
  border: 1px solid var(--bkk-border);
  border-radius: 50%;
  color: var(--bkk-text-muted);
  font-size: 10px;
  font-weight: 600;
  cursor: help;
  transition: all 0.2s;
}

.bkk-info-trigger:hover {
  background: var(--bkk-accent);
  border-color: var(--bkk-accent);
  color: white;
}

.bkk-tooltip {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(100% + 8px);
  background: var(--bkk-bg-solid);
  border: 1px solid var(--bkk-border-strong);
  border-radius: var(--bkk-radius-sm);
  padding: 12px 14px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--bkk-text-secondary);
  width: 260px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s;
  z-index: 10;
}

.bkk-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: var(--bkk-border-strong);
}

.bkk-breakdown-item:hover .bkk-tooltip {
  opacity: 1;
  visibility: visible;
}

/* Copy button */
.bkk-copy-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 14px;
  background: transparent;
  border: 1px solid var(--bkk-border);
  border-radius: var(--bkk-radius-sm);
  color: var(--bkk-text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 12px;
}

.bkk-copy-btn:hover {
  background: var(--bkk-surface);
  color: var(--bkk-text);
  border-color: var(--bkk-accent);
}

.bkk-copy-btn.copied {
  background: var(--bkk-accent);
  border-color: var(--bkk-accent);
  color: white;
}

.bkk-copy-btn svg {
  width: 14px;
  height: 14px;
}

/* Loading spinner */
.bkk-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  gap: 16px;
}

.bkk-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--bkk-surface);
  border-top-color: var(--bkk-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.bkk-loading-text {
  font-size: 13px;
  color: var(--bkk-text-secondary);
}

/* Focus states for keyboard navigation */
.bkk-overlay:focus-visible,
.bkk-badge:focus-visible {
  outline: 2px solid var(--bkk-accent);
  outline-offset: 2px;
}

button:focus-visible {
  outline: 2px solid var(--bkk-accent);
  outline-offset: 2px;
}

input:focus-visible {
  outline: none;
  border-color: var(--bkk-accent) !important;
  box-shadow: 0 0 0 3px var(--bkk-accent-glow), inset 0 1px 2px rgba(0,0,0,0.2) !important;
}

/* Value update animation */
@keyframes valueUpdate {
  0% { transform: scale(1); }
  50% { transform: scale(1.02); color: var(--bkk-accent); }
  100% { transform: scale(1); }
}

.bkk-value-updated {
  animation: valueUpdate 0.3s ease-out;
}

/* Hidden state */
.hidden { display: none !important; }

/* Collapsible sections */
.bkk-sections {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--bkk-border);
}

.bkk-section {
  background: var(--bkk-surface);
  border-radius: var(--bkk-radius-sm);
  border: 1px solid transparent;
  overflow: hidden;
  transition: all 0.2s;
}

.bkk-section:not(.expanded):hover {
  border-color: var(--bkk-border);
}

.bkk-section.expanded {
  border-color: var(--bkk-border);
  background: var(--bkk-surface);
}

.bkk-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.bkk-section:not(.expanded) .bkk-section-header:hover {
  background: var(--bkk-surface-hover);
}

.bkk-section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--bkk-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.bkk-section-summary {
  font-size: 13px;
  color: var(--bkk-text);
  font-weight: 500;
}

.bkk-section-chevron {
  width: 16px;
  height: 16px;
  color: var(--bkk-text-muted);
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.2s;
  flex-shrink: 0;
}

.bkk-section-header:hover .bkk-section-chevron {
  color: var(--bkk-text-secondary);
}

.bkk-section.expanded .bkk-section-chevron {
  transform: rotate(180deg);
  color: var(--bkk-accent);
}

.bkk-section-content {
  display: none;
  padding: 0 14px 14px;
}

.bkk-section.expanded .bkk-section-content {
  display: block;
  animation: fadeInUp 0.2s ease-out;
}

.bkk-section-fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.bkk-section-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.bkk-section-field-label {
  font-size: 13px;
  color: var(--bkk-text-secondary);
  font-weight: 500;
}

.bkk-section-field-input {
  display: flex;
  align-items: center;
  gap: 6px;
}

.bkk-section-input {
  width: 80px;
  padding: 8px 10px;
  background: var(--bkk-bg-solid);
  border: 1px solid var(--bkk-border);
  border-radius: 6px;
  color: var(--bkk-text);
  font-size: 14px;
  font-family: inherit;
  font-weight: 500;
  text-align: right;
  outline: none;
  transition: all 0.2s;
}

.bkk-section-input:focus {
  border-color: var(--bkk-accent);
  box-shadow: 0 0 0 3px var(--bkk-accent-glow);
}

.bkk-section-input::-webkit-inner-spin-button,
.bkk-section-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.bkk-section-unit {
  font-size: 12px;
  color: var(--bkk-text-muted);
  min-width: 40px;
}

/* Financing toggle - always visible */
.bkk-financing-toggle {
  display: flex;
  background: var(--bkk-surface);
  border-radius: 8px;
  padding: 4px;
  gap: 4px;
  margin-bottom: 12px;
}

.bkk-financing-toggle button {
  flex: 1;
  min-width: 0;
  padding: 10px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--bkk-text-secondary);
  font-family: var(--bkk-font);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.bkk-financing-toggle button:hover:not(.active) {
  color: var(--bkk-text);
  background: var(--bkk-surface-hover);
}

.bkk-financing-toggle button.active {
  background: var(--bkk-accent);
  color: white;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}

/* Loan fields - grid layout */
.bkk-loan-fields {
  display: none;
  background: var(--bkk-surface);
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 12px;
  flex-direction: column;
  gap: 12px;
}

.bkk-loan-fields.visible {
  display: flex;
  animation: fadeInUp 0.2s ease-out;
}

.bkk-loan-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.bkk-loan-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.bkk-loan-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.bkk-loan-label {
  font-size: 10px;
  color: var(--bkk-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.bkk-loan-input-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.bkk-loan-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--bkk-border);
  border-radius: 6px;
  background: var(--bkk-bg-solid);
  color: var(--bkk-text);
  font-family: var(--bkk-font);
  font-size: 13px;
  text-align: right;
  -moz-appearance: textfield;
}

.bkk-loan-input::-webkit-outer-spin-button,
.bkk-loan-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.bkk-loan-input:focus {
  outline: none;
  border-color: var(--bkk-accent);
}

.bkk-loan-unit {
  font-size: 11px;
  color: var(--bkk-text-muted);
  flex-shrink: 0;
  min-width: 16px;
}

.bkk-loan-summary {
  text-align: center;
  padding: 10px;
  background: var(--bkk-bg-solid);
  border-radius: 6px;
  border: 1px solid var(--bkk-border);
}

.bkk-loan-summary-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--bkk-accent);
}

.bkk-loan-summary-label {
  font-size: 11px;
  color: var(--bkk-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 2px;
}

/* Loan type toggle - inside loan fields */
.bkk-loan-type-toggle {
  display: flex;
  background: var(--bkk-bg-solid);
  border-radius: 6px;
  padding: 3px;
  gap: 2px;
  width: 100%;
  margin-bottom: 8px;
}

.bkk-loan-type-toggle button {
  flex: 1;
  padding: 6px 8px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--bkk-text-muted);
  font-family: var(--bkk-font);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.bkk-loan-type-toggle button:hover:not(.active) {
  color: var(--bkk-text-secondary);
  background: var(--bkk-surface-hover);
}

.bkk-loan-type-toggle button.active {
  background: var(--bkk-accent);
  color: white;
}

.bkk-loan-field.hidden {
  display: none;
}

/* Checkbox toggle for malus tax */
.bkk-checkbox-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
}

.bkk-checkbox-label {
  font-size: 13px;
  color: var(--bkk-text-secondary);
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}

.bkk-checkbox-hint {
  font-size: 10px;
  color: var(--bkk-text-muted);
  font-weight: 400;
}

.bkk-toggle {
  position: relative;
  width: 40px;
  height: 22px;
  background: var(--bkk-surface);
  border: 1px solid var(--bkk-border);
  border-radius: 11px;
  cursor: pointer;
  transition: all 0.2s;
}

.bkk-toggle::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background: var(--bkk-text-muted);
  border-radius: 50%;
  transition: all 0.2s;
}

.bkk-toggle.active {
  background: var(--bkk-accent);
  border-color: var(--bkk-accent);
}

.bkk-toggle.active::after {
  left: 20px;
  background: white;
}

.bkk-malus-amount {
  display: none;
  margin-top: 8px;
}

.bkk-malus-amount.visible {
  display: flex;
}

/* Price field with reset button */
.bkk-price-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bkk-surface);
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 12px;
}

.bkk-price-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--bkk-text-secondary);
}

.bkk-price-input-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bkk-price-input {
  width: 110px;
  padding: 8px 10px;
  background: var(--bkk-bg-solid);
  border: 1px solid var(--bkk-border);
  border-radius: 6px;
  color: var(--bkk-text);
  font-size: 14px;
  font-family: inherit;
  font-weight: 600;
  text-align: right;
  outline: none;
  transition: all 0.2s;
}

.bkk-price-input:focus {
  border-color: var(--bkk-accent);
  box-shadow: 0 0 0 3px var(--bkk-accent-glow);
}

.bkk-price-input::-webkit-inner-spin-button,
.bkk-price-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.bkk-price-input {
  -moz-appearance: textfield;
}

.bkk-price-input.modified {
  border-color: var(--bkk-border-strong);
}

.bkk-price-unit {
  font-size: 13px;
  color: var(--bkk-text-muted);
}

.bkk-price-reset {
  display: none;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: var(--bkk-surface-hover);
  color: var(--bkk-text-muted);
  cursor: pointer;
  transition: all 0.2s;
}

.bkk-price-reset.visible {
  display: flex;
}

.bkk-price-reset:hover {
  background: var(--bkk-accent);
  color: white;
}

.bkk-price-reset svg {
  width: 14px;
  height: 14px;
}

/* Methodology view */
.bkk-methodology-view .bkk-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.bkk-header-left {
  display: flex;
  align-items: center;
  gap: 4px;
}

.bkk-methodology-content {
  font-size: 13px;
  line-height: 1.6;
}

.bkk-methodology-intro {
  padding: 14px;
  background: var(--bkk-surface);
  border-radius: var(--bkk-radius-sm);
  margin-bottom: 16px;
  border-left: 3px solid var(--bkk-accent);
}

.bkk-methodology-intro p {
  margin: 0;
  color: var(--bkk-text-secondary);
}

.bkk-methodology-section {
  margin-bottom: 20px;
}

.bkk-methodology-section h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--bkk-text);
  margin: 0 0 8px 0;
}

.bkk-methodology-section p {
  margin: 0 0 8px 0;
  color: var(--bkk-text-secondary);
}

.bkk-methodology-section ul {
  margin: 0;
  padding-left: 20px;
  color: var(--bkk-text-secondary);
}

.bkk-methodology-section li {
  margin-bottom: 4px;
}

.bkk-methodology-note {
  margin-top: 10px;
  padding: 10px 12px;
  background: rgba(251, 191, 36, 0.08);
  border: 1px solid rgba(251, 191, 36, 0.2);
  border-radius: 6px;
  font-size: 12px;
  color: var(--bkk-text-secondary);
}

.bkk-methodology-sources {
  padding: 14px;
  background: var(--bkk-surface);
  border-radius: var(--bkk-radius-sm);
  margin-top: 20px;
}

.bkk-methodology-sources h3 {
  font-size: 13px;
  font-weight: 600;
  color: var(--bkk-text);
  margin: 0 0 8px 0;
}

.bkk-methodology-sources p {
  margin: 0 0 8px 0;
  color: var(--bkk-text-secondary);
}

.bkk-methodology-sources ul {
  margin: 0;
  padding-left: 20px;
  color: var(--bkk-text-secondary);
}

.bkk-methodology-sources li {
  margin-bottom: 4px;
}

.bkk-methodology-sources a {
  color: var(--bkk-accent);
  text-decoration: none;
}

.bkk-methodology-sources a:hover {
  text-decoration: underline;
}

/* Back button in methodology view */
.bkk-back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 12px 16px;
  background: var(--bkk-surface);
  border: 1px solid var(--bkk-border);
  border-radius: var(--bkk-radius-sm);
  color: var(--bkk-text);
  font-family: var(--bkk-font);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.bkk-back-btn:hover {
  background: var(--bkk-surface-hover);
  border-color: var(--bkk-accent);
  color: var(--bkk-accent);
}

.bkk-back-btn svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
`;

/**
 * Creates and manages the cost overlay element
 */
export class CostOverlay {
  private container: HTMLElement;
  private shadow: ShadowRoot;
  private viewState: ViewState;
  private vehicleData: VehicleData;
  private costs: CostBreakdown;
  private preferences: UserPreferences;

  // Price override
  private originalPrice: number;
  private customPrice: number | null = null;

  // Drag state
  private isDragging = false;
  private hasMoved = false;
  private dragOffset = { x: 0, y: 0 };
  private position: OverlayPosition | null = null;

  // UI state preservation
  private expandedSections: Set<string> = new Set();
  private focusedInputId: string | null = null;
  private isSelfUpdate = false;

  // Animation state - only animate on first render per vehicle
  private hasAnimatedEntry = false;
  private currentVehicleId: string;

  // Bound event handlers for proper cleanup
  private boundDrag: (e: MouseEvent) => void;
  private boundStopDrag: () => void;
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundResize: () => void;

  constructor(
    costs: CostBreakdown,
    vehicleData: VehicleData,
    preferences: UserPreferences,
    _anchor: HTMLElement
  ) {
    this.vehicleData = vehicleData;
    this.costs = costs;

    // Use extracted effective interest rate from listing if available
    if (vehicleData.effectiveInterestRate !== null && vehicleData.effectiveInterestRate > 0) {
      this.preferences = {
        ...preferences,
        interestRate: vehicleData.effectiveInterestRate,
      };
    } else {
      this.preferences = preferences;
    }

    // Always start collapsed - less intrusive for the user
    this.viewState = 'collapsed';

    // Store original price for reset functionality
    this.originalPrice = vehicleData.purchasePrice;

    // Create unique ID for this vehicle to track animation state
    this.currentVehicleId = `${vehicleData.purchasePrice}-${vehicleData.vehicleName || ''}-${window.location.href}`;

    // Bind event handlers for drag functionality
    this.boundDrag = this.drag.bind(this);
    this.boundStopDrag = this.stopDrag.bind(this);
    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.boundResize = this.handleResize.bind(this);

    // Add keyboard listener for Escape key
    document.addEventListener('keydown', this.boundKeyDown);

    // Add resize listener to keep overlay in viewport
    window.addEventListener('resize', this.boundResize);

    // Create container with Shadow DOM
    this.container = document.createElement('div');
    this.container.id = 'bilkostnadskalkyl-overlay';
    this.shadow = this.container.attachShadow({ mode: 'closed' });

    // Load saved position, then render
    this.loadPosition().then(() => {
      this.applyPosition();
      this.render();
      document.body.appendChild(this.container);
    });
  }

  /**
   * Renders the overlay based on current view state
   */
  private render(): void {
    if (this.viewState === 'collapsed') {
      this.renderCollapsed();
    } else if (this.viewState === 'methodology') {
      this.renderMethodology();
    } else {
      this.renderExpanded();
    }
    // Maintain position after render
    this.applyPosition();
  }

  /**
   * Renders the collapsed badge view
   */
  private renderCollapsed(): void {
    this.shadow.innerHTML = `
      <style>${overlayStyles}</style>
      <div class="bkk-badge" data-action="expand">
        <div class="bkk-badge-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="4" y="2" width="16" height="20" rx="2"/>
            <rect x="7" y="5" width="10" height="4" rx="1"/>
            <circle cx="8" cy="13" r="1" fill="currentColor"/>
            <circle cx="12" cy="13" r="1" fill="currentColor"/>
            <circle cx="16" cy="13" r="1" fill="currentColor"/>
            <circle cx="8" cy="17" r="1" fill="currentColor"/>
            <circle cx="12" cy="17" r="1" fill="currentColor"/>
            <circle cx="16" cy="17" r="1" fill="currentColor"/>
          </svg>
        </div>
        <div class="bkk-badge-text">
          <span class="bkk-badge-value">${this.formatNumber(this.costs.monthlyTotal)} kr</span>
          <span class="bkk-badge-label">per månad</span>
        </div>
        <div class="bkk-badge-expand">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>
    `;

    // Expand on click (only if we didn't drag)
    const badge = this.shadow.querySelector('[data-action="expand"]');
    badge?.addEventListener('click', () => {
      if (!this.hasMoved) {
        this.setViewState('expanded');
      }
    });

    // Attach drag listeners to badge
    this.attachDragListeners(badge);

    // Animate badge value only on first render for this vehicle
    if (!this.hasAnimatedEntry) {
      this.hasAnimatedEntry = true;
      const badgeValue = this.shadow.querySelector('.bkk-badge-value');
      if (badgeValue) {
        requestAnimationFrame(() => {
          this.animateCounter(badgeValue, this.costs.monthlyTotal, 700, ' kr');
        });
      }
    }
  }

  /**
   * Renders the expanded overlay view
   */
  private renderExpanded(): void {
    const fuelType = this.vehicleData.fuelType.toLowerCase();
    const isElectric = fuelType === 'el';
    const isPluginHybrid = fuelType === 'laddhybrid';

    // Fuel label and value for summary
    const fuelLabel = isElectric ? 'El' : isPluginHybrid ? 'Bensin + El' : 'Bensin';
    const fuelValue = isElectric ? this.preferences.secondaryFuelPrice : this.preferences.primaryFuelPrice;
    const fuelUnit = isElectric ? 'kr/kWh' : 'kr/l';

    // Insurance summary for prices section
    const insuranceSummary = this.preferences.insurance > 0
      ? `Försäkring ${this.formatNumber(this.preferences.insurance)} kr/mån`
      : '';

    this.shadow.innerHTML = `
      <style>${overlayStyles}</style>
      <div class="bkk-overlay">
        <div class="bkk-header bkk-header-clickable" data-action="collapse">
          <div class="bkk-logo">
            <div class="bkk-logo-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="4" y="2" width="16" height="20" rx="2"/>
                <rect x="7" y="5" width="10" height="4" rx="1"/>
                <circle cx="8" cy="13" r="1" fill="currentColor"/>
                <circle cx="12" cy="13" r="1" fill="currentColor"/>
                <circle cx="16" cy="13" r="1" fill="currentColor"/>
                <circle cx="8" cy="17" r="1" fill="currentColor"/>
                <circle cx="12" cy="17" r="1" fill="currentColor"/>
                <circle cx="16" cy="17" r="1" fill="currentColor"/>
              </svg>
            </div>
            Bilkostnadskalkyl
          </div>
          <button class="bkk-close" data-action="close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="bkk-content">
          <div class="bkk-summary">
            <div class="bkk-main-cost">
              <span class="bkk-value">${this.formatNumber(this.costs.monthlyTotal)}</span>
              <span class="bkk-unit">kr/mån</span>
            </div>
            <div class="bkk-secondary">
              ${this.formatNumber(this.costs.totalAnnual)} kr/år · ${this.costs.costPerMil} kr/mil
            </div>
          </div>

          <!-- Expandable sections -->
          <div class="bkk-sections">
            <!-- FORDON section -->
            <div class="bkk-section" data-section="vehicle">
              <div class="bkk-section-header">
                <div>
                  <div class="bkk-section-title">Fordon</div>
                  <div class="bkk-section-summary">${this.vehicleData.vehicleName || 'Okänt fordon'} · ${this.formatNumber(this.customPrice ?? this.originalPrice)} kr</div>
                </div>
                <svg class="bkk-section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
              <div class="bkk-section-content">
                <div class="bkk-section-fields">
                  <div class="bkk-section-field">
                    <span class="bkk-section-field-label">Pris</span>
                    <div class="bkk-section-field-input">
                      <input type="number" class="bkk-section-input bkk-price-input ${this.customPrice !== null ? 'modified' : ''}" id="bkk-price"
                        value="${this.customPrice ?? this.originalPrice}">
                      <span class="bkk-section-unit">kr</span>
                      <button type="button" class="bkk-price-reset ${this.customPrice !== null ? 'visible' : ''}" id="bkk-price-reset" title="Återställ till annonspris">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                          <path d="M3 3v5h5"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- FINANSIERING section -->
            <div class="bkk-section" data-section="financing">
              <div class="bkk-section-header">
                <div>
                  <div class="bkk-section-title">Finansiering</div>
                  <div class="bkk-section-summary">${this.preferences.financingType === 'loan' ? `Billån · ${this.formatNumber(this.costs.monthlyLoanPayment)} kr/mån` : 'Kontantköp'}</div>
                </div>
                <svg class="bkk-section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
              <div class="bkk-section-content">
                <div class="bkk-financing-toggle" id="bkk-financing-toggle">
                  <button type="button" class="${this.preferences.financingType === 'cash' ? 'active' : ''}" data-value="cash">Kontant</button>
                  <button type="button" class="${this.preferences.financingType === 'loan' ? 'active' : ''}" data-value="loan">Billån</button>
                </div>

                <div class="bkk-loan-fields ${this.preferences.financingType === 'loan' ? 'visible' : ''}" id="bkk-loan-fields">
                  <div class="bkk-loan-type-toggle" id="bkk-loan-type-toggle">
                    <button type="button" class="${(this.preferences.loanType ?? 'residual') === 'residual' ? 'active' : ''}" data-value="residual">Restvärdelån</button>
                    <button type="button" class="${this.preferences.loanType === 'annuity' ? 'active' : ''}" data-value="annuity">Annuitetslån</button>
                  </div>

                  <div class="bkk-loan-grid">
                    <div class="bkk-loan-field">
                      <span class="bkk-loan-label">Kontantins.</span>
                      <div class="bkk-loan-input-group">
                        <input type="number" class="bkk-loan-input" id="bkk-down-payment"
                          value="${this.preferences.downPaymentPercent ?? 20}" min="0" max="100" step="5">
                        <span class="bkk-loan-unit">%</span>
                      </div>
                    </div>
                    <div class="bkk-loan-field ${this.preferences.loanType === 'annuity' ? 'hidden' : ''}" id="bkk-residual-field">
                      <span class="bkk-loan-label">Restvärde</span>
                      <div class="bkk-loan-input-group">
                        <input type="number" class="bkk-loan-input" id="bkk-residual-value"
                          value="${this.preferences.residualValuePercent ?? 50}" min="0" max="80" step="5">
                        <span class="bkk-loan-unit">%</span>
                      </div>
                    </div>
                    <div class="bkk-loan-field">
                      <span class="bkk-loan-label">Eff. ränta</span>
                      <div class="bkk-loan-input-group">
                        <input type="text" inputmode="decimal" class="bkk-loan-input" id="bkk-interest-rate"
                          value="${this.preferences.interestRate ?? 5.0}" pattern="[0-9]*[,.]?[0-9]*">
                        <span class="bkk-loan-unit">%</span>
                      </div>
                    </div>
                  </div>

                  <div class="bkk-loan-grid-2">
                    <div class="bkk-loan-field">
                      <span class="bkk-loan-label">Lånetid</span>
                      <div class="bkk-loan-input-group">
                        <input type="number" class="bkk-loan-input" id="bkk-loan-years"
                          value="${this.preferences.loanYears ?? 3}" min="1" max="10" step="1">
                        <span class="bkk-loan-unit">år</span>
                      </div>
                    </div>
                    <div class="bkk-loan-field">
                      <span class="bkk-loan-label">Adm. avgift</span>
                      <div class="bkk-loan-input-group">
                        <input type="number" class="bkk-loan-input" id="bkk-admin-fee"
                          value="${this.preferences.monthlyAdminFee ?? 60}" min="0" max="500" step="5">
                        <span class="bkk-loan-unit">kr/mån</span>
                      </div>
                    </div>
                  </div>

                  <div class="bkk-loan-summary">
                    <div class="bkk-loan-summary-value">${this.formatNumber(this.costs.monthlyLoanPayment)} kr/mån</div>
                    <div class="bkk-loan-summary-label">Månadskostnad lån</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- ANVÄNDNING section -->
            <div class="bkk-section" data-section="usage">
              <div class="bkk-section-header">
                <div>
                  <div class="bkk-section-title">Användning</div>
                  <div class="bkk-section-summary">${this.formatNumber(this.preferences.annualMileage)} mil/år · ${this.preferences.ownershipYears} års ägande</div>
                </div>
                <svg class="bkk-section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
              <div class="bkk-section-content">
                <div class="bkk-section-fields">
                  <div class="bkk-section-field">
                    <span class="bkk-section-field-label">Körsträcka per år</span>
                    <div class="bkk-section-field-input">
                      <input type="number" class="bkk-section-input" id="bkk-mileage"
                        value="${this.preferences.annualMileage}" min="100" max="50000" step="100">
                      <span class="bkk-section-unit">mil</span>
                    </div>
                  </div>
                  <div class="bkk-section-field">
                    <span class="bkk-section-field-label">Ägandetid</span>
                    <div class="bkk-section-field-input">
                      <input type="number" class="bkk-section-input" id="bkk-years"
                        value="${this.preferences.ownershipYears}" min="1" max="15" step="1">
                      <span class="bkk-section-unit">år</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- KOSTNADER section -->
            <div class="bkk-section" data-section="costs">
              <div class="bkk-section-header">
                <div>
                  <div class="bkk-section-title">Kostnader</div>
                  <div class="bkk-section-summary">${fuelLabel} ${fuelValue} ${fuelUnit}${insuranceSummary ? ` · ${insuranceSummary}` : ''}</div>
                </div>
                <svg class="bkk-section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
              <div class="bkk-section-content">
                <div class="bkk-section-fields">
                  ${isPluginHybrid ? `
                  <div class="bkk-section-field">
                    <span class="bkk-section-field-label">Bensinpris</span>
                    <div class="bkk-section-field-input">
                      <input type="text" inputmode="decimal" class="bkk-section-input" id="bkk-fuel-price"
                        value="${this.preferences.primaryFuelPrice}" pattern="[0-9]*[,.]?[0-9]*">
                      <span class="bkk-section-unit">kr/l</span>
                    </div>
                  </div>
                  <div class="bkk-section-field">
                    <span class="bkk-section-field-label">Elpris</span>
                    <div class="bkk-section-field-input">
                      <input type="text" inputmode="decimal" class="bkk-section-input" id="bkk-el-price"
                        value="${this.preferences.secondaryFuelPrice}" pattern="[0-9]*[,.]?[0-9]*">
                      <span class="bkk-section-unit">kr/kWh</span>
                    </div>
                  </div>
                  <div class="bkk-section-field">
                    <span class="bkk-section-field-label">Andel elkörning</span>
                    <div class="bkk-section-field-input">
                      <input type="number" class="bkk-section-input" id="bkk-el-share"
                        value="${this.preferences.secondaryFuelShare}" min="0" max="100" step="5">
                      <span class="bkk-section-unit">%</span>
                    </div>
                  </div>
                  ` : `
                  <div class="bkk-section-field">
                    <span class="bkk-section-field-label">${isElectric ? 'Elpris' : 'Bränslepris'}</span>
                    <div class="bkk-section-field-input">
                      <input type="text" inputmode="decimal" class="bkk-section-input" id="bkk-fuel-price"
                        value="${fuelValue}" pattern="[0-9]*[,.]?[0-9]*">
                      <span class="bkk-section-unit">${fuelUnit}</span>
                    </div>
                  </div>
                  `}
                  <div class="bkk-section-field">
                    <span class="bkk-section-field-label">Försäkring</span>
                    <div class="bkk-section-field-input">
                      <input type="number" class="bkk-section-input" id="bkk-insurance"
                        value="${this.preferences.insurance}" min="0" max="5000" step="50">
                      <span class="bkk-section-unit">kr/mån</span>
                    </div>
                  </div>
                  <div class="bkk-section-field">
                    <span class="bkk-section-field-label">Fordonsskatt</span>
                    <div class="bkk-section-field-input">
                      <input type="number" class="bkk-section-input" id="bkk-tax"
                        value="${this.preferences.annualTax}" min="0" max="30000" step="100">
                      <span class="bkk-section-unit">kr/år</span>
                    </div>
                  </div>
                  ${!isElectric ? `
                  <div class="bkk-checkbox-field">
                    <span class="bkk-checkbox-label">
                      Malusskatt
                      <span class="bkk-checkbox-hint">(nya bilar, 3 år)</span>
                    </span>
                    <div class="bkk-toggle ${this.preferences.hasMalusTax ? 'active' : ''}" id="bkk-malus-toggle"></div>
                  </div>
                  <div class="bkk-section-field bkk-malus-amount ${this.preferences.hasMalusTax ? 'visible' : ''}" id="bkk-malus-field">
                    <span class="bkk-section-field-label">Malus per år</span>
                    <div class="bkk-section-field-input">
                      <input type="number" class="bkk-section-input" id="bkk-malus"
                        value="${this.preferences.malusTaxAmount ?? 0}" min="0" max="100000" step="100">
                      <span class="bkk-section-unit">kr/år</span>
                    </div>
                  </div>
                  ` : ''}
                  <div class="bkk-section-field">
                    <span class="bkk-section-field-label">Parkering</span>
                    <div class="bkk-section-field-input">
                      <input type="number" class="bkk-section-input" id="bkk-parking"
                        value="${this.preferences.parking}" min="0" max="5000" step="50">
                      <span class="bkk-section-unit">kr/mån</span>
                    </div>
                  </div>
                  <div class="bkk-section-field">
                    <span class="bkk-section-field-label">Däck</span>
                    <div class="bkk-section-field-input">
                      <input type="number" class="bkk-section-input" id="bkk-tires"
                        value="${this.preferences.annualTireCost ?? this.costs.tires}" min="0" max="30000" step="100">
                      <span class="bkk-section-unit">kr</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- FÖRDELNING section -->
            <div class="bkk-section bkk-breakdown-section" data-section="breakdown">
              <div class="bkk-section-header">
                <div>
                  <div class="bkk-section-title">Fördelning</div>
                  <div class="bkk-section-summary">Kostnadsfördelning per år</div>
                </div>
                <svg class="bkk-section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
              <div class="bkk-section-content">
                ${this.renderBreakdown()}
              </div>
            </div>
          </div>

          <button class="bkk-copy-btn" data-action="copy">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
            </svg>
            <span class="bkk-copy-text">Kopiera sammanfattning</span>
          </button>
        </div>

        <div class="bkk-footer">
          <button class="bkk-export-btn" data-action="export">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="12" y1="18" x2="12" y2="12"></line>
              <polyline points="9 15 12 12 15 15"></polyline>
            </svg>
            Exportera till PDF
          </button>
          <div class="bkk-footer-links">
            <button class="bkk-text-link" data-action="methodology">Så räknar vi</button>
            <span class="bkk-link-divider">·</span>
            <button class="bkk-text-link" data-action="feedback">Feedback</button>
          </div>
          <div class="bkk-footer-info">
            ${this.hasEstimatedValues() ? '~ = uppskattat · ' : ''}Sparas automatiskt
          </div>
        </div>
      </div>
    `;

    // Stop propagation on close button to prevent collapse
    this.shadow.querySelector('[data-action="close"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setViewState('collapsed');
    });

    // Collapse on header click (only if we didn't drag)
    const header = this.shadow.querySelector('[data-action="collapse"]');
    header?.addEventListener('click', () => {
      if (!this.hasMoved) {
        this.setViewState('collapsed');
      }
    });

    // Copy button
    this.shadow.querySelector('[data-action="copy"]')?.addEventListener('click', () => {
      this.copyToClipboard();
    });

    // Export PDF button
    this.shadow.querySelector('[data-action="export"]')?.addEventListener('click', () => {
      this.exportToPDF();
    });

    // Feedback button
    this.shadow.querySelector('[data-action="feedback"]')?.addEventListener('click', () => {
      this.openFeedback();
    });

    // Methodology link
    this.shadow.querySelector('[data-action="methodology"]')?.addEventListener('click', () => {
      this.setViewState('methodology');
    });

    // Section expand/collapse
    const sections = this.shadow.querySelectorAll('.bkk-section');
    sections.forEach(section => {
      const header = section.querySelector('.bkk-section-header');
      header?.addEventListener('click', () => {
        section.classList.toggle('expanded');
      });
    });

    // Financing toggle
    const toggleButtons = this.shadow.querySelectorAll('#bkk-financing-toggle button');
    const loanFields = this.shadow.querySelector('#bkk-loan-fields');
    toggleButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = e.currentTarget as HTMLElement;
        const value = target.dataset.value as 'cash' | 'loan';

        toggleButtons.forEach(b => b.classList.remove('active'));
        target.classList.add('active');

        if (loanFields) {
          if (value === 'loan') {
            loanFields.classList.add('visible');
          } else {
            loanFields.classList.remove('visible');
          }
        }

        this.debouncedSaveExpanded();
      });
    });

    // Loan type toggle (Restvärdelån / Annuitetslån)
    const loanTypeButtons = this.shadow.querySelectorAll('#bkk-loan-type-toggle button');
    const residualField = this.shadow.querySelector('#bkk-residual-field');
    loanTypeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = e.currentTarget as HTMLElement;
        const value = target.dataset.value as 'residual' | 'annuity';

        loanTypeButtons.forEach(b => b.classList.remove('active'));
        target.classList.add('active');

        // Show/hide residual value field based on loan type
        if (residualField) {
          if (value === 'residual') {
            residualField.classList.remove('hidden');
          } else {
            residualField.classList.add('hidden');
          }
        }

        this.debouncedSaveExpanded();
      });
    });

    // Input change listeners with debounce (both section inputs and loan inputs)
    const inputs = this.shadow.querySelectorAll('.bkk-section-input, .bkk-loan-input');
    inputs.forEach(input => {
      input.addEventListener('click', (e) => e.stopPropagation());
      input.addEventListener('input', () => {
        this.debouncedSaveExpanded();
      });
      // Sanitize on blur to prevent leading zeros and enforce min values
      input.addEventListener('blur', () => {
        this.sanitizeNumericInput(input as HTMLInputElement);
      });
    });

    // Malus tax toggle listener
    const malusToggle = this.shadow.querySelector('#bkk-malus-toggle');
    const malusField = this.shadow.querySelector('#bkk-malus-field');
    malusToggle?.addEventListener('click', (e) => {
      e.stopPropagation();
      malusToggle.classList.toggle('active');
      if (malusField) {
        malusField.classList.toggle('visible');
      }
      this.debouncedSaveExpanded();
    });

    // Price input listener
    const priceInput = this.shadow.querySelector('#bkk-price') as HTMLInputElement | null;
    const priceResetBtn = this.shadow.querySelector('#bkk-price-reset');
    priceInput?.addEventListener('click', (e) => e.stopPropagation());
    priceInput?.addEventListener('input', () => {
      const newPrice = this.safeParseInt(priceInput.value, this.originalPrice);
      if (newPrice !== this.originalPrice) {
        this.customPrice = newPrice;
        priceInput.classList.add('modified');
        priceResetBtn?.classList.add('visible');
      } else {
        this.customPrice = null;
        priceInput.classList.remove('modified');
        priceResetBtn?.classList.remove('visible');
      }
      this.recalculateWithCustomPrice();
    });

    // Price reset button
    priceResetBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.customPrice = null;
      if (priceInput) {
        priceInput.value = this.originalPrice.toString();
        priceInput.classList.remove('modified');
      }
      priceResetBtn.classList.remove('visible');
      this.recalculateWithCustomPrice();
    });

    // Attach drag listeners to header
    this.attachDragListeners(header);

    // Start entry animations only on first render for this vehicle
    if (!this.hasAnimatedEntry) {
      this.hasAnimatedEntry = true;
      requestAnimationFrame(() => {
        this.startEntryAnimations();
      });
    }
  }

  /**
   * Renders the methodology/calculation explanation view
   */
  private renderMethodology(): void {
    this.shadow.innerHTML = `
      <style>${overlayStyles}</style>
      <div class="bkk-overlay bkk-methodology-view">
        <div class="bkk-header">
          <div class="bkk-logo">
            <div class="bkk-logo-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="4" y="2" width="16" height="20" rx="2"/>
                <rect x="7" y="5" width="10" height="4" rx="1"/>
                <circle cx="8" cy="13" r="1" fill="currentColor"/>
                <circle cx="12" cy="13" r="1" fill="currentColor"/>
                <circle cx="16" cy="13" r="1" fill="currentColor"/>
                <circle cx="8" cy="17" r="1" fill="currentColor"/>
                <circle cx="12" cy="17" r="1" fill="currentColor"/>
                <circle cx="16" cy="17" r="1" fill="currentColor"/>
              </svg>
            </div>
            Bilkostnadskalkyl
          </div>
          <button class="bkk-close" data-action="close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="bkk-content bkk-methodology-content">
          <div class="bkk-methodology-intro">
            <p>Bilkostnadskalkyl ger dig en <strong>uppskattning</strong> av vad det kostar att äga en bil. Siffrorna baseras på generella antaganden och kan avvika betydligt från dina verkliga kostnader.</p>
          </div>

          <div class="bkk-methodology-section">
            <h3>Värdeminskning</h3>
            <p>Vi beräknar värdeminskning med en förenklad modell:</p>
            <ul>
              <li><strong>År 1:</strong> 15% av köpeskillingen</li>
              <li><strong>Följande år:</strong> 12% av kvarvarande värde</li>
            </ul>
            <div class="bkk-methodology-note">
              <strong>Obs!</strong> Verklig värdeminskning varierar kraftigt beroende på märke, modell, miltal och marknad. Vissa bilar tappar 25% första året, andra bara 5%.
            </div>
          </div>

          <div class="bkk-methodology-section">
            <h3>Underhåll</h3>
            <p>Baseras på fordonstyp och körsträcka:</p>
            <ul>
              <li><strong>Liten bil:</strong> ~5 000 kr/år vid 1 500 mil</li>
              <li><strong>Normal bil:</strong> ~8 000 kr/år vid 1 500 mil</li>
              <li><strong>Stor bil/SUV:</strong> ~12 000 kr/år vid 1 500 mil</li>
            </ul>
            <div class="bkk-methodology-note">
              <strong>Obs!</strong> Detta är grova uppskattningar. Verkliga kostnader beror på bilens ålder, tillförlitlighet och om du använder auktoriserad verkstad.
            </div>
          </div>

          <div class="bkk-methodology-section">
            <h3>Bränsle</h3>
            <p>Beräknas utifrån:</p>
            <ul>
              <li>Din angivna körsträcka</li>
              <li>Aktuellt bränslepris (justerbart)</li>
              <li>Uppskattad förbrukning om den saknas i annonsen</li>
            </ul>
          </div>

          <div class="bkk-methodology-section">
            <h3>Däck</h3>
            <p>Däckbyte vart 3-5 år beroende på körsträcka. Kostnaden baseras på fordonstyp:</p>
            <ul>
              <li><strong>Liten bil:</strong> ~4 000 kr per byte</li>
              <li><strong>Normal bil:</strong> ~6 000 kr per byte</li>
              <li><strong>Stor bil/SUV:</strong> ~10 000 kr per byte</li>
            </ul>
          </div>

          <div class="bkk-methodology-section">
            <h3>Övriga kostnader</h3>
            <ul>
              <li><strong>Försäkring & Skatt:</strong> Du anger själv</li>
              <li><strong>Parkering:</strong> Du anger själv</li>
              <li><strong>Finansiering:</strong> Beräknas på lånevillkor du anger</li>
            </ul>
          </div>

          <div class="bkk-methodology-sources">
            <h3>Bättre uppskattningar</h3>
            <p>För mer exakta siffror, kolla:</p>
            <ul>
              <li><a href="https://www.bilpriser.se" target="_blank" rel="noopener">Bilpriser.se</a> – Verklig värdeminskning per modell</li>
              <li><a href="https://www.transportstyrelsen.se" target="_blank" rel="noopener">Transportstyrelsen</a> – Exakt fordonsskatt</li>
              <li>Din försäkringsgivare – Exakt premie</li>
            </ul>
          </div>
        </div>

        <div class="bkk-footer">
          <button class="bkk-back-btn" data-action="back">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            Tillbaka till kalkylen
          </button>
        </div>
      </div>
    `;

    // Back button
    this.shadow.querySelectorAll('[data-action="back"]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setViewState('expanded');
      });
    });

    // Close button
    this.shadow.querySelector('[data-action="close"]')?.addEventListener('click', () => {
      this.setViewState('collapsed');
    });
  }

  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  /**
   * Debounced save for expanded view inline editing
   */
  private debouncedSaveExpanded(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.saveExpandedSettings();
    }, 300);
  }

  /**
   * Recalculates costs when price is changed
   * Updates the UI without saving to storage (price is per-session)
   */
  private recalculateWithCustomPrice(): void {
    // Create a modified vehicle data with custom price
    const modifiedVehicleData = {
      ...this.vehicleData,
      purchasePrice: this.customPrice ?? this.originalPrice,
    };

    // Recalculate costs
    const input = createCalculatorInput(modifiedVehicleData, this.preferences);
    const newCosts = calculateCosts(input);
    this.costs = newCosts;

    // Update the summary display
    const mainCostValue = this.shadow.querySelector('.bkk-value');
    const secondaryCost = this.shadow.querySelector('.bkk-secondary');
    if (mainCostValue) {
      mainCostValue.textContent = this.formatNumber(newCosts.monthlyTotal);
    }
    if (secondaryCost) {
      secondaryCost.textContent = `${this.formatNumber(newCosts.totalAnnual)} kr/år · ${newCosts.costPerMil} kr/mil`;
    }

    // Update the breakdown section if visible
    const breakdownSection = this.shadow.querySelector('.bkk-section.bkk-breakdown-section .bkk-section-content');
    if (breakdownSection) {
      breakdownSection.innerHTML = this.renderBreakdown();
    }
  }

  /**
   * Safely parses an integer, returning fallback for NaN or null/undefined inputs
   */
  private safeParseInt(value: string | undefined, fallback: number): number {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? fallback : parsed;
  }

  /**
   * Safely parses a float, returning fallback for NaN or null/undefined inputs
   * Supports both comma and period as decimal separators (Swedish/international)
   */
  private safeParseFloat(value: string | undefined, fallback: number): number {
    if (value === undefined || value === null || value === '') return fallback;
    // Replace comma with period to support Swedish decimal format
    const normalized = value.replace(',', '.');
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? fallback : parsed;
  }

  /**
   * Sanitizes a numeric input field on blur:
   * - Removes leading zeros (except for "0" itself)
   * - Enforces minimum value from min attribute
   * - Formats decimal values consistently
   * @param input - The input element to sanitize
   */
  private sanitizeNumericInput(input: HTMLInputElement): void {
    const value = input.value.trim();
    if (value === '') return;

    // Check if this is a decimal input (text input with decimal pattern)
    const isDecimal = input.type === 'text' && input.inputMode === 'decimal';

    if (isDecimal) {
      // Handle decimal inputs (like interest rate)
      const normalized = value.replace(',', '.');
      const parsed = parseFloat(normalized);
      if (!isNaN(parsed)) {
        // Format with comma for Swedish locale
        input.value = parsed.toString().replace('.', ',');
      }
    } else {
      // Handle integer inputs
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed)) {
        // Get minimum value from attribute
        const min = input.min ? parseInt(input.min, 10) : 0;
        // Enforce minimum and remove leading zeros
        const sanitized = Math.max(parsed, min);
        input.value = sanitized.toString();
      }
    }
  }

  /**
   * Saves settings from the expanded view's inline sections
   */
  private saveExpandedSettings(): void {
    const fuelType = this.vehicleData.fuelType.toLowerCase();
    const isElectric = fuelType === 'el';
    const isPluginHybrid = fuelType === 'laddhybrid';

    const mileage = this.shadow.querySelector('#bkk-mileage') as HTMLInputElement | null;
    const years = this.shadow.querySelector('#bkk-years') as HTMLInputElement | null;
    const fuelPrice = this.shadow.querySelector('#bkk-fuel-price') as HTMLInputElement | null;
    const elPrice = this.shadow.querySelector('#bkk-el-price') as HTMLInputElement | null;
    const elShare = this.shadow.querySelector('#bkk-el-share') as HTMLInputElement | null;
    const insurance = this.shadow.querySelector('#bkk-insurance') as HTMLInputElement | null;
    const tax = this.shadow.querySelector('#bkk-tax') as HTMLInputElement | null;
    const parking = this.shadow.querySelector('#bkk-parking') as HTMLInputElement | null;
    const tires = this.shadow.querySelector('#bkk-tires') as HTMLInputElement | null;

    // Financing fields
    const activeToggle = this.shadow.querySelector('#bkk-financing-toggle button.active') as HTMLElement | null;
    const financingType = (activeToggle?.dataset.value as 'cash' | 'loan') ?? this.preferences.financingType;
    const activeLoanTypeToggle = this.shadow.querySelector('#bkk-loan-type-toggle button.active') as HTMLElement | null;
    const loanType = (activeLoanTypeToggle?.dataset.value as 'residual' | 'annuity') ?? this.preferences.loanType ?? 'residual';
    const downPayment = this.shadow.querySelector('#bkk-down-payment') as HTMLInputElement | null;
    const residualValue = this.shadow.querySelector('#bkk-residual-value') as HTMLInputElement | null;
    const interestRate = this.shadow.querySelector('#bkk-interest-rate') as HTMLInputElement | null;
    const loanYears = this.shadow.querySelector('#bkk-loan-years') as HTMLInputElement | null;
    const adminFee = this.shadow.querySelector('#bkk-admin-fee') as HTMLInputElement | null;

    // Malus tax fields
    const malusToggle = this.shadow.querySelector('#bkk-malus-toggle');
    const malusInput = this.shadow.querySelector('#bkk-malus') as HTMLInputElement | null;

    const newPrefs: Partial<UserPreferences> = {
      annualMileage: this.safeParseInt(mileage?.value, this.preferences.annualMileage),
      ownershipYears: this.safeParseInt(years?.value, this.preferences.ownershipYears),
      insurance: this.safeParseInt(insurance?.value, 0),
      annualTax: this.safeParseInt(tax?.value, 0),
      parking: this.safeParseInt(parking?.value, 0),
      annualTireCost: tires?.value ? this.safeParseInt(tires.value, 0) : undefined,
      financingType,
      loanType,
      downPaymentPercent: this.safeParseInt(downPayment?.value, this.preferences.downPaymentPercent),
      residualValuePercent: this.safeParseInt(residualValue?.value, this.preferences.residualValuePercent),
      interestRate: this.safeParseFloat(interestRate?.value, this.preferences.interestRate),
      loanYears: this.safeParseInt(loanYears?.value, this.preferences.loanYears),
      monthlyAdminFee: this.safeParseInt(adminFee?.value, this.preferences.monthlyAdminFee ?? 60),
      hasMalusTax: malusToggle?.classList.contains('active') ?? this.preferences.hasMalusTax ?? false,
      malusTaxAmount: this.safeParseInt(malusInput?.value, this.preferences.malusTaxAmount ?? 0),
    };

    // Handle fuel prices based on vehicle type
    if (isElectric) {
      newPrefs.secondaryFuelPrice = this.safeParseFloat(fuelPrice?.value, this.preferences.secondaryFuelPrice);
    } else if (isPluginHybrid) {
      newPrefs.primaryFuelPrice = this.safeParseFloat(fuelPrice?.value, this.preferences.primaryFuelPrice);
      newPrefs.secondaryFuelPrice = this.safeParseFloat(elPrice?.value, this.preferences.secondaryFuelPrice);
      newPrefs.secondaryFuelShare = this.safeParseInt(elShare?.value, this.preferences.secondaryFuelShare);
      newPrefs.hasSecondaryFuel = true;
    } else {
      newPrefs.primaryFuelPrice = this.safeParseFloat(fuelPrice?.value, this.preferences.primaryFuelPrice);
    }

    // Merge with existing preferences
    const fullPrefs = { ...this.preferences, ...newPrefs };

    // Update local preferences immediately
    this.preferences = fullPrefs;

    // Recalculate costs with updated preferences
    const modifiedVehicleData = {
      ...this.vehicleData,
      purchasePrice: this.customPrice ?? this.originalPrice,
    };
    const input = createCalculatorInput(modifiedVehicleData, this.preferences);
    this.costs = calculateCosts(input);

    // Update display values directly (synchronous, immediate)
    this.updateDisplayValues();

    // Mark as self-update to prevent full re-render when storage change triggers
    this.isSelfUpdate = true;

    // Save to chrome.storage (async, for persistence)
    if (isExtensionContextValid()) {
      try {
        chrome.storage.sync.set({ bilkostnadskalkyl_preferences: fullPrefs });
      } catch {
        // Extension context invalidated, ignore silently
      }
    }
  }

  /**
   * Renders the cost breakdown items with visual bars, sorted by size
   */
  private renderBreakdown(): string {
    // Dynamic label based on fuel type
    const fuelType = this.vehicleData.fuelType.toLowerCase();
    const fuelLabel = fuelType === 'el' ? 'El' :
                      fuelType === 'laddhybrid' ? 'Bränsle + El' :
                      fuelType === 'hybrid' ? 'Bränsle' :
                      'Bränsle';

    // Depreciation info for tooltip
    const depreciationRate = this.preferences.depreciationRate;
    const depreciationInfo = depreciationRate === 'low' ? '10% år 1, 8% följande år' :
                             depreciationRate === 'high' ? '20% år 1, 15% följande år' :
                             '15% år 1, 12% följande år';

    // All cost items - always shown
    const items: Array<{label: string; value: number; color: string; estimated: boolean; tooltip: string | null}> = [
      { label: fuelLabel, value: this.costs.fuel, color: '#10b981', estimated: this.vehicleData.isEstimated.fuelConsumption, tooltip: null },
      { label: 'Värdeminskning', value: this.costs.depreciation, color: '#3b82f6', estimated: false, tooltip: `Beräknad med ${depreciationInfo}. Baserad på köpeskillingen ${this.formatNumber(this.vehicleData.purchasePrice)} kr under ${this.preferences.ownershipYears} års ägande.` },
      { label: 'Fordonsskatt', value: this.costs.tax, color: '#f59e0b', estimated: false, tooltip: null },
      { label: 'Underhåll', value: this.costs.maintenance, color: '#f97316', estimated: this.vehicleData.isEstimated.vehicleType, tooltip: null },
      { label: 'Däck', value: this.costs.tires, color: '#ef4444', estimated: this.vehicleData.isEstimated.vehicleType, tooltip: null },
      { label: 'Försäkring', value: this.costs.insurance, color: '#8b5cf6', estimated: false, tooltip: null },
      { label: 'Parkering', value: this.costs.parking, color: '#ec4899', estimated: false, tooltip: null },
    ];

    // Add financing if loan is selected
    if (this.preferences.financingType === 'loan') {
      const loanType = this.preferences.loanType ?? 'residual';
      const loanTypeName = loanType === 'residual' ? 'Restvärdelån' : 'Annuitetslån';
      const residualInfo = loanType === 'residual'
        ? ` Restvärde ${this.preferences.residualValuePercent ?? 50}%.`
        : '';
      items.push({
        label: 'Lån',
        value: this.costs.financing,
        color: '#06b6d4',
        estimated: false,
        tooltip: `${loanTypeName} med ${this.preferences.interestRate ?? 5.0}% ränta över ${this.preferences.loanYears ?? 3} år.${residualInfo}`
      });
    }

    // Filter out zero values and sort by value (largest first)
    const filteredItems = items.filter(item => item.value > 0);
    filteredItems.sort((a, b) => b.value - a.value);

    // Find max value for proportional bars
    const maxValue = Math.max(...filteredItems.map(item => item.value));

    return filteredItems.map(item => {
      const barWidth = Math.round((item.value / maxValue) * 100);
      const tooltipAttr = item.tooltip ? ` title="${item.tooltip}"` : '';
      return `
      <div class="bkk-breakdown-item"${tooltipAttr}>
        <div class="bkk-breakdown-bar" style="width: ${barWidth}%; background: ${item.color}"></div>
        <span class="bkk-label">${item.label}</span>
        <span class="bkk-amount ${item.estimated ? 'bkk-estimated' : ''}">${this.formatNumber(item.value)} kr</span>
      </div>
    `;
    }).join('');
  }

  /**
   * Sets the view state and re-renders
   */
  private setViewState(state: ViewState): void {
    this.viewState = state;
    this.render();

    // Save expanded preference
    if (state === 'expanded' || state === 'collapsed') {
      this.saveExpandedPreference(state === 'expanded');
    }
  }

  /**
   * Saves the expanded state preference
   */
  private saveExpandedPreference(expanded: boolean): void {
    if (!isExtensionContextValid()) return;

    try {
      chrome.storage.sync.get('bilkostnadskalkyl_preferences', (result) => {
        if (!isExtensionContextValid()) return;

        try {
          const prefs = result.bilkostnadskalkyl_preferences || {};
          prefs.overlayExpanded = expanded;
          chrome.storage.sync.set({ bilkostnadskalkyl_preferences: prefs });
        } catch {
          // Extension context invalidated, ignore silently
        }
      });
    } catch {
      // Extension context invalidated, ignore silently
    }
  }

  /**
   * Updates the overlay with new costs and preferences
   */
  public update(costs: CostBreakdown, preferences: UserPreferences): void {
    this.preferences = preferences;

    // If custom price is set, recalculate with custom price instead of using passed costs
    if (this.customPrice !== null) {
      const modifiedVehicleData = {
        ...this.vehicleData,
        purchasePrice: this.customPrice,
      };
      const input = createCalculatorInput(modifiedVehicleData, preferences);
      this.costs = calculateCosts(input);
    } else {
      this.costs = costs;
    }

    // Skip full re-render if this is a self-triggered update (from inline editing)
    if (this.isSelfUpdate) {
      this.isSelfUpdate = false;
      this.updateDisplayValues();
      return;
    }

    this.render();
  }

  /**
   * Updates only the display values without full re-render
   * Used when inline editing triggers a storage update
   */
  private updateDisplayValues(): void {
    // Update main cost display with animation
    const mainValue = this.shadow.querySelector('.bkk-value');
    if (mainValue) {
      const oldValue = mainValue.textContent;
      const newValue = this.formatNumber(this.costs.monthlyTotal);
      if (oldValue !== newValue) {
        mainValue.textContent = newValue;
        mainValue.classList.remove('bkk-value-updated');
        // Trigger reflow to restart animation
        void (mainValue as HTMLElement).offsetWidth;
        mainValue.classList.add('bkk-value-updated');
      }
    }

    // Update secondary values
    const secondary = this.shadow.querySelector('.bkk-secondary');
    if (secondary) {
      secondary.innerHTML = `${this.formatNumber(this.costs.totalAnnual)} kr/år · ${this.costs.costPerMil} kr/mil`;
    }

    // Update vehicle section summary (price)
    const vehicleSummary = this.shadow.querySelector('[data-section="vehicle"] .bkk-section-summary');
    if (vehicleSummary) {
      const currentPrice = this.customPrice ?? this.originalPrice;
      vehicleSummary.textContent = `${this.vehicleData.vehicleName || 'Okänt fordon'} · ${this.formatNumber(currentPrice)} kr`;
    }

    // Update section summaries
    const usageSummary = this.shadow.querySelector('[data-section="usage"] .bkk-section-summary');
    if (usageSummary) {
      usageSummary.textContent = `${this.formatNumber(this.preferences.annualMileage)} mil/år · ${this.preferences.ownershipYears} års ägande`;
    }

    const fuelType = this.vehicleData.fuelType.toLowerCase();
    const isElectric = fuelType === 'el';
    const isPluginHybrid = fuelType === 'laddhybrid';
    const fuelLabel = isElectric ? 'El' : isPluginHybrid ? 'Bensin + El' : 'Bensin';
    const fuelValue = isElectric ? this.preferences.secondaryFuelPrice : this.preferences.primaryFuelPrice;
    const fuelUnit = isElectric ? 'kr/kWh' : 'kr/l';
    const insuranceSummary = this.preferences.insurance > 0
      ? `Försäkring ${this.formatNumber(this.preferences.insurance)} kr/mån`
      : '';

    const costsSummary = this.shadow.querySelector('[data-section="costs"] .bkk-section-summary');
    if (costsSummary) {
      costsSummary.textContent = `${fuelLabel} ${fuelValue} ${fuelUnit}${insuranceSummary ? ` · ${insuranceSummary}` : ''}`;
    }

    // Update financing section summary
    const financingSummary = this.shadow.querySelector('[data-section="financing"] .bkk-section-summary');
    if (financingSummary) {
      if (this.preferences.financingType === 'loan') {
        financingSummary.textContent = `Billån · ${this.formatNumber(this.costs.monthlyLoanPayment)} kr/mån`;
      } else {
        financingSummary.textContent = 'Kontantköp';
      }
    }

    // Update loan summary box if visible
    const loanSummaryValue = this.shadow.querySelector('.bkk-loan-summary-value');
    if (loanSummaryValue) {
      loanSummaryValue.textContent = `${this.formatNumber(this.costs.monthlyLoanPayment)} kr/mån`;
    }

    // Update breakdown items (FÖRDELNING section)
    const breakdownContent = this.shadow.querySelector('.bkk-section.bkk-breakdown-section .bkk-section-content');
    if (breakdownContent) {
      breakdownContent.innerHTML = this.renderBreakdown();
    }
  }

  // ===============================
  // Drag Functionality
  // ===============================

  /**
   * Loads saved position from chrome.storage
   */
  private async loadPosition(): Promise<void> {
    return new Promise((resolve) => {
      if (!isExtensionContextValid()) {
        resolve();
        return;
      }

      try {
        chrome.storage.sync.get('bilkostnadskalkyl_position', (result) => {
          if (result.bilkostnadskalkyl_position) {
            this.position = result.bilkostnadskalkyl_position;
          }
          resolve();
        });
      } catch {
        // Extension context invalidated, resolve without position
        resolve();
      }
    });
  }

  /**
   * Saves current position to chrome.storage
   */
  private savePosition(): void {
    if (this.position && isExtensionContextValid()) {
      try {
        chrome.storage.sync.set({ bilkostnadskalkyl_position: this.position });
      } catch {
        // Extension context invalidated, ignore silently
      }
    }
  }

  /**
   * Applies saved position to container via inline styles
   * Ensures the overlay stays within viewport bounds
   */
  private applyPosition(): void {
    if (this.position) {
      // Get overlay dimensions (estimate for initial render)
      const rect = this.container.getBoundingClientRect();
      const overlayWidth = rect.width || 340; // fallback to typical width
      const overlayHeight = rect.height || 200; // fallback to typical height

      // Clamp position to viewport bounds with some padding
      const padding = 20;
      const maxX = window.innerWidth - overlayWidth - padding;
      const maxY = window.innerHeight - overlayHeight - padding;

      const clampedX = Math.max(padding, Math.min(this.position.x, maxX));
      const clampedY = Math.max(padding, Math.min(this.position.y, maxY));

      // Update stored position if it was out of bounds
      if (clampedX !== this.position.x || clampedY !== this.position.y) {
        this.position = { x: clampedX, y: clampedY };
        this.savePosition();
      }

      this.container.style.top = `${clampedY}px`;
      this.container.style.left = `${clampedX}px`;
      this.container.style.right = 'auto';
    }
  }

  /**
   * Starts dragging the overlay
   */
  private startDrag(e: MouseEvent): void {
    // Don't start drag on button clicks
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('.bkk-input')) {
      return;
    }

    e.preventDefault();
    this.isDragging = true;
    this.hasMoved = false;

    const rect = this.container.getBoundingClientRect();
    this.dragOffset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };

    document.addEventListener('mousemove', this.boundDrag);
    document.addEventListener('mouseup', this.boundStopDrag);
  }

  /**
   * Handles mouse movement during drag
   */
  private drag(e: MouseEvent): void {
    if (!this.isDragging) return;

    e.preventDefault();

    // Mark that actual movement occurred
    if (!this.hasMoved) {
      this.hasMoved = true;
      this.container.classList.add('dragging');
    }

    let newX = e.clientX - this.dragOffset.x;
    let newY = e.clientY - this.dragOffset.y;

    // Keep within viewport bounds
    const rect = this.container.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width;
    const maxY = window.innerHeight - rect.height;

    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));

    this.position = { x: newX, y: newY };
    this.applyPosition();
  }

  /**
   * Stops dragging and saves position
   */
  private stopDrag(): void {
    if (!this.isDragging) return;

    const didMove = this.hasMoved;

    this.isDragging = false;
    this.container.classList.remove('dragging');

    document.removeEventListener('mousemove', this.boundDrag);
    document.removeEventListener('mouseup', this.boundStopDrag);

    // Only save position if there was actual movement
    if (didMove) {
      this.savePosition();
      // Reset hasMoved after click event would have fired
      setTimeout(() => {
        this.hasMoved = false;
      }, 0);
    }
  }

  /**
   * Attaches drag listeners to the given element
   */
  private attachDragListeners(element: Element | null): void {
    if (element) {
      element.classList.add('bkk-drag-handle');
      element.addEventListener('mousedown', (e) => this.startDrag(e as MouseEvent));
    }
  }

  /**
   * Resets overlay position to default (top-right)
   */
  public resetPosition(): void {
    this.position = null;
    this.container.style.top = '';
    this.container.style.left = '';
    this.container.style.right = '';

    if (isExtensionContextValid()) {
      try {
        chrome.storage.sync.remove('bilkostnadskalkyl_position');
      } catch {
        // Extension context invalidated, ignore silently
      }
    }
  }

  /**
   * Removes the overlay from DOM
   */
  public destroy(): void {
    // Clean up event listeners
    document.removeEventListener('mousemove', this.boundDrag);
    document.removeEventListener('mouseup', this.boundStopDrag);
    document.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('resize', this.boundResize);
    this.container.remove();
  }

  /**
   * Handles keyboard events for navigation
   * @param e - Keyboard event
   */
  private handleKeyDown(e: KeyboardEvent): void {
    // Escape key closes/collapses the overlay
    if (e.key === 'Escape') {
      if (this.viewState === 'expanded') {
        this.setViewState('collapsed');
      }
    }
  }

  /**
   * Handles window resize to keep overlay in viewport
   */
  private handleResize(): void {
    if (this.position) {
      this.applyPosition();
    }
  }

  /**
   * Copies cost summary to clipboard
   */
  private async copyToClipboard(): Promise<void> {
    const summary = this.generateCostSummary();

    try {
      await navigator.clipboard.writeText(summary);

      // Update button to show success
      const copyBtn = this.shadow.querySelector('[data-action="copy"]');
      const copyText = this.shadow.querySelector('.bkk-copy-text');
      if (copyBtn && copyText) {
        copyBtn.classList.add('copied');
        copyText.textContent = 'Kopierat!';

        // Reset after 2 seconds
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          copyText.textContent = 'Kopiera sammanfattning';
        }, 2000);
      }
    } catch (err) {
      console.error('[Bilkostnadskalkyl] Failed to copy:', err);
    }
  }

  /**
   * Generates a text summary of costs for clipboard
   * @returns Formatted cost summary string
   */
  private generateCostSummary(): string {
    const lines = [
      `Bilkostnadskalkyl - ${this.formatNumber(this.vehicleData.purchasePrice)} kr`,
      '',
      `Total kostnad: ${this.formatNumber(this.costs.monthlyTotal)} kr/mån`,
      `Årlig kostnad: ${this.formatNumber(this.costs.totalAnnual)} kr`,
      `Kostnad per mil: ${this.costs.costPerMil} kr`,
      '',
      'Kostnadsfördelning per år:',
      `• Bränsle: ${this.formatNumber(this.costs.fuel)} kr`,
      `• Värdeminskning: ${this.formatNumber(this.costs.depreciation)} kr`,
      `• Fordonsskatt: ${this.formatNumber(this.costs.tax)} kr`,
      `• Underhåll: ${this.formatNumber(this.costs.maintenance)} kr`,
      `• Däck: ${this.formatNumber(this.costs.tires)} kr`,
      `• Försäkring: ${this.formatNumber(this.costs.insurance)} kr`,
    ];

    if (this.costs.parking > 0) {
      lines.push(`• Parkering: ${this.formatNumber(this.costs.parking)} kr`);
    }
    if (this.costs.financing > 0) {
      lines.push(`• Finansiering: ${this.formatNumber(this.costs.financing)} kr`);
      lines.push(`  (Lån: ${this.formatNumber(this.preferences.loanAmount)} kr, ${this.preferences.interestRate}%, ${this.preferences.loanYears} år)`);
    }

    lines.push('', `Beräknat för ${this.preferences.annualMileage} mil/år under ${this.preferences.ownershipYears} år`);

    return lines.join('\n');
  }

  /**
   * Exports cost summary as a printable PDF
   */
  private exportToPDF(): void {
    const vehicleName = this.vehicleData.vehicleName || 'Bil';
    const fuelType = this.vehicleData.fuelType.toLowerCase();
    const fuelLabel = fuelType === 'el' ? 'El' :
                      fuelType === 'laddhybrid' ? 'Bränsle + El' : 'Bränsle';

    // Build breakdown items
    const breakdownItems = [
      { label: fuelLabel, value: this.costs.fuel },
      { label: 'Värdeminskning', value: this.costs.depreciation },
      { label: 'Fordonsskatt', value: this.costs.tax },
      { label: 'Underhåll', value: this.costs.maintenance },
      { label: 'Däck', value: this.costs.tires },
      { label: 'Försäkring', value: this.costs.insurance },
      { label: 'Parkering', value: this.costs.parking },
    ];

    if (this.preferences.financingType === 'loan') {
      breakdownItems.push({ label: 'Lånekostnad', value: this.costs.financing });
    }

    const breakdownHTML = breakdownItems
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .map(item => `
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${item.label}</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 500;">
            ${this.formatNumber(item.value)} kr
          </td>
        </tr>
      `).join('');

    const loanInfo = this.preferences.financingType === 'loan' ? `
      <div style="margin-top: 20px; padding: 16px; background: #f0fdf4; border-radius: 8px; border: 1px solid #86efac;">
        <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #166534;">Finansiering</h3>
        <p style="margin: 0; font-size: 13px; color: #15803d;">
          ${this.preferences.loanType === 'residual' ? 'Restvärdelån' : 'Annuitetslån'} ·
          ${this.preferences.downPaymentPercent}% kontantinsats ·
          ${this.preferences.interestRate}% ränta ·
          ${this.preferences.loanYears} år
          ${this.preferences.loanType === 'residual' ? ` · ${this.preferences.residualValuePercent}% restvärde` : ''}
        </p>
        <p style="margin: 10px 0 0 0; font-size: 16px; font-weight: 600; color: #166534;">
          Månadskostnad lån: ${this.formatNumber(this.costs.monthlyLoanPayment)} kr/mån
        </p>
      </div>
    ` : '';

    const html = `
      <!DOCTYPE html>
      <html lang="sv">
      <head>
        <meta charset="UTF-8">
        <title>Bilkostnadskalkyl - ${vehicleName}</title>
        <style>
          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 600px;
            margin: 40px auto;
            padding: 20px;
            color: #1f2937;
          }
          .header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #10b981;
          }
          .logo {
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, #10b981, #059669);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .summary {
            text-align: center;
            padding: 30px;
            background: linear-gradient(135deg, #f0fdf4, #ecfdf5);
            border-radius: 12px;
            margin-bottom: 30px;
          }
          .main-cost {
            font-size: 42px;
            font-weight: 700;
            color: #10b981;
          }
          .secondary {
            margin-top: 8px;
            color: #6b7280;
          }
          .table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            font-size: 12px;
            color: #9ca3af;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <rect x="4" y="2" width="16" height="20" rx="2"/>
              <rect x="7" y="5" width="10" height="4" rx="1"/>
              <circle cx="8" cy="13" r="1" fill="white"/>
              <circle cx="12" cy="13" r="1" fill="white"/>
              <circle cx="16" cy="13" r="1" fill="white"/>
            </svg>
          </div>
          <div>
            <h1 style="margin: 0; font-size: 18px;">Bilkostnadskalkyl</h1>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #6b7280;">${vehicleName}</p>
          </div>
        </div>

        <div style="margin-bottom: 20px;">
          <p style="margin: 0; font-size: 14px; color: #6b7280;">
            Köpesumma: <strong style="color: #1f2937;">${this.formatNumber(this.vehicleData.purchasePrice)} kr</strong>
          </p>
        </div>

        <div class="summary">
          <div class="main-cost">${this.formatNumber(this.costs.monthlyTotal)} kr/mån</div>
          <div class="secondary">
            ${this.formatNumber(this.costs.totalAnnual)} kr/år · ${this.costs.costPerMil} kr/mil
          </div>
        </div>

        <div>
          <h2 style="font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">
            Kostnadsfördelning per år
          </h2>
          <table class="table">
            ${breakdownHTML}
            <tr style="font-weight: 600;">
              <td style="padding: 12px 0;">Totalt per år</td>
              <td style="padding: 12px 0; text-align: right; color: #10b981;">
                ${this.formatNumber(this.costs.totalAnnual)} kr
              </td>
            </tr>
          </table>
        </div>

        ${loanInfo}

        <div class="footer">
          <p>Beräknat för ${this.formatNumber(this.preferences.annualMileage)} mil/år under ${this.preferences.ownershipYears} år</p>
          <p>Genererat ${new Date().toLocaleDateString('sv-SE')} med Bilkostnadskalkyl</p>
        </div>
      </body>
      </html>
    `;

    // Open in new window for printing
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      // Wait for content to load then trigger print
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  }

  /**
   * Opens feedback form/email
   */
  private openFeedback(): void {
    const subject = encodeURIComponent('Feedback: Bilkostnadskalkyl Chrome Extension');
    const body = encodeURIComponent(
      `Hej!\n\nJag vill ge feedback på Bilkostnadskalkyl:\n\n` +
      `[Skriv din feedback här]\n\n` +
      `---\n` +
      `Teknisk info:\n` +
      `- URL: ${window.location.href}\n` +
      `- Bilpris: ${this.formatNumber(this.vehicleData.purchasePrice)} kr\n` +
      `- Drivmedel: ${this.vehicleData.fuelType}\n`
    );

    // Open mailto link
    window.open(`mailto:feedback@bilkostnadskalkyl.se?subject=${subject}&body=${body}`, '_blank');
  }

  /**
   * Formats a number with Swedish locale
   */
  private formatNumber(value: number): string {
    return value.toLocaleString('sv-SE');
  }

  /**
   * Animates a number counting up from 0 to target value
   * @param element - The element to update
   * @param targetValue - The final number to reach
   * @param duration - Animation duration in ms
   * @param suffix - Optional suffix to append (e.g., " kr")
   */
  private animateCounter(
    element: Element,
    targetValue: number,
    duration: number = 800,
    suffix: string = ''
  ): void {
    const startTime = performance.now();
    const startValue = 0;

    const easeOutQuart = (t: number): number => 1 - Math.pow(1 - t, 4);

    const updateCounter = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutQuart(progress);

      const currentValue = Math.round(startValue + (targetValue - startValue) * easedProgress);
      element.textContent = this.formatNumber(currentValue) + suffix;

      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      }
    };

    requestAnimationFrame(updateCounter);
  }

  /**
   * Starts all entry animations for the expanded view
   */
  private startEntryAnimations(): void {
    // Animate main cost value
    const mainValue = this.shadow.querySelector('.bkk-value');
    if (mainValue) {
      this.animateCounter(mainValue, this.costs.monthlyTotal, 900);
    }

    // Animate secondary values
    const secondary = this.shadow.querySelector('.bkk-secondary');
    if (secondary) {
      const annualEl = document.createElement('span');
      const milEl = document.createElement('span');
      secondary.innerHTML = '';
      secondary.appendChild(annualEl);
      secondary.appendChild(document.createTextNode(' · '));
      secondary.appendChild(milEl);

      setTimeout(() => {
        this.animateCounter(annualEl, this.costs.totalAnnual, 800, ' kr/år');
      }, 100);
      setTimeout(() => {
        this.animateCounter(milEl, this.costs.costPerMil, 700, ' kr/mil');
      }, 200);
    }

    // Animate breakdown amounts
    const amounts = this.shadow.querySelectorAll('.bkk-amount');
    amounts.forEach((amount, index) => {
      const text = amount.textContent || '';
      const isEstimated = amount.classList.contains('bkk-estimated');
      const value = parseInt(text.replace(/[^\d]/g, ''), 10);
      if (!isNaN(value)) {
        amount.textContent = isEstimated ? '~0 kr' : '0 kr';
        setTimeout(() => {
          this.animateCounter(amount, value, 600, ' kr');
          // Re-add estimated prefix if needed
          if (isEstimated) {
            const originalText = amount.textContent || '';
            amount.textContent = '~' + originalText.replace('~', '');
          }
        }, 150 + index * 50);
      }
    });

    // Animate loan summary if visible
    const loanSummary = this.shadow.querySelector('.bkk-loan-summary-value');
    if (loanSummary && this.preferences.financingType === 'loan') {
      setTimeout(() => {
        this.animateCounter(loanSummary, this.costs.monthlyLoanPayment, 700, ' kr/mån');
      }, 300);
    }
  }

  /**
   * Checks if any values are estimated
   */
  private hasEstimatedValues(): boolean {
    return this.vehicleData.isEstimated.fuelConsumption ||
           this.vehicleData.isEstimated.vehicleType;
  }
}
