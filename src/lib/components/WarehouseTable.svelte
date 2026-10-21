<script lang="ts">
	import type { Warehouse } from '#lib/domain/model/Warehouse.js';
	import { canStoreProduct } from '#lib/domain/model/Warehouse.js';
	import type { Product } from '#lib/domain/model/Product.js';

	interface Props {
		warehouses: Warehouse[];
		products: readonly Product[];
		onUpdateStock?: (warehouseId: string, productId: string, newStock: number) => Promise<void>;
	}

	let { warehouses, products, onUpdateStock }: Props = $props();

	// Calculate network totals per product
	const networkTotals = $derived.by(() => {
		const totals: Record<string, number> = {};
		for (const p of products) {
			totals[p.id] = warehouses.reduce((sum, w) => sum + (w.inventory[p.id] ?? 0), 0);
		}
		return totals;
	});

	// Context menu active state
	interface ActiveMenu {
		warehouse: Warehouse;
		product: Product;
		currentStock: number;
		x: number;
		y: number;
		isCompatible: boolean;
	}

	let activeMenu = $state<ActiveMenu | null>(null);
	let editValue = $state<string>('');
	let inputError = $state<string>('');
	let isSaving = $state(false);
	let inputRef = $state<HTMLInputElement | null>(null);

	function handleOpenContextMenu(warehouse: Warehouse, product: Product, event: MouseEvent) {
		event.preventDefault();
		const target = event.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();

		const menuWidth = 310;
		const menuHeight = 280;
		let x = rect.left - 40;
		let y = rect.bottom + 6;

		// Screen boundary detection
		if (x + menuWidth > window.innerWidth - 16) {
			x = Math.max(16, window.innerWidth - menuWidth - 16);
		}
		if (x < 16) {
			x = 16;
		}

		if (y + menuHeight > window.innerHeight - 16) {
			y = Math.max(16, rect.top - menuHeight - 6);
		}

		const isCompatible = canStoreProduct(warehouse, product.storageType);
		const currentStock = warehouse.inventory[product.id] ?? 0;

		activeMenu = {
			warehouse,
			product,
			currentStock,
			x,
			y,
			isCompatible
		};

		editValue = String(currentStock);
		inputError = '';

		// Automatically focus and select input text after render
		setTimeout(() => {
			if (inputRef) {
				inputRef.focus();
				inputRef.select();
			}
		}, 50);
	}

	function handleCloseContextMenu() {
		if (isSaving) return;
		activeMenu = null;
		inputError = '';
	}

	function handleInputKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			handleCloseContextMenu();
			return;
		}
		// Block non-numeric characters strictly: negative '-', positive '+', scientific 'e', decimals '.', ','
		if (['-', '+', 'e', 'E', '.', ','].includes(e.key)) {
			e.preventDefault();
		}
	}

	function handleInputChange(e: Event) {
		const target = e.target as HTMLInputElement;
		// Strictly accept numeric positive digits only
		const sanitized = target.value.replace(/[^0-9]/g, '');
		editValue = sanitized;
		if (sanitized !== '') {
			inputError = '';
		}
	}

	function handleAdjustValue(delta: number) {
		const current = parseInt(editValue || '0', 10);
		const safeCurrent = isNaN(current) ? 0 : current;
		const next = Math.max(0, safeCurrent + delta);
		editValue = String(next);
		inputError = '';
		if (inputRef) inputRef.focus();
	}

	function handleSetPreset(val: number) {
		editValue = String(Math.max(0, val));
		inputError = '';
		if (inputRef) inputRef.focus();
	}

	async function handleSaveStock(e: Event) {
		e.preventDefault();
		if (!activeMenu) return;

		if (!activeMenu.isCompatible) {
			inputError = `Cannot store refrigerated product in a ${activeMenu.warehouse.storageUnit} warehouse.`;
			return;
		}

		const trimmed = editValue.trim();
		if (trimmed === '') {
			inputError = 'Please enter a numeric positive value.';
			return;
		}

		const parsed = parseInt(trimmed, 10);
		if (isNaN(parsed) || parsed < 0) {
			inputError = 'Value must be a positive integer (0 or greater).';
			return;
		}

		isSaving = true;
		inputError = '';
		try {
			if (onUpdateStock) {
				await onUpdateStock(activeMenu.warehouse.id, activeMenu.product.id, parsed);
			}
			activeMenu = null;
		} catch (err) {
			inputError = err instanceof Error ? err.message : 'Failed to update stock';
		} finally {
			isSaving = false;
		}
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && activeMenu && !isSaving) {
			handleCloseContextMenu();
		}
	}}
