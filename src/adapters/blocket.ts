/**
 * Data extractor for Blocket.se car listings
 */

import { VehicleData, VehicleType } from '../types';
import { ESTIMATED_CONSUMPTION } from '../core/constants';

/**
 * Checks if current page is a Blocket.se car listing
 * @returns true if on a single car listing page
 */
export function isBlocketListingPage(): boolean {
  const path = window.location.pathname;
  // Match /mobility/item/{id} pattern
  return /^\/mobility\/item\/\d+/.test(path);
}

/**
 * Extracts vehicle data from Blocket.se listing page
 * @returns VehicleData or null if extraction fails
 */
export async function extractBlocketData(): Promise<VehicleData | null> {
  try {
    // Wait for dynamic content to load
    await waitForContent();

    // Extract price
    const purchasePrice = extractPrice();
    if (!purchasePrice) {
      console.warn('[Bilkostnadskalkyl] Could not extract price from Blocket');
      return null;
    }

    // Extract specs from page
    const specs = extractSpecs();
    const fuelType = specs.fuelType || 'bensin';

    // Determine if values are estimated
    const isEstimated = {
      fuelConsumption: specs.fuelConsumption === null,
      vehicleType: true, // Always estimated based on car class
    };

    // Estimate consumption if not found
    const fuelConsumption = specs.fuelConsumption ??
      ESTIMATED_CONSUMPTION[fuelType] ??
      ESTIMATED_CONSUMPTION['bensin'];

    // Infer vehicle type from car model/brand
    const vehicleType = inferVehicleType(specs.model, specs.brand, specs.enginePower);

    // Build vehicle name from extracted data
    const vehicleName = buildVehicleName(specs.brand, specs.model, specs.year);

    return {
      purchasePrice,
      fuelType,
      fuelConsumption,
      vehicleYear: specs.year,
      mileage: specs.mileage,
      enginePower: specs.enginePower,
      co2Emissions: specs.co2,
      vehicleType,
      vehicleName,
      effectiveInterestRate: null, // Blocket doesn't show financing details
      isEstimated,
    };
  } catch (error) {
    console.error('[Bilkostnadskalkyl] Blocket extraction error:', error);
    return null;
  }
}

/**
 * Waits for dynamic content to load
 */
