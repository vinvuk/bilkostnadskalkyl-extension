import { describe, expect, it } from 'vitest';
import { classifyBlocketLeasing } from './blocket';

describe('Blocket leasing classification', () => {
  it('keeps a purchase listing even when surrounding content mentions leasing', () => {
    expect(classifyBlocketLeasing('Begagnad bil till salu', 'ID.4 Privatleasing erbjuds också', 'leasing')).toBe(false);
  });
  it('recognizes explicit leasing sale type', () => {
    expect(classifyBlocketLeasing('Privatleasing', 'ID.4', 'bilar')).toBe(true);
  });
  it('falls back to listing category and title when sale type is absent', () => {
    expect(classifyBlocketLeasing('', 'ID.4', 'leasing')).toBe(true);
    expect(classifyBlocketLeasing('', 'ID.4 Privatleasing', 'bilar')).toBe(true);
    expect(classifyBlocketLeasing('', 'ID.4', 'bilar')).toBe(false);
  });
});
