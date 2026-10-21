import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryWarehouseRepository } from '../../../src/lib/infrastructure/memory/InMemoryWarehouseRepository.js';
import { GetCatalogUseCase } from '../../../src/lib/application/use-cases/GetCatalogUseCase.js';
import { FulfillOrderUseCase } from '../../../src/lib/application/use-cases/FulfillOrderUseCase.js';
import { ResetDefaultDataUseCase } from '../../../src/lib/application/use-cases/ResetDefaultDataUseCase.js';

describe('Application Layer Use Cases (In-Memory Testing)', () => {
	let repo: InMemoryWarehouseRepository;

	beforeEach(() => {
		repo = new InMemoryWarehouseRepository();
	});

	describe('GetCatalogUseCase', () => {
		it('returns all 8 regional warehouses and 5 catalog products', async () => {
			const useCase = new GetCatalogUseCase(repo);
			const result = await useCase.execute();

			expect(result.warehouses).toHaveLength(8);
			expect(result.products).toHaveLength(5);
			expect(result.products.map((p) => p.id)).toEqual(['P001', 'P002', 'P003', 'P004', 'P005']);
		});
	});

	describe('FulfillOrderUseCase', () => {
		it('fulfills order from W01 and deducts inventory in repository', async () => {
			const useCase = new FulfillOrderUseCase(repo);
			const result = await useCase.execute({
				items: [
					{ productId: 'P001', quantity: 50 },
					{ productId: 'P003', quantity: 100 }
				]
			});

			expect(result.plan.status).toBe('FULFILLED');
			expect(result.plan.shipments[0].warehouseId).toBe('W01');

			// Verify inventory was deducted in repository
			const w01 = await repo.getById('W01');
			expect(w01?.inventory.P001).toBe(150); // was 200
			expect(w01?.inventory.P003).toBe(400); // was 500
		});

		it('records custom deliveryDate when provided in FulfillOrderRequest', async () => {
			const useCase = new FulfillOrderUseCase(repo);
			await useCase.execute({
				items: [{ productId: 'P001', quantity: 20 }],
				commit: true,
				deliveryDate: '2026-11-20'
			});

			const deliveries = await repo.getHistoricalDeliveries();
			const latest = deliveries.find((d) => d.items?.some((i) => i.productId === 'P001' && i.quantity === 20));
			expect(latest).toBeDefined();
			expect(latest?.deliveryDate).toContain('2026-11-20');
		});

		it('rejects order with empty items array', async () => {
			const useCase = new FulfillOrderUseCase(repo);
			await expect(useCase.execute({ items: [] })).rejects.toThrow('Order must contain at least one item.');
		});

		it('does not deduct repository stock when order has INSUFFICIENT_STOCK', async () => {
			const useCase = new FulfillOrderUseCase(repo);
			const result = await useCase.execute({
				items: [{ productId: 'P002', quantity: 999 }]
			});

			expect(result.plan.status).toBe('INSUFFICIENT_STOCK');

			// Check W02 stock is intact
			const w02 = await repo.getById('W02');
			expect(w02?.inventory.P002).toBe(30);
		});
	});

	describe('ResetDefaultDataUseCase', () => {
		it('restores repository state after fulfillment', async () => {
			const fulfillUseCase = new FulfillOrderUseCase(repo);
			await fulfillUseCase.execute({
				items: [{ productId: 'P001', quantity: 100 }]
			});

			const w01After = await repo.getById('W01');
			expect(w01After?.inventory.P001).toBe(100);

			const resetUseCase = new ResetDefaultDataUseCase(repo);
			const resetResult = await resetUseCase.execute();

			expect(resetResult.success).toBe(true);
			const w01Reset = await repo.getById('W01');
			expect(w01Reset?.inventory.P001).toBe(200);
		});
	});
});
