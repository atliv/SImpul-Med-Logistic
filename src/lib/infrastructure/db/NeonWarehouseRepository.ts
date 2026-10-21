import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import type { IWarehouseRepository } from '../../domain/repositories/IWarehouseRepository.js';
import type { Warehouse, StorageUnit, FleetType, InventoryMap } from '../../domain/model/Warehouse.js';
import type {
	HistoricalDelivery,
	HistoricalDeliveryDetail,
	DeliveryStatus,
	DeliveryStatusTracking
} from '../../domain/model/HistoricalDelivery.js';
import {
	isTerminalDeliveryStatus,
	isDeliveryStatusDeletable
} from '../../domain/model/HistoricalDelivery.js';
import { BASELINE_WAREHOUSES } from '../../domain/data/baseline.js';
import { BASELINE_HISTORICAL_DELIVERIES } from '../../domain/data/baselineDeliveries.js';
import { PRODUCTS } from '../../domain/model/Product.js';

interface WarehouseRow {
	id: string;
	name: string;
	city: string;
	distance_km: string | number;
	storage_unit: string;
	fleet_type: string;
}

interface InventoryRow {
	warehouse_id: string;
	product_id: string;
	quantity: number;
}

interface DeliveryRow {
	id: string;
	warehouse_id: string;
	delivery_date: string | null;
	arrived_date: string | null;
	notes: string | null;
	status: string;
}

interface DeliveryDetailRow {
	id: string;
	delivery_id: string;
	product_id: string;
	quantity: number;
}

interface DeliveryStatusRow {
	id: number;
	delivery_id: string;
	status: string;
	note: string | null;
	created_date: string;
}

/**
 * NeonWarehouseRepository: Serverless PostgreSQL repository powered by @neondatabase/serverless.
 * Used in production on Vercel with automatic table bootstrapping and transactional resets.
 */
export class NeonWarehouseRepository implements IWarehouseRepository {
	private sql: NeonQueryFunction<false, false>;
	private initialized = false;

	constructor(databaseUrl: string) {
		this.sql = neon(databaseUrl);
	}

	/**
	 * Runs database schema migrations and baseline data seeding directly.
	 */
	public async migrate(): Promise<void> {
		await this.ensureInitialized();
	}

