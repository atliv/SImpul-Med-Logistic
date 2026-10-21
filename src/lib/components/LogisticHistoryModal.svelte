<script lang="ts">
	import { isTerminalDeliveryStatus, type DeliveryStatus } from '#lib/domain/model/HistoricalDelivery.js';
	import type { Warehouse } from '#lib/domain/model/Warehouse.js';
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import type { DeliveryRecord, StatusTrackingRecord } from './history/types.js';
	import DeliveryTable from './history/DeliveryTable.svelte';
	import DeliveryManifestDetails from './history/DeliveryManifestDetails.svelte';
	import DeliveryStatusTimeline from './history/DeliveryStatusTimeline.svelte';
	import TerminalStatusConfirmModal from './history/TerminalStatusConfirmModal.svelte';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
		onWarehousesUpdated?: (warehouses: Warehouse[]) => void;
	}

	let { isOpen, onClose, onWarehousesUpdated }: Props = $props();

	const PAGE_SIZE = 12;

	let deliveries = $state<DeliveryRecord[]>([]);
	let isLoading = $state(false);
	let isLoadingMore = $state(false);
	let hasMore = $state(true);
	let totalRecords = $state(0);
	let selectedWarehouse = $state('ALL');
	let searchQuery = $state('');
	let error = $state<string | null>(null);
	let selectedDelivery = $state<DeliveryRecord | null>(null);
	let isAccordionOpen = $state<boolean>(true);
	let isTrackingExpanded = $state<boolean>(false);

	let accordionElement = $state<HTMLElement | null>(null);

	// Terminal status confirmation state
	let isConfirmTerminalStatusModalOpen = $state(false);
	let terminalConfirmStatus = $state<DeliveryStatus>('DELIVERED');
	let terminalConfirmNote = $state<string>('');
	let isSubmittingTerminalStatus = $state(false);

	// Lock body scroll when modal is open to prevent page shifting and gaps
	$effect(() => {
		if (isOpen) {
			const prevOverflow = document.body.style.overflow;
			document.body.style.overflow = 'hidden';
			return () => {
				document.body.style.overflow = prevOverflow;
			};
		}
	});

	// Fetch deliveries from /api/history when modal opens
	$effect(() => {
		if (isOpen) {
			loadDeliveries(true);
		}
	});

	async function loadDeliveries(reset = false) {
		// Strict guard: if not a reset request, stop immediately if already loading or no more data exists
		if (!reset && (!hasMore || isLoading || isLoadingMore)) {
			return;
		}

		if (reset) {
			isLoading = true;
			hasMore = true;
		} else {
			isLoadingMore = true;
		}
		error = null;

		const currentOffset = reset ? 0 : deliveries.length;
		const params = new URLSearchParams();
		params.set('limit', String(PAGE_SIZE));
		params.set('offset', String(currentOffset));
		if (selectedWarehouse && selectedWarehouse !== 'ALL') {
			params.set('warehouse', selectedWarehouse);
		}
		if (searchQuery.trim()) {
			params.set('search', searchQuery.trim());
		}

		try {
			const res = await fetch(`/api/history?${params.toString()}`);
			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.error || 'Failed to fetch delivery history');
			}
			const data = await res.json();
			const newBatch: DeliveryRecord[] = data.deliveries || [];
			totalRecords = typeof data.total === 'number' ? data.total : newBatch.length;

			if (reset || currentOffset === 0) {
				deliveries = newBatch;
			} else {
				// Deduplicate by ID when appending
				const existingIds = new Set(deliveries.map((d) => d.id));
				const toAppend = newBatch.filter((d) => !existingIds.has(d.id));
				deliveries = [...deliveries, ...toAppend];
			}

			// Strict stop condition:
			if (typeof data.hasMore === 'boolean') {
				hasMore = data.hasMore && deliveries.length < totalRecords;
			} else {
				hasMore = deliveries.length < totalRecords && newBatch.length >= PAGE_SIZE;
			}

			if (deliveries.length >= totalRecords) {
				hasMore = false;
			}

			if (deliveries.length > 0 && !selectedDelivery) {
				selectedDelivery = deliveries[0];
			} else if (selectedDelivery) {
				selectedDelivery = deliveries.find((d) => d.id === selectedDelivery?.id) ?? deliveries[0];
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unknown error occurred';
		} finally {
			isLoading = false;
			isLoadingMore = false;
		}
	}

	function handleLoadMore() {
		loadDeliveries(false);
	}

	function handleFilterChange(warehouse: string, search: string) {
		selectedWarehouse = warehouse;
		searchQuery = search;
		hasMore = true;
		loadDeliveries(true);
	}

	function handleRowClick(delivery: DeliveryRecord) {
		selectedDelivery = delivery;
		isAccordionOpen = true;
		isTrackingExpanded = false;

		// Smoothly scroll to the accordion after opening
		setTimeout(() => {
			accordionElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		}, 60);
	}

	function toggleAccordion() {
		isAccordionOpen = !isAccordionOpen;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			if (isConfirmTerminalStatusModalOpen) {
				isConfirmTerminalStatusModalOpen = false;
				return;
			}
			if (isOpen) {
				onClose();
			}
		}
	}

	function openTerminalConfirm(status: DeliveryStatus, note: string) {
		terminalConfirmStatus = status;
		terminalConfirmNote = note;
		isConfirmTerminalStatusModalOpen = true;
	}

	async function handleConfirmTerminalStatus() {
		if (!selectedDelivery) return;
		isSubmittingTerminalStatus = true;
		const res = await createStatus(terminalConfirmStatus, terminalConfirmNote);
		isSubmittingTerminalStatus = false;
		if (res.ok) {
			isConfirmTerminalStatusModalOpen = false;
			terminalConfirmNote = '';
		} else {
			alert(res.error || 'Failed to transition to terminal status.');
		}
	}

	async function createStatus(status: DeliveryStatus, note: string): Promise<{ ok: boolean; error?: string }> {
		if (!selectedDelivery) return { ok: false, error: 'No delivery selected.' };

		try {
			const res = await fetch('/api/history/status', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					deliveryId: selectedDelivery.id,
					status,
					note: note.trim() || null
				})
			});

			const data = await res.json();
			if (!res.ok) {
				return { ok: false, error: data.error || 'Failed to record new delivery status.' };
			}

			const newTracking: StatusTrackingRecord = data.tracking;
			if (!selectedDelivery.statusHistory) {
				selectedDelivery.statusHistory = [];
			}
			selectedDelivery.statusHistory = [newTracking, ...selectedDelivery.statusHistory];
			selectedDelivery.status = newTracking.status;
			if (newTracking.status === 'DELIVERED') {
				selectedDelivery.arrivedDate = newTracking.createdDate;
			}

			// Update deliveries array so main table updates immediately
			deliveries = deliveries.map((d) => (d.id === selectedDelivery?.id ? { ...selectedDelivery } : d));

			// Notify parent of updated warehouse inventories if stock was reverted (e.g. CANCELED)
			if (data.warehouses && onWarehousesUpdated) {
				onWarehousesUpdated(data.warehouses);
			}

			return { ok: true };
		} catch (err) {
			return { ok: false, error: err instanceof Error ? err.message : 'Unknown error occurred.' };
		}
	}

	async function deleteStatus(id: number): Promise<{ ok: boolean; error?: string }> {
		if (!selectedDelivery) return { ok: false, error: 'No delivery selected.' };

		try {
			const res = await fetch('/api/history/status', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id, deliveryId: selectedDelivery.id })
			});

			const data = await res.json();
			if (!res.ok) {
				return { ok: false, error: data.error || 'Failed to delete status.' };
			}

			selectedDelivery.statusHistory = (selectedDelivery.statusHistory ?? []).filter((s) => s.id !== id);
			const remaining = selectedDelivery.statusHistory;
			selectedDelivery.status = remaining.length > 0 ? remaining[0].status : 'ON_PROCESS';

			deliveries = deliveries.map((d) => (d.id === selectedDelivery?.id ? { ...selectedDelivery } : d));
			return { ok: true };
		} catch (err) {
			return { ok: false, error: err instanceof Error ? err.message : 'Failed to delete status.' };
		}
	}

	async function updateStatusNote(id: number, note: string): Promise<{ ok: boolean; error?: string }> {
		if (!selectedDelivery) return { ok: false, error: 'No delivery selected.' };

		try {
			const res = await fetch('/api/history/status', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id,
					deliveryId: selectedDelivery.id,
					note: note.trim()
				})
			});

			const data = await res.json();
			if (!res.ok) {
				return { ok: false, error: data.error || 'Failed to update status note.' };
			}

			const updatedNote = data.tracking?.note !== undefined ? data.tracking.note : (note.trim() || null);
			if (selectedDelivery.statusHistory) {
				const item = selectedDelivery.statusHistory.find((s) => s.id === id);
				if (item) {
					item.note = updatedNote;
				}
			}

			deliveries = deliveries.map((d) => (d.id === selectedDelivery?.id ? { ...selectedDelivery } : d));
			return { ok: true };
		} catch (err) {
			return { ok: false, error: err instanceof Error ? err.message : 'Failed to update status note.' };
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
	<!-- Modal Backdrop Overlay with Frosted Glass -->
	<div
		transition:fade={{ duration: 150 }}
		class="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6"
		role="dialog"
		aria-modal="true"
		aria-labelledby="history-modal-title"
	>
		<!-- Modal Window Box with Upward Easing Fly Animation -->
		<div
			in:fly={{ y: 28, duration: 200, easing: cubicOut }}
			out:fly={{ y: 28, duration: 150, easing: cubicOut }}
			class="relative w-full max-w-6xl h-[92vh] flex flex-col rounded-none border border-zinc-700 bg-zinc-950 text-zinc-100 shadow-2xl overflow-hidden font-sans"
		>
			<!-- Modal Header Bar -->
			<div class="px-5 py-3 border-b border-zinc-800 bg-zinc-900 flex items-center justify-between shrink-0 font-mono">
				<div class="flex items-center gap-3">
					<div class="flex items-center justify-center w-6 h-6 rounded-none bg-emerald-500 text-zinc-950 font-black text-xs">
						&gt;_
					</div>
					<div>
						<h2 id="history-modal-title" class="font-bold text-sm tracking-wide text-zinc-100 uppercase">
							LOGISTICS TELEMETRY &amp; DISPATCH ARCHIVE
						</h2>
						<p class="text-[11px] text-zinc-400 font-sans">
							Live telemetry, manifests, and chronological status tracking across East Java regional hubs.
						</p>
					</div>
				</div>

				<button
					type="button"
					onclick={onClose}
					class="px-2.5 py-1 text-xs font-bold rounded-none bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100 border border-zinc-700 transition-colors cursor-pointer"
					aria-label="Close delivery telemetry modal"
				>
					[✕ ESC]
				</button>
			</div>

			<!-- Modal Body (Scrollable Container containing Main Table & Bottom Accordion) -->
			<div class="flex-1 overflow-y-auto divide-y divide-zinc-800 flex flex-col min-h-0">
				<!-- Section 1: Main History Table & Filters -->
				<DeliveryTable
					{deliveries}
					{selectedDelivery}
					{isLoading}
					{isLoadingMore}
					{hasMore}
					{totalRecords}
					{error}
					{isAccordionOpen}
					{selectedWarehouse}
					{searchQuery}
					onSelectDelivery={handleRowClick}
					onLoadMore={handleLoadMore}
					onFilterChange={handleFilterChange}
				/>

				<!-- Section 2: Bottom Accordion for Delivery Detail Inspector & Status Tracking -->
				<div bind:this={accordionElement} class="border-t border-zinc-800 bg-zinc-900 shrink-0">
					<!-- Accordion Header Bar -->
					<button
						type="button"
						onclick={toggleAccordion}
						class="w-full px-5 py-2.5 bg-zinc-950 hover:bg-zinc-900 transition-colors flex items-center justify-between gap-3 text-left cursor-pointer border-b border-zinc-800"
						aria-expanded={isAccordionOpen}
					>
						<div class="flex items-center gap-2.5 flex-wrap">
							<span class="w-2.5 h-2.5 rounded-none bg-emerald-500"></span>
							<span class="font-bold text-xs uppercase tracking-wide text-zinc-100 font-mono">
								MANIFEST INSPECTOR &amp; CARGO AUDIT:
							</span>
							{#if selectedDelivery}
								<div class="flex items-center gap-1.5 flex-wrap">
									<span class="font-bold text-xs text-emerald-400 font-mono">
										[{selectedDelivery.id}]
									</span>
									<span class="text-xs text-zinc-300 font-mono">
										&bull; {selectedDelivery.warehouseCity} ({selectedDelivery.warehouseId})
									</span>
									{#if selectedDelivery.status === 'DELIVERED'}
										<span class="text-[11px] font-bold px-1.5 py-0.2 rounded-none bg-emerald-950 text-emerald-300 border border-emerald-700/70 font-mono">
											[STATUS: DELIVERED]
										</span>
									{:else if selectedDelivery.status === 'ON_DELIVERY'}
										<span class="text-[11px] font-bold px-1.5 py-0.2 rounded-none bg-amber-950 text-amber-300 border border-amber-700/70 font-mono">
											[STATUS: ON_DELIVERY]
										</span>
									{:else if selectedDelivery.status === 'CANCELED'}
										<span class="text-[11px] font-bold px-1.5 py-0.2 rounded-none bg-rose-950 text-rose-300 border border-rose-700/70 font-mono">
											[STATUS: CANCELED]
										</span>
									{:else}
										<span class="text-[11px] font-bold px-1.5 py-0.2 rounded-none bg-sky-950 text-sky-300 border border-sky-700/70 font-mono">
											[STATUS: ON_PROCESS]
										</span>
									{/if}
								</div>
							{:else}
								<span class="text-xs font-semibold text-zinc-500 font-mono">
									[SELECT ANY DELIVERY ROW ABOVE TO OPEN MANIFEST TELEMETRY]
								</span>
							{/if}
						</div>

						<div class="flex items-center gap-2 shrink-0">
							<span class="text-[11px] font-semibold text-emerald-400 hidden sm:inline font-mono">
								{isAccordionOpen ? '[COLLAPSE]' : '[EXPAND]'}
							</span>
							<span class="w-5 h-5 rounded-none bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 text-xs">
								{isAccordionOpen ? '▲' : '▼'}
							</span>
						</div>
					</button>

					<!-- Accordion Body Content -->
					{#if isAccordionOpen}
						<div class="relative p-4 sm:p-5 bg-zinc-900 space-y-4 max-h-[46vh] {isTrackingExpanded ? 'overflow-hidden' : 'overflow-y-auto'} transition-all duration-200 ease-out">
							{#if selectedDelivery}
								<DeliveryManifestDetails delivery={selectedDelivery} />

								<DeliveryStatusTimeline
									delivery={selectedDelivery}
									isDeliveryLocked={isTerminalDeliveryStatus(selectedDelivery.status)}
									{isTrackingExpanded}
									onToggleExpand={() => (isTrackingExpanded = !isTrackingExpanded)}
									onCreateStatus={createStatus}
									onDeleteStatus={deleteStatus}
									onUpdateNote={updateStatusNote}
									onRequestTerminalConfirm={openTerminalConfirm}
								/>
							{:else}
								<div class="py-6 text-center text-zinc-500 text-xs font-mono">
									[Select a delivery row from the table above to view manifest details and status tracking.]
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</div>

			<!-- Modal Footer -->
			<div class="px-5 py-2.5 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between shrink-0 text-xs text-zinc-400 font-mono">
				<span>
					&gt; CLICK ANY ROW IN TABLE TO INSPECT MANIFEST &amp; STATUS AUDIT TRAIL
				</span>
				<button
					type="button"
					onclick={onClose}
					class="px-4 py-1.5 text-xs font-semibold rounded-none bg-zinc-800 hover:bg-zinc-700 text-zinc-100 transition-colors cursor-pointer border border-zinc-700"
				>
					[CLOSE]
				</button>
			</div>
		</div>
	</div>
{/if}

<TerminalStatusConfirmModal
	isOpen={isConfirmTerminalStatusModalOpen}
	delivery={selectedDelivery}
	targetStatus={terminalConfirmStatus}
	note={terminalConfirmNote}
	isSubmitting={isSubmittingTerminalStatus}
	onConfirm={handleConfirmTerminalStatus}
	onCancel={() => (isConfirmTerminalStatusModalOpen = false)}
/>
