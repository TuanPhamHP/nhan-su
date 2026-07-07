<script setup lang="ts">
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import LeaveStatusBadge from '~/components/modules/leave/LeaveStatusBadge.vue';
import type { LeaveRequest } from '~/types/leave.types';

const props = withDefaults(
	defineProps<{
		leaveRequest: LeaveRequest;
		approving?: boolean;
	}>(),
	{ approving: false },
);
const emit = defineEmits<{
	close: [];
	approve: [];
	reject: [];
}>();

const { user } = useAuth();

const canReview = computed(
	() =>
		props.leaveRequest.status === 'PENDING' &&
		!!user.value &&
		(props.leaveRequest.assignedApprover?.id === user.value.id || user.value.role === 'ADMIN'),
);

function formatDate(d: string) {
	return format(new Date(d), 'dd/MM/yyyy');
}

function formatDateTime(d: string) {
	return format(new Date(d), 'HH:mm dd/MM/yyyy', { locale: vi });
}

const timelineSteps = computed(() => {
	const tl = props.leaveRequest.timeline;
	if (!tl) return [];

	const steps: Array<{
		label: string;
		at: string | null;
		by: { id: number; fullName: string; position: string | null } | null;
		icon: string;
		done: boolean;
	}> = [
		{ label: 'Đã nộp', at: tl.submittedAt, by: tl.submittedBy, icon: 'submitted', done: true },
	];

	if (tl.action) {
		const labelMap: Record<string, string> = {
			APPROVED: 'Đã duyệt',
			REJECTED: 'Từ chối',
			CANCELLED: 'Thu hồi',
		};
		steps.push({
			label: labelMap[tl.action] ?? tl.action,
			at: tl.reviewedAt,
			by: tl.reviewedBy,
			icon: tl.action,
			done: true,
		});
	} else {
		const approver = props.leaveRequest.assignedApprover;
		steps.push({
			label: 'Chờ duyệt',
			at: null,
			by: approver ? { id: approver.id, fullName: approver.fullName, position: null } : null,
			icon: 'PENDING',
			done: false,
		});
	}

	return steps;
});
</script>

