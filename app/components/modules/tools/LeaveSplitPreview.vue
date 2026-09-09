<script setup lang="ts">
import { format, parseISO } from 'date-fns';
import LeaveCodeBadge from '~/components/modules/tools/LeaveCodeBadge.vue';
import type { LeaveSplitRecalcResult, LeaveSplitRecalcItem } from '~/types/leave-tools.types';

const props = defineProps<{ result: LeaveSplitRecalcResult }>();

/** Một người thường có nhiều đơn — gộp theo nhân sự cho dễ đọc. */
const groups = computed(() => {
	const map = new Map<number, { fullName: string; employeeCode: string; items: LeaveSplitRecalcItem[] }>();
	for (const item of props.result.items) {
		const group = map.get(item.employeeId);
		if (group) group.items.push(item);
		else map.set(item.employeeId, { fullName: item.fullName, employeeCode: item.employeeCode, items: [item] });
	}
	return [...map.values()].sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'));
});

const paidDelta = computed(() => props.result.paidBefore - props.result.paidAfter);

function fmtDate(d: string) {
	try {
		return format(parseISO(d), 'dd/MM/yyyy');
	} catch {
		return d;
	}
}
</script>

<template>
	<div class="space-y-4">
		<!-- Trạng thái rỗng -->
		<div
			v-if="result.changed === 0"
			class="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-50 dark:bg-green-900/20"
		>
			<svg
				class="w-5 h-5 text-green-600 dark:text-green-400"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			<p class="text-sm text-green-800 dark:text-green-200">
				Không có gì cần sửa — đã quét {{ result.scanned }} đơn trong năm {{ result.year }}.
			</p>
		</div>

		<!-- Tóm tắt -->
		<div v-else class="px-4 py-3 rounded-xl bg-brand-50 dark:bg-brand-900/20">
			<p class="text-sm text-gray-800 dark:text-gray-100">
				<strong class="text-base">{{ paidDelta }} ngày</strong>
				sẽ chuyển từ có lương sang không lương
				<span class="text-gray-500 dark:text-gray-400">
					({{ result.paidBefore }} → {{ result.paidAfter }} ngày có lương)
				</span>
			</p>
			<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
				{{ result.changed }} đơn thay đổi / {{ result.scanned }} đơn đã quét trong năm {{ result.year }}
				<template v-if="result.month">· chỉ áp dụng cho tháng {{ result.month }}</template>
			</p>
		</div>

		<!-- Cảnh báo đơn lệch nằm ngoài tháng đã chọn -->
		<div
			v-if="result.skippedOutsideMonth > 0"
			class="flex gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20"
		>
			<svg
				class="w-5 h-5 flex-shrink-0 text-amber-600 dark:text-amber-400"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
				/>
			</svg>
			<p class="text-sm text-amber-800 dark:text-amber-200">
				Còn <strong>{{ result.skippedOutsideMonth }} đơn</strong> sai ở tháng khác chưa xử lý — bỏ chọn tháng để
				xử lý cả năm.
			</p>
		</div>

		<!-- Bảng chi tiết theo nhân sự -->
		<div v-if="result.items.length > 0" class="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
			<div class="overflow-x-auto max-h-[420px] overflow-y-auto">
				<table class="w-full text-sm">
					<thead class="bg-gray-50 dark:bg-gray-800/60 sticky top-0">
						<tr class="text-xs font-medium text-gray-500 dark:text-gray-400 text-left">
							<th class="px-4 py-2.5">Ngày nghỉ</th>
							<th class="px-4 py-2.5">Loại</th>
							<th class="px-4 py-2.5 text-right">Tổng ngày</th>
							<th class="px-4 py-2.5 text-right">Có lương</th>
							<th class="px-4 py-2.5 text-right">Không lương</th>
							<th class="px-4 py-2.5">Ký hiệu</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
						<template v-for="group in groups" :key="group.employeeCode">
							<tr class="bg-gray-50/70 dark:bg-gray-800/40">
								<td colspan="6" class="px-4 py-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
									{{ group.fullName }}
									<span class="ml-1.5 font-normal text-xs text-gray-500 dark:text-gray-400">
										{{ group.employeeCode }} · {{ group.items.length }} đơn
									</span>
								</td>
							</tr>
							<tr v-for="item in group.items" :key="item.leaveRequestId" class="text-gray-700 dark:text-gray-300">
								<td class="px-4 py-2.5">{{ fmtDate(item.date) }}</td>
								<td class="px-4 py-2.5 text-gray-500 dark:text-gray-400">
									{{ item.leaveTypeCode === 'HALF_DAY' ? 'Nửa ngày' : 'Phép năm' }}
								</td>
								<td class="px-4 py-2.5 text-right tabular-nums">{{ item.totalDays }}</td>
								<td class="px-4 py-2.5 text-right tabular-nums">
									<span class="text-gray-400 line-through">{{ item.paidBefore }}</span>
									<span class="ml-1.5 font-medium text-gray-900 dark:text-white">{{ item.paidAfter }}</span>
								</td>
								<td class="px-4 py-2.5 text-right tabular-nums">
									<span class="text-gray-400 line-through">{{ item.unpaidBefore }}</span>
									<span class="ml-1.5 font-medium text-gray-900 dark:text-white">{{ item.unpaidAfter }}</span>
								</td>
								<td class="px-4 py-2.5">
									<div class="flex items-center gap-1.5">
										<LeaveCodeBadge :code="item.leaveCodeBefore" />
										<span class="text-gray-400">→</span>
										<LeaveCodeBadge :code="item.leaveCodeAfter" />
									</div>
								</td>
							</tr>
						</template>
					</tbody>
				</table>
			</div>
		</div>

		<!-- Nhắc bước tiếp theo, hiển thị nguyên văn từ BE -->
		<p v-if="result.nextStep" class="text-sm text-gray-500 dark:text-gray-400">{{ result.nextStep }}</p>
	</div>
</template>
