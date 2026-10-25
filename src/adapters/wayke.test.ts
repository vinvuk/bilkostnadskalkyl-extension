import { afterEach, describe, expect, it, vi } from 'vitest';
import { isWaykeListingPage } from './wayke';

afterEach(() => vi.unstubAllGlobals());

describe('Wayke listing URL detection', () => {
  it.each([
    ['/objekt/30f58e62-4334-4cd5-b2cc-eb5be1f69237', true],
    ['/objekt/30f58e62-4334-4cd5-b2cc-eb5be1f69237/', true],
    ['/objekt/30f58e62-4334-4cd5-b2cc-eb5be1f69237/volkswagen-id4', true],
    ['/objekt/30f58e62-4334-4cd5-b2cc-eb5be1f69237invalid', false],
    ['/objekt/', false],
    ['/sok', false],
    ['/annons/volkswagen-id4', true],
  ])('detects %s as %s', (pathname, expected) => {
    vi.stubGlobal('window', { location: { hostname: 'www.wayke.se', pathname } });
    expect(isWaykeListingPage()).toBe(expected);
  });
});
