<template>
	<div :class="$style.wrapper">
		<slot />
		<div :class="[$style.tooltip, placement === 'right' ? $style.tooltipRight : $style.tooltipCenter]">
			{{ label }}
		</div>
	</div>
</template>

<script setup lang="ts">
	withDefaults(defineProps<{ label: string; placement?: 'center' | 'right' }>(), {
		placement: 'center',
	});
</script>

<style module lang="scss">
	.wrapper {
		position: relative;

		&:hover .tooltip {
			opacity: 1;
		}
	}

	.tooltip {
		position: absolute;
		bottom: calc(100% + 8px);
		background-color: #1f2937;
		color: white;
		font-size: 0.8125rem;
		font-weight: 500;
		padding: 0.375rem 0.75rem;
		border-radius: 0.5rem;
		white-space: nowrap;
		pointer-events: none;
		z-index: 200;
		opacity: 0;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
		transition: opacity 120ms ease;
		font-family: 'Montserrat', sans-serif;

		&::after {
			content: '';
			position: absolute;
			top: 100%;
			border: 5px solid transparent;
			border-top-color: #1f2937;
		}
	}

	// Căn giữa — dùng cho các button ở giữa
	.tooltipCenter {
		left: 50%;
		transform: translateX(-50%);

		&::after {
			left: 50%;
			transform: translateX(-50%);
		}
	}

	// Căn phải — dùng cho button ở cạnh phải để không bị cắt
	.tooltipRight {
		right: 0;

		&::after {
			right: 0.75rem;
		}
	}
</style>
