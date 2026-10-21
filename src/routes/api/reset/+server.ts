import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getWarehouseRepository } from '#lib/infrastructure/repositories/index.js';
import { ResetDefaultDataUseCase } from '#lib/application/use-cases/ResetDefaultDataUseCase.js';

export const POST: RequestHandler = async () => {
	try {
		const repo = getWarehouseRepository();
		const useCase = new ResetDefaultDataUseCase(repo);
		const result = await useCase.execute();

		return json(result, {
			headers: {
				'Cache-Control': 'no-store, must-revalidate'
			}
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to reset warehouse inventory.';
		return json({ error: message }, { status: 500 });
	}
};
