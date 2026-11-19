<script setup lang="ts">
	import { vnSearchText } from '~/utils/vn-text';

	/**
	 * Ô nhập một danh sách chữ ngắn: mỗi mục đã chọn là một chip, gõ thì có gợi ý.
	 *
	 * Vì sao không để người dùng tự gõ các mục cách nhau bằng dấu phẩy: cách đó trông đơn giản nhưng
	 * đẩy hết việc sang người dùng — họ phải tự nhớ đã ghi gì, tự gõ lại đúng chữ ở từng phòng, và
	 * một dấu phẩy thiếu là hai thiết bị dính thành một. Ô này cho chọn lại thứ các phòng khác đang
	 * dùng, nên cùng một cái máy chiếu không bị ghi thành "máy chiếu", "Máy Chiếu", "may chieu".
	 *
	 * Gõ không dấu vẫn tìm ra: "may" ra "Máy chiếu", vì người dùng gõ nhanh thường không bật bộ gõ.
	 */
	const props = withDefaults(
		defineProps<{
			/** Các mục đã chọn. */
			modelValue: string[];
			/** Gợi ý: danh sách mẫu cộng những mục nơi khác đang dùng. */
			suggestions?: string[];
			placeholder?: string;
			label?: string;
			/** Câu giải thích ngắn, hiện sau dấu hỏi cạnh nhãn. */
			hint?: string;
			disabled?: boolean;
			/** Số mục tối đa và độ dài tối đa của một mục, theo giới hạn của máy chủ. */
			maxItems?: number;
			maxLength?: number;
			id?: string;
		}>(),
		{ suggestions: () => [], maxItems: 20, maxLength: 50 },
	);

	const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>();

	const query = ref('');
	const open = ref(false);
	const highlighted = ref(-1);
	const error = ref('');
	const boxRef = ref<HTMLElement | null>(null);
	const inputRef = ref<HTMLInputElement | null>(null);

	const inputId = computed(() => props.id ?? `ui-tag-${Math.random().toString(36).slice(2)}`);

	/** Hai mục coi là một khi chỉ khác dấu cách thừa hoặc hoa thường. */
	function sameTag(a: string, b: string): boolean {
		return a.trim().toLowerCase().replace(/\s+/g, ' ') === b.trim().toLowerCase().replace(/\s+/g, ' ');
	}

	const selected = computed(() => props.modelValue ?? []);

	/** Gợi ý còn lại: bỏ mục đã chọn, bỏ trùng nhau, rồi lọc theo chữ đang gõ. */
	const filtered = computed(() => {
		const pool: string[] = [];
		for (const item of props.suggestions) {
			const value = item.trim();
			if (!value) continue;
			if (selected.value.some(tag => sameTag(tag, value))) continue;
			if (pool.some(existing => sameTag(existing, value))) continue;
			pool.push(value);
		}
		if (!query.value.trim()) return pool;
		const needle = vnSearchText(query.value);
		return pool.filter(item => vnSearchText(item).includes(needle));
	});

	/** Chữ đang gõ chưa có trong gợi ý và chưa được chọn: cho thêm mới. */
	const canAddTyped = computed(() => {
		const value = query.value.trim();
		if (!value) return false;
		if (selected.value.some(tag => sameTag(tag, value))) return false;
		return !filtered.value.some(item => sameTag(item, value));
	});

	/** Số dòng trong danh sách, để ↑↓ chạy hết cả dòng "Thêm …". */
	const rowCount = computed(() => filtered.value.length + (canAddTyped.value ? 1 : 0));

	function openList() {
		if (props.disabled) return;
		open.value = true;
		highlighted.value = -1;
	}

	function closeList() {
		open.value = false;
		highlighted.value = -1;
	}

	function addTag(raw: string) {
		const value = raw.trim().replace(/\s+/g, ' ');
		if (!value) return;
		// Hai giới hạn này là của máy chủ; chặn ngay tại ô để người dùng không gõ xong mới bị từ chối.
		if (value.length > props.maxLength) {
			error.value = `Mỗi mục tối đa ${props.maxLength} ký tự.`;
			return;
		}
		if (selected.value.length >= props.maxItems) {
			error.value = `Nhiều nhất ${props.maxItems} mục.`;
			return;
		}
		if (selected.value.some(tag => sameTag(tag, value))) {
			error.value = `"${value}" đã có trong danh sách.`;
			query.value = '';
			return;
		}
		error.value = '';
		emit('update:modelValue', [...selected.value, value]);
		query.value = '';
		highlighted.value = -1;
	}

	function removeTag(index: number) {
		error.value = '';
		emit(
			'update:modelValue',
			selected.value.filter((_, i) => i !== index),
		);
	}

	function moveHighlight(step: 1 | -1) {
		if (!open.value) openList();
		if (!rowCount.value) return;
		highlighted.value = (highlighted.value + step + rowCount.value) % rowCount.value;
	}

	/** Enter: lấy dòng đang tô; chưa tô dòng nào thì lấy dòng đầu, không có dòng nào thì thêm chữ đang gõ. */
	function commit() {
		if (highlighted.value >= 0 && highlighted.value < filtered.value.length) {
			addTag(filtered.value[highlighted.value] as string);
			return;
		}
		if (highlighted.value === filtered.value.length && canAddTyped.value) {
			addTag(query.value);
			return;
		}
		if (query.value.trim()) {
			const exact = filtered.value.find(item => sameTag(item, query.value));
			addTag(exact ?? query.value);
			return;
		}
		if (filtered.value.length) addTag(filtered.value[0] as string);
	}

	/** Backspace khi ô trống: bỏ chip cuối, như mọi ô dạng tag khác. */
	function onBackspace() {
		if (query.value.length || !selected.value.length) return;
		removeTag(selected.value.length - 1);
	}

	function onDocumentPointerDown(event: Event) {
		if (boxRef.value && !boxRef.value.contains(event.target as Node)) closeList();
	}

	onMounted(() => document.addEventListener('pointerdown', onDocumentPointerDown));
	onUnmounted(() => document.removeEventListener('pointerdown', onDocumentPointerDown));

	watch(query, () => {
		highlighted.value = -1;
		error.value = '';
	});
