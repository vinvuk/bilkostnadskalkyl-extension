/**
 * Data extractor for Carla.se car listings
 */

import { VehicleData } from '../types';
import { ESTIMATED_CONSUMPTION } from '../core/constants';
import { inferVehicleType, buildVehicleName } from './shared';

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
    // Wait for dynamic content to load
    await waitForContent();

    // Extract price
    const purchasePrice = extractPrice();
    if (!purchasePrice) {
      console.warn('[Bilkostnadskalkyl] Could not extract price');
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

    // Extract main image URL
    const imageUrl = extractMainImageUrl();

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
      imageUrl,
      registrationNumber: specs.registrationNumber,
      effectiveInterestRate: specs.effectiveInterestRate,
      annualTax: null, // TODO: Extract from Carla if available
      isEstimated,
    };
  } catch (error) {
    console.error('[Bilkostnadskalkyl] Carla extraction error:', error);
    return null;
  }
}

/**
 * Extracts the main image URL from Carla listing
 * @returns Image URL or null if not found
 */
function extractMainImageUrl(): string | null {
  // Carla typically uses img tags in their gallery
  const selectors = [
    // Main gallery image
    '[data-testid="gallery-image"] img',
    '.gallery img',
    '.carousel img',
    // Main vehicle image
    'img[alt*="bil"]',
    'img[src*="carla.se"]',
    'img[src*="cloudinary"]',
  ];

  for (const selector of selectors) {
    const img = document.querySelector(selector) as HTMLImageElement;
    if (img?.src && img.src.startsWith('http')) {
      return img.src;
    }
  }

  // Try og:image meta tag
  const ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage) {
    const content = ogImage.getAttribute('content');
    if (content && content.startsWith('http')) {
      return content;
    }
  }

  return null;
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
      return true;
    }
    // Check for strikethrough CSS (both old and new property names)
    const style = window.getComputedStyle(current);
    const textDec = style.textDecoration || '';
    const textDecLine = style.textDecorationLine || '';
    if (textDec.includes('line-through') || textDecLine.includes('line-through')) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}

/**
 * Checks if an element is inside a financing/loan calculator context
 * These prices (residual value, down payment, etc.) should be excluded
 * @param element - DOM element to check
 * @returns true if element is in a financing context
 */
function isFinancingContext(element: Element): boolean {
  // Check for financing-related keywords in nearby text
  const financingKeywords = [
    'restvärde', 'kontantinsats', 'lånetid', 'billån', 'finansiering',
    'månadskostnad', 'att betala per månad', 'privatleasing', 'leasing',
    'ränta', 'amortering', 'lånekalkyl'
  ];

  // Check parent elements up to 5 levels for financing context
  let current: Element | null = element;
  let levels = 0;
  while (current && levels < 5) {
    const text = current.textContent?.toLowerCase() || '';

    // If parent contains multiple financing keywords, it's likely a loan calculator
    const matchCount = financingKeywords.filter(kw => text.includes(kw)).length;
    if (matchCount >= 2) {
      return true;
    }

    // Check for modal/dialog containers
    const tagName = current.tagName.toLowerCase();
    const role = current.getAttribute('role');
    const className = current.className?.toLowerCase() || '';

    if (role === 'dialog' || role === 'modal' ||
        className.includes('modal') || className.includes('dialog') ||
        className.includes('popup') || className.includes('overlay')) {
      return true;
    }

    current = current.parentElement;
    levels++;
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
      return true;
    }
  }

  return false;
}

/**
 * Gets the font size of an element in pixels
 * @param element - DOM element to check
 * @returns font size in pixels
 */
function getFontSize(element: Element): number {
  const style = window.getComputedStyle(element);
  return parseFloat(style.fontSize) || 16;
}

/**
 * Extracts price from page, avoiding strikethrough (old) prices
 * Prioritizes prices displayed in larger fonts (main price is visually prominent)
 */