<template>
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
		<div class="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
			<!-- Header -->
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
				<div class="flex items-center gap-3">
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">Chi tiết đơn nghỉ phép</h2>
					<LeaveStatusBadge :status="leaveRequest.status" />
				</div>
				<button
					class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
					@click="emit('close')"
				>
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Body -->
			<div class="overflow-y-auto flex-1 px-6 py-4 space-y-5">
				<!-- Basic info -->
				<div class="space-y-3 text-sm">
					<div class="flex justify-between">
						<span class="text-gray-500 dark:text-gray-400">Nhân viên</span>
						<span class="font-medium text-gray-900 dark:text-white">
							{{ leaveRequest.employee.fullName }}
							<span class="text-gray-400 text-xs ml-1">({{ leaveRequest.employee.employeeCode }})</span>
						</span>
					</div>
					<div v-if="leaveRequest.employee.department" class="flex justify-between">
						<span class="text-gray-500 dark:text-gray-400">Phòng ban</span>
						<span class="font-medium text-gray-900 dark:text-white">{{ leaveRequest.employee.department }}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-500 dark:text-gray-400">Loại phép</span>
						<span class="font-medium text-gray-900 dark:text-white">{{ leaveRequest.leaveType.name }}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-500 dark:text-gray-400">Thời gian</span>
						<span class="font-medium text-gray-900 dark:text-white">
							{{ formatDate(leaveRequest.startDate) }}
							<template v-if="leaveRequest.startDate !== leaveRequest.endDate">
								→ {{ formatDate(leaveRequest.endDate) }}
							</template>
						</span>
					</div>
					<div v-if="leaveRequest.halfDayPeriod" class="flex justify-between">
						<span class="text-gray-500 dark:text-gray-400">Buổi</span>
						<span class="font-medium text-gray-900 dark:text-white">
							{{ leaveRequest.halfDayPeriod === 'MORNING' ? 'Sáng' : 'Chiều' }}
						</span>
					</div>
					<div v-if="leaveRequest.lateMinutes" class="flex justify-between">
						<span class="text-gray-500 dark:text-gray-400">Đi muộn</span>
						<span class="font-medium text-gray-900 dark:text-white">{{ leaveRequest.lateMinutes }} phút</span>
					</div>
					<div v-if="leaveRequest.earlyMinutes" class="flex justify-between">
						<span class="text-gray-500 dark:text-gray-400">Về sớm</span>
						<span class="font-medium text-gray-900 dark:text-white">{{ leaveRequest.earlyMinutes }} phút</span>
					</div>
					<div v-if="leaveRequest.totalDays > 0" class="flex justify-between">
						<span class="text-gray-500 dark:text-gray-400">Số ngày</span>
						<span class="font-medium text-gray-900 dark:text-white">{{ leaveRequest.totalDays }} ngày</span>
					</div>
					<div v-if="leaveRequest.reason" class="flex justify-between gap-4">
						<span class="text-gray-500 dark:text-gray-400 flex-shrink-0">Lý do</span>
						<span class="font-medium text-gray-900 dark:text-white text-right">{{ leaveRequest.reason }}</span>
					</div>
					<div v-if="leaveRequest.status === 'PENDING' && leaveRequest.assignedApprover" class="flex justify-between">
						<span class="text-gray-500 dark:text-gray-400">Người duyệt</span>
						<span class="font-medium text-gray-900 dark:text-white">{{ leaveRequest.assignedApprover.fullName }}</span>
					</div>
					<div v-if="leaveRequest.rejectNote" class="rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2.5">
						<p class="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Lý do từ chối</p>
						<p class="text-sm text-red-700 dark:text-red-300">{{ leaveRequest.rejectNote }}</p>
					</div>
				</div>

				<!-- Timeline -->
				<div v-if="leaveRequest.timeline" class="border-t border-gray-100 dark:border-gray-800 pt-4">
					<p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Lịch sử xử lý</p>
					<div class="space-y-0">
						<div v-for="(step, idx) in timelineSteps" :key="idx" class="flex gap-3">
							<!-- Icon column -->
							<div class="flex flex-col items-center">
								<div
									:class="[
										'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2',
										step.icon === 'submitted' || step.icon === 'APPROVED'
											? 'bg-green-100 border-green-500 dark:bg-green-900/30 dark:border-green-600'
											: step.icon === 'REJECTED'
												? 'bg-red-100 border-red-500 dark:bg-red-900/30 dark:border-red-600'
												: step.icon === 'CANCELLED'
													? 'bg-gray-100 border-gray-400 dark:bg-gray-700 dark:border-gray-500'
													: 'bg-orange-100 border-orange-400 dark:bg-orange-900/30 dark:border-orange-500',
									]"
								>
									<svg
										v-if="step.icon === 'submitted' || step.icon === 'APPROVED'"
										class="w-4 h-4 text-green-600 dark:text-green-400"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2.5"
									>
										<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
									</svg>
									<svg
										v-else-if="step.icon === 'REJECTED'"
										class="w-4 h-4 text-red-600 dark:text-red-400"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2.5"
									>
										<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
									</svg>
									<svg
										v-else-if="step.icon === 'CANCELLED'"
										class="w-4 h-4 text-gray-500 dark:text-gray-400"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2"
									>
										<path stroke-linecap="round" stroke-linejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
									</svg>
									<svg
										v-else
										class="w-4 h-4 text-orange-500 dark:text-orange-400"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2"
									>
										<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
									</svg>
								</div>
								<div v-if="idx < timelineSteps.length - 1" class="w-0.5 h-8 bg-gray-200 dark:bg-gray-700 mt-1" />
							</div>

							<!-- Content -->
							<div class="pb-4 flex-1 min-w-0">
								<p class="text-sm font-medium text-gray-900 dark:text-white">{{ step.label }}</p>
								<template v-if="step.by">
									<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
										{{ step.by.fullName }}
										<span v-if="step.by.position" class="text-gray-400"> · {{ step.by.position }}</span>
									</p>
								</template>
								<p v-if="step.at" class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
									{{ formatDateTime(step.at) }}
								</p>
								<p v-else-if="!step.done" class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Đang chờ xử lý</p>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Footer -->
			<div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
				<div v-if="canReview" class="flex items-center gap-2">
					<CommonAppButton variant="outline" class="flex-1" @click="emit('close')">Đóng</CommonAppButton>
					<CommonAppButton variant="danger" @click="emit('reject')">Từ chối</CommonAppButton>
					<CommonAppButton variant="primary" :loading="approving" @click="emit('approve')">Duyệt</CommonAppButton>
				</div>
				<CommonAppButton v-else variant="outline" full-width @click="emit('close')">Đóng</CommonAppButton>
			</div>
		</div>
	</div>
</template>
