/**
 * Unit tests for anonymous PostHog tracker with consent gating.
 * Verifies that the tracker only sends events when consent is granted,
 * and that events are captured with the expected payload.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockLoadConsent } = vi.hoisted(() => ({
  mockLoadConsent: vi.fn(),
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

// Track fetch calls to PostHog Capture API
const mockFetch = vi.fn().mockResolvedValue({ ok: true });
vi.stubGlobal('fetch', mockFetch);

import { initTrackerIfConsented, enableTracker, disableTracker, trackEvent, resetTrackerState } from './tracker';

describe('Anonymous PostHog Tracker with Consent', () => {
  beforeEach(() => {
    mockLoadConsent.mockReset();
    mockFetch.mockClear();
    resetTrackerState();
  });

  it('should not send events when consent is null (undecided)', async () => {
    mockLoadConsent.mockResolvedValue(null);
    await initTrackerIfConsented();

    trackEvent('ext_overlay_shown');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should not send events when consent is false (opted out)', async () => {
    mockLoadConsent.mockResolvedValue(false);
    await initTrackerIfConsented();

    trackEvent('ext_overlay_shown');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should send events when consent is true (opted in)', async () => {
    mockLoadConsent.mockResolvedValue(true);
    await initTrackerIfConsented();

    trackEvent('ext_overlay_shown', { site: 'blocket', viewCount: 3 });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://eu.i.posthog.com/capture/');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');

    const payload = JSON.parse(options.body);
    expect(payload.api_key).toBe('phc_bxqRsVpWs3mENNvluG19JKMyt4pH5j4q6ujmLJw7nfY');
    expect(payload.event).toBe('ext_overlay_shown');
    expect(payload.properties.distinct_id).toBe('anon');
    expect(payload.properties.$ip).toBeNull();
    expect(payload.properties.site).toBe('blocket');
    expect(payload.properties.viewCount).toBe(3);
    expect(payload.properties.source).toBe('extension');
    expect(payload.properties.extension_version).toBe('1.3.0');
    expect(payload.timestamp).toBeDefined();
  });

  it('should no-op trackEvent when consent not granted', async () => {
    mockLoadConsent.mockResolvedValue(null);
    await initTrackerIfConsented();

    trackEvent('ext_overlay_shown', { site: 'blocket', viewCount: 3 });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should stop capturing after disableTracker is called', async () => {
    mockLoadConsent.mockResolvedValue(true);
    await initTrackerIfConsented();

    disableTracker();
    trackEvent('ext_gate_submitted');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should resume capturing after re-enabling', async () => {
    mockLoadConsent.mockResolvedValue(true);
    await initTrackerIfConsented();

    disableTracker();
    enableTracker();
    trackEvent('ext_gate_submitted');

    expect(mockFetch).toHaveBeenCalledOnce();
    const payload = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(payload.event).toBe('ext_gate_submitted');
    expect(payload.properties.source).toBe('extension');
    expect(payload.properties.extension_version).toBe('1.3.0');
  });

  it('should send all expected event names correctly', async () => {
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
      mockFetch.mockClear();
      trackEvent(event);
      expect(mockFetch).toHaveBeenCalledOnce();
      const payload = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(payload.event).toBe(event);
      expect(payload.properties.source).toBe('extension');
    }
  });

  it('should use keepalive flag to survive page unloads', async () => {
    mockLoadConsent.mockResolvedValue(true);
    await initTrackerIfConsented();

    trackEvent('ext_overlay_shown');

    const [, options] = mockFetch.mock.calls[0];
    expect(options.keepalive).toBe(true);
  });
});