</script>

<template>
	<div ref="boxRef" class="relative flex flex-col gap-1">
		<div v-if="label || hint" class="flex items-center gap-1.5">
			<label v-if="label" :for="inputId" class="text-sm font-medium text-gray-700 dark:text-gray-300">
				{{ label }}
			</label>
			<!-- Câu phụ nằm sau dấu hỏi, như các trang khác; nhãn của ô đã nói đủ việc chính. -->
			<UiTooltip v-if="hint" :label="hint">
				<Icon
					name="heroicons:information-circle"
					class="h-4 w-4 text-gray-400 dark:text-gray-500"
					:aria-label="hint"
				/>
			</UiTooltip>
		</div>

		<!-- Khung chip: bấm vào bất cứ đâu trong khung cũng đưa con trỏ vào ô gõ. -->
		<div
			:class="[
				'flex min-h-[42px] w-full flex-wrap items-center gap-1.5 rounded-lg border bg-white px-2 py-1.5 transition-colors dark:bg-gray-800',
				disabled ? 'cursor-not-allowed opacity-60' : 'cursor-text',
				error
					? 'border-rose-400 dark:border-rose-500'
					: open
						? 'border-brand-500 ring-2 ring-brand-200 dark:ring-brand-900'
						: 'border-gray-300 dark:border-gray-600',
			]"
			@click="inputRef?.focus()"
		>
			<span
				v-for="(tag, index) in selected"
				:key="`${tag}-${index}`"
				class="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
			>
				{{ tag }}
				<button
					v-if="!disabled"
					type="button"
					class="flex h-4 w-4 items-center justify-center rounded-full text-brand-600 transition-colors hover:bg-brand-100 hover:text-brand-800 dark:text-brand-300 dark:hover:bg-brand-800"
					:aria-label="`Bỏ ${tag}`"
					@click.stop="removeTag(index)"
				>
					<Icon name="mdi:close" class="h-3 w-3" aria-hidden="true" />
				</button>
			</span>

			<input
				:id="inputId"
				ref="inputRef"
				v-model="query"
				type="text"
				autocomplete="off"
				:disabled="disabled"
				:placeholder="selected.length ? '' : placeholder"
				class="min-w-[8rem] flex-1 border-none bg-transparent px-1 py-0.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100"
				role="combobox"
				aria-autocomplete="list"
				:aria-expanded="open"
				@focus="openList"
				@keydown.down.prevent="moveHighlight(1)"
				@keydown.up.prevent="moveHighlight(-1)"
				@keydown.enter.prevent="commit"
				@keydown.esc.prevent.stop="closeList"
				@keydown.backspace="onBackspace"
			/>
		</div>

		<p v-if="error" class="text-xs text-rose-600 dark:text-rose-400">{{ error }}</p>

		<!-- Danh sách gợi ý -->
		<Transition
			enter-active-class="transition ease-out duration-100"
			enter-from-class="opacity-0 -translate-y-1"
			enter-to-class="opacity-100 translate-y-0"
			leave-active-class="transition ease-in duration-75"
			leave-from-class="opacity-100"
			leave-to-class="opacity-0"
		>
			<div
				v-if="open && (filtered.length || canAddTyped)"
				class="absolute top-full left-0 z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
				role="listbox"
			>
				<button
					v-for="(item, index) in filtered"
					:key="item"
					type="button"
					:class="[
						'flex w-full items-center rounded px-3 py-2 text-left text-sm transition-colors',
						highlighted === index
							? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
							: 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700',
					]"
					role="option"
					:aria-selected="highlighted === index"
					@mouseenter="highlighted = index"
					@click="addTag(item)"
				>
					{{ item }}
				</button>

				<!-- Không có trong danh sách thì thêm mới, ngay tại đây. -->
				<button
					v-if="canAddTyped"
					type="button"
					:class="[
						'flex w-full items-center gap-1.5 rounded px-3 py-2 text-left text-sm transition-colors',
						highlighted === filtered.length
							? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
							: 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700',
					]"
					role="option"
					:aria-selected="highlighted === filtered.length"
					@mouseenter="highlighted = filtered.length"
					@click="addTag(query)"
				>
					<Icon name="mdi:plus" class="h-4 w-4" aria-hidden="true" />
					Thêm "{{ query.trim() }}"
				</button>
			</div>
		</Transition>
	</div>
</template>
