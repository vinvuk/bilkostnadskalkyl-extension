/**
 * Data extractor for Wayke.se car listings
 */

import { VehicleData } from '../types';
import { ESTIMATED_CONSUMPTION } from '../core/constants';
import { inferVehicleType, buildVehicleName } from './shared';

/**
 * Checks if current page is a Wayke.se car listing
 * @returns true if on a single car listing page
 */
export function isWaykeListingPage(): boolean {
  const path = window.location.pathname;
  // Match /objekt/{uuid}/{slug} pattern
  return /^\/objekt\/[a-f0-9-]+\//.test(path);
}

/**
 * Extracts vehicle data from Wayke.se listing page
 * @returns VehicleData or null if extraction fails
 */
export async function extractWaykeData(): Promise<VehicleData | null> {
  try {
    // Wait for dynamic content to load
    await waitForContent();

    // Extract price
    const purchasePrice = extractPrice();
    if (!purchasePrice) {
      console.warn('[Bilkostnadskalkyl] Could not extract price from Wayke');
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

    // Build vehicle name from extracted data or page title
    const vehicleName = buildVehicleName(specs.brand, specs.model, specs.year);

    return {
      purchasePrice,
      fuelType,
      fuelTypeLabel: specs.fuelTypeLabel,
      fuelConsumption,
      vehicleYear: specs.year,
      mileage: specs.mileage,
      enginePower: specs.enginePower,
      co2Emissions: specs.co2,
      vehicleType,
      vehicleName,
      effectiveInterestRate: specs.effectiveInterestRate,
      isEstimated,
    };
  } catch (error) {
    console.error('[Bilkostnadskalkyl] Wayke extraction error:', error);
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
 * Extracts price from Wayke page
 * Wayke shows price prominently, usually in h2 or similar
 */
function extractPrice(): number | null {
  const pageText = document.body.innerText;

  // Strategy 1: Find price elements in DOM with large font
  const pricePattern = /^(\d{1,3}(?:[\s\u00a0]\d{3})+)\s*kr$/;
  const allElements = document.querySelectorAll('h1, h2, h3, [class*="price" i], [class*="Price"]');

  for (const el of allElements) {
    if (el.textContent) {
      const text = el.textContent.trim();
      if (pricePattern.test(text)) {
        const priceStr = text.replace(/[^\d]/g, '');
        const price = parseInt(priceStr, 10);
        if (price > 10000 && price < 10000000) {
          return price;
        }
      }
    }
  }

  // Strategy 2: Text-based search for prices in car range
  const matches = pageText.match(/(\d{1,3}(?:[\s\u00a0]\d{3})+)\s*kr/g) || [];
  const prices: number[] = [];

  for (const match of matches) {
    const priceStr = match.replace(/[^\d]/g, '');
    const price = parseInt(priceStr, 10);
    // Filter for reasonable car prices (50k - 5M SEK)
    if (price > 50000 && price < 5000000) {
      prices.push(price);
    }
  }

  if (prices.length > 0) {
    // Return the highest price (likely the car price, not down payment etc.)
    return Math.max(...prices);
  }

  return null;
}

/**
 * Extracts vehicle specifications from Wayke page
 */
function extractSpecs(): {
  fuelType: string | null;
  fuelTypeLabel: string | null;
  fuelConsumption: number | null;
  year: number | null;
  mileage: number | null;
  enginePower: number | null;
  co2: number | null;
  model: string | null;
  brand: string | null;
  effectiveInterestRate: number | null;
} {
  const specs = {
    fuelType: null as string | null,
    fuelTypeLabel: null as string | null,
    fuelConsumption: null as number | null,
    year: null as number | null,
    mileage: null as number | null,
    enginePower: null as number | null,
    co2: null as number | null,
    model: null as string | null,
    brand: null as string | null,
    effectiveInterestRate: null as number | null,
  };

  const pageText = document.body.innerText.toLowerCase();

  // Extract fuel type from spec tags/badges near the car info
  // Wayke shows fuel type in small tag elements near the title
  // Look for specific fuel type indicators in a targeted way

  // Strategy 1: Find fuel type from the tags/badges section (most reliable)
  const tagElements = document.querySelectorAll('[class*="tag"], [class*="badge"], [class*="chip"], [class*="label"], [class*="spec"]');
  let fuelFromTags: string | null = null;
  let fuelLabelFromTags: string | null = null;

  // Fuel type patterns: { pattern, normalizedType, labelTransform }
  const fuelPatterns = [
    // Combinations first (more specific)
    { pattern: /^e85\s*\+\s*el$/i, type: 'laddhybrid' },
    { pattern: /^el\s*\+\s*naturgas$/i, type: 'el' },
    { pattern: /^diesel\s*\+\s*el$/i, type: 'laddhybrid' },
    { pattern: /^bensin\s*\+\s*el$/i, type: 'laddhybrid' },
    { pattern: /^diesel\s*\+\s*naturgas$/i, type: 'diesel' },
    { pattern: /^bensin\s*\+\s*naturgas$/i, type: 'bensin' },
    // Single fuels
    { pattern: /^diesel$|^drivmedel diesel$/i, type: 'diesel' },
    { pattern: /^bensin$|^drivmedel bensin$/i, type: 'bensin' },
    { pattern: /^el$|^elbil$|^drivmedel el$/i, type: 'el' },
    { pattern: /^e85$|^etanol$/i, type: 'e85' },
    { pattern: /^hybrid$|^elhybrid$/i, type: 'hybrid' },
    { pattern: /^laddhybrid$|plug-in/i, type: 'laddhybrid' },
    { pattern: /^fordonsgas$|^biogas$|^naturgas$|^cng$/i, type: 'gas' },
    { pattern: /^hvo$|^hvo100$/i, type: 'hvo' },
  ];

  for (const tag of tagElements) {
    const text = tag.textContent?.trim() || '';
    const textLower = text.toLowerCase();

    for (const { pattern, type } of fuelPatterns) {
      if (pattern.test(textLower)) {
        fuelFromTags = type;
        // Capitalize first letter of each word for display
        fuelLabelFromTags = text.split(/\s*\+\s*/).map(word =>
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join('+');
        break;
      }
    }
    if (fuelFromTags) break;
  }

  if (fuelFromTags) {
    specs.fuelType = fuelFromTags;
    specs.fuelTypeLabel = fuelLabelFromTags;
    console.log('[Bilkostnadskalkyl] Wayke fuel from tags:', fuelFromTags, 'label:', fuelLabelFromTags);
  } else {
    // Strategy 2: Fallback to page text search (less reliable)
    // Check for specific fuel mentions near car details
    const singleFuelPatterns = [
      { pattern: /\belbil\b/i, type: 'el' },
      { pattern: /\bladdhybrid\b|plug-in\s*hybrid/i, type: 'laddhybrid' },
      { pattern: /\belhybrid\b|\bmild\s*hybrid\b/i, type: 'hybrid' },
      { pattern: /\bhvo\b|hvo100/i, type: 'hvo' },
      { pattern: /\bdiesel\b/i, type: 'diesel' },
      { pattern: /\bbensin\b/i, type: 'bensin' },
      { pattern: /\be85\b|\betanol\b/i, type: 'e85' },
      { pattern: /\bfordonsgas\b|\bbiogas\b|\bnaturgas\b|\bcng\b/i, type: 'gas' },
    ];

    for (const { pattern, type } of singleFuelPatterns) {
      if (pattern.test(pageText)) {
        specs.fuelType = type;
        console.log('[Bilkostnadskalkyl] Wayke fuel from page text:', type);
        break;
      }
    }
  }

  // Extract year (årsmodell or just 4-digit year in reasonable range)
  const yearMatch = pageText.match(/(?:årsmodell|modellår|år)[:\s]*(\d{4})/i) ||
    pageText.match(/\b(20[0-2]\d)\b/);
  if (yearMatch) {
    specs.year = parseInt(yearMatch[1], 10);
  }

  // Extract mileage - Wayke format: "16 527 mil"
  const mileageMatch = pageText.match(/(\d[\d\s]*\d)\s*mil\b/i);
  if (mileageMatch) {
    const mileageStr = mileageMatch[1].replace(/\s/g, '');
    const mileage = parseInt(mileageStr, 10);
    if (mileage > 0 && mileage < 500000) {
      specs.mileage = mileage;
    }
  }

  // Extract fuel consumption - Wayke format: "7,2 l/100km"
  const consumptionMatch = pageText.match(/([\d,\.]+)\s*(?:l|liter)\/100\s*km/i);
  if (consumptionMatch) {
    // Convert l/100km to l/mil (divide by 10)
    const per100km = parseFloat(consumptionMatch[1].replace(',', '.'));
    specs.fuelConsumption = per100km / 10;
  }

  // Also check for kWh/100km for electric cars
  const electricConsumptionMatch = pageText.match(/([\d,\.]+)\s*kwh\/100\s*km/i);
  if (electricConsumptionMatch) {
    const per100km = parseFloat(electricConsumptionMatch[1].replace(',', '.'));
    specs.fuelConsumption = per100km / 10; // kWh per mil
  }

  // Extract engine power (hk/hästkrafter)
  const powerMatch = pageText.match(/(\d{2,4})\s*(?:hk|hästkrafter)/i);
  if (powerMatch) {
    specs.enginePower = parseInt(powerMatch[1], 10);
  }

  // Extract CO2
  const co2Match = pageText.match(/co2[:\s]*(\d+)\s*g/i);
  if (co2Match) {
    specs.co2 = parseInt(co2Match[1], 10);
  }

  // Extract effective interest rate from financing section
  // Wayke may show this in various formats
  const originalText = document.body.innerText;

  // Try multiple patterns for effective interest rate
  const effectiveRatePatterns = [
    // "Effektiv ränta: 7.18%" or "Effektiv ränta 7,18 %"
    /effektiv\s*ränta[:\s]*([\d,\.]+)\s*%/i,
    // "Eff. ränta: 7.18%"
    /eff\.?\s*ränta[:\s]*([\d,\.]+)\s*%/i,
    // "Effektiv ränta" on one line, number on next
    /effektiv\s*ränta[\s\n]*([\d,\.]+)\s*%/i,
    // Pattern with non-breaking spaces
    /effektiv[\s\u00a0]*ränta[\s\u00a0:\-]*([\d,\.]+)[\s\u00a0]*%/i,
  ];

  for (const pattern of effectiveRatePatterns) {
    const match = originalText.match(pattern);
    if (match) {
      const rate = parseFloat(match[1].replace(',', '.'));
      // Sanity check: interest rates typically between 0.1% and 30%
      if (rate > 0.1 && rate < 30) {
        specs.effectiveInterestRate = rate;
        break;
      }
    }
  }

  // Fallback: Use Wayke's typical effective rate if not found
  if (specs.effectiveInterestRate === null) {
    specs.effectiveInterestRate = 7.44;
  }

  // Extract brand and model from URL or title
  // URL format: /objekt/{uuid}/volvo-xc60-t5-awd-...
  const path = window.location.pathname;
  const pathMatch = path.match(/\/objekt\/[^/]+\/([a-z]+)-([a-z0-9]+)/i);
  if (pathMatch) {
    specs.brand = pathMatch[1];
    specs.model = pathMatch[2];
  }

  // Also try h1 which often contains "Volvo XC60" etc.
  const h1 = document.querySelector('h1');
  if (h1?.textContent && !specs.brand) {
    const titleMatch = h1.textContent.match(/^([A-Za-zÅÄÖåäö]+)\s+([A-Za-z0-9]+)/);
    if (titleMatch) {
      specs.brand = titleMatch[1].toLowerCase();
      specs.model = titleMatch[2].toLowerCase();
    }
  }

  return specs;
}

/**
 * Finds a suitable anchor element for the overlay on Wayke
 * Prioritizes elements near the price section
 */
export function getWaykeOverlayAnchor(): HTMLElement | null {
  // Strategy 1: Find price elements
  const pricePattern = /^\d[\d\s]*\d?\s*kr$/i;
  const headings = document.querySelectorAll('h1, h2, h3');

  for (const el of headings) {
    if (el.textContent && pricePattern.test(el.textContent.trim())) {
      // Found price element, return its parent container
      let parent = el.parentElement;
      let attempts = 0;
      while (parent && attempts < 3) {
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

  // Strategy 2: Find by common Wayke class patterns
  const priceSelectors = [
    '[class*="price" i]',
    '[class*="Price"]',
    '[data-testid*="price"]',
  ];

  for (const selector of priceSelectors) {
    try {
      const element = document.querySelector(selector);
      if (element && element.textContent?.includes('kr')) {
        return (element.parentElement || element) as HTMLElement;
      }
    } catch {
      // Ignore invalid selector errors
    }
  }

  // Strategy 3: Find main content area
  const main = document.querySelector('main') ||
               document.querySelector('[role="main"]') ||
               document.querySelector('article');
  if (main) {
    const firstSection = main.querySelector('section') || main.firstElementChild;
    if (firstSection) {
      return firstSection as HTMLElement;
    }
    return main as HTMLElement;
  }

  // Strategy 4: Try h1 (car title)
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
