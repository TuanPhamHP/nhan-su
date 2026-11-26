<script setup lang="ts">
	import { format, parseISO } from 'date-fns';
	import TaskEmptyState from '~/components/modules/tasks/TaskEmptyState.vue';
	import TaskStatusBadge from '~/components/modules/tasks/TaskStatusBadge.vue';
	import { useTasksService } from '~/services/tasks.service';
	import type { TaskCalendar, TaskListItem, TaskListQuery, TaskStatus } from '~/types/tasks.types';
	import { monthGrid, calendarMonthLabel, shiftMonth, tasksByDue } from '~/utils/task-timeline';
	import { shortDate, taskErrorInfo, vnToday } from '~/utils/tasks.utils';

	/**
	 * Lịch tháng theo hạn (UI-04), dùng chung thanh lọc với ba chế độ kia. Mỗi ô ngày hiện tối đa ba
	 * việc, còn nữa thì nút "+n việc" mở cả ngày. Bấm việc mở khung chi tiết. Màn hẹp thì xếp thành
	 * danh sách các ngày có việc thay vì lưới bảy cột.
	 */
	const props = withDefaults(defineProps<{ query: TaskListQuery; activeCode?: string | null }>(), { activeCode: null });
	const emit = defineEmits<{ open: [task: TaskListItem] }>();

	const service = useTasksService();
	const route = useRoute();
	const router = useRouter();
	const today = vnToday();

	/** Tháng đang xem nằm trên đường dẫn (`?month=2026-12`) để gửi cho đồng nghiệp đúng tháng đó. */
	const month = computed(() => {
		const m = String(route.query.month ?? '');
		return /^\d{4}-\d{2}$/.test(m) ? m : today.slice(0, 7);
	});
	function setMonth(m: string) {
		router.replace({ query: { ...route.query, month: m === today.slice(0, 7) ? undefined : m } });
	}

	const grid = computed(() => monthGrid(month.value));
	const data = ref<TaskCalendar | null>(null);
	const loading = ref(true);
	const loadError = ref('');

	let seq = 0;
	async function load(silent = false) {
		const my = ++seq;
		if (!silent) loading.value = true;
		loadError.value = '';
		try {
			const res = await service.calendar({ ...props.query, from: grid.value.from, to: grid.value.to });
			if (my === seq) data.value = res;
		} catch (err) {
			if (my === seq && !silent) loadError.value = taskErrorInfo(err, 'Chưa tải được lịch.').message;
		} finally {
			if (my === seq) loading.value = false;
		}
	}
	onMounted(() => load());
	watch(() => [JSON.stringify(props.query), month.value], () => load());

	const byDay = computed(() => tasksByDue(data.value?.tasks ?? []));
	const expanded = ref<string | null>(null);

	const CHIP: Record<TaskStatus, string> = {
		TODO: 'border-gray-300 bg-white text-gray-800 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100',
		IN_PROGRESS: 'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-700 dark:bg-sky-900/30 dark:text-sky-100',
		IN_REVIEW: 'border-violet-300 bg-violet-50 text-violet-900 dark:border-violet-700 dark:bg-violet-900/30 dark:text-violet-100',
		DONE: 'border-emerald-200 bg-emerald-50 text-emerald-800 line-through decoration-emerald-400 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200',
		CANCELLED: 'border-gray-200 bg-gray-50 text-gray-400 line-through dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500',
	};

	const WEEK_HEAD = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
	const inMonth = (d: string) => d.slice(0, 7) === month.value;
	const dayNum = (d: string) => format(parseISO(d), 'd');
	const monthDays = computed(() => [...byDay.value.entries()].filter(([d]) => inMonth(d)));

	defineExpose({ reload: () => load(true) });
</script>

