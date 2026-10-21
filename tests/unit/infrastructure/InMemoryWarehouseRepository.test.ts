import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryWarehouseRepository } from '../../../src/lib/infrastructure/memory/InMemoryWarehouseRepository.js';

describe('InMemoryWarehouseRepository', () => {
	let repo: InMemoryWarehouseRepository;

	beforeEach(() => {
		repo = new InMemoryWarehouseRepository();
	});

	it('initializes with all 8 regional warehouses from baseline', async () => {
		const warehouses = await repo.getAll();
		expect(warehouses).toHaveLength(8);
		const ids = warehouses.map((w) => w.id).sort();
		expect(ids).toEqual(['W01', 'W02', 'W03', 'W04', 'W05', 'W06', 'W07', 'W08']);
	});

	it('finds a warehouse by its ID', async () => {
		const w01 = await repo.getById('W01');
		expect(w01).not.toBeNull();
		expect(w01?.city).toBe('Surabaya');
		expect(w01?.distanceKm).toBe(5);
		expect(w01?.inventory.P001).toBe(200);

		const nonexistent = await repo.getById('W99');
		expect(nonexistent).toBeNull();
	});

	it('updates warehouse inventory without affecting unmentioned properties', async () => {
		const initial = await repo.getById('W01');
		expect(initial).not.toBeNull();

		const updatedW01 = {
			...initial!,
			inventory: { ...initial!.inventory, P001: 150 }
		};

		await repo.updateWarehouses([updatedW01]);

		const reloaded = await repo.getById('W01');
		expect(reloaded?.inventory.P001).toBe(150);
		expect(reloaded?.inventory.P003).toBe(500); // untouched
	});

	it('resets modified inventory back to original baseline', async () => {
		const initial = await repo.getById('W01');
		const modified = {
			...initial!,
			inventory: { ...initial!.inventory, P001: 10 }
		};

		await repo.updateWarehouses([modified]);
		const updated = await repo.getById('W01');
		expect(updated?.inventory.P001).toBe(10);

		const restored = await repo.resetToBaseline();
		const w01Restored = restored.find((w) => w.id === 'W01');
		expect(w01Restored?.inventory.P001).toBe(200);
	});

	it('initializes deliveries with ON_PROCESS status in statusHistory', async () => {
		const deliveries = await repo.getHistoricalDeliveries();
		expect(deliveries.length).toBeGreaterThanOrEqual(38);
		const d1 = deliveries.find((d) => d.id === 'DL001');
		expect(d1).toBeDefined();
		expect(d1?.status).toBe('ON_PROCESS');
		expect(d1?.statusHistory).toBeDefined();
		expect(d1?.statusHistory?.length).toBe(1);
		expect(d1?.statusHistory?.[0].status).toBe('ON_PROCESS');
	});

	it('records a new delivery with automatic ON_PROCESS tracking record', async () => {
		await repo.recordDelivery({
			id: 'TEST-DEL-01',
			warehouseId: 'W01',
			deliveryDate: '2026-10-19 12:00:00',
			arrivedDate: null,
			notes: 'Test dispatch note',
			status: 'ON_PROCESS',
			items: [{ productId: 'P001', quantity: 10 }]
		});

		const deliveries = await repo.getHistoricalDeliveries();
		const testDelivery = deliveries.find((d) => d.id === 'TEST-DEL-01');
		expect(testDelivery).toBeDefined();
		expect(testDelivery?.status).toBe('ON_PROCESS');
		expect(testDelivery?.statusHistory).toHaveLength(1);
		expect(testDelivery?.statusHistory?.[0].status).toBe('ON_PROCESS');
		expect(testDelivery?.statusHistory?.[0].note).toBe('Test dispatch note');
	});

	it('adds a unique delivery status and updates current status', async () => {
		const tracking = await repo.addDeliveryStatus('DL001', 'ON_DELIVERY', 'Van in transit');
		expect(tracking.status).toBe('ON_DELIVERY');
		expect(tracking.deliveryId).toBe('DL001');
		expect(tracking.note).toBe('Van in transit');

		const deliveries = await repo.getHistoricalDeliveries();
		const dl001 = deliveries.find((d) => d.id === 'DL001');
		expect(dl001?.status).toBe('ON_DELIVERY');
		expect(dl001?.statusHistory).toHaveLength(2);
		expect(dl001?.statusHistory?.[0].status).toBe('ON_DELIVERY');
		expect(dl001?.statusHistory?.[1].status).toBe('ON_PROCESS');
	});

	it('enforces uniqueness: rejects adding duplicate status for the same delivery', async () => {
		// DL001 already has ON_PROCESS
		await expect(repo.addDeliveryStatus('DL001', 'ON_PROCESS', 'Duplicate test')).rejects.toThrow(
			/already exists/
		);
	});

	it('rejects adding new status when delivery is already in terminal state (DELIVERED or CANCELED)', async () => {
		await repo.addDeliveryStatus('DL001', 'DELIVERED', 'Delivered at destination');

		const deliveries = await repo.getHistoricalDeliveries();
		const dl001 = deliveries.find((d) => d.id === 'DL001');
		expect(dl001?.status).toBe('DELIVERED');

		// Attempting to add any further status should fail
		await expect(repo.addDeliveryStatus('DL001', 'CANCELED', 'Too late')).rejects.toThrow(
			/terminal state/
		);
	});

	it('protects ON_PROCESS, CANCELED, and DELIVERED from deletion, but allows deleting ON_DELIVERY', async () => {
		// 1. DL001 initial ON_PROCESS status cannot be deleted
		const deliveries = await repo.getHistoricalDeliveries();
		const dl001 = deliveries.find((d) => d.id === 'DL001');
		const onProcessTracking = dl001!.statusHistory![0];

		await expect(
			repo.deleteDeliveryStatus(onProcessTracking.id, 'DL001')
		).rejects.toThrow(/cannot be deleted/);

		// 2. Add ON_DELIVERY
		const onDeliveryTracking = await repo.addDeliveryStatus('DL001', 'ON_DELIVERY', 'En route');
		expect(onDeliveryTracking.status).toBe('ON_DELIVERY');

		// 3. Delete ON_DELIVERY -> succeeds and reverts current status to ON_PROCESS
		const deleted = await repo.deleteDeliveryStatus(onDeliveryTracking.id, 'DL001');
		expect(deleted).toBe(true);

		const updatedDeliveries = await repo.getHistoricalDeliveries();
		const dl001After = updatedDeliveries.find((d) => d.id === 'DL001');
		expect(dl001After?.status).toBe('ON_PROCESS');
		expect(dl001After?.statusHistory).toHaveLength(1);
	});

	it('disallows deleting any status history once delivery is DELIVERED or CANCELED', async () => {
		// Add ON_DELIVERY then DELIVERED
		const onDeliveryTracking = await repo.addDeliveryStatus('DL001', 'ON_DELIVERY', 'Out on transit');
		await repo.addDeliveryStatus('DL001', 'DELIVERED', 'Safely arrived');

		// Now delivery is in DELIVERED state. Attempting to delete even ON_DELIVERY must fail!
		await expect(
			repo.deleteDeliveryStatus(onDeliveryTracking.id, 'DL001')
		).rejects.toThrow(/terminal state/);
	});

	it('allows updating status note when delivery is active, but locks when DELIVERED or CANCELED', async () => {
		const deliveries = await repo.getHistoricalDeliveries();
		const dl001 = deliveries.find((d) => d.id === 'DL001');
		const onProcessTracking = dl001!.statusHistory![0];

		// 1. Updating note on active delivery succeeds
		const updated = await repo.updateDeliveryStatusNote(
			onProcessTracking.id,
			'DL001',
			'Updated note: Inspection verified'
		);
		expect(updated.note).toBe('Updated note: Inspection verified');

		// 2. Deliver the order (transitions to terminal state)
		await repo.addDeliveryStatus('DL001', 'DELIVERED', 'Delivered at hospital');

		// 3. Updating note on a DELIVERED delivery is rejected
		await expect(
			repo.updateDeliveryStatusNote(onProcessTracking.id, 'DL001', 'Trying to change note after delivery')
		).rejects.toThrow(/terminal state/);
	});

	it('reverts stock in the origin warehouse when delivery is marked as CANCELED', async () => {
		// DL001 originates from W01 with P001: 50 and P003: 100
		const w01Before = await repo.getById('W01');
		expect(w01Before?.inventory.P001).toBe(200);
		expect(w01Before?.inventory.P003).toBe(500);

		await repo.addDeliveryStatus('DL001', 'CANCELED', 'Hospital canceled requisition');

		const w01After = await repo.getById('W01');
		expect(w01After?.inventory.P001).toBe(250); // 200 + 50 reverted
		expect(w01After?.inventory.P003).toBe(600); // 500 + 100 reverted
	});

	it('does not revert stock when delivery transitions to ON_DELIVERY or DELIVERED', async () => {
		// DL002 originates from W01 with P005: 50
		const w01Before = await repo.getById('W01');
		expect(w01Before?.inventory.P005).toBe(300);

		await repo.addDeliveryStatus('DL002', 'ON_DELIVERY', 'Van departed');
		const w01InTransit = await repo.getById('W01');
		expect(w01InTransit?.inventory.P005).toBe(300);

		await repo.addDeliveryStatus('DL002', 'DELIVERED', 'Safely arrived');
		const w01Delivered = await repo.getById('W01');
		expect(w01Delivered?.inventory.P005).toBe(300);
	});
});

