/**
 * Data extractor for Carla.se car listings
 */

import { VehicleData, VehicleType } from '../types';
import { ESTIMATED_CONSUMPTION } from '../core/constants';

/**
 * Checks if current page is a Carla.se car listing
 * @returns true if on a single car listing page
 */
export function isCarlaListingPage(): boolean {
  const path = window.location.pathname;
  // Match /bil/{brand}-{model}-{year}-{id} pattern (e.g. /bil/volvo-xc40-2023-d3afh9a9io6g009g6a50)
  return /^\/bil\/[a-z0-9]+-[a-z0-9]+/i.test(path);
}

/**
 * Extracts vehicle data from Carla.se listing page
 * @returns VehicleData or null if extraction fails
 */
export async function extractCarlaData(): Promise<VehicleData | null> {
  try {
    console.log('[Bilkostnadskalkyl] Starting data extraction...');

    // Wait for dynamic content to load
    await waitForContent();
    console.log('[Bilkostnadskalkyl] Content loaded, extracting data...');

    // Extract price
    const purchasePrice = extractPrice();
    if (!purchasePrice) {
      console.warn('[Bilkostnadskalkyl] Could not extract price');
      return null;
    }

    // Extract specs from page
    const specs = extractSpecs();
    console.log('[Bilkostnadskalkyl] Extracted specs:', specs);
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
      fuelConsumption,
      vehicleYear: specs.year,
      mileage: specs.mileage,
      enginePower: specs.enginePower,
      co2Emissions: specs.co2,
      vehicleType,
      vehicleName,
      isEstimated,
    };
  } catch (error) {
    console.error('[Bilkostnadskalkyl] Carla extraction error:', error);
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
 * Checks if an element or its parents have strikethrough styling
 * @param element - DOM element to check
 * @returns true if element has strikethrough
 */
function hasStrikethrough(element: Element): boolean {
  let current: Element | null = element;
  while (current && current !== document.body) {
    // Check for strikethrough tags
    const tagName = current.tagName.toLowerCase();
    if (tagName === 's' || tagName === 'strike' || tagName === 'del') {
      console.log('[Bilkostnadskalkyl] Strikethrough detected via tag:', tagName);
      return true;
    }
    // Check for strikethrough CSS (both old and new property names)
    const style = window.getComputedStyle(current);
    const textDec = style.textDecoration || '';
    const textDecLine = style.textDecorationLine || '';
    if (textDec.includes('line-through') || textDecLine.includes('line-through')) {
      console.log('[Bilkostnadskalkyl] Strikethrough detected via CSS:', textDec, textDecLine);
      return true;
    }
    current = current.parentElement;
  }
  return false;
}

/**
 * Checks if an element has muted/secondary styling (often used for old prices)
 * @param element - DOM element to check
 * @returns true if element appears to be secondary/muted
 */
function isSecondaryPrice(element: Element): boolean {
  const style = window.getComputedStyle(element);
  const color = style.color;

  // Parse RGB values
  const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);

    // Check if it's a grayish or muted color (not pure black)
    // Pure black would be rgb(0,0,0), secondary prices are often gray or colored
    const isGray = Math.abs(r - g) < 30 && Math.abs(g - b) < 30 && r > 80;
    const isGreenish = g > r && g > b; // Carla uses green for old prices

    if (isGray || isGreenish) {
      console.log('[Bilkostnadskalkyl] Secondary price color detected:', color);
      return true;
    }
  }

  return false;
}

/**
 * Extracts price from page, avoiding strikethrough (old) prices
 */
