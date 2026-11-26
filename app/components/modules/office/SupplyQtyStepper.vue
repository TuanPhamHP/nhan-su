<script setup lang="ts">
	/**
	 * Ô số lượng của form danh mục văn phòng phẩm: số nguyên từ 0, kèm nút − và +.
	 *
	 * Giữ nguyên chữ người dùng gõ như `QtyInput`: "2,5" hay "5 hộp" không bị lặng lẽ đổi thành 25
	 * hay 5, mà ô báo sai và nơi dùng không lưu. Ô không tự lưu theo từng phím; nơi dùng lưu khi rời
	 * ô (`commit`) hoặc bấm Enter. Enter và ↑/↓ còn chuyển sang ô của dòng kề bên (`move`), để nhập
	 * cả phiếu bằng bàn phím mà không phải với chuột.
	 */
	const props = defineProps<{
		modelValue: number | undefined;
		/** Tên đọc cho trình đọc màn hình, ví dụ "Phần của bạn, Bút bi". */
		label: string;
		disabled?: boolean;
		/** Ô đang lỗi (lưu hỏng, gõ sai, thiếu lý do): viền đỏ. */
		error?: boolean;
		max?: number;
	}>();

	const emit = defineEmits<{
		input: [value: number | undefined, invalid: boolean];
		commit: [];
		bump: [delta: number];
		move: [direction: 1 | -1];
	}>();

	const text = ref(props.modelValue == null ? '' : String(props.modelValue));

	function parse(raw: string): { value: number | undefined; bad: boolean } {
		const trimmed = raw.trim();
		if (!trimmed) return { value: undefined, bad: false };
		if (!/^\d+$/.test(trimmed)) return { value: undefined, bad: true };
		const value = Number(trimmed);
		return { value, bad: props.max != null && value > props.max };
	}

	/** Số đổi từ bên ngoài (lưu xong, bấm − / +) thì vẽ lại chữ; đang gõ dở thì để nguyên. */
	watch(
		() => props.modelValue,
		value => {
			const parsed = parse(text.value);
			if (!parsed.bad && parsed.value === value) return;
			if (parsed.bad && value === undefined) return;
			text.value = value == null ? '' : String(value);
		},
	);

	function onInput(event: Event) {
		if (!(event.target instanceof HTMLInputElement)) return;
		text.value = event.target.value;
		const parsed = parse(text.value);
		emit('input', parsed.value, parsed.bad);
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			emit('commit');
			emit('move', 1);
		} else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			emit('move', event.key === 'ArrowDown' ? 1 : -1);
		}
	}

	/** Bấm vào ô là chọn hết số đang có, để gõ đè luôn chứ không phải xoá trước. */
	function onFocus(event: FocusEvent) {
		if (event.target instanceof HTMLInputElement) event.target.select();
	}

	const empty = computed(() => !props.modelValue);
</script>

<template>
	<div
		:class="[
			'flex h-8 items-stretch overflow-hidden rounded-lg border bg-white transition-colors focus-within:ring-2 dark:bg-gray-800',
			error
				? 'border-rose-400 focus-within:ring-rose-300 dark:border-rose-500'
				: 'border-gray-300 focus-within:border-transparent focus-within:ring-brand-500 dark:border-gray-600',
			disabled ? 'opacity-70' : '',
		]"
	>
		<!-- Nút − / + ra khỏi thứ tự Tab: bàn phím đi thẳng từ ô số này sang ô số dòng sau. -->
		<button
			v-if="!disabled"
			type="button"
			tabindex="-1"
			:aria-label="`Bớt một, ${label}`"
			:disabled="empty"
			class="w-7 shrink-0 text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
			@click="emit('bump', -1)"
		>
			−
		</button>
		<input
			:value="text"
			type="text"
			inputmode="numeric"
			autocomplete="off"
			data-supply-qty
			:aria-label="label"
			:aria-invalid="error ? 'true' : undefined"
			:disabled="disabled"
			:class="[
				'w-12 min-w-0 flex-1 bg-transparent px-1 text-center text-sm tabular-nums focus:outline-none disabled:cursor-not-allowed',
				empty ? 'text-gray-400 dark:text-gray-500' : 'font-semibold text-gray-900 dark:text-white',
			]"
			@input="onInput"
			@focus="onFocus"
			@blur="emit('commit')"
			@keydown="onKeydown"
		/>
		<button
			v-if="!disabled"
			type="button"
			tabindex="-1"
			:aria-label="`Thêm một, ${label}`"
			class="w-7 shrink-0 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
			@click="emit('bump', 1)"
		>
			+
		</button>
	</div>
</template>
