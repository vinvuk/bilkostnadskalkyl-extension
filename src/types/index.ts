/**
 * Type definitions for the Bilkostnadskalkyl Chrome Extension
 */

/** Vehicle data extracted from car listing page */
export interface VehicleData {
  purchasePrice: number;
  fuelType: string;
  fuelConsumption: number | null;  // null if needs estimation
  vehicleYear: number | null;
  mileage: number | null;
  enginePower: number | null;
  co2Emissions: number | null;
  vehicleType: VehicleType;
  vehicleName: string | null;  // e.g. "Volvo XC40 2023"
  isEstimated: {
    fuelConsumption: boolean;
    vehicleType: boolean;
  };
}

/** Vehicle type for maintenance/tire cost calculations */
export type VehicleType = 'simple' | 'normal' | 'large' | 'luxury';

/** Maintenance level */
export type MaintenanceLevel = 'low' | 'normal' | 'high';

/** Depreciation rate */
export type DepreciationRate = 'low' | 'normal' | 'high';

/** Financing type */
export type FinancingType = 'cash' | 'loan';

/** Loan calculation type */
export type LoanType = 'residual' | 'annuity';

/** User preferences stored in Chrome storage */
export interface UserPreferences {
  annualMileage: number;
  primaryFuelType: string;
  primaryFuelPrice: number;
  hasSecondaryFuel: boolean;
  secondaryFuelType: string;
  secondaryFuelPrice: number;
  secondaryFuelShare: number;
  vehicleType: VehicleType;
  maintenanceLevel: MaintenanceLevel;
  depreciationRate: DepreciationRate;
  ownershipYears: number;
  insurance: number;
  parking: number;
  financingType: FinancingType;
  loanType: LoanType;  // Restvärdelån eller Annuitetslån
  loanAmount: number;
  downPaymentPercent: number;  // Kontantinsats i procent
  residualValuePercent: number;  // Restvärde i procent
  interestRate: number;
  loanYears: number;
  monthlyAdminFee: number;  // Administrativ avgift per månad
  annualTax: number;
  hasMalusTax: boolean;
  malusTaxAmount: number;
  overlayExpanded: boolean;
}

/** Input for cost calculations */
export interface CalculatorInput {
  purchasePrice: number;
  fuelConsumption: number;
  primaryFuelType: string;
  primaryFuelPrice: number;
  hasSecondaryFuel: boolean;
  secondaryFuelType: string;
  secondaryFuelPrice: number;
  secondaryFuelShare: number;
  annualMileage: number;
  vehicleType: VehicleType;
  maintenanceLevel: MaintenanceLevel;
  depreciationRate: DepreciationRate;
  ownershipYears: number;
  insurance: number;
  parking: number;
  financingType: FinancingType;
  loanType: LoanType;
  loanAmount: number;
  downPaymentPercent: number;
  residualValuePercent: number;
  interestRate: number;
  loanYears: number;
  monthlyAdminFee: number;
  annualTax: number;
  hasMalusTax: boolean;
  malusTaxAmount: number;
}

/** Cost breakdown result */
export interface CostBreakdown {
  fuel: number;
  depreciation: number;
  tax: number;
  maintenance: number;
  tires: number;
  insurance: number;
  parking: number;
  financing: number;
  monthlyLoanPayment: number;
  variableCosts: number;
  fixedCosts: number;
  totalAnnual: number;
  costPerMil: number;
  costPerKm: string;
  monthlyTotal: number;
}