function extractPrice(): number | null {
  // Strategy 1: Find price elements in DOM, tracking font size for prominence
  const pricePattern = /^(\d{1,3}(?:[\s\u00a0]\d{3})+)\s*kr$/;
  // Target common text-containing elements instead of all elements for performance
  const textElements = document.querySelectorAll('span, p, div, h1, h2, h3, h4, strong, b, em, label, [class*="price"], [class*="Price"], [data-price]');
  const foundPrices: { price: number; isOldPrice: boolean; element: Element; fontSize: number }[] = [];

  for (const el of textElements) {
    // Only check leaf-ish nodes with direct text content
    if (el.childNodes.length <= 3 && el.textContent) {
      const text = el.textContent.trim();
      if (pricePattern.test(text)) {
        const priceStr = text.replace(/[^\d]/g, '');
        const price = parseInt(priceStr, 10);
        if (price > 100000 && price < 5000000) {
          // Skip prices in financing/loan calculator contexts
          const isFinancing = isFinancingContext(el);
          if (isFinancing) {
            continue;
          }

          const isStrikethrough = hasStrikethrough(el);
          const isSecondary = isSecondaryPrice(el);
          const isOldPrice = isStrikethrough || isSecondary;
          const fontSize = getFontSize(el);
          foundPrices.push({ price, isOldPrice, element: el, fontSize });
        }
      }
    }
  }

  // Check if there are any old/strikethrough prices (indicates a sale)
  const oldPrices = foundPrices.filter(p => p.isOldPrice);
  const activePrices = foundPrices.filter(p => !p.isOldPrice);
  const hasSale = oldPrices.length > 0;

  if (activePrices.length > 0) {
    // Find the largest font size among active prices (main price is usually biggest)
    const maxFontSize = Math.max(...activePrices.map(p => p.fontSize));
    // Consider prices "prominent" if within 8px of the largest font (increased tolerance for consistency)
    const prominentPrices = activePrices.filter(p => p.fontSize >= maxFontSize - 8);

    // Sort by price ascending - we want the LOWEST price (sale price or actual price)
    const sortedByPriceAsc = [...prominentPrices].sort((a, b) => a.price - b.price);

    if (hasSale && sortedByPriceAsc.length > 0) {
      // SALE SCENARIO: Select the lowest prominent price that's below the old price
      const oldPriceValue = Math.max(...oldPrices.map(p => p.price));
      const priceBelowOld = sortedByPriceAsc.filter(p => p.price < oldPriceValue);

      if (priceBelowOld.length > 0) {
        // Select the lowest price below the old price (the actual sale price)
        return priceBelowOld[0].price;
      }

      // Fallback: pick lowest prominent
      return sortedByPriceAsc[0].price;
    } else if (sortedByPriceAsc.length > 0) {
      // NO SALE SCENARIO: Select the lowest prominent price (actual purchase price)
      return sortedByPriceAsc[0].price;
    } else {
      // Fallback to lowest active price
      const sortedActive = [...activePrices].sort((a, b) => a.price - b.price);
      return sortedActive[0].price;
    }
  }

  // If we found prices but all seem like old prices, pick the one with largest font
  if (foundPrices.length > 1) {
    const sortedByFontSize = [...foundPrices].sort((a, b) => b.fontSize - a.fontSize);
    return sortedByFontSize[0].price;
  }

  // Fallback: if only one price found, use it
  if (foundPrices.length > 0) {
    return foundPrices[0].price;
  }

  // Strategy 2: Text-based fallback - find the highest price in car range
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
    // Pick the highest price (car price is usually the largest)
    const highestPrice = Math.max(...textPrices);
    return highestPrice;
  }

  console.warn('[Bilkostnadskalkyl] Could not find price');
  return null;
}

/**
 * Extracts vehicle specifications from page
 */
