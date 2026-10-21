<script lang="ts">
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types.js';
	import RadialDotBackground from '#lib/components/RadialDotBackground.svelte';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Simpul MedLogistics Engine</title>
	<meta
		name="description"
		content="Intelligent medical and pharmaceutical order fulfillment platform serving Surabaya Hospital Hub from 8 regional facilities."
	/>
</svelte:head>

<div class="relative min-h-screen text-zinc-100 antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
	<RadialDotBackground />
	<div class="relative z-10">
		{@render children()}
	</div>
</div>
