<script lang="ts">
	import type { PageData } from './$types.js';
	import type { Warehouse } from '#lib/domain/model/Warehouse.js';
	import type { FulfillmentPlan, FulfillmentCandidate } from '#lib/domain/model/FulfillmentPlan.js';
	import type { FulfillmentStrategy } from '#lib/domain/model/Order.js';
	import Header from '#lib/components/Header.svelte';
	import WarehouseTable from '#lib/components/WarehouseTable.svelte';
	import OrderForm from '#lib/components/OrderForm.svelte';
	import FulfillmentResults from '#lib/components/FulfillmentResults.svelte';
	import ResetModal from '#lib/components/ResetModal.svelte';
	import LogisticHistoryModal from '#lib/components/LogisticHistoryModal.svelte';

	let { data }: { data: PageData } = $props();

	// Reactive application state
	let warehouses = $state<Warehouse[]>([]);
	const products = $derived(data.products);

	$effect(() => {
		warehouses = data.warehouses;
	});

	// Order quantity inputs
	let quantities = $state<Record<string, number>>({
		P001: 0,
		P002: 0,
		P003: 0,
		P004: 0,
		P005: 0
	});

	// Active fulfillment strategy (defaults to Nearest-First)
	let strategy = $state<FulfillmentStrategy>('NEAREST_FIRST');

	// Active fulfillment result and candidates
	let plan = $state<FulfillmentPlan | null>(null);
	let candidates = $state<FulfillmentCandidate[]>([]);
	let selectedCandidateId = $state<string>('');
	let isCommitted = $state(false);

	// UI Interaction states
	let isSubmitting = $state(false);
	let isCommitting = $state(false);
	let isResetting = $state(false);
	let isResetModalOpen = $state(false);
	let isHistoryModalOpen = $state(false);
	let isFulfillmentModalOpen = $state(false);
	let notification = $state<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

	// Scroll position for To-Top button
	let scrollY = $state(0);
	const showScrollTop = $derived(scrollY > 200);

	function scrollToTop() {
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	function showNotification(text: string, type: 'success' | 'error' | 'info' = 'info') {
		notification = { text, type };
		setTimeout(() => {
			if (notification?.text === text) {
				notification = null;
			}
		}, 4500);
	}

	function handleSelectPreset(presetKey: 'A' | 'B' | 'C' | 'D') {
		const newQuantities: Record<string, number> = {
			P001: 0,
			P002: 0,
			P003: 0,
			P004: 0,
			P005: 0
		};

		switch (presetKey) {
			case 'A': // Single Wh Match (W01)
				newQuantities.P001 = 50;
				newQuantities.P003 = 100;
				showNotification('Populated Scenario A: 50 Gloves, 100 Syringes (Fulfilled by W01)', 'info');
				break;
			case 'B': // Cold Chain Split (W01 + W02/W04)
				newQuantities.P001 = 50;
				newQuantities.P002 = 20;
				showNotification('Populated Scenario B: 50 Gloves, 20 Hep B Vaccines (Cold Chain)', 'info');
				break;
			case 'C': // High Demand Split
				newQuantities.P001 = 250;
				showNotification('Populated Scenario C: 250 Surgical Gloves (Evaluate Options to compare Splits)', 'info');
				break;
			case 'D': // Insufficient Stock Deficit
				newQuantities.P002 = 200;
				showNotification('Populated Scenario D: 200 Hep B Vaccines (Exceeds Regional Network)', 'error');
				break;
		}

		quantities = newQuantities;
		plan = null;
		candidates = [];
		selectedCandidateId = '';
		isCommitted = false;
		isFulfillmentModalOpen = false;
	}

	function handleClearOrder() {
		quantities = {
			P001: 0,
			P002: 0,
			P003: 0,
			P004: 0,
			P005: 0
		};
		plan = null;
		candidates = [];
		selectedCandidateId = '';
		isCommitted = false;
		isFulfillmentModalOpen = false;
		showNotification('Order cleared.', 'info');
	}

	function handleChangeQuantity(productId: string, val: number) {
		quantities[productId] = val;
		isCommitted = false;
	}

	function handleSelectCandidate(candidate: FulfillmentCandidate) {
		if (isCommitting || isCommitted) return;
		selectedCandidateId = candidate.id;
		plan = candidate.plan;
		strategy = candidate.strategy;
		showNotification(`Switched to: ${candidate.title}`, 'info');
	}

	async function handleSubmitOrder() {
		const items = Object.entries(quantities)
			.filter(([_, qty]) => qty > 0)
			.map(([productId, quantity]) => ({ productId, quantity }));

		if (items.length === 0) {
			showNotification('Please enter at least one item quantity before submitting.', 'error');
			return;
		}

		isSubmitting = true;
		try {
			const res = await fetch('/api/fulfill', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ items, strategy, commit: false })
			});

			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.error || 'Fulfillment evaluation failed.');
			}

			const result = await res.json();
			plan = result.plan;
			candidates = result.candidates || [];
			isCommitted = false;

			const recommended = candidates.find((c) => c.isRecommended) ?? candidates[0];
			selectedCandidateId = recommended?.id ?? '';
			if (recommended) {
				plan = recommended.plan;
				strategy = recommended.strategy;
			}

			if (result.plan.status === 'INSUFFICIENT_STOCK') {
				showNotification('Order cannot be fulfilled due to insufficient regional stock.', 'error');
			} else if (candidates.length > 1) {
				showNotification(`${candidates.length} dispatch options calculated. Compare options and confirm below!`, 'info');
			} else if (result.plan.status === 'FULFILLED') {
				showNotification('Single facility match found. Review and confirm dispatch below.', 'success');
			} else {
				showNotification(`Split fulfillment plan computed across ${result.plan.splitCount} facilities.`, 'info');
			}

			// Open decision modal
			isFulfillmentModalOpen = true;
		} catch (error) {
			const msg = error instanceof Error ? error.message : 'Unknown error occurred.';
			showNotification(msg, 'error');
		} finally {
			isSubmitting = false;
		}
	}

	async function handleConfirmDispatch(deliveryDate?: string) {
		const items = Object.entries(quantities)
			.filter(([_, qty]) => qty > 0)
			.map(([productId, quantity]) => ({ productId, quantity }));

		if (items.length === 0 || !plan) return;

		// Immediately lock candidate list to the chosen candidate that operator finalized
		if (selectedCandidateId && candidates.length > 0) {
			const chosen = candidates.find((c) => c.id === selectedCandidateId);
			if (chosen) {
				candidates = [chosen];
			}
		}

		isCommitting = true;
		try {
			const res = await fetch('/api/fulfill', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ items, strategy, commit: true, deliveryDate })
			});

			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.error || 'Failed to dispatch fulfillment.');
			}

			const result = await res.json();
			plan = result.plan;
			warehouses = result.warehouses;
			isCommitted = true;

			// Ensure candidate list remains locked to the chosen candidate
			if (selectedCandidateId && candidates.length > 0) {
				const chosen = candidates.find((c) => c.id === selectedCandidateId);
				if (chosen) {
					candidates = [chosen];
				}
			}

			// Reset order formulation console form to 0 after finalizing delivery
			quantities = {
				P001: 0,
				P002: 0,
				P003: 0,
				P004: 0,
				P005: 0
			};

			showNotification('Order confirmed! Stock successfully deducted from assigned facilities.', 'success');
		} catch (error) {

			const msg = error instanceof Error ? error.message : 'Unknown error occurred.';
			showNotification(msg, 'error');
		} finally {
			isCommitting = false;
		}
	}

	async function handleConfirmReset() {
		isResetting = true;
		try {
			const res = await fetch('/api/reset', { method: 'POST' });
			if (!res.ok) {
				throw new Error('Failed to reset inventory.');
			}
			const result = await res.json();
			warehouses = result.warehouses;
			plan = null;
			candidates = [];
			selectedCandidateId = '';
			isCommitted = false;
			isFulfillmentModalOpen = false;
			quantities = {
				P001: 0,
				P002: 0,
				P003: 0,
				P004: 0,
				P005: 0
			};
			isResetModalOpen = false;
			showNotification('All warehouse inventories restored to default baseline!', 'success');
		} catch (error) {
			const msg = error instanceof Error ? error.message : 'Failed to reset.';
			showNotification(msg, 'error');
		} finally {
			isResetting = false;
		}
	}

	async function handleUpdateStock(warehouseId: string, productId: string, newStock: number) {
		const res = await fetch('/api/warehouses', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ warehouseId, productId, quantity: newStock })
		});

		if (!res.ok) {
			const err = await res.json();
			throw new Error(err.error || 'Failed to update warehouse stock.');
		}

		const result = await res.json();
		warehouses = result.warehouses;

		// If there is an active uncommitted plan, reset it to avoid stale inventory mismatch
		if (plan && !isCommitted) {
			plan = null;
			candidates = [];
			selectedCandidateId = '';
		}

		showNotification(`Facility ${warehouseId} [${productId}] stock updated to ${newStock} units.`, 'success');
	}
