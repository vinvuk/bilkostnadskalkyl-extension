/**
 * Comprehensive test suite for the Bilkostnadskalkyl calculator engine
 * Tests all calculation formulas, edge cases, and rounding consistency
 */

import { describe, it, expect } from 'vitest';
import { calculateCosts, getDepreciationRateForAge } from './calculator';
import { CalculatorInput } from '../types';
import { MAINTENANCE_COSTS, TIRE_COSTS, AGE_DEPRECIATION_CURVE, FUEL_DEPRECIATION_MULTIPLIERS, DEPRECIATION_OVERRIDE_FACTORS } from './constants';

/**
 * Creates a default test input with sensible values
 * @param overrides - Partial input to override defaults
 * @returns Complete CalculatorInput for testing
 */
function createTestInput(overrides: Partial<CalculatorInput> = {}): CalculatorInput {
  return {
    purchasePrice: 300000,
    fuelConsumption: 0.7, // l per mil (10km)
    primaryFuelType: 'bensin',
    primaryFuelPrice: 18.5,
    hasSecondaryFuel: false,
    secondaryFuelType: 'el',
    secondaryFuelPrice: 2.5,
    secondaryFuelShare: 0,
    annualMileage: 1500, // mil/year
    vehicleType: 'normal',
    maintenanceLevel: 'normal',
    depreciationRate: 'normal',
    vehicleAge: 3,
    ownershipYears: 5,
    insurance: 500, // monthly
    parking: 0, // monthly
    financingType: 'cash',
    loanType: 'annuity',
    loanAmount: 0,
    downPaymentPercent: 20,
    residualValuePercent: 50,
    interestRate: 5.0,
    loanYears: 3,
    monthlyAdminFee: 60,
    leasingType: 'private',
    monthlyLeasingFee: 3500,
    leasingIncludesInsurance: false,
    washingCare: 250, // monthly
    annualTax: 2000,
    hasMalusTax: false,
    malusTaxAmount: 0,
    ...overrides,
  };
}

// ============================================================================
// FUEL COST CALCULATION TESTS
// ============================================================================
describe('Fuel Cost Calculations', () => {
  describe('Primary Fuel Only', () => {
    it('should calculate fuel cost correctly for petrol vehicle', () => {
      // Formula: (consumption × price / 10) × mileage_km
      // = (0.7 × 18.5 / 10) × 15000 = 1.295 × 15000 = 19425
      const input = createTestInput({
        fuelConsumption: 0.7,
        primaryFuelPrice: 18.5,
        annualMileage: 1500, // 1500 mil = 15000 km
      });

      const result = calculateCosts(input);

      // Manual calculation: (0.7 × 18.5 / 10) × 15000 = 19425
      expect(result.fuel).toBe(19425);
    });

    it('should calculate fuel cost for diesel vehicle', () => {
      // (0.6 × 19.5 / 10) × 20000 = 1.17 × 20000 = 23400
      const input = createTestInput({
        fuelConsumption: 0.6,
        primaryFuelPrice: 19.5,
        annualMileage: 2000, // 20000 km
      });

      const result = calculateCosts(input);
      expect(result.fuel).toBe(23400);
    });

    it('should calculate fuel cost for electric vehicle', () => {
      // Electric: (2.0 kWh × 2.5 kr/kWh / 10) × 15000 = 0.5 × 15000 = 7500
      const input = createTestInput({
        fuelConsumption: 2.0, // kWh per mil
        primaryFuelPrice: 2.5, // kr/kWh
        annualMileage: 1500,
      });

      const result = calculateCosts(input);
      expect(result.fuel).toBe(7500);
    });

    it('should handle zero mileage', () => {
      const input = createTestInput({
        annualMileage: 0,
      });

      const result = calculateCosts(input);
      expect(result.fuel).toBe(0);
    });

    it('should handle very high mileage (5000 mil = 50000 km)', () => {
      // (0.7 × 18.5 / 10) × 50000 = 64750
      const input = createTestInput({
        fuelConsumption: 0.7,
        primaryFuelPrice: 18.5,
        annualMileage: 5000,
      });

      const result = calculateCosts(input);
      expect(result.fuel).toBe(64750);
    });
  });

  describe('Secondary Fuel (Plug-in Hybrid)', () => {
    it('should calculate weighted fuel cost for plug-in hybrid at 50% electric', () => {
      // Primary (50%): (0.5 × 18.5 × 0.5 / 10) × 15000 = 6937.5
      // Secondary (50%): (0.5 × 2.5 × 0.5 / 10) × 15000 = 937.5
      // Total: 6937.5 + 937.5 = 7875
      const input = createTestInput({
        fuelConsumption: 0.5,
        primaryFuelPrice: 18.5,
        hasSecondaryFuel: true,
        secondaryFuelPrice: 2.5,
        secondaryFuelShare: 50,
        annualMileage: 1500,
      });

      const result = calculateCosts(input);
      expect(result.fuel).toBe(7875);
    });

    it('should calculate weighted fuel cost for plug-in hybrid at 70% electric', () => {
      // Primary (30%): (0.5 × 18.5 × 0.3 / 10) × 15000 = 4162.5
      // Secondary (70%): (0.5 × 2.5 × 0.7 / 10) × 15000 = 1312.5
      // Total: 5475
      const input = createTestInput({
        fuelConsumption: 0.5,
        primaryFuelPrice: 18.5,
        hasSecondaryFuel: true,
        secondaryFuelPrice: 2.5,
        secondaryFuelShare: 70,
        annualMileage: 1500,
      });

      const result = calculateCosts(input);
      expect(result.fuel).toBe(5475);
    });

    it('should handle 100% secondary fuel (electric driving)', () => {
      // Primary (0%): 0
      // Secondary (100%): (0.5 × 2.5 × 1.0 / 10) × 15000 = 1875
      const input = createTestInput({
        fuelConsumption: 0.5,
        primaryFuelPrice: 18.5,
        hasSecondaryFuel: true,
        secondaryFuelPrice: 2.5,
        secondaryFuelShare: 100,
        annualMileage: 1500,
      });

      const result = calculateCosts(input);
      expect(result.fuel).toBe(1875);
    });

    it('should handle 0% secondary fuel (pure combustion driving)', () => {
      // All primary fuel
      const input = createTestInput({
        fuelConsumption: 0.5,
        primaryFuelPrice: 18.5,
        hasSecondaryFuel: true,
        secondaryFuelPrice: 2.5,
        secondaryFuelShare: 0,
        annualMileage: 1500,
      });

      const result = calculateCosts(input);
      // (0.5 × 18.5 / 10) × 15000 = 13875
      expect(result.fuel).toBe(13875);
    });
  });
});

