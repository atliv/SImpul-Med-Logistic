import type { Warehouse } from '../model/Warehouse.js';
import type { HistoricalDelivery, DeliveryStatus, DeliveryStatusTracking } from '../model/HistoricalDelivery.js';

/**
 * Interface for Warehouse and Logistics persistence.
 * Decouples domain logic from persistence adapters (In-Memory fake vs Neon PostgreSQL).
 */
export interface IWarehouseRepository {
	/**
	 * Retrieve all regional warehouses with their current stock and metadata.
	 */
	getAll(): Promise<Warehouse[]>;

	/**
	 * Retrieve a single warehouse by its unique ID (e.g., 'W01').
	 */
	getById(id: string): Promise<Warehouse | null>;

	/**
	 * Persist updated inventory counts for warehouses after order fulfillment.
	 */
	updateWarehouses(warehouses: Warehouse[]): Promise<void>;

	/**
	 * Atomically restore all warehouse inventory levels back to the baseline catalog.
	 * Also resets historical deliveries and their status history to the default 38 baseline records.
	 * Returns the freshly restored warehouses.
	 */
	resetToBaseline(): Promise<Warehouse[]>;

	/**
	 * Retrieve all historical deliveries including line items and status tracking history.
	 */
	getHistoricalDeliveries(): Promise<HistoricalDelivery[]>;

	/**
	 * Record a new completed/dispatched delivery with its line items.
	 * Automatically records the initial 'ON_PROCESS' status in status tracking history.
	 */
	recordDelivery(delivery: HistoricalDelivery): Promise<void>;

	/**
	 * Appends a new lifecycle status entry for a delivery.
	 * Enforces uniqueness of status per delivery and disallows adding status if delivery is in terminal state (CANCELED or DELIVERED).
	 */
	addDeliveryStatus(deliveryId: string, status: DeliveryStatus, note?: string | null): Promise<DeliveryStatusTracking>;

	/**
	 * Deletes a status tracking entry by ID.
	 * Disallows deleting if delivery is in terminal status (CANCELED or DELIVERED).
	 * Disallows deleting protected individual statuses: ON_PROCESS, CANCELED, or DELIVERED.
	 */
	deleteDeliveryStatus(id: number, deliveryId: string): Promise<boolean>;

	/**
	 * Updates the note of an existing status history tracking entry.
	 * Disallows updating if the delivery is in a terminal status (CANCELED or DELIVERED).
	 */
	updateDeliveryStatusNote(
		id: number,
		deliveryId: string,
		note: string | null
	): Promise<DeliveryStatusTracking>;
}

