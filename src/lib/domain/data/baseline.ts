import type { Warehouse } from '../model/Warehouse.js';

/**
 * Baseline warehouse data from the domain specification (Section 2.2).
 *
 * 8 Regional facilities serving the Surabaya Hospital Hub,
 * with pre-seeded inventory for 5 SKUs (P001–P005).
 */
export const BASELINE_WAREHOUSES: readonly Warehouse[] = [
	{
		id: 'W01',
		city: 'Surabaya',
		distanceKm: 5,
		storageUnit: 'GENERAL',
		fleetType: 'STANDARD',
		inventory: { P001: 200, P003: 500, P005: 300 }
	},
	{
		id: 'W02',
		city: 'Surabaya',
		distanceKm: 12,
		storageUnit: 'MIXED',
		fleetType: 'VAN_WITH_SMALL_REFRIGERATOR',
		inventory: { P001: 50, P002: 30, P004: 20 }
	},
	{
		id: 'W03',
		city: 'Sidoarjo',
		distanceKm: 25,
		storageUnit: 'GENERAL',
		fleetType: 'STANDARD',
		inventory: { P001: 300, P003: 200 }
	},
	{
		id: 'W04',
		city: 'Gresik',
		distanceKm: 30,
		storageUnit: 'MIXED',
		fleetType: 'REFRIGERATED_VANS',
		inventory: { P002: 40, P004: 25, P005: 100 }
	},
	{
		id: 'W05',
		city: 'Malang',
		distanceKm: 90,
		storageUnit: 'GENERAL',
		fleetType: 'STANDARD',
		inventory: { P001: 400, P003: 300, P005: 500 }
	},
	{
		id: 'W06',
		city: 'Malang',
		distanceKm: 95,
		storageUnit: 'MIXED',
		fleetType: 'VAN_WITH_SMALL_REFRIGERATOR',
		inventory: { P002: 20, P004: 30, P003: 100 }
	},
	{
		id: 'W07',
		city: 'Pasuruan',
		distanceKm: 45,
		storageUnit: 'MIXED',
		fleetType: 'REFRIGERATED_VANS',
		inventory: { P001: 150, P002: 8, P004: 10 }
	},
	{
		id: 'W08',
		city: 'Jember',
		distanceKm: 150,
		storageUnit: 'MIXED',
		fleetType: 'REFRIGERATED_VANS',
		inventory: { P002: 60, P004: 50, P005: 200 }
	}
] as const;

/**
 * Returns a deep clone of the baseline warehouses for mutable use
 * (e.g., initializing the in-memory repository).
 */
export function getBaselineWarehouses(): Warehouse[] {
	return BASELINE_WAREHOUSES.map((w) => ({
		...w,
		inventory: { ...w.inventory }
	}));
}
