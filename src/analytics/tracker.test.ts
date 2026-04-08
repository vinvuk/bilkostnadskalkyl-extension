/**
 * Unit tests for anonymous PostHog tracker with consent gating.
 * Verifies that the tracker only initializes when consent is granted,
 * and that events are captured with the expected properties.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted ensures these are available when vi.mock factory runs (hoisted above imports)
const { mockInit, mockCapture, mockLoadConsent } = vi.hoisted(() => ({
  mockInit: vi.fn(),
  mockCapture: vi.fn(),
  mockLoadConsent: vi.fn(),
}));

vi.mock('posthog-js', () => ({
  default: {
    init: mockInit,
    capture: mockCapture,
  },
}));

vi.mock('../storage/analyticsConsent', () => ({
  loadAnalyticsConsent: mockLoadConsent,
}));

// Mock chrome.runtime.getManifest
vi.stubGlobal('chrome', {
  runtime: {
    getManifest: () => ({ version: '1.3.0' }),
  },
});

// Import after mocks are set up
import { initTrackerIfConsented, enableTracker, disableTracker, trackEvent, resetTrackerState } from './tracker';

describe('Anonymous PostHog Tracker with Consent', () => {
  beforeEach(() => {
    mockInit.mockClear();
    mockCapture.mockClear();
    mockLoadConsent.mockReset();
    resetTrackerState();
  });

  it('should not initialize PostHog when consent is null (undecided)', async () => {
    mockLoadConsent.mockResolvedValue(null);
    await initTrackerIfConsented();

    expect(mockInit).not.toHaveBeenCalled();
  });

  it('should not initialize PostHog when consent is false (opted out)', async () => {
    mockLoadConsent.mockResolvedValue(false);
    await initTrackerIfConsented();

    expect(mockInit).not.toHaveBeenCalled();
  });

  it('should initialize PostHog when consent is true (opted in)', async () => {
    mockLoadConsent.mockResolvedValue(true);
    await initTrackerIfConsented();

    expect(mockInit).toHaveBeenCalledOnce();
    const [key, config] = mockInit.mock.calls[0];

    expect(key).toBe('phc_bxqRsVpWs3mENNvluG19JKMyt4pH5j4q6ujmLJw7nfY');
    expect(config.api_host).toBe('https://eu.i.posthog.com');
    expect(config.persistence).toBe('memory');
    expect(config.ip).toBe(false);
    expect(config.autocapture).toBe(false);
    expect(config.capture_pageview).toBe(false);
    expect(config.bootstrap.distinctID).toBe('anon');
    expect(config.disable_session_recording).toBe(true);
  });

  it('should no-op trackEvent when consent not granted', async () => {
    mockLoadConsent.mockResolvedValue(null);
    await initTrackerIfConsented();

    trackEvent('ext_overlay_shown', { site: 'blocket', viewCount: 3 });

    expect(mockCapture).not.toHaveBeenCalled();
  });

  it('should capture events after enableTracker is called', async () => {
    mockLoadConsent.mockResolvedValue(true);
    await initTrackerIfConsented();

    trackEvent('ext_overlay_shown', { site: 'blocket', viewCount: 3 });

    expect(mockCapture).toHaveBeenCalledWith('ext_overlay_shown', {
      site: 'blocket',
      viewCount: 3,
      source: 'extension',
      extension_version: '1.3.0',
    });
  });

  it('should stop capturing after disableTracker is called', async () => {
    mockLoadConsent.mockResolvedValue(true);
    await initTrackerIfConsented();

    disableTracker();
    trackEvent('ext_gate_submitted');

    expect(mockCapture).not.toHaveBeenCalled();
  });

  it('should resume capturing after re-enabling', async () => {
    mockLoadConsent.mockResolvedValue(true);
    await initTrackerIfConsented();

    disableTracker();
    enableTracker();
    trackEvent('ext_gate_submitted');

    expect(mockCapture).toHaveBeenCalledWith('ext_gate_submitted', {
      source: 'extension',
      extension_version: '1.3.0',
    });
  });

  it('should include all expected event names as valid strings', async () => {
    mockLoadConsent.mockResolvedValue(true);
    await initTrackerIfConsented();

    const expectedEvents = [
      'ext_overlay_shown',
      'ext_view_milestone',
      'ext_gate_shown',
      'ext_gate_submitted',
      'ext_gate_dismissed',
      'ext_auth_completed',
    ];

    for (const event of expectedEvents) {
      trackEvent(event);
      expect(mockCapture).toHaveBeenCalledWith(
        event,
        expect.objectContaining({ source: 'extension' })
      );
    }
  });
});
