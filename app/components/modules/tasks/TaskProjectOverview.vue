<script setup lang="ts">
	import TaskEmptyState from '~/components/modules/tasks/TaskEmptyState.vue';
	import { useTasksService } from '~/services/tasks.service';
	import type { TaskProjectOverview, TaskStatus } from '~/types/tasks.types';
	import { STATUS_LABELS, TASK_HINTS, shortDate, taskErrorInfo, vnToday } from '~/utils/tasks.utils';

	/**
	 * Thẻ Tổng quan của dự án (RP-03, `GET /task-reports/project/:id`): số việc theo trạng thái, quá hạn,
	 * mỗi nhóm việc "x/y xong", việc đang mở theo người, đợt đang chạy. Chỉ đếm việc cấp trên.
	 * Bấm một nhóm hay một người thì sang thẻ Việc đã lọc sẵn.
	 */
	const props = defineProps<{ projectId: number }>();
	const emit = defineEmits<{ filter: [patch: Record<string, string>] }>();

	const service = useTasksService();
	const today = vnToday();
	const data = ref<TaskProjectOverview | null>(null);
	const loading = ref(true);
	const loadError = ref('');

	async function load() {
		loading.value = true;
		loadError.value = '';
		try {
			data.value = await service.projectOverview(props.projectId);
		} catch (err) {
			loadError.value = taskErrorInfo(err, 'Chưa tải được tổng quan dự án.').message;
		} finally {
			loading.value = false;
		}
	}
	onMounted(load);

	const STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'];
	const TONE: Record<TaskStatus, string> = {
		TODO: 'text-gray-700 dark:text-gray-200',
		IN_PROGRESS: 'text-sky-700 dark:text-sky-300',
		IN_REVIEW: 'text-violet-700 dark:text-violet-300',
		DONE: 'text-emerald-700 dark:text-emerald-300',
		CANCELLED: 'text-gray-400',
	};
	const pct = (done: number, total: number) => (total ? Math.round((done / total) * 100) : 0);

	defineExpose({ reload: load });
</script>

