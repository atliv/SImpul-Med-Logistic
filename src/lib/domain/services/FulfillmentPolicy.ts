import type { Order } from '../model/Order.js';
import type {
	FulfillmentPlan,
	FulfillmentCandidate,
	Shipment,
	ShipmentItem,
	UnfulfilledItem
} from '../model/FulfillmentPlan.js';
import type { Warehouse } from '../model/Warehouse.js';
import { cloneWarehouse } from '../model/Warehouse.js';
import { ExplanationBuilder } from './ExplanationBuilder.js';

interface PairCandidate {
	w1: Warehouse;
	w2: Warehouse;
	combinedDistance: number;
	maxDistance: number;
	shipments: Shipment[];
}

/**
 * FulfillmentPolicy executes the core order fulfillment selection algorithm:
 *
 * 1. Checks network-wide inventory availability; flags INSUFFICIENT_STOCK if any SKU cannot be met.
 * 2. Step 1 (Single Warehouse): Identifies facilities capable of 100% order coverage, choosing the nearest.
 * 3. Step 2 (2-Warehouse Combinations): If no single warehouse suffices, evaluates all 28 facility pairs
 *    to find pairs that jointly cover 100% of demand, selecting the pair with the lowest combined distance.
 * 4. Step 3 (Multi-Warehouse Allocation): If no 2-warehouse combo suffices, allocates stock greedily
 *    by distance ascending across the regional network.
 */
export class FulfillmentPolicy {
	/**
	 * Evaluates an order against regional warehouses and returns an optimal FulfillmentPlan.
	 * Pure function: does not mutate warehouse input state.
	 *
	 * Supports two strategies:
	 * - 'NEAREST_FIRST' (default): Prioritizes geographic proximity by fulfilling stock from
	 *   the nearest facility first, then moving to the next nearest if stock is insufficient.
	 * - 'CONSOLIDATED_FIRST': Prioritizes single-facility coverage to minimize package splits,
	 *   falling back to 2-warehouse pairs and greedy allocation.
	 */
	evaluate(order: Order, warehouses: Warehouse[]): FulfillmentPlan {
		if (!order.items || order.items.length === 0) {
			throw new Error('Order must contain at least one item.');
		}

		// Check First: Detect network-wide stock depletion
		const unfulfilledItems = this.checkNetworkDepletion(order, warehouses);
		if (unfulfilledItems.length > 0) {
			const explanation = ExplanationBuilder.build({
				status: 'INSUFFICIENT_STOCK',
				shipments: [],
				unfulfilledItems,
				order,
				warehouses
			});

			return {
				status: 'INSUFFICIENT_STOCK',
				shipments: [],
				explanation,
				unfulfilledItems,
				totalDistanceKm: 0,
				splitCount: 0
			};
		}

		const strategy = order.strategy ?? 'NEAREST_FIRST';

		if (strategy === 'CONSOLIDATED_FIRST') {
			return this.evaluateConsolidatedFirst(order, warehouses);
		}

		return this.evaluateNearestFirst(order, warehouses);
	}

	/**
	 * Nearest-First Strategy: Greedily allocates inventory from the nearest warehouse ascending.
	 * If a single warehouse can fulfill 100% of demand with total travel distance <= greedy split distance
	 * (e.g., W02 alone at 12 km vs W01+W02 split at 17 km), prefers the closer single facility.
	 * If the single facility is farther away than the combined split (e.g. W03 at 25 km vs W01+W02 at 17 km),
	 * prioritizes the nearest facilities first (W01: 200, W02: 50).
	 */
	private evaluateNearestFirst(order: Order, warehouses: Warehouse[]): FulfillmentPlan {
		const greedyPlan = this.evaluateMultiWarehouseGreedy(order, warehouses);

		if (greedyPlan.splitCount <= 1) {
			return greedyPlan;
		}

		const singlePlan = this.evaluateSingleWarehouse(order, warehouses);
		if (singlePlan && singlePlan.totalDistanceKm <= greedyPlan.totalDistanceKm) {
			return singlePlan;
		}

		return greedyPlan;
	}

	/**
	 * Consolidated-First Strategy: Evaluates 100% single facility first, then 2-warehouse pairs,
	 * then multi-warehouse greedy fallback.
	 */
	private evaluateConsolidatedFirst(order: Order, warehouses: Warehouse[]): FulfillmentPlan {
		// Step 1: Evaluate single-warehouse complete coverage (nearest first)
		const singlePlan = this.evaluateSingleWarehouse(order, warehouses);
		if (singlePlan) {
			return singlePlan;
		}

		// Step 2: Evaluate 2-warehouse combinations (min combined distance)
		const pairPlan = this.evaluateTwoWarehouseSplit(order, warehouses);
		if (pairPlan) {
			return pairPlan;
		}

		// Step 3: Fallback to greedy multi-warehouse allocation (3+ warehouses)
		return this.evaluateMultiWarehouseGreedy(order, warehouses);
	}

