import type { IWarehouseRepository } from '../../domain/repositories/IWarehouseRepository.js';
import type { Warehouse } from '../../domain/model/Warehouse.js';
import { PRODUCTS, type Product } from '../../domain/model/Product.js';

export interface CatalogResult {
	warehouses: Warehouse[];
	products: readonly Product[];
}

export class GetCatalogUseCase {
	constructor(private repository: IWarehouseRepository) {}

	async execute(): Promise<CatalogResult> {
		const warehouses = await this.repository.getAll();
		return {
			warehouses,
			products: PRODUCTS
		};
	}
}
