<script setup lang="ts">
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useGeneralRequestService } from '~/services/general-request.service';
import RequestStatusBadge from '~/components/modules/general-request/RequestStatusBadge.vue';
import ApproverChain from '~/components/modules/general-request/ApproverChain.vue';
import type { GeneralRequestResponse } from '~/types/general-request.types';

definePageMeta({ title: 'Chi tiết văn bản' });

const route = useRoute();
const toast = useToast();
const { user } = useAuth();
const service = useGeneralRequestService();
const { printRequest } = usePrint();

const requestId = Number(route.params.id);
const request = ref<GeneralRequestResponse | null>(null);
const loading = ref(true);

const showApproveNote = ref(false);
const approveNote = ref('');
const showRejectNote = ref(false);
const rejectNote = ref('');
const actionLoading = ref(false);

const isCurrentApprover = computed(() =>
	request.value?.currentApprover?.employeeId === user.value?.id &&
	request.value?.status === 'PENDING',
);

async function loadRequest() {
	loading.value = true;
	try {
		request.value = await service.findOne(requestId);
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Không thể tải chi tiết');
	} finally {
		loading.value = false;
	}
}

async function handleApprove() {
	actionLoading.value = true;
	try {
		request.value = await service.approve(requestId, approveNote.value ? { note: approveNote.value } : undefined);
		toast.success('Đã duyệt');
		showApproveNote.value = false;
		approveNote.value = '';
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
	} finally {
		actionLoading.value = false;
	}
}

async function handleReject() {
	if (!rejectNote.value.trim()) { toast.error('Vui lòng nhập lý do từ chối'); return; }
	actionLoading.value = true;
	try {
		request.value = await service.reject(requestId, { note: rejectNote.value });
		toast.success('Đã từ chối');
		showRejectNote.value = false;
		rejectNote.value = '';
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
	} finally {
		actionLoading.value = false;
	}
}

async function handlePrint() {
	try {
		await printRequest(requestId);
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Không thể in');
	}
}

function fmtDateTime(d: string) {
	return format(new Date(d), 'HH:mm dd/MM/yyyy', { locale: vi });
}

const categoryLabels: Record<string, string> = {
	PROPOSAL: 'Tờ trình BGĐ',
	PURCHASE: 'Mua sắm',
	REWARD: 'Khen thưởng',
	OTHER: 'Khác',
};

onMounted(() => loadRequest());
</script>

