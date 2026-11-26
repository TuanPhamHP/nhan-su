<script setup lang="ts">
	import { isPriceMissing, officeMoney } from '~/utils/office.utils';

	/**
	 * Đơn giá của một mặt hàng trong danh mục, sửa nhanh ngay trên dòng.
	 *
	 * Bấm vào giá (hoặc chip "Chưa có đơn giá") thì thành ô nhập: Enter lưu bằng đúng API sửa mặt
	 * hàng (rời ô cũng lưu), Esc huỷ. Lưu lỗi thì ô giữ số đã gõ và hiện câu lỗi. Ô trống không lưu gì, vì form sửa
	 * mặt hàng cũng không xoá được giá đã có.
	 */
	const props = defineProps<{
		unitPrice: number | null;
		itemName: string;
		canEdit: boolean;
		save: (unitPrice: number) => Promise<string | null>;
	}>();

	const editing = ref(false);
	const text = ref('');
	const error = ref('');
	const saving = ref(false);
	const inputRef = ref<HTMLInputElement | null>(null);
	const triggerRef = ref<HTMLButtonElement | null>(null);
	const errorId = `price-error-${Math.random().toString(36).slice(2)}`;

	const missing = computed(() => isPriceMissing(props.unitPrice));

	function start() {
		text.value = props.unitPrice == null ? '' : String(props.unitPrice);
		error.value = '';
		editing.value = true;
		nextTick(() => inputRef.value?.select());
	}

	function cancel() {
		editing.value = false;
		error.value = '';
		nextTick(() => triggerRef.value?.focus());
	}

	async function commit() {
		// Esc đã huỷ thì ô bị gỡ, và trình duyệt bắn `blur` sau đó: không lưu gì nữa.
		if (saving.value || !editing.value) return;
		const raw = text.value.trim();
		if (!raw) {
			cancel();
			return;
		}
		if (!/^\d+$/.test(raw) || Number(raw) > 1_000_000_000) {
			error.value = 'Đơn giá là số nguyên từ 0 tới 1.000.000.000.';
			return;
		}
		if (Number(raw) === props.unitPrice) {
			cancel();
			return;
		}
		saving.value = true;
		error.value = (await props.save(Number(raw))) ?? '';
		saving.value = false;
		if (!error.value) cancel();
	}

	function onInput(event: Event) {
		if (event.target instanceof HTMLInputElement) {
			text.value = event.target.value;
			error.value = '';
		}
	}
</script>

<template>
	<div class="flex flex-col items-end">
		<template v-if="editing">
			<div class="flex items-center gap-1.5">
				<input
					ref="inputRef"
					:value="text"
					type="text"
					inputmode="numeric"
					autocomplete="off"
					:aria-label="`Đơn giá gồm VAT, ${itemName}`"
					:aria-invalid="error ? 'true' : undefined"
					:aria-describedby="error ? errorId : undefined"
					:disabled="saving"
					:class="[
						'h-8 w-32 rounded-md border px-2 text-right text-sm tabular-nums text-gray-900 focus:outline-none focus:ring-2 dark:bg-gray-800 dark:text-gray-100',
						error ? 'border-rose-400 focus:ring-rose-300' : 'border-gray-300 focus:ring-brand-500 dark:border-gray-600',
					]"
					@input="onInput"
					@keydown.enter.prevent="commit"
					@keydown.esc.prevent.stop="cancel"
					@blur="!saving && !error && commit()"
				/>
				<span v-if="saving" class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" aria-hidden="true" />
			</div>
			<p v-if="error" :id="errorId" role="alert" class="mt-0.5 text-xs text-rose-600 dark:text-rose-400">{{ error }}</p>
		</template>
		<button
			v-else-if="canEdit"
			ref="triggerRef"
			type="button"
			:title="`Bấm để sửa đơn giá ${itemName}`"
			:class="[
				'rounded-md px-1.5 py-0.5 text-sm tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
				missing
					? 'bg-amber-50 text-xs font-medium text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:ring-amber-800'
					: 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800',
			]"
			@click="start"
		>
			<template v-if="missing">Chưa có đơn giá</template>
			<template v-else>{{ officeMoney(unitPrice) }} đ</template>
			<span class="sr-only">, bấm để sửa</span>
		</button>
		<span
			v-else
			:class="[
				'text-sm tabular-nums',
				missing ? 'rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/20 dark:text-amber-300' : 'text-gray-700 dark:text-gray-200',
			]"
		>
			<template v-if="missing">Chưa có đơn giá</template>
			<template v-else>{{ officeMoney(unitPrice) }} đ</template>
		</span>
	</div>
</template>