async function waitForContent(): Promise<void> {
  return new Promise((resolve) => {
    // Check if price is already visible
    if (document.body.innerText.includes(' kr')) {
      resolve();
      return;
    }

    // Wait for content with timeout
    const observer = new MutationObserver(() => {
      if (document.body.innerText.includes(' kr')) {
        observer.disconnect();
        resolve();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Timeout after 5 seconds
    setTimeout(() => {
      observer.disconnect();
      resolve();
    }, 5000);
  });
}

/**
 * Extracts price from Blocket page
 * Blocket shows price prominently, usually as "XXX XXX kr"
 */
function extractPrice(): number | null {
  const pageText = document.body.innerText;

  // Strategy 1: Look for large price patterns in the page
  // Blocket format: "359 900 kr"
  const pricePattern = /(\d{1,3}(?:[\s\u00a0]\d{3})+)\s*kr/g;
  const matches: number[] = [];

  let match;
  while ((match = pricePattern.exec(pageText)) !== null) {
    const priceStr = match[1].replace(/[\s\u00a0]/g, '');
    const price = parseInt(priceStr, 10);
    // Filter for reasonable car prices (30k - 5M SEK)
    if (price >= 30000 && price <= 5000000) {
      matches.push(price);
    }
  }

  if (matches.length > 0) {
    // Return the highest price (likely the purchase price, not down payment)
    return Math.max(...matches);
  }

  return null;
}

/**
 * Extracts vehicle specifications from Blocket page
 */
function extractSpecs(): {
  fuelType: string | null;
  fuelConsumption: number | null;
  year: number | null;
  mileage: number | null;
  enginePower: number | null;
  co2: number | null;
  model: string | null;
  brand: string | null;
} {
  const specs = {
    fuelType: null as string | null,
    fuelConsumption: null as number | null,
    year: null as number | null,
    mileage: null as number | null,
    enginePower: null as number | null,
    co2: null as number | null,
    model: null as string | null,
    brand: null as string | null,
  };

  const pageText = document.body.innerText;
  const pageTextLower = pageText.toLowerCase();

  // Extract year from "Modellår 2026" or similar patterns
  const yearMatch = pageText.match(/Modellår\s*(\d{4})/i) ||
    pageText.match(/(\d{4})\s*års\s*modell/i);
  if (yearMatch) {
    specs.year = parseInt(yearMatch[1], 10);
  }

  // Extract mileage from "Miltal X mil" or "X mil"
  // Blocket format: "Miltal\n0 mil" or "123 456 mil"
  const mileageMatch = pageText.match(/Miltal\s*[\n\r]?\s*(\d[\d\s]*)\s*mil/i) ||
    pageText.match(/(\d[\d\s]*)\s*mil(?!\w)/i);
  if (mileageMatch) {
    const mileageStr = mileageMatch[1].replace(/\s/g, '');
    const mileage = parseInt(mileageStr, 10);
    if (mileage >= 0 && mileage < 100000) {
      specs.mileage = mileage;
    }
  }

  // Extract fuel type from "Drivmedel" section or page text
  const fuelPatterns = [
    { pattern: /\belbil\b|100%?\s*el\b|electric/i, type: 'el' },
    { pattern: /\bladdhybrid\b|plug-?in\s*hybrid|phev/i, type: 'laddhybrid' },
    { pattern: /\bhybrid\b|elhybrid|mild\s*hybrid/i, type: 'hybrid' },
    { pattern: /\bdiesel\b/i, type: 'diesel' },
    { pattern: /\bbensin\b|petrol/i, type: 'bensin' },
    { pattern: /\be85\b|\betanol\b/i, type: 'e85' },
    { pattern: /\bgas\b|\bbiogas\b|\bcng\b/i, type: 'biogas' },
  ];

  // First check the Drivmedel field specifically
  const drivmedelMatch = pageText.match(/Drivmedel\s*[\n\r]?\s*(\w+)/i);
  if (drivmedelMatch) {
    const drivmedel = drivmedelMatch[1].toLowerCase();
    for (const { pattern, type } of fuelPatterns) {
      if (pattern.test(drivmedel)) {
        specs.fuelType = type;
        break;
      }
    }
  }

  // Also check subtitle/title for hybrid indicators (e.g., "155hk Hybrid")
  if (!specs.fuelType || specs.fuelType === 'bensin') {
    for (const { pattern, type } of fuelPatterns) {
      if (pattern.test(pageTextLower)) {
        // Don't override bensin with bensin, but do override with hybrid etc.
        if (type !== 'bensin' || !specs.fuelType) {
          specs.fuelType = type;
        }
        break;
      }
    }
  }

  // Extract engine power from "XXXhk" pattern
  const powerMatch = pageText.match(/(\d{2,4})\s*hk/i);
  if (powerMatch) {
    specs.enginePower = parseInt(powerMatch[1], 10);
  }

  // Extract CO2 emissions if available
  const co2Match = pageText.match(/(\d+)\s*g\s*(?:CO2|co2|koldioxid)/i) ||
    pageText.match(/CO2[:\s]*(\d+)\s*g/i);
  if (co2Match) {
    specs.co2 = parseInt(co2Match[1], 10);
  }

  // Extract fuel consumption if available (l/100km or l/mil)
  const consumptionMatch = pageText.match(/([\d,\.]+)\s*(?:l|liter)\/100\s*km/i);
  if (consumptionMatch) {
    const per100km = parseFloat(consumptionMatch[1].replace(',', '.'));
    specs.fuelConsumption = per100km / 10; // Convert to l/mil
  }

  // Extract brand and model from title/breadcrumb
  // Breadcrumb format: "Bil och husvagn / Bilar / Dacia / Bigster"
  const breadcrumb = document.querySelector('[class*="breadcrumb"]') ||
    document.querySelector('nav[aria-label*="bread"]');

  if (breadcrumb) {
    const links = breadcrumb.querySelectorAll('a');
    const crumbs = Array.from(links).map(a => a.textContent?.trim()).filter(Boolean);
    // Usually: ["Bil och husvagn", "Bilar", "Brand", "Model"]
    if (crumbs.length >= 4) {
      specs.brand = crumbs[crumbs.length - 2] || null;
      specs.model = crumbs[crumbs.length - 1] || null;
    }
  }

  // Fallback: Try to get from h1 title
  if (!specs.brand || !specs.model) {
    const h1 = document.querySelector('h1');
    if (h1?.textContent) {
      const titleMatch = h1.textContent.match(/^([A-Za-zÅÄÖåäö]+)\s+(.+)/);
      if (titleMatch) {
        specs.brand = specs.brand || titleMatch[1];
        specs.model = specs.model || titleMatch[2].split(/\s+/)[0];
      }
    }
  }

  return specs;
}

/**
 * Infers vehicle type based on brand, model, and power
 */
function inferVehicleType(
  model: string | null,
  brand: string | null,
  power: number | null
): VehicleType {
  const modelLower = (model || '').toLowerCase();
  const brandLower = (brand || '').toLowerCase();

  // Luxury brands
  const luxuryBrands = ['porsche', 'bmw', 'mercedes', 'audi', 'lexus', 'jaguar', 'maserati', 'bentley', 'rolls'];
  if (luxuryBrands.some(b => brandLower.includes(b))) {
    return power && power > 300 ? 'luxury' : 'large';
  }

  // Large SUVs and models
  const largeModels = ['xc90', 'xc60', 'q7', 'q8', 'x5', 'x6', 'x7', 'gle', 'gls', 'cayenne', 'touareg', 'land cruiser', 'bigster'];
  if (largeModels.some(m => modelLower.includes(m))) {
    return 'large';
  }

  // Simple/small cars
  const simpleModels = ['up', 'mii', 'citigo', 'aygo', 'c1', '108', 'twingo', 'smart', 'i10', 'picanto', 'spark', 'sandero', 'spring'];
  if (simpleModels.some(m => modelLower.includes(m))) {
    return 'simple';
  }

  // Budget brands tend to be simpler
  const budgetBrands = ['dacia', 'seat', 'skoda'];
  if (budgetBrands.some(b => brandLower.includes(b)) && (!power || power < 150)) {
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
 * Builds a display-friendly vehicle name from extracted parts
 */
function buildVehicleName(
  brand: string | null,
  model: string | null,
  year: number | null
): string | null {
  if (brand && model) {
    const capitalizedBrand = brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase();
    const capitalizedModel = model.charAt(0).toUpperCase() + model.slice(1);
    const yearStr = year ? ` ${year}` : '';
    return `${capitalizedBrand} ${capitalizedModel}${yearStr}`;
  }

  // Fallback: try to get from h1
  const h1 = document.querySelector('h1');
  if (h1?.textContent) {
    const title = h1.textContent.trim();
    if (title.length > 3 && title.length < 50) {
      return year ? `${title} ${year}` : title;
    }
  }

  return null;
}

/**
 * Finds a suitable anchor element for the overlay on Blocket
 */
export function getBlocketOverlayAnchor(): HTMLElement | null {
  // Strategy 1: Find the price section
  const priceElements = document.querySelectorAll('*');
  for (const el of priceElements) {
    if (el.textContent?.match(/^\d{1,3}(?:[\s\u00a0]\d{3})+\s*kr$/)) {
      // Found price element, return its parent container
      let parent = el.parentElement;
      let attempts = 0;
      while (parent && attempts < 5) {
        const rect = parent.getBoundingClientRect();
        if (rect.width > 200 && rect.height > 50) {
          return parent as HTMLElement;
        }
        parent = parent.parentElement;
        attempts++;
      }
      return el.parentElement as HTMLElement;
    }
  }

  // Strategy 2: Find the main content area after the image gallery
  const main = document.querySelector('main') ||
               document.querySelector('[role="main"]') ||
               document.querySelector('article');
  if (main) {
    // Look for the section with the title (h1)
    const h1 = main.querySelector('h1');
    if (h1?.parentElement) {
      return h1.parentElement as HTMLElement;
    }
    return main as HTMLElement;
  }

  // Strategy 3: Find h1 element
  const h1 = document.querySelector('h1');
  if (h1) {
    return h1 as HTMLElement;
  }

  // Fallback: Create fixed container
  let fixedContainer = document.getElementById('bkk-fixed-anchor');
  if (!fixedContainer) {
    fixedContainer = document.createElement('div');
    fixedContainer.id = 'bkk-fixed-anchor';
    fixedContainer.style.cssText = `
      position: fixed;
      top: 100px;
      right: 20px;
      z-index: 9999;
    `;
    document.body.appendChild(fixedContainer);
  }
  return fixedContainer;
}