function extractPrice(): number | null {
  console.log('[Bilkostnadskalkyl] Extracting price...');

  // Strategy 1: Find price elements in DOM, excluding old/strikethrough prices
  const pricePattern = /^(\d{1,3}(?:[\s\u00a0]\d{3})+)\s*kr$/;
  const allElements = document.querySelectorAll('*');
  const foundPrices: { price: number; isOldPrice: boolean; element: Element }[] = [];

  for (const el of allElements) {
    // Only check leaf-ish nodes with direct text content
    if (el.childNodes.length <= 3 && el.textContent) {
      const text = el.textContent.trim();
      if (pricePattern.test(text)) {
        const priceStr = text.replace(/[^\d]/g, '');
        const price = parseInt(priceStr, 10);
        if (price > 100000 && price < 5000000) {
          const isStrikethrough = hasStrikethrough(el);
          const isSecondary = isSecondaryPrice(el);
          const isOldPrice = isStrikethrough || isSecondary;
          console.log('[Bilkostnadskalkyl] Found price:', price,
            '| strikethrough:', isStrikethrough,
            '| secondary:', isSecondary,
            '| isOldPrice:', isOldPrice);
          foundPrices.push({ price, isOldPrice, element: el });
        }
      }
    }
  }

  // Prefer non-old prices (current/active prices)
  const activePrices = foundPrices.filter(p => !p.isOldPrice);
  if (activePrices.length > 0) {
    console.log('[Bilkostnadskalkyl] Selected active price:', activePrices[0].price);
    return activePrices[0].price;
  }

  // If we found prices but all seem like old prices, pick the lowest one
  // (the new/sale price is usually lower than the old price)
  if (foundPrices.length > 1) {
    const sortedByPrice = [...foundPrices].sort((a, b) => a.price - b.price);
    console.log('[Bilkostnadskalkyl] All prices appear old, selecting lowest:', sortedByPrice[0].price);
    return sortedByPrice[0].price;
  }

  // Fallback: if only one price found, use it
  if (foundPrices.length > 0) {
    console.log('[Bilkostnadskalkyl] Using only available price:', foundPrices[0].price);
    return foundPrices[0].price;
  }

  // Strategy 2: Text-based fallback - find all prices and pick the lowest in reasonable range
  const allText = document.body.innerText;
  const matches = allText.match(/(\d{1,3}(?:[\s\u00a0]\d{3})+)\s*kr/g) || [];
  const textPrices: number[] = [];

  for (const match of matches) {
    const priceStr = match.replace(/[^\d]/g, '');
    const price = parseInt(priceStr, 10);
    if (price > 100000 && price < 5000000) {
      textPrices.push(price);
    }
  }

  if (textPrices.length > 0) {
    // Pick the lowest price (likely the sale/current price)
    const lowestPrice = Math.min(...textPrices);
    console.log('[Bilkostnadskalkyl] Text fallback - selected lowest price:', lowestPrice);
    return lowestPrice;
  }

  console.warn('[Bilkostnadskalkyl] Could not find price');
  return null;
}

/**
 * Extracts vehicle specifications from page
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

  const pageText = document.body.innerText.toLowerCase();

  // Extract fuel type - prioritize structured areas (breadcrumb, subtitle)
  // Carla shows fuel type in breadcrumb ("Elbil > Volvo > XC40") and subtitle ("Elbil · 8 984 mil · 2023")

  // First, try to find the subtitle pattern "FuelType · mileage · year"
  const subtitleMatch = pageText.match(/\b(elbil|laddhybrid|hybrid|diesel|bensin|el)\s*[·•]\s*\d/i);
  if (subtitleMatch) {
    const fuelText = subtitleMatch[1].toLowerCase();
    if (fuelText === 'elbil' || fuelText === 'el') {
      specs.fuelType = 'el';
    } else if (fuelText === 'laddhybrid') {
      specs.fuelType = 'laddhybrid';
    } else if (fuelText === 'hybrid') {
      specs.fuelType = 'hybrid';
    } else if (fuelText === 'diesel') {
      specs.fuelType = 'diesel';
    } else if (fuelText === 'bensin') {
      specs.fuelType = 'bensin';
    }
    console.log('[Bilkostnadskalkyl] Fuel type from subtitle:', specs.fuelType);
  }

  // Fallback to general pattern matching if not found in subtitle
  if (!specs.fuelType) {
    const fuelPatterns = [
      { pattern: /elbil/i, type: 'el' },
      { pattern: /laddhybrid/i, type: 'laddhybrid' },
      { pattern: /plug-in\s*hybrid/i, type: 'laddhybrid' },
      { pattern: /elhybrid|mild\s*hybrid/i, type: 'hybrid' },
      { pattern: /\bel\b|electric|100%?\s*el/i, type: 'el' },
      { pattern: /diesel/i, type: 'diesel' },
      { pattern: /bensin/i, type: 'bensin' },
      { pattern: /e85|etanol/i, type: 'e85' },
      { pattern: /biogas|gas/i, type: 'biogas' },
    ];

    for (const { pattern, type } of fuelPatterns) {
      if (pattern.test(pageText)) {
        specs.fuelType = type;
        console.log('[Bilkostnadskalkyl] Fuel type from fallback:', type);
        break;
      }
    }
  }

  // Extract year (årsmodell or modellår)
  const yearMatch = pageText.match(/(?:årsmodell|modellår|år)[:\s]*(\d{4})/i) ||
    pageText.match(/\b(20[0-2]\d)\b/);
  if (yearMatch) {
    specs.year = parseInt(yearMatch[1], 10);
  }

  // Extract mileage - Carla format: "7 230 mil" or "8 984 mil"
  // The dot/bullet separator in "Laddhybrid · 7 230 mil · 2021" is a special character
  const mileageMatch = pageText.match(/(\d[\d\s]*\d)\s*mil\b/i);
  if (mileageMatch) {
    const mileageStr = mileageMatch[1].replace(/\s/g, '');
    const mileage = parseInt(mileageStr, 10);
    console.log('[Bilkostnadskalkyl] Mileage match:', mileageMatch[1], '-> parsed:', mileage);
    if (mileage > 0 && mileage < 500000) {
      specs.mileage = mileage;
    }
  }

  // Extract fuel consumption
  const consumptionMatch = pageText.match(/(?:förbrukning|blandad)[:\s]*([\d,\.]+)\s*(?:l|liter|kwh)/i);
  if (consumptionMatch) {
    specs.fuelConsumption = parseFloat(consumptionMatch[1].replace(',', '.'));
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

  // Extract brand and model from URL or title
  // URL format: /bil/volvo-xc40-2023-d3afh9a9io6g009g6a50
  const path = window.location.pathname;
  const pathMatch = path.match(/\/bil\/([a-z]+)-([a-z0-9]+)-(\d{4})/i);
  if (pathMatch) {
    specs.brand = pathMatch[1];
    specs.model = pathMatch[2];
    specs.year = parseInt(pathMatch[3], 10);
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

  // Large SUVs and vans
  const largeModels = ['xc90', 'xc60', 'q7', 'q8', 'x5', 'x6', 'x7', 'gle', 'gls', 'cayenne', 'touareg', 'land cruiser'];
  if (largeModels.some(m => modelLower.includes(m))) {
    return 'large';
  }

  // Simple/small cars
  const simpleModels = ['up', 'mii', 'citigo', 'aygo', 'c1', '108', 'twingo', 'smart', 'i10', 'picanto', 'spark'];
  if (simpleModels.some(m => modelLower.includes(m))) {
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
 * Falls back to page title if parts are missing
 */
