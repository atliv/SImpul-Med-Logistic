<script lang="ts">
	import { formatHumanDateTime } from '#lib/domain/utils/dateFormat.js';
	import type { DeliveryRecord } from './types.js';

	interface Props {
		deliveries: DeliveryRecord[];
		selectedDelivery: DeliveryRecord | null;
		isLoading: boolean;
		isLoadingMore: boolean;
		hasMore: boolean;
		totalRecords: number;
		error: string | null;
		isAccordionOpen: boolean;
		selectedWarehouse: string;
		searchQuery: string;
		onSelectDelivery: (delivery: DeliveryRecord) => void;
		onLoadMore: () => void;
		onFilterChange: (warehouse: string, search: string) => void;
	}

	let {
		deliveries,
		selectedDelivery,
		isLoading,
		isLoadingMore,
		hasMore,
		totalRecords,
		error,
		isAccordionOpen,
		selectedWarehouse,
		searchQuery,
		onSelectDelivery,
		onLoadMore,
		onFilterChange
	}: Props = $props();

	let searchInput = $state('');
	let copiedDeliveryId = $state<string | null>(null);
	let tableContainer = $state<HTMLElement | null>(null);
	let sentinelElement = $state<HTMLElement | null>(null);
	let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

	const warehouseOptions = [
		{ id: 'ALL', label: 'All Warehouse' },
		{ id: 'W01', label: '[W01] Surabaya (5 km)' },
		{ id: 'W02', label: '[W02] Surabaya (12 km)' },
		{ id: 'W03', label: '[W03] Sidoarjo (25 km)' },
		{ id: 'W04', label: '[W04] Gresik (30 km)' },
		{ id: 'W05', label: '[W05] Malang (90 km)' },
		{ id: 'W06', label: '[W06] Malang (95 km)' },
		{ id: 'W07', label: '[W07] Pasuruan (45 km)' },
		{ id: 'W08', label: '[W08] Jember (150 km)' }
	];

	// Keep local input in sync if prop changes externally
	$effect(() => {
		searchInput = searchQuery;
	});

	function handleWarehouseSelect(e: Event) {
		const target = e.target as HTMLSelectElement;
		onFilterChange(target.value, searchInput);
	}

	function handleSearchInput(e: Event) {
		const target = e.target as HTMLInputElement;
		searchInput = target.value;
		if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
		searchDebounceTimer = setTimeout(() => {
			onFilterChange(selectedWarehouse, searchInput);
		}, 250);
	}

	function handleClearSearch() {
		searchInput = '';
		if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
		onFilterChange(selectedWarehouse, '');
	}

	// Scroll event handler with strict stop guard
	function handleScroll() {
		// If there is no more data or already loading, stop request to API completely!
		if (!hasMore || isLoading || isLoadingMore || !tableContainer) return;

		const { scrollTop, scrollHeight, clientHeight } = tableContainer;
		if (scrollHeight - scrollTop - clientHeight < 80) {
			onLoadMore();
		}
	}

	// IntersectionObserver on bottom sentinel with strict stop guard
	$effect(() => {
		if (!hasMore || !sentinelElement) return;

		const observer = new IntersectionObserver(
			(entries) => {
				const entry = entries[0];
				if (entry && entry.isIntersecting && hasMore && !isLoading && !isLoadingMore) {
					onLoadMore();
				}
			},
			{
				root: tableContainer,
				rootMargin: '100px'
			}
		);

		observer.observe(sentinelElement);
		return () => observer.disconnect();
	});

	async function copyDeliveryId(id: string) {
		try {
			await navigator.clipboard.writeText(id);
			copiedDeliveryId = id;
			setTimeout(() => {
				if (copiedDeliveryId === id) copiedDeliveryId = null;
			}, 2000);
		} catch {
			const textarea = document.createElement('textarea');
			textarea.value = id;
			document.body.appendChild(textarea);
			textarea.select();
			document.execCommand('copy');
			document.body.removeChild(textarea);
			copiedDeliveryId = id;
			setTimeout(() => {
				if (copiedDeliveryId === id) copiedDeliveryId = null;
			}, 2000);
		}
	}
