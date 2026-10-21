<script lang="ts">
	import type { Product } from '#lib/domain/model/Product.js';
	import type { Warehouse } from '#lib/domain/model/Warehouse.js';

	interface Props {
		products: readonly Product[];
		warehouses: Warehouse[];
		quantities: Record<string, number>;
		isSubmitting: boolean;
		onSubmitOrder: () => void;
		onClearOrder: () => void;
		onChangeQuantity: (productId: string, val: number) => void;
	}

	let {
		products,
		warehouses,
		quantities,
		isSubmitting,
		onSubmitOrder,
		onClearOrder,
		onChangeQuantity
	}: Props = $props();

	// Calculate network availability for each product
	const availableStock = $derived.by(() => {
		const stock: Record<string, number> = {};
		for (const p of products) {
			stock[p.id] = warehouses.reduce((sum, w) => sum + (w.inventory[p.id] ?? 0), 0);
		}
		return stock;
	});

	// Total items in current order
	const totalItems = $derived.by(() => {
		return Object.values(quantities).reduce((sum, q) => sum + (q || 0), 0);
	});

	const isValidOrder = $derived(totalItems > 0);

	function handleInput(productId: string, event: Event) {
		const target = event.target as HTMLInputElement;
		const val = Math.max(0, parseInt(target.value, 10) || 0);
		onChangeQuantity(productId, val);
	}

	function handleIncrement(productId: string, amount: number) {
		const current = quantities[productId] || 0;
		onChangeQuantity(productId, Math.max(0, current + amount));
	}
</script>

