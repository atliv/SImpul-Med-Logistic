import type { Order } from '../model/Order.js';
import type { FulfillmentStatus, Shipment, UnfulfilledItem } from '../model/FulfillmentPlan.js';
import type { Warehouse } from '../model/Warehouse.js';
import { getProductById } from '../model/Product.js';

export interface ExplanationContext {
	status: FulfillmentStatus;
	shipments: Shipment[];
	unfulfilledItems: UnfulfilledItem[];
	order: Order;
	warehouses: Warehouse[];
}

/**
 * Builds clear, human-readable explanations explaining why specific warehouse(s)
 * were selected, detailing proximity, stock availability, storage capabilities,
 * and trade-offs made during split fulfillment.
 */
export class ExplanationBuilder {
	/**
	 * Generate a comprehensive explanation string for a fulfillment plan.
	 */
	static build(context: ExplanationContext): string {
		const { status, shipments, unfulfilledItems, order } = context;

		switch (status) {
			case 'INSUFFICIENT_STOCK':
				return this.buildInsufficientStockExplanation(unfulfilledItems, context.warehouses);

			case 'FULFILLED':
				return this.buildSingleWarehouseExplanation(shipments[0], order);

			case 'SPLIT_SHIPMENT':
				return this.buildSplitShipmentExplanation(shipments, order, context.warehouses);

			default:
				return 'Order processed with unhandled status.';
		}
	}

	/**
	 * Explanation when total network inventory cannot cover the requested quantities.
	 */
	private static buildInsufficientStockExplanation(
		unfulfilledItems: UnfulfilledItem[],
		warehouses: Warehouse[]
	): string {
		const lines: string[] = [
			'Order cannot be fulfilled due to insufficient inventory across the regional network.'
		];

		const itemDetails = unfulfilledItems.map((item) => {
			const product = getProductById(item.productId);
			const name = product ? `${product.name} (${item.productId})` : item.productId;
			return `• ${name}: Requested ${item.requestedQuantity} units, but only ${item.availableQuantity} units are available across all ${warehouses.length} regional warehouses (shortfall of ${item.shortfall} units).`;
		});

		lines.push('Stock deficit details:');
		lines.push(...itemDetails);
		lines.push(
			'Recommendation: Reduce requested quantities to match available inventory or await regional network restocking.'
		);

		return lines.join('\n');
	}

	/**
	 * Explanation for single-warehouse 100% fulfillment.
	 */
	private static buildSingleWarehouseExplanation(shipment: Shipment, order: Order): string {
		const lines: string[] = [];
		const totalUnits = shipment.items.reduce((sum, item) => sum + item.quantity, 0);
		const itemCount = shipment.items.length;

		lines.push(
			`Fulfilled completely by ${shipment.warehouseId} (${shipment.warehouseCity}, ${shipment.distanceKm} km from customer).`
		);

		lines.push(
			`• Proximity & Efficiency: ${shipment.warehouseId} is the closest regional facility with 100% stock coverage for all requested line items.`
		);

		lines.push(
			`• Consolidated Delivery: Dispatched as a single consolidated shipment (${shipment.distanceKm} km total transit distance), eliminating split logistics overhead and reducing delivery risk.`
		);

		// Check if cold-chain items are in the shipment
		const hasColdChain = shipment.items.some((item) => {
			const p = getProductById(item.productId);
			return p?.storageType === 'REFRIGERATED';
		});

		if (hasColdChain) {
			const fleetDesc =
				shipment.fleetType === 'REFRIGERATED_VANS'
					? 'dedicated refrigerated vans'
					: shipment.fleetType === 'VAN_WITH_SMALL_REFRIGERATOR'
					? 'delivery van equipped with small refrigerator/cool-box'
					: 'temperature-monitored fleet';

			lines.push(
				`• Temperature Compliance: ${shipment.warehouseId} is equipped with certified cold-chain refrigeration units and ${fleetDesc} to safely transport pharmaceutical vaccines.`
			);
		} else {
			lines.push(
				`• Fleet Assignment: Standard delivery fleet assigned (normal container) for ${totalUnits} ambient medical supply units across ${itemCount} SKU(s).`
			);
		}

		return lines.join('\n');
	}

