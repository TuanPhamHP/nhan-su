<script setup lang="ts">
import type { LeaveBalanceRecalcResult } from '~/types/leave-tools.types';

const props = defineProps<{ result: LeaveBalanceRecalcResult }>();

const emit = defineEmits<{ 'go-to-balances': [] }>();

const exceedCount = computed(() => props.result.items.filter(i => i.exceedsAccrued).length);

function fmtDelta(delta: number) {
	return delta > 0 ? `+${delta}` : String(delta);
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
				Không có gì cần sửa — đã quét {{ result.scanned }} bản ghi số dư.
			</p>
		</div>

		<!-- Tóm tắt -->
		<div v-else class="px-4 py-3 rounded-xl bg-brand-50 dark:bg-brand-900/20">
			<p class="text-sm text-gray-800 dark:text-gray-100">
				<strong class="text-base">{{ result.changed }} bản ghi</strong> số dư sẽ được ghi lại
				<span class="text-gray-500 dark:text-gray-400">(tổng chênh lệch {{ result.totalDelta }} ngày)</span>
			</p>
			<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
				Đã quét {{ result.scanned }} bản ghi trong năm {{ result.year }}
				<template v-if="result.month">· chỉ nhân sự có đơn nghỉ trong tháng {{ result.month }}</template>
			</p>
		</div>

		<!-- Cảnh báo dùng quá tích luỹ -->
		<div v-if="exceedCount > 0" class="flex gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20">
			<svg
				class="w-5 h-5 flex-shrink-0 text-red-600 dark:text-red-400"
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
			<p class="text-sm text-red-800 dark:text-red-200">
				<strong>{{ exceedCount }} nhân sự</strong> sẽ có số dư âm — nghỉ nhanh hơn tốc độ tích luỹ. Đơn phép năm
				tiếp theo của họ sẽ tự thành KL.
			</p>
		</div>

		<!-- Bảng chi tiết -->
		<div v-if="result.items.length > 0" class="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
			<div class="overflow-x-auto max-h-[420px] overflow-y-auto">
				<table class="w-full text-sm">
					<thead class="bg-gray-50 dark:bg-gray-800/60 sticky top-0">
						<tr class="text-xs font-medium text-gray-500 dark:text-gray-400 text-left">
							<th class="px-4 py-2.5">Nhân viên</th>
							<th class="px-4 py-2.5">Loại phép</th>
							<th class="px-4 py-2.5 text-right">Tích luỹ</th>
							<th class="px-4 py-2.5 text-right">Đã dùng</th>
							<th class="px-4 py-2.5 text-right">Chênh lệch</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
						<tr
							v-for="item in result.items"
							:key="`${item.employeeId}-${item.leaveTypeCode}`"
							class="text-gray-700 dark:text-gray-300"
							:class="{ 'bg-red-50/60 dark:bg-red-900/10': item.exceedsAccrued }"
						>
							<td class="px-4 py-2.5">
								<div class="flex items-center gap-1.5">
									<UiTooltip
										v-if="item.exceedsAccrued"
										label="Nghỉ nhanh hơn tốc độ tích luỹ — chưa chắc vượt hạn mức 12 ngày/năm"
									>
										<svg
											class="w-4 h-4 text-red-500 cursor-default"
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
									</UiTooltip>
									<span class="font-medium text-gray-900 dark:text-white">{{ item.fullName }}</span>
									<span class="text-xs text-gray-500 dark:text-gray-400">{{ item.employeeCode }}</span>
								</div>
							</td>
							<td class="px-4 py-2.5 text-gray-500 dark:text-gray-400">{{ item.leaveTypeCode }}</td>
							<td class="px-4 py-2.5 text-right tabular-nums">{{ item.accruedDays }}</td>
							<td class="px-4 py-2.5 text-right tabular-nums">
								<span class="text-gray-400 line-through">{{ item.usedBefore }}</span>
								<span class="ml-1.5 font-medium text-gray-900 dark:text-white">{{ item.usedAfter }}</span>
							</td>
							<td
								class="px-4 py-2.5 text-right tabular-nums font-medium"
								:class="item.delta > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'"
							>
								{{ fmtDelta(item.delta) }}
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>

		<!-- Nhân sự chưa được cấp phát quỹ -->
		<div v-if="result.skipped.length > 0" class="border border-amber-200 dark:border-amber-900/50 rounded-xl p-4 space-y-3">
			<div>
				<h4 class="text-sm font-semibold text-amber-800 dark:text-amber-200">
					{{ result.skipped.length }} nhân sự chưa được cấp phát số dư
				</h4>
				<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
					Có đơn trừ quỹ nhưng không có bản ghi số dư để ghi vào — cần cấp phát quỹ trước.
				</p>
			</div>
			<ul class="space-y-1">
				<li
					v-for="s in result.skipped"
					:key="`${s.employeeId}-${s.leaveTypeCode}`"
					class="flex items-center justify-between text-sm text-gray-700 dark:text-gray-300"
				>
					<span>{{ s.fullName }} <span class="text-xs text-gray-500">· {{ s.leaveTypeCode }}</span></span>
					<span class="tabular-nums text-gray-500 dark:text-gray-400">{{ s.untrackedDays }} ngày</span>
				</li>
			</ul>
			<CommonAppButton size="sm" variant="outline" @click="emit('go-to-balances')">
				Sang màn cấp phát quỹ
			</CommonAppButton>
		</div>
	</div>
</template>
