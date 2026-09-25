<script setup lang="ts">
	const props = defineProps<{
		modelValue: string;
		sending: boolean;
		canSend: boolean;
	}>();

	const emit = defineEmits<{
		'update:modelValue': [value: string];
		send: [];
		stop: [];
		/** Khung chat lắng nghe để kéo xuống đáy — xem AgentChatPanel. */
		focus: [];
	}>();

	const MAX_HEIGHT = 160;

	const field = ref<HTMLTextAreaElement | null>(null);

	function autoGrow(): void {
		const node = field.value;
		if (!node) return;
		node.style.height = 'auto';
		node.style.height = `${Math.min(node.scrollHeight, MAX_HEIGHT)}px`;
	}

	function onInput(e: Event): void {
		emit('update:modelValue', (e.target as HTMLTextAreaElement).value);
	}

	function onEnter(e: KeyboardEvent): void {
		if (e.shiftKey) return; // Shift+Enter xuống dòng
		e.preventDefault();
		emit('send');
	}

	onMounted(autoGrow);

	// Chiều cao phải co lại khi composable xoá input sau lúc gửi, không chỉ khi gõ
	watch(
		() => props.modelValue,
		() => nextTick(autoGrow),
	);
</script>

<template>
	<div class="border-t border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
		<div
			class="flex items-end gap-2 rounded-2xl border border-gray-300 bg-gray-50 p-2 pl-3 transition focus-within:border-[var(--color-accent)] focus-within:bg-white focus-within:shadow-sm dark:border-gray-600 dark:bg-gray-900 dark:focus-within:bg-gray-900"
		>
			<!--
				`text-base` (16px) trên mobile, `sm:text-sm` từ 640px trở lên.

				Safari iOS TỰ PHÓNG TO trang khi focus vào ô nhập có font nhỏ hơn 16px — đó là
				nguyên nhân màn hình bị zoom lúc bấm vào ô chat, không phải lỗi layout. Cách sửa
				đúng là nâng cỡ chữ, KHÔNG phải thêm `maximum-scale=1` vào thẻ viewport: làm thế
				là chặn luôn cả thao tác pinch-zoom của người dùng.
			-->
			<textarea
				ref="field"
				:value="modelValue"
				rows="1"
				placeholder="Nhập câu hỏi cho trợ lý…"
				class="max-h-40 min-h-[26px] flex-1 resize-none border-0 bg-transparent py-1.5 text-base text-gray-800 placeholder-gray-400 focus:ring-0 focus:outline-none sm:text-sm dark:text-gray-100 dark:placeholder-gray-500"
				@input="onInput"
				@keydown.enter="onEnter"
				@focus="emit('focus')"
			/>

			<button
				v-if="sending"
				type="button"
				title="Dừng trả lời"
				class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-200 text-gray-700 transition hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
				@click="emit('stop')"
			>
				<Icon name="heroicons:stop-solid" class="h-4 w-4" />
			</button>
			<button
				v-else
				type="button"
				title="Gửi câu hỏi"
				:disabled="!canSend"
				class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)] text-white shadow-sm transition hover:brightness-95 active:scale-95 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none dark:disabled:bg-gray-700"
				@click="emit('send')"
			>
				<Icon name="heroicons:paper-airplane-solid" class="h-4 w-4 -rotate-45" />
			</button>
		</div>

		<!--
			Chỉ giữ dòng cảnh báo độ tin cậy. Phần hướng dẫn phím (Enter / Shift+Enter) đã bỏ:
			trên điện thoại nó vô nghĩa mà vẫn chiếm hai dòng, đẩy ô nhập lên sát mép màn hình.
		-->
		<p class="mt-1.5 px-1 text-[11px] text-gray-400 dark:text-gray-500">
			Trợ lý có thể nhầm, hãy đối chiếu số liệu quan trọng.
		</p>
	</div>
</template>
