<script lang="ts">
	import type { FulfillmentPlan, FulfillmentCandidate } from '#lib/domain/model/FulfillmentPlan.js';
	import type { Product } from '#lib/domain/model/Product.js';
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { toDatabaseDateTime, formatHumanDateTime } from '#lib/domain/utils/dateFormat.js';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
		plan: FulfillmentPlan | null;
		candidates?: FulfillmentCandidate[];
		selectedCandidateId?: string;
		strategy?: 'NEAREST_FIRST' | 'CONSOLIDATED_FIRST';
		isCommitted?: boolean;
		isCommitting?: boolean;
		products: readonly Product[];
		onSelectCandidate?: (candidate: FulfillmentCandidate) => void;
		onFinalize?: (deliveryDate?: string) => void;
	}

	let {
		isOpen,
		onClose,
		plan,
		candidates = [],
		selectedCandidateId = '',
		strategy = 'NEAREST_FIRST',
		isCommitted = false,
		isCommitting = false,
		products,
		onSelectCandidate,
		onFinalize
	}: Props = $props();

	function getTodayDateString(): string {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const day = String(now.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	function getDefaultTimeString(): string {
		const now = new Date();
		const hours = String(now.getHours()).padStart(2, '0');
		const minutes = String(now.getMinutes()).padStart(2, '0');
		return `${hours}:${minutes}`;
	}

	let deliveryDate = $state(getTodayDateString());
	let deliveryTime = $state(getDefaultTimeString());

	// Computed full SQL timestamp: "YYYY-MM-DD HH:mm:ss"
	const computedDatabaseDateTime = $derived(toDatabaseDateTime(deliveryDate, deliveryTime));

	// Computed human-friendly preview: "Monday, Oct 19, 2026 at 14:30"
	const computedHumanPreview = $derived(formatHumanDateTime(computedDatabaseDateTime, 'full'));

	// Active strategy applied for the current plan or candidate
	const activeStrategy = $derived.by(() => {
		const selectedCandidate = candidates.find((c) => c.id === selectedCandidateId);
		return selectedCandidate?.strategy ?? strategy;
	});

	// Active candidate chosen by operator
	const activeCandidate = $derived.by(() => {
		return candidates.find((c) => c.id === selectedCandidateId) ?? candidates[0] ?? null;
	});

	// Lock body scroll when modal is open to prevent page shifting
	$effect(() => {
		if (isOpen) {
			const prevOverflow = document.body.style.overflow;
			document.body.style.overflow = 'hidden';
			return () => {
				document.body.style.overflow = prevOverflow;
			};
		}
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && isOpen && !isCommitting) {
			onClose();
		}
	}

	function handleFinalize() {
		onFinalize?.(computedDatabaseDateTime);
	}

	let copiedShipmentId = $state<string | null>(null);

	async function copyHistoricalDeliveryId(id: string) {
		try {
			await navigator.clipboard.writeText(id);
			copiedShipmentId = id;
			setTimeout(() => {
				if (copiedShipmentId === id) copiedShipmentId = null;
			}, 2000);
		} catch {
			const textarea = document.createElement('textarea');
			textarea.value = id;
			document.body.appendChild(textarea);
			textarea.select();
			document.execCommand('copy');
			document.body.removeChild(textarea);
			copiedShipmentId = id;
			setTimeout(() => {
				if (copiedShipmentId === id) copiedShipmentId = null;
			}, 2000);
		}
	}

	const timePresets = [
		{ label: '08:00 (AM Shift)', time: '08:00' },
		{ label: '12:00 (Noon)', time: '12:00' },
		{ label: '14:30 (PM Shift)', time: '14:30' },
		{ label: '18:00 (Evening)', time: '18:00' }
	];

	function getProductName(productId: string): string {
		const p = products.find((prod) => prod.id === productId);
		return p ? p.name : productId;
	}

	function getProductStorage(productId: string): 'AMBIENT' | 'REFRIGERATED' {
		const p = products.find((prod) => prod.id === productId);
		return p?.storageType ?? 'AMBIENT';
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
	<!-- Modal Backdrop Overlay with Frosted Glass -->
	<div
		transition:fade={{ duration: 120, easing: cubicOut }}
		class="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6"
		role="dialog"
		aria-modal="true"
		aria-labelledby="decision-modal-title"
	>
		<!-- Modal Box Window with Upward Easing Fly Animation (Slightly fast ease) -->
		<div
			in:fly={{ y: 20, duration: 140, easing: cubicOut }}
			out:fly={{ y: -16, duration: 100, easing: cubicOut }}
			class="relative w-full max-w-5xl h-[92vh] flex flex-col rounded-none border border-zinc-700 bg-zinc-950 text-zinc-100 shadow-2xl overflow-hidden font-sans"
		>
			<!-- Modal Header Bar -->
			<div class="px-5 py-3 border-b border-zinc-800 bg-zinc-900 flex items-center justify-between shrink-0 font-mono">
				<div class="flex items-center gap-3">
					<div class="flex items-center justify-center w-6 h-6 rounded-none bg-emerald-500 text-zinc-950 font-black text-xs">
						03
					</div>
					<div>
						<h2 id="decision-modal-title" class="font-bold text-sm tracking-wide text-zinc-100 uppercase">
							Decision &amp; Finalizing Order
						</h2>
						<p class="text-[11px] text-zinc-400 font-sans">
							Automated facility allocation, vehicle assignment, and decision telemetry for Surabaya Hospital Hub.
						</p>
					</div>
				</div>

				<button
					type="button"
					onclick={onClose}
					disabled={isCommitting}
					class="px-2.5 py-1 text-xs font-bold rounded-none bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100 border border-zinc-700 transition-colors cursor-pointer disabled:opacity-50"
					aria-label="Close decision and finalizing modal"
				>
					[✕ ESC]
				</button>
			</div>

			<!-- Modal Body (Scrollable Content Container) -->
			<div class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
				{#if !plan}
					<!-- Loading / Preparing State -->
					<div class="py-16 text-center text-zinc-500 font-mono">
						<div class="inline-flex items-center justify-center w-12 h-12 rounded-none border border-zinc-700 bg-zinc-800/80 text-zinc-400 mb-3">
							<svg class="w-6 h-6 animate-spin text-emerald-400" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
						</div>
						<p class="text-xs md:text-sm font-semibold text-zinc-300 uppercase tracking-wider">[EVALUATING LOGISTICS ROUTING...]</p>
						<p class="text-xs text-zinc-500 max-w-sm mx-auto mt-1">
							Computing optimal warehouse allocations, cold-chain compliance, and vehicle capacity.
						</p>
					</div>
				{:else}
					<!-- 1. Dispatch Candidate Routing Section -->
					{#if (isCommitted || isCommitting) && activeCandidate}
						<!-- Finalized / Committing State: Lock to the candidate the user chose -->
						<div class="rounded-none border border-emerald-600/80 bg-emerald-950/20 p-4 md:p-5 space-y-3 font-mono">
							<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b border-emerald-900/60 pb-2.5">
								<div>
									<h3 class="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
										<span>⚡</span> CONFIRMED DISPATCH ROUTE (LOCKED)
									</h3>
									<p class="text-[11px] text-emerald-400/80 mt-0.5 font-sans">
										Candidate route selected by operator is {isCommitted ? 'finalized and committed to inventory ledger.' : 'being finalized and dispatched...'} Alternative options locked.
									</p>
								</div>
								<span class="inline-flex items-center px-2 py-0.5 rounded-none text-[10px] font-bold {isCommitted ? 'bg-emerald-900/80 text-emerald-200 border border-emerald-600/70' : 'bg-emerald-950 text-emerald-300 border border-emerald-500/60 animate-pulse'} self-start sm:self-center font-mono">
									{isCommitted ? '[COMMITTED & LOCKED]' : '[FINALIZING ROUTE...]'}
								</span>
							</div>

							<!-- Full-width locked card for chosen candidate -->
							<div class="rounded-none border border-emerald-500/80 bg-zinc-950 p-4 text-zinc-100 shadow-md">
								<!-- Top Row: Radio indicator + Title + Badges -->
								<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-800/80 pb-3">
									<div class="flex items-center gap-2">
										<span class="flex items-center justify-center w-3.5 h-3.5 rounded-none border border-emerald-400 bg-emerald-500 shrink-0">
											<span class="w-1.5 h-1.5 rounded-none bg-zinc-950"></span>
										</span>
										<span class="font-bold text-sm text-zinc-100 font-mono">
											{activeCandidate.title}
										</span>
									</div>

									<div class="flex items-center gap-1.5 shrink-0">
										<span class="text-[10px] font-bold font-mono uppercase px-2 py-0.5 rounded-none {isCommitted ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60' : 'bg-emerald-900 text-emerald-200 border border-emerald-500/60 animate-pulse'}">
											{isCommitted ? 'COMMITTED' : 'COMMITTING...'}
										</span>
										<span class="text-[10px] font-semibold font-mono uppercase px-2 py-0.5 rounded-none bg-zinc-800 text-zinc-300 border border-zinc-700">
											{activeCandidate.badge}
										</span>
									</div>
								</div>

								<!-- Metrics Ribbon -->
								<div class="flex flex-wrap items-center gap-4 sm:gap-6 my-3 py-2.5 px-4 rounded-none bg-zinc-900/90 border border-zinc-800 text-xs font-mono">
									<div>
										<div class="text-[10px] uppercase font-semibold text-zinc-500">TOTAL DISTANCE</div>
										<div class="font-bold text-emerald-300 text-sm">{activeCandidate.plan.totalDistanceKm} km</div>
									</div>
									<div class="border-l border-zinc-800 pl-4 sm:pl-6">
										<div class="text-[10px] uppercase font-semibold text-zinc-500">VEHICLES</div>
										<div class="font-bold text-zinc-100 text-sm">{activeCandidate.plan.splitCount} truck{activeCandidate.plan.splitCount === 1 ? '' : 's'}</div>
									</div>
									<div class="border-l border-zinc-800 pl-4 sm:pl-6">
										<div class="text-[10px] uppercase font-semibold text-zinc-500">DISPATCH FACILITIES</div>
										<div class="font-semibold text-zinc-200">
											{activeCandidate.plan.shipments.map((s) => `${s.warehouseId}`).join(' + ')}
										</div>
									</div>
								</div>

								<!-- Pros & Cons list -->
								{#if activeCandidate.pros.length > 0 || activeCandidate.cons.length > 0}
									<div class="space-y-1 text-xs font-mono">
										{#each activeCandidate.pros as pro}
											<div class="flex items-start gap-1.5 text-emerald-400">
												<span class="font-bold">+</span>
												<span>{pro}</span>
											</div>
										{/each}
										{#each activeCandidate.cons as con}
											<div class="flex items-start gap-1.5 text-amber-400">
												<span class="font-bold">-</span>
												<span>{con}</span>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						</div>
					{:else if candidates && candidates.length > 1}
						<!-- Multiple Candidates Matrix (Before Finalizing) -->
						<div class="rounded-none border border-emerald-900/60 bg-emerald-950/20 p-4 md:p-5 space-y-3 font-mono">
							<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b border-emerald-900/40 pb-2.5">
								<div>
									<h3 class="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
										<span>⚡</span> DISPATCH CANDIDATES MATRIX ({candidates.length} VIABLE ROUTES)
									</h3>
									<p class="text-[11px] text-emerald-400/80 mt-0.5 font-sans">
										Multiple dispatch options computed. Compare proximity vs. single-depot consolidation trade-offs:
									</p>
								</div>
								<span class="inline-flex items-center px-2 py-0.5 rounded-none text-[10px] font-bold bg-emerald-900/60 text-emerald-300 border border-emerald-700/60 self-start sm:self-center font-mono">
									[{candidates.length} OPTIONS FOUND]
								</span>
							</div>

							<div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
								{#each candidates as candidate (candidate.id)}
									{@const isSelected = selectedCandidateId === candidate.id}
									<button
										type="button"
										disabled={isCommitting || isCommitted}
										onclick={() => {
											if (!isCommitting && !isCommitted) {
												onSelectCandidate?.(candidate);
											}
										}}
										class="text-left rounded-none border p-3.5 transition-all relative overflow-hidden {isCommitting || isCommitted
											? 'cursor-not-allowed select-none opacity-50'
											: 'cursor-pointer'} {isSelected
											? 'bg-zinc-950 border-emerald-500 ring-1 ring-emerald-500/50 shadow-md text-zinc-100'
											: 'bg-zinc-950/80 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/60 text-zinc-300'}"
									>
										<!-- Top Row: Radio + Title + Badge -->
										<div class="flex items-start justify-between gap-2.5">
											<div class="flex items-start gap-2 min-w-0 flex-1">
												<span class="flex items-center justify-center w-3.5 h-3.5 rounded-none border mt-0.5 shrink-0 {isSelected ? 'border-emerald-400 bg-emerald-500' : 'border-zinc-700 bg-zinc-900'}">
													{#if isSelected}
														<span class="w-1.5 h-1.5 rounded-none bg-zinc-950"></span>
													{/if}
												</span>
												<span class="font-bold text-xs md:text-sm leading-snug text-zinc-100 font-mono">
													{candidate.title}
												</span>
											</div>

											<div class="flex flex-wrap items-center justify-end gap-1 shrink-0 max-w-[48%]">
												{#if candidate.isRecommended}
													<span class="text-[9px] font-bold font-mono uppercase px-1.5 py-0.5 rounded-none bg-emerald-950 text-emerald-300 border border-emerald-700/60 whitespace-nowrap">
														RECOMMENDED
													</span>
												{/if}
												<span class="text-[9px] font-semibold font-mono uppercase px-1.5 py-0.5 rounded-none bg-zinc-800 text-zinc-300 border border-zinc-700 whitespace-nowrap">
													{candidate.badge}
												</span>
											</div>
										</div>

										<!-- Metrics Ribbon -->
										<div class="flex items-center gap-4 mt-3 py-2 px-3 rounded-none bg-zinc-950 border border-zinc-800 text-xs font-mono">
											<div>
												<div class="text-[10px] uppercase font-semibold text-zinc-500">DISTANCE</div>
												<div class="font-bold text-zinc-100">{candidate.plan.totalDistanceKm} km</div>
											</div>
											<div class="border-l border-zinc-800 pl-4">
												<div class="text-[10px] uppercase font-semibold text-zinc-500">VEHICLES</div>
												<div class="font-bold text-zinc-100">{candidate.plan.splitCount} truck{candidate.plan.splitCount === 1 ? '' : 's'}</div>
											</div>
											<div class="border-l border-zinc-800 pl-4 truncate">
												<div class="text-[10px] uppercase font-semibold text-zinc-500">FACILITIES</div>
												<div class="font-semibold text-zinc-300 truncate">
													{candidate.plan.shipments.map((s) => `${s.warehouseId}`).join(' + ')}
												</div>
											</div>
										</div>

										<!-- Pros & Cons list -->
										<div class="mt-3 space-y-1 text-[11px] font-mono">
											{#each candidate.pros as pro}
												<div class="flex items-start gap-1.5 text-emerald-400">
													<span class="font-bold">+</span>
													<span>{pro}</span>
												</div>
											{/each}
											{#each candidate.cons as con}
												<div class="flex items-start gap-1.5 text-amber-400">
													<span class="font-bold">-</span>
													<span>{con}</span>
												</div>
											{/each}
										</div>
									</button>
								{/each}
							</div>
						</div>
					{/if}

					<!-- 2. Strategy Priority Engine Explanation (Moved here before Review Mode, Non-clickable) -->
					<div class="rounded-none border border-zinc-800 bg-zinc-950/90 p-4 font-mono">
						<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-2.5">
							<div class="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
								<span class="text-emerald-400">⚡</span> STRATEGY PRIORITY ENGINE
							</div>
							<span class="text-[11px] text-zinc-500">
								[Proximity minimization vs. Single-facility consolidation]
							</span>
						</div>

						<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
							<!-- Nearest Facility First Card (Non-clickable Explanation) -->
							<div
								class="text-left p-3 rounded-none border transition-all cursor-default select-none {activeStrategy === 'NEAREST_FIRST' ? 'bg-zinc-950 border-emerald-500 text-zinc-100 ring-1 ring-emerald-500/50 shadow-sm' : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400'}"
							>
								<div class="flex items-center justify-between">
									<div class="font-bold text-xs flex items-center gap-2">
										<span class="w-2.5 h-2.5 rounded-none border {activeStrategy === 'NEAREST_FIRST' ? 'bg-emerald-400 border-emerald-400' : 'bg-zinc-800 border-zinc-600'}"></span>
										<span class="{activeStrategy === 'NEAREST_FIRST' ? 'text-zinc-100' : 'text-zinc-300'}">Nearest Facility First</span>
									</div>
									<div class="flex items-center gap-1.5">
										{#if activeStrategy === 'NEAREST_FIRST'}
											<span class="text-[9px] font-mono font-bold uppercase px-1 py-0.2 rounded-none bg-emerald-950 text-emerald-300 border border-emerald-700/70">
												APPLIED
											</span>
										{/if}
										<span class="text-[10px] font-mono font-semibold uppercase px-1.5 py-0.2 rounded-none {activeStrategy === 'NEAREST_FIRST' ? 'bg-emerald-900/80 text-emerald-200 border border-emerald-600/70' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}">
											DEFAULT
										</span>
									</div>
								</div>
								<p class="text-[11px] mt-1.5 {activeStrategy === 'NEAREST_FIRST' ? 'text-zinc-300' : 'text-zinc-400'} leading-relaxed font-sans">
									Fulfills stock from closest facility first (e.g. W01: 200, W02: 50). If depleted, routes to next closest facility.
								</p>
							</div>

							<!-- Consolidated First (Min Splits) Card (Non-clickable Explanation) -->
							<div
								class="text-left p-3 rounded-none border transition-all cursor-default select-none {activeStrategy === 'CONSOLIDATED_FIRST' ? 'bg-zinc-950 border-emerald-500 text-zinc-100 ring-1 ring-emerald-500/50 shadow-sm' : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400'}"
							>
								<div class="flex items-center justify-between">
									<div class="font-bold text-xs flex items-center gap-2">
										<span class="w-2.5 h-2.5 rounded-none border {activeStrategy === 'CONSOLIDATED_FIRST' ? 'bg-emerald-400 border-emerald-400' : 'bg-zinc-800 border-zinc-600'}"></span>
										<span class="{activeStrategy === 'CONSOLIDATED_FIRST' ? 'text-zinc-100' : 'text-zinc-300'}">Consolidated First (Min Splits)</span>
									</div>
									<div class="flex items-center gap-1.5">
										{#if activeStrategy === 'CONSOLIDATED_FIRST'}
											<span class="text-[9px] font-mono font-bold uppercase px-1 py-0.2 rounded-none bg-emerald-950 text-emerald-300 border border-emerald-700/70">
												APPLIED
											</span>
										{/if}
										<span class="text-[10px] font-mono font-semibold uppercase px-1.5 py-0.2 rounded-none {activeStrategy === 'CONSOLIDATED_FIRST' ? 'bg-emerald-900/80 text-emerald-200 border border-emerald-600/70' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}">
											MIN-SPLIT
										</span>
									</div>
								</div>
								<p class="text-[11px] mt-1.5 {activeStrategy === 'CONSOLIDATED_FIRST' ? 'text-zinc-300' : 'text-zinc-400'} leading-relaxed font-sans">
									Prioritizes single-facility 100% coverage (e.g. W03: 250) to minimize package splits, even if further away.
								</p>
							</div>
						</div>
					</div>

					<!-- 3. Review Mode State & Scheduling Bar -->
					{#if plan.status !== 'INSUFFICIENT_STOCK'}
						<div
							class="rounded-none border transition-all shadow-md overflow-hidden {isCommitted
								? 'bg-emerald-950 border-emerald-600/70 text-white'
								: 'bg-zinc-950 border-zinc-800 text-white'}"
						>
							{#if isCommitted}
								<!-- Committed & Persisted State -->
								<div class="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-emerald-950">
									<div class="space-y-1">
										<div class="flex flex-wrap items-center gap-2">
											<span class="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-none bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
												<svg class="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
												</svg>
												[DISPATCHED &amp; PERSISTED]
											</span>
											<span class="text-xs text-emerald-200/90 font-mono font-medium">INVENTORY DEDUCTED</span>
										</div>
										<p class="text-xs text-emerald-100/90 font-mono">
											Order confirmed and logged to logistics history. Allocated stocks deducted from assigned warehouse depots.
										</p>
									</div>

									<!-- Committed Timestamp Display -->
									<div class="bg-emerald-900/60 border border-emerald-700/60 rounded-none px-3.5 py-2 flex flex-col sm:items-end shrink-0 font-mono">
										<span class="text-[10px] text-emerald-300/80 font-medium uppercase tracking-wider">DELIVERY TARGET:</span>
										<span class="text-xs font-bold text-emerald-100 mt-0.5">
											{formatHumanDateTime(computedDatabaseDateTime, 'full')}
										</span>
									</div>
								</div>
							{:else}
								<!-- Review Mode Header -->
								<div class="p-4 sm:p-5 border-b border-zinc-800 bg-zinc-900/90 flex flex-col md:flex-row md:items-center justify-between gap-3 font-mono">
									<div>
										<div class="flex items-center gap-2">
											<span class="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-none bg-emerald-950/80 text-emerald-300 border border-emerald-700/60">
												<span class="w-1.5 h-1.5 rounded-none bg-emerald-400 animate-pulse"></span>
												[REVIEW MODE]
											</span>
											<span class="text-xs text-zinc-300 font-mono font-medium">TARGET DISPATCH SCHEDULE</span>
										</div>
										<p class="text-xs text-zinc-400 mt-1 font-mono">
											Specify delivery timestamp and shift preset before finalizing shipment.
										</p>
									</div>

									<!-- Live Scheduled Preview Badge -->
									<div class="bg-zinc-950 border border-zinc-800 rounded-none px-3 py-1.5 flex items-center gap-2 shrink-0 font-mono">
										<svg class="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
										</svg>
										<div class="flex flex-col">
											<span class="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">SCHEDULED FOR:</span>
											<span class="text-xs font-bold text-emerald-300">
												{computedHumanPreview}
											</span>
										</div>
									</div>
								</div>

								<!-- Controls Bar: Date & Time Pickers + Presets -->
								<div class="p-4 sm:p-5 bg-zinc-950/90 flex flex-wrap items-center justify-between gap-4 font-mono">
									<div class="flex flex-wrap items-center gap-3">
										<!-- Date Picker -->
										<div class="flex flex-col gap-1">
											<label for="modal-dispatch-date-input" class="text-[11px] font-semibold text-zinc-300 flex items-center gap-1">
												<span>DATE:</span>
											</label>
											<input
												id="modal-dispatch-date-input"
												type="date"
												bind:value={deliveryDate}
												class="bg-zinc-900 text-zinc-100 text-xs font-medium px-3 py-2 rounded-none border border-zinc-700 hover:border-zinc-600 focus:outline-hidden focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 cursor-pointer [color-scheme:dark]"
											/>
										</div>

										<!-- Time Picker -->
										<div class="flex flex-col gap-1">
											<label for="modal-dispatch-time-input" class="text-[11px] font-semibold text-zinc-300 flex items-center gap-1">
												<span>TIME:</span>
											</label>
											<input
												id="modal-dispatch-time-input"
												type="time"
												bind:value={deliveryTime}
												class="bg-zinc-900 text-zinc-100 text-xs font-medium px-3 py-2 rounded-none border border-zinc-700 hover:border-zinc-600 focus:outline-hidden focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 cursor-pointer [color-scheme:dark]"
											/>
										</div>

										<!-- Quick Time Slot Presets -->
										<div class="flex flex-col gap-1">
											<span class="text-[11px] font-semibold text-zinc-500">SHIFT PRESETS:</span>
											<div class="flex flex-wrap items-center gap-1.5">
												{#each timePresets as preset}
													<button
														type="button"
														onclick={() => (deliveryTime = preset.time)}
														class="text-[11px] px-2 py-1.5 rounded-none font-medium transition-colors cursor-pointer {deliveryTime === preset.time
															? 'bg-emerald-600 text-zinc-950 font-bold border border-emerald-400'
															: 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white border border-zinc-800'}"
													>
														{preset.label}
													</button>
												{/each}
											</div>
										</div>
									</div>
								</div>
							{/if}
						</div>
					{/if}

					<!-- 4. Status Banner -->
					{#if plan.status === 'FULFILLED'}
						<div class="rounded-none bg-emerald-950/40 border border-emerald-800/60 p-4 text-emerald-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 font-mono">
							<div class="flex items-center gap-3">
								<span class="flex items-center justify-center w-8 h-8 rounded-none bg-emerald-600 text-zinc-950 font-bold border border-emerald-400 shrink-0">
									✓
								</span>
								<div>
									<div class="flex items-center gap-2">
										<span class="text-xs font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-none bg-emerald-900/80 text-emerald-300 border border-emerald-700/60">
											STATUS: FULFILLED
										</span>
										<span class="text-xs text-emerald-300 font-medium">[100% SINGLE FACILITY MATCH]</span>
									</div>
									<p class="text-xs text-emerald-200/90 mt-0.5 font-sans">
										All requested items fulfilled by a single warehouse nearest to Surabaya without split logistics overhead.
									</p>
								</div>
							</div>

							<div class="flex items-center gap-4 text-right shrink-0 border-t sm:border-t-0 sm:border-l border-emerald-800/60 pt-2 sm:pt-0 sm:pl-4 font-mono">
								<div>
									<div class="text-[10px] uppercase font-semibold text-emerald-400">VEHICLES</div>
									<div class="text-base font-bold text-emerald-100">{plan.splitCount}</div>
								</div>
								<div>
									<div class="text-[10px] uppercase font-semibold text-emerald-400">TOTAL DISTANCE</div>
									<div class="text-base font-bold text-emerald-100">{plan.totalDistanceKm} km</div>
								</div>
							</div>
						</div>
					{:else if plan.status === 'SPLIT_SHIPMENT'}
						<div class="rounded-none bg-cyan-950/40 border border-cyan-800/60 p-4 text-cyan-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 font-mono">
							<div class="flex items-center gap-3">
								<span class="flex items-center justify-center w-8 h-8 rounded-none bg-cyan-600 text-zinc-950 font-bold border border-cyan-400 shrink-0">
									⤂⤃
								</span>
								<div>
									<div class="flex items-center gap-2">
										<span class="text-xs font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-none bg-cyan-900/80 text-cyan-300 border border-cyan-700/60">
											STATUS: SPLIT_SHIPMENT
										</span>
										<span class="text-xs text-cyan-300 font-medium">[{plan.splitCount}-WAREHOUSE ALLOCATION]</span>
									</div>
									<p class="text-xs text-cyan-200/90 mt-0.5 font-sans">
										Multi-facility allocation calculated to minimize total shipment splits and travel distances.
									</p>
								</div>
							</div>

							<div class="flex items-center gap-4 text-right shrink-0 border-t sm:border-t-0 sm:border-l border-cyan-800/60 pt-2 sm:pt-0 sm:pl-4 font-mono">
								<div>
									<div class="text-[10px] uppercase font-semibold text-cyan-400">VEHICLES</div>
									<div class="text-base font-bold text-cyan-100">{plan.splitCount}</div>
								</div>
								<div>
									<div class="text-[10px] uppercase font-semibold text-cyan-400">TOTAL DISTANCE</div>
									<div class="text-base font-bold text-cyan-100">{plan.totalDistanceKm} km</div>
								</div>
							</div>
						</div>
					{:else}
						<div class="rounded-none bg-rose-950/40 border border-rose-800/60 p-4 text-rose-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 font-mono">
							<div class="flex items-center gap-3">
								<span class="flex items-center justify-center w-8 h-8 rounded-none bg-rose-600 text-zinc-950 font-bold border border-rose-400 shrink-0">
									✕
								</span>
								<div>
									<div class="flex items-center gap-2">
										<span class="text-xs font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-none bg-rose-900/80 text-rose-300 border border-rose-700/60">
											STATUS: INSUFFICIENT_STOCK
										</span>
										<span class="text-xs text-rose-300 font-medium">[DEPLETION DETECTED]</span>
									</div>
									<p class="text-xs text-rose-200/90 mt-0.5 font-sans">
										Order cannot be fulfilled. Requested quantity exceeds total regional network capacity across all 8 facilities.
									</p>
								</div>
							</div>
						</div>
					{/if}

					<!-- 5. Unfulfilled Items Deficit Table (if INSUFFICIENT_STOCK) -->
					{#if plan.unfulfilledItems.length > 0}
						<div class="rounded-none border border-rose-900/60 bg-zinc-950 p-4 font-mono">
							<h3 class="text-xs font-bold uppercase tracking-wider text-rose-400 mb-2 flex items-center gap-1.5">
								<span>⚠️</span> PRODUCT STOCK DEFICIT SUMMARY
							</h3>
							<div class="overflow-x-auto">
								<table class="w-full text-left text-xs border-collapse">
									<thead>
										<tr class="bg-rose-950/60 text-rose-300 font-semibold border-b border-rose-900/60">
											<th class="py-2 px-3">PRODUCT</th>
											<th class="py-2 px-3 text-right">REQUESTED</th>
											<th class="py-2 px-3 text-right">NETWORK AVAIL</th>
											<th class="py-2 px-3 text-right text-rose-400">SHORTFALL</th>
										</tr>
									</thead>
									<tbody class="divide-y divide-rose-900/40">
										{#each plan.unfulfilledItems as item (item.productId)}
											<tr>
												<td class="py-2 px-3 font-medium text-zinc-200">
													<span class="font-bold mr-1 text-zinc-400">{item.productId}</span>
													{getProductName(item.productId)}
												</td>
												<td class="py-2 px-3 text-right text-zinc-300">{item.requestedQuantity}</td>
												<td class="py-2 px-3 text-right text-zinc-400">{item.availableQuantity}</td>
												<td class="py-2 px-3 text-right font-bold text-rose-400">-{item.shortfall}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					{/if}

					<!-- 6. Shipment Breakdown Cards (Preserved & Kept Intact) -->
					{#if plan.shipments.length > 0}
						<div class="font-mono">
							<h3 class="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2.5">
								&gt; SHIPMENT ROUTING MANIFEST ({plan.shipments.length} DISPATCH{plan.shipments.length === 1 ? '' : 'ES'}):
							</h3>

							<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
								{#each plan.shipments as shipment, idx (shipment.warehouseId)}
									<div class="rounded-none border border-zinc-800 bg-zinc-950/80 p-4 space-y-3">
										<div class="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-2.5">
											<div class="flex items-center gap-2">
												<span class="flex items-center justify-center w-5 h-5 rounded-none bg-zinc-800 font-bold text-xs text-zinc-300 border border-zinc-700">
													{idx + 1}
												</span>
												<div>
													<span class="font-bold text-sm text-zinc-100">{shipment.warehouseId}</span>
													<span class="text-xs text-zinc-400 ml-1 font-sans">({shipment.warehouseCity})</span>
												</div>
											</div>

											<span class="inline-flex items-center px-1.5 py-0.2 rounded-none text-xs font-semibold bg-zinc-900 border border-zinc-800 text-zinc-300">
												{shipment.distanceKm} km to Hub
											</span>
										</div>

										{#if isCommitted && shipment.deliveryId}
											<div class="px-2.5 py-1.5 rounded-none bg-zinc-900 border border-emerald-500/50 flex items-center justify-between gap-2 text-xs font-mono">
												<div class="flex items-center gap-1.5 min-w-0">
													<span class="text-zinc-500 text-[10px] uppercase font-bold shrink-0">DELIVERY ID:</span>
													<span class="font-bold text-emerald-400 truncate text-[11px]">{shipment.deliveryId}</span>
												</div>
												<button
													type="button"
													onclick={() => copyHistoricalDeliveryId(shipment.deliveryId!)}
													class="px-2 py-0.5 text-[10px] font-bold rounded-none bg-zinc-800 hover:bg-zinc-700 text-emerald-300 hover:text-emerald-100 border border-zinc-700 transition-colors cursor-pointer flex items-center gap-1 shrink-0"
													title="Copy Historical Delivery ID"
												>
													{#if copiedShipmentId === shipment.deliveryId}
														<span class="text-emerald-400">✓</span> [COPIED]
													{:else}
														<svg class="w-3 h-3 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
														</svg>
														<span>[COPY ID]</span>
													{/if}
												</button>
											</div>
										{/if}

										<div class="flex items-center justify-between text-xs text-zinc-400">
											<span class="text-zinc-500">ASSIGNED FLEET:</span>
											<span class="font-medium text-zinc-200">
												{#if shipment.fleetType === 'REFRIGERATED_VANS'}
													<span class="text-cyan-400 font-semibold">❄️ Dedicated Cold Vans</span>
												{:else if shipment.fleetType === 'VAN_WITH_SMALL_REFRIGERATOR'}
													<span class="text-emerald-400 font-semibold">🚐 Van + Small Fridge</span>
												{:else}
													<span class="text-zinc-400">🚚 Standard Cargo Container</span>
												{/if}
											</span>
										</div>

										<!-- Allocated Items List -->
										<div>
											<div class="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
												ALLOCATED SKU MANIFEST:
											</div>
											<div class="space-y-1">
												{#each shipment.items as item (item.productId)}
													{@const isCold = getProductStorage(item.productId) === 'REFRIGERATED'}
													<div class="flex items-center justify-between text-xs py-1 px-2 rounded-none bg-zinc-900 border border-zinc-800">
														<div class="flex items-center gap-1.5 truncate mr-2">
															<span class="text-[11px] font-bold text-zinc-400">{item.productId}</span>
															<span class="truncate text-zinc-200">{getProductName(item.productId)}</span>
															{#if isCold}
																<span class="text-cyan-400 text-[10px]" title="Cold Chain">❄️</span>
															{/if}
														</div>
														<span class="font-bold text-zinc-100 shrink-0">
															{item.quantity} units
														</span>
													</div>
												{/each}
											</div>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<!-- 7. Natural Language Explanation Callout Box -->
					<div class="rounded-none border border-zinc-800 bg-zinc-950/80 p-4 md:p-5">
						<div class="flex items-center gap-2 mb-2 font-mono">
							<svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<h3 class="text-xs font-bold uppercase tracking-wider text-zinc-200">
								DECISION ENGINE TELEMETRY &amp; LOGISTICS RATIONALE:
							</h3>
						</div>
						<div class="text-xs md:text-sm text-zinc-300 leading-relaxed whitespace-pre-line pl-6 font-mono">
							{plan.explanation}
						</div>
					</div>
				{/if}
			</div>

			<!-- Modal Sticky Footer Action Bar -->
			<div class="px-5 py-3 border-t border-zinc-800 bg-zinc-950 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0 font-mono text-xs">
				{#if isCommitted}
					<div class="flex items-center gap-2 text-emerald-400 font-bold">
						<span>✓</span>
						<span>[DISPATCHED &amp; PERSISTED] ALLOCATED STOCKS DEDUCTED FROM REGIONAL HUBS</span>
					</div>
					<button
						type="button"
						onclick={onClose}
						class="px-5 py-2 text-xs font-bold rounded-none bg-emerald-500 hover:bg-emerald-400 text-zinc-950 transition-colors cursor-pointer border border-emerald-400"
					>
						[CLOSE]
					</button>
				{:else if plan && plan.status !== 'INSUFFICIENT_STOCK'}
					<div class="text-zinc-400 font-medium">
						&gt; REVIEW SCHEDULE &amp; MANIFEST, THEN CLICK FINALIZE TO DISPATCH
					</div>
					<div class="flex items-center justify-end gap-2.5">
						<button
							type="button"
							onclick={onClose}
							disabled={isCommitting}
							class="px-4 py-2 text-xs font-semibold rounded-none bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition-colors cursor-pointer disabled:opacity-50"
						>
							[DISCARD]
						</button>

						<!-- FINALIZE BUTTON -->
						<button
							type="button"
							onclick={handleFinalize}
							disabled={isCommitting}
							class="inline-flex items-center justify-center gap-2 px-6 py-2 rounded-none text-xs md:text-sm font-mono font-bold text-zinc-950 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 border border-emerald-400 disabled:opacity-50 transition-all cursor-pointer shadow-md shadow-emerald-950/40"
						>
							{#if isCommitting}
								<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-zinc-950" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
								</svg>
								<span>[FINALIZING DISPATCH...]</span>
							{:else}
								<span>✓ [FINALIZE]</span>
							{/if}
						</button>
					</div>
				{:else}
					<div class="text-rose-400 font-bold">
						⚠ [ORDER CANNOT BE DISPATCHED DUE TO INSUFFICIENT STOCK]
					</div>
					<button
						type="button"
						onclick={onClose}
						class="px-5 py-2 text-xs font-bold rounded-none bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition-colors cursor-pointer"
					>
						[CLOSE]
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
