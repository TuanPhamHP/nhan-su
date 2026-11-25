<script setup lang="ts">
	import type { TaskFilterState } from '~/composables/useTaskFilters';
	import { BOARD_STATUSES, PRIORITY_LABELS, STATUS_LABELS } from '~/utils/tasks.utils';

	/**
	 * Thanh lọc dùng chung cho Danh sách và Bảng việc (mục 9.2): đổi chế độ xem không mất bộ lọc.
	 * Người thực hiện, Trạng thái, Hạn (Quá hạn, Hôm nay, Tuần này, Tuần sau), Ưu tiên, ô tìm theo tiêu
	 * đề hoặc số hiệu (máy chủ tìm không dấu).
	 */
	const props = defineProps<{
		state: TaskFilterState;
		people: Array<{ id: number; fullName: string }>;
		isDefault: boolean;
		/** Ẩn nút chuyển Danh sách/Bảng việc (màn chỉ có một chế độ). */
		hideMode?: boolean;
	}>();
	const emit = defineEmits<{ reset: [] }>();

	const qDraft = ref(props.state.q);
	let timer: ReturnType<typeof setTimeout> | null = null;
	watch(qDraft, v => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			// eslint-disable-next-line vue/no-mutating-props -- state là reactive của useTaskFilters, cố ý dùng chung
			props.state.q = v;
		}, 350);
	});
	watch(
		() => props.state.q,
		v => {
			if (v !== qDraft.value) qDraft.value = v;
		},
	);

	const statusOptions = computed(() => [
		{ value: '', label: 'Mọi trạng thái' },
		{ value: 'TODO,IN_PROGRESS,IN_REVIEW', label: 'Chưa xong' },
		...BOARD_STATUSES.map(s => ({ value: s, label: STATUS_LABELS[s] })),
	]);
	const dueOptions = [
		{ value: '', label: 'Mọi hạn' },
		{ value: 'overdue', label: 'Quá hạn' },
		{ value: 'today', label: 'Hôm nay' },
		{ value: 'this_week', label: 'Tuần này' },
		{ value: 'next_week', label: 'Tuần sau' },
	];
	const priorityOptions = [{ value: '', label: 'Mọi ưu tiên' }, ...Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label }))];
	const peopleOptions = computed(() => [
		{ value: '', label: 'Mọi người thực hiện' },
		...props.people.map(p => ({ value: String(p.id), label: p.fullName })),
	]);
	const groupOptions = [
		{ value: 'status', label: 'Nhóm theo trạng thái' },
		{ value: 'assignee', label: 'Nhóm theo người làm' },
		{ value: 'due', label: 'Nhóm theo hạn' },
		{ value: 'none', label: 'Không nhóm' },
	];

	/* eslint-disable vue/no-mutating-props -- các ô dưới ghi thẳng vào state dùng chung */
	function set<K extends keyof TaskFilterState>(key: K, value: TaskFilterState[K]) {
		props.state[key] = value;
	}
	/* eslint-enable vue/no-mutating-props */
</script>

<template>
	<div class="space-y-2" data-testid="task-filter-bar">
		<div class="flex flex-wrap items-center gap-2">
			<div v-if="!hideMode" class="flex rounded-lg bg-gray-100 p-0.5 text-sm dark:bg-gray-800" role="tablist" aria-label="Chế độ xem">
				<button
					type="button"
					role="tab"
					:aria-selected="state.mode === 'list'"
					class="flex items-center gap-1 rounded-md px-3 py-1.5 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
					:class="state.mode === 'list' ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'"
					@click="set('mode', 'list')"
				>
					<Icon name="heroicons:list-bullet" class="h-4 w-4" aria-hidden="true" />Danh sách
				</button>
				<button
					type="button"
					role="tab"
					:aria-selected="state.mode === 'board'"
					class="flex items-center gap-1 rounded-md px-3 py-1.5 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
					:class="state.mode === 'board' ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'"
					data-tour="task-board-tab"
					@click="set('mode', 'board')"
				>
					<Icon name="heroicons:view-columns" class="h-4 w-4" aria-hidden="true" />Bảng việc
				</button>
				<span class="flex cursor-not-allowed items-center rounded-md px-3 py-1.5 text-gray-400 dark:text-gray-600" title="Tiến độ và Lịch có ở bản sau">Tiến độ</span>
				<span class="hidden cursor-not-allowed items-center rounded-md px-3 py-1.5 text-gray-400 sm:flex dark:text-gray-600" title="Tiến độ và Lịch có ở bản sau">Lịch</span>
			</div>
			<div class="relative min-w-[12rem] flex-1">
				<Icon name="heroicons:magnifying-glass" class="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" aria-hidden="true" />
				<input
					v-model="qDraft"
					type="search"
					placeholder="Tìm theo tiêu đề hoặc số hiệu"
					aria-label="Tìm việc"
					class="w-full rounded-lg border border-gray-200 bg-white py-2 pl-8 pr-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
				/>
			</div>
		</div>
		<div class="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
			<UiSelect class="sm:w-48" :model-value="state.assignee" :options="peopleOptions" searchable @update:model-value="v => set('assignee', v == null ? '' : String(v))" />
			<UiSelect v-if="state.mode === 'list'" class="sm:w-40" :model-value="state.status" :options="statusOptions" @update:model-value="v => set('status', v == null ? '' : String(v))" />
			<UiSelect class="sm:w-36" :model-value="state.due" :options="dueOptions" @update:model-value="v => set('due', (v == null ? '' : String(v)) as TaskFilterState['due'])" />
			<UiSelect class="sm:w-40" :model-value="state.priority" :options="priorityOptions" @update:model-value="v => set('priority', v == null ? '' : String(v))" />
			<UiSelect
				v-if="state.mode === 'list'"
				class="sm:w-48"
				:model-value="state.group"
				:options="groupOptions"
				@update:model-value="v => set('group', (v ?? 'status') as TaskFilterState['group'])"
			/>
			<label v-if="state.mode === 'board'" class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
				<input
					type="checkbox"
					:checked="state.cancelled"
					class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
					@change="e => set('cancelled', (e.target as HTMLInputElement).checked)"
				/>
				Hiện cột Đã huỷ
			</label>
			<button
				v-if="!isDefault"
				type="button"
				class="col-span-2 text-left text-sm font-medium text-brand-600 hover:underline focus:outline-none focus:ring-2 focus:ring-brand-500 sm:col-span-1 dark:text-brand-400"
				@click="emit('reset')"
			>
				Về mặc định
			</button>
		</div>
	</div>
</template>
