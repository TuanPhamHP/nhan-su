<script setup lang="ts">
	import { format, parseISO } from 'date-fns';
	import ViolationStatusBadge from '~/components/modules/violation/ViolationStatusBadge.vue';
	import type { ViolationDetailView } from '~/types/violation.types';
	import { violationTypeClass } from '~/utils/violation.utils';

	const props = withDefaults(
		defineProps<{
			violationRequest: ViolationDetailView;
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

	const canReview = computed(() => {
		if (props.violationRequest.status !== 'PENDING') return false;
		if (!user.value) return false;
		if (user.value.role === 'ADMIN') return true;
		if (props.violationRequest.assignedReviewer !== null) {
			return props.violationRequest.assignedReviewer.id === user.value.id;
		}
		return user.value.role === 'HR';
	});

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

</script>

<template>
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
		<div class="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
			<!-- Header -->
			<div
				class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0"
			>
				<h2 class="text-base font-semibold text-gray-900 dark:text-white">Chi tiết phiếu vi phạm</h2>
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
				<!-- Type + Status + Date -->
				<div class="flex items-center justify-between flex-wrap gap-2">
					<div class="flex items-center gap-2 flex-wrap">
						<span
							:class="[
								'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
								violationTypeClass(violationRequest.type),
							]"
						>
							{{ violationRequest.typeLabel }}
						</span>
						<ViolationStatusBadge :status="violationRequest.status" />
					</div>
					<span class="text-sm font-semibold text-gray-900 dark:text-white">
						{{ formatDate(violationRequest.violationDate) }}
					</span>
				</div>

				<!-- Reason -->
				<div class="space-y-1">
					<p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Lý do</p>
					<p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{{ violationRequest.reason }}</p>
				</div>

				<!-- slotCost — FORGOT_CHECKIN only -->
				<div v-if="violationRequest.type === 'FORGOT_CHECKIN'" class="space-y-1">
					<p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Chi phí lượt</p>
					<p class="text-sm text-gray-700 dark:text-gray-300">
						<span class="font-semibold">{{ violationRequest.slotCost }} lượt</span>
						<span class="text-gray-400 dark:text-gray-500 ml-1.5">
							{{ violationRequest.slotCost === 2 ? '— quên chấm công cả ngày' : '— thiếu check-in hoặc check-out' }}
						</span>
					</p>
				</div>

				<!-- Evidence photo -->
				<div v-if="violationRequest.evidencePhotoUrl" class="space-y-1.5">
					<p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Minh chứng</p>
					<a
						:href="violationRequest.evidencePhotoUrl"
						target="_blank"
						rel="noopener noreferrer"
						class="block rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:opacity-90 transition-opacity"
					>
						<img
							:src="violationRequest.evidencePhotoUrl"
							alt="Ảnh minh chứng"
							class="w-full object-contain max-h-52 bg-gray-50 dark:bg-gray-800"
						/>
					</a>
				</div>

				<!-- Timeline -->
				<div class="space-y-1.5">
					<p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Timeline</p>
					<div class="relative space-y-3">
						<!-- Vertical line — left-3 = 12px, dot center = ml-1.5(6px) + w-3/2(6px) = 12px ✓ -->
						<div class="absolute left-3 top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-gray-700" />

						<!-- Submitted -->
						<div class="flex items-start gap-2.5">
							<div class="ml-1.5 mt-0.5 w-3 h-3 rounded-full bg-brand-500 flex-shrink-0 ring-2 ring-white dark:ring-gray-900 z-10" />
							<div>
								<p class="text-xs font-medium text-gray-700 dark:text-gray-300">Đã nộp phiếu</p>
								<p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
									{{ formatDateTime(violationRequest.createdAt) }}
								</p>
							</div>
						</div>

						<!-- Result: APPROVED / REJECTED / CANCELLED -->
						<div v-if="violationRequest.status !== 'PENDING'" class="flex items-start gap-2.5">
							<div
								class="ml-1.5 mt-0.5 w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-white dark:ring-gray-900 z-10"
								:class="{
									'bg-green-500': violationRequest.status === 'APPROVED',
									'bg-red-500': violationRequest.status === 'REJECTED',
									'bg-gray-400': violationRequest.status === 'CANCELLED',
								}"
							/>
							<div class="space-y-0.5">
								<p class="text-xs font-medium text-gray-700 dark:text-gray-300">
									<span v-if="violationRequest.status === 'APPROVED'">Đã duyệt</span>
									<span v-else-if="violationRequest.status === 'REJECTED'">Từ chối</span>
									<span v-else>Đã thu hồi</span>
									<span
										v-if="violationRequest.reviewedBy"
										class="font-normal text-gray-500 dark:text-gray-400"
									>
										bởi {{ violationRequest.reviewedBy.fullName }}
									</span>
								</p>
								<p v-if="violationRequest.reviewedAt" class="text-xs text-gray-400 dark:text-gray-500">
									{{ formatDateTime(violationRequest.reviewedAt) }}
								</p>
								<p
									v-if="violationRequest.reviewNote"
									class="text-xs text-red-600 dark:text-red-400 italic mt-1 leading-relaxed"
								>
									"{{ violationRequest.reviewNote }}"
								</p>
							</div>
						</div>

						<!-- Pending — waiting -->
						<div v-else class="flex items-start gap-2.5">
							<div class="ml-1.5 mt-0.5 w-3 h-3 rounded-full bg-amber-400 flex-shrink-0 ring-2 ring-white dark:ring-gray-900 z-10 animate-pulse" />
							<div>
								<p class="text-xs font-medium text-amber-600 dark:text-amber-400 mt-0.5">Đang chờ duyệt...</p>
								<p v-if="violationRequest.assignedReviewer" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
									Người duyệt: {{ violationRequest.assignedReviewer.fullName }}
								</p>
							</div>
						</div>
					</div>
				</div>

				<!-- Deadline -->
				<div
					class="flex items-center justify-between text-xs pt-1 border-t border-gray-100 dark:border-gray-800"
				>
					<span class="text-gray-400 dark:text-gray-500">Hạn nộp</span>
					<span :class="violationRequest.deadlinePassed ? 'text-red-500 font-medium' : 'text-gray-500 dark:text-gray-400'">
						{{ formatDate(violationRequest.deadline) }}
						<span v-if="violationRequest.deadlinePassed"> (Quá hạn)</span>
					</span>
				</div>
			</div>

			<!-- Footer -->
			<div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
				<div v-if="canReview" class="flex items-center gap-2">
					<CommonAppButton variant="outline" class="flex-1 justify-center" @click="emit('close')">Đóng</CommonAppButton>
					<CommonAppButton variant="danger" @click="emit('reject')">Từ chối</CommonAppButton>
					<CommonAppButton variant="primary" :loading="approving" @click="emit('approve')">Duyệt</CommonAppButton>
				</div>
				<CommonAppButton v-else variant="outline" class="w-full justify-center" @click="emit('close')">Đóng</CommonAppButton>
			</div>
		</div>
	</div>
</template>
