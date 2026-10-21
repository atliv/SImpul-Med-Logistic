/**
 * Fulfillment status for an order.
 * FULFILLED: Entire order satisfied by a single warehouse.
 * SPLIT_SHIPMENT: Order split across multiple warehouses.
 * INSUFFICIENT_STOCK: Network-wide stock cannot satisfy the order.
 */
export type FulfillmentStatus = 'FULFILLED' | 'SPLIT_SHIPMENT' | 'INSUFFICIENT_STOCK';

/**
 * Represents a single item allocation within a shipment.
 */
export interface ShipmentItem {
	productId: string;
	quantity: number;
}

/**
 * Represents a shipment from a single warehouse as part of a fulfillment plan.
 */
export interface Shipment {
	warehouseId: string;
	warehouseCity: string;
	distanceKm: number;
	fleetType: string;
	items: ShipmentItem[];
	deliveryId?: string;
}


/**
 * Represents an item that could not be fulfilled due to insufficient network stock.
 */
export interface UnfulfilledItem {
	productId: string;
	requestedQuantity: number;
	availableQuantity: number;
	shortfall: number;
}

/**
 * The complete fulfillment plan for an order, including status, shipments,
 * explanation, and any unfulfilled items.
 */
export interface FulfillmentPlan {
	status: FulfillmentStatus;
	shipments: Shipment[];
	explanation: string;
	unfulfilledItems: UnfulfilledItem[];
	totalDistanceKm: number;
	splitCount: number;
}

/**
 * Represents a candidate plan option presented to the operator for comparison
 * before finalizing an order.
 */
export interface FulfillmentCandidate {
	id: string;
	title: string;
	badge: string;
	strategy: 'NEAREST_FIRST' | 'CONSOLIDATED_FIRST';
	plan: FulfillmentPlan;
	isRecommended: boolean;
	pros: string[];
	cons: string[];
}
