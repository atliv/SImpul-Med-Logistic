import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getWarehouseRepository } from '#lib/infrastructure/repositories/index.js';
import { FulfillOrderUseCase } from '#lib/application/use-cases/FulfillOrderUseCase.js';

export const POST: RequestHandler = async ({ request }) => {
	try {
		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return json({ error: 'Invalid JSON request body.' }, { status: 400 });
		}

		if (!body || typeof body !== 'object' || !('items' in body)) {
			return json(
				{ error: 'Missing required field "items". Must provide an array of order items.' },
				{ status: 400 }
			);
		}

		const { items, strategy, commit, deliveryDate } = body as {
			items: unknown;
			strategy?: 'NEAREST_FIRST' | 'CONSOLIDATED_FIRST';
			commit?: boolean;
			deliveryDate?: string;
		};
		if (!Array.isArray(items) || items.length === 0) {
			return json(
				{ error: 'Field "items" must be a non-empty array of { productId, quantity }.' },
				{ status: 400 }
			);
		}

		const repo = getWarehouseRepository();
		const useCase = new FulfillOrderUseCase(repo);
		const result = await useCase.execute({ items, strategy, commit, deliveryDate });

		return json(result, {
			headers: {
				'Cache-Control': 'no-store, must-revalidate'
			}
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Internal fulfillment error occurred.';
		return json({ error: message }, { status: 400 });
	}
};
