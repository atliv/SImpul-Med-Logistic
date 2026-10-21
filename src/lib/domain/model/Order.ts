/**
 * Represents a single line item in a customer order.
 */
export interface OrderItem {
	productId: string;
	quantity: number;
}

export type FulfillmentStrategy = 'NEAREST_FIRST' | 'CONSOLIDATED_FIRST';

/**
 * Represents a customer order containing one or more product line items.
 */
export interface Order {
	items: OrderItem[];
	strategy?: FulfillmentStrategy;
}

/**
 * Create a validated order from an array of order items.
 * Filters out zero-quantity items and validates positive quantities.
 */
export function createOrder(items: OrderItem[], strategy: FulfillmentStrategy = 'NEAREST_FIRST'): Order {
	const validItems = items.filter((item) => item.quantity > 0);

	if (validItems.length === 0) {
		throw new Error('Order must contain at least one item with a positive quantity.');
	}

	for (const item of validItems) {
		if (!Number.isInteger(item.quantity) || item.quantity < 1) {
			throw new Error(
				`Invalid quantity ${item.quantity} for product ${item.productId}. Must be a positive integer.`
			);
		}
	}

	return { items: validItems, strategy };
}

/**
 * Get the set of unique product IDs in the order.
 */
export function getOrderProductIds(order: Order): string[] {
	return order.items.map((item) => item.productId);
}
