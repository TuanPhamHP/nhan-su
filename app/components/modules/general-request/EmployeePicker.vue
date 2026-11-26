<script setup lang="ts">
	import { vnSearchIncludes } from '~/utils/vn-text';
	/**
	 * Ô chọn người: gõ để tìm, bấm để thêm, thẻ tên có nút bỏ.
	 *
	 * Dùng cho người theo dõi, người nhận lượt duyệt, người duyệt cố định của một bước luồng.
	 * Không dùng `UiSelect` vì danh sách nhân viên dài hàng trăm dòng và thường cần chọn nhiều
	 * người, còn `UiSelect` là ô chọn một giá trị không có chỗ gõ tìm.
	 *
	 * Thứ tự chọn được giữ nguyên: bước "người gửi chọn, duyệt lần lượt" lấy đúng thứ tự này
	 * làm thứ tự duyệt, nên không sắp lại theo tên.
	 */
	export interface PickablePerson {
		id: number;
		fullName: string;
		/** Mã nhân viên hoặc tên phòng, hiện mờ bên cạnh tên để phân biệt người trùng tên. */
		hint?: string | null;
	}

	const props = withDefaults(
		defineProps<{
			modelValue: number[];
			people: PickablePerson[];
			label?: string;
			placeholder?: string;
			/** Số người nhiều nhất được chọn; vượt thì ô tìm bị khoá. */
			max?: number;
			/** Chọn đúng một người: chọn người mới thay người cũ. */
			single?: boolean;
			disabled?: boolean;
			error?: string | null;
			hint?: string | null;
			/** Hiện số thứ tự trước mỗi thẻ tên, cho bước duyệt lần lượt. */
			ordered?: boolean;
		}>(),
		{ placeholder: 'Gõ tên để tìm người', max: 50 },
	);

	const emit = defineEmits<{ 'update:modelValue': [value: number[]] }>();

	const query = ref('');
	const open = ref(false);
	const boxRef = ref<HTMLElement | null>(null);

	const byId = computed(() => new Map(props.people.map(p => [p.id, p])));
	// Danh bạ thiếu người đó (đã nghỉ, hoặc chưa tải xong) thì vẫn phải hiện một dòng đọc được.
	const selected = computed(() =>
		props.modelValue.map(id => byId.value.get(id) ?? { id, fullName: 'Không rõ tên người này' }),
	);

	const atLimit = computed(() => !props.single && props.modelValue.length >= props.max);

	const matches = computed(() => {
		// Tìm không dấu (`vnSearchIncludes`): gõ "lan" ra "Lê Thị Lan" cả khi máy không bật bộ gõ tiếng Việt.
		const q = query.value.trim();
		return props.people
			.filter(p => !props.modelValue.includes(p.id))
			.filter(p => !q || vnSearchIncludes(p.fullName, q) || vnSearchIncludes(p.hint ?? '', q))
			.slice(0, 8);
	});

	function add(person: PickablePerson) {
		if (props.single) {
			emit('update:modelValue', [person.id]);
		} else {
			if (atLimit.value) return;
			emit('update:modelValue', [...props.modelValue, person.id]);
		}
		query.value = '';
		open.value = false;
	}

	function remove(id: number) {
		emit(
			'update:modelValue',
			props.modelValue.filter(x => x !== id),
		);
	}

	function onClickOutside(event: MouseEvent) {
		if (boxRef.value && !boxRef.value.contains(event.target as Node)) open.value = false;
	}

	onMounted(() => document.addEventListener('mousedown', onClickOutside));
	onUnmounted(() => document.removeEventListener('mousedown', onClickOutside));
</script>

<template>
	<div ref="boxRef" class="space-y-1.5">
		<label v-if="label" class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ label }}</label>

		<div v-if="selected.length" class="flex flex-wrap gap-1.5">
			<span
				v-for="(person, idx) in selected"
				:key="person.id"
				class="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
			>
				<span v-if="ordered" class="font-semibold">{{ idx + 1 }}.</span>
				{{ person.fullName }}
				<button
					v-if="!disabled"
					type="button"
					class="rounded-full p-0.5 hover:bg-brand-100 dark:hover:bg-brand-900/60"
					:aria-label="`Bỏ chọn ${person.fullName}`"
					@click="remove(person.id)"
				>
					<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</span>
		</div>

		<div class="relative">
			<!--
				Mở danh sách gợi ý cả khi gõ, không chỉ khi ô được chọn: chọn xong một người thì
				danh sách đóng lại nhưng con trỏ vẫn nằm trong ô, nên người gõ tiếp tên thứ hai sẽ
				không thấy gợi ý nào nếu chỉ dựa vào `focus`.
			-->
			<input
				v-model="query"
				type="text"
				:placeholder="atLimit ? `Đã chọn đủ ${max} người` : placeholder"
				:disabled="disabled || atLimit"
				class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
				@focus="open = true"
				@input="open = true"
			/>
			<div
				v-if="open && !disabled && !atLimit"
				class="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
			>
				<button
					v-for="person in matches"
					:key="person.id"
					type="button"
					class="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
					@mousedown.prevent="add(person)"
				>
					<span class="font-medium text-gray-900 dark:text-white">{{ person.fullName }}</span>
					<span v-if="person.hint" class="text-xs text-gray-400">{{ person.hint }}</span>
				</button>
				<p v-if="!matches.length" class="px-3 py-2.5 text-sm text-gray-400">
					{{ query ? 'Không tìm thấy ai phù hợp.' : 'Chưa có người nào để chọn.' }}
				</p>
			</div>
		</div>

		<p v-if="error" class="text-xs text-rose-600 dark:text-rose-400">{{ error }}</p>
		<p v-else-if="hint" class="text-xs text-gray-500 dark:text-gray-400">{{ hint }}</p>
	</div>
</template>
