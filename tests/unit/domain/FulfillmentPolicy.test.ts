import { describe, it, expect } from 'vitest';
import { FulfillmentPolicy } from '../../../src/lib/domain/services/FulfillmentPolicy.js';
import { BASELINE_WAREHOUSES, getBaselineWarehouses } from '../../../src/lib/domain/data/baseline.js';
import type { Order } from '../../../src/lib/domain/model/Order.js';
import type { Warehouse } from '../../../src/lib/domain/model/Warehouse.js';

describe('FulfillmentPolicy (Detroit School State Verification)', () => {
	const policy = new FulfillmentPolicy();

	describe('Step 1: Single-Warehouse Complete Coverage', () => {
		it('Scenario A: Selects W01 as the closest warehouse when it can cover the full order alone', () => {
			const warehouses = getBaselineWarehouses();
			const order: Order = {
				items: [
					{ productId: 'P001', quantity: 50 },
					{ productId: 'P003', quantity: 100 }
				]
			};

			const plan = policy.evaluate(order, warehouses);

			expect(plan.status).toBe('FULFILLED');
			expect(plan.splitCount).toBe(1);
			expect(plan.shipments).toHaveLength(1);
			expect(plan.shipments[0].warehouseId).toBe('W01');
			expect(plan.shipments[0].distanceKm).toBe(5);
			expect(plan.totalDistanceKm).toBe(5);
			expect(plan.unfulfilledItems).toHaveLength(0);
			expect(plan.explanation).toContain('Fulfilled completely by W01');
			expect(plan.explanation).toContain('5 km');
		});

		it('Selects W02 when W01 lacks cold-chain vaccines but W02 has full coverage (under Consolidated-First)', () => {
			const warehouses = getBaselineWarehouses();
			// W02 has P001: 50, P002: 30, P004: 20, distance 12 km
			const order: Order = {
				items: [
					{ productId: 'P001', quantity: 50 },
					{ productId: 'P002', quantity: 20 }
				],
				strategy: 'CONSOLIDATED_FIRST'
			};

			const plan = policy.evaluate(order, warehouses);

			expect(plan.status).toBe('FULFILLED');
			expect(plan.splitCount).toBe(1);
			expect(plan.shipments[0].warehouseId).toBe('W02');
			expect(plan.shipments[0].distanceKm).toBe(12);
			expect(plan.explanation).toContain('Temperature Compliance');
		});

		it('Picks the nearest warehouse when multiple single warehouses can fulfill the order', () => {
			// W01 (5km) has P001: 200, W03 (25km) has P001: 300, W05 (90km) has P001: 400
			const warehouses = getBaselineWarehouses();
			const order: Order = {
				items: [{ productId: 'P001', quantity: 100 }]
			};

			const plan = policy.evaluate(order, warehouses);

			expect(plan.status).toBe('FULFILLED');
			expect(plan.shipments[0].warehouseId).toBe('W01');
			expect(plan.totalDistanceKm).toBe(5);
		});
	});

	describe('Nearest-First Strategy (User Requirement / Proximity Priority)', () => {
		it('Fulfills 250 of P001 by exhausting W01 (200 units, 5 km) then taking 50 units from W02 (12 km)', () => {
			const warehouses = getBaselineWarehouses();
			const order: Order = {
				items: [{ productId: 'P001', quantity: 250 }]
				// strategy defaults to NEAREST_FIRST
			};

			const plan = policy.evaluate(order, warehouses);

			expect(plan.status).toBe('SPLIT_SHIPMENT');
			expect(plan.splitCount).toBe(2);
			expect(plan.shipments).toHaveLength(2);

			expect(plan.shipments[0].warehouseId).toBe('W01');
			expect(plan.shipments[0].distanceKm).toBe(5);
			expect(plan.shipments[0].items).toEqual([{ productId: 'P001', quantity: 200 }]);

			expect(plan.shipments[1].warehouseId).toBe('W02');
			expect(plan.shipments[1].distanceKm).toBe(12);
			expect(plan.shipments[1].items).toEqual([{ productId: 'P001', quantity: 50 }]);

			expect(plan.totalDistanceKm).toBe(17); // 5 + 12 = 17 km vs W03's 25 km
			expect(plan.explanation).toContain('Nearest-First Proximity Allocation');
		});

		it('In contrast, Consolidated-First prioritizes W03 for 250 of P001 to avoid splits', () => {
			const warehouses = getBaselineWarehouses();
			const order: Order = {
				items: [{ productId: 'P001', quantity: 250 }],
				strategy: 'CONSOLIDATED_FIRST'
			};

			const plan = policy.evaluate(order, warehouses);

			expect(plan.status).toBe('FULFILLED');
			expect(plan.splitCount).toBe(1);
			expect(plan.shipments[0].warehouseId).toBe('W03');
			expect(plan.shipments[0].items).toEqual([{ productId: 'P001', quantity: 250 }]);
			expect(plan.totalDistanceKm).toBe(25);
		});

		it('Generates candidate comparison options (Nearest Split vs Consolidated Single) for 250 of P001', () => {
			const warehouses = getBaselineWarehouses();
			const order: Order = {
				items: [{ productId: 'P001', quantity: 250 }]
			};

			const candidates = policy.evaluateCandidates(order, warehouses);

			expect(candidates).toHaveLength(2);
			const nearest = candidates.find((c) => c.strategy === 'NEAREST_FIRST')!;
			const consolidated = candidates.find((c) => c.strategy === 'CONSOLIDATED_FIRST')!;

			expect(nearest).toBeDefined();
			expect(consolidated).toBeDefined();

			expect(nearest.plan.totalDistanceKm).toBe(17);
			expect(nearest.plan.splitCount).toBe(2);
			expect(nearest.isRecommended).toBe(true);

			expect(consolidated.plan.totalDistanceKm).toBe(25);
			expect(consolidated.plan.splitCount).toBe(1);
		});
	});

	describe('Step 2: 2-Warehouse Minimum-Split Allocation', () => {
		it('Splits between ambient (W01) and cold-chain (W04) when W02 lacks stock under Consolidated-First', () => {
			const warehouses = getBaselineWarehouses();
			// P001: 100 (exceeds W02's 50), P002: 35 (exceeds W02's 30, available at W04: 40)
			const order: Order = {
				items: [
					{ productId: 'P001', quantity: 100 },
					{ productId: 'P002', quantity: 35 }
				],
				strategy: 'CONSOLIDATED_FIRST'
			};

			const plan = policy.evaluate(order, warehouses);

			expect(plan.status).toBe('SPLIT_SHIPMENT');
			expect(plan.splitCount).toBe(2);
			expect(plan.shipments).toHaveLength(2);

			const whIds = plan.shipments.map((s) => s.warehouseId);
			expect(whIds).toContain('W01');
			expect(whIds).toContain('W04');

			// W01 supplies P001 (100) and W04 supplies P002 (35)
			const w01Shipment = plan.shipments.find((s) => s.warehouseId === 'W01')!;
			expect(w01Shipment.items).toEqual([{ productId: 'P001', quantity: 100 }]);

			const w04Shipment = plan.shipments.find((s) => s.warehouseId === 'W04')!;
			expect(w04Shipment.items).toEqual([{ productId: 'P002', quantity: 35 }]);

			expect(plan.totalDistanceKm).toBe(5 + 30); // W01: 5km, W04: 30km -> 35km
			expect(plan.explanation).toContain('Split fulfillment required across 2 warehouses');
		});

		it('Selects optimal 2-warehouse combo with minimal combined distance', () => {
			const warehouses = getBaselineWarehouses();
			// P001: 350.
			// Single options: W05 (90km, stock 400). But can a 2-warehouse combo do better?
			// W01 (5km, 200) + W03 (25km, 300) = 500 stock, combined distance: 30km.
			// Wait, in Step 1, W05 has 400 stock! So W05 satisfies 100% alone.
			// What if W05 didn't have 350?
			const customWarehouses: Warehouse[] = [
				{
					id: 'W01',
					city: 'Surabaya',
					distanceKm: 5,
					storageUnit: 'GENERAL',
					fleetType: 'STANDARD',
					inventory: { P001: 200 }
				},
				{
					id: 'W03',
					city: 'Sidoarjo',
					distanceKm: 25,
					storageUnit: 'GENERAL',
					fleetType: 'STANDARD',
					inventory: { P001: 200 }
				},
				{
					id: 'W07',
					city: 'Pasuruan',
					distanceKm: 45,
					storageUnit: 'REFRIGERATED',
					fleetType: 'REFRIGERATED_VANS',
					inventory: { P001: 200 }
				}
			];

			const order: Order = {
				items: [{ productId: 'P001', quantity: 350 }]
			};

			const plan = policy.evaluate(order, customWarehouses);

			expect(plan.status).toBe('SPLIT_SHIPMENT');
			expect(plan.splitCount).toBe(2);
			// W01 (5km) + W03 (25km) = 30km combined, vs W01 + W07 = 50km
			expect(plan.shipments.map((s) => s.warehouseId)).toEqual(['W01', 'W03']);
			expect(plan.totalDistanceKm).toBe(30);
		});
	});

	describe('Step 3: Greedy Multi-Warehouse Allocation (3+ Warehouses)', () => {
		it('Allocates across 3+ warehouses by distance ascending when 2 warehouses cannot cover demand', () => {
			const warehouses = getBaselineWarehouses();
			// P001 total demand: 600.
			// W01 has 200, W02 has 50, W03 has 300 -> sum of top 2 is W03(300)+W05(400)=700 or W01(200)+W05(400)=600.
			// Let's request P001: 800.
			// W05 (400) + W03 (300) = 700 (still not enough for 2 warehouses).
			// Needs 3 warehouses!
			const order: Order = {
				items: [{ productId: 'P001', quantity: 800 }]
			};

			const plan = policy.evaluate(order, warehouses);

			expect(plan.status).toBe('SPLIT_SHIPMENT');
			expect(plan.splitCount).toBeGreaterThan(2);

			// Total delivered quantity must equal 800
			const totalP001 = plan.shipments.reduce((sum, s) => {
				const item = s.items.find((i) => i.productId === 'P001');
				return sum + (item?.quantity ?? 0);
			}, 0);
			expect(totalP001).toBe(800);
			expect(plan.unfulfilledItems).toHaveLength(0);
		});
	});

	describe('Step 4: Network Stock Depletion Check', () => {
		it('Scenario D: Returns INSUFFICIENT_STOCK with details when order exceeds total network supply', () => {
			const warehouses = getBaselineWarehouses();
			// P002 total network stock is 158 (30 + 40 + 20 + 8 + 60)
			const order: Order = {
				items: [{ productId: 'P002', quantity: 200 }]
			};

			const plan = policy.evaluate(order, warehouses);

			expect(plan.status).toBe('INSUFFICIENT_STOCK');
			expect(plan.shipments).toHaveLength(0);
			expect(plan.splitCount).toBe(0);
			expect(plan.totalDistanceKm).toBe(0);
			expect(plan.unfulfilledItems).toHaveLength(1);
			expect(plan.unfulfilledItems[0]).toEqual({
				productId: 'P002',
				requestedQuantity: 200,
				availableQuantity: 158,
				shortfall: 42
			});
			expect(plan.explanation).toContain('insufficient inventory across the regional network');
			expect(plan.explanation).toContain('Vaccine — Hepatitis B');
			expect(plan.explanation).toContain('shortfall of 42 units');
		});

		it('Reports multiple deficient items when several SKUs exceed network stock', () => {
			const warehouses = getBaselineWarehouses();
			const order: Order = {
				items: [
					{ productId: 'P002', quantity: 200 }, // avail: 158
					{ productId: 'P004', quantity: 150 } // avail: 135
				]
			};

			const plan = policy.evaluate(order, warehouses);

			expect(plan.status).toBe('INSUFFICIENT_STOCK');
			expect(plan.unfulfilledItems).toHaveLength(2);
			expect(plan.unfulfilledItems.map((u) => u.productId)).toEqual(['P002', 'P004']);
		});
	});

	describe('Inventory Deduction (Fulfillment Execution)', () => {
		it('Correctly deducts inventory after successful single warehouse fulfillment', () => {
			const initialWarehouses = getBaselineWarehouses();
			const order: Order = {
				items: [{ productId: 'P001', quantity: 50 }]
			};

			const { plan, updatedWarehouses } = policy.execute(order, initialWarehouses);

			expect(plan.status).toBe('FULFILLED');
			const updatedW01 = updatedWarehouses.find((w) => w.id === 'W01')!;
			expect(updatedW01.inventory.P001).toBe(150); // was 200, now 150

			// Original array is unmodified (immutability)
			const origW01 = initialWarehouses.find((w) => w.id === 'W01')!;
			expect(origW01.inventory.P001).toBe(200);
		});

		it('Correctly deducts inventory after split fulfillment (Consolidated-First)', () => {
			const initialWarehouses = getBaselineWarehouses();
			const order: Order = {
				items: [
					{ productId: 'P001', quantity: 100 },
					{ productId: 'P002', quantity: 35 }
				],
				strategy: 'CONSOLIDATED_FIRST'
			};

			const { plan, updatedWarehouses } = policy.execute(order, initialWarehouses);

			expect(plan.status).toBe('SPLIT_SHIPMENT');
			const updatedW01 = updatedWarehouses.find((w) => w.id === 'W01')!;
			const updatedW04 = updatedWarehouses.find((w) => w.id === 'W04')!;

			expect(updatedW01.inventory.P001).toBe(100); // was 200, deducted 100
			expect(updatedW04.inventory.P002).toBe(5); // was 40, deducted 35
		});

		it('Correctly deducts inventory across multiple warehouses under Nearest-First (e.g. 250 of P001)', () => {
			const initialWarehouses = getBaselineWarehouses();
			const order: Order = {
				items: [{ productId: 'P001', quantity: 250 }]
			};

			const { plan, updatedWarehouses } = policy.execute(order, initialWarehouses);

			expect(plan.status).toBe('SPLIT_SHIPMENT');
			const updatedW01 = updatedWarehouses.find((w) => w.id === 'W01')!;
			const updatedW02 = updatedWarehouses.find((w) => w.id === 'W02')!;

			expect(updatedW01.inventory.P001).toBe(0); // was 200, deducted 200
			expect(updatedW02.inventory.P001).toBe(0); // was 50, deducted 50
		});

		it('Does not modify inventory when status is INSUFFICIENT_STOCK', () => {
			const initialWarehouses = getBaselineWarehouses();
			const order: Order = {
				items: [{ productId: 'P002', quantity: 500 }]
			};

			const { plan, updatedWarehouses } = policy.execute(order, initialWarehouses);

			expect(plan.status).toBe('INSUFFICIENT_STOCK');
			expect(updatedWarehouses).toEqual(initialWarehouses);
		});

		it('Throws error if attempting to deduct inventory for an INSUFFICIENT_STOCK plan directly', () => {
			const warehouses = getBaselineWarehouses();
			const unfulfilledPlan = policy.evaluate(
				{ items: [{ productId: 'P002', quantity: 999 }] },
				warehouses
			);

			expect(() => {
				FulfillmentPolicy.deductInventory(warehouses, unfulfilledPlan);
			}).toThrow('Cannot deduct inventory for an unfulfilled plan.');
		});
	});
});
