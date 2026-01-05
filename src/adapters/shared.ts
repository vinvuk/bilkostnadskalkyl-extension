/**
 * Shared utilities for site adapters
 * Contains common functions used across Blocket, Wayke, and Carla adapters
 */

import { VehicleType } from '../types';

/**
 * Lists of vehicle models and brands for classification
 */
const LUXURY_BRANDS = [
  'porsche', 'bmw', 'mercedes', 'audi', 'lexus',
  'jaguar', 'maserati', 'bentley', 'rolls', 'ferrari',
  'lamborghini', 'aston martin', 'tesla'
];

const LARGE_MODELS = [
  'xc90', 'xc60', 'q7', 'q8', 'x5', 'x6', 'x7',
  'gle', 'gls', 'cayenne', 'touareg', 'land cruiser',
  'bigster', 'discovery', 'range rover', 'defender',
  'navigator', 'escalade', 'tahoe', 'suburban'
];

const SIMPLE_MODELS = [
  'up', 'mii', 'citigo', 'aygo', 'c1', '108',
  'twingo', 'smart', 'i10', 'picanto', 'spark',
  'sandero', 'spring', 'logan', 'ka', 'fiesta',
  '500', 'panda', 'alto', 'celerio'
];

const BUDGET_BRANDS = ['dacia', 'seat', 'skoda', 'fiat', 'suzuki'];

/**
 * Infers vehicle type from model, brand, and engine power
 * Used to estimate maintenance and service costs
 * @param model - Vehicle model name
 * @param brand - Vehicle brand/manufacturer
 * @param power - Engine power in horsepower
 * @returns Inferred vehicle type classification
 */
export function inferVehicleType(
  model: string | null,
  brand: string | null,
  power: number | null
): VehicleType {
  const modelLower = (model || '').toLowerCase();
  const brandLower = (brand || '').toLowerCase();

  // Luxury brands
  if (LUXURY_BRANDS.some(b => brandLower.includes(b))) {
    return power && power > 300 ? 'luxury' : 'large';
  }

  // Large SUVs and models
  if (LARGE_MODELS.some(m => modelLower.includes(m))) {
    return 'large';
  }

  // Simple/small cars
  if (SIMPLE_MODELS.some(m => modelLower.includes(m))) {
    return 'simple';
  }

  // Budget brands tend to be simpler
  if (BUDGET_BRANDS.some(b => brandLower.includes(b)) && (!power || power < 150)) {
    return 'simple';
  }

  // Default based on power
  if (power) {
    if (power > 300) return 'large';
    if (power < 100) return 'simple';
  }

  return 'normal';
}

/**
 * Capitalizes the first letter of a string
 * @param str - String to capitalize
 * @returns Capitalized string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Builds a display-friendly vehicle name from extracted parts
 * Falls back to page elements if parts are missing
 * @param brand - Vehicle brand/manufacturer
 * @param model - Vehicle model name
 * @param year - Vehicle model year
 * @returns Formatted vehicle name or null
 */
export function buildVehicleName(
  brand: string | null,
  model: string | null,
  year: number | null
): string | null {
  // Try to build from extracted parts
  if (brand && model) {
    const capitalizedBrand = capitalize(brand);
    const capitalizedModel = model.charAt(0).toUpperCase() + model.slice(1);
    const yearStr = year ? ` ${year}` : '';
    return `${capitalizedBrand} ${capitalizedModel}${yearStr}`;
  }

  // Fallback: try to get from page title
  const title = document.title;
  if (title) {
    // Many car site titles follow "Brand Model Year - SiteName" format
    const cleaned = title.split(/[-|–]/)[0].trim();
    if (cleaned && cleaned.length > 3 && cleaned.length < 50) {
      return cleaned;
    }
  }

  // Fallback: try h1
  const h1 = document.querySelector('h1');
  if (h1?.textContent) {
    const h1Text = h1.textContent.trim();
    if (h1Text.length > 3 && h1Text.length < 50) {
      return year ? `${h1Text} ${year}` : h1Text;
    }
  }

  return null;
}

/**
 * Waits for dynamic content to load on the page
 * Resolves when price text is found or after timeout
 * @param timeout - Maximum wait time in milliseconds (default: 5000)
 * @returns Promise that resolves when content is ready
 */
export function waitForContent(timeout: number = 5000): Promise<void> {
  return new Promise((resolve) => {
    // Check if price is already visible
    if (document.body.innerText.includes(' kr')) {
      resolve();
      return;
    }

    // Wait for content with MutationObserver
    const observer = new MutationObserver(() => {
      if (document.body.innerText.includes(' kr')) {
        observer.disconnect();
        resolve();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Timeout after specified duration
    setTimeout(() => {
      observer.disconnect();
      resolve();
    }, timeout);
  });
}

/**
 * Parses a Swedish formatted price string to a number
 * Handles formats like "299 900 kr", "299900kr", "299 900:-"
 * @param priceText - Price text to parse
 * @returns Parsed price number or null if invalid
 */
export function parseSwedishPrice(priceText: string): number | null {
  // Remove common currency indicators and whitespace
  const cleaned = priceText
    .replace(/kr\.?/gi, '')
    .replace(/:-/g, '')
    .replace(/sek/gi, '')
    .replace(/[\s\u00a0]/g, '') // Remove regular and non-breaking spaces
    .trim();

  const parsed = parseInt(cleaned, 10);

  // Validate reasonable car price range (10,000 - 10,000,000 kr)
  if (!isNaN(parsed) && parsed >= 10000 && parsed <= 10000000) {
    return parsed;
  }

  return null;
}

/**
 * Normalizes fuel type strings to standard format
 * @param fuelType - Raw fuel type string
 * @returns Normalized fuel type key
 */
export function normalizeFuelType(fuelType: string): string {
  const lower = fuelType.toLowerCase().trim();

  // Map common variations to standard keys
  const mappings: Record<string, string> = {
    'bensin': 'bensin',
    'diesel': 'diesel',
    'el': 'el',
    'electric': 'el',
    'elbil': 'el',
    'laddhybrid': 'laddhybrid',
    'plug-in hybrid': 'laddhybrid',
    'plug-in-hybrid': 'laddhybrid',
    'phev': 'laddhybrid',
    'mildhybrid': 'mildhybrid',
    'mild hybrid': 'mildhybrid',
    'hybrid': 'mildhybrid',
    'etanol': 'etanol',
    'e85': 'etanol',
    'gas': 'gas',
    'cng': 'gas',
    'lpg': 'gas',
    'naturgas': 'gas',
  };

  return mappings[lower] || 'bensin';
}