	/**
	 * Deducts inventory from warehouses according to the shipments in a fulfillment plan.
	 * Returns a new array of updated warehouses without mutating the inputs.
	 * Throws if the plan was INSUFFICIENT_STOCK or if stock drops below zero.
	 */
	static deductInventory(warehouses: Warehouse[], plan: FulfillmentPlan): Warehouse[] {
		if (plan.status === 'INSUFFICIENT_STOCK') {
			throw new Error('Cannot deduct inventory for an unfulfilled plan.');
		}

		const updatedMap = new Map<string, Warehouse>();
		for (const w of warehouses) {
			updatedMap.set(w.id, cloneWarehouse(w));
		}

		for (const shipment of plan.shipments) {
			const wh = updatedMap.get(shipment.warehouseId);
			if (!wh) {
				throw new Error(`Warehouse ${shipment.warehouseId} not found in repository.`);
			}

			for (const item of shipment.items) {
				const currentStock = wh.inventory[item.productId] ?? 0;
				if (currentStock < item.quantity) {
					throw new Error(
						`Insufficient stock in ${wh.id} for product ${item.productId}: requested ${item.quantity}, available ${currentStock}.`
					);
				}
				wh.inventory[item.productId] = currentStock - item.quantity;
			}
		}

		return Array.from(updatedMap.values());
	}

	/**
	 * Helper that evaluates the order and, if fulfilled, returns the plan alongside the updated inventory.
	 */
	execute(
		order: Order,
		warehouses: Warehouse[]
	): { plan: FulfillmentPlan; updatedWarehouses: Warehouse[] } {
		const plan = this.evaluate(order, warehouses);
		if (plan.status === 'INSUFFICIENT_STOCK') {
			return { plan, updatedWarehouses: warehouses.map(cloneWarehouse) };
		}
		const updatedWarehouses = FulfillmentPolicy.deductInventory(warehouses, plan);
		return { plan, updatedWarehouses };
	}

	/**
	 * Inspects all warehouses to verify if total regional network stock can fulfill each order item.
	 */
	private checkNetworkDepletion(order: Order, warehouses: Warehouse[]): UnfulfilledItem[] {
		const unfulfilled: UnfulfilledItem[] = [];

		for (const item of order.items) {
			const totalStock = warehouses.reduce(
				(sum, w) => sum + (w.inventory[item.productId] ?? 0),
				0
			);

			if (totalStock < item.quantity) {
				unfulfilled.push({
					productId: item.productId,
					requestedQuantity: item.quantity,
					availableQuantity: totalStock,
					shortfall: item.quantity - totalStock
				});
			}
		}

		return unfulfilled;
	}

	/**
	 * Step 1: Searches for single facilities holding 100% stock coverage for the order.
	 * Sorts eligible facilities by distance ascending and returns the nearest.
	 */
	private evaluateSingleWarehouse(
		order: Order,
		warehouses: Warehouse[]
	): FulfillmentPlan | null {
		const eligible = warehouses.filter((wh) =>
			order.items.every((item) => (wh.inventory[item.productId] ?? 0) >= item.quantity)
		);

		if (eligible.length === 0) {
			return null;
		}

		// Sort by distance ascending
		eligible.sort((a, b) => a.distanceKm - b.distanceKm);
		const chosen = eligible[0];

		const shipments: Shipment[] = [
			{
				warehouseId: chosen.id,
				warehouseCity: chosen.city,
				distanceKm: chosen.distanceKm,
				fleetType: chosen.fleetType,
				items: order.items.map((i) => ({ productId: i.productId, quantity: i.quantity }))
			}
		];

		const explanation = ExplanationBuilder.build({
			status: 'FULFILLED',
			shipments,
			unfulfilledItems: [],
			order,
			warehouses
		});

		return {
			status: 'FULFILLED',
			shipments,
			explanation,
			unfulfilledItems: [],
			totalDistanceKm: chosen.distanceKm,
			splitCount: 1
		};
	}

