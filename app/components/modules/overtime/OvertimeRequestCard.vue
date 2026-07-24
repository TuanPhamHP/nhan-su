<script setup lang="ts">
import { format } from 'date-fns';
import type { OvertimeRequestResponse } from '~/types/overtime.types';
import OvertimeStatusBadge from '~/components/modules/overtime/OvertimeStatusBadge.vue';

const props = defineProps<{
	request: OvertimeRequestResponse;
	cancelling?: boolean;
}>();

const emit = defineEmits<{
	cancel: [];
	view: [];
}>();

function formatDate(d: string) {
	return format(new Date(d), 'dd/MM/yyyy');
}

function formatTime(d: string) {
	return format(new Date(d), 'HH:mm');
}

const approverName = computed(() => {
	if (props.request.reviewedBy) return props.request.reviewedBy.fullName;
	if (props.request.assignedApprover) return props.request.assignedApprover.fullName;
	return null;
});
</script>

<template>
	<div
		class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-3 transition-opacity"
		:class="{ 'opacity-60': cancelling }"
	>
		<!-- Header: ngày + trạng thái -->
		<div class="flex items-start justify-between gap-2">
			<div>
				<p class="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Ngày OT</p>
				<p class="text-sm font-semibold text-gray-900 dark:text-white">{{ formatDate(request.overtimeDate) }}</p>
			</div>
			<div class="flex flex-col items-end gap-1 flex-shrink-0">
				<div class="flex items-center gap-1.5">
					<OvertimeStatusBadge :status="request.status" />
					<span class="text-xs text-gray-400 dark:text-gray-500">
						{{ request.workMode === 'OFFLINE' ? '🏢' : '🏠' }}
						<template v-if="request.finalWorkMode && request.finalWorkMode !== request.workMode">
							→ {{ request.finalWorkMode === 'ONLINE' ? 'Online' : 'VP' }}
						</template>
					</span>
				</div>
				<span
					v-if="request.status === 'PENDING' && request.autoExpireAt"
					class="text-xs text-orange-500 dark:text-orange-400"
				>
					Hết hạn {{ formatDate(request.autoExpireAt) }}
				</span>
			</div>
		</div>

		<!-- Thời gian + số giờ + hệ số -->
		<div class="flex items-center gap-2 flex-wrap">
			<div class="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
				<svg class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				{{ formatTime(request.startTime) }} → {{ formatTime(request.endTime) }}
			</div>
			<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
				{{ request.hoursDisplay }}
			</span>
			<span
				:class="[
					'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold',
					request.otRate === 300
						? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
						: request.otRate === 200
							? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
							: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
				]"
			>
				{{ request.otRateLabel }}
			</span>
		</div>

		<!-- Lý do -->
		<p v-if="request.reason" class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
			{{ request.reason }}
		</p>

		<!-- Người duyệt -->
		<div v-if="approverName" class="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
			<svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
			</svg>
			<span :class="request.reviewedBy ? 'text-gray-500 dark:text-gray-400' : 'italic'">
				{{ request.reviewedBy ? 'Duyệt bởi' : 'Chờ' }} {{ approverName }}
			</span>
		</div>

		<!-- Actions -->
		<div class="flex items-center justify-end gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
			<CommonAppButton
				v-if="request.canBeCancelled"
				size="sm"
				variant="outline"
				:loading="cancelling"
				@click="emit('cancel')"
			>
				Thu hồi
			</CommonAppButton>
			<button
				class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
				@click="emit('view')"
			>
				<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
				</svg>
				Xem chi tiết
			</button>
		</div>
	</div>
</template>