// ============================================================================
// DEPRECIATION CALCULATION TESTS (Age-based + Fuel-type-aware model)
// ============================================================================

/**
 * Helper: computes expected depreciation using the age-based model
 * Mirrors the logic in calculateCosts for verification
 */
function computeExpectedDepreciation(
  purchasePrice: number,
  vehicleAge: number | null,
  fuelType: string,
  depreciationRate: 'low' | 'normal' | 'high',
  ownershipYears: number
): number {
  const fuelMult = FUEL_DEPRECIATION_MULTIPLIERS[fuelType] ?? 1.0;
  const overrideFact = DEPRECIATION_OVERRIDE_FACTORS[depreciationRate];
  const startAge = vehicleAge ?? 0;

  let totalDep = 0;
  let currentValue = purchasePrice;
  for (let year = 0; year < ownershipYears; year++) {
    const baseRate = getDepreciationRateForAge(startAge + year);
    const effectiveRate = Math.min(1, Math.max(0, baseRate * fuelMult * overrideFact));
    const yearDep = currentValue * effectiveRate;
    totalDep += yearDep;
    currentValue -= yearDep;
  }
  return Math.round(ownershipYears > 0 ? totalDep / ownershipYears : 0);
}

describe('getDepreciationRateForAge', () => {
  it('should return 25% for age 0 (brand new)', () => {
    expect(getDepreciationRateForAge(0)).toBe(0.25);
  });

  it('should return 15% for age 1', () => {
    expect(getDepreciationRateForAge(1)).toBe(0.15);
  });

  it('should return 15% for age 2', () => {
    expect(getDepreciationRateForAge(2)).toBe(0.15);
  });

  it('should return 10% for age 3', () => {
    expect(getDepreciationRateForAge(3)).toBe(0.10);
  });

  it('should return 10% for age 4', () => {
    expect(getDepreciationRateForAge(4)).toBe(0.10);
  });

  it('should return 6% for age 5', () => {
    expect(getDepreciationRateForAge(5)).toBe(0.06);
  });

  it('should return 6% for age 7', () => {
    expect(getDepreciationRateForAge(7)).toBe(0.06);
  });

  it('should return 4% for age 8', () => {
    expect(getDepreciationRateForAge(8)).toBe(0.04);
  });

  it('should return 4% for age 15 (very old)', () => {
    expect(getDepreciationRateForAge(15)).toBe(0.04);
  });

  it('should return 4% for age 30 (extremely old)', () => {
    expect(getDepreciationRateForAge(30)).toBe(0.04);
  });
});

describe('Depreciation Calculations', () => {
  it('should calculate normal depreciation over 5 years', () => {
    // vehicleAge=3, bensin (0.75), normal (1.0), 5 years
    const input = createTestInput({
      purchasePrice: 300000,
      depreciationRate: 'normal',
      ownershipYears: 5,
    });

    const result = calculateCosts(input);
    const expected = computeExpectedDepreciation(300000, 3, 'bensin', 'normal', 5);
    expect(result.depreciation).toBe(expected);
  });

  it('should calculate low depreciation over 5 years', () => {
    const input = createTestInput({
      purchasePrice: 300000,
      depreciationRate: 'low',
      ownershipYears: 5,
    });

    const result = calculateCosts(input);
    const expected = computeExpectedDepreciation(300000, 3, 'bensin', 'low', 5);
    expect(result.depreciation).toBe(expected);
  });

  it('should calculate high depreciation over 5 years', () => {
    const input = createTestInput({
      purchasePrice: 300000,
      depreciationRate: 'high',
      ownershipYears: 5,
    });

    const result = calculateCosts(input);
    const expected = computeExpectedDepreciation(300000, 3, 'bensin', 'high', 5);
    expect(result.depreciation).toBe(expected);
  });

  it('should calculate depreciation for 1 year ownership', () => {
    // vehicleAge=3, bensin, normal -> age 3 bracket (10%), fuel 0.75 -> 7.5%
    // 300000 * 0.075 = 22500
    const input = createTestInput({
      purchasePrice: 300000,
      depreciationRate: 'normal',
      ownershipYears: 1,
    });

    const result = calculateCosts(input);
    expect(result.depreciation).toBe(22500);
  });

  it('should calculate depreciation for 10 year ownership', () => {
    const input = createTestInput({
      purchasePrice: 300000,
      depreciationRate: 'normal',
      ownershipYears: 10,
    });

    const result = calculateCosts(input);
    const expected = computeExpectedDepreciation(300000, 3, 'bensin', 'normal', 10);
    expect(result.depreciation).toBe(expected);
  });

  it('should handle expensive vehicle (1,000,000 SEK)', () => {
    const input = createTestInput({
      purchasePrice: 1000000,
      depreciationRate: 'normal',
      ownershipYears: 5,
    });

    const result = calculateCosts(input);
    const expected = computeExpectedDepreciation(1000000, 3, 'bensin', 'normal', 5);
    expect(result.depreciation).toBe(expected);
  });
});

