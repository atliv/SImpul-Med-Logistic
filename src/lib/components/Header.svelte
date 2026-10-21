<script lang="ts">
	import logo from '#lib/assets/logo.png';

	interface Props {
		onSelectPreset: (presetKey: 'A' | 'B' | 'C' | 'D') => void;
		onOpenResetModal: () => void;
		onOpenHistoryModal: () => void;
		isResetting: boolean;
	}

	let { onSelectPreset, onOpenResetModal, onOpenHistoryModal, isResetting }: Props = $props();
</script>

<header class="bg-zinc-900/95 rounded-none border border-zinc-800 p-5 md:p-6 transition-all shadow-xl shadow-black/40">
	<!-- Top Bar / Terminal Header -->
	<div class="flex items-start justify-between gap-4 border-b border-zinc-800 pb-5">
		<div class="flex-1 min-w-0">
			<div class="flex items-center gap-2.5 flex-wrap">
				<div class="inline-flex items-center justify-center w-9 h-9 rounded-none bg-zinc-950 border border-emerald-500/60 p-0.5 shadow-xs overflow-hidden shrink-0">
					<img src={logo} alt="Simpul MedLogistics Logo" class="w-full h-full object-contain" />
				</div>
				<h1 class="text-xl md:text-2xl font-bold tracking-tight text-zinc-100 font-mono">
					Simpul MedLogistics Engine
				</h1>
				<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-none text-xs font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
					<span class="w-1.5 h-1.5 rounded-none bg-emerald-400 animate-pulse"></span>
					[HUB: RSUD DR. SOETOMO MED WAREHOUSE]
				</span>
			</div>
			<p class="text-xs md:text-sm text-zinc-400 mt-1 font-mono">
				Hospital Order Fulfillment &amp; Decision Engine &bull; Customer Location: <span class="font-semibold text-zinc-200">RSUD DR. SOETOMO </span>
			</p>
		</div>
	</div>

	<!-- Preset Quick Scenarios -->
	<div class="pt-4">
		<div class="flex items-center justify-between flex-wrap gap-2 mb-2">
			<span class="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-400">
				&gt; DEMO PRESETS:
			</span>
			<span class="text-xs font-mono text-zinc-500 hidden sm:inline">
				[Click to inject test scenario matrix]
			</span>
		</div>
		<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
			<button
				type="button"
				onclick={() => onSelectPreset('A')}
				class="px-3 py-2 text-left rounded-none border border-zinc-800 bg-zinc-950/80 hover:bg-zinc-800/90 hover:border-zinc-700 transition-all text-xs group cursor-pointer"
			>
				<div class="font-semibold text-zinc-200 flex items-center justify-between">
					<span class="font-mono">Scenario A</span>
					<span class="text-[10px] px-1.5 py-0.2 bg-emerald-500/15 text-emerald-400 rounded-none font-mono font-medium border border-emerald-500/30">Single Wh</span>
				</div>
				<p class="text-zinc-400 text-[11px] mt-0.5 truncate font-mono">50 Gloves, 100 Syringes</p>
			</button>

			<button
				type="button"
				onclick={() => onSelectPreset('B')}
				class="px-3 py-2 text-left rounded-none border border-zinc-800 bg-zinc-950/80 hover:bg-zinc-800/90 hover:border-zinc-700 transition-all text-xs group cursor-pointer"
			>
				<div class="font-semibold text-zinc-200 flex items-center justify-between">
					<span class="font-mono">Scenario B</span>
					<span class="text-[10px] px-1.5 py-0.2 bg-cyan-500/15 text-cyan-400 rounded-none font-mono font-medium border border-cyan-500/30">Cold-Chain</span>
				</div>
				<p class="text-zinc-400 text-[11px] mt-0.5 truncate font-mono">50 Gloves, 20 Hep B</p>
			</button>

			<button
				type="button"
				onclick={() => onSelectPreset('C')}
				class="px-3 py-2 text-left rounded-none border border-zinc-800 bg-zinc-950/80 hover:bg-zinc-800/90 hover:border-zinc-700 transition-all text-xs group cursor-pointer"
			>
				<div class="font-semibold text-zinc-200 flex items-center justify-between">
					<span class="font-mono">Scenario C</span>
					<span class="text-[10px] px-1.5 py-0.2 bg-amber-500/15 text-amber-400 rounded-none font-mono font-medium border border-amber-500/30">Consolidated</span>
				</div>
				<p class="text-zinc-400 text-[11px] mt-0.5 truncate font-mono">250 Surgical Gloves</p>
			</button>

			<button
				type="button"
				onclick={() => onSelectPreset('D')}
				class="px-3 py-2 text-left rounded-none border border-zinc-800 bg-zinc-950/80 hover:bg-zinc-800/90 hover:border-zinc-700 transition-all text-xs group cursor-pointer"
			>
				<div class="font-semibold text-zinc-200 flex items-center justify-between">
					<span class="font-mono">Scenario D</span>
					<span class="text-[10px] px-1.5 py-0.2 bg-rose-500/15 text-rose-400 rounded-none font-mono font-medium border border-rose-500/30">Deficit</span>
				</div>
				<p class="text-zinc-400 text-[11px] mt-0.5 truncate font-mono">200 Hep B (Deficit)</p>
			</button>
		</div>

		<!-- Full-Width Button 1: Show Logistic History -->
		<button
			type="button"
			onclick={onOpenHistoryModal}
			class="w-full mt-3 py-2.5 px-4 rounded-none border border-zinc-700 bg-zinc-800/70 hover:bg-zinc-800 hover:border-emerald-500/60 transition-all text-xs font-mono font-semibold text-zinc-200 flex items-center justify-center gap-2 cursor-pointer group shadow-sm"
		>
			<svg class="w-4 h-4 text-emerald-400 group-hover:scale-105 transition-transform shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
			</svg>
			<span>SHOW LOGISTIC HISTORY</span>
			<span class="inline-flex items-center px-2 py-0.5 rounded-none text-[10px] font-mono font-medium bg-zinc-900 text-zinc-300 border border-zinc-700">
				[DISPATCH MANIFEST &amp; ITEMS]
			</span>
		</button>

		<!-- Full-Width Button 2: Reset Data (Placed After Show Logistic History) -->
		<button
			type="button"
			onclick={onOpenResetModal}
			disabled={isResetting}
			class="w-full mt-2 py-2.5 px-4 rounded-none border border-amber-600/70 bg-amber-950/40 hover:bg-amber-500 hover:text-zinc-950 hover:border-amber-400 focus:outline-hidden focus:ring-1 focus:ring-amber-400 transition-all text-xs font-mono font-semibold text-amber-300 flex items-center justify-center gap-2 cursor-pointer group disabled:opacity-50 shadow-sm"
			title="Restore all warehouse inventory and delivery history back to domain baseline"
		>
			<svg
				class="w-4 h-4 text-amber-400 group-hover:text-zinc-950 group-hover:rotate-180 transition-all duration-300 shrink-0 {isResetting ? 'animate-spin' : ''}"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2.5"
					d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
				/>
			</svg>
			<span>{isResetting ? '[RESTORING ALL INVENTORY BACK TO BASELINE...]' : 'RESET DATA'}</span>
			<span class="inline-flex items-center px-2 py-0.5 rounded-none text-[10px] font-mono font-medium bg-zinc-950 text-amber-400 border border-amber-600/50 group-hover:bg-zinc-900 group-hover:text-amber-300">
				[RESTORE BASELINE INVENTORY]
			</span>
		</button>
	</div>
</header>
