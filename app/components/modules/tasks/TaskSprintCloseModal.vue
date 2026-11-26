<script setup lang="ts">
	import TaskStatusBadge from '~/components/modules/tasks/TaskStatusBadge.vue';
	import { useTasksService } from '~/services/tasks.service';
	import type { TaskListItem, TaskSprint, TaskSprintCloseResult, TaskSprintMoveTo } from '~/types/tasks.types';
	import { timelineAddDays } from '~/utils/task-timeline';
	import { shortDate, taskErrorInfo, vnToday } from '~/utils/tasks.utils';

	/**
	 * Hộp Đóng đợt (mục 9.2): liệt kê việc chưa xong (kể cả Chờ nghiệm thu, vì chưa nghiệm thu là chưa
	 * xong) và cho chọn nơi chuyển: đợt kế (đợt chưa bắt đầu có ngày bắt đầu sớm nhất, mặc định nếu
	 * có), một đợt mới, hoặc Việc chờ xếp. Mỗi việc bị chuyển được máy chủ cộng "chuyển đợt n lần".
	 */
	const props = defineProps<{ projectId: number; sprint: TaskSprint; sprints: TaskSprint[] }>();
	const emit = defineEmits<{ close: []; closed: [result: TaskSprintCloseResult] }>();

	const service = useTasksService();
	const toast = useToast();
	const today = vnToday();

	const open = ref<TaskListItem[]>([]);
	const loading = ref(true);
	const busy = ref(false);
	const error = ref('');

	/** Đợt kế: đợt chưa bắt đầu có ngày bắt đầu sớm nhất, đúng cách máy chủ chọn khi `moveTo: next`. */
	const nextSprint = computed(
		() =>
			[...props.sprints]
				.filter(s => s.status === 'PLANNED' && s.id !== props.sprint.id)
				.sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ?? null,
	);
	const moveTo = ref<TaskSprintMoveTo>('backlog');
	const newName = ref('');
	const newStart = ref<string | undefined>(timelineAddDays(props.sprint.endDate, 1));
	const newEnd = ref<string | undefined>(timelineAddDays(props.sprint.endDate, 14));
	const touched = ref(false);

	onMounted(async () => {
		moveTo.value = nextSprint.value ? 'next' : 'backlog';
		const n = Number(props.sprint.name.match(/(\d+)\s*$/)?.[1] ?? 0);
		newName.value = n ? props.sprint.name.replace(/(\d+)\s*$/, String(n + 1)) : `${props.sprint.name} tiếp`;
		try {
			const res = await service.list({
				projectId: props.projectId,
				sprintId: props.sprint.id,
				status: 'TODO,IN_PROGRESS,IN_REVIEW',
				topLevel: true,
				sort: 'dueDate',
				limit: 100,
			});
			open.value = res.data;
		} catch (err) {
			error.value = taskErrorInfo(err, 'Chưa tải được việc chưa xong.').message;
		} finally {
			loading.value = false;
		}
	});

	const newError = computed(() => {
		if (!touched.value || moveTo.value !== 'new') return '';
		if (!newName.value.trim()) return 'Nhập tên đợt mới';
		if (!newStart.value || !newEnd.value) return 'Chọn ngày bắt đầu và kết thúc của đợt mới';
		if (newStart.value > newEnd.value) return 'Ngày kết thúc không được trước ngày bắt đầu';
		return '';
	});

	async function confirm() {
		touched.value = true;
		if (newError.value) return;
		busy.value = true;
		try {
			const result = await service.closeSprint(props.projectId, props.sprint.id, {
				moveTo: open.value.length ? moveTo.value : undefined,
				newSprint:
					open.value.length && moveTo.value === 'new'
						? { name: newName.value.trim(), startDate: newStart.value!, endDate: newEnd.value! }
						: undefined,
			});
			const where = result.movedTo ? result.movedTo.name : 'Việc chờ xếp';
			toast.success(
				result.moved.length ? `Đã đóng ${props.sprint.name}, chuyển ${result.moved.length} việc sang ${where}` : `Đã đóng ${props.sprint.name}`,
			);
			emit('closed', result);
		} catch (err) {
			toast.error(taskErrorInfo(err).message);
		} finally {
			busy.value = false;
		}
	}
	useEscapeKey(() => emit('close'), () => !busy.value);

	const RADIO = 'flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm';
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" @click.self="emit('close')">
			<div
				class="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl dark:bg-gray-900"
				role="dialog"
				aria-modal="true"
				:aria-label="`Đóng ${sprint.name}`"
				data-testid="sprint-close-modal"
			>
				<div class="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
					<div>
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">Đóng {{ sprint.name }}</h2>
						<p class="text-xs text-gray-500">{{ shortDate(sprint.startDate, today) }} tới {{ shortDate(sprint.endDate, today) }}</p>
					</div>
					<button type="button" class="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Đóng hộp" @click="emit('close')">
						<Icon name="heroicons:x-mark" class="h-5 w-5" />
					</button>
				</div>

				<div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
					<div v-if="loading" class="space-y-2" aria-busy="true">
						<div v-for="i in 3" :key="i" class="h-9 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
					</div>
					<p v-else-if="error" class="text-sm text-rose-600">{{ error }}</p>
					<template v-else>
						<p v-if="!open.length" class="text-sm text-gray-700 dark:text-gray-300">Mọi việc trong đợt đã hoàn thành. Đóng đợt là xong.</p>
						<template v-else>
							<p class="text-sm text-gray-700 dark:text-gray-300">
								Còn <strong>{{ open.length }} việc chưa xong</strong>. Việc Chờ nghiệm thu cũng tính là chưa xong.
							</p>
							<ul class="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-700" data-testid="sprint-close-open-list">
								<li v-for="t in open" :key="t.id" class="flex items-center gap-2 px-3 py-2 text-sm">
									<span class="text-xs font-semibold text-gray-500">{{ t.code }}</span>
									<span class="min-w-0 flex-1 truncate text-gray-800 dark:text-gray-200">{{ t.title }}</span>
									<TaskStatusBadge :status="t.status" :label="t.statusLabel" />
								</li>
							</ul>

							<fieldset class="space-y-2">
								<legend class="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Chuyển những việc này tới</legend>
								<label :class="[RADIO, moveTo === 'next' ? 'border-brand-500' : 'border-gray-200 dark:border-gray-700', !nextSprint ? 'cursor-not-allowed opacity-50' : '']">
									<input v-model="moveTo" type="radio" value="next" :disabled="!nextSprint" class="mt-0.5 text-brand-600 focus:ring-brand-500" />
									<span>
										Đợt kế
										<span class="block text-xs text-gray-500">{{ nextSprint ? `${nextSprint.name}, bắt đầu ${shortDate(nextSprint.startDate, today)}` : 'Chưa có đợt nào chưa bắt đầu' }}</span>
									</span>
								</label>
								<label :class="[RADIO, moveTo === 'new' ? 'border-brand-500' : 'border-gray-200 dark:border-gray-700']">
									<input v-model="moveTo" type="radio" value="new" class="mt-0.5 text-brand-600 focus:ring-brand-500" />
									<span class="flex-1">Một đợt mới</span>
								</label>
								<div v-if="moveTo === 'new'" class="space-y-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
									<input
										v-model="newName"
										type="text"
										maxlength="100"
										aria-label="Tên đợt mới"
										class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
									/>
									<div class="grid gap-2 sm:grid-cols-2">
										<UiDatePicker v-model="newStart" label="Bắt đầu" warn-far-year />
										<UiDatePicker v-model="newEnd" label="Kết thúc" warn-far-year />
									</div>
								</div>
								<label :class="[RADIO, moveTo === 'backlog' ? 'border-brand-500' : 'border-gray-200 dark:border-gray-700']">
									<input v-model="moveTo" type="radio" value="backlog" class="mt-0.5 text-brand-600 focus:ring-brand-500" />
									<span>Việc chờ xếp<span class="block text-xs text-gray-500">Để xếp lại sau</span></span>
								</label>
								<p v-if="newError" class="text-xs text-rose-600">{{ newError }}</p>
							</fieldset>
						</template>
					</template>
				</div>

				<div class="flex justify-end gap-3 border-t border-gray-200 px-5 py-3 dark:border-gray-700">
					<CommonAppButton variant="secondary" :disabled="busy" @click="emit('close')">Huỷ</CommonAppButton>
					<CommonAppButton :loading="busy" :disabled="loading" data-testid="sprint-close-confirm" @click="confirm">Đóng đợt</CommonAppButton>
				</div>
			</div>
		</div>
	</Teleport>
</template>
