<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	interface Props {
		isOpen: boolean;
		isResetting: boolean;
		onConfirm: () => void;
		onCancel: () => void;
	}

	let { isOpen, isResetting, onConfirm, onCancel }: Props = $props();

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
		if (e.key === 'Escape' && isOpen && !isResetting) {
			onCancel();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
	<div
		transition:fade={{ duration: 180 }}
		class="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen min-h-[100dvh] z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-md"
	>
		<!-- Modal Backdrop Click Dismiss -->
		<button
			type="button"
			class="fixed inset-0 top-0 left-0 right-0 bottom-0 w-full h-full cursor-default bg-transparent -z-10"
			onclick={onCancel}
			aria-label="Close modal backdrop"
		></button>

		<div
			in:fly={{ y: 28, duration: 180, easing: cubicOut }}
			out:fly={{ y: -24, duration: 150, easing: cubicOut }}
			class="bg-zinc-900/95 rounded-none shadow-2xl border border-zinc-700 max-w-md w-full p-6 space-y-4 text-zinc-100 font-mono"
			role="dialog"
			aria-modal="true"
			aria-labelledby="modal-title"
		>
			<div class="flex items-start gap-3.5">
				<div class="flex items-center justify-center w-9 h-9 rounded-none bg-amber-950/80 border border-amber-700 text-amber-400 shrink-0 font-bold">
					!
				</div>
				<div>
					<h3 id="modal-title" class="text-sm font-bold text-zinc-100 uppercase tracking-wide">
						RESET INVENTORY TO BASELINE DEFAULTS?
					</h3>
					<p class="text-xs text-zinc-400 mt-1 font-sans">
						This operation will restore stock counts across all 8 regional warehouses back to baseline domain specifications and clear any active staged dispatch plans.
					</p>
				</div>
			</div>

			<div class="bg-zinc-950 rounded-none p-3 text-xs text-zinc-300 space-y-1 border border-zinc-800 font-mono">
				<div class="font-bold text-zinc-200">[TARGET RESTORATION MATRIX]:</div>
				<div class="text-zinc-400">&bull; W01: 200 Gloves, 500 Syringes, 300 Paracetamol</div>
				<div class="text-zinc-400">&bull; W02: 50 Gloves, 30 Hep B, 20 Tetanus</div>
				<div class="text-zinc-400">&bull; W03–W08: Standard catalog capacities</div>
			</div>

			<div class="flex items-center justify-end gap-2.5 pt-2">
				<button
					type="button"
					onclick={onCancel}
					disabled={isResetting}
					class="px-4 py-2 rounded-none text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors cursor-pointer"
				>
					[CANCEL]
				</button>
				<button
					type="button"
					onclick={onConfirm}
					disabled={isResetting}
					class="inline-flex items-center gap-2 px-4 py-2 rounded-none text-xs font-bold text-zinc-950 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 transition-colors border border-amber-400 cursor-pointer shadow-md shadow-amber-950/50"
				>
					{#if isResetting}
						<svg class="animate-spin w-4 h-4 text-zinc-950" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						<span>[RESTORING...]</span>
					{:else}
						<span>[CONFIRM RESET]</span>
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