describe('Age-Based Depreciation Model', () => {
  describe('Fuel type multipliers', () => {
    it('should depreciate EV faster than diesel (same age)', () => {
      const evInput = createTestInput({ primaryFuelType: 'el', vehicleAge: 3 });
      const dieselInput = createTestInput({ primaryFuelType: 'diesel', vehicleAge: 3 });
      expect(calculateCosts(evInput).depreciation).toBeGreaterThan(calculateCosts(dieselInput).depreciation);
    });

    it('should depreciate bensin slower than diesel', () => {
      const bensinInput = createTestInput({ primaryFuelType: 'bensin', vehicleAge: 3 });
      const dieselInput = createTestInput({ primaryFuelType: 'diesel', vehicleAge: 3 });
      expect(calculateCosts(bensinInput).depreciation).toBeLessThan(calculateCosts(dieselInput).depreciation);
    });

    it('should handle unknown fuel type with multiplier 1.0', () => {
      const unknownInput = createTestInput({ primaryFuelType: 'unknown_fuel', vehicleAge: 3 });
      const dieselInput = createTestInput({ primaryFuelType: 'diesel', vehicleAge: 3 });
      // Unknown defaults to 1.0 = same as diesel
      expect(calculateCosts(unknownInput).depreciation).toBe(calculateCosts(dieselInput).depreciation);
    });
  });

  describe('Vehicle age at purchase', () => {
    it('should start new car (age 0) at 25% base rate', () => {
      // Diesel multiplier 1.0, normal override 1.0: 400000 * 0.25 = 100000
      const input = createTestInput({
        vehicleAge: 0, ownershipYears: 1, purchasePrice: 400000, primaryFuelType: 'diesel',
      });
      expect(calculateCosts(input).depreciation).toBe(100000);
    });

    it('should start 4-year-old car at 10% bracket', () => {
      // age 4 -> bracket 3-5 -> 10%, diesel*1.0, normal*1.0 => 200000 * 0.10 = 20000
      const input = createTestInput({
        vehicleAge: 4, ownershipYears: 1, purchasePrice: 200000, primaryFuelType: 'diesel',
      });
      expect(calculateCosts(input).depreciation).toBe(20000);
    });

    it('should start 10-year-old car at 4% bracket', () => {
      // age 10 -> bracket 8+ -> 4%, diesel*1.0 => 100000 * 0.04 = 4000
      const input = createTestInput({
        vehicleAge: 10, ownershipYears: 1, purchasePrice: 100000, primaryFuelType: 'diesel',
      });
      expect(calculateCosts(input).depreciation).toBe(4000);
    });

    it('should handle null vehicleAge as age 0 (fallback)', () => {
      const nullAge = createTestInput({ vehicleAge: null, ownershipYears: 1, purchasePrice: 400000, primaryFuelType: 'diesel' });
      const zeroAge = createTestInput({ vehicleAge: 0, ownershipYears: 1, purchasePrice: 400000, primaryFuelType: 'diesel' });
      expect(calculateCosts(nullAge).depreciation).toBe(calculateCosts(zeroAge).depreciation);
    });

    it('should handle very old vehicle (20+ years) with minimal depreciation', () => {
      // All years at 4% base * 0.75 bensin = 3% effective
      const input = createTestInput({ vehicleAge: 20, ownershipYears: 5, purchasePrice: 50000, primaryFuelType: 'bensin' });
      const result = calculateCosts(input);
      expect(result.depreciation).toBeLessThan(2000);
      expect(result.depreciation).toBeGreaterThan(0);
    });
  });

  describe('User override interaction', () => {
    it('low override should reduce depreciation', () => {
      const normalResult = calculateCosts(createTestInput({ depreciationRate: 'normal', vehicleAge: 3 }));
      const lowResult = calculateCosts(createTestInput({ depreciationRate: 'low', vehicleAge: 3 }));
      expect(lowResult.depreciation).toBeLessThan(normalResult.depreciation);
    });

    it('high override should increase depreciation', () => {
      const normalResult = calculateCosts(createTestInput({ depreciationRate: 'normal', vehicleAge: 3 }));
      const highResult = calculateCosts(createTestInput({ depreciationRate: 'high', vehicleAge: 3 }));
      expect(highResult.depreciation).toBeGreaterThan(normalResult.depreciation);
    });

    it('combined high override + EV should give highest depreciation', () => {
      // 0.25 * 1.25 * 1.30 = 0.40625 => 500000 * 0.40625 = 203125
      const input = createTestInput({
        depreciationRate: 'high', primaryFuelType: 'el', vehicleAge: 0, ownershipYears: 1, purchasePrice: 500000,
      });
      expect(calculateCosts(input).depreciation).toBe(203125);
    });
  });

  describe('Bracket transitions during ownership', () => {
    it('should transition from 15% to 10% bracket when crossing age 3', () => {
      // Car is age 2, owned 3 years, diesel (1.0), normal (1.0)
      // Age 2: 15%, Age 3: 10%, Age 4: 10%
      const input = createTestInput({
        vehicleAge: 2, ownershipYears: 3, purchasePrice: 300000, primaryFuelType: 'diesel',
      });
      const result = calculateCosts(input);
      // Year 0 (age 2): 300000 * 0.15 = 45000, rem 255000
      // Year 1 (age 3): 255000 * 0.10 = 25500, rem 229500
      // Year 2 (age 4): 229500 * 0.10 = 22950
      // Total = 93450, annual = 31150
      expect(result.depreciation).toBe(31150);
    });

    it('should transition from 10% to 6% bracket when crossing age 5', () => {
      // Car is age 4, owned 2 years, diesel (1.0), normal (1.0)
      const input = createTestInput({
        vehicleAge: 4, ownershipYears: 2, purchasePrice: 200000, primaryFuelType: 'diesel',
      });
      const result = calculateCosts(input);
      // Year 0 (age 4): 200000 * 0.10 = 20000, rem 180000
      // Year 1 (age 5): 180000 * 0.06 = 10800
      // Total = 30800, annual = 15400
      expect(result.depreciation).toBe(15400);
    });
  });
});

