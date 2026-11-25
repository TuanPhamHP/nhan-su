<script setup lang="ts">
	import TaskStatusBadge from '~/components/modules/tasks/TaskStatusBadge.vue';
	import { useKpiService } from '~/services/kpi.service';
	import type { KpiEvidence, KpiReviewLine } from '~/types/kpi.types';
	import type { TaskStatus } from '~/types/tasks.types';
	import { KPI_EVIDENCE_TEXT, kpiNum, kpiValueText } from '~/utils/kpi.utils';
	import { shortDate, taskErrorInfo } from '~/utils/tasks.utils';
	import { vnCalendarDate } from '~/utils/date';

	/**
	 * Bấm số tự động ra bằng chứng (F-24, mục 9.2): khung bên phải liệt kê việc hoặc ngày công làm nên con số.
	 * Bằng chứng lưu cùng lần tính nên khớp con số đang hiện, kể cả sau khi số đã khoá.
	 *
	 * Việc người xem không xem được (`canView: false`) chỉ hiện số hiệu và ngày, không tiêu đề, không bấm mở.
	 */
	const props = defineProps<{ reviewId: number; line: KpiReviewLine }>();
	const emit = defineEmits<{ close: []; openTask: [code: string] }>();

	const service = useKpiService();
	const data = ref<KpiEvidence | null>(null);
	const loading = ref(true);
	const error = ref('');

	async function load() {
		loading.value = true;
		error.value = '';
		try {
			data.value = await service.evidence(props.reviewId, props.line.id);
		} catch (err) {
			error.value = taskErrorInfo(err, 'Chưa tải được bằng chứng.').message;
		} finally {
			loading.value = false;
		}
	}
	onMounted(load);
	useEscapeKey(() => emit('close'), () => true);

	const texts = computed(() => (props.line.autoKey ? KPI_EVIDENCE_TEXT[props.line.autoKey] : null));
	const items = computed(() => data.value?.items ?? []);
	const shownValue = computed(() => kpiValueText(props.line, props.line.adjusted ? props.line.autoValue : props.line.value));
	const panelRef = ref<HTMLElement | null>(null);
	onMounted(() => nextTick(() => panelRef.value?.focus()));

	/** Đúng hạn, trả lại có cột "đạt"; khối lượng, chất lượng, số việc, quá hạn thì không. */
	const showMatched = computed(() => !!texts.value?.matched);
	const pointSum = computed(() => items.value.reduce((n, t) => n + t.points, 0));
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-[60] bg-black/30" @click.self="emit('close')">
			<aside
				ref="panelRef"
				tabindex="-1"
				role="dialog"
				aria-modal="true"
				:aria-label="`Bằng chứng: ${line.name}`"
				data-testid="kpi-evidence"
				class="fixed inset-y-0 right-0 flex w-full flex-col bg-white shadow-2xl outline-none sm:w-[480px] dark:bg-gray-900"
			>
				<div class="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
					<div class="min-w-0">
						<p class="text-xs font-medium uppercase tracking-wide text-gray-500">Bằng chứng</p>
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ line.name }}</h2>
						<p class="text-sm text-gray-600 dark:text-gray-300">
							Số hệ thống tính: <b>{{ shownValue }}</b>
						</p>
					</div>
					<button type="button" class="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Đóng" @click="emit('close')">
						<Icon name="heroicons:x-mark" class="h-5 w-5" />
					</button>
				</div>

				<div class="min-h-0 flex-1 overflow-y-auto">
					<div v-if="loading" class="space-y-2 p-4" aria-busy="true">
						<div v-for="i in 5" :key="i" class="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
					</div>
					<div v-else-if="error" class="space-y-2 p-5 text-sm">
						<p class="text-rose-600">{{ error }}</p>
						<CommonAppButton size="sm" variant="secondary" @click="load">Thử lại</CommonAppButton>
					</div>

					<!-- Chuyên cần: ngày đi muộn, ngày vắng -->
					<div v-else-if="data?.kind === 'attendance'" class="space-y-4 p-5 text-sm" data-testid="kpi-evidence-attendance">
						<p class="text-gray-700 dark:text-gray-200">
							{{ data.workingDays ?? 0 }} ngày làm việc trong kỳ · {{ data.lateCount ?? 0 }} lần đi muộn · {{ data.absentDays?.length ?? 0 }} ngày vắng không phép
						</p>
						<p class="text-xs text-gray-500">Điểm chuyên cần = 100 − 2 × số lần đi muộn − 5 × số ngày vắng không phép. Đã trừ phần giải trình, bù công đã duyệt.</p>
						<div>
							<h3 class="mb-1 font-medium text-gray-900 dark:text-gray-100">Ngày đi muộn</h3>
							<p v-if="!data.lateDays?.length" class="text-gray-500">Không có ngày nào.</p>
							<ul v-else class="flex flex-wrap gap-1.5">
								<li v-for="d in data.lateDays" :key="d" class="rounded-md bg-amber-50 px-2 py-0.5 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">{{ shortDate(d) }}</li>
							</ul>
						</div>
						<div>
							<h3 class="mb-1 font-medium text-gray-900 dark:text-gray-100">Ngày vắng không phép</h3>
							<p v-if="!data.absentDays?.length" class="text-gray-500">Không có ngày nào.</p>
							<ul v-else class="flex flex-wrap gap-1.5">
								<li v-for="d in data.absentDays" :key="d" class="rounded-md bg-rose-50 px-2 py-0.5 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">{{ shortDate(d) }}</li>
							</ul>
						</div>
					</div>

					<!-- Việc -->
					<template v-else-if="data?.kind === 'tasks'">
						<p class="border-b border-gray-100 px-5 py-2 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-300" data-testid="kpi-evidence-summary">
							{{ texts?.set ?? 'Việc' }}: <b>{{ data.total ?? items.length }}</b>
							<template v-if="showMatched"> · {{ texts?.matched }}: <b>{{ data.matched ?? 0 }}</b></template>
							<template v-if="line.autoKey === 'TASK_POINTS_ACCEPTED'"> · cộng {{ kpiNum(pointSum) }} điểm</template>
						</p>
						<p v-if="!items.length" class="p-6 text-center text-sm text-gray-500">Không có việc nào trong kỳ.</p>
						<ul v-else class="divide-y divide-gray-100 dark:divide-gray-800" data-testid="kpi-evidence-list">
							<li v-for="t in items" :key="t.id" class="flex items-start gap-3 px-5 py-2.5">
								<Icon
									v-if="showMatched"
									:name="t.matched ? 'heroicons:check-circle' : 'heroicons:x-circle'"
									class="mt-0.5 h-4 w-4 shrink-0"
									:class="t.matched === (line.autoKey !== 'TASK_RETURN_RATE') ? 'text-emerald-500' : 'text-rose-500'"
									:aria-label="t.matched ? texts?.matched ?? 'đạt' : 'không'"
								/>
								<div class="min-w-0 flex-1">
									<button
										v-if="t.canView"
										type="button"
										class="block w-full text-left text-sm text-gray-900 hover:underline dark:text-gray-100"
										@click="emit('openTask', t.code)"
									>
										<span class="mr-1 text-xs font-semibold text-gray-500">{{ t.code }}</span>{{ t.title }}
									</button>
									<p v-else class="text-sm text-gray-500" :data-testid="`kpi-evidence-hidden-${t.code}`">
										<span class="mr-1 text-xs font-semibold">{{ t.code }}</span>
										<span class="italic">Việc bạn không xem được</span>
									</p>
									<p class="text-xs text-gray-500">
										hạn {{ shortDate(t.dueDate) }}<template v-if="t.originalDueDate !== t.dueDate"> (ban đầu {{ shortDate(t.originalDueDate) }})</template>
										<template v-if="t.firstSubmittedAt"> · báo xong {{ shortDate(vnCalendarDate(t.firstSubmittedAt)) }}</template>
										<template v-if="t.acceptedAt"> · nghiệm thu {{ shortDate(vnCalendarDate(t.acceptedAt)) }}</template>
										· {{ t.points }} điểm
										<template v-if="t.qualityScore"> · chất lượng {{ t.qualityScore }}/5</template>
										<template v-if="t.returnCount"> · trả lại {{ t.returnCount }} lần</template>
									</p>
								</div>
								<TaskStatusBadge :status="t.status as TaskStatus" />
							</li>
						</ul>
					</template>
					<p v-else class="p-6 text-center text-sm text-gray-500">Chỉ tiêu nhập tay, không có bằng chứng tự động.</p>
				</div>
			</aside>
		</div>
	</Teleport>
</template>
