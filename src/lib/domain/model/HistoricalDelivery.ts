export type DeliveryStatus = 'ON_PROCESS' | 'ON_DELIVERY' | 'CANCELED' | 'DELIVERED';

export const ALL_DELIVERY_STATUSES: readonly DeliveryStatus[] = [
	'ON_PROCESS',
	'ON_DELIVERY',
	'CANCELED',
	'DELIVERED'
] as const;

export interface DeliveryStatusTracking {
	id: number;
	deliveryId: string;
	status: DeliveryStatus;
	note: string | null;
	createdDate: string; // Format: YYYY-MM-DD HH:mm:ss
}

export interface HistoricalDeliveryDetail {
	productId: string;
	quantity: number;
}

export interface HistoricalDelivery {
	id: string;
	warehouseId: string;
	deliveryDate: string | null; // Format: YYYY-MM-DD HH:mm:ss
	arrivedDate: string | null;  // Format: YYYY-MM-DD HH:mm:ss
	notes: string | null;
	status: DeliveryStatus;
	items: HistoricalDeliveryDetail[];
	statusHistory?: DeliveryStatusTracking[];
}

export interface HistoricalDeliveryWithMeta extends HistoricalDelivery {
	warehouseCity?: string;
	warehouseDistanceKm?: number;
	fleetType?: string;
	storageUnit?: string;
}

/**
 * Checks if a delivery status is terminal (CANCELED or DELIVERED).
 * Once terminal, the delivery and its audit trail are permanently locked.
 */
export function isTerminalDeliveryStatus(status: DeliveryStatus): boolean {
	return status === 'CANCELED' || status === 'DELIVERED';
}

/**
 * Checks if a delivery status record can be deleted.
 * Business rules:
 * 1. If the delivery itself is in a terminal status (CANCELED or DELIVERED), status history is locked and cannot be deleted.
 * 2. ON_PROCESS, CANCELED, and DELIVERED records are protected and cannot be deleted.
 * Only intermediate non-terminal statuses (e.g. ON_DELIVERY) are deletable while delivery is active.
 */
export function isDeliveryStatusDeletable(
	status: DeliveryStatus,
	deliveryStatus?: DeliveryStatus
): boolean {
	if (deliveryStatus && isTerminalDeliveryStatus(deliveryStatus)) {
		return false;
	}
	return status !== 'ON_PROCESS' && status !== 'CANCELED' && status !== 'DELIVERED';
}