	/**
	 * Ensures schema and initial seed data exist before queries execute.
	 */
	private async ensureInitialized(): Promise<void> {
		if (this.initialized) return;

		// 1. Create tables if they do not exist
		await this.sql`
			CREATE TABLE IF NOT EXISTS products (
				id VARCHAR(10) PRIMARY KEY,
				name VARCHAR(255) NOT NULL,
				category VARCHAR(100) NOT NULL,
				storage_type VARCHAR(50) NOT NULL
			);
		`;

		await this.sql`
			CREATE TABLE IF NOT EXISTS warehouses (
				id VARCHAR(10) PRIMARY KEY,
				name VARCHAR(100) NOT NULL,
				city VARCHAR(100) NOT NULL,
				distance_km NUMERIC(6, 2) NOT NULL,
				storage_unit VARCHAR(50) NOT NULL,
				fleet_type VARCHAR(50) NOT NULL
			);
		`;

		await this.sql`
			CREATE TABLE IF NOT EXISTS warehouse_inventory (
				warehouse_id VARCHAR(10) REFERENCES warehouses(id) ON DELETE CASCADE,
				product_id VARCHAR(10) REFERENCES products(id) ON DELETE CASCADE,
				quantity INT NOT NULL CHECK (quantity >= 0),
				PRIMARY KEY (warehouse_id, product_id)
			);
		`;

		await this.sql`
			CREATE TABLE IF NOT EXISTS historical_delivery (
				id VARCHAR(50) PRIMARY KEY,
				warehouse_id VARCHAR(10) REFERENCES warehouses(id) ON DELETE CASCADE,
				delivery_date TIMESTAMP,
				arrived_date TIMESTAMP,
				notes TEXT,
				status VARCHAR(30) NOT NULL DEFAULT 'ON_PROCESS'
			);
		`;

		// Ensure existing tables created with VARCHAR are migrated to TIMESTAMP and have status column
		await this.sql`
			DO $$
			BEGIN
				IF EXISTS (
					SELECT 1 FROM information_schema.columns 
					WHERE table_name = 'historical_delivery' 
					  AND column_name = 'delivery_date' 
					  AND data_type = 'character varying'
				) THEN
					ALTER TABLE historical_delivery 
						ALTER COLUMN delivery_date TYPE TIMESTAMP USING delivery_date::timestamp,
						ALTER COLUMN arrived_date TYPE TIMESTAMP USING arrived_date::timestamp;
				END IF;

				IF NOT EXISTS (
					SELECT 1 FROM information_schema.columns
					WHERE table_name = 'historical_delivery'
					  AND column_name = 'status'
				) THEN
					ALTER TABLE historical_delivery ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'ON_PROCESS';
				END IF;
			END $$;
		`;

		await this.sql`
			CREATE TABLE IF NOT EXISTS historical_delivery_detail (
				id VARCHAR(50) PRIMARY KEY,
				delivery_id VARCHAR(50) REFERENCES historical_delivery(id) ON DELETE CASCADE,
				product_id VARCHAR(10) REFERENCES products(id) ON DELETE CASCADE,
				quantity INT NOT NULL CHECK (quantity > 0)
			);
		`;

		// Delivery Status Tracking table
		await this.sql`
			CREATE TABLE IF NOT EXISTS historical_delivery_status (
				id SERIAL PRIMARY KEY,
				delivery_id VARCHAR(50) NOT NULL REFERENCES historical_delivery(id) ON DELETE CASCADE,
				status VARCHAR(30) NOT NULL DEFAULT 'ON_PROCESS',
				note TEXT,
				created_date TIMESTAMP NOT NULL DEFAULT NOW()
			);
		`;

		await this.sql`
			CREATE UNIQUE INDEX IF NOT EXISTS idx_historical_delivery_status_unique 
			ON historical_delivery_status (delivery_id, status);
		`;

		// 2. Check if warehouses are populated
		const countResult = await this.sql`SELECT count(*)::int as count FROM warehouses;`;
		const count = (countResult[0] as { count: number })?.count ?? 0;

		if (count === 0) {
			// Seed products
			for (const p of PRODUCTS) {
				await this.sql`
					INSERT INTO products (id, name, category, storage_type)
					VALUES (${p.id}, ${p.name}, ${p.category}, ${p.storageType})
					ON CONFLICT (id) DO NOTHING;
				`;
			}

			// Seed warehouses
			for (const w of BASELINE_WAREHOUSES) {
				await this.sql`
					INSERT INTO warehouses (id, name, city, distance_km, storage_unit, fleet_type)
					VALUES (${w.id}, ${w.city + ' Facility'}, ${w.city}, ${w.distanceKm}, ${w.storageUnit}, ${w.fleetType})
					ON CONFLICT (id) DO NOTHING;
				`;

				// Seed inventory
				for (const [prodId, qty] of Object.entries(w.inventory)) {
					await this.sql`
						INSERT INTO warehouse_inventory (warehouse_id, product_id, quantity)
						VALUES (${w.id}, ${prodId}, ${qty})
						ON CONFLICT (warehouse_id, product_id) DO NOTHING;
					`;
				}
			}
		}

		// 3. Check if historical deliveries are populated
		const deliveryCountResult = await this.sql`SELECT count(*)::int as count FROM historical_delivery;`;
		const deliveryCount = (deliveryCountResult[0] as { count: number })?.count ?? 0;

		if (deliveryCount === 0) {
			for (const d of BASELINE_HISTORICAL_DELIVERIES) {
				await this.sql`
					INSERT INTO historical_delivery (id, warehouse_id, delivery_date, arrived_date, notes, status)
					VALUES (${d.id}, ${d.warehouseId}, ${d.deliveryDate}, ${d.arrivedDate}, ${d.notes}, 'ON_PROCESS')
					ON CONFLICT (id) DO NOTHING;
				`;

				// Insert initial ON_PROCESS status for baseline deliveries
				await this.sql`
					INSERT INTO historical_delivery_status (delivery_id, status, note, created_date)
					VALUES (${d.id}, 'ON_PROCESS', ${d.notes}, COALESCE(${d.deliveryDate}::timestamp, NOW()))
					ON CONFLICT (delivery_id, status) DO NOTHING;
				`;

				for (const item of d.items) {
					const detailId = `${d.id}-${item.productId}`;
					await this.sql`
						INSERT INTO historical_delivery_detail (id, delivery_id, product_id, quantity)
						VALUES (${detailId}, ${d.id}, ${item.productId}, ${item.quantity})
						ON CONFLICT (id) DO NOTHING;
					`;
				}
			}
		} else {
			// Backfill initial ON_PROCESS status for any existing deliveries that don't have tracking records yet
			await this.sql`
				INSERT INTO historical_delivery_status (delivery_id, status, note, created_date)
				SELECT id, COALESCE(status, 'ON_PROCESS'), notes, COALESCE(delivery_date, NOW())
				FROM historical_delivery hd
				WHERE NOT EXISTS (
					SELECT 1 FROM historical_delivery_status s WHERE s.delivery_id = hd.id
				)
				ON CONFLICT (delivery_id, status) DO NOTHING;
			`;
		}

		this.initialized = true;
	}

