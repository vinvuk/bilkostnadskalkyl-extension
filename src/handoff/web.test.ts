import {it,expect} from 'vitest';
import {createWebHandoff} from './web';
import type {VehicleData} from '../types';
const vehicle={purchasePrice:369900,vehicleYear:2023,fuelType:'el',fuelConsumption:1.81,vehicleName:'Volkswagen – elbil',isEstimated:{fuelConsumption:false,vehicleType:true},registrationNumber:'SECRET',imageUrl:'https://secret.example/photo',annualTax:360} as VehicleData;
it('creates an allowlisted, versioned fragment without seller, registration, image or tracking data',()=>{
 for(const [site,path] of [['blocket','mobility/item/26964311'],['wayke','objekt/30f58e62-4334-4cd5-b2cc-eb5be1f69237'],['carla','bil/test-2023']]) {
  const link=new URL(createWebHandoff(vehicle,`https://www.${site}.se/${path}?tracking=x`,'b634002a-84ef-4e02-81c4-983746cc2a99'));
  expect(link.origin).toBe('https://dinbilkostnad.se');expect(link.search).toBe('');
  const payload=JSON.parse(decodeURIComponent(link.hash.slice(5)));
  expect(payload).toMatchObject({v:1,site,price:369900,consumptionEstimated:false});expect(JSON.stringify(payload)).not.toMatch(/SECRET|secret.example|tracking/);
 }
});
it('rejects foreign sources and invalid prices and flags unsupported fuel',()=>{
 expect(()=>createWebHandoff(vehicle,'https://blocket.se.evil.example/mobility/item/1','id')).toThrow();
 expect(()=>createWebHandoff({...vehicle,purchasePrice:NaN},'https://www.blocket.se/mobility/item/1','id')).toThrow();
 const link=new URL(createWebHandoff({...vehicle,fuelType:'laddhybrid'},'https://www.blocket.se/mobility/item/1','id'));
 expect(JSON.parse(decodeURIComponent(link.hash.slice(5)))).toMatchObject({fuel:null,unsupportedFuel:true});
});
