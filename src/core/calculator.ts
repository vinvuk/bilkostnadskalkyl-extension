/**
 * Cost calculation engine for Bilkostnadskalkyl
 * Ported from bilkostnadskalkyl Next.js app
 */

import { CalculatorInput, CostBreakdown, VehicleData, UserPreferences, LoanType, LeasingType } from '../types';
import { MAINTENANCE_COSTS, TIRE_COSTS, ESTIMATED_CONSUMPTION, DEFAULT_TAX_BY_FUEL, AGE_DEPRECIATION_CURVE, FUEL_DEPRECIATION_MULTIPLIERS, DEPRECIATION_OVERRIDE_FACTORS } from './constants';

/**
 * Returns the base annual depreciation rate for a vehicle of a given age
 * Looks up the age in the AGE_DEPRECIATION_CURVE brackets
 * @param age - Vehicle age in years at the start of the ownership year
 * @returns Base depreciation rate as a fraction (e.g. 0.15 = 15%)
 */
export function getDepreciationRateForAge(age: number): number {
  for (const bracket of AGE_DEPRECIATION_CURVE) {
    if (age < bracket.maxAge) {
      return bracket.rate;
    }
  }
  return AGE_DEPRECIATION_CURVE[AGE_DEPRECIATION_CURVE.length - 1].rate;
}

/**
 * Calculates the total cost of vehicle ownership
 * @param input - Calculator input combining vehicle data and user preferences
 * @returns Complete cost breakdown with all annual costs
 */
