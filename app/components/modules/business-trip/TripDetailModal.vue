<script setup lang="ts">
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import type { BusinessTripResponse } from '~/types/business-trip.types';
import TripStatusBadge from '~/components/modules/business-trip/TripStatusBadge.vue';

const props = defineProps<{ trip: BusinessTripResponse }>();
const emit = defineEmits<{
	close: [];
	approve: [trip: BusinessTripResponse];
	reject: [trip: BusinessTripResponse];
	addReport: [trip: BusinessTripResponse];
}>();

const transportLabels: Record<string, string> = {
	PLANE: 'Máy bay',
	TRAIN: 'Tàu hỏa',
	CAR: 'Xe ô tô',
	OTHER: 'Khác',
};

function fmtDate(d: string) {
	return format(new Date(d), 'dd/MM/yyyy', { locale: vi });
}

function fmtDateTime(d: string) {
	return format(new Date(d), 'HH:mm dd/MM/yyyy', { locale: vi });
}

function fmtCurrency(n: number) {
	return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
}
</script>

<template>
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
		<div class="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
				<div class="flex items-center gap-3">
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">Chi tiết đơn công tác</h2>
					<TripStatusBadge :status="trip.status" />
				</div>
				<button class="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" @click="emit('close')">
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<div class="flex-1 overflow-y-auto p-6 space-y-5">
				<!-- Basic info -->
				<div class="space-y-3">
					<h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Thông tin chuyến đi</h3>
					<div class="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 space-y-3">
						<div>
							<p class="text-xs text-gray-500 dark:text-gray-400">Tiêu đề</p>
							<p class="text-sm font-medium text-gray-900 dark:text-white mt-0.5">{{ trip.title }}</p>
						</div>
						<div class="grid grid-cols-2 gap-3">
							<div>
								<p class="text-xs text-gray-500 dark:text-gray-400">Điểm đến</p>
								<p class="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{{ trip.destination }}</p>
							</div>
							<div>
								<p class="text-xs text-gray-500 dark:text-gray-400">Phương tiện</p>
								<p class="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{{ trip.transportType ? transportLabels[trip.transportType] : '—' }}</p>
							</div>
							<div>
								<p class="text-xs text-gray-500 dark:text-gray-400">Thời gian</p>
								<p class="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{{ fmtDate(trip.startDate) }} → {{ fmtDate(trip.endDate) }}</p>
								<p class="text-xs text-brand-600 dark:text-brand-400">{{ trip.totalDays }} ngày làm việc</p>
							</div>
							<div>
								<p class="text-xs text-gray-500 dark:text-gray-400">Chi phí dự kiến</p>
								<p class="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{{ trip.estimatedCost ? fmtCurrency(trip.estimatedCost) : '—' }}</p>
							</div>
						</div>
						<div>
							<p class="text-xs text-gray-500 dark:text-gray-400">Mục đích</p>
							<p class="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{{ trip.purpose }}</p>
						</div>
					</div>
				</div>

				<!-- Employee & approver -->
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-1">
						<p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold">Nhân viên</p>
						<p class="text-sm font-medium text-gray-900 dark:text-white">{{ trip.employee.fullName }}</p>
						<p class="text-xs text-gray-400">{{ trip.employee.employeeCode }} · {{ trip.employee.department ?? '—' }}</p>
					</div>
					<div v-if="trip.approver" class="space-y-1">
						<p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold">Người duyệt</p>
						<p class="text-sm font-medium text-gray-900 dark:text-white">{{ trip.approver.fullName }}</p>
						<p v-if="trip.approvedAt" class="text-xs text-gray-400">Duyệt lúc {{ fmtDateTime(trip.approvedAt) }}</p>
						<p v-if="trip.rejectedAt" class="text-xs text-red-500">Từ chối lúc {{ fmtDateTime(trip.rejectedAt) }}</p>
					</div>
				</div>

				<!-- Reject note -->
				<div v-if="trip.rejectNote" class="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
					<p class="text-xs font-medium text-red-700 dark:text-red-400">Lý do từ chối</p>
					<p class="text-sm text-red-600 dark:text-red-300 mt-1">{{ trip.rejectNote }}</p>
				</div>

				<!-- Report -->
				<div v-if="trip.report" class="space-y-3">
					<div class="flex items-center justify-between">
						<h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Báo cáo công tác</h3>
						<span :class="['text-xs font-medium px-2 py-0.5 rounded-full', trip.report.status === 'SUBMITTED' ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400']">
							{{ trip.report.status === 'SUBMITTED' ? 'Đã nộp' : 'Nháp' }}
						</span>
					</div>
					<div class="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 space-y-3">
						<div>
							<p class="text-xs text-gray-500 dark:text-gray-400">Tóm tắt</p>
							<p class="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{{ trip.report.summary }}</p>
						</div>
						<div>
							<p class="text-xs text-gray-500 dark:text-gray-400">Kết quả</p>
							<p class="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{{ trip.report.results }}</p>
						</div>
						<div v-if="trip.report.actualCost !== null" class="grid grid-cols-2 gap-3">
							<div>
								<p class="text-xs text-gray-500 dark:text-gray-400">Chi phí thực tế</p>
								<p class="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{{ fmtCurrency(trip.report.actualCost) }}</p>
							</div>
						</div>
						<div v-if="trip.report.issues">
							<p class="text-xs text-gray-500 dark:text-gray-400">Vấn đề phát sinh</p>
							<p class="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{{ trip.report.issues }}</p>
						</div>
					</div>
				</div>
			</div>

			<div class="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
				<div class="flex gap-2">
					<CommonAppButton v-if="trip.canApprove" variant="primary" @click="emit('approve', trip)">Duyệt</CommonAppButton>
					<CommonAppButton v-if="trip.canApprove" variant="danger" @click="emit('reject', trip)">Từ chối</CommonAppButton>
					<CommonAppButton v-if="trip.canAddReport" @click="emit('addReport', trip)">
						{{ trip.report ? 'Cập nhật báo cáo' : 'Thêm báo cáo' }}
					</CommonAppButton>
				</div>
				<CommonAppButton variant="secondary" @click="emit('close')">Đóng</CommonAppButton>
			</div>
		</div>
	</div>
</template>