<template>
	<div class="space-y-4" data-testid="project-overview">
		<div v-if="loading" class="grid gap-3 sm:grid-cols-3" aria-busy="true">
			<div v-for="i in 6" :key="i" class="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
		</div>
		<TaskEmptyState v-else-if="loadError" kind="error" title="Chưa tải được tổng quan" :description="loadError" action-label="Thử lại" @action="load" />
		<template v-else-if="data">
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
				<div v-for="s in STATUSES" :key="s" class="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
					<p class="text-xs text-gray-500 dark:text-gray-400">{{ STATUS_LABELS[s] }}</p>
					<p class="mt-1 text-2xl font-semibold" :class="TONE[s]">{{ data.statusCounts[s] }}</p>
				</div>
				<button
					type="button"
					class="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-left hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-rose-800 dark:bg-rose-900/10"
					@click="emit('filter', { due: 'overdue' })"
				>
					<p class="text-xs text-rose-700 dark:text-rose-300">Quá hạn</p>
					<p class="mt-1 text-2xl font-semibold text-rose-700 dark:text-rose-300" data-testid="overview-overdue">{{ data.overdue }}</p>
				</button>
			</div>

			<div class="grid gap-4 lg:grid-cols-2">
				<section class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900" aria-label="Theo nhóm việc">
					<h3 class="flex items-center gap-1 text-sm font-semibold text-gray-900 dark:text-white">
						Theo nhóm việc
						<span class="cursor-help text-xs font-normal text-gray-400" :title="TASK_HINTS.group" aria-label="Nhóm việc là gì">ⓘ</span>
					</h3>
					<p v-if="!data.groups.length" class="mt-2 text-sm text-gray-500">Dự án chưa chia nhóm việc.</p>
					<ul v-else class="mt-3 space-y-3" data-testid="overview-groups">
						<li v-for="g in data.groups" :key="g.id">
							<button
								type="button"
								class="w-full text-left focus:outline-none focus:ring-2 focus:ring-brand-500"
								@click="emit('filter', { taskGroup: String(g.id) })"
							>
								<div class="flex items-center justify-between text-sm">
									<span class="font-medium text-gray-800 dark:text-gray-200">
										{{ g.name }}<span v-if="g.archived" class="ml-1 text-xs font-normal text-gray-400">(đã cất)</span>
									</span>
									<span class="text-gray-600 dark:text-gray-300" :data-testid="`overview-group-${g.id}`">{{ g.doneCount }}/{{ g.taskCount }} xong · {{ g.points }} điểm</span>
								</div>
								<div class="mt-1 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
									<div class="h-full rounded-full bg-emerald-500" :style="{ width: `${pct(g.doneCount, g.taskCount)}%` }" />
								</div>
							</button>
						</li>
					</ul>
				</section>

				<section class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900" aria-label="Đợt đang chạy">
					<h3 class="flex items-center gap-1 text-sm font-semibold text-gray-900 dark:text-white">
						Đợt đang chạy
						<span class="cursor-help text-xs font-normal text-gray-400" :title="TASK_HINTS.sprint" aria-label="Đợt là gì">ⓘ</span>
					</h3>
					<template v-if="data.activeSprint">
						<p class="mt-2 text-sm text-gray-800 dark:text-gray-200">
							<strong>{{ data.activeSprint.name }}</strong>,
							{{ shortDate(data.activeSprint.startDate, today) }} tới {{ shortDate(data.activeSprint.endDate, today) }}
						</p>
						<p v-if="data.activeSprint.goal" class="text-xs text-gray-500">{{ data.activeSprint.goal }}</p>
						<p class="mt-2 text-sm text-gray-700 dark:text-gray-300" data-testid="overview-sprint-points">
							Xong {{ data.activeSprint.points.DONE }}/{{ data.activeSprint.totalPoints }} điểm
						</p>
						<div class="mt-1 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
							<div class="h-full bg-emerald-500" :style="{ width: `${pct(data.activeSprint.points.DONE, data.activeSprint.totalPoints)}%` }" />
						</div>
						<p class="mt-2 text-xs text-gray-500">
							Chưa làm {{ data.activeSprint.points.TODO }} · Đang làm {{ data.activeSprint.points.IN_PROGRESS }} · Chờ nghiệm thu {{ data.activeSprint.points.IN_REVIEW }} điểm
						</p>
					</template>
					<p v-else class="mt-2 text-sm text-gray-500">{{ data.project.useSprints ? 'Chưa có đợt nào đang chạy.' : 'Dự án không chia đợt.' }}</p>
				</section>
			</div>

			<section class="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900" aria-label="Theo người">
				<h3 class="px-4 pt-4 text-sm font-semibold text-gray-900 dark:text-white">Việc đang mở theo người</h3>
				<p v-if="!data.byAssignee.length" class="px-4 py-3 text-sm text-gray-500">Không còn việc nào đang mở.</p>
				<table v-else class="mt-2 w-full text-sm">
					<thead class="text-left text-xs text-gray-500 dark:text-gray-400">
						<tr>
							<th class="px-4 py-2 font-medium">Người thực hiện</th>
							<th class="w-24 px-4 py-2 text-right font-medium">Đang mở</th>
							<th class="w-24 px-4 py-2 text-right font-medium">Quá hạn</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="r in data.byAssignee" :key="r.person.id" class="border-t border-gray-100 dark:border-gray-800">
							<td class="px-4 py-2">
								<button
									type="button"
									class="flex items-center gap-2 text-left hover:underline focus:outline-none focus:ring-2 focus:ring-brand-500"
									@click="emit('filter', { assignee: String(r.person.id) })"
								>
									<CommonAppAvatar :src="r.person.avatarUrl" :name="r.person.fullName" size="xs" />
									<span class="text-gray-800 dark:text-gray-200">{{ r.person.fullName }}</span>
									<span v-if="r.person.inactive" class="text-xs text-gray-400">(đã nghỉ)</span>
								</button>
							</td>
							<td class="px-4 py-2 text-right text-gray-700 dark:text-gray-200">{{ r.open }}</td>
							<td class="px-4 py-2 text-right" :class="r.overdue ? 'font-semibold text-rose-600' : 'text-gray-500'">{{ r.overdue }}</td>
						</tr>
					</tbody>
				</table>
			</section>
		</template>
	</div>
</template>
