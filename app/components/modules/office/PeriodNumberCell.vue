<script setup lang="ts">
	/**
	 * Ô nhập dự trù hoặc đơn giá trong bảng tổng hợp kỳ: số nguyên từ 0, giữ nguyên chữ người dùng gõ.
	 *
	 * Gõ sai ("2,5", "-3", số quá trần) thì ô đỏ và báo ra ngoài bằng `invalid`, không lặng lẽ đổi thành
	 * số khác như ô số dùng chung. Ô đã sửa mà chưa lưu có nền vàng nhạt và một chấm ở góc, để quét cả
	 * bảng là thấy chỗ nào còn chờ lưu. Enter nhảy xuống ô cùng cột ở dòng kế (`next`).
	 */
	const props = defineProps<{
		modelValue: number | undefined;
		label: string;
		max: number;
		/** Cột của ô, để Enter tìm ô cùng cột ở dòng sau. */
		column: string;
		dirty: boolean;
		/** Thiếu đơn giá: viền cảnh báo. */
		warn?: boolean;
	}>();

	const emit = defineEmits<{
		input: [value: number | undefined, invalid: boolean];
		next: [];
	}>();

	const text = ref(props.modelValue == null ? '' : String(props.modelValue));
	const bad = ref(false);

	function parse(raw: string): { value: number | undefined; bad: boolean } {
		const trimmed = raw.trim();
		if (!trimmed) return { value: undefined, bad: false };
		if (!/^\d+$/.test(trimmed)) return { value: undefined, bad: true };
		const value = Number(trimmed);
		return value > props.max ? { value: undefined, bad: true } : { value, bad: false };
	}

	/** Số đổi từ bên ngoài (lưu xong, huỷ thay đổi) thì vẽ lại chữ; đang gõ dở thì để nguyên. */
	watch(
		() => props.modelValue,
		value => {
			const parsed = parse(text.value);
			if (!parsed.bad && parsed.value === value) return;
			if (parsed.bad && value === undefined) return;
			text.value = value == null ? '' : String(value);
			bad.value = false;
		},
	);

	function onInput(event: Event) {
		if (!(event.target instanceof HTMLInputElement)) return;
		text.value = event.target.value;
		const parsed = parse(text.value);
		bad.value = parsed.bad;
		emit('input', parsed.value, parsed.bad);
	}

	function onFocus(event: FocusEvent) {
		if (event.target instanceof HTMLInputElement) event.target.select();
	}

	const errorText = computed(() => (bad.value ? `Số nguyên từ 0 tới ${props.max.toLocaleString('vi-VN')}` : ''));
</script>

<template>
	<div class="relative">
		<input
			:value="text"
			type="text"
			inputmode="numeric"
			autocomplete="off"
			:data-cell-col="column"
			:aria-label="label"
			:aria-invalid="bad ? 'true' : undefined"
			:title="errorText || undefined"
			:class="[
				'h-8 w-full rounded-md border px-2 text-right text-sm tabular-nums text-gray-900 transition-colors focus:outline-none focus:ring-2 dark:text-gray-100',
				bad
					? 'border-rose-400 bg-white focus:ring-rose-300 dark:border-rose-500 dark:bg-gray-800'
					: dirty
						? 'border-amber-300 bg-amber-50 focus:ring-brand-500 dark:border-amber-700 dark:bg-amber-900/20'
						: warn
							? 'border-amber-400 bg-white focus:ring-brand-500 dark:border-amber-600 dark:bg-gray-800'
							: 'border-gray-300 bg-white focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800',
			]"
			@input="onInput"
			@focus="onFocus"
			@keydown.enter.prevent="emit('next')"
		/>
		<span v-if="dirty && !bad" class="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
		<span v-if="errorText" class="sr-only" role="alert">{{ label }}: {{ errorText }}</span>
	</div>
</template>
