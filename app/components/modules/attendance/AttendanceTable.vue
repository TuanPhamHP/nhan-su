<script setup lang="ts">
	import type { AttendanceRecordDetail, AttendanceStatus } from '~/types/attendance.types';
	import { formatShiftDisplay, formatVNTime, formatMinutes } from '~/utils/attendance.utils';
	import AttendancePhoto from '~/components/modules/attendance/AttendancePhoto.vue';

	const props = defineProps<{
		records: AttendanceRecordDetail[];
		loading: boolean;
		showDateColumn?: boolean;
	}>();

	const emit = defineEmits<{
		viewPhoto: [record: AttendanceRecordDetail];
		edit: [record: AttendanceRecordDetail];
	}>();

	const statusConfig: Record<AttendanceStatus, { label: string; cls: string }> = {
		PRESENT: {
			label: 'Có mặt',
			cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
		},
		LATE: {
			label: 'Đi muộn',
			cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
		},
		ABSENT: {
			label: 'Vắng',
			cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
		},
		LEAVE: {
			label: 'Nghỉ phép',
			cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
		},
	};
</script>

<template>
	<div class="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
		<table class="w-full text-sm">
			<thead>
				<tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
					<th
						v-if="props.showDateColumn"
						class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
					>
						Ngày
					</th>
					<th
						class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
					>
						Nhân viên
					</th>
					<th
						class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
					>
						Ca làm việc
					</th>
					<th
						class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
					>
						Check-in
					</th>
					<th
						class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
					>
						Check-out
					</th>
					<th
						class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
					>
						Trạng thái
					</th>
					<th
						class="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
					>
						Ảnh
					</th>
					<th
						class="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
					>
						Flags
					</th>
					<th
						class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
					>
						Thao tác
					</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
				<!-- Loading skeletons -->
				<template v-if="props.loading">
					<tr v-for="i in 5" :key="i" class="animate-pulse">
						<td v-if="props.showDateColumn" class="px-4 py-3">
							<div class="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
						</td>
						<td class="px-4 py-3">
							<div class="space-y-1.5">
								<div class="h-3.5 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
								<div class="h-3 w-16 bg-gray-100 dark:bg-gray-800 rounded" />
							</div>
						</td>
						<td class="px-4 py-3"><div class="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded" /></td>
						<td class="px-4 py-3"><div class="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded" /></td>
						<td class="px-4 py-3"><div class="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded" /></td>
						<td class="px-4 py-3"><div class="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" /></td>
						<td class="px-4 py-3 text-center"><div class="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded mx-auto" /></td>
						<td class="px-4 py-3 text-center"><div class="h-4 w-8 bg-gray-200 dark:bg-gray-700 rounded mx-auto" /></td>
						<td class="px-4 py-3 text-right"><div class="h-7 w-10 bg-gray-200 dark:bg-gray-700 rounded ml-auto" /></td>
					</tr>
				</template>

				<!-- Empty state -->
				<tr v-else-if="!props.records.length">
					<td :colspan="props.showDateColumn ? 9 : 8" class="px-4 py-12 text-center">
						<div class="flex flex-col items-center gap-2">
							<div class="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
								<svg
									class="w-6 h-6 text-gray-400"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="1.5"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5"
									/>
								</svg>
							</div>
							<p class="text-sm font-medium text-gray-500 dark:text-gray-400">Không có dữ liệu</p>
						</div>
					</td>
				</tr>

				<!-- Data rows -->
				<tr
					v-for="record in props.records"
					:key="record.id"
					class="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
				>
					<!-- Ngày (chỉ hiện ở tab Lịch sử) -->
					<td v-if="props.showDateColumn" class="px-4 py-3 whitespace-nowrap">
						<span class="text-sm text-gray-700 dark:text-gray-300 font-mono">{{ record.date }}</span>
					</td>

					<!-- Nhân viên -->
					<td class="px-4 py-3 whitespace-nowrap">
						<div v-if="record.employee">
							<p class="text-sm font-medium text-gray-900 dark:text-white">{{ record.employee.fullName }}</p>
							<p class="text-xs text-gray-400 dark:text-gray-500">{{ record.employee.employeeCode }}</p>
						</div>
						<span v-else class="text-gray-400">—</span>
					</td>

					<!-- Ca làm việc -->
					<td class="px-4 py-3 whitespace-nowrap">
						<div class="flex items-center gap-1.5">
							<span class="text-sm font-mono text-gray-700 dark:text-gray-300">{{ formatShiftDisplay(record) }}</span>
							<span
								v-if="record.isHalfDay"
								class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
							>
								Nửa ngày
							</span>
							<span
								v-if="record.workType === 'ONLINE_APPROVED'"
								class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400"
							>
								🏠 Online
							</span>
							<span
								v-else-if="record.workType === 'ONLINE_T7'"
								class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400"
							>
								🖥️ T7 Online
							</span>
						</div>
					</td>

					<!-- Check-in -->
					<td class="px-4 py-3 whitespace-nowrap">
						<div class="flex items-center gap-1">
							<span class="text-sm font-mono text-gray-700 dark:text-gray-300">{{
								formatVNTime(record.checkInAt)
							}}</span>
							<span v-if="record.lateMinutes > 0" class="text-xs text-orange-600 dark:text-orange-400 font-medium">
								(Muộn {{ formatMinutes(record.lateMinutes) }})
							</span>
						</div>
					</td>

					<!-- Check-out -->
					<td class="px-4 py-3 whitespace-nowrap">
						<div class="flex items-center gap-1">
							<span class="text-sm font-mono text-gray-700 dark:text-gray-300">{{
								formatVNTime(record.checkOutAt)
							}}</span>
							<span v-if="record.earlyMinutes > 0" class="text-xs text-orange-600 dark:text-orange-400 font-medium">
								(Sớm {{ formatMinutes(record.earlyMinutes) }})
							</span>
						</div>
					</td>

					<!-- Trạng thái -->
					<td class="px-4 py-3 whitespace-nowrap">
						<span
							:class="[
								'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold',
								statusConfig[record.status]?.cls ?? '',
							]"
						>
							{{ statusConfig[record.status]?.label ?? record.status }}
						</span>
					</td>

					<!-- Ảnh thumbnail -->
					<td class="px-4 py-3 text-center whitespace-nowrap">
						<div class="flex items-center justify-center">
							<AttendancePhoto
								:fileUrl="record.checkInPhotoUrl ?? record.checkOutPhotoUrl"
								alt="Ảnh chấm công"
								size="sm"
								@click="emit('viewPhoto', record)"
							/>
						</div>
					</td>

					<!-- Flags -->
					<td class="px-4 py-3 text-center whitespace-nowrap">
						<div class="flex items-center justify-center gap-1">
							<span v-if="record.isManual" class="text-base leading-none cursor-default" title="Đã chỉnh sửa thủ công">
								✏️
							</span>
							<span v-if="record.isLocked" class="text-base leading-none cursor-default" title="Đã bị khóa"> 🔒 </span>
						</div>
					</td>

					<!-- Thao tác -->
					<td class="px-4 py-3 text-right whitespace-nowrap">
						<button
							class="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors"
							:class="
								record.isLocked
									? 'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/40'
									: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
							"
							:title="record.isLocked ? 'Tạo đơn bù công' : 'Chỉnh sửa thủ công'"
							@click="emit('edit', record)"
						>
							<svg
								v-if="!record.isLocked"
								class="w-3.5 h-3.5"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
								/>
							</svg>
							<svg v-else class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
								/>
							</svg>
							{{ record.isLocked ? 'Bù công' : 'Sửa' }}
						</button>
					</td>
				</tr>
			</tbody>
		</table>
	</div>
</template>
