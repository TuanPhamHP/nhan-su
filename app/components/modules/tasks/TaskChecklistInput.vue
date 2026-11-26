<script setup lang="ts">
	import { CHECKLIST_ITEM_MAX, CHECKLIST_MAX_ITEMS } from '~/utils/tasks.utils';

	/**
	 * Nhập danh sách kiểm tra từng mục, dùng ở form Tạo việc và Việc định kỳ: gõ một mục rồi Enter hoặc
	 * Thêm, mục hiện thành dòng phía trên ô với ô tick mờ (lúc tạo chưa tick được) và nút xoá.
	 *
	 * Nằm trong form khác nên không dùng `<form>` riêng: Enter trong ô chỉ thêm mục, không gửi form ngoài.
	 * Chữ gõ dở tự thành mục khi rời ô; form cha gọi `commitDraft()` trước khi gửi, phòng khi gửi bằng
	 * Enter ở ô khác. Giới hạn theo API: tối đa 100 mục, mỗi mục 300 ký tự.
	 */
	const props = defineProps<{ id?: string; label?: string }>();
	const items = defineModel<string[]>({ required: true });

	const draft = ref('');
	const input = ref<HTMLInputElement | null>(null);

	const full = computed(() => items.value.length >= CHECKLIST_MAX_ITEMS);
	const tooLong = computed(() => draft.value.trim().length > CHECKLIST_ITEM_MAX);
	const canAdd = computed(() => !full.value && !tooLong.value && !!draft.value.trim());

	function add() {
		if (!canAdd.value) return;
		items.value = [...items.value, draft.value.trim()];
		draft.value = '';
		input.value?.focus();
	}

	/**
	 * Chữ gõ dở mà chưa Enter: hợp lệ thì thành mục, để người gõ mục cuối rồi bấm luôn nút gửi không
	 * mất chữ. Trả `false` khi chữ quá dài: form không được gửi, con trỏ quay về ô đang báo lỗi.
	 */
	function commitDraft(): boolean {
		if (tooLong.value) {
			input.value?.focus();
			input.value?.scrollIntoView({ block: 'center' });
			return false;
		}
		if (draft.value.trim() && !full.value) items.value = [...items.value, draft.value.trim()];
		draft.value = '';
		return true;
	}

	/**
	 * Rời ô thì chữ gõ dở thành mục. Rời ô vì bấm chuột (vào nút Giao việc chẳng hạn) thì chờ nhả chuột
	 * xong mới thêm: thêm ngay thì danh sách dài ra, đẩy nút xuống khỏi con trỏ và cú bấm bị mất. Nút gửi
	 * tự gọi `commitDraft()` trước khi gửi nên không mất chữ.
	 */
	let pointerDown = false;
	const onPointerDown = () => (pointerDown = true);
	const onPointerUp = () => (pointerDown = false);
	function onBlur() {
		if (tooLong.value) return;
		if (!pointerDown) {
			commitDraft();
			return;
		}
		window.addEventListener('pointerup', () => setTimeout(() => !tooLong.value && commitDraft()), { once: true, capture: true });
	}
	onMounted(() => {
		document.addEventListener('pointerdown', onPointerDown, true);
		document.addEventListener('pointerup', onPointerUp, true);
	});
	onBeforeUnmount(() => {
		document.removeEventListener('pointerdown', onPointerDown, true);
		document.removeEventListener('pointerup', onPointerUp, true);
	});

	defineExpose({ commitDraft, hasDraft: () => !!draft.value.trim() });

	function remove(index: number) {
		items.value = items.value.filter((_, i) => i !== index);
	}
</script>

<template>
	<div>
		<label :for="props.id" class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ props.label ?? 'Danh sách kiểm tra' }}</label>
		<ul v-if="items.length" class="mt-2 space-y-1" data-testid="checklist-input-items">
			<li v-for="(item, i) in items" :key="`${i}-${item}`" class="flex items-center gap-2">
				<input type="checkbox" disabled class="h-4 w-4 shrink-0 rounded border-gray-300 opacity-50" aria-hidden="true" tabindex="-1" />
				<span class="min-w-0 flex-1 break-words text-sm text-gray-800 dark:text-gray-200">{{ item }}</span>
				<button
					type="button"
					class="shrink-0 rounded p-0.5 text-gray-400 hover:text-rose-600 focus:text-rose-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
					:aria-label="`Xoá mục ${item}`"
					@click="remove(i)"
				>
					<Icon name="heroicons:x-mark" class="h-4 w-4" />
				</button>
			</li>
		</ul>
		<div class="mt-2 flex gap-2">
			<input
				:id="props.id"
				ref="input"
				v-model="draft"
				type="text"
				:disabled="full"
				:placeholder="full ? `Tối đa ${CHECKLIST_MAX_ITEMS} mục` : 'Thêm mục kiểm tra'"
				aria-label="Thêm mục kiểm tra"
				class="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:cursor-not-allowed disabled:bg-gray-50 dark:bg-gray-800 dark:text-gray-100 dark:disabled:bg-gray-900"
				:class="tooLong ? 'border-rose-500' : 'border-gray-300 dark:border-gray-600'"
				data-testid="checklist-input"
				@keydown.enter.prevent="add"
				@blur="onBlur"
			/>
			<!-- Giữ con trỏ trong ô khi bấm Thêm, để gõ mục tiếp ngay. -->
			<CommonAppButton type="button" variant="secondary" :disabled="!canAdd" data-testid="checklist-input-add" @mousedown.prevent @click="add">Thêm</CommonAppButton>
		</div>
		<p v-if="tooLong" class="mt-1 text-xs text-rose-600">Mỗi mục tối đa {{ CHECKLIST_ITEM_MAX }} ký tự, mục này đang có {{ draft.trim().length }}.</p>
		<p v-else-if="full" class="mt-1 text-xs text-gray-500">Tối đa {{ CHECKLIST_MAX_ITEMS }} mục.</p>
	</div>
</template>
