<script setup lang="ts">
import { format, differenceInDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import OvertimeStatusBadge from '~/components/modules/overtime/OvertimeStatusBadge.vue';
import type { OvertimeRequestResponse } from '~/types/overtime.types';

const props = defineProps<{ request: OvertimeRequestResponse }>();
const emit = defineEmits<{ close: [] }>();

function formatDate(d: string) {
	return format(new Date(d), 'dd/MM/yyyy');
}

function formatDateTime(d: string) {
	return format(new Date(d), 'HH:mm dd/MM/yyyy', { locale: vi });
}

function formatTime(d: string) {
	return format(new Date(d), 'HH:mm');
}

const daysUntilExpire = computed(() => {
	if (props.request.status !== 'PENDING') return null;
	const days = differenceInDays(new Date(props.request.autoExpireAt), new Date());
	return days;
});

const timelineSteps = computed(() => {
	const req = props.request;
	const steps: Array<{
		label: string;
		at: string | null;
		by: string | null;
		icon: string;
		done: boolean;
	}> = [{ label: 'Đã gửi', at: req.createdAt, by: req.employee.fullName, icon: 'submitted', done: true }];

	if (req.status === 'APPROVED') {
		steps.push({ label: 'Đã duyệt', at: req.reviewedAt, by: req.reviewedBy?.fullName ?? null, icon: 'APPROVED', done: true });
	} else if (req.status === 'REJECTED') {
		steps.push({ label: 'Từ chối', at: req.reviewedAt, by: req.reviewedBy?.fullName ?? null, icon: 'REJECTED', done: true });
	} else if (req.status === 'CANCELLED') {
		steps.push({ label: 'Đã thu hồi', at: null, by: null, icon: 'CANCELLED', done: true });
	} else if (req.status === 'AUTO_CANCELLED') {
		steps.push({ label: 'Hết hạn (tự động huỷ)', at: req.autoExpireAt, by: null, icon: 'AUTO_CANCELLED', done: true });
	} else {
		steps.push({ label: 'Chờ duyệt', at: null, by: req.assignedApprover?.fullName ?? null, icon: 'PENDING', done: false });
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
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">Chi tiết đơn OT</h2>
					<OvertimeStatusBadge :status="request.status" />
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
						<span class="text-gray-500 dark:text-gray-400">Ngày OT</span>
						<span class="font-medium text-gray-900 dark:text-white">{{ formatDate(request.overtimeDate) }}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-500 dark:text-gray-400">Thời gian</span>
						<span class="font-medium text-gray-900 dark:text-white">
							{{ formatTime(request.startTime) }} → {{ formatTime(request.endTime) }}
						</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-500 dark:text-gray-400">Số giờ OT</span>
						<span class="font-medium text-gray-900 dark:text-white">{{ request.hoursDisplay }}</span>
					</div>
					<div class="flex justify-between gap-4">
						<span class="text-gray-500 dark:text-gray-400 flex-shrink-0">Lý do</span>
						<span class="font-medium text-gray-900 dark:text-white text-right">{{ request.reason }}</span>
					</div>
					<div v-if="request.assignedApprover" class="flex justify-between">
						<span class="text-gray-500 dark:text-gray-400">Người duyệt</span>
						<span class="font-medium text-gray-900 dark:text-white">{{ request.assignedApprover.fullName }}</span>
					</div>

					<!-- Expire warning -->
					<div
						v-if="daysUntilExpire !== null"
						:class="[
							'rounded-lg px-3 py-2.5',
							daysUntilExpire <= 1
								? 'bg-red-50 dark:bg-red-900/20'
								: 'bg-amber-50 dark:bg-amber-900/20',
						]"
					>
						<p
							:class="[
								'text-xs font-medium',
								daysUntilExpire <= 1
									? 'text-red-600 dark:text-red-400'
									: 'text-amber-600 dark:text-amber-400',
							]"
						>
							Tự động huỷ sau:
							{{ daysUntilExpire <= 0 ? 'hôm nay' : `${daysUntilExpire} ngày` }} nếu chưa được duyệt
						</p>
					</div>

					<!-- Review note -->
					<div v-if="request.reviewNote" class="rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2.5">
						<p class="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Lý do từ chối</p>
						<p class="text-sm text-red-700 dark:text-red-300">{{ request.reviewNote }}</p>
					</div>
				</div>

				<!-- Timeline -->
				<div class="border-t border-gray-100 dark:border-gray-800 pt-4">
					<p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Lịch sử xử lý</p>
					<div class="space-y-0">
						<div v-for="(step, idx) in timelineSteps" :key="idx" class="flex gap-3">
							<div class="flex flex-col items-center">
								<div
									:class="[
										'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2',
										step.icon === 'submitted' || step.icon === 'APPROVED'
											? 'bg-green-100 border-green-500 dark:bg-green-900/30 dark:border-green-600'
											: step.icon === 'REJECTED'
												? 'bg-red-100 border-red-500 dark:bg-red-900/30 dark:border-red-600'
												: step.icon === 'CANCELLED' || step.icon === 'AUTO_CANCELLED'
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
										v-else-if="step.icon === 'CANCELLED' || step.icon === 'AUTO_CANCELLED'"
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

							<div class="pb-4 flex-1 min-w-0">
								<p class="text-sm font-medium text-gray-900 dark:text-white">{{ step.label }}</p>
								<p v-if="step.by" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ step.by }}</p>
								<p v-if="step.at" class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{{ formatDateTime(step.at) }}</p>
								<p v-else-if="!step.done" class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Đang chờ xử lý</p>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Footer -->
			<div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
				<CommonAppButton variant="outline" full-width @click="emit('close')">Đóng</CommonAppButton>
			</div>
		</div>
	</div>
</template>