	/**
	 * Step 2: Evaluates all 2-warehouse pairs (N=8 -> 28 combinations).
	 * Finds pairs that jointly cover 100% of order items and selects the pair with the lowest combined distance.
	 */
	private evaluateTwoWarehouseSplit(
		order: Order,
		warehouses: Warehouse[]
	): FulfillmentPlan | null {
		const candidates: PairCandidate[] = [];

		for (let i = 0; i < warehouses.length; i++) {
			for (let j = i + 1; j < warehouses.length; j++) {
				const wa = warehouses[i];
				const wb = warehouses[j];

				// Check joint stock coverage
				const canCover = order.items.every((item) => {
					const stockA = wa.inventory[item.productId] ?? 0;
					const stockB = wb.inventory[item.productId] ?? 0;
					return stockA + stockB >= item.quantity;
				});

				if (!canCover) continue;

				// Order wa and wb by distance (closer first)
				const [w1, w2] = wa.distanceKm <= wb.distanceKm ? [wa, wb] : [wb, wa];

				const w1Items: ShipmentItem[] = [];
				const w2Items: ShipmentItem[] = [];

				for (const item of order.items) {
					const avail1 = w1.inventory[item.productId] ?? 0;
					const alloc1 = Math.min(item.quantity, avail1);
					const alloc2 = item.quantity - alloc1;

					if (alloc1 > 0) {
						w1Items.push({ productId: item.productId, quantity: alloc1 });
					}
					if (alloc2 > 0) {
						w2Items.push({ productId: item.productId, quantity: alloc2 });
					}
				}

				const shipments: Shipment[] = [];
				if (w1Items.length > 0) {
					shipments.push({
						warehouseId: w1.id,
						warehouseCity: w1.city,
						distanceKm: w1.distanceKm,
						fleetType: w1.fleetType,
						items: w1Items
					});
				}
				if (w2Items.length > 0) {
					shipments.push({
						warehouseId: w2.id,
						warehouseCity: w2.city,
						distanceKm: w2.distanceKm,
						fleetType: w2.fleetType,
						items: w2Items
					});
				}

				const combinedDistance = shipments.reduce((sum, s) => sum + s.distanceKm, 0);
				const maxDistance = Math.max(...shipments.map((s) => s.distanceKm));

				candidates.push({
					w1,
					w2,
					combinedDistance,
					maxDistance,
					shipments
				});
			}
		}

		if (candidates.length === 0) {
			return null;
		}

		// Sort by combined distance ascending, then by max distance, then by primary warehouse distance
		candidates.sort((a, b) => {
			if (a.combinedDistance !== b.combinedDistance) {
				return a.combinedDistance - b.combinedDistance;
			}
			if (a.maxDistance !== b.maxDistance) {
				return a.maxDistance - b.maxDistance;
			}
			return a.w1.distanceKm - b.w1.distanceKm;
		});

		const best = candidates[0];
		const explanation = ExplanationBuilder.build({
			status: 'SPLIT_SHIPMENT',
			shipments: best.shipments,
			unfulfilledItems: [],
			order,
			warehouses
		});

		return {
			status: 'SPLIT_SHIPMENT',
			shipments: best.shipments,
			explanation,
			unfulfilledItems: [],
			totalDistanceKm: best.combinedDistance,
			splitCount: best.shipments.length
		};
	}

	/**
	 * Step 3: Greedy multi-warehouse allocation across warehouses sorted by distance ascending.
	 * Used when demand exceeds any 2-warehouse combination.
	 */
	private evaluateMultiWarehouseGreedy(
		order: Order,
		warehouses: Warehouse[]
	): FulfillmentPlan {
		const sorted = [...warehouses].sort((a, b) => a.distanceKm - b.distanceKm);

		const remainingNeeded = new Map<string, number>();
		for (const item of order.items) {
			remainingNeeded.set(item.productId, item.quantity);
		}

		const shipments: Shipment[] = [];

		for (const wh of sorted) {
			const itemsAllocated: ShipmentItem[] = [];

			for (const item of order.items) {
				const needed = remainingNeeded.get(item.productId) ?? 0;
				if (needed <= 0) continue;

				const available = wh.inventory[item.productId] ?? 0;
				const alloc = Math.min(needed, available);

				if (alloc > 0) {
					itemsAllocated.push({ productId: item.productId, quantity: alloc });
					remainingNeeded.set(item.productId, needed - alloc);
				}
			}

			if (itemsAllocated.length > 0) {
				shipments.push({
					warehouseId: wh.id,
					warehouseCity: wh.city,
					distanceKm: wh.distanceKm,
					fleetType: wh.fleetType,
					items: itemsAllocated
				});
			}

			const allSatisfied = Array.from(remainingNeeded.values()).every((qty) => qty === 0);
			if (allSatisfied) {
				break;
			}
		}

		const totalDistance = shipments.reduce((sum, s) => sum + s.distanceKm, 0);
		const status = shipments.length === 1 ? 'FULFILLED' : 'SPLIT_SHIPMENT';
		const explanation = ExplanationBuilder.build({
			status,
			shipments,
			unfulfilledItems: [],
			order,
			warehouses
		});

		return {
			status,
			shipments,
			explanation,
			unfulfilledItems: [],
			totalDistanceKm: totalDistance,
			splitCount: shipments.length
		};
	}