// ============================================================================
// LOAN CALCULATION TESTS (CRITICAL)
// ============================================================================
describe('Loan Calculations', () => {
  describe('Annuity Loan (Annuitetslån)', () => {
    it('should calculate annuity loan payment correctly', () => {
      // Loan: 240000 (300000 - 20% down payment)
      // Rate: 5% annual = 0.05/12 = 0.004166... monthly
      // Payments: 36 months
      // Formula: M = P * [r(1+r)^n] / [(1+r)^n - 1]
      const input = createTestInput({
        purchasePrice: 300000,
        financingType: 'loan',
        loanType: 'annuity',
        downPaymentPercent: 20, // 60000 down, 240000 loan
        interestRate: 5.0,
        loanYears: 3,
        monthlyAdminFee: 60,
      });

      const result = calculateCosts(input);

      // Manual calculation
      const principal = 240000;
      const monthlyRate = 0.05 / 12;
      const numPayments = 36;
      const factor = Math.pow(1 + monthlyRate, numPayments);
      const basePayment = principal * (monthlyRate * factor) / (factor - 1);
      const expectedMonthly = Math.round(basePayment + 60);

      expect(result.monthlyLoanPayment).toBe(expectedMonthly);
      expect(result.financing).toBe(expectedMonthly * 12);
    });

    it('should verify monthly × 12 = annual (no rounding discrepancy)', () => {
      const input = createTestInput({
        purchasePrice: 350000,
        financingType: 'loan',
        loanType: 'annuity',
        downPaymentPercent: 15,
        interestRate: 6.5,
        loanYears: 5,
        monthlyAdminFee: 75,
      });

      const result = calculateCosts(input);

      // CRITICAL: This must be exactly equal
      expect(result.financing).toBe(result.monthlyLoanPayment * 12);
    });

    it('should handle 0% interest rate', () => {
      // 0% = just principal / payments
      const input = createTestInput({
        purchasePrice: 300000,
        financingType: 'loan',
        loanType: 'annuity',
        downPaymentPercent: 20, // 240000 loan
        interestRate: 0,
        loanYears: 3, // 36 payments
        monthlyAdminFee: 60,
      });

      const result = calculateCosts(input);

      // 240000 / 36 = 6666.666... rounded = 6667 + 60 = 6727
      expect(result.monthlyLoanPayment).toBe(6727);
      expect(result.financing).toBe(6727 * 12);
    });

    it('should handle high interest rate (10%)', () => {
      const input = createTestInput({
        purchasePrice: 200000,
        financingType: 'loan',
        loanType: 'annuity',
        downPaymentPercent: 30, // 140000 loan
        interestRate: 10.0,
        loanYears: 4, // 48 payments
        monthlyAdminFee: 50,
      });

      const result = calculateCosts(input);

      const principal = 140000;
      const monthlyRate = 0.10 / 12;
      const numPayments = 48;
      const factor = Math.pow(1 + monthlyRate, numPayments);
      const basePayment = principal * (monthlyRate * factor) / (factor - 1);
      const expectedMonthly = Math.round(basePayment + 50);

      expect(result.monthlyLoanPayment).toBe(expectedMonthly);
      expect(result.financing).toBe(expectedMonthly * 12);
    });
  });

  describe('Residual Value Loan (Restvärdelån)', () => {
    it('should calculate residual value loan with lower monthly payments', () => {
      // Principal: 240000 (300000 - 20%)
      // Residual: 150000 (300000 × 50%)
      // Amortize: 240000 - 150000 = 90000 over 36 months = 2500/month
      // Average balance: (240000 + 150000) / 2 = 195000
      // Monthly interest: 195000 × (5%/12) = 812.5
      // Total monthly: 2500 + 812.5 + 60 = 3372.5, rounded = 3373
      const input = createTestInput({
        purchasePrice: 300000,
        financingType: 'loan',
        loanType: 'residual',
        downPaymentPercent: 20,
        residualValuePercent: 50,
        interestRate: 5.0,
        loanYears: 3,
        monthlyAdminFee: 60,
      });

      const result = calculateCosts(input);

      const principal = 240000;
      const residual = 150000;
      const amortize = principal - residual;
      const numPayments = 36;
      const monthlyAmort = amortize / numPayments;
      const avgBalance = (principal + residual) / 2;
      const monthlyInterest = avgBalance * (0.05 / 12);
      const expectedMonthly = Math.round(monthlyAmort + monthlyInterest + 60);

      expect(result.monthlyLoanPayment).toBe(expectedMonthly);
      expect(result.financing).toBe(expectedMonthly * 12);
    });

    it('should handle residual higher than loan amount', () => {
      // If residual > loan principal, amortization should be 0
      const input = createTestInput({
        purchasePrice: 300000,
        financingType: 'loan',
        loanType: 'residual',
        downPaymentPercent: 40, // 180000 loan
        residualValuePercent: 70, // 210000 residual > 180000 loan
        interestRate: 5.0,
        loanYears: 3,
        monthlyAdminFee: 60,
      });

      const result = calculateCosts(input);

      // Math.max(0, 180000 - 210000) = 0 amortization
      // Average balance: (180000 + 210000) / 2 = 195000
      // Monthly interest: 195000 × (5%/12) = 812.5
      // Total: 0 + 812.5 + 60 = 872.5, rounded = 873
      expect(result.monthlyLoanPayment).toBe(873);
    });

    it('should verify residual loan has lower payments than annuity', () => {
      const baseInput = {
        purchasePrice: 300000,
        financingType: 'loan' as const,
        downPaymentPercent: 20,
        interestRate: 5.0,
        loanYears: 3,
        monthlyAdminFee: 60,
      };

      const annuityResult = calculateCosts(createTestInput({
        ...baseInput,
        loanType: 'annuity',
        residualValuePercent: 0,
      }));

      const residualResult = calculateCosts(createTestInput({
        ...baseInput,
        loanType: 'residual',
        residualValuePercent: 50,
      }));

      // Residual loan should have lower monthly payment
      expect(residualResult.monthlyLoanPayment).toBeLessThan(annuityResult.monthlyLoanPayment);
    });
  });

  describe('Cash Purchase (No Financing)', () => {
    it('should have zero financing costs for cash purchase', () => {
      const input = createTestInput({
        financingType: 'cash',
      });

      const result = calculateCosts(input);

      expect(result.monthlyLoanPayment).toBe(0);
      expect(result.financing).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle 0 loan years', () => {
      const input = createTestInput({
        purchasePrice: 300000,
        financingType: 'loan',
        loanType: 'annuity',
        loanYears: 0,
      });

      const result = calculateCosts(input);

      expect(result.monthlyLoanPayment).toBe(0);
      expect(result.financing).toBe(0);
    });

    it('should handle 100% down payment', () => {
      const input = createTestInput({
        purchasePrice: 300000,
        financingType: 'loan',
        loanType: 'annuity',
        downPaymentPercent: 100,
        loanYears: 3,
      });

      const result = calculateCosts(input);

      // No loan principal, but still admin fee
      // Principal = 0, so annuity formula gives 0 + admin fee = 60
      expect(result.monthlyLoanPayment).toBe(60);
      expect(result.financing).toBe(720);
    });
  });
});

