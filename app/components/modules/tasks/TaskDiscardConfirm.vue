<script setup lang="ts">
	/**
	 * Hộp hỏi "Bỏ nội dung đang soạn?" khi đóng form có chữ (xem `useDiscardGuard`). Nút Soạn tiếp được
	 * chọn sẵn, vì bấm Enter theo thói quen thì không được mất chữ.
	 */
	defineProps<{ open: boolean }>();
	const emit = defineEmits<{ keep: []; discard: [] }>();

	const keepRef = ref<{ $el?: HTMLElement } | null>(null);
	watch(
		() => keepRef.value,
		el => el?.$el?.focus(),
	);
</script>

<template>
	<Teleport to="body">
		<div
			v-if="open"
			class="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
			data-testid="discard-confirm"
			@click.self="emit('keep')"
		>
			<div
				role="alertdialog"
				aria-modal="true"
				aria-labelledby="discard-confirm-title"
				aria-describedby="discard-confirm-desc"
				class="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900"
			>
				<h3 id="discard-confirm-title" class="text-base font-semibold text-gray-900 dark:text-white">Bỏ nội dung đang soạn?</h3>
				<p id="discard-confirm-desc" class="mt-1 text-sm text-gray-600 dark:text-gray-300">
					Những gì bạn đã nhập trong form này sẽ mất. Muốn giữ lại thì bấm Soạn tiếp.
				</p>
				<div class="mt-4 flex justify-end gap-2">
					<CommonAppButton variant="secondary" data-testid="discard-confirm-discard" @click="emit('discard')">Bỏ nội dung</CommonAppButton>
					<CommonAppButton ref="keepRef" data-testid="discard-confirm-keep" @click="emit('keep')">Soạn tiếp</CommonAppButton>
				</div>
			</div>
		</div>
	</Teleport>
</template>
