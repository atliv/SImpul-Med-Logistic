import type { IWarehouseRepository } from '../../domain/repositories/IWarehouseRepository.js';
import type { Warehouse } from '../../domain/model/Warehouse.js';

export interface ResetDefaultDataResult {
	success: boolean;
	message: string;
	warehouses: Warehouse[];
}

export class ResetDefaultDataUseCase {
	constructor(private repository: IWarehouseRepository) {}

	async execute(): Promise<ResetDefaultDataResult> {
		const restoredWarehouses = await this.repository.resetToBaseline();

		return {
			success: true,
			message: 'Warehouse inventory successfully restored to default baseline data.',
			warehouses: restoredWarehouses
		};
	}
}