	/**
	 * Explanation for multi-warehouse split fulfillment.
	 */
	private static buildSplitShipmentExplanation(
		shipments: Shipment[],
		order: Order,
		warehouses: Warehouse[]
	): string {
		const lines: string[] = [];
		const splitCount = shipments.length;
		const totalDistance = shipments.reduce((sum, s) => sum + s.distanceKm, 0);
		const warehouseNames = shipments.map((s) => `${s.warehouseId} (${s.distanceKm} km)`).join(' + ');

		lines.push(
			`Split fulfillment required across ${splitCount} warehouses: ${warehouseNames} (Total travel distance: ${totalDistance} km).`
		);

		// Why single warehouse couldn't fulfill
		const containsColdChain = order.items.some((item) => {
			const p = getProductById(item.productId);
			return p?.storageType === 'REFRIGERATED';
		});

		const containsAmbient = order.items.some((item) => {
			const p = getProductById(item.productId);
			return p?.storageType === 'AMBIENT';
		});

		if (containsColdChain && containsAmbient) {
			lines.push(
				'• Dual Storage Requirement: The order contains both ambient medical supplies and cold-chain refrigerated pharmaceuticals. No single facility holds complete inventory for both categories.'
			);
		} else {
			if (order.strategy === 'CONSOLIDATED_FIRST') {
				lines.push(
					'• Stock Capacity: No single regional warehouse possessed sufficient inventory to fulfill the full requested quantity for all line items.'
				);
			} else {
				lines.push(
					`• Nearest-First Proximity Allocation: Inventory was drawn starting from the closest warehouse (${shipments[0].warehouseId}, ${shipments[0].distanceKm} km). Because local stock was insufficient for the full order, remaining demand was fulfilled from the next nearest facility (${shipments.slice(1).map((s) => `${s.warehouseId} at ${s.distanceKm} km`).join(', ')}).`
				);
			}
		}

		// Optimization rationale
		if (splitCount === 2) {
			if (order.strategy === 'CONSOLIDATED_FIRST') {
				lines.push(
					`• Minimum Split Optimization: Evaluated all 2-facility combinations across the 8-warehouse network. Selected the pair (${shipments[0].warehouseId} and ${shipments[1].warehouseId}) that satisfies 100% of demand while minimizing combined transit distance.`
				);
			} else {
				lines.push(
					`• Minimum Split Optimization: Satisfied 100% of demand across 2 facilities with a combined travel distance of ${totalDistance} km, avoiding unnecessary dispatches from farther regional centers.`
				);
			}
		} else {
			lines.push(
				`• Multi-Facility Routing: Demand exceeded 2-facility capacity. Stock was allocated sequentially by warehouse proximity, exhausting the nearest regional stock first to control transit distances.`
			);
		}

		// Shipment breakdown
		lines.push('Shipment Allocation Breakdown:');
		for (const shipment of shipments) {
			const itemSummary = shipment.items
				.map((i) => {
					const p = getProductById(i.productId);
					const name = p ? p.name : i.productId;
					return `${i.quantity}x ${name}`;
				})
				.join(', ');

			const fleetDesc =
				shipment.fleetType === 'REFRIGERATED_VANS'
					? 'Refrigerated Vans (Cold-Chain)'
					: shipment.fleetType === 'VAN_WITH_SMALL_REFRIGERATOR'
					? 'Van equipped with Small Refrigerator (Dual Cargo)'
					: 'Standard Fleet (Normal Container)';

			lines.push(
				`  • ${shipment.warehouseId} (${shipment.warehouseCity}, ${shipment.distanceKm} km): Supplies ${itemSummary} via ${fleetDesc}.`
			);
		}

		return lines.join('\n');
	}
}
