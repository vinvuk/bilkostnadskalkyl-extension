/**
 * Tests for fuel type detection logic
 * Verifies that electric vehicles are correctly identified
 */

import { describe, it, expect } from 'vitest';

/**
 * Simulates the isElectricVehicle logic from overlay.ts
 */
function isElectricVehicle(fuelType: string, fuelTypeLabel: string | null): boolean {
  const ft = fuelType.toLowerCase();
  const label = fuelTypeLabel?.toLowerCase() || '';

  return ft === 'el' ||
         ft === 'electric' ||
         ft === 'elbil' ||
         label.includes('elbil') ||
         label === 'el' ||
         label === '100% el';
}

/**
 * Simulates mapBlocketFuelCode from blocket.ts
 */
function mapBlocketFuelCode(code: string): string | null {
  const fuelMap: Record<string, string> = {
    '1': 'bensin',
    '2': 'diesel',
    '3': 'el',
    '4': 'hybrid',
    '5': 'laddhybrid',
    '6': 'e85',
    '7': 'gas',
    '8': 'gas',
    '9': 'gas',
    '10': 'laddhybrid',
    '11': 'hvo',
  };
  return fuelMap[code] || null;
}

/**
 * Simulates text-based fuel detection from blocket.ts
 */
function detectFuelFromText(text: string): string | null {
  const fuelPatterns = [
    { pattern: /\belbil\b|100%?\s*el\b|electric/i, type: 'el' },
    { pattern: /\bladdhybrid\b|plug-?in\s*hybrid|phev/i, type: 'laddhybrid' },
    { pattern: /\bhybrid\b|elhybrid|mild\s*hybrid/i, type: 'hybrid' },
    { pattern: /\bhvo\b|hvo100/i, type: 'hvo' },
    { pattern: /\bdiesel\b/i, type: 'diesel' },
    { pattern: /\bbensin\b|petrol/i, type: 'bensin' },
    { pattern: /\be85\b|\betanol\b/i, type: 'e85' },
    { pattern: /\bfordonsgas\b|\bbiogas\b|\bcng\b|\bgas\b/i, type: 'gas' },
  ];

  for (const { pattern, type } of fuelPatterns) {
    if (pattern.test(text)) {
      return type;
    }
  }
  return null;
}

describe('Blocket Fuel Code Mapping', () => {
  it('should map code 3 to el', () => {
    expect(mapBlocketFuelCode('3')).toBe('el');
  });

  it('should map all known codes correctly', () => {
    expect(mapBlocketFuelCode('1')).toBe('bensin');
    expect(mapBlocketFuelCode('2')).toBe('diesel');
    expect(mapBlocketFuelCode('3')).toBe('el');
    expect(mapBlocketFuelCode('4')).toBe('hybrid');
    expect(mapBlocketFuelCode('5')).toBe('laddhybrid');
  });
});

describe('Text-based Fuel Detection', () => {
  it('should detect "elbil" as electric', () => {
    expect(detectFuelFromText('Tesla Model 3 Elbil')).toBe('el');
    expect(detectFuelFromText('Volvo EX30 elbil')).toBe('el');
  });

  it('should detect "100% el" as electric', () => {
    expect(detectFuelFromText('Drivmedel: 100% El')).toBe('el');
    expect(detectFuelFromText('100% el')).toBe('el');
  });

  it('should detect "electric" as electric', () => {
    expect(detectFuelFromText('Electric vehicle')).toBe('el');
  });

  it('should NOT detect hybrid as electric', () => {
    expect(detectFuelFromText('Hybrid')).toBe('hybrid');
    expect(detectFuelFromText('Elhybrid')).toBe('hybrid');
    expect(detectFuelFromText('Mild hybrid')).toBe('hybrid');
  });

  it('should detect laddhybrid correctly', () => {
    expect(detectFuelFromText('Laddhybrid')).toBe('laddhybrid');
    expect(detectFuelFromText('Plug-in hybrid')).toBe('laddhybrid');
    expect(detectFuelFromText('PHEV')).toBe('laddhybrid');
  });
});

describe('Electric Vehicle Detection (overlay logic)', () => {
  // Test cases based on actual Blocket data
  const electricCases = [
    { fuelType: 'el', label: null, desc: 'fuelType=el, no label' },
    { fuelType: 'el', label: 'El', desc: 'fuelType=el, label=El' },
    { fuelType: 'el', label: 'Elbil', desc: 'fuelType=el, label=Elbil' },
    { fuelType: 'el', label: '100% El', desc: 'fuelType=el, label=100% El' },
    { fuelType: 'electric', label: null, desc: 'fuelType=electric' },
    { fuelType: 'elbil', label: null, desc: 'fuelType=elbil' },
  ];

  electricCases.forEach(({ fuelType, label, desc }) => {
    it(`should detect as electric: ${desc}`, () => {
      expect(isElectricVehicle(fuelType, label)).toBe(true);
    });
  });

  // Non-electric cases
  const nonElectricCases = [
    { fuelType: 'bensin', label: 'Bensin', desc: 'Bensin' },
    { fuelType: 'diesel', label: 'Diesel', desc: 'Diesel' },
    { fuelType: 'hybrid', label: 'Hybrid', desc: 'Hybrid (not plug-in)' },
    { fuelType: 'hybrid', label: 'Elhybrid', desc: 'Elhybrid (not pure EV)' },
    { fuelType: 'laddhybrid', label: 'Laddhybrid', desc: 'Laddhybrid' },
    { fuelType: 'laddhybrid', label: 'Bensin/El', desc: 'Bensin/El (plug-in)' },
  ];

  nonElectricCases.forEach(({ fuelType, label, desc }) => {
    it(`should NOT detect as electric: ${desc}`, () => {
      expect(isElectricVehicle(fuelType, label)).toBe(false);
    });
  });
});

describe('Edge Cases', () => {
  it('should handle empty strings', () => {
    expect(isElectricVehicle('', '')).toBe(false);
    expect(isElectricVehicle('', null)).toBe(false);
  });

  it('should handle case variations', () => {
    expect(isElectricVehicle('EL', null)).toBe(true);
    expect(isElectricVehicle('El', null)).toBe(true);
    expect(isElectricVehicle('eL', null)).toBe(true);
  });

  it('should handle label containing elbil in longer string', () => {
    expect(isElectricVehicle('bensin', 'Tesla Elbil Premium')).toBe(true);
  });
});
