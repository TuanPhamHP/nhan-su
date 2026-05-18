<script setup lang="ts">
const { toasts, remove } = useToast();
</script>

<template>
	<Teleport to="body">
		<div class="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
			<TransitionGroup
				enter-active-class="transition-all duration-300 ease-out"
				enter-from-class="opacity-0 translate-x-8"
				enter-to-class="opacity-100 translate-x-0"
				leave-active-class="transition-all duration-200 ease-in"
				leave-from-class="opacity-100 translate-x-0"
				leave-to-class="opacity-0 translate-x-8"
			>
				<CommonAppToastItem
					v-for="toast in toasts"
					:key="toast.id"
					:toast="toast"
					@close="remove"
				/>
			</TransitionGroup>
		</div>
	</Teleport>
</template>
