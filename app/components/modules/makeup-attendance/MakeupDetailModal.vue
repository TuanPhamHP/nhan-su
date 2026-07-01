<script setup lang="ts">
import { format, parseISO } from 'date-fns';
import MakeupStatusBadge from '~/components/modules/makeup-attendance/MakeupStatusBadge.vue';
import type { MakeupRequestResponse } from '~/types/makeup-attendance.types';

const props = defineProps<{
	request: MakeupRequestResponse;
	canReview?: boolean;
	approving?: boolean;
}>();

const emit = defineEmits<{
	close: [];
	approve: [];
	reject: [];
}>();

function formatDate(d: string | null | undefined) {
	if (!d) return '—';
	try {
		return format(parseISO(d), 'dd/MM/yyyy');
	} catch {
		return d;
	}
}

function formatDateTime(iso: string | null | undefined) {
	if (!iso) return '—';
	try {
		return format(parseISO(iso), 'HH:mm - dd/MM/yyyy');
	} catch {
		return iso;
	}
}

function formatTime(iso: string | null) {
	if (!iso) return '—';
	try {
		return format(parseISO(iso), 'HH:mm');
	} catch {
		return iso;
	}
}
</script>

<template>
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
		<div class="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
			<!-- Header -->
			<div
				class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0"
			>
				<h2 class="text-base font-semibold text-gray-900 dark:text-white">Chi tiết đơn bù công</h2>
				<button
					class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
					@click="emit('close')"
				>
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Scrollable body -->
			<div class="overflow-y-auto flex-1 px-6 py-5 space-y-5">
				<!-- Employee + Status -->
				<div class="flex items-center justify-between gap-3 flex-wrap">
					<div>
						<p class="text-sm font-semibold text-gray-900 dark:text-white">{{ request.employee.fullName }}</p>
						<p class="text-xs text-gray-400 dark:text-gray-500">{{ request.employee.employeeCode }}</p>
					</div>
					<MakeupStatusBadge :status="request.status" />
				</div>

				<!-- Attendance date + requested times -->
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1">
						<p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Ngày bù công</p>
						<p class="text-sm text-gray-700 dark:text-gray-300 font-medium">{{ formatDate(request.attendanceDate) }}</p>
					</div>
					<div class="space-y-1">
						<p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Giờ đề xuất</p>
						<p class="text-sm text-gray-700 dark:text-gray-300 font-mono">
							{{ formatTime(request.requestedCheckIn) }} → {{ formatTime(request.requestedCheckOut) }}
						</p>
					</div>
				</div>

				<!-- Reason -->
				<div class="space-y-1">
					<p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Lý do</p>
					<p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{{ request.reason }}</p>
				</div>

				<!-- Evidence photo -->
				<div v-if="request.evidencePhotoUrl" class="space-y-1.5">
					<p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Minh chứng</p>
					<a
						:href="request.evidencePhotoUrl"
						target="_blank"
						rel="noopener noreferrer"
						class="block rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:opacity-90 transition-opacity"
					>
						<img
							:src="request.evidencePhotoUrl"
							alt="Ảnh minh chứng"
							class="w-full object-contain max-h-52 bg-gray-50 dark:bg-gray-800"
						/>
					</a>
				</div>

				<!-- Timeline -->
				<div class="space-y-1.5">
					<p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Timeline</p>
					<div class="relative space-y-3">
						<div class="absolute left-3 top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-gray-700" />

						<!-- Submitted -->
						<div class="flex items-start gap-2.5">
							<div class="ml-1.5 mt-0.5 w-3 h-3 rounded-full bg-brand-500 flex-shrink-0 ring-2 ring-white dark:ring-gray-900 z-10" />
							<div>
								<p class="text-xs font-medium text-gray-700 dark:text-gray-300">Đã nộp đơn</p>
								<p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{{ formatDateTime(request.createdAt) }}</p>
							</div>
						</div>

						<!-- Reviewed -->
						<div v-if="request.status !== 'PENDING'" class="flex items-start gap-2.5">
							<div
								class="ml-1.5 mt-0.5 w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-white dark:ring-gray-900 z-10"
								:class="request.status === 'APPROVED' ? 'bg-green-500' : 'bg-red-500'"
							/>
							<div class="space-y-0.5">
								<p class="text-xs font-medium text-gray-700 dark:text-gray-300">
									<span v-if="request.status === 'APPROVED'">Đã duyệt</span>
									<span v-else>Từ chối</span>
									<span v-if="request.reviewedBy" class="font-normal text-gray-500 dark:text-gray-400">
										bởi {{ request.reviewedBy.fullName }}
									</span>
								</p>
								<p v-if="request.updatedAt" class="text-xs text-gray-400 dark:text-gray-500">
									{{ formatDateTime(request.updatedAt) }}
								</p>
								<p
									v-if="request.reviewNote"
									class="text-xs italic mt-1 leading-relaxed"
									:class="request.status === 'REJECTED' ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'"
								>
									"{{ request.reviewNote }}"
								</p>
							</div>
						</div>

						<!-- Pending -->
						<div v-else class="flex items-start gap-2.5">
							<div class="ml-1.5 mt-0.5 w-3 h-3 rounded-full bg-amber-400 flex-shrink-0 ring-2 ring-white dark:ring-gray-900 z-10 animate-pulse" />
							<p class="text-xs text-amber-600 dark:text-amber-400 font-medium mt-0.5">Đang chờ duyệt...</p>
						</div>
					</div>
				</div>
			</div>

			<!-- Footer -->
			<div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
				<div v-if="canReview && request.status === 'PENDING'" class="flex items-center justify-end gap-3">
					<CommonAppButton variant="outline" @click="emit('close')">Đóng</CommonAppButton>
					<CommonAppButton variant="danger" @click="emit('reject')">Từ chối</CommonAppButton>
					<CommonAppButton variant="primary" :loading="approving" @click="emit('approve')">Duyệt</CommonAppButton>
				</div>
				<CommonAppButton v-else variant="outline" class="w-full justify-center" @click="emit('close')">Đóng</CommonAppButton>
			</div>
		</div>
	</div>
</template>