</script>

<svelte:window bind:scrollY />

<main class="max-w-4xl mx-auto px-4 py-8 space-y-6">
	<!-- Floating Toast Notification -->
	{#if notification}
		<div
			class="fixed {showScrollTop ? 'bottom-16' : 'bottom-5'} right-5 z-50 max-w-sm rounded-none p-3.5 shadow-2xl border text-xs font-mono font-semibold flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-150 {notification.type === 'success' ? 'bg-emerald-950 text-emerald-100 border-emerald-700' : notification.type === 'error' ? 'bg-rose-950 text-rose-100 border-rose-700' : 'bg-zinc-950 text-white border-zinc-700'}"
			role="alert"
		>
			<span>
				{#if notification.type === 'success'}[✓]{:else if notification.type === 'error'}[!]{:else}[i]{/if}
			</span>
			<span class="flex-1">{notification.text}</span>
			<button
				type="button"
				onclick={() => (notification = null)}
				class="text-white/60 hover:text-white font-bold ml-1 cursor-pointer font-mono"
			>
				[x]
			</button>
		</div>
	{/if}

	<!-- TUI Style 'To Top' Button in Bottom Right -->
	{#if showScrollTop}
		<button
			type="button"
			onclick={scrollToTop}
			class="fixed bottom-5 right-5 z-40 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold rounded-none bg-zinc-950 text-emerald-400 border border-emerald-500/70 hover:bg-emerald-500 hover:text-zinc-950 hover:border-emerald-400 shadow-xl shadow-black/80 transition-all cursor-pointer group animate-in fade-in slide-in-from-bottom-2 duration-150"
			aria-label="Scroll to top"
			title="Scroll to top"
		>
			<svg class="w-3.5 h-3.5 text-emerald-400 group-hover:text-zinc-950 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 10l7-7m0 0l7 7m-7-7v18" />
			</svg>
			<span class="tracking-wider">[TOP]</span>
		</button>
	{/if}

	<!-- Section: Header & Quick Control Bar -->
	<Header
		onSelectPreset={handleSelectPreset}
		onOpenResetModal={() => (isResetModalOpen = true)}
		onOpenHistoryModal={() => (isHistoryModalOpen = true)}
		{isResetting}
	/>

	<!-- Section 1: Regional Inventory Overview Card -->
	<WarehouseTable
		{warehouses}
		{products}
		onUpdateStock={handleUpdateStock}
	/>

	<!-- Section 2: Order Formulation Card -->
	<OrderForm
		{products}
		{warehouses}
		{quantities}
		{isSubmitting}
		onSubmitOrder={handleSubmitOrder}
		onClearOrder={handleClearOrder}
		onChangeQuantity={handleChangeQuantity}
	/>

	<!-- Section 3: Decision & Finalizing Order Modal -->
	<FulfillmentResults
		isOpen={isFulfillmentModalOpen}
		onClose={() => (isFulfillmentModalOpen = false)}
		{plan}
		{candidates}
		{selectedCandidateId}
		{strategy}
		{isCommitted}
		{isCommitting}
		{products}
		onSelectCandidate={handleSelectCandidate}
		onFinalize={handleConfirmDispatch}
	/>

	<!-- Reset Confirmation Modal -->
	<ResetModal
		isOpen={isResetModalOpen}
		{isResetting}
		onConfirm={handleConfirmReset}
		onCancel={() => (isResetModalOpen = false)}
	/>

	<!-- Logistic History Modal -->
	<LogisticHistoryModal
		isOpen={isHistoryModalOpen}
		onClose={() => (isHistoryModalOpen = false)}
		onWarehousesUpdated={(updated) => (warehouses = updated)}
	/>

	<!-- Footer -->
	<footer class="pt-6 pb-4 text-center text-xs font-mono text-zinc-500 border-t border-zinc-800/80">
		<p>
			[SIMPUL TECH MEDLOGISTICS ENGINE //CREATED BY NANDA NUGRAHA // 2026]
		</p>
	</footer>
</main>
