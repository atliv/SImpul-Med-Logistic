<script lang="ts">
	import { formatHumanDateTime } from '#lib/domain/utils/dateFormat.js';
	import {
		ALL_DELIVERY_STATUSES,
		type DeliveryStatus,
		isTerminalDeliveryStatus,
		isDeliveryStatusDeletable
	} from '#lib/domain/model/HistoricalDelivery.js';
	import type { DeliveryRecord, StatusTrackingRecord } from './types.js';

	interface Props {
		delivery: DeliveryRecord;
		isDeliveryLocked: boolean;
		isTrackingExpanded: boolean;
		onToggleExpand: () => void;
		onCreateStatus: (status: DeliveryStatus, note: string) => Promise<{ ok: boolean; error?: string }>;
		onDeleteStatus: (id: number) => Promise<{ ok: boolean; error?: string }>;
		onUpdateNote: (id: number, note: string) => Promise<{ ok: boolean; error?: string }>;
		onRequestTerminalConfirm: (status: DeliveryStatus, note: string) => void;
	}

	let {
		delivery,
		isDeliveryLocked,
		isTrackingExpanded,
		onToggleExpand,
		onCreateStatus,
		onDeleteStatus,
		onUpdateNote,
		onRequestTerminalConfirm
	}: Props = $props();

	// Creation Form State
	let isCreatingStatus = $state(false);
	let newStatusValue = $state<DeliveryStatus>('ON_DELIVERY');
	let newStatusNote = $state<string>('');
	let isSubmittingStatus = $state(false);
	let isDeletingStatus = $state(false);
	let statusFormError = $state<string | null>(null);

	// Note Editing State
	let editingStatusId = $state<number | null>(null);
	let editingNoteText = $state<string>('');
	let isUpdatingNote = $state(false);
	let noteUpdateError = $state<string | null>(null);

	let copiedDeliveryId = $state<string | null>(null);

	// Compute list of unassigned statuses for delivery (must be unique in 1 delivery)
	const availableStatuses = $derived.by(() => {
		const usedStatuses = new Set((delivery.statusHistory ?? []).map((s) => s.status));
		return ALL_DELIVERY_STATUSES.filter((st) => !usedStatuses.has(st));
	});

	// Status history: Newest to oldest status (DESC)
	const displayStatusHistory = $derived.by(() => {
		if (!delivery?.statusHistory) return [];
		return [...delivery.statusHistory].sort((a, b) => b.id - a.id);
	});

	// Auto-select first available unassigned status when available list changes
	$effect(() => {
		if (availableStatuses.length > 0 && !availableStatuses.includes(newStatusValue)) {
			newStatusValue = availableStatuses[0];
		}
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

	function handleSubmitStatusClick() {
		if (isTerminalDeliveryStatus(newStatusValue)) {
			onRequestTerminalConfirm(newStatusValue, newStatusNote.trim());
		} else {
			executeCreateStatus();
		}
	}

	export async function executeCreateStatus(): Promise<boolean> {
		isSubmittingStatus = true;
		statusFormError = null;

		const res = await onCreateStatus(newStatusValue, newStatusNote.trim());
		isSubmittingStatus = false;

		if (res.ok) {
			isCreatingStatus = false;
			newStatusNote = '';
			return true;
		} else {
			statusFormError = res.error || 'Failed to record new delivery status.';
			return false;
		}
	}

	async function handleDeleteClick(id: number) {
		if (isDeliveryLocked) {
			alert('Delivery is in a finalized terminal state (DELIVERED/CANCELED). Status history is permanently locked and cannot be deleted.');
			return;
		}

		if (!confirm('Are you sure you want to remove this delivery status record?')) return;
		isDeletingStatus = true;

		const res = await onDeleteStatus(id);
		isDeletingStatus = false;

		if (!res.ok) {
			alert(res.error || 'Failed to delete status.');
		}
	}

	function startEditNote(track: StatusTrackingRecord) {
		if (isDeliveryLocked) return;
		editingStatusId = track.id;
		editingNoteText = track.note ?? '';
		noteUpdateError = null;
	}

	export function cancelEditNote() {
		editingStatusId = null;
		editingNoteText = '';
		noteUpdateError = null;
	}

	export function closeCreationForm() {
		isCreatingStatus = false;
		statusFormError = null;
	}

	async function handleSaveNoteClick(track: StatusTrackingRecord) {
		if (isDeliveryLocked) {
			noteUpdateError = 'Delivery is finalized (DELIVERED/CANCELED). Audit trail is permanently locked.';
			return;
		}

		isUpdatingNote = true;
		noteUpdateError = null;

		const res = await onUpdateNote(track.id, editingNoteText.trim());
		isUpdatingNote = false;

		if (res.ok) {
			editingStatusId = null;
			editingNoteText = '';
		} else {
			noteUpdateError = res.error || 'Failed to update status note.';
		}
	}
</script>

<!-- Unified Delivery Status Tracking & Audit Trail Component -->
<div
	class="{isTrackingExpanded
		? 'absolute inset-0 z-30 bg-zinc-950 flex flex-col h-full border border-emerald-500/80 shadow-2xl'
		: 'rounded-none border border-zinc-800 overflow-hidden bg-zinc-950 flex flex-col'} font-mono transition-all duration-200 ease-out"
>
	<!-- Component Header Bar -->
	<div class="px-4 py-2.5 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between text-xs gap-3 shrink-0">
		<div class="flex items-center gap-2 flex-wrap">
			<span class="w-2 h-2 rounded-none bg-emerald-500 animate-pulse"></span>
			<span class="font-bold text-zinc-100 tracking-wide uppercase">
				DELIVERY STATUS TRACKING &amp; AUDIT TRAIL ({delivery.statusHistory?.length ?? 0} LOGS)
			</span>
			<span class="text-zinc-600 hidden sm:inline">|</span>
			<span class="text-[11px] text-zinc-400 flex items-center gap-1.5">
				TRANSACTION DELIVERY ID: <strong class="text-zinc-200">{delivery.id}</strong>
				<button
					type="button"
					onclick={() => copyDeliveryId(delivery.id)}
					class="p-0.5 rounded-none text-zinc-400 hover:text-emerald-300 hover:bg-zinc-800 transition-colors cursor-pointer"
					title="Copy Transaction Delivery ID"
				>
					{#if copiedDeliveryId === delivery.id}
						<span class="text-emerald-400 text-[10px] font-bold">✓</span>
					{:else}
						<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
						</svg>
					{/if}
				</button>
			</span>
		</div>

		<!-- Expand / Default Toggle Button (Covering Manifest Inspector) -->
		<div class="flex items-center gap-2 shrink-0">
			<button
				type="button"
				onclick={onToggleExpand}
				class="px-2.5 py-1 text-[11px] font-bold rounded-none bg-zinc-800 hover:bg-zinc-700 text-emerald-400 border border-zinc-700 transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
				title={isTrackingExpanded ? 'Restore default inspector layout' : 'Expand tracking view to cover manifest inspector'}
			>
				{#if isTrackingExpanded}
					<span>⤡</span> [DEFAULT]
				{:else}
					<span>⤢</span> [EXPAND]
				{/if}
			</button>
		</div>
	</div>

	<!-- Integrated Creation Action & Informative Note Section -->
	<div class="p-3.5 bg-zinc-950 border-b border-zinc-800/80 space-y-2 shrink-0">
		{#if isDeliveryLocked}
			<div class="w-full py-2.5 px-3.5 rounded-none border border-amber-800/60 bg-amber-950/20 text-amber-300 font-mono text-xs flex items-center justify-between gap-2 shadow-sm">
				<span class="flex items-center gap-2">
					<span class="text-amber-400 font-bold">🔒</span>
					<span>TERMINAL STATE [{delivery.status}]: AUDIT TRAIL PERMANENTLY LOCKED &amp; IMMUTABLE</span>
				</span>
				<span class="text-[10px] px-2 py-0.5 bg-zinc-900 border border-amber-700/60 text-amber-300 font-bold shrink-0">
					LOCKED
				</span>
			</div>
		{:else if !isCreatingStatus}
			<button
				type="button"
				onclick={() => (isCreatingStatus = true)}
				class="w-full py-2.5 px-4 rounded-none bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-mono font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer border border-emerald-500 flex items-center justify-center gap-2 shadow-sm"
			>
				<span>➕</span> [CREATE NEW STATUS DELIVERY]
			</button>
		{:else}
			<!-- Status Creation Form -->
			<div class="rounded-none border border-emerald-600/70 bg-zinc-900/90 p-3.5 space-y-3 font-mono text-xs shadow-md">
				<div class="flex items-center justify-between border-b border-zinc-800 pb-2">
					<span class="font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
						<span>➕</span> CREATE NEW STATUS FOR DELIVERY {delivery.id}
					</span>
					<button
						type="button"
						onclick={closeCreationForm}
						class="text-zinc-500 hover:text-zinc-300 text-xs cursor-pointer"
					>
						[✕ CANCEL]
					</button>
				</div>

				{#if availableStatuses.length === 0}
					<div class="p-2.5 bg-zinc-900 border border-zinc-800 text-amber-400 text-xs">
						All lifecycle statuses have already been assigned to this delivery.
					</div>
				{:else}
					<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
						<div>
							<label for="new-status-select" class="block text-zinc-400 font-semibold mb-1 text-[11px]">
								NEW STATUS (UNIQUE PER DELIVERY):
							</label>
							<select
								id="new-status-select"
								bind:value={newStatusValue}
								class="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 py-1.5 px-2.5 text-xs focus:outline-none focus:border-emerald-500 font-mono"
							>
								{#each availableStatuses as st}
									<option value={st}>[{st}]</option>
								{/each}
							</select>
							<p class="text-[10px] text-zinc-500 mt-1">
								* Only unassigned statuses are selectable.
							</p>
						</div>

						<div>
							<label for="new-status-note" class="block text-zinc-400 font-semibold mb-1 text-[11px]">
								NOTE (OPTIONAL):
							</label>
							<input
								id="new-status-note"
								type="text"
								bind:value={newStatusNote}
								placeholder="e.g., Dispatched on highway, gate arrival, inspection cleared..."
								class="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 py-1.5 px-2.5 text-xs focus:outline-none focus:border-emerald-500 font-mono placeholder:text-zinc-600"
							/>
						</div>
					</div>

					{#if statusFormError}
						<div class="p-2 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
							[ERROR: {statusFormError}]
						</div>
					{/if}

					<div class="flex items-center justify-end gap-2 pt-1 border-t border-zinc-800/80">
						<button
							type="button"
							disabled={isSubmittingStatus}
							onclick={closeCreationForm}
							class="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs border border-zinc-700 cursor-pointer"
						>
							[CANCEL]
						</button>
						<button
							type="button"
							disabled={isSubmittingStatus || availableStatuses.length === 0}
							onclick={handleSubmitStatusClick}
							class="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-zinc-950 font-bold text-xs border border-emerald-500 transition-colors cursor-pointer flex items-center gap-1.5"
						>
							{#if isSubmittingStatus}
								<span class="animate-spin">⏳</span> [SAVING...]
							{:else}
								<span>✓</span> [CONFIRM &amp; RECORD STATUS]
							{/if}
						</button>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Note after button "create new status" -->
		<div class="flex items-center justify-between text-[11px] text-zinc-400 font-mono pt-1">
			<span class="flex items-center gap-1.5 text-zinc-400">
				<span class="text-emerald-400 font-bold">↓</span>
				{#if isDeliveryLocked}
					<span class="text-amber-400/90">* Delivery concluded ({delivery.status}). Status records and notes cannot be edited or deleted.</span>
				{:else}
					<span>* Scroll to see the full details • Click [EDIT NOTE] to update remarks</span>
				{/if}
			</span>
			{#if isTrackingExpanded}
				<span class="text-emerald-400 font-semibold hidden sm:inline">[EXPANDED INSPECTOR VIEW ACTIVE]</span>
			{/if}
		</div>
	</div>

	<!-- Scrollable Vertical Milestone Timeline Stream (Newest to Oldest DESC) -->
	<div class="{isTrackingExpanded ? 'flex-1 overflow-y-auto' : 'max-h-[280px] overflow-y-auto'} p-4 sm:p-5">
		{#if displayStatusHistory.length === 0}
			<div class="py-8 text-center text-zinc-500 text-xs">
				[NO STATUS AUDIT TRAIL LOGGED FOR THIS DISPATCH]
			</div>
		{:else}
			<div class="space-y-0">
				{#each displayStatusHistory as track, index (track.id)}
					{@const isCurrent = index === 0}
					{@const isInitial = index === displayStatusHistory.length - 1}
					<div class="relative pl-10 sm:pl-11 pb-5 last:pb-0 group">
						<!-- Connecting line to NEXT item (only rendered when there is a subsequent item; never below bottomest item) -->
						{#if index < displayStatusHistory.length - 1}
							<div class="absolute left-[15px] top-[28px] bottom-0 w-[2px] bg-zinc-800 pointer-events-none"></div>
						{/if}

						<!-- Timeline Circular Ring on the Left (Matching uploaded reference with pulse effect on current) -->
						<div class="absolute left-1 top-1 w-6 h-6 flex items-center justify-center">
							{#if isCurrent}
								<!-- Expanding radar ping effect -->
								<span class="absolute -inset-1 rounded-full animate-ping opacity-60 {
									track.status === 'DELIVERED'
										? 'bg-emerald-500'
										: track.status === 'ON_DELIVERY'
											? 'bg-amber-500'
											: track.status === 'CANCELED'
												? 'bg-rose-500'
												: 'bg-sky-500'
								}"></span>
								<!-- Glowing outer pulse ring -->
								<span class="absolute -inset-0.5 rounded-full animate-pulse border {
									track.status === 'DELIVERED'
										? 'border-emerald-400 bg-emerald-500/20'
										: track.status === 'ON_DELIVERY'
											? 'border-amber-400 bg-amber-500/20'
											: track.status === 'CANCELED'
												? 'border-rose-400 bg-rose-500/20'
												: 'border-sky-400 bg-sky-500/20'
								}"></span>
							{/if}

							<!-- Milestone Concentric Ring & Center Dot -->
							<div
								class="relative w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold z-10 {
									track.status === 'DELIVERED'
										? 'bg-zinc-950 text-emerald-300 border-2 border-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.35)]'
										: track.status === 'ON_DELIVERY'
											? 'bg-zinc-950 text-amber-300 border-2 border-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.35)]'
											: track.status === 'CANCELED'
												? 'bg-zinc-950 text-rose-300 border-2 border-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.35)]'
												: 'bg-zinc-950 text-sky-300 border-2 border-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.35)]'
								}"
							>
								{#if track.status === 'DELIVERED'}
									<span class="text-xs">✓</span>
								{:else if track.status === 'ON_DELIVERY'}
									<span class="text-xs">⚡</span>
								{:else if track.status === 'CANCELED'}
									<span class="text-xs">✕</span>
								{:else}
									<span class="w-2 h-2 rounded-full bg-sky-400"></span>
								{/if}
							</div>
						</div>

						<!-- Timestamp Header Above Card -->
						<div class="flex items-center gap-2 mb-1.5 flex-wrap">
							<span class="text-xs font-bold text-zinc-200">
								{formatHumanDateTime(track.createdDate, 'compact')}
							</span>
							<span class="text-[11px] text-zinc-500 font-mono">
								{track.createdDate}
							</span>
							{#if isCurrent}
								<span class="px-1.5 py-0.2 text-[9px] font-bold bg-emerald-500 text-zinc-950 tracking-wider">
									CURRENT / LATEST
								</span>
							{:else if isInitial}
								<span class="px-1.5 py-0.2 text-[9px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700 tracking-wider">
									INITIAL EVENT
								</span>
							{/if}
						</div>

						<!-- Card Box in TUI theme -->
						<div
							class="rounded-none border transition-colors p-3.5 space-y-2 {
								isCurrent
									? 'bg-zinc-900/95 border-emerald-600/60 shadow-sm'
									: 'bg-zinc-950/70 border-zinc-800 hover:border-zinc-700'
							}"
						>
							<div class="flex items-center justify-between gap-3 flex-wrap">
								<div class="flex items-center gap-2">
									<!-- Status Title -->
									{#if track.status === 'DELIVERED'}
										<span class="text-xs sm:text-sm font-bold text-emerald-400 flex items-center gap-1.5">
											<span>✓</span> DELIVERED
										</span>
									{:else if track.status === 'ON_DELIVERY'}
										<span class="text-xs sm:text-sm font-bold text-amber-400 flex items-center gap-1.5">
											<span>⚡</span> ON DELIVERY
										</span>
									{:else if track.status === 'CANCELED'}
										<span class="text-xs sm:text-sm font-bold text-rose-400 flex items-center gap-1.5">
											<span>✕</span> CANCELED
										</span>
									{:else}
										<span class="text-xs sm:text-sm font-bold text-sky-400 flex items-center gap-1.5">
											<span>⏳</span> ON PROCESS
										</span>
									{/if}

									<span class="text-[10px] px-1.5 py-0.2 bg-zinc-800 text-zinc-400 border border-zinc-700 font-mono">
										ID #{track.id}
									</span>
								</div>

								<!-- Action Buttons (Delete & Edit if allowed) -->
								<div class="flex items-center gap-1.5">
									{#if !isDeliveryLocked && editingStatusId !== track.id}
										<button
											type="button"
											onclick={() => startEditNote(track)}
											class="px-2 py-0.5 text-[10px] font-mono text-zinc-300 hover:text-emerald-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-emerald-500/60 transition-colors cursor-pointer flex items-center gap-1"
											title="Edit status note"
										>
											<span>✎</span> [EDIT NOTE]
										</button>
									{/if}

									{#if !isDeliveryLocked && isDeliveryStatusDeletable(track.status, delivery.status)}
										<button
											type="button"
											disabled={isDeletingStatus}
											onclick={() => handleDeleteClick(track.id)}
											class="px-2.5 py-1 text-[10px] font-bold text-rose-400 hover:text-rose-100 bg-rose-950/60 hover:bg-rose-900 border border-rose-800 transition-colors cursor-pointer flex items-center gap-1"
											title="Delete intermediate status record"
										>
											<span>✕</span> [DELETE]
										</button>
									{:else}
										<span
											class="text-[10px] text-zinc-500 font-mono px-1.5 py-0.5 bg-zinc-900 border border-zinc-800/80"
											title={isDeliveryLocked ? `Delivery concluded (${delivery.status}). Audit record locked.` : "ON_PROCESS, CANCELED, and DELIVERED cannot be deleted by business rule"}
										>
											[LOCKED RECORD]
										</span>
									{/if}
								</div>
							</div>

							<!-- Note / Inline Editor Section -->
							{#if editingStatusId === track.id}
								<div class="space-y-2 pt-1 font-mono">
									<div class="text-[11px] text-emerald-400 font-bold flex items-center gap-1.5">
										<span>✎</span> EDIT NOTE FOR STATUS #{track.id} [{track.status}]
									</div>
									<input
										type="text"
										bind:value={editingNoteText}
										placeholder="Enter status remarks or note..."
										maxlength={300}
										class="w-full text-xs bg-zinc-950 text-zinc-100 placeholder:text-zinc-600 border border-emerald-500 rounded-none px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400 font-mono"
										onkeydown={(e) => {
											if (e.key === 'Enter') handleSaveNoteClick(track);
											if (e.key === 'Escape') cancelEditNote();
										}}
									/>
									{#if noteUpdateError}
										<div class="p-1.5 bg-rose-950/60 border border-rose-800 text-[11px] text-rose-300 font-mono">
											[ERROR: {noteUpdateError}]
										</div>
									{/if}
									<div class="flex items-center gap-2">
										<button
											type="button"
											disabled={isUpdatingNote}
											onclick={() => handleSaveNoteClick(track)}
											class="px-3 py-1 text-[10px] font-bold text-zinc-950 bg-emerald-400 hover:bg-emerald-300 rounded-none border border-emerald-300 transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
										>
											{#if isUpdatingNote}
												<span class="animate-spin text-[10px]">◴</span> [SAVING...]
											{:else}
												<span>✓</span> [SAVE NOTE]
											{/if}
										</button>
										<button
											type="button"
											disabled={isUpdatingNote}
											onclick={cancelEditNote}
											class="px-2.5 py-1 text-[10px] font-medium text-zinc-300 hover:text-zinc-100 bg-zinc-800 hover:bg-zinc-700 rounded-none border border-zinc-600 transition-colors cursor-pointer"
										>
											[CANCEL]
										</button>
										<span class="text-[10px] text-zinc-500 font-mono hidden sm:inline">Press Enter to save, Esc to cancel</span>
									</div>
								</div>
							{:else}
								<!-- Note / Subtitle description -->
								<p class="text-xs text-zinc-300 font-sans leading-relaxed">
									{#if track.note}
										{track.note}
									{:else if track.status === 'DELIVERED'}
										Delivered at {track.createdDate} destination hub.
									{:else if track.status === 'ON_DELIVERY'}
										Out for delivery at {track.createdDate} via corridor dispatch.
									{:else if track.status === 'CANCELED'}
										Order canceled at {track.createdDate}.
									{:else}
										Registered and processing at {track.createdDate}.
									{/if}
								</p>
							{/if}

							<!-- Sub-details reference footer -->
							<div class="pt-1.5 border-t border-zinc-800/60 flex items-center justify-between text-[10px] text-zinc-500">
								<span>Transaction Delivery ID: <span class="text-zinc-400 font-bold">{track.deliveryId}</span></span>
								<span>Timestamp: <span class="text-zinc-400">{track.createdDate}</span></span>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
