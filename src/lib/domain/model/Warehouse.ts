import type { StorageType } from './Product.js';

/**
 * Storage unit classification for a warehouse facility.
 * GENERAL: Ambient-only storage.
 * REFRIGERATED: Temperature-controlled cold-chain (2–8°C) storage.
 * MIXED: Dual-zone facility equipped with both general storage and refrigerated units.
 */
export type StorageUnit = 'GENERAL' | 'REFRIGERATED' | 'MIXED';

/**
 * Fleet type available at the warehouse.
 * STANDARD: Regular delivery trucks with normal ambient container.
 * VAN_WITH_SMALL_REFRIGERATOR: Delivery van equipped with auxiliary small refrigerator / cool-box (co-delivery of ambient and cold items).
 * REFRIGERATED_VANS: Dedicated temperature-controlled cold-chain transport vehicles.
 */
export type FleetType = 'STANDARD' | 'VAN_WITH_SMALL_REFRIGERATOR' | 'REFRIGERATED_VANS';

/**
 * Inventory map: product ID → available quantity.
 */
export type InventoryMap = Record<string, number>;

/**
 * Represents a regional warehouse facility in the distribution network.
 */
export interface Warehouse {
	id: string;
	city: string;
	distanceKm: number;
	storageUnit: StorageUnit;
	fleetType: FleetType;
	inventory: InventoryMap;
}

/**
 * Check if a warehouse can store products requiring refrigeration.
 */
export function hasRefrigeration(warehouse: Warehouse): boolean {
	return warehouse.storageUnit === 'REFRIGERATED' || warehouse.storageUnit === 'MIXED';
}

/**
 * Check if a warehouse can handle a product's storage requirements.
 */
export function canStoreProduct(warehouse: Warehouse, storageType: StorageType): boolean {
	if (storageType === 'AMBIENT') return true;
	return hasRefrigeration(warehouse);
}

/**
 * Get the available quantity of a product in a warehouse.
 */
export function getStock(warehouse: Warehouse, productId: string): number {
	return warehouse.inventory[productId] ?? 0;
}

/**
 * Check if a warehouse has enough stock for a given product and quantity.
 */
export function hasEnoughStock(
	warehouse: Warehouse,
	productId: string,
	quantity: number
): boolean {
	return getStock(warehouse, productId) >= quantity;
}

/**
 * Deep-clone a warehouse (including inventory) for immutable operations.
 */
export function cloneWarehouse(warehouse: Warehouse): Warehouse {
	return {
		...warehouse,
		inventory: { ...warehouse.inventory }
	};
}
