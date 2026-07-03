<script setup lang="ts">
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useGeneralRequestService } from '~/services/general-request.service';
import { useGeneralRequestStore } from '~/stores/generalRequest';
import RequestStatusBadge from '~/components/modules/general-request/RequestStatusBadge.vue';
import ApproverChain from '~/components/modules/general-request/ApproverChain.vue';
import type { GeneralRequestResponse, DocumentTemplateDetail } from '~/types/general-request.types';

definePageMeta({ title: 'Chi tiết văn bản' });

const route = useRoute();
const toast = useToast();
const { user } = useAuth();
const service = useGeneralRequestService();
const { printRequest, previewRequest } = usePrint();
const generalRequestStore = useGeneralRequestStore();

const requestId = Number(route.params.id);
const request = ref<GeneralRequestResponse | null>(null);
const templateDetail = ref<DocumentTemplateDetail | null>(null);
const loading = ref(true);

const showApproveNote = ref(false);
const approveNote = ref('');
const showRejectNote = ref(false);
const rejectNote = ref('');
const showCancelConfirm = ref(false);
const actionLoading = ref(false);

const isAdmin = computed(() => user.value?.role === 'ADMIN');

const isCurrentApprover = computed(() =>
	(request.value?.currentApprover?.employeeId === user.value?.id || isAdmin.value) &&
	request.value?.status === 'PENDING',
);

const canCancelNow = computed(() =>
	!!request.value && (request.value.canCancel || (isAdmin.value && request.value.status === 'PENDING')),
);

const renderedHtml = computed(() => {
	const tmpl = templateDetail.value?.printTemplate ?? request.value?.printTemplate;
	if (!tmpl || !request.value) return '';
	let html = tmpl;
	for (const [key, value] of Object.entries(request.value.fieldValues)) {
		html = html.replaceAll(`{{${key}}}`, String(value ?? ''));
	}
	return html;
});

const iframeSrcdoc = computed(() => {
	if (!renderedHtml.value) return '';
	return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:16px 24px;font-family:'Times New Roman',serif;font-size:14px;line-height:1.6;color:#111;}*{box-sizing:border-box;}</style></head><body>${renderedHtml.value}</body></html>`;
});

const iframeRef = ref<HTMLIFrameElement | null>(null);
function onIframeLoad() {
	const el = iframeRef.value;
	if (!el?.contentDocument?.body) return;
	el.style.height = el.contentDocument.body.scrollHeight + 32 + 'px';
}

