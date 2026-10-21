import type { IWarehouseRepository } from '../../domain/repositories/IWarehouseRepository.js';
import type { Warehouse } from '../../domain/model/Warehouse.js';
import type { HistoricalDelivery, DeliveryStatus, DeliveryStatusTracking } from '../../domain/model/HistoricalDelivery.js';
import { isTerminalDeliveryStatus, isDeliveryStatusDeletable } from '../../domain/model/HistoricalDelivery.js';
import { cloneWarehouse } from '../../domain/model/Warehouse.js';
import { getBaselineWarehouses } from '../../domain/data/baseline.js';
import { getBaselineHistoricalDeliveries } from '../../domain/data/baselineDeliveries.js';

/**
 * InMemoryWarehouseRepository: Fast, deterministic, zero-dependency repository implementation.
 * Used for automated tests (Vitest) and local development fallback.
 */
export class InMemoryWarehouseRepository implements IWarehouseRepository {
	private warehouses: Map<string, Warehouse>;
	private historicalDeliveries: HistoricalDelivery[];
	private deliveryStatusTracking: DeliveryStatusTracking[];
	private nextTrackingId = 1;

	constructor(initialData?: Warehouse[], initialDeliveries?: HistoricalDelivery[]) {
		this.warehouses = new Map();
		const data = initialData ?? getBaselineWarehouses();
		for (const w of data) {
			this.warehouses.set(w.id, cloneWarehouse(w));
		}
		this.historicalDeliveries = initialDeliveries ?? getBaselineHistoricalDeliveries();
		this.deliveryStatusTracking = [];
		this.seedBaselineStatuses();
	}

	private seedBaselineStatuses(): void {
		for (const d of this.historicalDeliveries) {
			this.deliveryStatusTracking.push({
				id: this.nextTrackingId++,
				deliveryId: d.id,
				status: 'ON_PROCESS',
				note: d.notes ?? 'Initial dispatch recorded and processing',
				createdDate: d.deliveryDate ?? new Date().toISOString().replace('T', ' ').substring(0, 19)
			});
		}
	}

	async getAll(): Promise<Warehouse[]> {
		return Array.from(this.warehouses.values()).map(cloneWarehouse);
	}

	async getById(id: string): Promise<Warehouse | null> {
		const found = this.warehouses.get(id);
		return found ? cloneWarehouse(found) : null;
	}

	async updateWarehouses(updated: Warehouse[]): Promise<void> {
		for (const w of updated) {
			if (this.warehouses.has(w.id)) {
				this.warehouses.set(w.id, cloneWarehouse(w));
			}
		}
	}

	async resetToBaseline(): Promise<Warehouse[]> {
		this.warehouses.clear();
		const baseline = getBaselineWarehouses();
		for (const w of baseline) {
			this.warehouses.set(w.id, cloneWarehouse(w));
		}
		this.historicalDeliveries = getBaselineHistoricalDeliveries();
		this.deliveryStatusTracking = [];
		this.nextTrackingId = 1;
		this.seedBaselineStatuses();
		return this.getAll();
	}

	async getHistoricalDeliveries(): Promise<HistoricalDelivery[]> {
		return this.historicalDeliveries.map((d) => {
			const history = this.deliveryStatusTracking
				.filter((t) => t.deliveryId === d.id)
				.sort((a, b) => b.id - a.id)
				.map((t) => ({ ...t }));

			const currentStatus = history.length > 0 ? history[0].status : (d.status ?? 'ON_PROCESS');

			return {
				...d,
				status: currentStatus,
				statusHistory: history,
				items: d.items.map((i) => ({ ...i }))
			};
		});
	}

	async recordDelivery(delivery: HistoricalDelivery): Promise<void> {
		const createdDelivery: HistoricalDelivery = {
			...delivery,
			status: delivery.status ?? 'ON_PROCESS',
			items: delivery.items.map((i) => ({ ...i }))
		};

		this.historicalDeliveries.unshift(createdDelivery);

		// ON_PROCESS status is always automatically created upon delivery creation and cannot be deleted
		this.deliveryStatusTracking.unshift({
			id: this.nextTrackingId++,
			deliveryId: delivery.id,
			status: 'ON_PROCESS',
			note: delivery.notes ?? 'Initial dispatch recorded',
			createdDate: delivery.deliveryDate ?? new Date().toISOString().replace('T', ' ').substring(0, 19)
		});
	}