	async getAll(): Promise<Warehouse[]> {
		await this.ensureInitialized();

		const [warehouseRowsRaw, inventoryRowsRaw] = await Promise.all([
			this.sql`SELECT id, name, city, distance_km, storage_unit, fleet_type FROM warehouses ORDER BY distance_km ASC;`,
			this.sql`SELECT warehouse_id, product_id, quantity FROM warehouse_inventory;`
		]);

		const warehouseRows = warehouseRowsRaw as unknown as WarehouseRow[];
		const inventoryRows = inventoryRowsRaw as unknown as InventoryRow[];

		// Group inventory by warehouse_id
		const invMap = new Map<string, InventoryMap>();
		for (const inv of inventoryRows) {
			if (!invMap.has(inv.warehouse_id)) {
				invMap.set(inv.warehouse_id, {});
			}
			invMap.get(inv.warehouse_id)![inv.product_id] = Number(inv.quantity);
		}

		return warehouseRows.map((row) => ({
			id: row.id,
			city: row.city,
			distanceKm: Number(row.distance_km),
			storageUnit: row.storage_unit as StorageUnit,
			fleetType: row.fleet_type as FleetType,
			inventory: invMap.get(row.id) ?? {}
		}));
	}

	async getById(id: string): Promise<Warehouse | null> {
		const all = await this.getAll();
		return all.find((w) => w.id === id) ?? null;
	}

	async updateWarehouses(warehouses: Warehouse[]): Promise<void> {
		await this.ensureInitialized();

		for (const w of warehouses) {
			for (const [prodId, qty] of Object.entries(w.inventory)) {
				await this.sql`
					INSERT INTO warehouse_inventory (warehouse_id, product_id, quantity)
					VALUES (${w.id}, ${prodId}, ${qty})
					ON CONFLICT (warehouse_id, product_id)
					DO UPDATE SET quantity = ${qty};
				`;
			}
		}
	}

	async resetToBaseline(): Promise<Warehouse[]> {
		await this.ensureInitialized();

		// Wipe current inventory
		await this.sql`DELETE FROM warehouse_inventory;`;

		// Re-seed baseline inventory
		for (const w of BASELINE_WAREHOUSES) {
			for (const [prodId, qty] of Object.entries(w.inventory)) {
				await this.sql`
					INSERT INTO warehouse_inventory (warehouse_id, product_id, quantity)
					VALUES (${w.id}, ${prodId}, ${qty});
				`;
			}
		}

		// Wipe and re-seed historical delivery and statuses
		await this.sql`DELETE FROM historical_delivery_status;`;
		await this.sql`DELETE FROM historical_delivery;`;
		for (const d of BASELINE_HISTORICAL_DELIVERIES) {
			await this.sql`
				INSERT INTO historical_delivery (id, warehouse_id, delivery_date, arrived_date, notes, status)
				VALUES (${d.id}, ${d.warehouseId}, ${d.deliveryDate}, ${d.arrivedDate}, ${d.notes}, 'ON_PROCESS');
			`;
			await this.sql`
				INSERT INTO historical_delivery_status (delivery_id, status, note, created_date)
				VALUES (${d.id}, 'ON_PROCESS', ${d.notes}, COALESCE(${d.deliveryDate}::timestamp, NOW()));
			`;
			for (const item of d.items) {
				const detailId = `${d.id}-${item.productId}`;
				await this.sql`
					INSERT INTO historical_delivery_detail (id, delivery_id, product_id, quantity)
					VALUES (${detailId}, ${d.id}, ${item.productId}, ${item.quantity});
				`;
			}
		}

		return this.getAll();
	}

