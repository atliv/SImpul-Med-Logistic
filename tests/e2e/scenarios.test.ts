import { describe, it, expect, beforeEach } from 'vitest';
import { POST as fulfillOrder } from '../../src/routes/api/fulfill/+server.js';
import { POST as resetData } from '../../src/routes/api/reset/+server.js';
import { GET as getWarehouses } from '../../src/routes/api/warehouses/+server.js';
import { setWarehouseRepository } from '../../src/lib/infrastructure/repositories/index.js';
import { InMemoryWarehouseRepository } from '../../src/lib/infrastructure/memory/InMemoryWarehouseRepository.js';
import type { RequestEvent } from '@sveltejs/kit';

describe('Manual QA Scenarios (End-to-End Simulation)', () => {
	beforeEach(async () => {
		setWarehouseRepository(new InMemoryWarehouseRepository());
		await resetData({} as RequestEvent);
	});

	it('Scenario A: Single Warehouse Match (P001: 50, P003: 100)', async () => {
		const req = new Request('http://localhost/api/fulfill', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				items: [
					{ productId: 'P001', quantity: 50 },
					{ productId: 'P003', quantity: 100 }
				]
			})
		});

		const res = await fulfillOrder({ request: req } as RequestEvent);
		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data.plan.status).toBe('FULFILLED');
		expect(data.plan.splitCount).toBe(1);
		expect(data.plan.shipments[0].warehouseId).toBe('W01');
		expect(data.plan.shipments[0].distanceKm).toBe(5);
		expect(data.plan.totalDistanceKm).toBe(5);
		expect(data.plan.explanation).toContain('Fulfilled completely by W01');
	});

	it('Scenario B: Cold Chain Fulfillment (P001: 50, P002: 20)', async () => {
		const req = new Request('http://localhost/api/fulfill', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				items: [
					{ productId: 'P001', quantity: 50 },
					{ productId: 'P002', quantity: 20 }
				]
			})
		});

		const res = await fulfillOrder({ request: req } as RequestEvent);
		expect(res.status).toBe(200);

		const data = await res.json();
		// W02 has P001: 50 and P002: 30, so W02 can fulfill both in 1 shipment of 12 km
		expect(data.plan.status).toBe('FULFILLED');
		expect(data.plan.shipments[0].warehouseId).toBe('W02');
		expect(data.plan.shipments[0].distanceKm).toBe(12);
		expect(data.plan.explanation).toContain('W02');
		expect(data.plan.explanation).toContain('Temperature Compliance');
	});

	it('Scenario C: High Demand Split (P001: 250)', async () => {
		const req = new Request('http://localhost/api/fulfill', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				items: [{ productId: 'P001', quantity: 250 }]
			})
		});

		const res = await fulfillOrder({ request: req } as RequestEvent);
		expect(res.status).toBe(200);

		const data = await res.json();
		// W03 has 300 of P001 at 25km (single warehouse coverage)
		// Or if W03 was not available, splits across W01 + W02
		expect(['FULFILLED', 'SPLIT_SHIPMENT']).toContain(data.plan.status);
		const totalFulfilled = data.plan.shipments.reduce((sum: number, s: { items: Array<{ productId: string; quantity: number }> }) => {
			const item = s.items.find((i) => i.productId === 'P001');
			return sum + (item?.quantity ?? 0);
		}, 0);
		expect(totalFulfilled).toBe(250);
	});

	it('Scenario D: Insufficient Regional Stock (P002: 200)', async () => {
		const req = new Request('http://localhost/api/fulfill', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				items: [{ productId: 'P002', quantity: 200 }]
			})
		});

		const res = await fulfillOrder({ request: req } as RequestEvent);
		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data.plan.status).toBe('INSUFFICIENT_STOCK');
		expect(data.plan.shipments).toHaveLength(0);
		expect(data.plan.unfulfilledItems).toHaveLength(1);
		expect(data.plan.unfulfilledItems[0].productId).toBe('P002');
		expect(data.plan.unfulfilledItems[0].availableQuantity).toBe(158);
		expect(data.plan.unfulfilledItems[0].shortfall).toBe(42);
		expect(data.plan.explanation).toContain('insufficient inventory across the regional network');
	});

	it('Scenario E: Reset Inventory to Default Baseline', async () => {
		// Deduct W01
		const req = new Request('http://localhost/api/fulfill', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				items: [{ productId: 'P001', quantity: 200 }]
			})
		});
		await fulfillOrder({ request: req } as RequestEvent);

		// Reset
		const resetRes = await resetData({} as RequestEvent);
		const resetJson = await resetRes.json();
		expect(resetJson.success).toBe(true);

		// Verify W01 stock restored
		const listRes = await getWarehouses({} as RequestEvent);
		const listJson = await listRes.json();
		const w01 = listJson.warehouses.find((w: { id: string }) => w.id === 'W01');
		expect(w01.inventory.P001).toBe(200);
	});
});