<template>
	<div class="max-w-2xl mx-auto space-y-6">
		<!-- Header -->
		<div class="flex items-center gap-3">
			<NuxtLink to="/general-requests" class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
				<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
				</svg>
			</NuxtLink>
			<div class="flex items-center gap-2">
				<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Chi tiết văn bản</h1>
				<RequestStatusBadge v-if="request" :status="request.status" />
			</div>
		</div>

		<div v-if="loading" class="flex justify-center py-16">
			<svg class="animate-spin w-6 h-6 text-brand-500" fill="none" viewBox="0 0 24 24">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
				<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
			</svg>
		</div>

		<template v-else-if="request">
			<!-- Meta -->
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
				<div class="flex items-start justify-between gap-3">
					<div>
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ request.title }}</h2>
						<div class="flex items-center gap-2 mt-1">
							<span class="text-xs text-gray-400">{{ categoryLabels[request.template.category] ?? request.template.category }}</span>
							<span class="text-gray-300 dark:text-gray-600">·</span>
							<span class="text-xs text-gray-400">{{ request.template.name }}</span>
						</div>
					</div>
					<div class="text-right">
						<p class="text-xs text-gray-400">Người tạo</p>
						<p class="text-sm font-medium text-gray-900 dark:text-white">{{ request.employee.fullName }}</p>
						<p class="text-xs text-gray-400">{{ request.employee.employeeCode }}</p>
					</div>
				</div>
				<div class="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
					<div>
						<p class="text-xs text-gray-400">Ngày tạo</p>
						<p class="text-sm text-gray-600 dark:text-gray-400">{{ fmtDateTime(request.createdAt) }}</p>
					</div>
					<div v-if="request.submittedAt">
						<p class="text-xs text-gray-400">Ngày nộp</p>
						<p class="text-sm text-gray-600 dark:text-gray-400">{{ fmtDateTime(request.submittedAt) }}</p>
					</div>
					<div v-if="request.completedAt">
						<p class="text-xs text-gray-400">Hoàn thành</p>
						<p class="text-sm text-green-600 dark:text-green-400">{{ fmtDateTime(request.completedAt) }}</p>
					</div>
					<div v-if="request.printCount > 0">
						<p class="text-xs text-gray-400">Đã in</p>
						<p class="text-sm text-gray-600 dark:text-gray-400">{{ request.printCount }} lần</p>
					</div>
				</div>
			</div>

			<!-- Field values -->
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
				<h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Nội dung</h2>
				<div class="space-y-3">
					<div v-for="(value, key) in request.fieldValues" :key="key" class="grid grid-cols-3 gap-2">
						<p class="text-sm text-gray-500 dark:text-gray-400 col-span-1">{{ key }}</p>
						<p class="text-sm text-gray-800 dark:text-gray-200 col-span-2">{{ String(value ?? '—') }}</p>
					</div>
					<p v-if="Object.keys(request.fieldValues).length === 0" class="text-sm text-gray-400">Không có trường nào</p>
				</div>
			</div>

			<!-- Approval timeline -->
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
				<h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Quy trình duyệt</h2>
				<ApproverChain
					:approvers="request.approvers"
					:current-approver-index="request.currentApproverIndex"
					:creator-name="request.employee.fullName"
				/>
			</div>

			<!-- Actions -->
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
				<h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Thao tác</h2>

				<template v-if="isCurrentApprover">
					<template v-if="!showApproveNote && !showRejectNote">
						<div class="flex gap-3">
							<CommonAppButton variant="primary" @click="showApproveNote = true">
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
								Duyệt văn bản
							</CommonAppButton>
							<CommonAppButton variant="danger" @click="showRejectNote = true">
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
								Từ chối
							</CommonAppButton>
						</div>
					</template>

					<template v-else-if="showApproveNote">
						<div class="space-y-3">
							<p class="text-sm text-gray-600 dark:text-gray-400">Ghi chú khi duyệt (tùy chọn):</p>
							<textarea v-model="approveNote" rows="2" placeholder="Thêm ghi chú..." class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none" />
							<div class="flex gap-3">
								<CommonAppButton variant="primary" :loading="actionLoading" @click="handleApprove">Xác nhận duyệt</CommonAppButton>
								<CommonAppButton variant="secondary" @click="showApproveNote = false; approveNote = ''">Hủy</CommonAppButton>
							</div>
						</div>
					</template>

					<template v-else-if="showRejectNote">
						<div class="space-y-3">
							<p class="text-sm text-gray-600 dark:text-gray-400">Lý do từ chối <span class="text-red-500">*</span>:</p>
							<textarea v-model="rejectNote" rows="2" placeholder="Nhập lý do từ chối..." class="w-full px-3 py-2 text-sm rounded-lg border border-red-300 dark:border-red-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none" />
							<div class="flex gap-3">
								<CommonAppButton variant="danger" :loading="actionLoading" @click="handleReject">Xác nhận từ chối</CommonAppButton>
								<CommonAppButton variant="secondary" @click="showRejectNote = false; rejectNote = ''">Hủy</CommonAppButton>
							</div>
						</div>
					</template>
				</template>

				<template v-else-if="request.canPrint">
					<button
						class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors border border-green-200 dark:border-green-800"
						@click="handlePrint"
					>
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.056 48.056 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" /></svg>
						In / Xuất PDF
					</button>
				</template>

				<p v-else class="text-sm text-gray-400 dark:text-gray-500">Không có thao tác nào khả dụng</p>
			</div>
		</template>
	</div>
</template>
