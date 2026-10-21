<script lang="ts">
	import type { DeliveryStatus } from '#lib/domain/model/HistoricalDelivery.js';
	import type { DeliveryRecord } from './types.js';
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	interface Props {
		isOpen: boolean;
		delivery: DeliveryRecord | null;
		targetStatus: DeliveryStatus;
		note: string;
		isSubmitting: boolean;
		onConfirm: () => void;
		onCancel: () => void;
	}

	let {
		isOpen,
		delivery,
		targetStatus,
		note,
		isSubmitting,
		onConfirm,
		onCancel
	}: Props = $props();
</script>

{#if isOpen && delivery}
	<div
		transition:fade={{ duration: 180 }}
		class="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen min-h-[100dvh] z-[70] flex items-center justify-center p-4 bg-zinc-950/75 backdrop-blur-md"
		role="dialog"
		aria-modal="true"
		aria-labelledby="confirm-terminal-status-title"
	>
		<!-- Modal Backdrop Click Dismiss -->
		<button
			type="button"
			class="fixed inset-0 top-0 left-0 right-0 bottom-0 w-full h-full cursor-default bg-transparent -z-10"
			onclick={onCancel}
			aria-label="Close modal backdrop"
		></button>

		<div
			in:fly={{ y: 24, duration: 180, easing: cubicOut }}
			out:fly={{ y: -20, duration: 150, easing: cubicOut }}
			class="bg-zinc-900/95 rounded-none shadow-2xl border {targetStatus === 'CANCELED' ? 'border-rose-700' : 'border-emerald-600'} max-w-md w-full p-5 sm:p-6 space-y-4 text-zinc-100 font-mono"
		>
			<div class="flex items-start gap-3.5">
				<div class="flex items-center justify-center w-10 h-10 rounded-none shrink-0 font-bold text-lg {targetStatus === 'CANCELED' ? 'bg-rose-950/80 border border-rose-600 text-rose-400' : 'bg-emerald-950/80 border border-emerald-600 text-emerald-400'}">
					{targetStatus === 'CANCELED' ? '✕' : '✓'}
				</div>
				<div>
					<h3 id="confirm-terminal-status-title" class="text-sm font-bold text-zinc-100 uppercase tracking-wide">
						CONFIRM TERMINAL STATUS: [{targetStatus}]?
					</h3>
					<p class="text-xs text-zinc-400 mt-1 font-sans">
						Transitioning this dispatch to <strong class="{targetStatus === 'CANCELED' ? 'text-rose-400' : 'text-emerald-400'}">{targetStatus}</strong> is an irreversible action.
					</p>
				</div>
			</div>

			<!-- Terminal Locking Warning Callout -->
			<div class="bg-zinc-950 rounded-none p-3.5 text-xs text-zinc-300 space-y-2 border border-zinc-800 font-mono">
				<div class="flex items-center justify-between border-b border-zinc-800 pb-1.5">
					<span class="text-zinc-500">TARGET DELIVERY:</span>
					<span class="font-bold text-zinc-100">{delivery.id} ({delivery.warehouseCity})</span>
				</div>
				<div class="flex items-center justify-between border-b border-zinc-800 pb-1.5">
					<span class="text-zinc-500">NEW STATUS:</span>
					<span class="font-bold {targetStatus === 'CANCELED' ? 'text-rose-400' : 'text-emerald-400'}">[{targetStatus}]</span>
				</div>
				{#if note.trim()}
					<div class="border-b border-zinc-800 pb-1.5">
						<span class="text-zinc-500">AUDIT REMARK:</span>
						<p class="text-zinc-200 mt-0.5 font-sans italic text-[11px]">"{note.trim()}"</p>
					</div>
				{/if}
				<div class="pt-1 {targetStatus === 'CANCELED' ? 'text-rose-300/90' : 'text-amber-300/90'} space-y-1">
					<div class="font-bold flex items-center gap-1 text-[11px]">
						<span>🔒</span> [AUDIT TRAIL PERMANENT LOCK]:
					</div>
					<ul class="list-disc pl-4 space-y-0.5 text-[10px] text-zinc-400">
						<li>No records can be deleted from status history.</li>
						<li>No further status transitions can be appended.</li>
						<li>All status notes will become permanently read-only.</li>
						{#if targetStatus === 'CANCELED'}
							<li class="text-rose-300 font-semibold">
								Dispatched cargo will be automatically returned to origin warehouse ({delivery.warehouseId}) inventory.
							</li>
						{/if}
					</ul>
				</div>
			</div>

			<div class="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-800">
				<button
					type="button"
					onclick={onCancel}
					disabled={isSubmitting}
					class="px-4 py-2 rounded-none text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors cursor-pointer"
				>
					[CANCEL]
				</button>
				<button
					type="button"
					onclick={onConfirm}
					disabled={isSubmitting}
					class="inline-flex items-center gap-2 px-5 py-2 rounded-none text-xs font-bold transition-colors cursor-pointer shadow-md {targetStatus === 'CANCELED' ? 'text-white bg-rose-600 hover:bg-rose-500 active:bg-rose-700 border border-rose-500 shadow-rose-950/50' : 'text-zinc-950 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 border border-emerald-400 shadow-emerald-950/50'}"
				>
					{#if isSubmitting}
						<span class="animate-spin text-xs">◴</span> [LOCKING STATUS...]
					{:else}
						<span>🔒 [CONFIRM &amp; LOCK AS {targetStatus}]</span>
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
