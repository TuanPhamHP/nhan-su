<script setup lang="ts">
	import {
		caretAfterDigits,
		digitsBefore,
		formatNumberTyping,
		formatNumberValue,
		parsePastedNumber,
	} from '~/utils/number-input';

	/**
	 * Ô nhập số có dấu nhóm nghìn kiểu Việt Nam: gõ `80000` thì ô hiện `80.000`.
	 *
	 * Dùng cho mọi ô số của hệ thống thay cho `<input type="number">`, vì ô số của trình duyệt
	 * không nhóm nghìn (người dùng phải tự đếm chữ số của một số tiền tám chữ số), mỗi trình duyệt
	 * hiện mũi tên tăng giảm một kiểu, và lăn chuột trên ô có thể đổi giá trị mà người dùng không
	 * biết.
	 *
	 * `v-model` là `number | undefined`. Ô trống là `undefined` chứ không phải `0`, để phân biệt
	 * "không nhập" với "nhập số không" — `0` là giá trị có nghĩa với tỷ giá hay số ghế.
	 *
	 * Phím dấu chấm được đổi thành dấu phẩy khi ô có số lẻ: bàn phím số của máy tính chỉ có dấu
	 * chấm, còn dấu chấm nhóm nghìn là do ô tự chèn nên người dùng không bao giờ phải gõ nó.
	 */
	const props = withDefaults(
		defineProps<{
			modelValue?: number;
			/** Số chữ số thập phân tối đa; `0` là ô số nguyên, không nhận dấu phẩy. */
			decimals?: number;
			/**
			 * Khoảng cho phép, chỉ để báo cho trình đọc màn hình và để biểu mẫu khai ràng buộc ở một
			 * chỗ. Ô KHÔNG tự kéo giá trị về trong khoảng: tỷ giá 0 hay số ghế 0 phải đi tới máy chủ
			 * để nhận đúng câu lỗi nghiệp vụ, chứ không bị ô âm thầm sửa thành 1.
			 */
			min?: number;
			max?: number;
			placeholder?: string;
			disabled?: boolean;
			id?: string;
			label?: string;
			error?: string;
			hint?: string;
			/** Lớp CSS cho ô nhập, để dùng chung lớp của từng biểu mẫu. */
			inputClass?: string;
		}>(),
		{ decimals: 0 },
	);

	const emit = defineEmits<{
		'update:modelValue': [value: number | undefined];
		blur: [];
	}>();

	// Biểu mẫu truyền `v-bind="xxxAttrs"` của vee-validate vào đây, nên thuộc tính và trình xử lý
	// sự kiện phải xuống đúng thẻ `input`, không nằm ở div bọc ngoài.
	defineOptions({ inheritAttrs: false });

	const inputRef = ref<HTMLInputElement | null>(null);
	const text = ref(formatNumberValue(props.modelValue, props.decimals));

	const inputId = computed(() => props.id ?? `ui-number-${Math.random().toString(36).slice(2)}`);

	/**
	 * Giá trị đổi từ bên ngoài (nạp dữ liệu, đặt lại biểu mẫu) thì vẽ lại chữ trong ô.
	 *
	 * Không vẽ lại khi con số đang khớp với chữ người dùng đang gõ, nếu không thì gõ `1.234,` sẽ
	 * bị xoá mất dấu phẩy vừa gõ.
	 */
	watch(
		() => props.modelValue,
		value => {
			const typed = formatNumberTyping(text.value, props.decimals).value;
			if (value === typed) return;
			text.value = formatNumberValue(value, props.decimals);
		},
	);

	function emitValue(value: number | undefined) {
		if (value !== props.modelValue) emit('update:modelValue', value);
	}

	function onInput(event: Event) {
		const el = event.target as HTMLInputElement;
		const caret = el.selectionStart ?? el.value.length;
		const keep = digitsBefore(el.value, caret);
		const next = formatNumberTyping(el.value, props.decimals);

		text.value = next.text;
		// Ghi thẳng vào ô: gõ một chữ cái thì giá trị không đổi nên Vue không vẽ lại, và chữ cái đó
		// sẽ nằm lì trong ô.
		el.value = next.text;
		const position = caretAfterDigits(next.text, keep);
		el.setSelectionRange(position, position);
		emitValue(next.value);
	}

	/**
	 * Chặn ngay ở bàn phím những phím không thuộc ô số.
	 *
	 * Làm ở đây chứ không chỉ lọc ở `onInput`, vì chỉ lọc sau khi gõ thì ô nhấp nháy một nhịp và
	 * con trỏ dễ nhảy chỗ.
	 */
	function onKeydown(event: KeyboardEvent) {
		if (event.ctrlKey || event.metaKey || event.altKey) return;
		if (event.key.length !== 1) return;

		if (event.key === '.' || event.key === ',') {
			event.preventDefault();
			if (props.decimals <= 0) return;
			if (text.value.includes(',')) return;
			insertComma();
			return;
		}
		if (!/\d/.test(event.key)) event.preventDefault();
	}

	/** Thay phím dấu chấm bằng dấu phẩy ngay tại vị trí con trỏ. */
	function insertComma() {
		const el = inputRef.value;
		if (!el) return;
		const start = el.selectionStart ?? el.value.length;
		const end = el.selectionEnd ?? start;
		const raw = `${el.value.slice(0, start)},${el.value.slice(end)}`;
		const keep = digitsBefore(raw, start + 1);
		const next = formatNumberTyping(raw, props.decimals);
		text.value = next.text;
		el.value = next.text;
		const position = caretAfterDigits(next.text, keep);
		el.setSelectionRange(position, position);
		emitValue(next.value);
	}

	function onPaste(event: ClipboardEvent) {
		const pasted = event.clipboardData?.getData('text');
		if (!pasted) return;
		event.preventDefault();
		const next = parsePastedNumber(pasted, props.decimals);
		text.value = next.text;
		if (inputRef.value) inputRef.value.value = next.text;
		emitValue(next.value);
	}

	/** Rời ô thì chuẩn hoá chữ: `1.234,` thành `1.234`, `,5` thành `0,5`. */
	function onBlur() {
		const current = formatNumberTyping(text.value, props.decimals).value;
		text.value = formatNumberValue(current, props.decimals);
		emitValue(current);
		emit('blur');
	}
</script>

<template>
	<div class="flex flex-col gap-1">
		<label v-if="label" :for="inputId" class="text-sm font-medium text-gray-700 dark:text-gray-300">
			{{ label }}
		</label>
		<input
			:id="inputId"
			ref="inputRef"
			v-bind="$attrs"
			:value="text"
			type="text"
			:inputmode="decimals > 0 ? 'decimal' : 'numeric'"
			autocomplete="off"
			:placeholder="placeholder"
			:disabled="disabled"
			role="spinbutton"
			:aria-valuemin="min"
			:aria-valuemax="max"
			:aria-valuenow="modelValue"
			:aria-invalid="error ? 'true' : undefined"
			:class="
				inputClass ??
				[
					'w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:border-transparent focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-gray-800 dark:text-gray-100',
					error
						? 'border-rose-400 focus:ring-rose-300 dark:border-rose-500'
						: 'border-gray-300 focus:ring-brand-500 dark:border-gray-600',
				]
			"
			@input="onInput"
			@keydown="onKeydown"
			@paste="onPaste"
			@blur="onBlur"
		/>
		<p v-if="error" class="text-xs text-rose-600 dark:text-rose-400">{{ error }}</p>
		<p v-else-if="hint" class="text-xs text-gray-500 dark:text-gray-400">{{ hint }}</p>
	</div>
</template>