	async getHistoricalDeliveries(): Promise<HistoricalDelivery[]> {
		await this.ensureInitialized();

		const [deliveryRowsRaw, detailRowsRaw, statusRowsRaw] = await Promise.all([
			this.sql`SELECT id, warehouse_id, TO_CHAR(delivery_date, 'YYYY-MM-DD HH24:MI:SS') AS delivery_date, TO_CHAR(arrived_date, 'YYYY-MM-DD HH24:MI:SS') AS arrived_date, notes, COALESCE(status, 'ON_PROCESS') AS status FROM historical_delivery ORDER BY id DESC;`,
			this.sql`SELECT id, delivery_id, product_id, quantity FROM historical_delivery_detail;`,
			this.sql`SELECT id, delivery_id, status, note, TO_CHAR(created_date, 'YYYY-MM-DD HH24:MI:SS') AS created_date FROM historical_delivery_status ORDER BY id DESC;`
		]);

		const deliveryRows = deliveryRowsRaw as unknown as DeliveryRow[];
		const detailRows = detailRowsRaw as unknown as DeliveryDetailRow[];
		const statusRows = statusRowsRaw as unknown as DeliveryStatusRow[];

		const detailsMap = new Map<string, HistoricalDeliveryDetail[]>();
		for (const detail of detailRows) {
			if (!detailsMap.has(detail.delivery_id)) {
				detailsMap.set(detail.delivery_id, []);
			}
			detailsMap.get(detail.delivery_id)!.push({
				productId: detail.product_id,
				quantity: Number(detail.quantity)
			});
		}

		const statusesMap = new Map<string, DeliveryStatusTracking[]>();
		for (const s of statusRows) {
			if (!statusesMap.has(s.delivery_id)) {
				statusesMap.set(s.delivery_id, []);
			}
			statusesMap.get(s.delivery_id)!.push({
				id: Number(s.id),
				deliveryId: s.delivery_id,
				status: s.status as DeliveryStatus,
				note: s.note ?? null,
				createdDate: s.created_date
			});
		}

		return deliveryRows.map((row) => {
			const history = statusesMap.get(row.id) ?? [];
			const currentStatus = (history.length > 0 ? history[0].status : (row.status || 'ON_PROCESS')) as DeliveryStatus;

			return {
				id: row.id,
				warehouseId: row.warehouse_id,
				deliveryDate: row.delivery_date ?? null,
				arrivedDate: row.arrived_date ?? null,
				notes: row.notes ?? null,
				status: currentStatus,
				statusHistory: history,
				items: detailsMap.get(row.id) ?? []
			};
		});
	}

	async recordDelivery(delivery: HistoricalDelivery): Promise<void> {
		await this.ensureInitialized();

		const statusVal = delivery.status ?? 'ON_PROCESS';

		await this.sql`
			INSERT INTO historical_delivery (id, warehouse_id, delivery_date, arrived_date, notes, status)
			VALUES (${delivery.id}, ${delivery.warehouseId}, ${delivery.deliveryDate}, ${delivery.arrivedDate}, ${delivery.notes}, ${statusVal})
			ON CONFLICT (id) DO UPDATE SET
				delivery_date = EXCLUDED.delivery_date,
				arrived_date = EXCLUDED.arrived_date,
				notes = EXCLUDED.notes,
				status = EXCLUDED.status;
		`;

		// ON_PROCESS status data always created after history data created and cannot be deleted
		await this.sql`
			INSERT INTO historical_delivery_status (delivery_id, status, note, created_date)
			VALUES (${delivery.id}, 'ON_PROCESS', ${delivery.notes}, COALESCE(${delivery.deliveryDate}::timestamp, NOW()))
			ON CONFLICT (delivery_id, status) DO NOTHING;
		`;

		for (const item of delivery.items) {
			const detailId = `${delivery.id}-${item.productId}`;
			await this.sql`
				INSERT INTO historical_delivery_detail (id, delivery_id, product_id, quantity)
				VALUES (${detailId}, ${delivery.id}, ${item.productId}, ${item.quantity})
				ON CONFLICT (id) DO UPDATE SET quantity = EXCLUDED.quantity;
			`;
		}
	}

