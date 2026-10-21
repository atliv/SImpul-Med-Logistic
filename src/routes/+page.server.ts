import type { PageServerLoad } from './$types.js';
import { getWarehouseRepository } from '#lib/infrastructure/repositories/index.js';
import { GetCatalogUseCase } from '#lib/application/use-cases/GetCatalogUseCase.js';

export const load: PageServerLoad = async () => {
	const repo = getWarehouseRepository();
	const useCase = new GetCatalogUseCase(repo);
	const catalog = await useCase.execute();

	return {
		warehouses: catalog.warehouses,
		products: catalog.products
	};
};