	/**
	 * Evaluates candidate fulfillment options for human-in-the-loop comparison.
	 * Returns viable plan options (e.g. Nearest Proximity Split vs Consolidated Single).
	 */
	evaluateCandidates(order: Order, warehouses: Warehouse[]): FulfillmentCandidate[] {
		if (!order.items || order.items.length === 0) {
			return [];
		}

		const unfulfilled = this.checkNetworkDepletion(order, warehouses);
		if (unfulfilled.length > 0) {
			return [];
		}

		const planNearest = this.evaluate({ ...order, strategy: 'NEAREST_FIRST' }, warehouses);
		const planConsolidated = this.evaluate({ ...order, strategy: 'CONSOLIDATED_FIRST' }, warehouses);

		if (this.arePlansIdentical(planNearest, planConsolidated)) {
			const isSingle = planNearest.splitCount === 1;
			return [
				{
					id: 'OPTIMAL_UNIFIED',
					title: isSingle ? 'Single-Warehouse Match' : 'Optimal Multi-Warehouse Split',
					badge: isSingle ? 'Direct Delivery (1 Truck)' : `${planNearest.splitCount}-Facility Optimal Match`,
					strategy: 'NEAREST_FIRST',
					plan: planNearest,
					isRecommended: true,
					pros: [
						isSingle
							? `100% demand covered by ${planNearest.shipments[0].warehouseId} (${planNearest.totalDistanceKm} km)`
							: `Minimum distance across ${planNearest.splitCount} facilities (${planNearest.totalDistanceKm} km total)`,
						'Proximity and shipment count are harmonized'
					],
					cons: []
				}
			];
		}

		return [
			{
				id: 'NEAREST_PROXIMITY_SPLIT',
				title: 'Option A: Proximity Priority (Nearest Split)',
				badge: `Lowest Travel (${planNearest.totalDistanceKm} km)`,
				strategy: 'NEAREST_FIRST',
				plan: planNearest,
				isRecommended: planNearest.totalDistanceKm <= planConsolidated.totalDistanceKm,
				pros: [
					`Shortest total mileage (${planNearest.totalDistanceKm} km vs ${planConsolidated.totalDistanceKm} km)`,
					'Fulfills from local Surabaya facilities before dispatching to outside regencies'
				],
				cons: [
					`Requires ${planNearest.splitCount} separate vehicle dispatches`,
					'Multiple arrival check-ins at customer receiving point'
				]
			},
			{
				id: 'CONSOLIDATED_SINGLE',
				title: 'Option B: Consolidated Priority (Fewer Shipments)',
				badge: planConsolidated.splitCount === 1 ? 'Single Delivery Package' : `${planConsolidated.splitCount}-Facility Consolidated`,
				strategy: 'CONSOLIDATED_FIRST',
				plan: planConsolidated,
				isRecommended: planConsolidated.totalDistanceKm < planNearest.totalDistanceKm,
				pros: [
					`Fewer package shipments (${planConsolidated.splitCount} vs ${planNearest.splitCount})`,
					'Reduced dock handling and paperwork overhead'
				],
				cons: [
					`Longer transit distance (${planConsolidated.totalDistanceKm} km vs ${planNearest.totalDistanceKm} km)`,
					`Dispatched from ${planConsolidated.shipments[0].warehouseCity} instead of closer local facilities`
				]
			}
		];
	}

	private arePlansIdentical(p1: FulfillmentPlan, p2: FulfillmentPlan): boolean {
		if (p1.status !== p2.status) return false;
		if (p1.splitCount !== p2.splitCount) return false;
		if (p1.totalDistanceKm !== p2.totalDistanceKm) return false;
		if (p1.shipments.length !== p2.shipments.length) return false;

		for (let i = 0; i < p1.shipments.length; i++) {
			const s1 = p1.shipments[i];
			const s2 = p2.shipments[i];
			if (s1.warehouseId !== s2.warehouseId) return false;
			if (s1.items.length !== s2.items.length) return false;
			for (let j = 0; j < s1.items.length; j++) {
				if (s1.items[j].productId !== s2.items[j].productId) return false;
				if (s1.items[j].quantity !== s2.items[j].quantity) return false;
			}
		}

		return true;
	}
}
