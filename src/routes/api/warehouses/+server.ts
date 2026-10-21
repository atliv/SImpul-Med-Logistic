import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getWarehouseRepository } from '#lib/infrastructure/repositories/index.js';
import { GetCatalogUseCase } from '#lib/application/use-cases/GetCatalogUseCase.js';
import { PRODUCTS } from '#lib/domain/model/Product.js';
import { hasRefrigeration } from '#lib/domain/model/Warehouse.js';

export const GET: RequestHandler = async () => {
	try {
		const repo = getWarehouseRepository();
		const useCase = new GetCatalogUseCase(repo);
		const data = await useCase.execute();

		return json(data, {
			headers: {
				'Cache-Control': 'no-store, must-revalidate'
			}
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to retrieve warehouses';
		return json({ error: message }, { status: 500 });
	}
};

export const PATCH: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { warehouseId, productId, quantity } = body;

		if (!warehouseId || typeof warehouseId !== 'string') {
			return json({ error: 'Valid warehouse ID is required.' }, { status: 400 });
		}
		if (!productId || typeof productId !== 'string') {
			return json({ error: 'Valid product ID is required.' }, { status: 400 });
		}

		const numQty = Number(quantity);
		if (isNaN(numQty) || numQty < 0 || !Number.isInteger(numQty)) {
			return json({ error: 'Quantity must be a positive integer (0 or greater).' }, { status: 400 });
		}

		const product = PRODUCTS.find((p) => p.id === productId);
		if (!product) {
			return json({ error: `Product '${productId}' not found in catalog.` }, { status: 404 });
		}

		const repo = getWarehouseRepository();
		const warehouse = await repo.getById(warehouseId);
		if (!warehouse) {
			return json({ error: `Warehouse '${warehouseId}' not found.` }, { status: 404 });
		}

		if (product.storageType === 'REFRIGERATED' && !hasRefrigeration(warehouse) && numQty > 0) {
			return json(
				{
					error: `Cannot assign refrigerated product '${productId}' to warehouse '${warehouseId}' (${warehouse.storageUnit} storage facility).`
				},
				{ status: 400 }
			);
		}

		warehouse.inventory[productId] = numQty;
		await repo.updateWarehouses([warehouse]);

		const allWarehouses = await repo.getAll();
		return json({
			success: true,
			warehouse,
			warehouses: allWarehouses
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to update warehouse stock';
		return json({ error: message }, { status: 500 });
	}
};
