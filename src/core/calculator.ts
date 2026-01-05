/**
 * Cost calculation engine for Bilkostnadskalkyl
 * Ported from bilkostnadskalkyl Next.js app
 */

import { CalculatorInput, CostBreakdown, VehicleData, UserPreferences, LoanType } from '../types';
import { DEPRECIATION_RATES, MAINTENANCE_COSTS, TIRE_COSTS, ESTIMATED_CONSUMPTION, DEFAULT_TAX_BY_FUEL } from './constants';

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

  // Depreciation calculation
  const rates = DEPRECIATION_RATES[input.depreciationRate];
  let totalDepreciation = 0;
  let currentValue = input.purchasePrice;

  for (let year = 1; year <= input.ownershipYears; year++) {
    const rate = year === 1 ? rates.year1 : rates.yearN;
    const yearDepreciation = currentValue * rate;
    totalDepreciation += yearDepreciation;
    currentValue -= yearDepreciation;
  }

  const annualDepreciation = totalDepreciation / input.ownershipYears;

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
    const tireReplacementYears = Math.max(2, Math.min(5, 60000 / mileageKm));
    annualTireCost = TIRE_COSTS[input.vehicleType] / tireReplacementYears;
  }

  // Fixed costs (insurance and parking are monthly values, multiply by 12)
  const annualInsurance = input.insurance * 12;
  const annualParking = input.parking * 12;

  // Financing cost calculation - supports both loan types
  let annualFinancing = 0;
  let monthlyLoanPayment = 0;
  if (input.financingType === 'loan' && input.loanYears > 0) {
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

      monthlyLoanPayment = monthlyAmortization + monthlyInterest + input.monthlyAdminFee;
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
      monthlyLoanPayment += input.monthlyAdminFee;
    }

    // Round monthly payment first, then calculate annual to ensure consistency
    // (displayed monthly × 12 = displayed annual)
    monthlyLoanPayment = Math.round(monthlyLoanPayment);
    annualFinancing = monthlyLoanPayment * 12;
  }

  // Totals
  const variableCosts = annualFuelCost + annualMaintenance + annualTireCost;
  const fixedCosts = annualTax + annualInsurance + annualParking + annualFinancing + annualDepreciation;
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

  // Get tax: use user preference if they've customized it, otherwise use fuel-type default
  // We check if prefs.annualTax differs from the generic default (2000) to detect customization
  const defaultTaxForFuel = DEFAULT_TAX_BY_FUEL[fuelType] ?? 2000;
  const annualTax = prefs.annualTax !== 2000 ? prefs.annualTax : defaultTaxForFuel;

  // For electric vehicles, use secondaryFuelPrice (electricity price) as primary
  const isElectric = fuelType === 'el';
  const primaryFuelPrice = isElectric ? prefs.secondaryFuelPrice : prefs.primaryFuelPrice;

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
