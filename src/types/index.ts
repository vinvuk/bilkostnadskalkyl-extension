/**
 * Type definitions for the Bilkostnadskalkyl Chrome Extension
 */

/** Vehicle data extracted from car listing page */
export interface VehicleData {
  purchasePrice: number;
  fuelType: string;  // Normalized type for calculations (e.g., 'laddhybrid', 'diesel')
  fuelTypeLabel: string | null;  // Original label from ad for display (e.g., 'Bensin+El', 'Diesel')
  fuelConsumption: number | null;  // null if needs estimation
  vehicleYear: number | null;
  mileage: number | null;
  enginePower: number | null;
  co2Emissions: number | null;
  vehicleType: VehicleType;
  vehicleName: string | null;  // e.g. "Volvo XC40 2023"
  imageUrl: string | null;  // Main image URL for PDF export
  registrationNumber: string | null;  // Swedish registration number (e.g., "ABC123")
  effectiveInterestRate: number | null;  // Extracted from listing if available
  annualTax: number | null;  // Extracted vehicle tax from listing (kr/year)
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
export type FinancingType = 'cash' | 'loan' | 'leasing';

/** Loan calculation type */
export type LoanType = 'residual' | 'annuity';

/** Leasing type */
export type LeasingType = 'private' | 'business';

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
  leasingType: LeasingType;  // Privat- eller företagsleasing
  monthlyLeasingFee: number;  // Månatlig leasingavgift
  leasingIncludesInsurance: boolean;  // Om försäkring ingår i leasingavgiften
  washingCare: number;  // Tvätt & skötsel per månad
  annualTax: number;
  hasMalusTax: boolean;
  malusTaxAmount: number;
  annualTireCost?: number;  // Årlig däckkostnad (valfritt, beräknas annars)
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
  vehicleAge: number | null;  // Age of vehicle at purchase (years), null if unknown
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
  leasingType: LeasingType;
  monthlyLeasingFee: number;
  leasingIncludesInsurance: boolean;
  washingCare: number;
  annualTax: number;
  hasMalusTax: boolean;
  malusTaxAmount: number;
  annualTireCost?: number;  // Override for calculated tire cost
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
  washingCare: number;
  financing: number;
  monthlyLoanPayment: number;
  variableCosts: number;
  fixedCosts: number;
  totalAnnual: number;
  costPerMil: number;
  costPerKm: string;
  monthlyTotal: number;
}

/** Site identifier for history tracking */
export type SiteName = 'blocket' | 'wayke' | 'carla';

/** History item for a viewed car */
export interface HistoryItem {
  id: string;
  url: string;
  site: SiteName;
  vehicleName: string | null;
  purchasePrice: number;
  fuelType: string;
  fuelTypeLabel: string | null;
  vehicleYear: number | null;
  mileage: number | null;
  imageUrl: string | null;  // Main image URL
  registrationNumber: string | null;  // Swedish registration number
  monthlyTotal: number;
  costPerMil: number;
  timestamp: number;
  // Extended fields for backend sync (optional for backward compat with existing history)
  enginePower?: number | null;
  vehicleType?: string | null;
  fuelCost?: number | null;         // Annual fuel cost
  depreciationCost?: number | null;  // Annual depreciation
  taxCost?: number | null;           // Annual tax
  maintenanceCost?: number | null;   // Annual maintenance
  insuranceCost?: number | null;     // Annual insurance
  syncedAt?: number | null;          // Timestamp of last successful sync
}