</script>

<!-- Filter Controls Bar -->
<div class="px-5 py-2.5 border-b border-zinc-800 bg-zinc-950 flex flex-wrap items-center justify-between gap-3 shrink-0 font-mono">
	<!-- Warehouse Selector Filter -->
	<div class="flex items-center gap-2 flex-1 min-w-[240px] max-w-sm">
		<span class="text-zinc-400 text-xs font-semibold whitespace-nowrap">ORIGIN:</span>
		<select
			value={selectedWarehouse}
			onchange={handleWarehouseSelect}
			class="w-full text-xs bg-zinc-900 text-zinc-200 border border-zinc-700 rounded-none px-2 py-1.5 focus:outline-none focus:border-emerald-500"
		>
			{#each warehouseOptions as opt}
				<option value={opt.id}>{opt.label}</option>
			{/each}
		</select>
	</div>

	<!-- Search Filter Input -->
	<div class="flex items-center gap-2 flex-1 min-w-[220px] max-w-md">
		<span class="text-zinc-400 text-xs font-semibold whitespace-nowrap">FILTER:</span>
		<div class="relative w-full">
			<input
				type="text"
				value={searchInput}
				oninput={handleSearchInput}
				placeholder="Search by ID, status, hub, product, or note..."
				class="w-full text-xs bg-zinc-900 text-zinc-200 placeholder:text-zinc-600 border border-zinc-700 rounded-none px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
			/>
			{#if searchInput.trim() !== ''}
				<button
					type="button"
					onclick={handleClearSearch}
					class="absolute right-2 top-1.5 text-zinc-400 hover:text-zinc-200 text-xs cursor-pointer"
					title="Clear filter"
				>
					✕
				</button>
			{/if}
		</div>
	</div>

	<!-- Status Count Badge with Pagination Telemetry -->
	<div class="flex items-center gap-2 shrink-0">
		<span class="text-zinc-500 text-[11px] whitespace-nowrap font-medium">
			[{deliveries.length} OF {totalRecords} RECORDS]
		</span>
	</div>
</div>

<!-- Section 1: Main History Table with Dedicated Scroll Pagination Container -->
<div
	bind:this={tableContainer}
	onscroll={handleScroll}
	class="flex-1 overflow-x-auto overflow-y-auto max-h-[380px] min-h-[200px]"
>
	{#if isLoading && deliveries.length === 0}
		<div class="py-16 text-center text-zinc-500 font-mono">
			<div class="flex items-center justify-center gap-1.5 text-emerald-400 text-lg mb-2">
				<span class="animate-bounce" style="animation-duration: 0.6s; animation-delay: 0s;">•</span>
				<span class="animate-bounce" style="animation-duration: 0.6s; animation-delay: 0.15s;">•</span>
				<span class="animate-bounce" style="animation-duration: 0.6s; animation-delay: 0.3s;">•</span>
			</div>
			<p class="text-xs">[FETCHING LOGISTICS DATA...]</p>
		</div>
	{:else if error}
		<div class="p-8 text-center text-rose-400 font-mono">
			<p class="font-bold text-xs mb-1">[ERROR: FAILED TO LOAD LOGISTICS HISTORY]</p>
			<p class="text-[11px] text-zinc-400">{error}</p>
		</div>
	{:else if deliveries.length === 0}
		<div class="py-16 text-center text-zinc-500 font-mono">
			<p class="text-xs font-bold text-zinc-300">[NO MATCHING DISPATCH RECORDS FOUND]</p>
			<p class="text-[11px] text-zinc-500 mt-1">Adjust query filter or origin warehouse selector.</p>
		</div>
	{:else}
		<table class="w-full text-left text-xs border-collapse">
			<thead class="bg-zinc-950 text-zinc-400 sticky top-0 border-b border-zinc-800 z-10 font-mono font-semibold select-none shadow-xs">
				<tr>
					<th class="py-2 px-3 whitespace-nowrap border-r border-zinc-800">DELIVERY ID</th>
					<th class="py-2 px-3 whitespace-nowrap border-r border-zinc-800">STATUS</th>
					<th class="py-2 px-3 whitespace-nowrap border-r border-zinc-800">ORIGIN</th>
					<th class="py-2 px-3 whitespace-nowrap border-r border-zinc-800">
						<span class="inline-flex items-center gap-1 text-zinc-200 font-bold">
							<span>DATE</span>
							<span class="text-emerald-400" title="Latest date first">&darr;</span>
						</span>
					</th>
					<th class="py-2 px-3 whitespace-nowrap border-r border-zinc-800">FLEET</th>
					<th class="py-2 px-3 whitespace-nowrap border-r border-zinc-800">MANIFEST ITEMS</th>
					<th class="py-2 px-3 text-right whitespace-nowrap border-r border-zinc-800">UNITS</th>
					<th class="py-2 px-3 text-center whitespace-nowrap">VIEW</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-zinc-800 font-mono">
				{#each deliveries as delivery (delivery.id)}
					{@const isSelected = selectedDelivery?.id === delivery.id}
					{@const totalUnits = delivery.items.reduce((sum, it) => sum + it.quantity, 0)}
					<tr
						onclick={() => onSelectDelivery(delivery)}
						class="cursor-pointer transition-colors {isSelected ? 'bg-zinc-800/80 font-medium border-l-2 border-emerald-500' : 'hover:bg-zinc-800/40'}"
					>
						<!-- Delivery ID with Copy Icon -->
						<td class="py-2 px-3 whitespace-nowrap border-r border-zinc-800/60">
							<div class="flex items-center gap-1.5">
								{#if isSelected}
									<span class="font-bold text-[11px] px-1.5 py-0.2 rounded-none bg-emerald-500 text-zinc-950">
										{delivery.id}
									</span>
								{:else}
									<span class="font-bold text-[11px] px-1.5 py-0.2 rounded-none bg-zinc-800 text-zinc-200 border border-zinc-700">
										{delivery.id}
									</span>
								{/if}

								<button
									type="button"
									onclick={(e) => {
										e.stopPropagation();
										copyDeliveryId(delivery.id);
									}}
									class="p-0.5 rounded-none text-zinc-400 hover:text-emerald-300 hover:bg-zinc-700/60 transition-colors cursor-pointer"
									title="Copy Delivery ID"
									aria-label="Copy Delivery ID {delivery.id}"
								>
									{#if copiedDeliveryId === delivery.id}
										<span class="text-emerald-400 text-[11px] font-bold">✓</span>
									{:else}
										<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
										</svg>
									{/if}
								</button>
							</div>
						</td>

						<!-- Status Column -->
						<td class="py-2 px-3 whitespace-nowrap border-r border-zinc-800/60">
							{#if delivery.status === 'DELIVERED'}
								<span class="px-1.5 py-0.5 rounded-none text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700/70">
									[✓ DELIVERED]
								</span>
							{:else if delivery.status === 'ON_DELIVERY'}
								<span class="px-1.5 py-0.5 rounded-none text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-700/70">
									[⚡ ON_DELIVERY]
								</span>
							{:else if delivery.status === 'CANCELED'}
								<span class="px-1.5 py-0.5 rounded-none text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-700/70">
									[✕ CANCELED]
								</span>
							{:else}
								<span class="px-1.5 py-0.5 rounded-none text-[10px] font-bold bg-sky-950 text-sky-300 border border-sky-700/70">
									[⏳ ON_PROCESS]
								</span>
							{/if}
						</td>

						<!-- Origin Warehouse -->
						<td class="py-2 px-3 whitespace-nowrap border-r border-zinc-800/60">
							<div class="flex items-center gap-1.5">
								<span class="font-semibold text-zinc-100">{delivery.warehouseId}</span>
								<span class="text-zinc-400 font-normal">({delivery.warehouseCity})</span>
								<span class="text-[10px] px-1 py-0.2 rounded-none font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
									{delivery.warehouseDistanceKm}km
								</span>
							</div>
						</td>

						<!-- Date -->
						<td class="py-2 px-3 whitespace-nowrap border-r border-zinc-800/60">
							<div class="flex flex-col">
								<span class="text-xs font-semibold text-zinc-200">
									{formatHumanDateTime(delivery.deliveryDate, 'compact')}
								</span>
								<span class="text-[10px] text-zinc-500">
									{delivery.deliveryDate ?? '—'}
								</span>
							</div>
						</td>

						<!-- Fleet Vehicle -->
						<td class="py-2 px-3 whitespace-nowrap text-[11px] border-r border-zinc-800/60">
							{#if delivery.fleetType === 'REFRIGERATED_VANS'}
								<span class="text-cyan-400 font-medium">❄️ Cold Van</span>
							{:else if delivery.fleetType === 'VAN_WITH_SMALL_REFRIGERATOR'}
								<span class="text-emerald-400 font-medium">🚐 Van + Fridge</span>
							{:else}
								<span class="text-zinc-400">🚚 Normal Cargo</span>
							{/if}
						</td>

						<!-- Supplies Manifest Pills -->
						<td class="py-2 px-3 border-r border-zinc-800/60">
							<div class="flex items-center gap-1 flex-wrap max-w-xs">
								{#each delivery.items as item}
									<span class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded-none border border-zinc-700 bg-zinc-950 text-zinc-300">
										{#if item.storageType === 'REFRIGERATED'}
											<span title="Refrigerated">❄️</span>
										{/if}
										<span class="font-semibold">{item.quantity}x</span>
										<span>{item.productId}</span>
									</span>
								{/each}
							</div>
						</td>

						<!-- Total Units -->
						<td class="py-2 px-3 text-right font-bold text-zinc-100 whitespace-nowrap border-r border-zinc-800/60">
							{totalUnits}
						</td>

						<!-- Detail Indicator -->
						<td class="py-2 px-3 text-center whitespace-nowrap">
							{#if isSelected}
								<span class="inline-flex items-center justify-center w-5 h-5 rounded-none bg-emerald-500 text-zinc-950 font-bold text-xs">
									{isAccordionOpen ? '▼' : '►'}
								</span>
							{:else}
								<span class="inline-flex items-center justify-center w-5 h-5 rounded-none bg-zinc-800 text-zinc-400 border border-zinc-700 text-xs">
									►
								</span>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>

		<!-- Loading Dot-Dot-Dot Animation Indicator -->
		{#if isLoadingMore}
			<div class="flex items-center justify-center gap-2 py-3 px-4 bg-zinc-950 border-t border-zinc-800/80 font-mono text-xs text-emerald-400 select-none">
				<span class="text-zinc-400">[LOADING DATA</span>
				<span class="inline-flex items-center gap-1 font-black text-emerald-400 text-base leading-none">
					<span class="animate-bounce inline-block" style="animation-duration: 0.6s; animation-delay: 0s;">•</span>
					<span class="animate-bounce inline-block" style="animation-duration: 0.6s; animation-delay: 0.18s;">•</span>
					<span class="animate-bounce inline-block" style="animation-duration: 0.6s; animation-delay: 0.36s;">•</span>
				</span>
				<span class="text-zinc-400">]</span>
			</div>
		{:else if !hasMore && deliveries.length > 0}
			<div class="py-2.5 px-4 text-center text-[10px] font-mono text-zinc-500 border-t border-zinc-800/60 bg-zinc-950/70 select-none">
				[END OF DISPATCH ARCHIVE // {deliveries.length} OF {totalRecords} RECORDS LOADED]
			</div>
		{/if}

		<!-- Scroll Sentinel: Only mounted when hasMore is true; unmounted when all data loaded -->
		{#if hasMore}
			<div bind:this={sentinelElement} class="h-1 w-full pointer-events-none"></div>
		{/if}
	{/if}
</div>
