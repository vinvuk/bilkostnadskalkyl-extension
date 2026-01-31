/**
 * Data extractor for Blocket.se car listings
 */

import { VehicleData } from '../types';
import { ESTIMATED_CONSUMPTION } from '../core/constants';
import { inferVehicleType, buildVehicleName } from './shared';

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
 * Checks if this is a leasing listing (not a purchase listing)
 * @returns true if this appears to be a leasing ad
 */
function isLeasingListing(): boolean {
  const pageText = document.body.innerText.toLowerCase();

  // Check for leasing indicators
  const leasingIndicators = [
    /privatleasing/i,
    /företagsleasing/i,
    /leasing\s*från/i,
    /leasingkostnad/i,
    /kr\/mån\s*(?:ink|ex)/i,  // "kr/mån ink" or "kr/mån ex"
    /månadskostnad\s*(?:ink|ex)/i,
  ];

  for (const pattern of leasingIndicators) {
    if (pattern.test(pageText)) {
      return true;
    }
  }

  // Check advertising data for leasing category
  const adData = extractAdvertisingData();
  if (adData?.category?.[0]?.toLowerCase().includes('leasing')) {
    return true;
  }

  return false;
}

/**
 * Extracts vehicle data from Blocket.se listing page
 * @returns VehicleData or null if extraction fails
 */
export async function extractBlocketData(): Promise<VehicleData | null> {
  try {
    // Wait for dynamic content to load
    await waitForContent();

    // Check if this is a leasing listing
    if (isLeasingListing()) {
      console.log('[Bilkostnadskalkyl] Skipping leasing listing - calculator only supports purchase');
      return null;
    }

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

    // Extract main image URL
    const imageUrl = extractMainImageUrl();

    // Extract registration number
    const registrationNumber = extractRegistrationNumber();

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
      registrationNumber,
      effectiveInterestRate: null, // Blocket doesn't show financing details
      annualTax: specs.annualTax,
      isEstimated,
    };
  } catch (error) {
    console.error('[Bilkostnadskalkyl] Blocket extraction error:', error);
    return null;
  }
}

/**
 * Extracts registration number from Blocket page
 * @returns Registration number or null if not found
 */
function extractRegistrationNumber(): string | null {
  // Swedish registration number patterns:
  // Old format: ABC 123 or ABC123
  // New format: ABC 12A or ABC12A
  const regNumPattern = /^[A-Z]{3}\s?\d{2}[A-Z0-9]$/i;

  // Strategy 1: Check advertising data JSON
  const adData = extractAdvertisingData();
  if (adData?.regNumber?.[0]) {
    const regNum = adData.regNumber[0];
    if (regNumPattern.test(regNum)) {
      console.log('[Bilkostnadskalkyl] Found reg number from Blocket JSON:', regNum);
      return regNum.toUpperCase().replace(/\s/g, '');
    }
  }

  // Strategy 2: Look for "Registreringsnummer" or "Reg.nr" in page text
  const pageText = document.body.innerText;
  const patterns = [
    /registreringsnummer[:\s]*([A-Z]{3}\s?\d{2}[A-Z0-9])/i,
    /reg\.?\s*nr[:\s]*([A-Z]{3}\s?\d{2}[A-Z0-9])/i,
    /regnr[:\s]*([A-Z]{3}\s?\d{2}[A-Z0-9])/i,
  ];

  for (const pattern of patterns) {
    const match = pageText.match(pattern);
    if (match) {
      console.log('[Bilkostnadskalkyl] Found reg number from Blocket text:', match[1]);
      return match[1].toUpperCase().replace(/\s/g, '');
    }
  }

  // Strategy 3: Look in script tags for JSON data
  const scripts = document.querySelectorAll('script');
  for (const script of scripts) {
    const content = script.textContent || '';
    const jsonMatch = content.match(/"(?:registreringsnummer|regNr|registrationNumber|regNumber)"[:\s]*"([A-Z]{3}\s?\d{2}[A-Z0-9])"/i);
    if (jsonMatch) {
      console.log('[Bilkostnadskalkyl] Found reg number from Blocket script:', jsonMatch[1]);
      return jsonMatch[1].toUpperCase().replace(/\s/g, '');
    }
  }

  return null;
}