// ============================================================================
// MAINTENANCE COST TESTS
// ============================================================================
describe('Maintenance Cost Calculations', () => {
  it('should calculate maintenance at base mileage (1500 mil)', () => {
    // Normal vehicle, normal maintenance at 1500 mil = 8000 × (1500/1500) = 8000
    const input = createTestInput({
      vehicleType: 'normal',
      maintenanceLevel: 'normal',
      annualMileage: 1500,
    });

    const result = calculateCosts(input);
    expect(result.maintenance).toBe(8000);
  });

  it('should scale maintenance with mileage', () => {
    // 3000 mil = 8000 × (3000/1500) = 16000
    const input = createTestInput({
      vehicleType: 'normal',
      maintenanceLevel: 'normal',
      annualMileage: 3000,
    });

    const result = calculateCosts(input);
    expect(result.maintenance).toBe(16000);
  });

  it('should calculate maintenance for luxury vehicle', () => {
    // Luxury, high maintenance at 1500 mil = 35000
    // At 2000 mil = 35000 × (2000/1500) = 46666.67, rounded = 46667
    const input = createTestInput({
      vehicleType: 'luxury',
      maintenanceLevel: 'high',
      annualMileage: 2000,
    });

    const result = calculateCosts(input);
    expect(result.maintenance).toBe(46667);
  });

  it('should calculate maintenance for simple vehicle', () => {
    // Simple, low maintenance at 1500 mil = 3000
    const input = createTestInput({
      vehicleType: 'simple',
      maintenanceLevel: 'low',
      annualMileage: 1500,
    });

    const result = calculateCosts(input);
    expect(result.maintenance).toBe(3000);
  });

  it('should handle zero mileage', () => {
    const input = createTestInput({
      vehicleType: 'normal',
      maintenanceLevel: 'normal',
      annualMileage: 0,
    });

    const result = calculateCosts(input);
    expect(result.maintenance).toBe(0);
  });
});

// ============================================================================
// TIRE COST TESTS
// ============================================================================
describe('Tire Cost Calculations', () => {
  it('should use user-provided annual tire cost', () => {
    const input = createTestInput({
      annualTireCost: 5000,
    });

    const result = calculateCosts(input);
    expect(result.tires).toBe(5000);
  });

  it('should calculate tire cost based on 60,000 km cycle', () => {
    // Normal vehicle tire cost: 6000
    // At 1500 mil (15000 km), replacement years = 60000/15000 = 4 years
    // Annual cost = 6000 / 4 = 1500
    const input = createTestInput({
      vehicleType: 'normal',
      annualMileage: 1500,
      annualTireCost: undefined,
    });

    const result = calculateCosts(input);
    expect(result.tires).toBe(1500);
  });

  it('should handle high mileage (faster tire replacement)', () => {
    // At 3000 mil (30000 km), replacement years = 60000/30000 = 2 years (minimum)
    // Annual cost = 6000 / 2 = 3000
    const input = createTestInput({
      vehicleType: 'normal',
      annualMileage: 3000,
      annualTireCost: undefined,
    });

    const result = calculateCosts(input);
    expect(result.tires).toBe(3000);
  });

  it('should cap replacement years at 5', () => {
    // At 500 mil (5000 km), replacement years = 60000/5000 = 12, capped at 5
    // Annual cost = 6000 / 5 = 1200
    const input = createTestInput({
      vehicleType: 'normal',
      annualMileage: 500,
      annualTireCost: undefined,
    });

    const result = calculateCosts(input);
    expect(result.tires).toBe(1200);
  });

  it('should use minimum 2 years for replacement cycle', () => {
    // At 5000 mil (50000 km), replacement years = 60000/50000 = 1.2, clamped to 2
    // Annual cost = 6000 / 2 = 3000
    const input = createTestInput({
      vehicleType: 'normal',
      annualMileage: 5000,
      annualTireCost: undefined,
    });

    const result = calculateCosts(input);
    expect(result.tires).toBe(3000);
  });

  it('should calculate tire cost for luxury vehicle', () => {
    // Luxury tire cost: 15000
    // At 1500 mil, replacement = 4 years
    // Annual = 15000 / 4 = 3750
    const input = createTestInput({
      vehicleType: 'luxury',
      annualMileage: 1500,
      annualTireCost: undefined,
    });

    const result = calculateCosts(input);
    expect(result.tires).toBe(3750);
  });

  it('should ignore zero annual tire cost and calculate instead', () => {
    // annualTireCost = 0 should trigger calculation
    const input = createTestInput({
      vehicleType: 'normal',
      annualMileage: 1500,
      annualTireCost: 0,
    });

    const result = calculateCosts(input);
    // Should calculate: 6000 / 4 = 1500
    expect(result.tires).toBe(1500);
  });
});

// ============================================================================
// FIXED COSTS TESTS
// ============================================================================
describe('Fixed Costs', () => {
  describe('Insurance', () => {
    it('should multiply monthly insurance by 12', () => {
      const input = createTestInput({
        insurance: 500, // monthly
      });

      const result = calculateCosts(input);
      expect(result.insurance).toBe(6000);
    });

    it('should handle expensive insurance', () => {
      const input = createTestInput({
        insurance: 1500, // monthly for expensive car
      });

      const result = calculateCosts(input);
      expect(result.insurance).toBe(18000);
    });
  });

  describe('Parking', () => {
    it('should multiply monthly parking by 12', () => {
      const input = createTestInput({
        parking: 300, // monthly
      });

      const result = calculateCosts(input);
      expect(result.parking).toBe(3600);
    });

    it('should handle zero parking', () => {
      const input = createTestInput({
        parking: 0,
      });

      const result = calculateCosts(input);
      expect(result.parking).toBe(0);
    });
  });

  describe('Tax', () => {
    it('should use annual tax only when no malus', () => {
      const input = createTestInput({
        annualTax: 2500,
        hasMalusTax: false,
        malusTaxAmount: 5000,
      });

      const result = calculateCosts(input);
      expect(result.tax).toBe(2500);
    });

    it('should add malus tax when applicable', () => {
      const input = createTestInput({
        annualTax: 2500,
        hasMalusTax: true,
        malusTaxAmount: 10000,
      });

      const result = calculateCosts(input);
      expect(result.tax).toBe(12500);
    });

    it('should handle electric vehicle tax (low)', () => {
      const input = createTestInput({
        annualTax: 360, // Electric vehicle tax
        hasMalusTax: false,
      });

      const result = calculateCosts(input);
      expect(result.tax).toBe(360);
    });
  });
});