<div class="bg-zinc-900/95 rounded-none border border-zinc-800 p-5 md:p-6 transition-all shadow-xl shadow-black/40">
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-800 pb-4">
		<div>
			<h2 class="text-sm md:text-base font-bold text-zinc-100 flex items-center gap-2 font-mono uppercase tracking-wide">
				<span class="flex items-center justify-center w-5 h-5 rounded-none bg-zinc-800 text-zinc-300 text-xs font-mono font-bold border border-zinc-700">02</span>
				Formulate Hospital Demand
			</h2>
			<p class="text-xs text-zinc-400 mt-0.5 font-mono">
				Surabaya Delivery Point: Specify required quantities for medical supplies and temperature-controlled items.
			</p>
		</div>

		<div class="flex items-center gap-2">
			{#if totalItems > 0}
				<button
					type="button"
					onclick={onClearOrder}
					class="px-2.5 py-1 text-xs font-mono font-bold rounded-none bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition-colors cursor-pointer"
					title="Clear all quantities"
				>
					[CLEAR INPUTS]
				</button>
			{/if}
			<span class="text-xs font-mono font-bold px-2 py-1 rounded-none bg-zinc-950 border border-zinc-700 text-zinc-300">
				TOTAL UNITS: {totalItems}
			</span>
		</div>
	</div>

	<!-- SKU Matrix Form Controls -->
	<div class="mt-5 space-y-3 font-mono">
		{#each products as product (product.id)}
			{@const isColdChain = product.storageType === 'REFRIGERATED'}
			{@const currentQty = quantities[product.id] || 0}
			{@const totalAvailable = availableStock[product.id] || 0}
			{@const isOverstock = currentQty > totalAvailable}

			<div class="p-3.5 rounded-none border transition-colors {currentQty > 0 ? 'bg-zinc-950 border-emerald-500/50' : 'bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700'}">
				<div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
					<!-- Product Header Info -->
					<div class="flex items-start gap-3 min-w-0 flex-1">
						<span class="font-bold text-xs px-2 py-0.5 rounded-none border shrink-0 {isColdChain ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800' : 'bg-zinc-800 text-zinc-300 border-zinc-700'}">
							{product.id}
						</span>
						<div class="min-w-0">
							<div class="flex items-center gap-2 flex-wrap">
								<span class="font-bold text-sm text-zinc-100">{product.name}</span>
								{#if isColdChain}
									<span class="inline-flex items-center gap-1 text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded-none bg-cyan-950 text-cyan-300 border border-cyan-700/60 font-sans">
										❄️ 2–8°C Cold Chain Required
									</span>
								{:else}
									<span class="inline-flex items-center text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded-none bg-zinc-800 text-zinc-400 border border-zinc-700 font-sans">
										Ambient Dry Cargo
									</span>
								{/if}
							</div>
							<div class="flex items-center gap-3 mt-1 text-xs text-zinc-400">
								<span>Available across 8 hubs: <strong class="text-zinc-200">{totalAvailable} units</strong></span>
								{#if isOverstock}
									<span class="text-rose-400 font-bold">⚠ EXCEEDS NETWORK CAPACITY (-{currentQty - totalAvailable})</span>
								{/if}
							</div>
						</div>
					</div>

					<!-- Quantity Increment Controls & Input -->
					<div class="flex items-center gap-1.5 self-end md:self-center shrink-0">
						<button
							type="button"
							onclick={() => handleIncrement(product.id, -10)}
							disabled={currentQty === 0}
							class="w-8 h-8 flex items-center justify-center rounded-none font-bold text-xs bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-700 transition-colors cursor-pointer"
							title="Decrease by 10"
						>
							-10
						</button>
						<button
							type="button"
							onclick={() => handleIncrement(product.id, -1)}
							disabled={currentQty === 0}
							class="w-8 h-8 flex items-center justify-center rounded-none font-bold text-xs bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-700 transition-colors cursor-pointer"
							title="Decrease by 1"
						>
							-1
						</button>

						<input
							type="number"
							min="0"
							step="1"
							value={currentQty}
							oninput={(e) => handleInput(product.id, e)}
							class="w-16 h-8 text-center text-xs font-mono font-bold rounded-none bg-zinc-900 border {isOverstock ? 'border-rose-500 text-rose-300 focus:border-rose-400' : currentQty > 0 ? 'border-emerald-500 text-emerald-300 focus:border-emerald-400' : 'border-zinc-700 text-zinc-300 focus:border-zinc-500'} focus:outline-hidden"
						/>

						<button
							type="button"
							onclick={() => handleIncrement(product.id, 1)}
							class="w-8 h-8 flex items-center justify-center rounded-none font-bold text-xs bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white border border-zinc-700 transition-colors cursor-pointer"
							title="Increase by 1"
						>
							+1
						</button>
						<button
							type="button"
							onclick={() => handleIncrement(product.id, 10)}
							class="w-8 h-8 flex items-center justify-center rounded-none font-bold text-xs bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white border border-zinc-700 transition-colors cursor-pointer"
							title="Increase by 10"
						>
							+10
						</button>
					</div>
				</div>
			</div>
		{/each}
	</div>

	<!-- Submit CTA Bar -->
	<div class="pt-5 mt-4 border-t border-zinc-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
		<div class="text-xs font-mono text-zinc-400">
			{#if !isValidOrder}
				<span class="text-amber-400 font-medium">&gt; ENTER QUANTITY FOR AT LEAST ONE SKU OR SELECT PRESET</span>
			{:else}
				<span class="text-emerald-400 font-medium">&gt; READY: {totalItems} UNITS STAGED FOR LOGISTICS EVALUATION</span>
			{/if}
		</div>

		<div class="flex items-center gap-2.5">
			<button
				type="button"
				onclick={onSubmitOrder}
				disabled={!isValidOrder || isSubmitting}
				class="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-none text-xs md:text-sm font-mono font-bold text-zinc-950 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 border border-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-md shadow-emerald-950/40"
			>
				{#if isSubmitting}
					<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-zinc-950" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
					</svg>
					<span>[EVALUATING ROUTING...]</span>
				{:else}
					<span>[EVALUATE &amp; COMPARE OPTIONS]</span>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
					</svg>
				{/if}
			</button>
		</div>
	</div>
</div>