<template>
	<div class="space-y-2" data-testid="task-calendar">
		<div class="flex flex-wrap items-center gap-2 text-sm">
			<button
				type="button"
				class="rounded-md border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
				aria-label="Tháng trước"
				data-testid="calendar-prev"
				@click="setMonth(shiftMonth(month, -1))"
			>
				<Icon name="heroicons:chevron-left" class="h-4 w-4" />
			</button>
			<button
				type="button"
				class="rounded-md border border-gray-200 px-2.5 py-1 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
				@click="setMonth(today.slice(0, 7))"
			>
				Tháng này
			</button>
			<button
				type="button"
				class="rounded-md border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
				aria-label="Tháng sau"
				data-testid="calendar-next"
				@click="setMonth(shiftMonth(month, 1))"
			>
				<Icon name="heroicons:chevron-right" class="h-4 w-4" />
			</button>
			<h3 class="ml-1 font-semibold text-gray-900 dark:text-white" data-testid="calendar-month">{{ calendarMonthLabel(month) }}</h3>
			<span v-if="data" class="text-gray-500 dark:text-gray-400">{{ data.tasks.filter(t => !!t.dueDate && inMonth(t.dueDate)).length }} việc có hạn trong tháng</span>
		</div>

		<p v-if="data?.truncated" class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
			Tháng này có hơn 500 việc nên chỉ hiện 500 việc đầu. Bạn lọc hẹp hơn để xem đủ.
		</p>

		<div v-if="loading" class="h-96 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" aria-busy="true" />
		<TaskEmptyState v-else-if="loadError" kind="error" title="Chưa tải được lịch" :description="loadError" action-label="Thử lại" @action="load()" />
		<template v-else>
			<!-- Lưới tháng (từ sm) -->
			<div class="hidden overflow-hidden rounded-xl border border-gray-200 bg-white sm:block dark:border-gray-700 dark:bg-gray-900">
				<div class="grid grid-cols-7 border-b border-gray-200 bg-gray-50 text-center text-xs font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400">
					<div v-for="h in WEEK_HEAD" :key="h" class="py-1.5">{{ h }}</div>
				</div>
				<div class="grid grid-cols-7">
					<div
						v-for="d in grid.days"
						:key="d"
						class="min-h-[7rem] border-b border-r border-gray-100 p-1.5 dark:border-gray-800"
						:class="inMonth(d) ? '' : 'bg-gray-50/60 dark:bg-gray-800/30'"
						:data-day="d"
					>
						<div class="mb-1 flex items-center justify-between">
							<span
								class="flex h-6 w-6 items-center justify-center rounded-full text-xs"
								:class="d === today ? 'bg-brand-600 font-semibold text-white' : inMonth(d) ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400 dark:text-gray-600'"
							>
								{{ dayNum(d) }}
							</span>
						</div>
						<ul class="space-y-1">
							<li v-for="t in (expanded === d ? byDay.get(d) ?? [] : (byDay.get(d) ?? []).slice(0, 3))" :key="t.id">
								<button
									type="button"
									class="flex w-full items-center gap-1 truncate rounded border px-1.5 py-0.5 text-left text-[11px] leading-4 focus:outline-none focus:ring-2 focus:ring-brand-500"
									:class="[CHIP[t.status], t.overdue ? 'border-rose-400 dark:border-rose-600' : '', activeCode === t.code ? 'ring-2 ring-brand-500' : '']"
									:title="`${t.code} ${t.title} · ${t.assignee.fullName} · ${t.statusLabel}`"
									:data-testid="`calendar-task-${t.code}`"
									@click="emit('open', t)"
								>
									<span v-if="t.overdue" class="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
									<span class="shrink-0 font-semibold">{{ t.code }}</span>
									<span class="truncate">{{ t.title }}</span>
								</button>
							</li>
						</ul>
						<button
							v-if="(byDay.get(d)?.length ?? 0) > 3"
							type="button"
							class="mt-1 text-[11px] font-medium text-brand-600 hover:underline dark:text-brand-400"
							@click="expanded = expanded === d ? null : d"
						>
							{{ expanded === d ? 'Thu gọn' : `+${(byDay.get(d)?.length ?? 0) - 3} việc` }}
						</button>
					</div>
				</div>
			</div>

			<!-- Màn hẹp: các ngày có việc -->
			<div class="space-y-3 sm:hidden" data-testid="calendar-agenda">
				<p v-if="!monthDays.length" class="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700">
					Tháng này không có việc nào tới hạn.
				</p>
				<section v-for="[d, list] in monthDays" :key="d" class="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
					<h4 class="border-b border-gray-100 px-3 py-2 text-xs font-semibold dark:border-gray-800" :class="d === today ? 'text-brand-700 dark:text-brand-300' : 'text-gray-700 dark:text-gray-200'">
						{{ d === today ? 'Hôm nay, ' : '' }}{{ shortDate(d, today) }}
					</h4>
					<ul class="divide-y divide-gray-100 dark:divide-gray-800">
						<li v-for="t in list" :key="t.id">
							<button type="button" class="flex w-full items-center gap-2 px-3 py-2 text-left" @click="emit('open', t)">
								<span class="min-w-0 flex-1">
									<span class="block truncate text-sm text-gray-900 dark:text-gray-100">{{ t.title }}</span>
									<span class="text-xs text-gray-500">{{ t.code }} · {{ t.assignee.fullName }}</span>
								</span>
								<TaskStatusBadge :status="t.status" :label="t.statusLabel" />
							</button>
						</li>
					</ul>
				</section>
			</div>
		</template>
	</div>
</template>
