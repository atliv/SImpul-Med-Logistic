import { describe, it, expect, beforeEach } from 'vitest';
import { GET as getWarehouses, PATCH as updateWarehouseStock } from '../../src/routes/api/warehouses/+server.js';
import { GET as getHistory } from '../../src/routes/api/history/+server.js';
import { POST as fulfillOrder } from '../../src/routes/api/fulfill/+server.js';
import { POST as resetData } from '../../src/routes/api/reset/+server.js';
import {
	POST as addHistoryStatus,
	DELETE as deleteHistoryStatus,
	PATCH as updateHistoryStatusNote
} from '../../src/routes/api/history/status/+server.js';

import { setWarehouseRepository } from '../../src/lib/infrastructure/repositories/index.js';
import { InMemoryWarehouseRepository } from '../../src/lib/infrastructure/memory/InMemoryWarehouseRepository.js';
import type { RequestEvent } from '@sveltejs/kit';

describe('API Endpoints (Integration with In-Memory Repository)', () => {
	beforeEach(() => {
		// Clean repository for each test
		setWarehouseRepository(new InMemoryWarehouseRepository());
	});

	it('GET /api/warehouses returns 8 warehouses and catalog products', async () => {
		const response = await getWarehouses({} as RequestEvent);
		expect(response.status).toBe(200);

		const data = await response.json();
		expect(data.warehouses).toHaveLength(8);
		expect(data.products).toHaveLength(5);
		expect(data.warehouses[0].id).toBe('W01');
	});

	it('PATCH /api/warehouses successfully updates warehouse stock with a valid positive integer', async () => {
		const request = new Request('http://localhost/api/warehouses', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				warehouseId: 'W01',
				productId: 'P001',
				quantity: 350
			})
		});

		const response = await updateWarehouseStock({ request } as RequestEvent);
		expect(response.status).toBe(200);

		const data = await response.json();
		expect(data.success).toBe(true);
		expect(data.warehouse.inventory.P001).toBe(350);

		const w01 = data.warehouses.find((w: { id: string }) => w.id === 'W01');
		expect(w01.inventory.P001).toBe(350);
	});

	it('PATCH /api/warehouses rejects negative values', async () => {
		const request = new Request('http://localhost/api/warehouses', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				warehouseId: 'W01',
				productId: 'P001',
				quantity: -25
			})
		});

		const response = await updateWarehouseStock({ request } as RequestEvent);
		expect(response.status).toBe(400);

		const data = await response.json();
		expect(data.error).toMatch(/positive integer/i);
	});

	it('PATCH /api/warehouses rejects non-integer decimal values', async () => {
		const request = new Request('http://localhost/api/warehouses', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				warehouseId: 'W01',
				productId: 'P001',
				quantity: 45.5
			})
		});

		const response = await updateWarehouseStock({ request } as RequestEvent);
		expect(response.status).toBe(400);

		const data = await response.json();
		expect(data.error).toMatch(/positive integer/i);
	});

	it('PATCH /api/warehouses rejects refrigerated items in ambient-only facilities', async () => {
		const request = new Request('http://localhost/api/warehouses', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				warehouseId: 'W01', // General storage unit
				productId: 'P002', // Hep B Vaccine (Refrigerated)
				quantity: 50
			})
		});

		const response = await updateWarehouseStock({ request } as RequestEvent);
		expect(response.status).toBe(400);

		const data = await response.json();
		expect(data.error).toMatch(/refrigerated/i);
	});

	it('POST /api/fulfill processes a valid order and returns FulfillmentPlan', async () => {
		const request = new Request('http://localhost/api/fulfill', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				items: [
					{ productId: 'P001', quantity: 50 },
					{ productId: 'P003', quantity: 100 }
				]
			})
		});

		const response = await fulfillOrder({ request } as RequestEvent);
		expect(response.status).toBe(200);

		const data = await response.json();
		expect(data.plan.status).toBe('FULFILLED');
		expect(data.plan.shipments[0].warehouseId).toBe('W01');

		// Check warehouse inventory in response was updated
		const w01 = data.warehouses.find((w: { id: string }) => w.id === 'W01');
		expect(w01.inventory.P001).toBe(150);
	});

	it('POST /api/fulfill returns 400 when body is invalid or items are missing', async () => {
		const request = new Request('http://localhost/api/fulfill', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({})
		});

		const response = await fulfillOrder({ request } as RequestEvent);
		expect(response.status).toBe(400);

		const data = await response.json();
		expect(data.error).toBeDefined();
	});

	it('POST /api/reset restores stock back to initial catalog defaults', async () => {
		// 1. Deplete some stock via fulfill
		const fulfillReq = new Request('http://localhost/api/fulfill', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				items: [{ productId: 'P001', quantity: 100 }]
			})
		});
		await fulfillOrder({ request: fulfillReq } as RequestEvent);

		// 2. Invoke reset
		const resetResponse = await resetData({} as RequestEvent);
		expect(resetResponse.status).toBe(200);

		const resetDataJson = await resetResponse.json();
		expect(resetDataJson.success).toBe(true);

		const w01 = resetDataJson.warehouses.find((w: { id: string }) => w.id === 'W01');
		expect(w01.inventory.P001).toBe(200); // restored back to 200
	});

	it('GET /api/history returns baseline deliveries with items and metadata', async () => {
		const response = await getHistory({} as RequestEvent);
		expect(response.status).toBe(200);

		const data = await response.json();
		expect(data.deliveries.length).toBeGreaterThanOrEqual(38);
		expect(data.deliveries[0].id).toBeDefined();
		expect(data.deliveries[0].warehouseCity).toBeDefined();
		expect(data.deliveries[0].items.length).toBeGreaterThan(0);
	});

	it('POST /api/fulfill with commit records new deliveries in historical log', async () => {
		const fulfillReq = new Request('http://localhost/api/fulfill', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				items: [{ productId: 'P001', quantity: 50 }],
				commit: true
			})
		});
		await fulfillOrder({ request: fulfillReq } as RequestEvent);

		const historyRes = await getHistory({} as RequestEvent);
		const historyData = await historyRes.json();
		expect(historyData.deliveries[0].id).toContain('DL-');
		expect(historyData.deliveries[0].warehouseId).toBe('W01');
		expect(historyData.deliveries[0].items[0].productId).toBe('P001');
		expect(historyData.deliveries[0].items[0].quantity).toBe(50);
		expect(historyData.deliveries[0].deliveryDate).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
		expect(historyData.deliveries[0].arrivedDate).toBeNull();
	});

	it('POST /api/fulfill records custom deliveryDate when passed in body', async () => {
		const fulfillReq = new Request('http://localhost/api/fulfill', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				items: [{ productId: 'P001', quantity: 25 }],
				commit: true,
				deliveryDate: '2026-12-15'
			})
		});
		await fulfillOrder({ request: fulfillReq } as RequestEvent);

		const historyRes = await getHistory({} as RequestEvent);
		const historyData = await historyRes.json();
		expect(historyData.deliveries[0].deliveryDate).toContain('2026-12-15');
	});

	it('POST /api/history/status appends new status and updates delivery current status', async () => {
		const request = new Request('http://localhost/api/history/status', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				deliveryId: 'DL001',
				status: 'ON_DELIVERY',
				note: 'Driver on toll road'
			})
		});

		const res = await addHistoryStatus({ request } as RequestEvent);
		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data.success).toBe(true);
		expect(data.tracking.status).toBe('ON_DELIVERY');
		expect(data.tracking.deliveryId).toBe('DL001');

		// Verify GET /api/history reflects the updated status and history
		const historyRes = await getHistory({} as RequestEvent);
		const historyData = await historyRes.json();
		const dl001 = historyData.deliveries.find((d: { id: string }) => d.id === 'DL001');
		expect(dl001.status).toBe('ON_DELIVERY');
		expect(dl001.statusHistory).toHaveLength(2);
	});

	it('POST /api/history/status rejects duplicate status', async () => {
		const request = new Request('http://localhost/api/history/status', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				deliveryId: 'DL001',
				status: 'ON_PROCESS',
				note: 'Duplicate status attempt'
			})
		});

		const res = await addHistoryStatus({ request } as RequestEvent);
		expect(res.status).toBe(400);
		const data = await res.json();
		expect(data.error).toContain('already exists');
	});

	it('DELETE /api/history/status rejects deleting ON_PROCESS or DELIVERED, but deletes ON_DELIVERY', async () => {
		// 1. Add ON_DELIVERY
		const addReq = new Request('http://localhost/api/history/status', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				deliveryId: 'DL001',
				status: 'ON_DELIVERY'
			})
		});
		const addRes = await addHistoryStatus({ request: addReq } as RequestEvent);
		const addData = await addRes.json();
		const onDeliveryId = addData.tracking.id;

		// 2. Try to delete the initial ON_PROCESS record
		const historyRes = await getHistory({} as RequestEvent);
		const historyData = await historyRes.json();
		const dl001 = historyData.deliveries.find((d: { id: string }) => d.id === 'DL001');
		const onProcessId = dl001.statusHistory.find((s: { status: string }) => s.status === 'ON_PROCESS').id;

		const deleteProcessReq = new Request('http://localhost/api/history/status', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id: onProcessId, deliveryId: 'DL001' })
		});
		const deleteProcessRes = await deleteHistoryStatus({ request: deleteProcessReq, url: new URL('http://localhost/api/history/status') } as RequestEvent);
		expect(deleteProcessRes.status).toBe(400);

		// 3. Delete ON_DELIVERY record -> succeeds
		const deleteDeliveryReq = new Request('http://localhost/api/history/status', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id: onDeliveryId, deliveryId: 'DL001' })
		});
		const deleteDeliveryRes = await deleteHistoryStatus({ request: deleteDeliveryReq, url: new URL('http://localhost/api/history/status') } as RequestEvent);
		expect(deleteDeliveryRes.status).toBe(200);

		// Status reverted back to ON_PROCESS
		const finalHistoryRes = await getHistory({} as RequestEvent);
		const finalHistoryData = await finalHistoryRes.json();
		const finalDl001 = finalHistoryData.deliveries.find((d: { id: string }) => d.id === 'DL001');
		expect(finalDl001.status).toBe('ON_PROCESS');
		expect(finalDl001.statusHistory).toHaveLength(1);
	});

	it('PATCH /api/history/status updates note when delivery is active, rejects when terminal', async () => {
		const historyRes = await getHistory({} as RequestEvent);
		const historyData = await historyRes.json();
		const dl001 = historyData.deliveries.find((d: { id: string }) => d.id === 'DL001');
		const onProcessId = dl001.statusHistory[0].id;

		// 1. Update note successfully on active delivery
		const patchReq = new Request('http://localhost/api/history/status', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				id: onProcessId,
				deliveryId: 'DL001',
				note: 'Updated transit telemetry note'
			})
		});
		const patchRes = await updateHistoryStatusNote({ request: patchReq } as RequestEvent);
		expect(patchRes.status).toBe(200);
		const patchData = await patchRes.json();
		expect(patchData.success).toBe(true);
		expect(patchData.tracking.note).toBe('Updated transit telemetry note');

		// 2. Transition DL001 to DELIVERED
		const deliverReq = new Request('http://localhost/api/history/status', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				deliveryId: 'DL001',
				status: 'DELIVERED',
				note: 'Package signed off'
			})
		});
		await addHistoryStatus({ request: deliverReq } as RequestEvent);

		// 3. Attempt to update note on terminal delivery should fail with 400
		const failPatchReq = new Request('http://localhost/api/history/status', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				id: onProcessId,
				deliveryId: 'DL001',
				note: 'Illegal update after delivery finalized'
			})
		});
		const failPatchRes = await updateHistoryStatusNote({ request: failPatchReq } as RequestEvent);
		expect(failPatchRes.status).toBe(400);
		const failData = await failPatchRes.json();
		expect(failData.error).toContain('terminal state');

		// 4. Attempt to delete status on terminal delivery should fail with 400
		const failDeleteReq = new Request('http://localhost/api/history/status', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id: onProcessId, deliveryId: 'DL001' })
		});
		const failDeleteRes = await deleteHistoryStatus({ request: failDeleteReq, url: new URL('http://localhost/api/history/status') } as RequestEvent);
		expect(failDeleteRes.status).toBe(400);
	});

	it('POST /api/history/status with status CANCELED reverts origin warehouse stock and returns updated warehouses', async () => {
		// 1. Dispatch an order: 50 units of P001 from W01
		const fulfillReq = new Request('http://localhost/api/fulfill', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				items: [{ productId: 'P001', quantity: 50 }],
				commit: true
			})
		});
		const fulfillRes = await fulfillOrder({ request: fulfillReq } as RequestEvent);
		const fulfillData = await fulfillRes.json();
		const newDeliveryId = fulfillData.plan.shipments[0].deliveryId;

		// W01 stock deducted from 200 to 150
		const w01Deducted = fulfillData.warehouses.find((w: { id: string }) => w.id === 'W01');
		expect(w01Deducted.inventory.P001).toBe(150);

		// 2. Cancel the delivery
		const cancelReq = new Request('http://localhost/api/history/status', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				deliveryId: newDeliveryId,
				status: 'CANCELED',
				note: 'Shipment recalled due to recipient request'
			})
		});
		const cancelRes = await addHistoryStatus({ request: cancelReq } as RequestEvent);
		expect(cancelRes.status).toBe(200);

		const cancelData = await cancelRes.json();
		expect(cancelData.success).toBe(true);
		expect(cancelData.warehouses).toBeDefined();

		// Origin warehouse (W01) stock should be reverted back to 200
		const w01Reverted = cancelData.warehouses.find((w: { id: string }) => w.id === 'W01');
		expect(w01Reverted.inventory.P001).toBe(200);

		// Verify via GET /api/warehouses as well
		const getWhRes = await getWarehouses({} as RequestEvent);
		const whData = await getWhRes.json();
		const w01FromGet = whData.warehouses.find((w: { id: string }) => w.id === 'W01');
		expect(w01FromGet.inventory.P001).toBe(200);
	});

	it('GET /api/history supports limit and offset scroll pagination with hasMore telemetry', async () => {
		// First page: limit 2, offset 0
		const page1Url = new URL('http://localhost/api/history?limit=2&offset=0');
		const page1Res = await getHistory({ url: page1Url } as RequestEvent);
		expect(page1Res.status).toBe(200);

		const page1Data = await page1Res.json();
		expect(page1Data.deliveries).toHaveLength(2);
		expect(page1Data.total).toBeGreaterThanOrEqual(3);
		expect(page1Data.hasMore).toBe(true);
		expect(page1Data.offset).toBe(0);
		expect(page1Data.limit).toBe(2);

		// Second page: limit 2, offset 2
		const page2Url = new URL('http://localhost/api/history?limit=2&offset=2');
		const page2Res = await getHistory({ url: page2Url } as RequestEvent);
		expect(page2Res.status).toBe(200);

		const page2Data = await page2Res.json();
		expect(page2Data.offset).toBe(2);
		expect(page2Data.deliveries.length).toBeGreaterThanOrEqual(1);

		// Verify records do not overlap between page 1 and page 2
		const page1Ids = page1Data.deliveries.map((d: { id: string }) => d.id);
		const page2Ids = page2Data.deliveries.map((d: { id: string }) => d.id);
		for (const id of page2Ids) {
			expect(page1Ids).not.toContain(id);
		}

		// When offset exceeds total, hasMore must be false and deliveries empty
		const endUrl = new URL(`http://localhost/api/history?limit=2&offset=${page1Data.total}`);
		const endRes = await getHistory({ url: endUrl } as RequestEvent);
		const endData = await endRes.json();
		expect(endData.deliveries).toHaveLength(0);
		expect(endData.hasMore).toBe(false);
	});

	it('GET /api/history filters by warehouse and search keyword with pagination', async () => {
		const filterUrl = new URL('http://localhost/api/history?limit=10&offset=0&warehouse=W01&search=DL001');
		const filterRes = await getHistory({ url: filterUrl } as RequestEvent);
		expect(filterRes.status).toBe(200);

		const data = await filterRes.json();
		expect(data.deliveries.length).toBeGreaterThanOrEqual(1);
		expect(data.deliveries.every((d: { warehouseId: string; id: string }) => d.warehouseId === 'W01' && d.id.includes('DL001'))).toBe(true);
		expect(data.hasMore).toBe(false);
	});
});

