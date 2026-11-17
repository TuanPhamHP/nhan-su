<script setup lang="ts">
	import { formatDateTime } from '~/utils/date';
	import { dueText, onBehalfText } from '~/utils/general-request.utils';
	import { STEP_STATUS_CLASS, type RequestStep } from '~/types/general-request.types';

	/**
	 * Các bước duyệt của VÒNG HIỆN TẠI (lô 4a).
	 *
	 * Một bước có thể có nhiều người (chế độ "một người đồng ý là đủ" hay "tất cả phải đồng ý"),
	 * nên mỗi bước hiện danh sách lượt chứ không phải một cái tên. Lượt đã chuyển đi hoặc bị
	 * thay người vẫn nằm trong `assignments` để người đọc thấy bước đã đi qua tay ai; chúng có
	 * `statusLabel` riêng từ máy chủ.
	 *
	 * `basis` là câu máy chủ giải thích vì sao bước có những người này, hoặc vì sao bị bỏ qua —
	 * hiện thẳng, vì đây là chỗ người dùng hay thắc mắc nhất khi luồng có điều kiện.
	 */
	const props = defineProps<{
		steps: RequestStep[];
		creatorName?: string;
		/** Bước đang chờ xử lý, để tô đậm. */
		currentStepOrder?: number | null;
	}>();

	const DOT_TONE: Record<string, string> = {
		APPROVED: 'bg-green-500',
		REJECTED: 'bg-rose-500',
		RETURNED: 'bg-amber-500',
		PENDING: 'bg-orange-500',
		WAITING: 'bg-gray-300 dark:bg-gray-600',
		SKIPPED: 'bg-gray-200 dark:bg-gray-700',
		CANCELLED: 'bg-gray-200 dark:bg-gray-700',
	};

	const hasSteps = computed(() => props.steps.length > 0);
</script>

<template>
	<div class="relative">
		<div v-if="hasSteps" class="absolute bottom-4 left-4 top-8 w-0.5 bg-gray-200 dark:bg-gray-700" />

		<!-- Người gửi -->
		<div class="relative flex items-start gap-3 pb-4">
			<div
				class="relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/30"
			>
				<svg
					class="h-4 w-4 text-brand-600 dark:text-brand-400"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
					/>
				</svg>
			</div>
			<div class="flex-1 pt-0.5">
				<p class="text-sm font-medium text-gray-900 dark:text-white">{{ creatorName ?? 'Người gửi' }}</p>
				<p class="text-xs text-gray-400">Gửi phiếu</p>
			</div>
		</div>

		<p v-if="!hasSteps" class="pl-11 text-sm text-gray-500 dark:text-gray-400">
			Phiếu chưa gửi nên chưa có bước duyệt nào.
		</p>

		<!-- Các bước -->
		<div
			v-for="(step, idx) in steps"
			:key="step.order"
			class="relative flex items-start gap-3"
			:class="idx < steps.length - 1 ? 'pb-4' : ''"
		>
			<div
				class="relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
				:class="DOT_TONE[step.status] ?? 'bg-gray-300'"
			>
				<svg
					v-if="step.status === 'APPROVED'"
					class="h-4 w-4 text-white"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2.5"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
				</svg>
				<svg
					v-else-if="step.status === 'REJECTED'"
					class="h-4 w-4 text-white"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2.5"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
				<svg
					v-else-if="step.status === 'RETURNED'"
					class="h-4 w-4 text-white"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2.5"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
				</svg>
				<svg
					v-else-if="step.status === 'PENDING'"
					class="h-4 w-4 text-white"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<span v-else class="text-xs font-bold text-gray-500 dark:text-gray-300">{{ step.order }}</span>
			</div>

			<div class="min-w-0 flex-1 pt-0.5" :class="step.status === 'SKIPPED' ? 'opacity-60' : ''">
				<div class="flex flex-wrap items-center gap-2">
					<p class="text-sm font-medium text-gray-900 dark:text-white">{{ step.name }}</p>
					<span class="rounded-full px-1.5 py-0.5 text-xs font-medium" :class="STEP_STATUS_CLASS[step.status]">
						{{ step.statusLabel }}
					</span>
					<span v-if="step.overdue" class="rounded-full bg-rose-100 px-1.5 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
						Quá hạn
					</span>
				</div>

				<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ step.modeLabel }}</p>
				<p v-if="step.basis" class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ step.basis }}</p>
				<p
					v-if="dueText(step.dueAt, step.overdue)"
					class="mt-0.5 text-xs"
					:class="step.overdue ? 'text-rose-600 dark:text-rose-400' : 'text-gray-500 dark:text-gray-400'"
				>
					{{ dueText(step.dueAt, step.overdue) }}
				</p>

				<ul v-if="step.assignments.length" class="mt-1.5 space-y-1">
					<li v-for="assignment in step.assignments" :key="assignment.id" class="text-xs">
						<span class="font-medium text-gray-700 dark:text-gray-200">{{ assignment.employee.fullName }}</span>
						<span class="text-gray-500 dark:text-gray-400"> · {{ assignment.statusLabel }}</span>
						<span v-if="assignment.decidedAt" class="text-gray-400"> · {{ formatDateTime(assignment.decidedAt) }}</span>
						<span v-if="onBehalfText(assignment.employee, assignment.onBehalfOf)" class="block text-gray-500 dark:text-gray-400">
							{{ onBehalfText(assignment.employee, assignment.onBehalfOf) }}
						</span>
						<span
							v-if="assignment.decidedBy && assignment.decidedBy.id !== assignment.employee.id"
							class="block text-gray-500 dark:text-gray-400"
						>
							{{ assignment.decidedBy.fullName }} quyết định thay
						</span>
						<span v-if="assignment.note" class="block italic text-gray-500 dark:text-gray-400">{{ assignment.note }}</span>
					</li>
				</ul>
			</div>
		</div>
	</div>
</template>