async function loadRequest() {
	loading.value = true;
	try {
		const res = await service.findOne(requestId);
		request.value = res;
		templateDetail.value = await service.findTemplate(res.template.id);
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

async function handleCancel() {
	actionLoading.value = true;
	try {
		request.value = await service.cancel(requestId);
		toast.success('Đã thu hồi đơn');
		showCancelConfirm.value = false;
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
	} finally {
		actionLoading.value = false;
	}
}

async function handlePrint() {
	try {
		await printRequest(requestId);
		await loadRequest();
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

const categoryColors: Record<string, string> = {
	PROPOSAL: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
	PURCHASE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
	REWARD: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
	OTHER: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};

onMounted(() => loadRequest());

// Re-fetch khi nhận FCM general_request.* liên quan đến đơn này
watch(() => generalRequestStore.refreshSignal, () => {
	const refreshId = generalRequestStore.lastRefreshId;
	if (refreshId === null || refreshId === requestId) {
		loadRequest();
	}
});
</script>

<template>
	<div class="space-y-5">
		<!-- Header -->
		<div class="flex items-center gap-3">
			<NuxtLink to="/general-requests" class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
				<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
				</svg>
			</NuxtLink>
			<div class="flex items-center gap-2 flex-1 min-w-0">
				<h1 class="text-xl font-semibold text-gray-900 dark:text-white truncate">
					{{ request?.title ?? 'Chi tiết văn bản' }}
				</h1>
				<RequestStatusBadge v-if="request" :status="request.status" />
			</div>
		</div>

		<!-- Loading -->
		<div v-if="loading" class="flex justify-center py-16">
			<svg class="animate-spin w-6 h-6 text-brand-500" fill="none" viewBox="0 0 24 24">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
				<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
			</svg>
		</div>

		<template v-else-if="request">
			<div class="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">

				<!-- Left: document content -->
				<div class="space-y-5">
					<!-- Rendered template -->
					<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
						<div class="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
							<h2 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Nội dung văn bản</h2>
							<div class="flex items-center gap-2">
								<button
									v-if="iframeSrcdoc"
									class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
									title="Xem trước bản in"
									@click="previewRequest(request, templateDetail?.printTemplate)"
								>
									<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
										<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
									</svg>
									Xem bản in
								</button>
								<button
									v-if="request.canPrint"
									class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
									@click="handlePrint"
								>
									<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.056 48.056 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
									</svg>
									In / Xuất PDF
									<span v-if="request.printCount > 0" class="text-[10px] opacity-60">({{ request.printCount }})</span>
								</button>
							</div>
						</div>
						<iframe
							v-if="iframeSrcdoc"
							ref="iframeRef"
							:srcdoc="iframeSrcdoc"
							class="w-full border-0 block"
							style="min-height: 400px;"
							@load="onIframeLoad"
						/>
						<div v-if="!iframeSrcdoc" class="p-5 space-y-3">
							<div v-for="(value, key) in request.fieldValues" :key="key" class="grid grid-cols-3 gap-2">
								<p class="text-sm text-gray-500 dark:text-gray-400">{{ key }}</p>
								<p class="text-sm text-gray-800 dark:text-gray-200 col-span-2">{{ String(value ?? '—') }}</p>
							</div>
						</div>
					</div>
				</div>

				<!-- Right: sidebar -->
				<div class="space-y-5">
					<!-- Meta info -->
					<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
						<div class="flex items-center gap-2">
							<span :class="['text-xs font-medium px-1.5 py-0.5 rounded', categoryColors[request.template.category] ?? categoryColors.OTHER]">
								{{ categoryLabels[request.template.category] ?? request.template.category }}
							</span>
							<span class="text-xs text-gray-400 truncate">{{ request.template.name }}</span>
						</div>

						<div class="space-y-2.5">
							<div class="flex justify-between items-baseline">
								<span class="text-xs text-gray-400">Người tạo</span>
								<div class="text-right">
									<p class="text-sm font-medium text-gray-900 dark:text-white">{{ request.employee.fullName }}</p>
									<p class="text-xs text-gray-400">{{ request.employee.employeeCode }}</p>
								</div>
							</div>
							<div class="flex justify-between items-baseline">
								<span class="text-xs text-gray-400">Ngày tạo</span>
								<p class="text-sm text-gray-600 dark:text-gray-400">{{ fmtDateTime(request.createdAt) }}</p>
							</div>
							<div v-if="request.submittedAt" class="flex justify-between items-baseline">
								<span class="text-xs text-gray-400">Ngày nộp</span>
								<p class="text-sm text-gray-600 dark:text-gray-400">{{ fmtDateTime(request.submittedAt) }}</p>
							</div>
							<div v-if="request.completedAt" class="flex justify-between items-baseline">
								<span class="text-xs text-gray-400">Hoàn thành</span>
								<p class="text-sm text-green-600 dark:text-green-400">{{ fmtDateTime(request.completedAt) }}</p>
							</div>
							<div v-if="request.cancelledAt" class="flex justify-between items-baseline">
								<span class="text-xs text-gray-400">Thu hồi lúc</span>
								<p class="text-sm text-gray-500 dark:text-gray-400">{{ fmtDateTime(request.cancelledAt) }}</p>
							</div>
						</div>
					</div>

					<!-- Approval chain -->
					<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
						<h2 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Quy trình duyệt</h2>
						<ApproverChain
							:approvers="request.approvers"
							:current-approver-index="request.currentApproverIndex"
							:creator-name="request.employee.fullName"
						/>
					</div>

					<!-- Cancel action -->
					<div v-if="canCancelNow" class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
						<h2 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Thu hồi đơn</h2>
						<template v-if="!showCancelConfirm">
							<p class="text-xs text-gray-500 dark:text-gray-400">Đơn đang ở trạng thái <strong>{{ request.statusLabel }}</strong>. Bạn có thể thu hồi nếu chưa được duyệt hoàn tất.</p>
							<CommonAppButton variant="secondary" class="w-full justify-center" @click="showCancelConfirm = true">
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
								</svg>
								Thu hồi đơn
							</CommonAppButton>
						</template>
						<template v-else>
							<p class="text-sm text-gray-700 dark:text-gray-300">Xác nhận thu hồi đơn <strong>{{ request.title }}</strong>? Hành động này không thể hoàn tác.</p>
							<div class="flex gap-2">
								<CommonAppButton variant="danger" :loading="actionLoading" @click="handleCancel">Xác nhận thu hồi</CommonAppButton>
								<CommonAppButton variant="secondary" @click="showCancelConfirm = false">Hủy</CommonAppButton>
							</div>
						</template>
					</div>

					<!-- Approve / Reject actions -->
					<div v-if="isCurrentApprover" class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
						<h2 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Thao tác duyệt</h2>

						<template v-if="!showApproveNote && !showRejectNote">
							<div class="flex flex-col gap-2">
								<CommonAppButton variant="primary" class="w-full justify-center" @click="showApproveNote = true">
									<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
									Duyệt văn bản
								</CommonAppButton>
								<CommonAppButton variant="danger" class="w-full justify-center" @click="showRejectNote = true">
									<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
									Từ chối
								</CommonAppButton>
							</div>
						</template>

						<template v-else-if="showApproveNote">
							<p class="text-sm text-gray-600 dark:text-gray-400">Ghi chú khi duyệt (tùy chọn):</p>
							<textarea
								v-model="approveNote"
								rows="2"
								placeholder="Thêm ghi chú..."
								class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
							/>
							<div class="flex gap-2">
								<CommonAppButton variant="primary" :loading="actionLoading" @click="handleApprove">Xác nhận duyệt</CommonAppButton>
								<CommonAppButton variant="secondary" @click="showApproveNote = false; approveNote = ''">Hủy</CommonAppButton>
							</div>
						</template>

						<template v-else-if="showRejectNote">
							<p class="text-sm text-gray-600 dark:text-gray-400">Lý do từ chối <span class="text-red-500">*</span>:</p>
							<textarea
								v-model="rejectNote"
								rows="2"
								placeholder="Nhập lý do từ chối..."
								class="w-full px-3 py-2 text-sm rounded-lg border border-red-300 dark:border-red-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
							/>
							<div class="flex gap-2">
								<CommonAppButton variant="danger" :loading="actionLoading" @click="handleReject">Xác nhận từ chối</CommonAppButton>
								<CommonAppButton variant="secondary" @click="showRejectNote = false; rejectNote = ''">Hủy</CommonAppButton>
							</div>
						</template>
					</div>
				</div>
			</div>
		</template>
	</div>
</template>