	async addDeliveryStatus(
		deliveryId: string,
		status: DeliveryStatus,
		note?: string | null
	): Promise<DeliveryStatusTracking> {
		await this.ensureInitialized();

		// 1. Verify delivery exists and check if currently in terminal state
		const deliveryRes = await this.sql`
			SELECT id, warehouse_id, status FROM historical_delivery WHERE id = ${deliveryId} LIMIT 1;
		`;
		if (deliveryRes.length === 0) {
			throw new Error(`Delivery not found: ${deliveryId}`);
		}

		const currentStatus = (deliveryRes[0] as { status: DeliveryStatus }).status;
		if (isTerminalDeliveryStatus(currentStatus)) {
			throw new Error(
				`Cannot add status. Delivery ${deliveryId} is already in terminal state [${currentStatus}].`
			);
		}

		// 2. Ensure status is unique for this delivery
		const existing = await this.sql`
			SELECT id FROM historical_delivery_status
			WHERE delivery_id = ${deliveryId} AND status = ${status}
			LIMIT 1;
		`;
		if (existing.length > 0) {
			throw new Error(
				`Status [${status}] already exists for delivery ${deliveryId}. Duplicate statuses are not permitted.`
			);
		}

		// 3. Insert new status record
		const noteVal = note ? note.trim() : null;
		const inserted = await this.sql`
			INSERT INTO historical_delivery_status (delivery_id, status, note, created_date)
			VALUES (${deliveryId}, ${status}, ${noteVal}, NOW())
			RETURNING id, delivery_id, status, note, TO_CHAR(created_date, 'YYYY-MM-DD HH24:MI:SS') AS created_date;
		`;

		// 4. Update parent delivery's status and arrived_date if DELIVERED
		if (status === 'DELIVERED') {
			await this.sql`
				UPDATE historical_delivery
				SET status = ${status}, arrived_date = COALESCE(arrived_date, NOW())
				WHERE id = ${deliveryId};
			`;
		} else {
			await this.sql`
				UPDATE historical_delivery
				SET status = ${status}
				WHERE id = ${deliveryId};
			`;
		}

		// 5. If delivery transitioned to CANCELED, revert the dispatched items back to origin warehouse inventory
		if (status === 'CANCELED') {
			const originWarehouseId = (deliveryRes[0] as { warehouse_id: string }).warehouse_id;
			const itemsRes = await this.sql`
				SELECT product_id, quantity FROM historical_delivery_detail WHERE delivery_id = ${deliveryId};
			`;
			for (const item of itemsRes) {
				const prodId = item.product_id as string;
				const qty = Number(item.quantity);
				await this.sql`
					INSERT INTO warehouse_inventory (warehouse_id, product_id, quantity)
					VALUES (${originWarehouseId}, ${prodId}, ${qty})
					ON CONFLICT (warehouse_id, product_id)
					DO UPDATE SET quantity = warehouse_inventory.quantity + EXCLUDED.quantity;
				`;
			}
		}

		const row = inserted[0] as unknown as DeliveryStatusRow;
		return {
			id: Number(row.id),
			deliveryId: row.delivery_id,
			status: row.status as DeliveryStatus,
			note: row.note ?? null,
			createdDate: row.created_date
		};
	}