/**
 * Extracts registration number from Carla page
 * Carla shows this in the "Specifikationer" modal or in embedded JSON
 * @returns Registration number or null if not found
 */
function extractRegistrationNumber(): string | null {
  // Swedish registration number patterns:
  // Old format: ABC 123 or ABC123
  // New format: ABC 12A or ABC12A
  const regNumPattern = /^[A-Z]{3}\s?\d{2}[A-Z0-9]$/i;

  // Strategy 1: Look for "Registreringsnummer" label in the DOM
  // Target common label elements for performance
  const labelElements = document.querySelectorAll('span, label, dt, th, div, p, strong, b');
  for (const el of labelElements) {
    const text = el.textContent?.trim() || '';
    if (text.toLowerCase() === 'registreringsnummer') {
      // Found the label, look for the value in next sibling or parent's next child
      const parent = el.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children);
        const labelIndex = siblings.indexOf(el as Element);
        if (labelIndex >= 0 && labelIndex < siblings.length - 1) {
          const valueEl = siblings[labelIndex + 1];
          const value = valueEl?.textContent?.trim();
          if (value && regNumPattern.test(value)) {
            console.log('[Bilkostnadskalkyl] Found reg number from label sibling:', value);
            return value.toUpperCase();
          }
        }
        // Also check parent's text content for the pattern
        const parentText = parent.textContent || '';
        const match = parentText.match(/registreringsnummer\s*[:\s]*([A-Z]{3}\s?\d{2}[A-Z0-9])/i);
        if (match) {
          console.log('[Bilkostnadskalkyl] Found reg number from parent text:', match[1]);
          return match[1].toUpperCase().replace(/\s/g, '');
        }
      }
    }
  }

  // Strategy 2: Look in script tags for JSON data
  const scripts = document.querySelectorAll('script');
  for (const script of scripts) {
    const content = script.textContent || '';
    // Look for registration number in JSON-like structures
    const jsonMatch = content.match(/"(?:registreringsnummer|regNr|registrationNumber|regNumber)"[:\s]*"([A-Z]{3}\s?\d{2}[A-Z0-9])"/i);
    if (jsonMatch) {
      console.log('[Bilkostnadskalkyl] Found reg number from JSON:', jsonMatch[1]);
      return jsonMatch[1].toUpperCase().replace(/\s/g, '');
    }
  }

  // Strategy 3: Search page text for patterns near "Registreringsnummer"
  const pageText = document.body.innerText;
  const textMatch = pageText.match(/registreringsnummer[:\s]*([A-Z]{3}\s?\d{2}[A-Z0-9])/i);
  if (textMatch) {
    console.log('[Bilkostnadskalkyl] Found reg number from page text:', textMatch[1]);
    return textMatch[1].toUpperCase().replace(/\s/g, '');
  }

  console.log('[Bilkostnadskalkyl] Registration number not found');
  return null;
}

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
  registrationNumber: string | null;
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
    registrationNumber: null as string | null,
  };

  // Extract registration number
  specs.registrationNumber = extractRegistrationNumber();

  const pageTextOriginal = document.body.innerText;
  const pageText = pageTextOriginal.toLowerCase();

  // Extract fuel type - prioritize structured areas (breadcrumb, subtitle)
  // Carla shows fuel type in breadcrumb ("Elbil > Volvo > XC40") and subtitle ("Elbil · 8 984 mil · 2023")

  // First, try to find the subtitle pattern "FuelType · mileage · year" (search original text for proper case)
  const subtitleMatch = pageTextOriginal.match(/\b(Elbil|Laddhybrid|Hybrid|Diesel|Bensin|El)\s*[·•]\s*\d/i);
  if (subtitleMatch) {
    const fuelTextOriginal = subtitleMatch[1];
    const fuelText = fuelTextOriginal.toLowerCase();
    if (fuelText === 'elbil' || fuelText === 'el') {
      specs.fuelType = 'el';
      specs.fuelTypeLabel = fuelTextOriginal;
    } else if (fuelText === 'laddhybrid') {
      specs.fuelType = 'laddhybrid';
      specs.fuelTypeLabel = fuelTextOriginal;
    } else if (fuelText === 'hybrid') {
      specs.fuelType = 'hybrid';
      specs.fuelTypeLabel = fuelTextOriginal;
    } else if (fuelText === 'diesel') {
      specs.fuelType = 'diesel';
      specs.fuelTypeLabel = fuelTextOriginal;
    } else if (fuelText === 'bensin') {
      specs.fuelType = 'bensin';
      specs.fuelTypeLabel = fuelTextOriginal;
    }
  }

  // Fallback to general pattern matching if not found in subtitle
  if (!specs.fuelType) {
    const fuelPatterns = [
      { pattern: /elbil/i, type: 'el', label: 'Elbil' },
      { pattern: /laddhybrid/i, type: 'laddhybrid', label: 'Laddhybrid' },
      { pattern: /plug-in\s*hybrid/i, type: 'laddhybrid', label: 'Laddhybrid' },
      { pattern: /elhybrid|mild\s*hybrid/i, type: 'hybrid', label: 'Hybrid' },
      { pattern: /\bel\b|electric|100%?\s*el/i, type: 'el', label: 'El' },
      { pattern: /diesel/i, type: 'diesel', label: 'Diesel' },
      { pattern: /bensin/i, type: 'bensin', label: 'Bensin' },
      { pattern: /e85|etanol/i, type: 'e85', label: 'E85' },
      { pattern: /biogas|gas/i, type: 'biogas', label: 'Biogas' },
    ];

    for (const { pattern, type, label } of fuelPatterns) {
      if (pattern.test(pageText)) {
        specs.fuelType = type;
        specs.fuelTypeLabel = label;
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

  // Extract effective interest rate (effektiv ränta) for loan calculations
  // Carla may show this in various formats in the financing section
  // Use original text (not lowercased) for matching to preserve special characters
  const originalText = document.body.innerText;

  // Try multiple patterns for effective interest rate
  // IMPORTANT: Only match "effektiv ränta" explicitly - avoid matching "nominell ränta"
  const effectiveRatePatterns = [
    // "Effektiv ränta: 5.55%" or "Effektiv ränta 5,55 %"
    /effektiv\s*ränta[:\s]*([\d,\.]+)\s*%/i,
    // "Eff. ränta: 5.55%"
    /eff\.\s*ränta[:\s]*([\d,\.]+)\s*%/i,
    // "Effektiv ränta" on one line, number on next (with newline)
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

  // Fallback: Use Carla's typical effective rate if not found
  // (Loan details are often in an expandable section not visible at page load)
  if (specs.effectiveInterestRate === null) {
    specs.effectiveInterestRate = 5.71;
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
 * Finds a suitable anchor element for the overlay
 * Prioritizes elements near the price section
 */
export function getOverlayAnchor(): HTMLElement | null {
  // Strategy 1: Find elements containing price text (e.g., "311 900 kr")
  // Target common price-containing elements for performance
  const priceElements = document.querySelectorAll('span, p, div, h1, h2, h3, h4, strong, [class*="price"], [class*="Price"]');
  for (const el of priceElements) {
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
            return parent as HTMLElement;
          }
          parent = parent.parentElement;
          attempts++;
        }
        // If no good parent found, use the element's parent
        if (el.parentElement) {
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
    return h1 as HTMLElement;
  }

  // Strategy 4: Find sidebar or aside elements
  const sidebar = document.querySelector('aside') ||
                  document.querySelector('[class*="sidebar" i]') ||
                  document.querySelector('[class*="right" i][class*="col" i]');
  if (sidebar) {
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
      return firstSection as HTMLElement;
    }
    return main as HTMLElement;
  }

  // Fallback: Create a fixed position container at top-right
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
