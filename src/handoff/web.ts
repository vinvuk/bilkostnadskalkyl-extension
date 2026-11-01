import type { VehicleData } from '../types';
declare const __WEB_CALCULATOR_URL__: string;
export function createWebHandoff(vehicle: VehicleData, listingUrl: string, id: string, destination = 'https://dinbilkostnad.se/bilkostnad/billigaste-bilen') {
  const source = new URL(listingUrl);
  const site = source.hostname.replace(/^www\./, '').replace(/\.se$/, '');
  if (!['blocket','wayke','carla'].includes(site) || ![`${site}.se`,`www.${site}.se`].includes(source.hostname) || source.protocol !== 'https:') throw new Error('Ogiltig annonskälla');
  if (!Number.isFinite(vehicle.purchasePrice) || vehicle.purchasePrice < 1000 || vehicle.purchasePrice > 2000000) throw new Error('Kontrollera bilens pris');
  source.search = ''; source.hash = '';
  const supportedFuel = ['bensin','diesel','el','hybrid'].includes(vehicle.fuelType);
  const data = {
    v: 1, id, site, url: source.href, name: (vehicle.vehicleName || 'Bil från annons').slice(0,160),
    price: vehicle.purchasePrice, year: vehicle.vehicleYear, fuel: supportedFuel ? vehicle.fuelType : null,
    consumption: vehicle.fuelConsumption, consumptionEstimated: vehicle.isEstimated.fuelConsumption,
    unsupportedFuel: !supportedFuel,
  };
  const url = new URL(destination);
  url.hash = 'bkk=' + encodeURIComponent(JSON.stringify(data));
  return url.href;
}
export function openWebCalculator(vehicle: VehicleData, listingUrl: string) {
  const id = crypto.randomUUID();
  const destination = typeof __WEB_CALCULATOR_URL__ === 'undefined' ? undefined : __WEB_CALCULATOR_URL__;
  const url = createWebHandoff(vehicle,listingUrl,id,destination);
  const tab = window.open(url,'_blank','noopener,noreferrer');
  // noopener returns null in some browsers even when the tab opens. Do not infer failure from it.
  void tab;
  return id;
}
