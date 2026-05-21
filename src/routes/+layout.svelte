<script lang="ts">
	import './layout.css';
	import { ModeWatcher } from 'mode-watcher';

	let { children } = $props();
</script>

<svelte:head>
	<title>PANDEMIC: Krizový štáb</title>
</svelte:head>

<ModeWatcher defaultMode="dark" />

{@render children?.()}
