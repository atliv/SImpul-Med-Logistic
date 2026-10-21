import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getWarehouseRepository } from '#lib/infrastructure/repositories/index.js';
import { ALL_DELIVERY_STATUSES, type DeliveryStatus } from '#lib/domain/model/HistoricalDelivery.js';

interface AddStatusPayload {
	deliveryId?: string;
	status?: string;
	note?: string;
}

interface DeleteStatusPayload {
	id?: number;
	deliveryId?: string;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		let body: AddStatusPayload;
		try {
			body = await request.json();
		} catch {
			return json({ error: 'Invalid JSON request body.' }, { status: 400 });
		}

		const { deliveryId, status, note } = body;

		if (!deliveryId || typeof deliveryId !== 'string') {
			return json({ error: 'Field "deliveryId" is required.' }, { status: 400 });
		}

		if (!status || !ALL_DELIVERY_STATUSES.includes(status as DeliveryStatus)) {
			return json(
				{
					error: `Field "status" must be one of: ${ALL_DELIVERY_STATUSES.join(', ')}.`
				},
				{ status: 400 }
			);
		}

		const repo = getWarehouseRepository();
		const tracking = await repo.addDeliveryStatus(deliveryId, status as DeliveryStatus, note);
		const warehouses = await repo.getAll();

		return json({
			success: true,
			tracking,
			warehouses
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to add delivery status.';
		return json({ error: message }, { status: 400 });
	}
};

export const DELETE: RequestHandler = async ({ request, url }) => {
	try {
		let id: number | undefined;
		let deliveryId: string | undefined;

		// Support both JSON body and search params
		if (url.searchParams.has('id') && url.searchParams.has('deliveryId')) {
			id = Number(url.searchParams.get('id'));
			deliveryId = url.searchParams.get('deliveryId') || undefined;
		} else {
			try {
				const body: DeleteStatusPayload = await request.json();
				id = body.id !== undefined ? Number(body.id) : undefined;
				deliveryId = body.deliveryId;
			} catch {
				// Body parsing failed or empty
			}
		}

		if (id === undefined || isNaN(id)) {
			return json({ error: 'Valid numeric "id" is required to delete status.' }, { status: 400 });
		}

		if (!deliveryId || typeof deliveryId !== 'string') {
			return json({ error: 'Field "deliveryId" is required to delete status.' }, { status: 400 });
		}

		const repo = getWarehouseRepository();
		await repo.deleteDeliveryStatus(id, deliveryId);

		return json({
			success: true,
			deletedId: id
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to delete delivery status.';
		return json({ error: message }, { status: 400 });
	}
};

interface UpdateStatusNotePayload {
	id?: number;
	deliveryId?: string;
	note?: string | null;
}

export const PATCH: RequestHandler = async ({ request }) => {
	try {
		let body: UpdateStatusNotePayload;
		try {
			body = await request.json();
		} catch {
			return json({ error: 'Invalid JSON request body.' }, { status: 400 });
		}

		const { id, deliveryId, note } = body;

		if (id === undefined || isNaN(Number(id))) {
			return json({ error: 'Valid numeric "id" is required to update status note.' }, { status: 400 });
		}

		if (!deliveryId || typeof deliveryId !== 'string') {
			return json({ error: 'Field "deliveryId" is required to update status note.' }, { status: 400 });
		}

		const repo = getWarehouseRepository();
		const tracking = await repo.updateDeliveryStatusNote(
			Number(id),
			deliveryId,
			note !== undefined && note !== null ? String(note).trim() : null
		);

		return json({
			success: true,
			tracking
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to update delivery status note.';
		return json({ error: message }, { status: 400 });
	}
};

export const PUT: RequestHandler = PATCH;

