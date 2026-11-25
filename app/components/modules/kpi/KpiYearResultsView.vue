<script setup lang="ts">
	import TaskEmptyState from '~/components/modules/tasks/TaskEmptyState.vue';
	import KpiGradeBadge from '~/components/modules/kpi/KpiGradeBadge.vue';
	import { useKpiService } from '~/services/kpi.service';
	import type { KpiYearResults } from '~/types/kpi.types';
	import { kpiNum } from '~/utils/kpi.utils';
	import { taskErrorInfo, vnToday } from '~/utils/tasks.utils';

	/**
	 * Kết quả năm (F-22): trung bình điểm các kỳ con ĐÃ CÔNG BỐ của từng người, xếp loại theo thang áp dụng
	 * ngày cuối năm. Không có kỳ năm riêng.
	 */
	const props = defineProps<{ departmentOptions: Array<{ value: string; label: string }> }>();

	const service = useKpiService();
	const thisYear = Number(vnToday().slice(0, 4));
	const year = ref(String(thisYear));
	const yearOptions = Array.from({ length: 5 }, (_, i) => ({ value: String(thisYear - i), label: `Năm ${thisYear - i}` }));
	const dept = ref(props.departmentOptions.length === 1 ? props.departmentOptions[0]!.value : '');
	const data = ref<KpiYearResults | null>(null);
	const loading = ref(true);
	const error = ref('');

	async function load() {
		loading.value = true;
		error.value = '';
		try {
			data.value = await service.yearResults(Number(year.value), dept.value ? Number(dept.value) : undefined);
		} catch (err) {
			error.value = taskErrorInfo(err, 'Chưa tải được kết quả năm.').message;
			data.value = null;
		} finally {
			loading.value = false;
		}
	}
	watch(() => [year.value, dept.value], load);
	onMounted(load);
	const grades = computed(() => data.value?.gradeScale?.grades ?? []);
</script>

<template>
	<div class="space-y-4" data-testid="kpi-year-results">
		<div class="flex flex-wrap items-end gap-2">
			<UiSelect class="w-full sm:w-40" label="Năm" :model-value="year" :options="yearOptions" @update:model-value="v => (year = String(v ?? thisYear))" />
			<UiSelect
				v-if="departmentOptions.length"
				class="w-full sm:w-64"
				label="Phòng"
				:model-value="dept"
				:options="departmentOptions"
				searchable
				@update:model-value="v => (dept = v == null ? '' : String(v))"
			/>
		</div>
		<p class="text-xs text-gray-500">Điểm năm là trung bình các kỳ đã công bố trong năm. Xếp loại theo thang áp dụng ngày cuối năm.</p>
		<div v-if="loading" class="h-40 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" aria-busy="true" />
		<TaskEmptyState v-else-if="error" kind="error" title="Chưa xem được kết quả năm" :description="error" action-label="Thử lại" @action="load" />
		<TaskEmptyState v-else-if="!data?.rows.length" kind="filtered" title="Chưa có kỳ nào được công bố trong năm này" />
		<div v-else class="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
			<table class="w-full min-w-[36rem] text-sm" data-testid="kpi-year-table">
				<thead class="bg-gray-50 text-left text-xs font-medium text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
					<tr>
						<th class="px-3 py-2">Nhân viên</th>
						<th class="px-3 py-2">Phòng</th>
						<th class="px-3 py-2 text-right">Số kỳ đã công bố</th>
						<th class="px-3 py-2 text-right">Điểm trung bình</th>
						<th class="px-3 py-2 text-center">Xếp loại năm</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="row in data!.rows" :key="row.employee.id" class="border-t border-gray-100 dark:border-gray-800">
						<td class="px-3 py-2">
							<p class="font-medium text-gray-900 dark:text-gray-100">{{ row.employee.fullName }}</p>
							<p class="text-xs text-gray-500">{{ row.employee.employeeCode }}</p>
						</td>
						<td class="px-3 py-2 text-gray-700 dark:text-gray-200">{{ row.department?.name ?? '—' }}</td>
						<td class="px-3 py-2 text-right">{{ row.periods }}</td>
						<td class="px-3 py-2 text-right font-semibold">{{ kpiNum(row.averageScore, 1) }}</td>
						<td class="px-3 py-2 text-center"><KpiGradeBadge :grade="row.grade" :grades="grades" /></td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>
</template>
