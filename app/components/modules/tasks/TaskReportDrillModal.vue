<script setup lang="ts">
	import TaskStatusBadge from '~/components/modules/tasks/TaskStatusBadge.vue';
	import { useTasksService } from '~/services/tasks.service';
	import type { TaskListItem, TaskProgressMetric, TaskReportQuery } from '~/types/tasks.types';
	import { shortDate, taskErrorInfo, vnToday } from '~/utils/tasks.utils';

	/**
	 * Bấm một ô số trên báo cáo tiến độ (T-13): mở đúng các việc làm nên con số đó, bằng
	 * `GET /task-reports/progress/tasks?metric=` cùng bộ lọc. `meta.total` bằng con số ở mọi ô; riêng
	 * Khối lượng là các việc cộng điểm ra con số, Chất lượng là các việc có chấm.
	 */
	const props = defineProps<{
		query: TaskReportQuery;
		metric: TaskProgressMetric;
		metricLabel: string;
		/** Bỏ trống: dòng Tổng. */
		assigneeId?: number | null;
		personName?: string | null;
		/** Con số đang hiện trên ô, để đối chiếu. */
		expected: number | string;
	}>();
	const emit = defineEmits<{ close: []; open: [task: TaskListItem] }>();

	const service = useTasksService();
	const today = vnToday();
	const tasks = ref<TaskListItem[]>([]);
	const total = ref(0);
	const page = ref(1);
	const loading = ref(true);
	const loadingMore = ref(false);
	const error = ref('');

	async function load(more = false) {
		if (more) loadingMore.value = true;
		else loading.value = true;
		error.value = '';
		try {
			const next = more ? page.value + 1 : 1;
			const res = await service.progressTasks({
				...props.query,
				metric: props.metric,
				assigneeId: props.assigneeId ?? undefined,
				page: next,
				limit: 50,
			});
			tasks.value = more ? [...tasks.value, ...res.data] : res.data;
			total.value = res.meta.total;
			page.value = next;
		} catch (err) {
			error.value = taskErrorInfo(err, 'Chưa tải được danh sách việc.').message;
		} finally {
			loading.value = false;
			loadingMore.value = false;
		}
	}
	onMounted(() => load());
	useEscapeKey(() => emit('close'), () => true);

	const pointSum = computed(() => tasks.value.reduce((n, t) => n + t.points, 0));
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" @click.self="emit('close')">
			<div
				class="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl dark:bg-gray-900"
				role="dialog"
				aria-modal="true"
				:aria-label="`${metricLabel}${personName ? `, ${personName}` : ''}`"
				data-testid="report-drill"
			>
				<div class="flex items-start justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
					<div>
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ metricLabel }} · {{ personName || 'Tổng' }}</h2>
						<p class="text-sm text-gray-500 dark:text-gray-400" data-testid="report-drill-total">
							<template v-if="!loading">
								{{ total }} việc<template v-if="metric === 'points'"> · cộng {{ pointSum }} điểm</template>
								<template v-if="metric !== 'quality'"> · ô báo cáo ghi {{ expected }}</template>
							</template>
						</p>
					</div>
					<button type="button" class="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Đóng" @click="emit('close')">
						<Icon name="heroicons:x-mark" class="h-5 w-5" />
					</button>
				</div>
				<div class="min-h-0 flex-1 overflow-y-auto">
					<div v-if="loading" class="space-y-2 p-4" aria-busy="true">
						<div v-for="i in 4" :key="i" class="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
					</div>
					<p v-else-if="error" class="p-4 text-sm text-rose-600">{{ error }}</p>
					<p v-else-if="!tasks.length" class="p-6 text-center text-sm text-gray-500">Không có việc nào.</p>
					<ul v-else class="divide-y divide-gray-100 dark:divide-gray-800" data-testid="report-drill-list">
						<li v-for="t in tasks" :key="t.id">
							<button type="button" class="flex w-full items-center gap-3 px-5 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50" @click="emit('open', t)">
								<span class="w-16 shrink-0 text-xs font-semibold text-gray-500">{{ t.code }}</span>
								<span class="min-w-0 flex-1">
									<span class="block truncate text-sm text-gray-900 dark:text-gray-100">{{ t.title }}</span>
									<span class="text-xs text-gray-500">
										{{ t.assignee.fullName }} · hạn {{ shortDate(t.dueDate, today) }}<template v-if="t.dueChangeCount"> (ban đầu {{ shortDate(t.originalDueDate, today) }})</template>
										· {{ t.points }} điểm<template v-if="t.qualityScore"> · {{ t.qualityScore }} sao</template>
									</span>
								</span>
								<TaskStatusBadge :status="t.status" :label="t.statusLabel" />
							</button>
						</li>
					</ul>
					<div v-if="tasks.length < total" class="p-3 text-center">
						<CommonAppButton size="sm" variant="secondary" :loading="loadingMore" @click="load(true)">Tải thêm</CommonAppButton>
					</div>
				</div>
			</div>
		</div>
	</Teleport>
</template>