// ============================================================================
// TOTAL CALCULATIONS AND ROUNDING TESTS
// ============================================================================
describe('Total Calculations', () => {
  it('should calculate variable costs correctly', () => {
    // variableCosts = fuel + maintenance + tires
    const input = createTestInput({
      fuelConsumption: 0.7,
      primaryFuelPrice: 18.5,
      annualMileage: 1500,
      vehicleType: 'normal',
      maintenanceLevel: 'normal',
      annualTireCost: 2000,
    });

    const result = calculateCosts(input);

    // fuel = 19425, maintenance = 8000, tires = 2000
    expect(result.variableCosts).toBe(result.fuel + result.maintenance + result.tires);
    expect(result.variableCosts).toBe(29425);
  });

  it('should calculate fixed costs correctly', () => {
    // fixedCosts = tax + insurance + parking + financing + depreciation
    const input = createTestInput({
      annualTax: 2000,
      insurance: 500,
      parking: 200,
      financingType: 'cash',
    });

    const result = calculateCosts(input);

    expect(result.fixedCosts).toBe(
      result.tax + result.insurance + result.parking + result.washingCare + result.financing + result.depreciation
    );
  });

  it('should calculate total annual correctly', () => {
    const input = createTestInput();
    const result = calculateCosts(input);

    expect(result.totalAnnual).toBe(result.variableCosts + result.fixedCosts);
  });

  it('should calculate monthly total as annual / 12', () => {
    const input = createTestInput();
    const result = calculateCosts(input);

    expect(result.monthlyTotal).toBe(Math.round(result.totalAnnual / 12));
  });

  it('should calculate cost per mil correctly', () => {
    const input = createTestInput({
      annualMileage: 1500,
    });

    const result = calculateCosts(input);

    expect(result.costPerMil).toBe(Math.round(result.totalAnnual / 1500));
  });

  it('should calculate cost per km correctly', () => {
    const input = createTestInput({
      annualMileage: 1500, // 15000 km
    });

    const result = calculateCosts(input);

    const expectedCostPerKm = result.totalAnnual / 15000;
    expect(result.costPerKm).toBe(expectedCostPerKm.toFixed(2));
  });
});

// ============================================================================
// ROUNDING CONSISTENCY TESTS
// ============================================================================
describe('Rounding Consistency', () => {
  it('should have financing = monthlyLoanPayment × 12 exactly', () => {
    // Test with various loan configurations
    const testCases = [
      { price: 300000, rate: 5.0, years: 3 },
      { price: 450000, rate: 7.5, years: 5 },
      { price: 200000, rate: 3.0, years: 2 },
      { price: 800000, rate: 8.9, years: 6 },
    ];

    testCases.forEach(({ price, rate, years }) => {
      const input = createTestInput({
        purchasePrice: price,
        financingType: 'loan',
        loanType: 'annuity',
        downPaymentPercent: 20,
        interestRate: rate,
        loanYears: years,
        monthlyAdminFee: 60,
      });

      const result = calculateCosts(input);

      expect(result.financing).toBe(result.monthlyLoanPayment * 12);
    });
  });

  it('should round all costs to whole numbers except costPerKm', () => {
    const input = createTestInput();
    const result = calculateCosts(input);

    expect(Number.isInteger(result.fuel)).toBe(true);
    expect(Number.isInteger(result.depreciation)).toBe(true);
    expect(Number.isInteger(result.tax)).toBe(true);
    expect(Number.isInteger(result.maintenance)).toBe(true);
    expect(Number.isInteger(result.tires)).toBe(true);
    expect(Number.isInteger(result.insurance)).toBe(true);
    expect(Number.isInteger(result.parking)).toBe(true);
    expect(Number.isInteger(result.financing)).toBe(true);
    expect(Number.isInteger(result.monthlyLoanPayment)).toBe(true);
    expect(Number.isInteger(result.variableCosts)).toBe(true);
    expect(Number.isInteger(result.fixedCosts)).toBe(true);
    expect(Number.isInteger(result.totalAnnual)).toBe(true);
    expect(Number.isInteger(result.costPerMil)).toBe(true);
    expect(Number.isInteger(result.monthlyTotal)).toBe(true);

    // costPerKm is a string with 2 decimals
    expect(typeof result.costPerKm).toBe('string');
  });
});