/>

<div class="bg-zinc-900/95 rounded-none border border-zinc-800 overflow-hidden shadow-xl shadow-black/40">
	<!-- Panel Header Bar -->
	<div class="p-4 md:p-5 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-zinc-950/70">
		<div>
			<h2 class="text-sm md:text-base font-bold text-zinc-100 flex items-center gap-2 font-mono uppercase tracking-wide">
				<span class="flex items-center justify-center w-5 h-5 rounded-none bg-zinc-800 text-zinc-300 text-xs font-mono font-bold border border-zinc-700">01</span>
				Regional Warehouse Data &amp; Live Stock Matrix
			</h2>
			<p class="text-xs text-zinc-400 mt-0.5 font-mono">
				Live inventory across 8 regional facilities in East Java (click any stock value to edit)
			</p>
		</div>
		<div class="flex items-center gap-2 text-xs font-mono text-zinc-500 self-start sm:self-auto">
			<span>[SORT: PROXIMITY &rarr; SURABAYA]</span>
			<span class="text-emerald-500/80 font-bold">• [CLICK CELL TO EDIT]</span>
		</div>
	</div>

	<div class="overflow-x-auto">
		<table class="w-full text-left text-xs border-collapse">
			<thead>
				<tr class="bg-zinc-950 text-zinc-400 border-b border-zinc-800 font-mono font-semibold">
					<th class="py-2.5 px-3.5 whitespace-nowrap border-r border-zinc-800/80">WAREHOUSE</th>
					<th class="py-2.5 px-3 whitespace-nowrap border-r border-zinc-800/80">DISTANCE</th>
					<th class="py-2.5 px-3 whitespace-nowrap border-r border-zinc-800/80">STORAGE UNIT</th>
					<th class="py-2.5 px-3 whitespace-nowrap border-r border-zinc-800/80">FLEET TYPE</th>
					{#each products as product (product.id)}
						<th class="py-2.5 px-3 text-right whitespace-nowrap font-mono {product.storageType === 'REFRIGERATED' ? 'bg-cyan-950/20 text-cyan-300' : ''}">
							<div class="flex items-center justify-end gap-1">
								<span>{product.id}</span>
								{#if product.storageType === 'REFRIGERATED'}
									<span title="Cold Chain (2-8°C)">❄️</span>
								{/if}
							</div>
							<div class="text-[10px] font-normal text-zinc-500 truncate max-w-[85px]">
								{product.name.split('(')[0].trim()}
							</div>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody class="divide-y divide-zinc-800/80 font-mono">
				{#each warehouses as warehouse (warehouse.id)}
					<tr class="hover:bg-zinc-800/40 transition-colors">
						<td class="py-2 px-3.5 whitespace-nowrap font-medium text-zinc-200 border-r border-zinc-800/60">
							<div class="flex items-center gap-2">
								<span class="inline-block px-1.5 py-0.5 rounded-none font-mono font-bold text-[11px] bg-zinc-800 text-zinc-200 border border-zinc-700">
									{warehouse.id}
								</span>
								<span class="text-zinc-300">{warehouse.city}</span>
							</div>
						</td>
						<td class="py-2 px-3 whitespace-nowrap border-r border-zinc-800/60">
							<span class="inline-flex items-center px-1.5 py-0.2 rounded-none text-[11px] font-mono font-medium {warehouse.distanceKm <= 15 ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : warehouse.distanceKm <= 50 ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30' : 'bg-zinc-800 text-zinc-400 border border-zinc-700/60'}">
								{warehouse.distanceKm} km
							</span>
						</td>
						<td class="py-2 px-3 whitespace-nowrap border-r border-zinc-800/60">
							{#if warehouse.storageUnit === 'MIXED'}
								<span class="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-emerald-300 bg-emerald-950/40 px-1.5 py-0.2 rounded-none border border-emerald-800/60" title="Dual-zone: General ambient & Cold-chain storage">
									<span>📦❄️</span> Mixed
								</span>
							{:else if warehouse.storageUnit === 'REFRIGERATED'}
								<span class="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-cyan-300 bg-cyan-950/40 px-1.5 py-0.2 rounded-none border border-cyan-800/60">
									<span>❄️</span> Cold-Chain
								</span>
							{:else}
								<span class="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-zinc-300 bg-zinc-800/70 px-1.5 py-0.2 rounded-none border border-zinc-700/60">
									<span>📦</span> General
								</span>
							{/if}
						</td>
						<td class="py-2 px-3 whitespace-nowrap text-zinc-400 text-[11px] border-r border-zinc-800/60 font-mono">
							{#if warehouse.fleetType === 'REFRIGERATED_VANS'}
								<span class="inline-flex items-center gap-1 text-cyan-300 font-medium" title="Dedicated Cold-Chain Refrigerated Van">
									<span>❄️🚐</span> Cold Vans
								</span>
							{:else if warehouse.fleetType === 'VAN_WITH_SMALL_REFRIGERATOR'}
								<span class="inline-flex items-center gap-1 text-emerald-300 font-medium" title="Van equipped with Small Refrigerator for Dual Cargo">
									<span>🚐❄️</span> Van + Fridge
								</span>
							{:else}
								<span class="inline-flex items-center gap-1 text-zinc-400" title="Standard Truck with Normal Container">
									<span>🚚</span> Normal
								</span>
							{/if}
						</td>
						{#each products as product (product.id)}
							{@const stock = warehouse.inventory[product.id] ?? 0}
							{@const isCompatible = canStoreProduct(warehouse, product.storageType)}
							<td class="p-0 text-right font-mono text-[11px] {product.storageType === 'REFRIGERATED' ? 'bg-cyan-950/10' : ''}">
								<button
									type="button"
									onclick={(e) => handleOpenContextMenu(warehouse, product, e)}
									oncontextmenu={(e) => handleOpenContextMenu(warehouse, product, e)}
									class="w-full h-full py-2 px-3 text-right font-mono text-[11px] transition-all cursor-pointer group flex items-center justify-end gap-1.5 hover:bg-emerald-500/20 focus:outline-hidden focus:bg-emerald-500/25 {stock === 0 ? 'text-zinc-600' : 'text-zinc-200 hover:text-emerald-300'}"
									title="{isCompatible ? `Click to edit ${warehouse.id} stock for ${product.id}` : `Cannot store ${product.id} (requires refrigeration)`}"
								>
									{#if stock > 0}
										<span class="font-semibold text-zinc-200 group-hover:text-emerald-300 transition-colors">{stock}</span>
									{:else}
										<span class="text-zinc-600 font-light group-hover:text-zinc-400 transition-colors">&mdash;</span>
									{/if}
									<span class="opacity-0 group-hover:opacity-100 text-[10px] text-emerald-400 font-mono transition-opacity select-none shrink-0" aria-hidden="true">
										✎
									</span>
								</button>
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
			<tfoot>
				<tr class="bg-zinc-950 font-mono font-semibold text-zinc-200 border-t-2 border-zinc-800">
					<td colspan="4" class="py-2.5 px-3.5 text-xs text-zinc-400 uppercase tracking-wider border-r border-zinc-800/80">
						TOTAL REGIONAL CAPACITY
					</td>
					{#each products as product (product.id)}
						<td class="py-2.5 px-3 text-right font-mono text-xs text-zinc-100 {product.storageType === 'REFRIGERATED' ? 'bg-cyan-950/40 text-cyan-300 font-bold' : ''}">
							{networkTotals[product.id] ?? 0}
						</td>
					{/each}
				</tr>
			</tfoot>
		</table>
	</div>
</div>

<!-- Stock Value Context Menu Popover -->
{#if activeMenu}
	<!-- Dismissal Backdrop -->
	<div
		class="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px]"
		onclick={handleCloseContextMenu}
		oncontextmenu={(e) => {
			e.preventDefault();
			handleCloseContextMenu();
		}}
		role="presentation"
	></div>

	<!-- Floating Context Menu Window -->
	<div
		role="dialog"
		aria-modal="true"
		aria-label="Edit stock value"
		class="fixed z-50 w-80 rounded-none border border-emerald-500/80 bg-zinc-950 p-4 text-zinc-100 shadow-2xl shadow-black/90 font-mono text-xs animate-in fade-in zoom-in-95 duration-100"
		style="top: {activeMenu.y}px; left: {activeMenu.x}px;"
	>
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-zinc-800 pb-2.5 mb-3">
			<div class="flex items-center gap-2">
				<span class="w-2 h-2 rounded-none bg-emerald-400"></span>
				<span class="font-bold text-xs uppercase text-zinc-100 tracking-wider">
					EDIT STOCK LEVEL
				</span>
			</div>
			<button
				type="button"
				onclick={handleCloseContextMenu}
				disabled={isSaving}
				class="text-zinc-400 hover:text-white text-xs font-bold px-1.5 py-0.5 rounded-none hover:bg-zinc-800 transition-colors cursor-pointer"
				aria-label="Close edit menu"
			>
				[✕]
			</button>
		</div>

		<!-- Facility & Product Info Panel -->
		<div class="bg-zinc-900 border border-zinc-800 p-2.5 mb-3 space-y-1.5 text-[11px]">
			<div class="flex justify-between items-center">
				<span class="text-zinc-500 font-semibold">FACILITY:</span>
				<span class="font-bold text-zinc-200">
					{activeMenu.warehouse.id} ({activeMenu.warehouse.city})
				</span>
			</div>
			<div class="flex justify-between items-center">
				<span class="text-zinc-500 font-semibold">PRODUCT:</span>
				<span class="font-bold text-emerald-300 truncate max-w-[170px]" title="{activeMenu.product.name}">
					{activeMenu.product.id} - {activeMenu.product.name}
				</span>
			</div>
			<div class="flex justify-between items-center border-t border-zinc-800/80 pt-1">
				<span class="text-zinc-500 font-semibold">CURRENT VALUE:</span>
				<span class="font-bold text-zinc-100">
					{activeMenu.currentStock} units
				</span>
			</div>
		</div>

		{#if !activeMenu.isCompatible}
			<!-- Storage Incompatible Warning -->
			<div class="p-3 bg-amber-950/60 border border-amber-800/80 text-amber-200 text-[11px] space-y-2 mb-3">
				<div class="font-bold flex items-center gap-1.5 text-amber-300">
					<span>❄️</span>
					<span>COLD-CHAIN INCOMPATIBLE</span>
				</div>
				<p class="font-sans leading-relaxed text-amber-200/90 text-xs">
					Facility <strong>{activeMenu.warehouse.id}</strong> has <strong>{activeMenu.warehouse.storageUnit}</strong> ambient-only storage. Cold-chain refrigerated items (P002 / P004) cannot be stored here.
				</p>
			</div>

			<div class="flex justify-end pt-1">
				<button
					type="button"
					onclick={handleCloseContextMenu}
					class="px-4 py-1.5 text-xs font-mono font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 cursor-pointer"
				>
					[CLOSE]
				</button>
			</div>
		{:else}
			<!-- Numeric Positive Edit Form -->
			<form onsubmit={handleSaveStock} class="space-y-3">
				<div>
					<div class="flex items-center justify-between mb-1">
						<label for="stock-edit-input" class="text-[10px] uppercase font-bold text-zinc-400">
							NEW STOCK VALUE:
						</label>
						<span class="text-[9px] text-emerald-400/90 font-semibold">[POSITIVE NUMERIC ONLY]</span>
					</div>

					<div class="relative">
						<input
							bind:this={inputRef}
							id="stock-edit-input"
							type="text"
							inputmode="numeric"
							pattern="[0-9]*"
							bind:value={editValue}
							onkeydown={handleInputKeydown}
							oninput={handleInputChange}
							class="w-full bg-zinc-900 border {inputError ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-zinc-700 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400'} px-3 py-1.5 text-sm font-mono text-zinc-100 rounded-none focus:outline-hidden"
							placeholder="0"
						/>
						<span class="absolute right-2.5 top-2 text-[10px] text-zinc-500 select-none font-bold">
							UNITS
						</span>
					</div>

					{#if inputError}
						<p class="text-[10px] text-rose-400 mt-1 font-mono">{inputError}</p>
					{/if}
				</div>

				<!-- Increment / Decrement Stepper Controls -->
				<div class="flex items-center justify-between gap-1 text-[10px]">
					<div class="flex items-center gap-1">
						<button
							type="button"
							onclick={() => handleAdjustValue(-10)}
							class="px-1.5 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 cursor-pointer active:bg-zinc-700"
							title="Decrease by 10"
						>
							-10
						</button>
						<button
							type="button"
							onclick={() => handleAdjustValue(-1)}
							class="px-1.5 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 cursor-pointer active:bg-zinc-700"
							title="Decrease by 1"
						>
							-1
						</button>
					</div>

					<div class="flex items-center gap-1">
						<button
							type="button"
							onclick={() => handleAdjustValue(1)}
							class="px-1.5 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 cursor-pointer active:bg-zinc-700"
							title="Increase by 1"
						>
							+1
						</button>
						<button
							type="button"
							onclick={() => handleAdjustValue(10)}
							class="px-1.5 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 cursor-pointer active:bg-zinc-700"
							title="Increase by 10"
						>
							+10
						</button>
					</div>
				</div>

				<!-- Quick Presets -->
				<div class="flex items-center justify-between gap-1 text-[10px] border-t border-zinc-800/80 pt-2">
					<span class="text-zinc-500 font-semibold">PRESETS:</span>
					<div class="flex items-center gap-1">
						<button
							type="button"
							onclick={() => handleSetPreset(0)}
							class="px-1.5 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 cursor-pointer hover:border-zinc-500"
						>
							0
						</button>
						<button
							type="button"
							onclick={() => handleSetPreset(50)}
							class="px-1.5 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 cursor-pointer hover:border-zinc-500"
						>
							50
						</button>
						<button
							type="button"
							onclick={() => handleSetPreset(100)}
							class="px-1.5 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 cursor-pointer hover:border-zinc-500"
						>
							100
						</button>
						<button
							type="button"
							onclick={() => handleSetPreset(250)}
							class="px-1.5 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 cursor-pointer hover:border-zinc-500"
						>
							250
						</button>
						<button
							type="button"
							onclick={() => handleSetPreset(500)}
							class="px-1.5 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 cursor-pointer hover:border-zinc-500"
						>
							500
						</button>
					</div>
				</div>

				<!-- Action Buttons -->
				<div class="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
					<button
						type="button"
						onclick={handleCloseContextMenu}
						disabled={isSaving}
						class="px-3 py-1.5 text-xs font-mono text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 cursor-pointer disabled:opacity-50"
					>
						[CANCEL]
					</button>
					<button
						type="submit"
						disabled={isSaving}
						class="px-4 py-1.5 text-xs font-mono font-bold text-zinc-950 bg-emerald-500 hover:bg-emerald-400 border border-emerald-400 cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-emerald-950/40"
					>
						{#if isSaving}
							<svg class="w-3.5 h-3.5 animate-spin text-zinc-950" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
							<span>[SAVING...]</span>
						{:else}
							<span>✓ [SAVE]</span>
						{/if}
					</button>
				</div>
			</form>
		{/if}
	</div>
{/if}