	async addDeliveryStatus(
		deliveryId: string,
		status: DeliveryStatus,
		note?: string | null
	): Promise<DeliveryStatusTracking> {
		const delivery = this.historicalDeliveries.find((d) => d.id === deliveryId);
		if (!delivery) {
			throw new Error(`Delivery not found: ${deliveryId}`);
		}

		if (isTerminalDeliveryStatus(delivery.status)) {
			throw new Error(
				`Cannot add status. Delivery ${deliveryId} is already in terminal state [${delivery.status}].`
			);
		}

		const hasSameStatus = this.deliveryStatusTracking.some(
			(t) => t.deliveryId === deliveryId && t.status === status
		);
		if (hasSameStatus) {
			throw new Error(
				`Status [${status}] already exists for delivery ${deliveryId}. Duplicate statuses are not permitted.`
			);
		}

		const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
		const tracking: DeliveryStatusTracking = {
			id: this.nextTrackingId++,
			deliveryId,
			status,
			note: note ? note.trim() : null,
			createdDate: nowStr
		};

		this.deliveryStatusTracking.unshift(tracking);
		delivery.status = status;

		if (status === 'DELIVERED' && !delivery.arrivedDate) {
			delivery.arrivedDate = nowStr;
		}

		if (status === 'CANCELED') {
			const originWarehouse = this.warehouses.get(delivery.warehouseId);
			if (originWarehouse && delivery.items) {
				for (const item of delivery.items) {
					originWarehouse.inventory[item.productId] =
						(originWarehouse.inventory[item.productId] ?? 0) + item.quantity;
				}
			}
		}

		return { ...tracking };
	}

	async deleteDeliveryStatus(id: number, deliveryId: string): Promise<boolean> {
		const delivery = this.historicalDeliveries.find((d) => d.id === deliveryId);
		if (!delivery) {
			throw new Error(`Delivery not found: ${deliveryId}`);
		}

		if (isTerminalDeliveryStatus(delivery.status)) {
			throw new Error(
				`Cannot delete status history. Delivery ${deliveryId} is in terminal state [${delivery.status}] and history is permanently locked.`
			);
		}

		const index = this.deliveryStatusTracking.findIndex(
			(t) => t.id === id && t.deliveryId === deliveryId
		);
		if (index === -1) {
			throw new Error(`Delivery status tracking record not found: ID ${id} for delivery ${deliveryId}`);
		}

		const tracking = this.deliveryStatusTracking[index];
		if (!isDeliveryStatusDeletable(tracking.status, delivery.status)) {
			throw new Error(
				`Status [${tracking.status}] cannot be deleted. ON_PROCESS, CANCELED, and DELIVERED are protected.`
			);
		}

		this.deliveryStatusTracking.splice(index, 1);

		// Recalculate latest active status for this delivery
		const remaining = this.deliveryStatusTracking
			.filter((t) => t.deliveryId === deliveryId)
			.sort((a, b) => b.id - a.id);

		if (delivery && remaining.length > 0) {
			delivery.status = remaining[0].status;
		}

		return true;
	}

	async updateDeliveryStatusNote(
		id: number,
		deliveryId: string,
		note: string | null
	): Promise<DeliveryStatusTracking> {
		const delivery = this.historicalDeliveries.find((d) => d.id === deliveryId);
		if (!delivery) {
			throw new Error(`Delivery not found: ${deliveryId}`);
		}

		if (isTerminalDeliveryStatus(delivery.status)) {
			throw new Error(
				`Cannot update note. Delivery ${deliveryId} is in terminal state [${delivery.status}] and locked.`
			);
		}

		const tracking = this.deliveryStatusTracking.find(
			(t) => t.id === id && t.deliveryId === deliveryId
		);
		if (!tracking) {
			throw new Error(`Delivery status tracking record not found: ID ${id} for delivery ${deliveryId}`);
		}

		if (isTerminalDeliveryStatus(tracking.status)) {
			throw new Error(
				`Cannot update note. Status [${tracking.status}] is a terminal record and cannot be edited.`
			);
		}

		tracking.note = note && note.trim().length > 0 ? note.trim() : null;
		return { ...tracking };
	}
}

