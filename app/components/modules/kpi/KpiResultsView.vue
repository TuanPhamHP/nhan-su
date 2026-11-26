<script setup lang="ts">
	import TaskEmptyState from '~/components/modules/tasks/TaskEmptyState.vue';
	import KpiDistributionBar from '~/components/modules/kpi/KpiDistributionBar.vue';
	import KpiGradeBadge from '~/components/modules/kpi/KpiGradeBadge.vue';
	import KpiStatusBadge from '~/components/modules/kpi/KpiStatusBadge.vue';
	import { useKpiService } from '~/services/kpi.service';
	import type { KpiResults } from '~/types/kpi.types';
	import { kpiNum } from '~/utils/kpi.utils';
	import { downloadTaskBlob, taskErrorInfo } from '~/utils/tasks.utils';

	/**
	 * Kết quả một kỳ (F-29, RP-10): phân bố xếp loại theo phòng bằng thanh CSS, bảng điểm từng người, xuất
	 * Excel. Ai xem phòng nào do máy chủ quyết (bridge mục 1): trưởng phòng xin phòng khác nhận 403, trang hiện
	 * nguyên câu đó. Không có cột hay chữ nào về lương, thưởng.
	 */
	const props = defineProps<{
		periodId: number;
		/** Lựa chọn phòng; rỗng thì không hiện ô chọn. Giá trị `''` là mọi phòng được xem. */
		departmentOptions: Array<{ value: string; label: string }>;
		/** Mở được phiếu từng người (nhân sự, giám đốc); trưởng phòng chỉ xem điểm. */
		canOpenReview?: boolean;
		/** Phòng đang xem, trang cha giữ trên đường dẫn (`?dept=`). */
		dept: string;
	}>();
	const emit = defineEmits<{ openReview: [id: number]; 'update:dept': [value: string] }>();

	const service = useKpiService();
	const toast = useToast();
	const dept = computed({
		get: () => props.dept,
		set: (v: string) => emit('update:dept', v),
	});
	const data = ref<KpiResults | null>(null);
	const loading = ref(true);
	const error = ref('');

	async function load() {
		loading.value = true;
		error.value = '';
		try {
			data.value = await service.periodResults(props.periodId, dept.value ? Number(dept.value) : undefined);
		} catch (err) {
			error.value = taskErrorInfo(err, 'Chưa tải được kết quả.').message;
			data.value = null;
		} finally {
			loading.value = false;
		}
	}
	watch(() => [props.periodId, dept.value], load);
	onMounted(load);

	const exporting = ref(false);
	async function exportExcel() {
		exporting.value = true;
		try {
			const blob = await service.exportPeriodResults(props.periodId, dept.value ? Number(dept.value) : undefined);
			const name = (data.value?.period.name ?? `ky-${props.periodId}`).replace(/[^\p{L}\d]+/gu, '-');
			downloadTaskBlob(blob, `ket-qua-kpi-${name}.xlsx`);
			toast.success('Đã tải file Excel');
		} catch (err) {
			toast.error(taskErrorInfo(err, 'Chưa xuất được file Excel.').message);
		} finally {
			exporting.value = false;
		}
	}

	const grades = computed(() => data.value?.period.gradeScale.grades ?? []);
	defineExpose({ reload: load });
</script>

<template>
	<div class="space-y-4" data-testid="kpi-results">
		<div class="flex flex-wrap items-end gap-2">
			<UiSelect
				v-if="departmentOptions.length"
				class="w-full sm:w-64"
				label="Phòng"
				:model-value="dept"
				:options="departmentOptions"
				searchable
				data-testid="kpi-results-dept"
				@update:model-value="v => (dept = v == null ? '' : String(v))"
			/>
			<CommonAppButton class="sm:ml-auto" variant="secondary" :loading="exporting" :disabled="!data" data-testid="kpi-results-export" @click="exportExcel">
				<Icon name="heroicons:arrow-down-tray" class="mr-1 h-4 w-4" />Xuất Excel
			</CommonAppButton>
		</div>

		<div v-if="loading" class="h-48 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" aria-busy="true" />
		<TaskEmptyState v-else-if="error" kind="error" title="Chưa xem được kết quả" :description="error" action-label="Thử lại" data-testid="kpi-results-error" @action="load" />
		<template v-else-if="data">
			<div class="space-y-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900" data-testid="kpi-distribution">
				<h3 class="text-sm font-semibold text-gray-900 dark:text-white">Phân bố xếp loại</h3>
				<KpiDistributionBar :dist="data.overall" :grades="grades" :label="dept ? 'Phòng đang xem' : 'Tất cả'" strong />
				<div v-if="data.distribution.length > 1" class="space-y-3 border-t border-gray-100 pt-3 dark:border-gray-800">
					<KpiDistributionBar v-for="d in data.distribution" :key="d.department?.id ?? 0" :dist="d" :grades="grades" :label="d.department?.name ?? 'Không thuộc phòng nào'" />
				</div>
			</div>

			<TaskEmptyState v-if="!data.rows.length" kind="filtered" title="Kỳ này chưa có phiếu nào trong phạm vi bạn xem" />
			<div v-else class="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
				<table class="w-full min-w-[44rem] text-sm" data-testid="kpi-results-table">
					<thead class="bg-gray-50 text-left text-xs font-medium text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
						<tr>
							<th class="px-3 py-2">STT</th>
							<th class="px-3 py-2">Nhân viên</th>
							<th class="px-3 py-2">Phòng</th>
							<th class="px-3 py-2">Người chấm</th>
							<th class="px-3 py-2">Bước</th>
							<th class="px-3 py-2 text-right">Tổng điểm</th>
							<th class="px-3 py-2 text-center">Xếp loại</th>
						</tr>
					</thead>
					<tbody>
						<tr
							v-for="(row, i) in data.rows"
							:key="row.id"
							class="border-t border-gray-100 dark:border-gray-800"
							:class="canOpenReview ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40' : ''"
							@click="canOpenReview && emit('openReview', row.id)"
						>
							<td class="px-3 py-2 text-gray-500">{{ i + 1 }}</td>
							<td class="px-3 py-2">
								<p class="font-medium text-gray-900 dark:text-gray-100">
									{{ row.employee.fullName }}<span v-if="row.employeeInactive" class="ml-1 text-xs font-normal text-gray-400">(đã nghỉ)</span>
								</p>
								<p class="text-xs text-gray-500">{{ row.employee.employeeCode }}</p>
							</td>
							<td class="px-3 py-2 text-gray-700 dark:text-gray-200">{{ row.department?.name ?? '—' }}</td>
							<td class="px-3 py-2 text-gray-700 dark:text-gray-200">{{ row.reviewer.fullName }}</td>
							<td class="px-3 py-2"><KpiStatusBadge :status="row.status" :label="row.statusLabel" /></td>
							<td class="px-3 py-2 text-right font-semibold">{{ kpiNum(row.totalScore, 1) }}</td>
							<td class="px-3 py-2 text-center"><KpiGradeBadge :grade="row.grade" :grades="grades" /></td>
						</tr>
					</tbody>
				</table>
			</div>
			<p class="text-xs text-gray-500">Điểm của phiếu chưa gửi đánh giá là điểm tạm tính. File Excel có thêm trang phân bố theo phòng.</p>
		</template>
	</div>
</template>