	async deleteDeliveryStatus(id: number, deliveryId: string): Promise<boolean> {
		await this.ensureInitialized();

		// 1. Verify delivery status
		const deliveryRes = await this.sql`
			SELECT status FROM historical_delivery WHERE id = ${deliveryId} LIMIT 1;
		`;
		if (deliveryRes.length === 0) {
			throw new Error(`Delivery not found: ${deliveryId}`);
		}

		const deliveryStatus = (deliveryRes[0] as { status: DeliveryStatus }).status;
		if (isTerminalDeliveryStatus(deliveryStatus)) {
			throw new Error(
				`Cannot delete status history. Delivery ${deliveryId} is in terminal state [${deliveryStatus}] and history is permanently locked.`
			);
		}

		// 2. Find the tracking row
		const existing = await this.sql`
			SELECT id, delivery_id, status FROM historical_delivery_status
			WHERE id = ${id} AND delivery_id = ${deliveryId}
			LIMIT 1;
		`;
		if (existing.length === 0) {
			throw new Error(`Delivery status tracking record not found: ID ${id} for delivery ${deliveryId}`);
		}

		const status = (existing[0] as { status: DeliveryStatus }).status;
		if (!isDeliveryStatusDeletable(status, deliveryStatus)) {
			throw new Error(
				`Status [${status}] cannot be deleted. ON_PROCESS, CANCELED, and DELIVERED are protected.`
			);
		}

		// 3. Delete the row
		await this.sql`DELETE FROM historical_delivery_status WHERE id = ${id};`;

		// 4. Recalculate latest remaining status
		const latestRes = await this.sql`
			SELECT status FROM historical_delivery_status
			WHERE delivery_id = ${deliveryId}
			ORDER BY id DESC
			LIMIT 1;
		`;

		if (latestRes.length > 0) {
			const latestStatus = (latestRes[0] as { status: string }).status;
			await this.sql`
				UPDATE historical_delivery
				SET status = ${latestStatus}
				WHERE id = ${deliveryId};
			`;
		}

		return true;
	}

	async updateDeliveryStatusNote(
		id: number,
		deliveryId: string,
		note: string | null
	): Promise<DeliveryStatusTracking> {
		await this.ensureInitialized();

		// 1. Check delivery existence and terminal state
		const deliveryRes = await this.sql`
			SELECT status FROM historical_delivery WHERE id = ${deliveryId} LIMIT 1;
		`;
		if (deliveryRes.length === 0) {
			throw new Error(`Delivery not found: ${deliveryId}`);
		}

		const deliveryStatus = (deliveryRes[0] as { status: DeliveryStatus }).status;
		if (isTerminalDeliveryStatus(deliveryStatus)) {
			throw new Error(
				`Cannot update note. Delivery ${deliveryId} is in terminal state [${deliveryStatus}] and locked.`
			);
		}

		// 2. Check tracking record existence and status
		const existing = await this.sql`
			SELECT id, delivery_id, status FROM historical_delivery_status
			WHERE id = ${id} AND delivery_id = ${deliveryId}
			LIMIT 1;
		`;
		if (existing.length === 0) {
			throw new Error(`Delivery status tracking record not found: ID ${id} for delivery ${deliveryId}`);
		}

		const trackingRow = existing[0] as { id: number; delivery_id: string; status: DeliveryStatus };
		if (isTerminalDeliveryStatus(trackingRow.status)) {
			throw new Error(
				`Cannot update note. Status [${trackingRow.status}] is a terminal record and cannot be edited.`
			);
		}

		const trimmedNote = note && note.trim().length > 0 ? note.trim() : null;

		const updatedRes = await this.sql`
			UPDATE historical_delivery_status
			SET note = ${trimmedNote}
			WHERE id = ${id} AND delivery_id = ${deliveryId}
			RETURNING id, delivery_id, status, note, TO_CHAR(created_date, 'YYYY-MM-DD HH24:MI:SS') AS created_date;
		`;

		const row = updatedRes[0] as {
			id: number;
			delivery_id: string;
			status: string;
			note: string | null;
			created_date: string;
		};

		return {
			id: row.id,
			deliveryId: row.delivery_id,
			status: row.status as DeliveryStatus,
			note: row.note ?? null,
			createdDate: row.created_date
		};
	}
}

