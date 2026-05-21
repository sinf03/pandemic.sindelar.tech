<script lang="ts">
	import logo from '$lib/assets/logo.png';

	type Props = {
		size?: number;
		class?: string;
	};

	let { size = 32, class: klass = '' }: Props = $props();
</script>

<img
	src={logo}
	alt=""
	width={size}
	height={size}
	style={`width: ${size}px; height: ${size}px;`}
	class={`select-none ${klass}`}
	draggable="false"
	aria-hidden="true"
/>
