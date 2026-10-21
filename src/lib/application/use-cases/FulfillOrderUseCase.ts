import type { IWarehouseRepository } from '../../domain/repositories/IWarehouseRepository.js';
import { createOrder, type OrderItem, type FulfillmentStrategy } from '../../domain/model/Order.js';
import { FulfillmentPolicy } from '../../domain/services/FulfillmentPolicy.js';
import type { FulfillmentPlan, FulfillmentCandidate } from '../../domain/model/FulfillmentPlan.js';
import type { Warehouse } from '../../domain/model/Warehouse.js';

import { toDatabaseDateTime } from '../../domain/utils/dateFormat.js';

export interface FulfillOrderRequest {
	items: OrderItem[];
	strategy?: FulfillmentStrategy;
	commit?: boolean;
	deliveryDate?: string;
}

export interface FulfillOrderResult {
	plan: FulfillmentPlan;
	candidates: FulfillmentCandidate[];
	warehouses: Warehouse[];
	isCommitted: boolean;
}

export class FulfillOrderUseCase {
	private policy: FulfillmentPolicy;

	constructor(private repository: IWarehouseRepository) {
		this.policy = new FulfillmentPolicy();
	}

	async execute(request: FulfillOrderRequest): Promise<FulfillOrderResult> {
		if (!request.items || !Array.isArray(request.items) || request.items.length === 0) {
			throw new Error('Order must contain at least one item.');
		}

		// Filter out items with 0 or negative quantities, and validate
		const validItems = request.items.filter((i) => i.quantity > 0);
		if (validItems.length === 0) {
			throw new Error('Order must contain at least one item with a quantity greater than zero.');
		}

		const commit = request.commit !== false;
		const order = createOrder(validItems, request.strategy ?? 'NEAREST_FIRST');
		const currentWarehouses = await this.repository.getAll();

		const candidates = this.policy.evaluateCandidates(order, currentWarehouses);
		const { plan, updatedWarehouses } = this.policy.execute(order, currentWarehouses);

		// If commit is true and plan is not insufficient stock, persist the deducted inventory and record deliveries
		if (commit && plan.status !== 'INSUFFICIENT_STOCK') {
			await this.repository.updateWarehouses(updatedWarehouses);

			const formattedDeliveryDate = request.deliveryDate
				? toDatabaseDateTime(request.deliveryDate)
				: toDatabaseDateTime('');

			for (let idx = 0; idx < plan.shipments.length; idx++) {
				const s = plan.shipments[idx];
				const deliveryId = `DL-${Date.now().toString(36).toUpperCase()}-${idx + 1}`;
				s.deliveryId = deliveryId;
				await this.repository.recordDelivery({
					id: deliveryId,
					warehouseId: s.warehouseId,
					deliveryDate: formattedDeliveryDate,
					arrivedDate: null,
					notes: `Dispatched to Surabaya Hospital Hub via ${s.fleetType} (${s.distanceKm} km).`,
					status: 'ON_PROCESS',
					items: s.items.map((it) => ({
						productId: it.productId,
						quantity: it.quantity
					}))
				});
			}

		}

		return {
			plan,
			candidates,
			warehouses: commit ? updatedWarehouses : currentWarehouses,
			isCommitted: commit
		};
	}
}