/**
 * Extracts the main image URL from Blocket listing
 * @returns Image URL or null if not found
 */
function extractMainImageUrl(): string | null {
  // Try to find main image in gallery
  // Blocket typically uses picture elements or img tags in the gallery
  const selectors = [
    // Main gallery image
    '[data-testid="image-gallery"] img',
    '[data-testid="gallery"] img',
    '.image-gallery img',
    // Fallback to any large car image
    'img[src*="images.blocket.se"]',
    'img[src*="bytbil-prod"]',
    // Picture source
    'picture source[srcset*="images.blocket.se"]',
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      if (element.tagName === 'IMG') {
        const src = (element as HTMLImageElement).src;
        if (src && src.startsWith('http')) {
          return src;
        }
      } else if (element.tagName === 'SOURCE') {
        const srcset = (element as HTMLSourceElement).srcset;
        if (srcset) {
          // Extract first URL from srcset
          const firstUrl = srcset.split(',')[0].split(' ')[0].trim();
          if (firstUrl.startsWith('http')) {
            return firstUrl;
          }
        }
      }
    }
  }

  // Try to find from og:image meta tag
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
 * Checks if the page has the structured advertising data we need
 * @returns true if advertising-initial-state script exists with valid data
 */
function hasAdvertisingData(): boolean {
  const scriptEl = document.getElementById('advertising-initial-state');
  if (!scriptEl?.textContent) {
    return false;
  }
  try {
    const data = JSON.parse(scriptEl.textContent);
    return Array.isArray(data?.config?.adServer?.gam?.targeting);
  } catch {
    return false;
  }
}

/**
 * Waits for dynamic content to load on Blocket
 * Prioritizes waiting for structured JSON data, with text fallback
 */
