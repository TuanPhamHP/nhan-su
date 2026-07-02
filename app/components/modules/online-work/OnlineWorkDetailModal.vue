<script setup lang="ts">
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import OnlineWorkStatusBadge from '~/components/modules/online-work/OnlineWorkStatusBadge.vue';
import type { OnlineWorkRequestResponse } from '~/types/online-work-request.types';

const props = withDefaults(
	defineProps<{
		request: OnlineWorkRequestResponse;
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

function formatDate(d: string) {
	return format(new Date(d), 'dd/MM/yyyy');
}
function formatDateTime(d: string) {
	return format(new Date(d), 'HH:mm dd/MM/yyyy', { locale: vi });
}

// ─── Timeline steps ──────────────────────────────────────────────────────────
interface TimelineStep {
	label: string;
	approver: string | null;
	approvedBy: string | null;
	approvedAt: string | null;
	done: boolean;
	rejected: boolean;
}

const timelineSteps = computed((): TimelineStep[] => {
	const req = props.request;
	const steps: TimelineStep[] = [];

	// Step 1 — Cấp 1 (luôn hiển thị)
	steps.push({
		label: 'Cấp 1',
		approver: req.approverL1?.fullName ?? null,
		approvedBy: req.approvedL1By?.fullName ?? null,
		approvedAt: req.approvedL1At,
		done: !!req.approvedL1At,
		rejected: req.status === 'REJECTED' && req.rejectLevel === 1,
	});

	// Step 2 — Cấp 2 (chỉ khi requiresMultiLevel && approverL2 có)
	if (req.requiresMultiLevel && req.approverL2) {
		steps.push({
			label: 'Cấp 2',
			approver: req.approverL2.fullName,
			approvedBy: req.approvedL2By?.fullName ?? null,
			approvedAt: req.approvedL2At,
			done: !!req.approvedL2At,
			rejected: req.status === 'REJECTED' && req.rejectLevel === 2,
		});
	}

	// Step 3 — Giám đốc (chỉ khi requiresMultiLevel)
	if (req.requiresMultiLevel) {
		steps.push({
			label: 'Giám đốc',
			approver: null,
			approvedBy: req.approvedL3By?.fullName ?? null,
			approvedAt: req.approvedL3At,
			done: !!req.approvedL3At,
			rejected: req.status === 'REJECTED' && req.rejectLevel === 3,
		});
	}

	return steps;
});

const isTerminal = computed(() =>
	props.request.status === 'COMPLETED' ||
	props.request.status === 'REJECTED' ||
	props.request.status === 'CANCELLED',
);

const canReview = computed(
	() =>
		!isTerminal.value &&
		!!user.value &&
		props.request.canBeApprovedBy?.includes(user.value.id) === true,
);
</script>

<template>
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
		<div class="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
			<!-- Header -->
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
				<div class="flex items-center gap-3">
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">Chi tiết đơn làm online</h2>
					<OnlineWorkStatusBadge :status="request.status" :reject-level="request.rejectLevel" />
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
							{{ request.employee.fullName }}
							<span class="text-gray-400 text-xs ml-1">({{ request.employee.employeeCode }})</span>
						</span>
					</div>
					<div v-if="request.employee.department" class="flex justify-between">
						<span class="text-gray-500 dark:text-gray-400">Phòng ban</span>
						<span class="font-medium text-gray-900 dark:text-white">{{ request.employee.department }}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-500 dark:text-gray-400">Từ ngày</span>
						<span class="font-medium text-gray-900 dark:text-white">{{ formatDate(request.startDate) }}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-500 dark:text-gray-400">Đến ngày</span>
						<span class="font-medium text-gray-900 dark:text-white">{{ formatDate(request.endDate) }}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-500 dark:text-gray-400">Số ngày làm việc</span>
						<span class="font-medium text-gray-900 dark:text-white">{{ request.totalDays }} ngày</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-500 dark:text-gray-400">Kịch bản</span>
						<span
							:class="[
								'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
								request.requiresMultiLevel
									? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
									: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
							]"
						>
							{{ request.requiresMultiLevel ? '3 cấp duyệt' : '1 cấp duyệt' }}
						</span>
					</div>
					<div class="flex justify-between gap-4">
						<span class="text-gray-500 dark:text-gray-400 flex-shrink-0">Lý do</span>
						<span class="font-medium text-gray-900 dark:text-white text-right">{{ request.reason }}</span>
					</div>

					<!-- Rejection note -->
					<div v-if="request.rejectNote" class="rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2.5">
						<p class="text-xs font-medium text-red-600 dark:text-red-400 mb-1">
							Bị từ chối ở cấp {{ request.rejectLevel }} bởi {{ request.rejectedBy?.fullName }}
						</p>
						<p class="text-sm text-red-700 dark:text-red-300">{{ request.rejectNote }}</p>
					</div>

					<!-- Cancelled -->
					<div v-if="request.status === 'CANCELLED'" class="rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2.5">
						<p class="text-xs text-gray-500 dark:text-gray-400">Đơn đã được nhân viên huỷ</p>
					</div>
				</div>

				<!-- Timeline -->
				<div class="border-t border-gray-100 dark:border-gray-800 pt-4">
					<p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Quy trình duyệt</p>

					<!-- Submitted step -->
					<div class="flex gap-3 mb-0">
						<div class="flex flex-col items-center">
							<div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2 bg-green-100 border-green-500 dark:bg-green-900/30 dark:border-green-600">
								<svg class="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
									<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
								</svg>
							</div>
							<div class="w-0.5 h-8 bg-gray-200 dark:bg-gray-700 mt-1" />
						</div>
						<div class="pb-4 flex-1">
							<p class="text-sm font-medium text-gray-900 dark:text-white">Đã gửi</p>
							<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ request.employee.fullName }}</p>
							<p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{{ formatDateTime(request.createdAt) }}</p>
						</div>
					</div>

					<!-- Approval steps -->
					<div v-for="(step, idx) in timelineSteps" :key="idx" class="flex gap-3">
						<div class="flex flex-col items-center">
							<div
								:class="[
									'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2',
									step.rejected
										? 'bg-red-100 border-red-500 dark:bg-red-900/30 dark:border-red-600'
										: step.done
											? 'bg-green-100 border-green-500 dark:bg-green-900/30 dark:border-green-600'
											: 'bg-orange-100 border-orange-400 dark:bg-orange-900/30 dark:border-orange-500',
								]"
							>
								<svg
									v-if="step.rejected"
									class="w-4 h-4 text-red-600 dark:text-red-400"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2.5"
								>
									<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
								</svg>
								<svg
									v-else-if="step.done"
									class="w-4 h-4 text-green-600 dark:text-green-400"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2.5"
								>
									<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
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

						<div class="pb-4 flex-1 min-w-0">
							<p class="text-sm font-medium text-gray-900 dark:text-white">{{ step.label }}</p>
							<template v-if="step.rejected">
								<p class="text-xs text-red-500 dark:text-red-400 mt-0.5">
									Từ chối bởi {{ request.rejectedBy?.fullName }}
								</p>
								<p v-if="request.rejectedAt" class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
									{{ formatDateTime(request.rejectedAt) }}
								</p>
							</template>
							<template v-else-if="step.done">
								<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
									Duyệt bởi {{ step.approvedBy }}
								</p>
								<p v-if="step.approvedAt" class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
									{{ formatDateTime(step.approvedAt) }}
								</p>
							</template>
							<template v-else>
								<p v-if="step.approver" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
									Người duyệt: {{ step.approver }}
								</p>
								<p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Đang chờ xử lý</p>
							</template>
						</div>
					</div>

					<!-- Completed -->
					<div v-if="request.status === 'COMPLETED'" class="flex gap-3">
						<div class="flex flex-col items-center">
							<div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2 bg-green-100 border-green-500 dark:bg-green-900/30 dark:border-green-600">
								<svg class="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
							</div>
						</div>
						<div class="flex-1">
							<p class="text-sm font-medium text-green-700 dark:text-green-400">Hoàn thành — đã tạo bản ghi chấm công</p>
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