export function calculateCosts(input: CalculatorInput): CostBreakdown {
  const mileageKm = input.annualMileage * 10; // mil to km

  // Fuel cost calculation
  let fuelCostPerKm = 0;
  const consumption = input.fuelConsumption; // per 10 km (1 mil)

  if (input.hasSecondaryFuel) {
    const primaryShare = (100 - input.secondaryFuelShare) / 100;
    const secondaryShare = input.secondaryFuelShare / 100;
    fuelCostPerKm =
      (consumption * input.primaryFuelPrice * primaryShare +
        consumption * input.secondaryFuelPrice * secondaryShare) / 10;
  } else {
    fuelCostPerKm = (consumption * input.primaryFuelPrice) / 10;
  }

  const annualFuelCost = fuelCostPerKm * mileageKm;

  // Depreciation calculation — age-based + fuel-type-aware model
  const fuelMultiplier = FUEL_DEPRECIATION_MULTIPLIERS[input.primaryFuelType] ?? 1.0;
  const overrideFactor = DEPRECIATION_OVERRIDE_FACTORS[input.depreciationRate];
  const startAge = input.vehicleAge ?? 0;

  let totalDepreciation = 0;
  let currentValue = input.purchasePrice;

  for (let year = 0; year < input.ownershipYears; year++) {
    const baseRate = getDepreciationRateForAge(startAge + year);
    const effectiveRate = Math.min(1, Math.max(0, baseRate * fuelMultiplier * overrideFactor));
    const yearDepreciation = currentValue * effectiveRate;
    totalDepreciation += yearDepreciation;
    currentValue -= yearDepreciation;
  }

  const annualDepreciation = input.ownershipYears > 0
    ? totalDepreciation / input.ownershipYears
    : 0;

  // Tax
  const annualTax = input.annualTax + (input.hasMalusTax ? input.malusTaxAmount : 0);

  // Maintenance (scaled by mileage, base is 1500 mil/year)
  const baseMaintenance = MAINTENANCE_COSTS[input.vehicleType][input.maintenanceLevel];
  const mileageMultiplier = input.annualMileage / 1500;
  const annualMaintenance = baseMaintenance * mileageMultiplier;

  // Tires (replace based on km driven, typically every 60,000 km)
  // Use user-provided value if available, otherwise calculate
  let annualTireCost: number;
  if (input.annualTireCost !== undefined && input.annualTireCost > 0) {
    annualTireCost = input.annualTireCost;
  } else {
    // Guard against division by zero - use max replacement years if no mileage
    const tireReplacementYears = mileageKm > 0
      ? Math.max(2, Math.min(5, 60000 / mileageKm))
      : 5;
    annualTireCost = TIRE_COSTS[input.vehicleType] / tireReplacementYears;
  }

  // Fixed costs (insurance, parking, washing are monthly values, multiply by 12)
  // For leasing with included insurance, don't add insurance separately
  const annualInsurance = (input.financingType === 'leasing' && input.leasingIncludesInsurance)
    ? 0
    : input.insurance * 12;
  const annualParking = input.parking * 12;
  const annualWashingCare = input.washingCare * 12;

  // Financing cost calculation - supports loan, leasing, and cash
  let annualFinancing = 0;
  let monthlyLoanPayment = 0;

  if (input.financingType === 'leasing') {
    // Leasing: Use the manually entered monthly fee
    monthlyLoanPayment = Math.round(input.monthlyLeasingFee);
    annualFinancing = monthlyLoanPayment * 12;
  } else if (input.financingType === 'loan' && input.loanYears > 0) {
    const monthlyRate = input.interestRate / 100 / 12;
    const numPayments = input.loanYears * 12;

    // Calculate loan principal from purchase price and down payment
    const downPayment = input.purchasePrice * (input.downPaymentPercent / 100);
    const loanPrincipal = input.purchasePrice - downPayment;

    if (input.loanType === 'residual') {
      // Restvärdelån (balloon loan): Lower monthly payments, residual due at end
      const residualValue = input.purchasePrice * (input.residualValuePercent / 100);

      // Amount to amortize during loan term (principal minus residual)
      const amortizeAmount = Math.max(0, loanPrincipal - residualValue);
      const monthlyAmortization = amortizeAmount / numPayments;

      // Interest calculated on average outstanding balance
      const averageBalance = (loanPrincipal + residualValue) / 2;
      const monthlyInterest = averageBalance * monthlyRate;

      // Admin fee removed - already included in effective interest rate
      monthlyLoanPayment = monthlyAmortization + monthlyInterest;
    } else {
      // Annuitetslån (traditional loan): Full payoff during loan term
      if (monthlyRate > 0) {
        // Annuity formula: M = P * [r(1+r)^n] / [(1+r)^n - 1]
        const factor = Math.pow(1 + monthlyRate, numPayments);
        monthlyLoanPayment = loanPrincipal * (monthlyRate * factor) / (factor - 1);
      } else {
        // 0% interest - just divide by number of payments
        monthlyLoanPayment = loanPrincipal / numPayments;
      }
      // Admin fee removed - already included in effective interest rate
    }

    // Round monthly payment first, then calculate annual to ensure consistency
    // (displayed monthly × 12 = displayed annual)
    monthlyLoanPayment = Math.round(monthlyLoanPayment);
    annualFinancing = monthlyLoanPayment * 12;
  }

  // Totals
  const variableCosts = annualFuelCost + annualMaintenance + annualTireCost;
  const fixedCosts = annualTax + annualInsurance + annualParking + annualWashingCare + annualFinancing + annualDepreciation;
  const totalAnnual = variableCosts + fixedCosts;
  const costPerMil = input.annualMileage > 0 ? totalAnnual / input.annualMileage : 0;
  const costPerKm = mileageKm > 0 ? totalAnnual / mileageKm : 0;
  const monthlyTotal = totalAnnual / 12;

  return {
    fuel: Math.round(annualFuelCost),
    depreciation: Math.round(annualDepreciation),
    tax: Math.round(annualTax),
    maintenance: Math.round(annualMaintenance),
    tires: Math.round(annualTireCost),
    insurance: Math.round(annualInsurance),
    parking: Math.round(annualParking),
    washingCare: Math.round(annualWashingCare),
    financing: annualFinancing, // Already calculated from rounded monthly
    monthlyLoanPayment: monthlyLoanPayment, // Already rounded
    variableCosts: Math.round(variableCosts),
    fixedCosts: Math.round(fixedCosts),
    totalAnnual: Math.round(totalAnnual),
    costPerMil: Math.round(costPerMil),
    costPerKm: costPerKm.toFixed(2),
    monthlyTotal: Math.round(monthlyTotal),
  };
}

/**
 * Combines vehicle data with user preferences to create calculator input
 * @param vehicle - Data extracted from car listing
 * @param prefs - User preferences from storage
 * @returns Complete input for cost calculation
 */