async function waitForContent(): Promise<void> {
  return new Promise((resolve) => {
    // Check if structured data is already available (preferred)
    if (hasAdvertisingData()) {
      // Small delay to ensure DOM is fully rendered
      setTimeout(resolve, 100);
      return;
    }

    // Check if price text is visible (fallback indicator)
    if (document.body.innerText.includes(' kr')) {
      // Small delay to allow JSON to load
      setTimeout(resolve, 300);
      return;
    }

    let resolved = false;
    let innerTimeout: ReturnType<typeof setTimeout> | null = null;
    let mainTimeout: ReturnType<typeof setTimeout> | null = null;

    const done = () => {
      if (!resolved) {
        resolved = true;
        observer.disconnect();
        // Clear any pending timeouts to prevent memory leaks
        if (innerTimeout) clearTimeout(innerTimeout);
        if (mainTimeout) clearTimeout(mainTimeout);
        // Small delay after detection to ensure full load
        setTimeout(resolve, 200);
      }
    };

    // Wait for content with MutationObserver
    const observer = new MutationObserver(() => {
      // Prefer structured data
      if (hasAdvertisingData()) {
        done();
        return;
      }
      // Fallback to text detection
      if (document.body.innerText.includes(' kr')) {
        // Give JSON a bit more time to load after text appears
        if (!innerTimeout) {
          innerTimeout = setTimeout(() => {
            if (!resolved) {
              done();
            }
          }, 500);
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Timeout after 10 seconds (increased from 5)
    mainTimeout = setTimeout(() => {
      if (!resolved) {
        console.warn('[Bilkostnadskalkyl] Blocket content load timeout');
        done();
      }
    }, 10000);
  });
}

/**
 * Extracts structured data from Blocket's advertising-initial-state JSON
 * This contains reliable vehicle data directly from Blocket's system
 * @returns Parsed advertising data or null if not found
 */
function extractAdvertisingData(): Record<string, string[]> | null {
  try {
    const scriptEl = document.getElementById('advertising-initial-state');
    if (!scriptEl?.textContent) {
      return null;
    }

    const data = JSON.parse(scriptEl.textContent);
    const targeting = data?.config?.adServer?.gam?.targeting;

    if (!Array.isArray(targeting)) {
      return null;
    }

    // Convert targeting array to key-value object
    const result: Record<string, string[]> = {};
    for (const item of targeting) {
      if (item.key && Array.isArray(item.value)) {
        result[item.key] = item.value;
      }
    }

    return result;
  } catch (error) {
    console.warn('[Bilkostnadskalkyl] Failed to parse advertising data:', error);
    return null;
  }
}

/**
 * Extracts price from Blocket page
 * Strategy 1: Use structured JSON data from advertising-initial-state
 * Strategy 2: Fallback to text pattern matching
 */
function extractPrice(): number | null {
  // Strategy 1: Use structured data (most reliable)
  const adData = extractAdvertisingData();
  console.log('[Bilkostnadskalkyl] Blocket adData:', adData);

  if (adData?.price?.[0]) {
    const price = parseInt(adData.price[0], 10);
    console.log('[Bilkostnadskalkyl] Blocket price from JSON:', price);
    if (price >= 10000 && price <= 10000000) {
      return price;
    }
  }

  // Strategy 2: Fallback to text pattern matching
  const pageText = document.body.innerText;
  const matches: number[] = [];

  // Pattern 1: Price with spaces (e.g., "199 000 kr" or "1 234 567 kr")
  const spacePattern = /(\d{1,3}(?:[\s\u00a0]\d{3})+)\s*kr/g;
  let match;
  while ((match = spacePattern.exec(pageText)) !== null) {
    const priceStr = match[1].replace(/[\s\u00a0]/g, '');
    const price = parseInt(priceStr, 10);
    if (price >= 10000 && price <= 10000000) {
      matches.push(price);
    }
  }

  // Pattern 2: Price without spaces (e.g., "199000 kr" or "199000kr")
  const noSpacePattern = /(\d{5,7})\s*kr/g;
  while ((match = noSpacePattern.exec(pageText)) !== null) {
    const price = parseInt(match[1], 10);
    if (price >= 10000 && price <= 10000000) {
      matches.push(price);
    }
  }

  // Pattern 3: "Pris X kr" or "Pris: X kr" format
  const labeledPattern = /Pris[:\s]*(\d[\d\s\u00a0]*)\s*kr/gi;
  while ((match = labeledPattern.exec(pageText)) !== null) {
    const priceStr = match[1].replace(/[\s\u00a0]/g, '');
    const price = parseInt(priceStr, 10);
    if (price >= 10000 && price <= 10000000) {
      matches.push(price);
    }
  }

  console.log('[Bilkostnadskalkyl] Blocket price matches from text:', matches);

  if (matches.length > 0) {
    // Return the highest price (likely the purchase price, not down payment)
    return Math.max(...matches);
  }

  return null;
}

/**
 * Maps Blocket's numeric fuel codes to fuel type strings
 * Based on observed values in advertising-initial-state
 */
function mapBlocketFuelCode(code: string): string | null {
  const fuelMap: Record<string, string> = {
    '1': 'bensin',
    '2': 'diesel',
    '3': 'el',
    '4': 'hybrid',
    '5': 'laddhybrid',
    '6': 'e85',
    '7': 'gas',      // Biogas
    '8': 'gas',      // Fordonsgas/CNG
    '9': 'gas',      // Alternative gas code
    '10': 'laddhybrid',  // Bensin/El hybrid variant (plug-in)
    '11': 'hvo',     // HVO (renewable diesel)
  };
  return fuelMap[code] || null;
}

/**
 * Extracts vehicle specifications from Blocket page
 * Uses structured JSON data when available, with text fallback
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
  annualTax: number | null;
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
    annualTax: null as number | null,
  };

  // Strategy 1: Use structured JSON data (most reliable)
  const adData = extractAdvertisingData();
  if (adData) {
    // Extract year
    if (adData.year?.[0]) {
      const year = parseInt(adData.year[0], 10);
      if (year >= 1990 && year <= 2030) {
        specs.year = year;
      }
    }

    // Extract mileage
    if (adData.mileage?.[0]) {
      const mileage = parseInt(adData.mileage[0], 10);
      if (mileage >= 0 && mileage < 1000000) {
        specs.mileage = mileage;
      }
    }

    // Extract fuel type from code
    if (adData.fuel?.[0]) {
      const fuelCode = adData.fuel[0];
      specs.fuelType = mapBlocketFuelCode(fuelCode);
      console.log('[Bilkostnadskalkyl] Blocket fuel code:', fuelCode, '-> mapped to:', specs.fuelType);
    }

    // Extract brand and model
    if (adData.make_text?.[0]) {
      specs.brand = adData.make_text[0];
    }
    if (adData.model_text?.[0]) {
      specs.model = adData.model_text[0];
    }
  }

  // Strategy 2: Text-based fallback for missing values
  const pageText = document.body.innerText;
  const pageTextLower = pageText.toLowerCase();

  // Extract year if not found in JSON
  if (!specs.year) {
    const yearMatch = pageText.match(/Modellår\s*(\d{4})/i) ||
      pageText.match(/(\d{4})\s*års\s*modell/i);
    if (yearMatch) {
      specs.year = parseInt(yearMatch[1], 10);
    }
  }

  // Extract mileage if not found in JSON
  if (specs.mileage === null) {
    const mileageMatch = pageText.match(/Miltal\s*[\n\r]?\s*(\d[\d\s]*)\s*mil/i) ||
      pageText.match(/(\d[\d\s]*)\s*mil(?!\w)/i);
    if (mileageMatch) {
      const mileageStr = mileageMatch[1].replace(/\s/g, '');
      const mileage = parseInt(mileageStr, 10);
      if (mileage >= 0 && mileage < 100000) {
        specs.mileage = mileage;
      }
    }
  }

  // Extract fuel type if not found in JSON
  const fuelPatterns = [
    { pattern: /\belbil\b|100%?\s*el\b|electric/i, type: 'el' },
    { pattern: /\bladdhybrid\b|plug-?in\s*hybrid|phev/i, type: 'laddhybrid' },
    { pattern: /\bhybrid\b|elhybrid|mild\s*hybrid/i, type: 'hybrid' },
    { pattern: /\bhvo\b|hvo100/i, type: 'hvo' },
    { pattern: /\bdiesel\b/i, type: 'diesel' },
    { pattern: /\bbensin\b|petrol/i, type: 'bensin' },
    { pattern: /\be85\b|\betanol\b/i, type: 'e85' },
    { pattern: /\bfordonsgas\b|\bbiogas\b|\bcng\b|\bgas\b/i, type: 'gas' },
  ];

  // Always try to get the original label from Drivmedel field (even if we have fuel type from JSON)
  const drivmedelMatch = pageText.match(/Drivmedel\s*[\n\r]?\s*([^\n\r]+)/i);
  if (drivmedelMatch) {
    const drivmedelOriginal = drivmedelMatch[1].trim();
    const drivmedel = drivmedelOriginal.toLowerCase();
    console.log('[Bilkostnadskalkyl] Drivmedel field:', drivmedel);

    // Store the original label
    specs.fuelTypeLabel = drivmedelOriginal.charAt(0).toUpperCase() + drivmedelOriginal.slice(1);

    // If we don't have fuel type yet, try to detect it from the text
    if (!specs.fuelType) {
      for (const { pattern, type } of fuelPatterns) {
        if (pattern.test(drivmedel)) {
          specs.fuelType = type;
          console.log('[Bilkostnadskalkyl] Matched fuel type:', type, 'label:', specs.fuelTypeLabel);
          break;
        }
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

  // Extract annual vehicle tax (Fordonsskatt)
  // Patterns: "Fordonsskatt 360 kr" or "Skatt: 1 234 kr/år" or "Fordonsskatt\n360 kr"
  const taxPatterns = [
    /fordonsskatt\s*[\n\r]?\s*([\d\s]+)\s*kr/i,
    /fordonsskatt[:\s]*([\d\s]+)\s*kr/i,
    /skatt[:\s]*([\d\s]+)\s*kr\s*(?:\/\s*år|per\s*år)?/i,
    /årlig\s*skatt[:\s]*([\d\s]+)\s*kr/i,
  ];
  for (const pattern of taxPatterns) {
    const taxMatch = pageText.match(pattern);
    if (taxMatch) {
      const taxStr = taxMatch[1].replace(/\s/g, '');
      const tax = parseInt(taxStr, 10);
      // Sanity check: annual tax should be between 0 and 50000 kr
      if (tax >= 0 && tax <= 50000) {
        specs.annualTax = tax;
        console.log('[Bilkostnadskalkyl] Found vehicle tax:', tax, 'kr/year');
        break;
      }
    }
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