function buildVehicleName(
  brand: string | null,
  model: string | null,
  year: number | null
): string | null {
  // Try to build from extracted parts
  if (brand && model) {
    const capitalizedBrand = brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase();
    const capitalizedModel = model.toUpperCase();
    const yearStr = year ? ` ${year}` : '';
    return `${capitalizedBrand} ${capitalizedModel}${yearStr}`;
  }

  // Fallback: try to get from page title
  const title = document.title;
  if (title) {
    // Carla titles are often like "Volvo XC40 2023 - Carla" or similar
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
      return h1Text;
    }
  }

  return null;
}

/**
 * Finds a suitable anchor element for the overlay
 * Prioritizes elements near the price section
 */
export function getOverlayAnchor(): HTMLElement | null {
  console.log('[Bilkostnadskalkyl] Finding anchor element...');

  // Strategy 1: Find elements containing price text (e.g., "311 900 kr")
  const allElements = document.querySelectorAll('*');
  for (const el of allElements) {
    // Look for elements that directly contain a price pattern
    if (el.childNodes.length <= 3 && el.textContent) {
      const text = el.textContent.trim();
      // Match prices like "311 900 kr" or "323900 kr"
      if (/^\d[\d\s]*\d?\s*kr$/i.test(text) && text.length < 20) {
        // Find a good parent container (not too small, not too big)
        let parent = el.parentElement;
        let attempts = 0;
        while (parent && attempts < 5) {
          const rect = parent.getBoundingClientRect();
          // Look for a container that's reasonably sized
          if (rect.width > 200 && rect.height > 50 && rect.height < 500) {
            console.log('[Bilkostnadskalkyl] Found price container anchor');
            return parent as HTMLElement;
          }
          parent = parent.parentElement;
          attempts++;
        }
        // If no good parent found, use the element's parent
        if (el.parentElement) {
          console.log('[Bilkostnadskalkyl] Found price element anchor');
          return el.parentElement as HTMLElement;
        }
      }
    }
  }

  // Strategy 2: Find by CSS selectors related to price
  const priceSelectors = [
    '[class*="price" i]',
    '[class*="Price"]',
    '[data-testid*="price"]',
  ];

  for (const selector of priceSelectors) {
    try {
      const element = document.querySelector(selector);
      if (element && element.textContent?.includes('kr')) {
        console.log('[Bilkostnadskalkyl] Found price selector anchor:', selector);
        // Return the parent to give more room for the overlay
        return (element.parentElement || element) as HTMLElement;
      }
    } catch {
      // Ignore invalid selector errors
    }
  }

  // Strategy 3: Try to find the main title (h1) which contains the car name
  const h1 = document.querySelector('h1');
  if (h1) {
    console.log('[Bilkostnadskalkyl] Found h1 anchor');
    return h1 as HTMLElement;
  }

  // Strategy 4: Find sidebar or aside elements
  const sidebar = document.querySelector('aside') ||
                  document.querySelector('[class*="sidebar" i]') ||
                  document.querySelector('[class*="right" i][class*="col" i]');
  if (sidebar) {
    console.log('[Bilkostnadskalkyl] Found sidebar anchor');
    return sidebar as HTMLElement;
  }

  // Strategy 5: Find main content area
  const main = document.querySelector('main') ||
               document.querySelector('[role="main"]') ||
               document.querySelector('article');
  if (main) {
    // Try to find first significant section within main
    const firstSection = main.querySelector('section') || main.firstElementChild;
    if (firstSection) {
      console.log('[Bilkostnadskalkyl] Found main section anchor');
      return firstSection as HTMLElement;
    }
    console.log('[Bilkostnadskalkyl] Found main anchor');
    return main as HTMLElement;
  }

  // Fallback: Create a fixed position container at top-right
  console.log('[Bilkostnadskalkyl] Using fallback: creating fixed container');
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
