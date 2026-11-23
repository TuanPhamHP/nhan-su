<script setup lang="ts">
	/** Hộp hỏi lại trước khi bật tắt chấm công bằng khuôn mặt hoặc xoá khuôn mặt của một người. */
	withDefaults(
		defineProps<{
			title: string;
			message: string;
			confirmLabel: string;
			danger?: boolean;
			busy?: boolean;
		}>(),
		{ danger: false, busy: false },
	);

	const emit = defineEmits<{
		confirm: [];
		cancel: [];
	}>();
</script>

<template>
	<Teleport to="body">
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
			role="dialog"
			aria-modal="true"
			data-testid="face-confirm-dialog"
			@click.self="!busy && emit('cancel')"
		>
			<div class="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900">
				<h4 class="text-base font-semibold text-gray-900 dark:text-white">{{ title }}</h4>
				<p class="mt-2 text-sm text-gray-600 dark:text-gray-300">{{ message }}</p>
				<div class="mt-5 flex justify-end gap-2">
					<CommonAppButton variant="secondary" :disabled="busy" @click="emit('cancel')">Huỷ</CommonAppButton>
					<CommonAppButton :variant="danger ? 'danger' : 'primary'" :loading="busy" @click="emit('confirm')">
						{{ confirmLabel }}
					</CommonAppButton>
				</div>
			</div>
		</div>
	</Teleport>
</template>
