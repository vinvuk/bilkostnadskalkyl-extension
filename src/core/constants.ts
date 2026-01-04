/**
 * Constants for cost calculations
 * Ported from bilkostnadskalkyl Next.js app
 */

import { UserPreferences, VehicleType, MaintenanceLevel } from '../types';

/** Fuel type definitions with default prices */
export const FUEL_TYPES = [
  { value: 'bensin', label: 'Bensin', unit: 'kr/l', defaultPrice: 18.5 },
  { value: 'diesel', label: 'Diesel', unit: 'kr/l', defaultPrice: 19.5 },
  { value: 'hvo', label: 'HVO', unit: 'kr/l', defaultPrice: 25.0 },
  { value: 'e85', label: 'E85', unit: 'kr/l', defaultPrice: 14.5 },
  { value: 'biogas', label: 'Biogas', unit: 'kr/kg', defaultPrice: 32.0 },
  { value: 'el', label: 'El', unit: 'kr/kWh', defaultPrice: 2.5 },
  { value: 'hybrid', label: 'Hybrid', unit: 'kr/l', defaultPrice: 18.5 },
  { value: 'laddhybrid', label: 'Laddhybrid', unit: 'kr/l', defaultPrice: 18.5 },
] as const;

/** Depreciation rates by category */
export const DEPRECIATION_RATES = {
  low: { year1: 0.10, yearN: 0.08 },
  normal: { year1: 0.15, yearN: 0.12 },
  high: { year1: 0.20, yearN: 0.15 },
} as const;

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
  insurance: 6000,
  parking: 0,
  financingType: 'cash',
  loanType: 'residual',  // Restvärdelån som standard (vanligast på bilsajter)
  loanAmount: 0,
  downPaymentPercent: 20,  // Kontantinsats 20%
  residualValuePercent: 50,  // Restvärde 50%
  interestRate: 5.0,  // Uppdaterad till mer realistisk ränta
  loanYears: 3,  // 3 år är vanligast för restvärdelån
  monthlyAdminFee: 60,  // Administrativ avgift per månad
  annualTax: 2000,
  hasMalusTax: false,
  malusTaxAmount: 0,
  overlayExpanded: false,
};
