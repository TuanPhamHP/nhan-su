<script setup lang="ts">
	import { QTY_INTEGER_MESSAGE } from '~/utils/office.utils';

	/**
	 * Ô số lượng của văn phòng phẩm: số nguyên, và GIỮ NGUYÊN chữ người dùng gõ.
	 *
	 * Vì sao không dùng `UiNumberInput` ở đây: ô số dùng chung lặng lẽ bỏ ký tự lạ, nên "2,5" thành
	 * 25, "-3" thành 3 và "5 hộp" thành 5. Với ô tiền thì người dùng thấy ngay con số lạ, còn ở
	 * phiếu văn phòng phẩm thì 25 tập giấy vẫn là một con số hợp lý nên không ai nhận ra, và phòng
	 * nhận về gấp mười lần số cần. Đợt UAT trước, ô vẫn đổi "2,5" thành 25 dù đã báo lỗi, nên người
	 * dùng không hiểu con số trong ô từ đâu ra.
	 *
	 * Ở đây ô giữ đúng chữ đã gõ ("2,5"), nói "Số lượng là số nguyên, ví dụ 2", và báo ra ngoài bằng
	 * `update:invalid` để nơi dùng chặn thêm, lưu cho tới khi người dùng sửa lại.
	 */
	const props = defineProps<{
		modelValue?: number;
		/** Dùng với `v-model:invalid`; nơi dùng chỉ nghe `update:invalid` thì để trống cũng được. */
		invalid?: boolean;
		/** Câu lỗi của nơi dùng, ví dụ câu của máy chủ; ưu tiên hơn câu nhắc gõ sai. */
		error?: string;
		disabled?: boolean;
		placeholder?: string;
		max?: number;
		ariaLabel?: string;
	}>();

	const emit = defineEmits<{
		'update:modelValue': [value: number | undefined];
		/** Ô đang giữ chữ không phải số nguyên: nơi dùng không cho thêm hay lưu khi cờ này bật. */
		'update:invalid': [invalid: boolean];
		/** Người dùng bấm Enter trong ô: nơi dùng lưu luôn, khỏi phải tìm nút Lưu. */
		save: [];
		/** Rời ô: nơi dùng lưu số đang gõ, để chuyển thẻ tháng không làm mất. */
		leave: [];
	}>();

	const text = ref(props.modelValue == null ? '' : String(props.modelValue));
	const bad = ref(false);

	/** Chữ trong ô thành số: chỉ chữ số mới hợp lệ, mọi thứ khác là gõ sai. */
	function parse(raw: string): { value: number | undefined; bad: boolean } {
		const trimmed = raw.trim();
		if (!trimmed) return { value: undefined, bad: false };
		if (!/^\d+$/.test(trimmed)) return { value: undefined, bad: true };
		return { value: Number(trimmed), bad: false };
	}

	/** Giá trị đổi từ bên ngoài (nạp phiếu, lưu xong) thì vẽ lại chữ; đang gõ thì để nguyên. */
	watch(
		() => props.modelValue,
		value => {
			if (parse(text.value).value === value) return;
			text.value = value == null ? '' : String(value);
			bad.value = false;
			emit('update:invalid', false);
		},
	);

	function onInput(event: Event) {
		text.value = (event.target as HTMLInputElement).value;
		const parsed = parse(text.value);
		if (parsed.bad !== bad.value) {
			bad.value = parsed.bad;
			emit('update:invalid', parsed.bad);
		}
		emit('update:modelValue', parsed.value);
	}

	const message = computed(() => props.error || (bad.value || props.invalid ? QTY_INTEGER_MESSAGE : ''));
</script>

<template>
	<div class="flex flex-col gap-1">
		<input
			:value="text"
			type="text"
			inputmode="numeric"
			autocomplete="off"
			role="spinbutton"
			aria-valuemin="1"
			:aria-valuemax="max"
			:aria-valuenow="modelValue"
			:aria-invalid="message ? 'true' : undefined"
			:aria-label="ariaLabel"
			:placeholder="placeholder"
			:disabled="disabled"
			:class="[
				'w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:border-transparent focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-gray-800 dark:text-gray-100',
				message
					? 'border-rose-400 focus:ring-rose-300 dark:border-rose-500'
					: 'border-gray-300 focus:ring-brand-500 dark:border-gray-600',
			]"
			@input="onInput"
			@blur="emit('leave')"
			@keydown.enter.prevent="emit('save')"
		/>
		<p v-if="message" class="text-xs text-rose-600 dark:text-rose-400">{{ message }}</p>
	</div>
</template>
