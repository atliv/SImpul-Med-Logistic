import { describe, it, expect } from 'vitest';
import { ExplanationBuilder } from '../../../src/lib/domain/services/ExplanationBuilder.js';
import { getBaselineWarehouses } from '../../../src/lib/domain/data/baseline.js';
import type { Order } from '../../../src/lib/domain/model/Order.js';

describe('ExplanationBuilder', () => {
	const warehouses = getBaselineWarehouses();

	it('produces a human-readable explanation for INSUFFICIENT_STOCK', () => {
		const explanation = ExplanationBuilder.build({
			status: 'INSUFFICIENT_STOCK',
			shipments: [],
			unfulfilledItems: [
				{
					productId: 'P002',
					requestedQuantity: 200,
					availableQuantity: 158,
					shortfall: 42
				}
			],
			order: { items: [{ productId: 'P002', quantity: 200 }] },
			warehouses
		});

		expect(explanation).toContain('insufficient inventory across the regional network');
		expect(explanation).toContain('Vaccine — Hepatitis B');
		expect(explanation).toContain('Requested 200 units, but only 158 units are available');
		expect(explanation).toContain('shortfall of 42 units');
	});

	it('produces a clear explanation for FULFILLED with proximity and fleet details', () => {
		const explanation = ExplanationBuilder.build({
			status: 'FULFILLED',
			shipments: [
				{
					warehouseId: 'W01',
					warehouseCity: 'Surabaya',
					distanceKm: 5,
					fleetType: 'STANDARD',
					items: [
						{ productId: 'P001', quantity: 50 },
						{ productId: 'P003', quantity: 100 }
					]
				}
			],
			unfulfilledItems: [],
			order: {
				items: [
					{ productId: 'P001', quantity: 50 },
					{ productId: 'P003', quantity: 100 }
				]
			},
			warehouses
		});

		expect(explanation).toContain('Fulfilled completely by W01 (Surabaya, 5 km from customer)');
		expect(explanation).toContain('closest regional facility with 100% stock coverage');
		expect(explanation).toContain('single consolidated shipment (5 km total transit distance)');
		expect(explanation).toContain('Standard delivery fleet assigned');
	});

	it('produces a detailed explanation for SPLIT_SHIPMENT with breakdown and trade-offs', () => {
		const explanation = ExplanationBuilder.build({
			status: 'SPLIT_SHIPMENT',
			shipments: [
				{
					warehouseId: 'W01',
					warehouseCity: 'Surabaya',
					distanceKm: 5,
					fleetType: 'STANDARD',
					items: [{ productId: 'P001', quantity: 100 }]
				},
				{
					warehouseId: 'W04',
					warehouseCity: 'Gresik',
					distanceKm: 30,
					fleetType: 'REFRIGERATED_VANS',
					items: [{ productId: 'P002', quantity: 35 }]
				}
			],
			unfulfilledItems: [],
			order: {
				items: [
					{ productId: 'P001', quantity: 100 },
					{ productId: 'P002', quantity: 35 }
				]
			},
			warehouses
		});

		expect(explanation).toContain('Split fulfillment required across 2 warehouses');
		expect(explanation).toContain('W01 (5 km) + W04 (30 km)');
		expect(explanation).toContain('Dual Storage Requirement');
		expect(explanation).toContain('Minimum Split Optimization');
		expect(explanation).toContain('Shipment Allocation Breakdown:');
		expect(explanation).toContain('W01 (Surabaya, 5 km): Supplies 100x Surgical Gloves (Box of 100)');
		expect(explanation).toContain('W04 (Gresik, 30 km): Supplies 35x Vaccine — Hepatitis B (10-dose vial)');
		expect(explanation).toContain('Refrigerated Vans (Cold-Chain)');
	});

	it('produces explanation referencing van with small refrigerator for mixed co-delivery', () => {
		const explanation = ExplanationBuilder.build({
			status: 'FULFILLED',
			shipments: [
				{
					warehouseId: 'W02',
					warehouseCity: 'Surabaya',
					distanceKm: 12,
					fleetType: 'VAN_WITH_SMALL_REFRIGERATOR',
					items: [
						{ productId: 'P001', quantity: 50 },
						{ productId: 'P002', quantity: 20 }
					]
				}
			],
			unfulfilledItems: [],
			order: {
				items: [
					{ productId: 'P001', quantity: 50 },
					{ productId: 'P002', quantity: 20 }
				]
			},
			warehouses
		});

		expect(explanation).toContain('W02 (Surabaya, 12 km from customer)');
		expect(explanation).toContain('Temperature Compliance');
		expect(explanation).toContain('delivery van equipped with small refrigerator/cool-box');
	});
});
