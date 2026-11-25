<script setup lang="ts">
	import { format, parseISO } from 'date-fns';
	import TaskStatusBadge from '~/components/modules/tasks/TaskStatusBadge.vue';
	import { useTasksService } from '~/services/tasks.service';
	import type { TaskListItem, TaskRecurrence } from '~/types/tasks.types';
	import { WEEKDAY_LABELS, recurrenceText, shortDate, taskErrorInfo, vnToday } from '~/utils/tasks.utils';

	/**
	 * Khung chi tiết một việc định kỳ: quy tắc, năm hạn sắp tới máy chủ tính (ngày 31 ở tháng ngắn ra
	 * ngày cuối tháng), lý do tự dừng nếu có, và các việc đã giao từ quy tắc này.
	 */
	const props = defineProps<{ recurrence: TaskRecurrence; readOnly?: boolean; busy?: boolean }>();
	const emit = defineEmits<{ close: []; edit: []; pause: []; resume: []; openTask: [code: string] }>();

	const service = useTasksService();
	const today = vnToday();
	const tasks = ref<TaskListItem[]>([]);
	const tasksTotal = ref(0);
	const loadingTasks = ref(true);
	const tasksError = ref('');

	async function loadTasks() {
		loadingTasks.value = true;
		tasksError.value = '';
		try {
			const res = await service.list({ recurrenceId: props.recurrence.id, sort: '-dueDate', limit: 10 });
			tasks.value = res.data;
			tasksTotal.value = res.meta.total;
		} catch (err) {
			tasksError.value = taskErrorInfo(err, 'Chưa tải được việc đã giao.').message;
		} finally {
			loadingTasks.value = false;
		}
	}
	watch(() => props.recurrence.id, loadTasks, { immediate: true });
	useEscapeKey(() => emit('close'), () => true);

	/** "Thứ Hai 30/11/2026": hạn sắp tới đọc kèm thứ để dễ thấy ngày cuối tháng rơi vào đâu. */
	function longDay(d: string): string {
		const date = parseISO(d);
		const dow = date.getDay() === 0 ? 7 : date.getDay();
		return `${WEEKDAY_LABELS[dow]} ${format(date, 'dd/MM/yyyy')}`;
	}
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-[55] flex justify-end bg-black/30" @click.self="emit('close')">
			<aside
				class="flex h-full w-full max-w-lg flex-col bg-white shadow-xl dark:bg-gray-900"
				role="dialog"
				aria-modal="true"
				:aria-label="recurrence.title"
				data-testid="recurrence-detail"
			>
				<header class="flex items-start gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
					<div class="min-w-0 flex-1">
						<p class="text-xs text-gray-500">Việc định kỳ</p>
						<h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ recurrence.title }}</h2>
						<p class="mt-1 text-sm text-teal-700 dark:text-teal-300">{{ recurrenceText(recurrence) }}<template v-if="recurrence.leadDays">, hiện trước {{ recurrence.leadDays }} ngày</template></p>
					</div>
					<button type="button" class="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Đóng" @click="emit('close')">
						<Icon name="heroicons:x-mark" class="h-5 w-5" />
					</button>
				</header>
				<div class="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4 text-sm">
					<div
						v-if="!recurrence.isActive"
						class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
						data-testid="recurrence-paused"
					>
						<strong>Đang dừng.</strong>
						{{ recurrence.pausedReason ? `Hệ thống tự dừng: ${recurrence.pausedReason}.` : 'Người đặt hoặc quản lý dự án đã dừng.' }}
					</div>

					<section v-if="recurrence.isActive" aria-label="Hạn sắp tới">
						<h3 class="font-semibold text-gray-900 dark:text-white">Năm hạn sắp tới</h3>
						<ol class="mt-2 space-y-1" data-testid="recurrence-upcoming">
							<li v-for="(d, i) in recurrence.upcoming" :key="d" class="flex items-center gap-2">
								<span class="flex h-5 w-5 items-center justify-center rounded-full bg-teal-100 text-[11px] font-semibold text-teal-800 dark:bg-teal-900/40 dark:text-teal-200">{{ i + 1 }}</span>
								<span class="text-gray-800 dark:text-gray-200">{{ longDay(d) }}</span>
							</li>
						</ol>
						<p v-if="recurrence.nextAppearDate" class="mt-2 text-xs text-gray-500">
							Lần tới việc hiện ra cho người làm từ {{ shortDate(recurrence.nextAppearDate, today) }}.
						</p>
					</section>

					<dl class="grid grid-cols-2 gap-3">
						<div>
							<dt class="text-xs text-gray-500">Người thực hiện</dt>
							<dd class="mt-0.5 text-gray-900 dark:text-gray-100">
								{{ recurrence.assignee.fullName }}<span v-if="recurrence.assignee.inactive" class="ml-1 text-xs text-rose-600">(đã nghỉ)</span>
							</dd>
						</div>
						<div>
							<dt class="text-xs text-gray-500">Người giao</dt>
							<dd class="mt-0.5 text-gray-900 dark:text-gray-100">{{ recurrence.assigner.fullName }}</dd>
						</div>
						<div>
							<dt class="text-xs text-gray-500">Người nghiệm thu</dt>
							<dd class="mt-0.5 text-gray-900 dark:text-gray-100">{{ recurrence.reviewer.fullName }}</dd>
						</div>
						<div>
							<dt class="text-xs text-gray-500">Dự án</dt>
							<dd class="mt-0.5 text-gray-900 dark:text-gray-100">{{ recurrence.project?.name ?? 'Việc lẻ' }}</dd>
						</div>
						<div>
							<dt class="text-xs text-gray-500">Điểm, ưu tiên</dt>
							<dd class="mt-0.5 text-gray-900 dark:text-gray-100">{{ recurrence.points }} điểm · {{ recurrence.priorityLabel }}</dd>
						</div>
						<div>
							<dt class="text-xs text-gray-500">Thời gian</dt>
							<dd class="mt-0.5 text-gray-900 dark:text-gray-100">
								Từ {{ shortDate(recurrence.startDate, today) }}<template v-if="recurrence.endDate"> tới {{ shortDate(recurrence.endDate, today) }}</template>
							</dd>
						</div>
					</dl>
					<div v-if="recurrence.checklist.length">
						<h3 class="text-xs text-gray-500">Danh sách kiểm tra mỗi lần</h3>
						<ul class="mt-1 list-inside list-disc text-gray-800 dark:text-gray-200">
							<li v-for="(c, i) in recurrence.checklist" :key="i">{{ c }}</li>
						</ul>
					</div>

					<section aria-label="Việc đã giao">
						<h3 class="font-semibold text-gray-900 dark:text-white">Việc đã giao ({{ recurrence.taskCount }})</h3>
						<div v-if="loadingTasks" class="mt-2 h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
						<p v-else-if="tasksError" class="mt-2 text-rose-600">{{ tasksError }}</p>
						<p v-else-if="!tasks.length" class="mt-2 text-gray-500">Chưa giao lần nào. Việc tự hiện ra vào sáng ngày báo trước.</p>
						<ul v-else class="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-700">
							<li v-for="t in tasks" :key="t.id">
								<button type="button" class="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800" @click="emit('openTask', t.code)">
									<span class="text-xs font-semibold text-gray-500">{{ t.code }}</span>
									<span class="min-w-0 flex-1 truncate">hạn {{ shortDate(t.dueDate, today) }}</span>
									<TaskStatusBadge :status="t.status" :label="t.statusLabel" />
								</button>
							</li>
						</ul>
						<p v-if="tasksTotal > tasks.length" class="mt-1 text-xs text-gray-500">Còn {{ tasksTotal - tasks.length }} việc cũ hơn.</p>
					</section>
				</div>
				<footer v-if="recurrence.canManage && !readOnly" class="flex justify-end gap-2 border-t border-gray-200 px-5 py-3 dark:border-gray-700">
					<CommonAppButton variant="secondary" :disabled="busy" data-testid="recurrence-edit" @click="emit('edit')">Sửa</CommonAppButton>
					<CommonAppButton v-if="recurrence.isActive" variant="danger_outline" :loading="busy" data-testid="recurrence-pause" @click="emit('pause')">Dừng</CommonAppButton>
					<CommonAppButton v-else :loading="busy" data-testid="recurrence-resume" @click="emit('resume')">Chạy lại</CommonAppButton>
				</footer>
			</aside>
		</div>
	</Teleport>
</template>