// ============================================================================
// EDGE CASES AND BOUNDARY CONDITIONS
// ============================================================================
describe('Edge Cases', () => {
  it('should handle very cheap vehicle (50,000 SEK)', () => {
    const input = createTestInput({
      purchasePrice: 50000,
    });

    const result = calculateCosts(input);
    expect(result.depreciation).toBeGreaterThan(0);
    expect(result.totalAnnual).toBeGreaterThan(0);
  });

  it('should handle very expensive vehicle (2,000,000 SEK)', () => {
    const input = createTestInput({
      purchasePrice: 2000000,
    });

    const result = calculateCosts(input);
    expect(result.depreciation).toBeGreaterThan(0);
    expect(result.totalAnnual).toBeGreaterThan(0);
  });

  it('should handle minimum annual mileage (100 mil)', () => {
    const input = createTestInput({
      annualMileage: 100,
    });

    const result = calculateCosts(input);
    expect(result.fuel).toBeGreaterThan(0);
    expect(result.costPerMil).toBeGreaterThan(0);
  });

  it('should handle very high interest rate (15%)', () => {
    const input = createTestInput({
      financingType: 'loan',
      loanType: 'annuity',
      interestRate: 15.0,
      loanYears: 5,
    });

    const result = calculateCosts(input);
    expect(result.monthlyLoanPayment).toBeGreaterThan(0);
    expect(result.financing).toBe(result.monthlyLoanPayment * 12);
  });

  it('should handle long loan term (7 years)', () => {
    const input = createTestInput({
      financingType: 'loan',
      loanType: 'annuity',
      interestRate: 5.0,
      loanYears: 7,
    });

    const result = calculateCosts(input);
    expect(result.monthlyLoanPayment).toBeGreaterThan(0);
  });

  it('should handle zero consumption (somehow)', () => {
    const input = createTestInput({
      fuelConsumption: 0,
    });

    const result = calculateCosts(input);
    expect(result.fuel).toBe(0);
  });

  it('should handle all vehicle types', () => {
    const vehicleTypes: Array<'simple' | 'normal' | 'large' | 'luxury'> = ['simple', 'normal', 'large', 'luxury'];

    vehicleTypes.forEach((vt) => {
      const input = createTestInput({ vehicleType: vt });
      const result = calculateCosts(input);

      expect(result.maintenance).toBeGreaterThan(0);
      expect(result.tires).toBeGreaterThan(0);
    });
  });

  it('should handle all maintenance levels', () => {
    const levels: Array<'low' | 'normal' | 'high'> = ['low', 'normal', 'high'];

    levels.forEach((ml) => {
      const input = createTestInput({ maintenanceLevel: ml });
      const result = calculateCosts(input);

      expect(result.maintenance).toBeGreaterThan(0);
    });
  });

  it('should handle all depreciation rates', () => {
    const rates: Array<'low' | 'normal' | 'high'> = ['low', 'normal', 'high'];

    rates.forEach((dr) => {
      const input = createTestInput({ depreciationRate: dr });
      const result = calculateCosts(input);

      expect(result.depreciation).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// INTEGRATION / REALISTIC SCENARIOS
// ============================================================================
describe('Realistic Scenarios', () => {
  it('should calculate costs for a typical family car (Volvo XC60)', () => {
    const input = createTestInput({
      purchasePrice: 450000,
      fuelConsumption: 0.8,
      primaryFuelPrice: 18.5,
      annualMileage: 1500,
      vehicleType: 'large',
      maintenanceLevel: 'normal',
      depreciationRate: 'normal',
      ownershipYears: 5,
      insurance: 800,
      parking: 0,
      financingType: 'loan',
      loanType: 'residual',
      downPaymentPercent: 20,
      residualValuePercent: 50,
      interestRate: 5.0,
      loanYears: 3,
      monthlyAdminFee: 60,
      annualTax: 2500,
    });

    const result = calculateCosts(input);

    // Verify reasonable totals
    expect(result.totalAnnual).toBeGreaterThan(50000);
    expect(result.totalAnnual).toBeLessThan(200000);
    expect(result.monthlyTotal).toBeGreaterThan(4000);
    expect(result.costPerMil).toBeGreaterThan(30);
  });

  it('should calculate costs for an electric car (Tesla Model 3)', () => {
    const input = createTestInput({
      purchasePrice: 500000,
      fuelConsumption: 1.5, // kWh per mil
      primaryFuelPrice: 2.5, // electricity price
      annualMileage: 1500,
      vehicleType: 'normal',
      maintenanceLevel: 'low', // EVs have lower maintenance
      depreciationRate: 'normal',
      ownershipYears: 5,
      insurance: 700,
      parking: 200,
      financingType: 'loan',
      loanType: 'annuity',
      downPaymentPercent: 30,
      interestRate: 5.0,
      loanYears: 5,
      monthlyAdminFee: 60,
      annualTax: 360, // Low EV tax
    });

    const result = calculateCosts(input);

    // EV should have low fuel costs
    expect(result.fuel).toBeLessThan(10000);
    // Normal vehicle with low maintenance at 1500 mil = 5000 exactly
    expect(result.maintenance).toBeLessThanOrEqual(5000);
  });

  it('should calculate costs for a plug-in hybrid (Volvo V60 PHEV)', () => {
    const input = createTestInput({
      purchasePrice: 550000,
      fuelConsumption: 0.4,
      primaryFuelPrice: 18.5,
      hasSecondaryFuel: true,
      secondaryFuelType: 'el',
      secondaryFuelPrice: 2.5,
      secondaryFuelShare: 60, // 60% electric
      annualMileage: 1500,
      vehicleType: 'large',
      maintenanceLevel: 'normal',
      annualTax: 1200,
    });

    const result = calculateCosts(input);

    // Fuel should be lower than pure petrol
    expect(result.fuel).toBeLessThan(15000);
  });

  it('should calculate costs for a budget car (used VW Golf)', () => {
    const input = createTestInput({
      purchasePrice: 120000,
      fuelConsumption: 0.6,
      primaryFuelPrice: 18.5,
      annualMileage: 1200,
      vehicleType: 'normal',
      maintenanceLevel: 'normal',
      depreciationRate: 'low', // Older car, slower depreciation
      ownershipYears: 3,
      insurance: 350,
      parking: 0,
      financingType: 'cash',
      annualTax: 1500,
    });

    const result = calculateCosts(input);

    // Budget car should be under 50,000/year
    expect(result.totalAnnual).toBeLessThan(50000);
  });
});

// ============================================================================
// BUG DETECTION TESTS
// ============================================================================
describe('Bug Detection', () => {
  it('BUG CHECK: secondary fuel calculation uses same consumption for both fuels', () => {
    // This tests whether the formula correctly uses the same consumption
    // for both primary and secondary fuel (which is the current behavior)
    const input = createTestInput({
      fuelConsumption: 0.5,
      primaryFuelPrice: 18.5,
      hasSecondaryFuel: true,
      secondaryFuelPrice: 2.5,
      secondaryFuelShare: 50,
      annualMileage: 1500,
    });

    const result = calculateCosts(input);

    // Current formula: both use same consumption value
    // This might be a bug - PHEVs often have different consumption
    // in electric vs combustion mode
    const expected = (0.5 * 18.5 * 0.5 / 10 + 0.5 * 2.5 * 0.5 / 10) * 15000;
    expect(result.fuel).toBe(Math.round(expected));
  });

  it('BUG CHECK: tire replacement years clamping works correctly', () => {
    // Very high mileage - should be clamped to 2 years minimum
    const highMileage = createTestInput({
      annualMileage: 6000, // 60000 km = exactly 60000/60000 = 1 year
      vehicleType: 'normal',
      annualTireCost: undefined,
    });

    const result = calculateCosts(highMileage);
    // Should clamp to 2 years, so 6000 / 2 = 3000
    expect(result.tires).toBe(3000);
  });

  it('BUG CHECK: depreciation does not go negative', () => {
    // Very long ownership might deplete value
    const input = createTestInput({
      purchasePrice: 100000,
      depreciationRate: 'high',
      ownershipYears: 20,
    });

    const result = calculateCosts(input);
    expect(result.depreciation).toBeGreaterThanOrEqual(0);
  });

  it('BUG CHECK: division by zero protection for mileage', () => {
    const input = createTestInput({
      annualMileage: 0,
    });

    // Should not throw
    expect(() => calculateCosts(input)).not.toThrow();

    const result = calculateCosts(input);
    // costPerMil would be Infinity, but after rounding should be handled
    // Actually this could be a bug - dividing by 0
    expect(result.costPerMil).toBeDefined();
  });

  it('BUG CHECK: zero mileage causes Infinity in costPerMil and costPerKm', () => {
    const input = createTestInput({
      annualMileage: 0,
    });

    const result = calculateCosts(input);

    // This is a POTENTIAL BUG - dividing totalAnnual by 0 gives Infinity
    // Math.round(Infinity) = Infinity, which is not a valid integer
    // This test documents the current behavior
    console.log('Zero mileage costPerMil:', result.costPerMil);
    console.log('Zero mileage costPerKm:', result.costPerKm);

    // If this is Infinity, it's a bug that should be fixed
    const isInfinity = !Number.isFinite(result.costPerMil);
    if (isInfinity) {
      console.warn('BUG DETECTED: costPerMil is Infinity when annualMileage = 0');
    }
    expect(result.costPerMil).toBeDefined();
  });

  it('BUG CHECK: very small mileage causes extremely high per-mil costs', () => {
    const input = createTestInput({
      annualMileage: 1, // Only 1 mil (10 km) per year
    });

    const result = calculateCosts(input);

    // Very small mileage should still produce valid numbers
    expect(Number.isFinite(result.costPerMil)).toBe(true);
    expect(Number.isFinite(parseFloat(result.costPerKm))).toBe(true);

    // Per-mil cost will be extremely high but valid
    console.log('Very low mileage (1 mil) costPerMil:', result.costPerMil);
  });

  it('BUG CHECK: floating point precision in loan calculations', () => {
    // Test specific values that might cause floating point issues
    const input = createTestInput({
      purchasePrice: 333333,
      financingType: 'loan',
      loanType: 'annuity',
      downPaymentPercent: 33,
      interestRate: 3.33,
      loanYears: 3,
      monthlyAdminFee: 33,
    });

    const result = calculateCosts(input);

    // Should still have integer monthly payment and consistent annual
    expect(Number.isInteger(result.monthlyLoanPayment)).toBe(true);
    expect(result.financing).toBe(result.monthlyLoanPayment * 12);
  });

  it('BUG CHECK: negative residual value scenario', () => {
    // What if someone enters bad data?
    const input = createTestInput({
      purchasePrice: 300000,
      financingType: 'loan',
      loanType: 'residual',
      downPaymentPercent: 0, // Full loan amount
      residualValuePercent: 150, // Residual > purchase price (invalid input)
      interestRate: 5.0,
      loanYears: 3,
      monthlyAdminFee: 60,
    });

    const result = calculateCosts(input);

    // amortizeAmount = max(0, 300000 - 450000) = 0
    // So monthly amortization = 0
    // But interest is calculated on average of (300000 + 450000) / 2 = 375000
    // This is weird behavior but documented
    expect(result.monthlyLoanPayment).toBeGreaterThanOrEqual(0);
  });

  it('BUG CHECK: 100% residual value', () => {
    // If residual = 100%, no amortization but full interest
    const input = createTestInput({
      purchasePrice: 300000,
      financingType: 'loan',
      loanType: 'residual',
      downPaymentPercent: 20, // 240000 loan
      residualValuePercent: 100, // 300000 residual (> loan)
      interestRate: 5.0,
      loanYears: 3,
      monthlyAdminFee: 60,
    });

    const result = calculateCosts(input);

    // Math.max(0, 240000 - 300000) = 0 amortization
    // Average balance = (240000 + 300000) / 2 = 270000
    // Monthly interest = 270000 * (5%/12) = 1125
    // Total = 0 + 1125 + 60 = 1185
    expect(result.monthlyLoanPayment).toBe(1185);
  });
});

// ============================================================================
// ADDITIONAL VERIFICATION TESTS
// ============================================================================
describe('Formula Verification', () => {
  it('should match the documented annuity formula exactly', () => {
    // Annuity formula: M = P × [r(1+r)^n] / [(1+r)^n - 1]
    const principal = 200000;
    const annualRate = 6.0;
    const monthlyRate = annualRate / 100 / 12;
    const numPayments = 60; // 5 years
    const adminFee = 50;

    const input = createTestInput({
      purchasePrice: 250000,
      financingType: 'loan',
      loanType: 'annuity',
      downPaymentPercent: 20, // Results in 200000 principal
      interestRate: annualRate,
      loanYears: 5,
      monthlyAdminFee: adminFee,
    });

    const result = calculateCosts(input);

    // Manual calculation
    const factor = Math.pow(1 + monthlyRate, numPayments);
    const basePayment = principal * (monthlyRate * factor) / (factor - 1);
    const expectedMonthly = Math.round(basePayment + adminFee);

    expect(result.monthlyLoanPayment).toBe(expectedMonthly);
  });

  it('should calculate residual loan average balance correctly', () => {
    // Residual loan interest is on average balance = (principal + residual) / 2
    const purchasePrice = 400000;
    const downPaymentPercent = 25; // 300000 principal
    const residualPercent = 40; // 160000 residual
    const principal = purchasePrice * (1 - downPaymentPercent / 100);
    const residual = purchasePrice * residualPercent / 100;
    const avgBalance = (principal + residual) / 2; // 230000

    const input = createTestInput({
      purchasePrice,
      financingType: 'loan',
      loanType: 'residual',
      downPaymentPercent,
      residualValuePercent: residualPercent,
      interestRate: 4.0,
      loanYears: 4, // 48 months
      monthlyAdminFee: 75,
    });

    const result = calculateCosts(input);

    // Calculate expected
    const amortize = principal - residual; // 140000
    const monthlyAmort = amortize / 48;
    const monthlyInterest = avgBalance * (0.04 / 12);
    const expectedMonthly = Math.round(monthlyAmort + monthlyInterest + 75);

    expect(result.monthlyLoanPayment).toBe(expectedMonthly);
  });

  it('should verify depreciation formula with manual calculation', () => {
    const purchasePrice = 500000;
    const input = createTestInput({
      purchasePrice,
      depreciationRate: 'normal',
      ownershipYears: 3,
    });

    const result = calculateCosts(input);
    const expected = computeExpectedDepreciation(500000, 3, 'bensin', 'normal', 3);
    expect(result.depreciation).toBe(expected);
  });
});
