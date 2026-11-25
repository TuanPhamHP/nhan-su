<script setup lang="ts">
	/**
	 * Hộp xác nhận của KPI: chốt, công bố, công bố cả kỳ, mở lại. Có ô lý do khi `reasonLabel`; lý do bắt
	 * buộc thì nút xác nhận vẫn bấm được và câu lỗi máy chủ (`KPI_REASON_REQUIRED`) hiện dưới ô, để người
	 * dùng thấy đúng câu máy chủ trả. Nơi gọi tự gọi API trong `confirm` và trả câu lỗi (nếu có).
	 */
	const props = defineProps<{
		title: string;
		message: string;
		confirmLabel: string;
		danger?: boolean;
		reasonLabel?: string;
		reasonRequired?: boolean;
		reasonPlaceholder?: string;
		confirm: (reason: string) => Promise<string | null>;
	}>();
	const emit = defineEmits<{ close: [] }>();

	const reason = ref('');
	const error = ref('');
	const busy = ref(false);

	async function ok() {
		busy.value = true;
		error.value = '';
		try {
			const err = await props.confirm(reason.value.trim());
			if (err) error.value = err;
			else emit('close');
		} finally {
			busy.value = false;
		}
	}
	useEscapeKey(() => emit('close'), () => !busy.value);
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" @click.self="emit('close')">
			<form
				class="w-full max-w-md rounded-t-2xl bg-white shadow-xl sm:rounded-2xl dark:bg-gray-900"
				role="alertdialog"
				aria-modal="true"
				:aria-label="title"
				data-testid="kpi-confirm"
				@submit.prevent="ok"
			>
				<div class="border-b border-gray-200 px-5 py-4 dark:border-gray-700">
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ title }}</h2>
				</div>
				<div class="space-y-3 px-5 py-4">
					<p class="text-sm text-gray-700 dark:text-gray-300">{{ message }}</p>
					<div v-if="reasonLabel">
						<label for="kpi-confirm-reason" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
							{{ reasonLabel }}<span v-if="reasonRequired" class="text-red-500"> *</span>
						</label>
						<textarea
							id="kpi-confirm-reason"
							v-model="reason"
							rows="3"
							maxlength="500"
							:placeholder="reasonPlaceholder"
							class="mt-1 w-full resize-none rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:text-gray-100"
							:class="error ? 'border-rose-500' : 'border-gray-300 dark:border-gray-600'"
							data-testid="kpi-confirm-reason"
						/>
					</div>
					<p v-if="error" class="text-sm text-rose-600" role="alert" data-testid="kpi-confirm-error">{{ error }}</p>
				</div>
				<div class="flex justify-end gap-3 border-t border-gray-200 px-5 py-3 dark:border-gray-700">
					<CommonAppButton variant="secondary" :disabled="busy" @click="emit('close')">Huỷ</CommonAppButton>
					<CommonAppButton type="submit" :variant="danger ? 'danger' : 'primary'" :loading="busy" data-testid="kpi-confirm-ok">{{ confirmLabel }}</CommonAppButton>
				</div>
			</form>
		</div>
	</Teleport>
</template>
