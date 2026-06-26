<script setup lang="ts">
	import type { LeaveReportResponse } from '~/types/report.types';

	const props = defineProps<{
		employeeId: number;
		employeeCode: string;
		fullName: string;
		departmentName: string | null;
		rows: LeaveReportResponse[];
		year: number;
		month?: number;
	}>();

	defineEmits<{ close: [] }>();

	const periodLabel = computed(() =>
		props.month ? `Tháng ${props.month}/${props.year}` : `Năm ${props.year}`,
	);

	const totals = computed(() => ({
		totalRequests: props.rows.reduce((s, r) => s + r.totalRequests, 0),
		approvedRequests: props.rows.reduce((s, r) => s + r.approvedRequests, 0),
		pendingRequests: props.rows.reduce((s, r) => s + r.pendingRequests, 0),
		totalDaysApproved: props.rows.reduce((s, r) => s + r.totalDaysApproved, 0),
	}));

	function remainingClass(days: number): string {
		if (days < 2) return 'text-red-600 dark:text-red-400 font-semibold';
		if (days <= 5) return 'text-orange-500 dark:text-orange-400 font-medium';
		return 'text-green-600 dark:text-green-400 font-medium';
	}
</script>

<template>
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
		<div class="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col">
			<!-- Header -->
			<div class="flex items-start justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
				<div>
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ fullName }}</h2>
					<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
						{{ employeeCode }}
						<span v-if="departmentName"> · {{ departmentName }}</span>
						· {{ periodLabel }}
					</p>
				</div>
				<button
					class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
					@click="$emit('close')"
				>
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Summary -->
			<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 pt-4">
				<div class="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
					<p class="text-xs text-gray-500 dark:text-gray-400">Tổng đơn</p>
					<p class="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{{ totals.totalRequests }}</p>
				</div>
				<div class="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
					<p class="text-xs text-gray-500 dark:text-gray-400">Đã duyệt</p>
					<p class="text-xl font-bold text-green-600 dark:text-green-400 mt-0.5">{{ totals.approvedRequests }}</p>
				</div>
				<div class="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
					<p class="text-xs text-gray-500 dark:text-gray-400">Chờ duyệt</p>
					<p class="text-xl font-bold text-orange-500 dark:text-orange-400 mt-0.5">{{ totals.pendingRequests }}</p>
				</div>
				<div class="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
					<p class="text-xs text-gray-500 dark:text-gray-400">Tổng ngày đã dùng</p>
					<p class="text-xl font-bold text-brand-600 dark:text-brand-400 mt-0.5">{{ totals.totalDaysApproved }}</p>
				</div>
			</div>

			<!-- Body -->
			<div class="overflow-y-auto flex-1 px-6 py-4">
				<div class="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
									Loại phép
								</th>
								<th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">
									Tổng đơn
								</th>
								<th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">
									Đã duyệt
								</th>
								<th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">
									Chờ duyệt
								</th>
								<th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">
									Ngày đã dùng
								</th>
								<th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">
									Còn lại
								</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
							<tr v-if="rows.length === 0">
								<td colspan="6" class="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
									Không có dữ liệu
								</td>
							</tr>
							<tr
								v-for="(row, idx) in rows"
								:key="`${row.leaveTypeCode}-${idx}`"
								class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
							>
								<td class="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
									{{ row.leaveTypeName }}
								</td>
								<td class="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{{ row.totalRequests }}</td>
								<td class="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{{ row.approvedRequests }}</td>
								<td
									class="px-4 py-3 text-right"
									:class="row.pendingRequests > 0 ? 'text-orange-500 dark:text-orange-400 font-medium' : 'text-gray-500 dark:text-gray-400'"
								>
									{{ row.pendingRequests }}
								</td>
								<td class="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">
									{{ row.totalDaysApproved }}
								</td>
								<td class="px-4 py-3 text-right">
									<span v-if="row.remainingBalance === null" class="text-gray-400 dark:text-gray-500">—</span>
									<span v-else :class="remainingClass(row.remainingBalance)">{{ row.remainingBalance }}</span>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>

			<!-- Footer -->
			<div class="flex items-center justify-end px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
				<CommonAppButton variant="outline" @click="$emit('close')">Đóng</CommonAppButton>
			</div>
		</div>
	</div>
</template>
