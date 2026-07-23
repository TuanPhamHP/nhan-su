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
		const v = props.violationRequest;
		if (v.status !== 'PENDING' && v.status !== 'PENDING_L2') return false;
		if (!user.value) return false;
		if (user.value.role === 'ADMIN') return true;
		if (v.status === 'PENDING') {
			if (v.assignedReviewer !== null) return v.assignedReviewer.id === user.value.id;
			return user.value.role === 'HR';
		}
		if (v.approverL2 !== null) return v.approverL2.id === user.value.id;
		return user.value.role === 'HR';
	});

	const approveButtonLabel = computed(() => {
		const v = props.violationRequest;
		if (v.status === 'PENDING') {
			return v.isMultiLevel ? 'Duyệt (Cấp 1)' : 'Duyệt';
		}
		return 'Duyệt (Cấp 2)';
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

				<!-- Approval flow -->
				<div class="space-y-2">
					<p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Quy trình duyệt</p>

					<!-- Multi-level: 2-step timeline -->
					<div v-if="violationRequest.isMultiLevel" class="space-y-3">
						<!-- Step 1 -->
						<div class="flex items-start gap-3">
							<div
								class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold ring-2 ring-white dark:ring-gray-900"
								:class="
									violationRequest.approvedL1At
										? 'bg-green-500 text-white'
										: violationRequest.status === 'PENDING'
											? 'bg-yellow-400 text-white animate-pulse'
											: 'bg-gray-200 dark:bg-gray-700 text-gray-500'
								"
							>
								<svg v-if="violationRequest.approvedL1At" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
									<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
								</svg>
								<span v-else>1</span>
							</div>
							<div class="flex-1 min-w-0">
								<p class="text-sm font-medium text-gray-700 dark:text-gray-300">Cấp 1 — Quản lý trực tiếp</p>
								<p class="text-xs text-gray-500 dark:text-gray-400">
									{{ violationRequest.assignedReviewer?.fullName ?? 'HR' }}
								</p>
								<p v-if="violationRequest.approvedL1At" class="text-xs text-green-600 dark:text-green-400 mt-0.5">
									✓ Đã duyệt {{ formatDateTime(violationRequest.approvedL1At) }}
								</p>
								<p
									v-else-if="violationRequest.status === 'PENDING'"
									class="text-xs text-yellow-600 dark:text-yellow-400 mt-0.5"
								>
									⏳ Đang chờ duyệt
								</p>
							</div>
						</div>

						<!-- Connector -->
						<div class="ml-3.5 h-4 w-0.5" :class="violationRequest.approvedL1At ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-700'" />

						<!-- Step 2 -->
						<div class="flex items-start gap-3">
							<div
								class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold ring-2 ring-white dark:ring-gray-900"
								:class="
									violationRequest.status === 'APPROVED'
										? 'bg-green-500 text-white'
										: violationRequest.status === 'PENDING_L2'
											? 'bg-orange-500 text-white animate-pulse'
											: 'bg-gray-200 dark:bg-gray-700 text-gray-500'
								"
							>
								<svg v-if="violationRequest.status === 'APPROVED'" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
									<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
								</svg>
								<span v-else>2</span>
							</div>
							<div class="flex-1 min-w-0">
								<p class="text-sm font-medium text-gray-700 dark:text-gray-300">Cấp 2 — Quản lý phòng ban</p>
								<p class="text-xs text-gray-500 dark:text-gray-400">
									{{ violationRequest.approverL2?.fullName ?? 'Giám đốc' }}
								</p>
								<p v-if="violationRequest.status === 'APPROVED'" class="text-xs text-green-600 dark:text-green-400 mt-0.5">
									✓ Đã duyệt {{ formatDateTime(violationRequest.reviewedAt) }}
								</p>
								<p
									v-else-if="violationRequest.status === 'PENDING_L2'"
									class="text-xs text-orange-600 dark:text-orange-400 mt-0.5"
								>
									⏳ Đang chờ duyệt
								</p>
								<p v-else class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
									Chờ cấp 1 duyệt trước
								</p>
							</div>
						</div>
					</div>

					<!-- Single-level -->
					<div v-else class="text-sm text-gray-600 dark:text-gray-400">
						Người duyệt: <span class="font-medium text-gray-800 dark:text-gray-200">{{ violationRequest.assignedReviewer?.fullName ?? 'HR' }}</span>
					</div>
				</div>

				<!-- Terminal result (REJECTED / CANCELLED) -->
				<div
					v-if="violationRequest.status === 'REJECTED' || violationRequest.status === 'CANCELLED'"
					class="space-y-1.5 pt-3 border-t border-gray-100 dark:border-gray-800"
				>
					<p class="text-sm font-medium text-gray-700 dark:text-gray-300">
						<span v-if="violationRequest.status === 'REJECTED'">Bị từ chối</span>
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

				<!-- Created + Deadline -->
				<div class="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-1.5">
					<div class="flex items-center justify-between text-xs">
						<span class="text-gray-400 dark:text-gray-500">Đã nộp</span>
						<span class="text-gray-500 dark:text-gray-400">{{ formatDateTime(violationRequest.createdAt) }}</span>
					</div>
					<div class="flex items-center justify-between text-xs">
						<span class="text-gray-400 dark:text-gray-500">Hạn nộp</span>
						<span :class="violationRequest.deadlinePassed ? 'text-red-500 font-medium' : 'text-gray-500 dark:text-gray-400'">
							{{ formatDate(violationRequest.deadline) }}
							<span v-if="violationRequest.deadlinePassed"> (Quá hạn)</span>
						</span>
					</div>
				</div>
			</div>

			<!-- Footer -->
			<div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
				<div v-if="canReview" class="space-y-2">
					<div class="flex items-center gap-2">
						<CommonAppButton variant="outline" class="flex-1 justify-center" @click="emit('close')">Đóng</CommonAppButton>
						<CommonAppButton variant="danger" @click="emit('reject')">Từ chối</CommonAppButton>
						<CommonAppButton variant="primary" :loading="approving" @click="emit('approve')">
							{{ approveButtonLabel }}
						</CommonAppButton>
					</div>
					<p
						v-if="violationRequest.isMultiLevel && violationRequest.status === 'PENDING'"
						class="text-xs text-gray-400 dark:text-gray-500 text-right"
					>
						Sau khi duyệt, phiếu sẽ chuyển lên
						{{ violationRequest.approverL2?.fullName ?? 'Giám đốc' }} xem xét cấp 2
					</p>
				</div>
				<CommonAppButton v-else variant="outline" class="w-full justify-center" @click="emit('close')">Đóng</CommonAppButton>
			</div>
		</div>
	</div>
</template>
