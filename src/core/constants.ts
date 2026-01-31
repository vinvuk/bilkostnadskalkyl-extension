/**
 * Constants for cost calculations
 * Ported from bilkostnadskalkyl Next.js app
 */

import { UserPreferences, VehicleType, MaintenanceLevel, DepreciationRate } from '../types';

/** Fuel type definitions with default prices */
export const FUEL_TYPES = [
  { value: 'bensin', label: 'Bensin', unit: 'kr/l', defaultPrice: 18.5 },
  { value: 'diesel', label: 'Diesel', unit: 'kr/l', defaultPrice: 19.5 },
  { value: 'hvo', label: 'HVO', unit: 'kr/l', defaultPrice: 25.0 },
  { value: 'e85', label: 'E85', unit: 'kr/l', defaultPrice: 14.5 },
  { value: 'biogas', label: 'Biogas', unit: 'kr/kg', defaultPrice: 32.0 },
  { value: 'gas', label: 'Fordonsgas/CNG', unit: 'kr/kg', defaultPrice: 32.0 },
  { value: 'el', label: 'El', unit: 'kr/kWh', defaultPrice: 2.5 },
  { value: 'hybrid', label: 'Hybrid', unit: 'kr/l', defaultPrice: 18.5 },
  { value: 'laddhybrid', label: 'Laddhybrid', unit: 'kr/l', defaultPrice: 18.5 },
] as const;

/** Depreciation rates by category (legacy — kept for reference) */
export const DEPRECIATION_RATES = {
  low: { year1: 0.10, yearN: 0.08 },
  normal: { year1: 0.15, yearN: 0.12 },
  high: { year1: 0.20, yearN: 0.15 },
} as const;

/**
 * Age-based depreciation curve
 * Maps vehicle age brackets to annual depreciation rate (fraction of current value lost per year)
 * Based on Swedish market data 2025-2026
 */
export const AGE_DEPRECIATION_CURVE: ReadonlyArray<{ readonly maxAge: number; readonly rate: number }> = [
  { maxAge: 1, rate: 0.25 },        // Year 0→1: 25%
  { maxAge: 3, rate: 0.15 },        // Year 1→3: 15%/year
  { maxAge: 5, rate: 0.10 },        // Year 3→5: 10%/year
  { maxAge: 8, rate: 0.06 },        // Year 5→8: 6%/year
  { maxAge: Infinity, rate: 0.04 }, // Year 8+: 4%/year
];

/**
 * Fuel type multipliers applied to the base age depreciation curve
 * Values > 1.0 mean faster depreciation, < 1.0 mean slower
 * Based on Swedish resale data: EVs lose more, petrol holds value better
 */
export const FUEL_DEPRECIATION_MULTIPLIERS: Readonly<Record<string, number>> = {
  bensin: 0.75,
  diesel: 1.00,
  hybrid: 0.80,
  laddhybrid: 0.90,
  el: 1.25,
  e85: 1.10,
  biogas: 1.10,
  gas: 1.10,
  hvo: 1.00,
};

/**
 * User override factors for the low/normal/high depreciation preference
 * Applied as final multiplier on top of age + fuel model
 */
export const DEPRECIATION_OVERRIDE_FACTORS: Readonly<Record<DepreciationRate, number>> = {
  low: 0.75,
  normal: 1.00,
  high: 1.30,
};

/** Maintenance costs by vehicle type and level (SEK/year at 1500 mil) */
export const MAINTENANCE_COSTS: Record<VehicleType, Record<MaintenanceLevel, number>> = {
  simple: { low: 3000, normal: 5000, high: 8000 },
  normal: { low: 5000, normal: 8000, high: 12000 },
  large: { low: 8000, normal: 12000, high: 18000 },
  luxury: { low: 12000, normal: 20000, high: 35000 },
};

/** Tire replacement costs by vehicle type */
export const TIRE_COSTS: Record<VehicleType, number> = {
  simple: 4000,
  normal: 6000,
  large: 10000,
  luxury: 15000,
};

/** Default annual tax by fuel type */
export const DEFAULT_TAX_BY_FUEL: Record<string, number> = {
  bensin: 2000,
  diesel: 2500,
  el: 360,
  hybrid: 1500,
  laddhybrid: 1200,
  hvo: 2500,
  e85: 1800,
  biogas: 1500,
  gas: 1500,  // Fordonsgas/CNG - same as biogas
};

/** Estimated fuel consumption when not available (l or kWh per mil) */
export const ESTIMATED_CONSUMPTION: Record<string, number> = {
  bensin: 0.7,
  diesel: 0.6,
  el: 2.0,
  hybrid: 0.5,
  laddhybrid: 0.4,
  hvo: 0.6,
  e85: 0.9,
  biogas: 0.8,
  gas: 0.8,  // Fordonsgas/CNG - kg/mil, similar to biogas
};

/** Default user preferences */
export const DEFAULT_PREFERENCES: UserPreferences = {
  annualMileage: 1500,
  primaryFuelType: 'bensin',
  primaryFuelPrice: 18.5,
  hasSecondaryFuel: false,
  secondaryFuelType: 'el',
  secondaryFuelPrice: 2.5,
  secondaryFuelShare: 50,
  vehicleType: 'normal',
  maintenanceLevel: 'normal',
  depreciationRate: 'normal',
  ownershipYears: 5,
  insurance: 500,  // kr/mån (multipliceras med 12 i calculator)
  parking: 0,      // kr/mån (multipliceras med 12 i calculator)
  financingType: 'cash',
  loanType: 'residual',  // Restvärdelån som standard (vanligast på bilsajter)
  loanAmount: 0,
  downPaymentPercent: 20,  // Kontantinsats 20%
  residualValuePercent: 50,  // Restvärde 50%
  interestRate: 5.0,  // Uppdaterad till mer realistisk ränta
  loanYears: 3,  // 3 år är vanligast för restvärdelån
  monthlyAdminFee: 60,  // Administrativ avgift per månad
  leasingType: 'private',  // Privatleasing som standard
  monthlyLeasingFee: 3500,  // Typisk leasingavgift för mellanklass
  leasingIncludesInsurance: false,  // Försäkring ingår normalt inte
  washingCare: 250,  // Tvätt & skötsel kr/mån
  annualTax: 2000,
  hasMalusTax: false,
  malusTaxAmount: 0,
  overlayExpanded: false,
};
