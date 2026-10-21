import type { DeliveryStatus } from '#lib/domain/model/HistoricalDelivery.js';

export interface DeliveryItem {
	productId: string;
	quantity: number;
	productName: string;
	category: string;
	storageType: 'AMBIENT' | 'REFRIGERATED';
}

export interface StatusTrackingRecord {
	id: number;
	deliveryId: string;
	status: DeliveryStatus;
	note: string | null;
	createdDate: string;
}

export interface DeliveryRecord {
	id: string;
	warehouseId: string;
	warehouseCity: string;
	warehouseDistanceKm: number;
	storageUnit: string;
	fleetType: string;
	deliveryDate: string | null;
	arrivedDate: string | null;
	notes: string | null;
	status: DeliveryStatus;
	statusHistory?: StatusTrackingRecord[];
	items: DeliveryItem[];
}
