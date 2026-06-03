<script setup lang="ts">
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import type { ApproverStep } from '~/types/general-request.types';

const props = defineProps<{
	approvers: ApproverStep[];
	currentApproverIndex: number;
	creatorName?: string;
}>();

function fmtDateTime(d: string | null) {
	if (!d) return null;
	return format(new Date(d), 'HH:mm dd/MM/yyyy', { locale: vi });
}

const stepConfig = {
	APPROVED: { color: 'bg-green-500', icon: 'check', label: 'Đã duyệt' },
	PENDING:  { color: 'bg-orange-500', icon: 'clock', label: 'Đang chờ' },
	REJECTED: { color: 'bg-red-500', icon: 'x', label: 'Từ chối' },
	WAITING:  { color: 'bg-gray-300 dark:bg-gray-600', icon: 'dots', label: 'Chờ tới lượt' },
};
</script>

<template>
	<div class="relative">
		<!-- Connector line -->
		<div v-if="approvers.length > 0" class="absolute left-4 top-8 bottom-4 w-0.5 bg-gray-200 dark:bg-gray-700" />

		<!-- Creator node -->
		<div class="relative flex items-start gap-3 pb-4">
			<div class="relative z-10 flex-shrink-0 w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
				<svg class="w-4 h-4 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
				</svg>
			</div>
			<div class="flex-1 pt-0.5">
				<p class="text-sm font-medium text-gray-900 dark:text-white">{{ creatorName ?? 'Người tạo' }}</p>
				<p class="text-xs text-gray-400">Tạo đơn</p>
			</div>
		</div>

		<!-- Approver steps -->
		<div
			v-for="(step, idx) in approvers"
			:key="step.order"
			class="relative flex items-start gap-3"
			:class="idx < approvers.length - 1 ? 'pb-4' : ''"
		>
			<div
				:class="[
					'relative z-10 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
					stepConfig[step.status].color,
				]"
			>
				<template v-if="step.status === 'APPROVED'">
					<svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
					</svg>
				</template>
				<template v-else-if="step.status === 'REJECTED'">
					<svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</template>
				<template v-else-if="step.status === 'PENDING'">
					<svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
				</template>
				<template v-else>
					<span class="text-gray-500 dark:text-gray-400 text-xs font-bold">{{ idx + 1 }}</span>
				</template>
			</div>

			<div class="flex-1 pt-0.5">
				<div class="flex items-center gap-2">
					<p class="text-sm font-medium text-gray-900 dark:text-white">{{ step.fullName }}</p>
					<span :class="['text-xs px-1.5 py-0.5 rounded-full', step.status === 'APPROVED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : step.status === 'REJECTED' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : step.status === 'PENDING' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400']">
						{{ stepConfig[step.status].label }}
					</span>
				</div>
				<p v-if="step.approvedAt" class="text-xs text-gray-400 mt-0.5">{{ fmtDateTime(step.approvedAt) }}</p>
				<p v-if="step.note" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 italic">{{ step.note }}</p>
			</div>
		</div>

		<!-- Completed marker -->
		<div v-if="approvers.length > 0 && approvers[approvers.length - 1]?.status === 'APPROVED'" class="relative flex items-start gap-3 pt-4">
			<div class="relative z-10 flex-shrink-0 w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center">
				<svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
			</div>
			<div class="flex-1 pt-0.5">
				<p class="text-sm font-medium text-teal-700 dark:text-teal-400">Hoàn thành</p>
				<p class="text-xs text-gray-400">Đơn đã được duyệt toàn bộ</p>
			</div>
		</div>
	</div>
</template>
