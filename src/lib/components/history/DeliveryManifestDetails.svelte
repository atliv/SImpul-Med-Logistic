<script lang="ts">
	import { formatHumanDateTime } from '#lib/domain/utils/dateFormat.js';
	import type { DeliveryRecord } from './types.js';

	interface Props {
		delivery: DeliveryRecord;
	}

	let { delivery }: Props = $props();
</script>

<!-- Detail Cards Grid -->
<div class="grid grid-cols-1 md:grid-cols-3 gap-3">
	<!-- Column 1: Facility & Fleet Profile -->
	<div class="rounded-none border border-zinc-800 bg-zinc-950 p-3.5 space-y-2 text-xs font-mono">
		<div class="font-bold uppercase text-[10px] tracking-wider text-emerald-400 flex items-center gap-1.5">
			<span>🏢</span> FACILITY &amp; FLEET PROFILE
		</div>
		<div class="space-y-1.5 pt-1 text-zinc-300">
			<div class="flex items-center justify-between">
				<span class="text-zinc-500">WAREHOUSE:</span>
				<span class="font-bold text-zinc-100">{delivery.warehouseId} ({delivery.warehouseCity})</span>
			</div>
			<div class="flex items-center justify-between">
				<span class="text-zinc-500">DISTANCE TO HUB:</span>
				<span class="font-semibold text-zinc-200">{delivery.warehouseDistanceKm} km</span>
			</div>
			<div class="flex items-center justify-between">
				<span class="text-zinc-500">STORAGE TYPE:</span>
				<span class="font-medium text-zinc-200">
					{#if delivery.storageUnit === 'MIXED'}
						<span>📦❄️ Mixed (Dual-Zone)</span>
					{:else if delivery.storageUnit === 'REFRIGERATED'}
						<span>❄️ Refrigerated</span>
					{:else}
						<span>📦 General Ambient</span>
					{/if}
				</span>
			</div>
			<div class="flex items-center justify-between">
				<span class="text-zinc-500">VEHICLE CLASS:</span>
				<span class="font-semibold text-zinc-100">
					{#if delivery.fleetType === 'REFRIGERATED_VANS'}
						<span class="text-cyan-400">❄️ Dedicated Cold Van</span>
					{:else if delivery.fleetType === 'VAN_WITH_SMALL_REFRIGERATOR'}
						<span class="text-emerald-400">🚐 Van + Fridge</span>
					{:else}
						<span class="text-zinc-400">🚚 Standard Cargo</span>
					{/if}
				</span>
			</div>
		</div>
	</div>

	<!-- Column 2: Dispatch & Route Schedule -->
	<div class="rounded-none border border-zinc-800 bg-zinc-950 p-3.5 space-y-2 text-xs font-mono">
		<div class="font-bold uppercase text-[10px] tracking-wider text-emerald-400 flex items-center gap-1.5">
			<span>📅</span> TIMING &amp; DESTINATION
		</div>
		<div class="space-y-1.5 pt-1 text-zinc-300">
			<div class="flex items-center justify-between">
				<span class="text-zinc-500">DELIVERY DATE:</span>
				<span class="font-bold text-zinc-100 text-xs">
					{formatHumanDateTime(delivery.deliveryDate, 'full')}
				</span>
			</div>
			<div class="flex items-center justify-between">
				<span class="text-zinc-500">ARRIVED DATE:</span>
				<span class="font-bold text-zinc-100">{delivery.arrivedDate ?? '—'}</span>
			</div>
			<div class="flex items-center justify-between">
				<span class="text-zinc-500">DESTINATION:</span>
				<span class="font-semibold text-zinc-200">Surabaya Central Hub</span>
			</div>
			<div class="flex items-center justify-between">
				<span class="text-zinc-500">CURRENT STATUS:</span>
				{#if delivery.status === 'DELIVERED'}
					<span class="px-1.5 py-0.2 rounded-none text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700/60">
						[✓ DELIVERED]
					</span>
				{:else if delivery.status === 'ON_DELIVERY'}
					<span class="px-1.5 py-0.2 rounded-none text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-700/60">
						[⚡ ON_DELIVERY]
					</span>
				{:else if delivery.status === 'CANCELED'}
					<span class="px-1.5 py-0.2 rounded-none text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-700/60">
						[✕ CANCELED]
					</span>
				{:else}
					<span class="px-1.5 py-0.2 rounded-none text-[10px] font-bold bg-sky-950 text-sky-300 border border-sky-700/60">
						[⏳ ON_PROCESS]
					</span>
				{/if}
			</div>
		</div>
	</div>

	<!-- Column 3: Transit Notes & Telemetry -->
	<div class="rounded-none border border-emerald-900/50 bg-emerald-950/20 p-3.5 space-y-1.5 text-xs font-mono">
		<div class="font-bold text-emerald-400 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
			<span>📝</span> INITIAL TRANSIT LOG
		</div>
		<p class="text-zinc-300 leading-relaxed pt-1 text-[11px] font-sans">
			{delivery.notes || 'Routine scheduled medical supply transfer without congestion or temperature deviation recorded.'}
		</p>
	</div>
</div>

<!-- Delivered Line Items Table -->
<div class="rounded-none border border-zinc-800 overflow-hidden bg-zinc-950">
	<div class="px-4 py-2 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between text-xs font-mono">
		<span class="font-bold text-zinc-200 flex items-center gap-1.5">
			<span>📦</span> MANIFEST ITEMS ({delivery.items.length} SKU{delivery.items.length === 1 ? '' : 'S'})
		</span>
		<span class="font-bold text-zinc-100 text-xs">
			TOTAL: {delivery.items.reduce((s, it) => s + it.quantity, 0)} UNITS
		</span>
	</div>

	<table class="w-full text-left text-xs border-collapse font-mono">
		<thead class="bg-zinc-950 text-zinc-400 font-semibold border-b border-zinc-800">
			<tr>
				<th class="py-1.5 px-3 border-r border-zinc-800">SKU ID</th>
				<th class="py-1.5 px-3 border-r border-zinc-800">ITEM NAME</th>
				<th class="py-1.5 px-3 border-r border-zinc-800">CATEGORY</th>
				<th class="py-1.5 px-3 border-r border-zinc-800">STORAGE</th>
				<th class="py-1.5 px-3 text-right">QTY</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-zinc-800">
			{#each delivery.items as item}
				<tr class="hover:bg-zinc-900/60">
					<td class="py-1.5 px-3 font-bold text-zinc-400 border-r border-zinc-800/60">
						{item.productId}
					</td>
					<td class="py-1.5 px-3 font-medium text-zinc-100 border-r border-zinc-800/60 font-sans">
						{item.productName}
					</td>
					<td class="py-1.5 px-3 text-zinc-400 border-r border-zinc-800/60 font-sans">
						{item.category}
					</td>
					<td class="py-1.5 px-3 border-r border-zinc-800/60">
						{#if item.storageType === 'REFRIGERATED'}
							<span class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-none text-[10px] font-semibold bg-cyan-950/60 text-cyan-400 border border-cyan-800/60">
								<span>❄️</span> COLD (2–8°C)
							</span>
						{:else}
							<span class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-none text-[10px] font-medium bg-amber-950/40 text-amber-400 border border-amber-800/50">
								<span>📦</span> AMBIENT
							</span>
						{/if}
					</td>
					<td class="py-1.5 px-3 text-right font-bold text-zinc-100">
						{item.quantity}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
