import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getWarehouseRepository } from '#lib/infrastructure/repositories/index.js';
import { getProductById } from '#lib/domain/model/Product.js';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const repo = getWarehouseRepository();
		const [warehouses, rawDeliveries] = await Promise.all([
			repo.getAll(),
			repo.getHistoricalDeliveries()
		]);

		const warehouseMap = new Map(warehouses.map((w) => [w.id, w]));

		let deliveries = rawDeliveries.map((delivery) => {
			const wh = warehouseMap.get(delivery.warehouseId);
			const enrichedItems = delivery.items.map((item) => {
				const product = getProductById(item.productId);
				return {
					productId: item.productId,
					quantity: item.quantity,
					productName: product?.name ?? item.productId,
					category: product?.category ?? 'Medical Supplies',
					storageType: product?.storageType ?? 'AMBIENT'
				};
			});

			return {
				id: delivery.id,
				warehouseId: delivery.warehouseId,
				warehouseCity: wh?.city ?? 'Unknown',
				warehouseDistanceKm: wh?.distanceKm ?? 0,
				storageUnit: wh?.storageUnit ?? 'GENERAL',
				fleetType: wh?.fleetType ?? 'STANDARD',
				deliveryDate: delivery.deliveryDate,
				arrivedDate: delivery.arrivedDate,
				notes: delivery.notes,
				status: delivery.status ?? 'ON_PROCESS',
				statusHistory: delivery.statusHistory ?? [],
				items: enrichedItems
			};
		});

		// Sort default order: newer/latest delivery date first (descending)
		deliveries.sort((a, b) => {
			const dateA = a.deliveryDate ?? '';
			const dateB = b.deliveryDate ?? '';
			if (dateB !== dateA) {
				return dateB.localeCompare(dateA);
			}
			return b.id.localeCompare(a.id, undefined, { numeric: true });
		});

		// Optional server-side filtering
		const warehouseFilter = url?.searchParams?.get('warehouse') || url?.searchParams?.get('warehouseId');
		if (warehouseFilter && warehouseFilter !== 'ALL') {
			deliveries = deliveries.filter((d) => d.warehouseId === warehouseFilter);
		}

		const searchQuery = (url?.searchParams?.get('search') || url?.searchParams?.get('q') || '').trim().toLowerCase();
		if (searchQuery.length > 0) {
			deliveries = deliveries.filter(
				(d) =>
					d.id.toLowerCase().includes(searchQuery) ||
					d.status.toLowerCase().includes(searchQuery) ||
					d.warehouseCity.toLowerCase().includes(searchQuery) ||
					(d.deliveryDate && d.deliveryDate.toLowerCase().includes(searchQuery)) ||
					(d.notes && d.notes.toLowerCase().includes(searchQuery)) ||
					d.items.some(
						(i) =>
							i.productId.toLowerCase().includes(searchQuery) ||
							i.productName.toLowerCase().includes(searchQuery)
					)
			);
		}

		const total = deliveries.length;
		const limitParam = url?.searchParams?.get('limit');
		const offsetParam = url?.searchParams?.get('offset');

		// If pagination limit is specified, slice results and include pagination telemetry
		if (limitParam !== null && limitParam !== undefined) {
			const limit = Math.max(1, parseInt(limitParam, 10) || 10);
			const offset = Math.max(0, parseInt(offsetParam || '0', 10) || 0);
			const pageDeliveries = deliveries.slice(offset, offset + limit);
			const hasMore = offset + pageDeliveries.length < total;

			return json(
				{
					deliveries: pageDeliveries,
					total,
					hasMore,
					offset,
					limit
				},
				{
					headers: {
						'Cache-Control': 'no-store, must-revalidate'
					}
				}
			);
		}

		// Backwards-compatible default (when limit query is absent)
		return json(
			{
				deliveries,
				total,
				hasMore: false,
				offset: 0,
				limit: total
			},
			{
				headers: {
					'Cache-Control': 'no-store, must-revalidate'
				}
			}
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to retrieve delivery history.';
		return json({ error: message }, { status: 500 });
	}
};
