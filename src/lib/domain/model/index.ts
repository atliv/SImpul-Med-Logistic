/**
 * Domain model barrel export.
 * Re-exports all core domain types and entities.
 */

// Product
export type { Product, StorageType, ProductCategory } from './Product.js';
export { PRODUCTS, getProductById } from './Product.js';

// Warehouse
export type { Warehouse, StorageUnit, FleetType, InventoryMap } from './Warehouse.js';
export {
	hasRefrigeration,
	canStoreProduct,
	getStock,
	hasEnoughStock,
	cloneWarehouse
} from './Warehouse.js';

// Order
export type { Order, OrderItem } from './Order.js';
export { createOrder, getOrderProductIds } from './Order.js';

// Fulfillment Plan
export type {
	FulfillmentPlan,
	FulfillmentStatus,
	Shipment,
	ShipmentItem,
	UnfulfilledItem
} from './FulfillmentPlan.js';

// Historical Delivery
export type {
	HistoricalDelivery,
	HistoricalDeliveryDetail,
	HistoricalDeliveryWithMeta
} from './HistoricalDelivery.js';
