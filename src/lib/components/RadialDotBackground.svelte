<script lang="ts">
	import { onDestroy } from 'svelte';

	let mouseX = $state(-500);
	let mouseY = $state(-500);
	let isVisible = $state(false);

	let rafId: number | null = null;

	function handleMouseMove(e: MouseEvent) {
		const clientX = e.clientX;
		const clientY = e.clientY;

		if (rafId !== null) {
			cancelAnimationFrame(rafId);
		}

		rafId = requestAnimationFrame(() => {
			mouseX = clientX;
			mouseY = clientY;
			if (!isVisible) isVisible = true;
		});
	}

	function handleMouseLeave() {
		isVisible = false;
	}

	function handleMouseEnter(e: MouseEvent) {
		mouseX = e.clientX;
		mouseY = e.clientY;
		isVisible = true;
	}

	onDestroy(() => {
		if (rafId !== null) {
			cancelAnimationFrame(rafId);
		}
	});
</script>

<svelte:window
	onmousemove={handleMouseMove}
	onmouseenter={handleMouseEnter}
	onmouseleave={handleMouseLeave}
/>

<div
	class="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-zinc-950"
	aria-hidden="true"
	style="--mouse-x: {mouseX}px; --mouse-y: {mouseY}px;"
>
	<!-- Ambient top atmospheric radial glow -->
	<div
		class="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[450px] bg-radial from-emerald-500/15 via-emerald-950/5 to-transparent blur-3xl opacity-70 pointer-events-none"
	></div>

	<!-- Layer 1: Passive base radial dots grid (crisp, visible, architectural) -->
	<div class="absolute inset-0 dot-grid-base"></div>

	<!-- Radial vignette softening outer edges -->
	<div class="absolute inset-0 radial-vignette pointer-events-none"></div>

	<!-- Layer 2: Interactive shining radial dots responding directly to cursor hover -->
	<div
		class="absolute inset-0 dot-grid-shine transition-opacity duration-300 ease-out"
		style:opacity={isVisible ? 1 : 0}
	></div>

	<!-- Layer 3: Soft ambient spotlight aura around cursor -->
	<div
		class="absolute inset-0 cursor-aura transition-opacity duration-300 ease-out"
		style:opacity={isVisible ? 1 : 0}
	></div>
</div>

<style>
	/* Base passive dot pattern: clean, visible dots on dark canvas */
	.dot-grid-base {
		background-image: radial-gradient(rgba(255, 255, 255, 0.2) 1.5px, transparent 1.5px);
		background-size: 24px 24px;
		background-position: 0 0;
	}

	/* Soft radial vignette focusing depth toward center/top */
	.radial-vignette {
		background: radial-gradient(ellipse 90% 80% at 50% 20%, transparent 40%, rgba(9, 9, 11, 0.75) 100%);
	}

	/* Illuminated shining dot layer: crisp bright white dots with a focused, tight shine */
	.dot-grid-shine {
		background-image: radial-gradient(#ffffff 1.75px, transparent 1.75px);
		background-size: 24px 24px;
		background-position: 0 0;
		filter: drop-shadow(0 0 2.5px rgba(255, 255, 255, 0.95)) drop-shadow(0 0 6px rgba(255, 255, 255, 0.6));
		-webkit-mask-image: radial-gradient(
			circle 90px at var(--mouse-x, -500px) var(--mouse-y, -500px),
			black 0%,
			rgba(0, 0, 0, 0.6) 45%,
			transparent 100%
		);
		mask-image: radial-gradient(
			circle 90px at var(--mouse-x, -500px) var(--mouse-y, -500px),
			black 0%,
			rgba(0, 0, 0, 0.6) 45%,
			transparent 100%
		);
	}

	/* Soft ambient cursor spotlight glow: tight bright white aura */
	.cursor-aura {
		background: radial-gradient(
			circle 105px at var(--mouse-x, -500px) var(--mouse-y, -500px),
			rgba(255, 255, 255, 0.08) 0%,
			rgba(255, 255, 255, 0.02) 55%,
			transparent 100%
		);
	}
</style>