export function createCalculatorInput(vehicle: VehicleData, prefs: UserPreferences): CalculatorInput {
  // Use extracted fuel consumption or estimate based on fuel type
  const fuelConsumption = vehicle.fuelConsumption ??
    ESTIMATED_CONSUMPTION[vehicle.fuelType] ??
    ESTIMATED_CONSUMPTION['bensin'];

  // Determine fuel price based on extracted fuel type
  const fuelType = normalizeFuelType(vehicle.fuelType);

  // Get tax priority:
  // 1. Use extracted tax from listing if available (most accurate)
  // 2. Use user's customized preference if they've changed it from default
  // 3. Fall back to fuel-type default estimate
  const defaultTaxForFuel = DEFAULT_TAX_BY_FUEL[fuelType] ?? 2000;
  let annualTax: number;
  if (vehicle.annualTax !== null && vehicle.annualTax > 0) {
    // Use extracted tax from the listing
    annualTax = vehicle.annualTax;
  } else if (prefs.annualTax !== 2000) {
    // User has customized the tax
    annualTax = prefs.annualTax;
  } else {
    // Fall back to fuel-type default
    annualTax = defaultTaxForFuel;
  }

  // For electric vehicles, use secondaryFuelPrice (electricity price) as primary
  const isElectric = fuelType === 'el';
  const primaryFuelPrice = isElectric ? prefs.secondaryFuelPrice : prefs.primaryFuelPrice;

  // Compute vehicle age from year — null if extraction failed (triggers fallback in calculator)
  const vehicleAge = vehicle.vehicleYear !== null
    ? Math.max(0, new Date().getFullYear() - vehicle.vehicleYear)
    : null;

  return {
    purchasePrice: vehicle.purchasePrice,
    fuelConsumption,
    primaryFuelType: fuelType,
    primaryFuelPrice,
    hasSecondaryFuel: fuelType === 'laddhybrid',
    secondaryFuelType: 'el',
    secondaryFuelPrice: prefs.secondaryFuelPrice,
    secondaryFuelShare: fuelType === 'laddhybrid' ? prefs.secondaryFuelShare : 0,
    annualMileage: prefs.annualMileage,
    vehicleType: vehicle.vehicleType,
    maintenanceLevel: prefs.maintenanceLevel,
    depreciationRate: prefs.depreciationRate,
    vehicleAge,
    ownershipYears: prefs.ownershipYears,
    insurance: prefs.insurance,
    parking: prefs.parking,
    financingType: prefs.financingType ?? 'cash',
    loanType: prefs.loanType ?? 'residual',
    loanAmount: prefs.loanAmount ?? 0,
    downPaymentPercent: prefs.downPaymentPercent ?? 20,
    residualValuePercent: prefs.residualValuePercent ?? 50,
    interestRate: prefs.interestRate ?? 5.0,
    loanYears: prefs.loanYears ?? 3,
    monthlyAdminFee: prefs.monthlyAdminFee ?? 60,
    leasingType: prefs.leasingType ?? 'private',
    monthlyLeasingFee: prefs.monthlyLeasingFee ?? 3500,
    leasingIncludesInsurance: prefs.leasingIncludesInsurance ?? false,
    washingCare: prefs.washingCare ?? 250,
    annualTax,
    hasMalusTax: prefs.hasMalusTax ?? false,
    malusTaxAmount: prefs.malusTaxAmount ?? 0,
    annualTireCost: prefs.annualTireCost,
  };
}

/**
 * Normalizes fuel type string to standard key
 * @param fuelType - Raw fuel type string from page
 * @returns Normalized fuel type key
 */
function normalizeFuelType(fuelType: string): string {
  const normalized = fuelType.toLowerCase().trim();

  if (normalized.includes('bensin')) return 'bensin';
  if (normalized.includes('diesel')) return 'diesel';
  if (normalized.includes('laddhybrid') || normalized.includes('plug-in')) return 'laddhybrid';
  if (normalized.includes('hybrid') || normalized.includes('elhybrid')) return 'hybrid';
  if (normalized.includes('el') || normalized.includes('electric')) return 'el';
  if (normalized.includes('e85') || normalized.includes('etanol')) return 'e85';
  if (normalized.includes('gas') || normalized.includes('biogas')) return 'biogas';

  return 'bensin'; // Default fallback
}
