<script setup lang="ts">
	import TaskStatusBadge from '~/components/modules/tasks/TaskStatusBadge.vue';
	import type { SortableDropEvent } from '~/composables/useSortableList';
	import type { TaskListItem } from '~/types/tasks.types';
	import { DUE_TONE_CLASS, dueTone, taskDueText, taskPointsText } from '~/utils/tasks.utils';

	/**
	 * Một vùng thả của màn Việc chờ xếp và Đợt: một đợt, hoặc khối Việc chờ xếp. Mỗi vùng giữ một thể
	 * hiện SortableJS (qua `useSortableList`), cùng nhóm với các vùng khác nên kéo việc qua lại được.
	 * Mọi dòng có menu "Đưa vào đợt" thay cho kéo (bàn phím, màn cảm ứng).
	 */
	const props = withDefaults(
		defineProps<{
			/** `backlog` hoặc `s-<id đợt>`. */
			zone: string;
			tasks: TaskListItem[];
			group: string;
			today: string;
			/** Nơi chuyển tới được (đợt chưa đóng, Việc chờ xếp), trừ chính vùng này. */
			targets: Array<{ key: string; label: string }>;
			disabled?: boolean;
			activeCode?: string | null;
			emptyText: string;
		}>(),
		{ disabled: false, activeCode: null },
	);
	const emit = defineEmits<{ drop: [event: SortableDropEvent]; open: [task: TaskListItem]; moveTo: [task: TaskListItem, key: string] }>();

	const listRef = ref<HTMLElement | null>(null);
	useSortableList(listRef, {
		group: props.group,
		disabled: () => props.disabled,
		onDrop: e => emit('drop', e),
	});

	const menuFor = ref<number | null>(null);
	const menuTargets = computed(() => props.targets.filter(x => x.key !== props.zone));
	function pick(t: TaskListItem, key: string) {
		menuFor.value = null;
		emit('moveTo', t, key);
	}
	function onDocPointer(e: PointerEvent) {
		if (menuFor.value == null) return;
		if (!(e.target as HTMLElement).closest?.('[data-sprint-menu]')) menuFor.value = null;
	}
	onMounted(() => document.addEventListener('pointerdown', onDocPointer));
	onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocPointer));
</script>

<template>
	<div ref="listRef" :data-sortable-zone="zone" class="flex min-h-[3rem] flex-col gap-1.5 p-2" :data-testid="`sprint-zone-${zone}`">
		<div
			v-for="t in tasks"
			:key="t.id"
			:data-sortable-id="t.id"
			:data-task-code="t.code"
			class="flex items-center gap-2 rounded-lg border bg-white px-2.5 py-2 text-sm shadow-sm dark:bg-gray-900"
			:class="[activeCode === t.code ? 'border-brand-500 ring-1 ring-brand-500' : 'border-gray-200 dark:border-gray-700', disabled ? '' : 'cursor-grab']"
		>
			<span v-if="t.dependencies?.late" class="h-2 w-2 shrink-0 rounded-full bg-rose-500" title="Việc này đang chờ một việc bị trễ" />
			<button
				type="button"
				class="min-w-0 flex-1 text-left focus:outline-none focus:ring-2 focus:ring-brand-500"
				@click="emit('open', t)"
			>
				<span class="mr-1 text-xs font-semibold text-gray-500 dark:text-gray-400">{{ t.code }}</span>
				<span class="text-gray-900 dark:text-gray-100">{{ t.title }}</span>
				<span class="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px]">
					<span :class="DUE_TONE_CLASS[dueTone(t, today)]">{{ taskDueText(t, today) }}</span>
					<span v-if="t.group" class="text-gray-500">{{ t.group.name }}</span>
					<span v-if="t.sprintMoveCount" class="text-orange-700 dark:text-orange-400" data-testid="task-sprint-moves">chuyển đợt {{ t.sprintMoveCount }} lần</span>
					<span v-if="t.addedAfterSprintStart" class="text-gray-500">thêm khi đợt đã chạy</span>
				</span>
			</button>
			<TaskStatusBadge class="hidden sm:inline-flex" :status="t.status" :label="t.statusLabel" />
			<span class="w-8 shrink-0 text-right text-xs font-medium text-gray-600 dark:text-gray-300" :title="t.points == null ? 'Chưa có điểm, tính 0 điểm' : `${t.points} điểm`">{{ taskPointsText(t.points) }}</span>
			<CommonAppAvatar :src="t.assignee.avatarUrl" :name="t.assignee.fullName" size="xs" :title="t.assignee.fullName" />
			<div v-if="!disabled && menuTargets.length" class="relative" data-no-drag data-sprint-menu>
				<button
					type="button"
					class="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:hover:bg-gray-800"
					:aria-label="`Đưa ${t.code} vào đợt`"
					aria-haspopup="menu"
					:aria-expanded="menuFor === t.id"
					:data-testid="`sprint-menu-${t.code}`"
					@click="menuFor = menuFor === t.id ? null : t.id"
				>
					<Icon name="heroicons:arrows-right-left" class="h-4 w-4" />
				</button>
				<div
					v-if="menuFor === t.id"
					role="menu"
					class="absolute right-0 top-full z-30 mt-1 w-56 rounded-xl border border-gray-200 bg-white py-1 text-sm shadow-xl dark:border-gray-700 dark:bg-gray-900"
				>
					<p class="px-3 py-1 text-xs text-gray-500">Đưa vào đợt</p>
					<button
						v-for="x in menuTargets"
						:key="x.key"
						type="button"
						role="menuitem"
						class="block w-full px-3 py-2 text-left text-gray-700 hover:bg-gray-50 focus:bg-gray-100 focus:outline-none dark:text-gray-200 dark:hover:bg-gray-800"
						@click="pick(t, x.key)"
					>
						{{ x.label }}
					</button>
				</div>
			</div>
		</div>
		<p v-if="!tasks.length" class="py-3 text-center text-xs text-gray-400 dark:text-gray-500" data-no-drag>{{ emptyText }}</p>
	</div>
</template>
