<script setup lang="ts">
import { format } from 'date-fns';
import { useGeneralRequestService } from '~/services/general-request.service';
import RequestStatusBadge from '~/components/modules/general-request/RequestStatusBadge.vue';
import ApproverChain from '~/components/modules/general-request/ApproverChain.vue';
import type { GeneralRequestResponse, GeneralRequestStatus } from '~/types/general-request.types';
import type { PaginatedMeta } from '~/types/api.types';

definePageMeta({ title: 'Văn bản nội bộ' });

const toast = useToast();
const { user } = useAuth();
const service = useGeneralRequestService();
const { printRequest } = usePrint();

const canManage = computed(() => ['ADMIN', 'MANAGER', 'CHIEF', 'HR'].includes(user.value?.role ?? ''));

type Tab = 'all' | 'pending' | 'approved' | 'pending-for-me';
const activeTab = ref<Tab>('all');

// ─── My requests (all tabs except pending-for-me) ─────────────────────────────
const myRequests = ref<GeneralRequestResponse[]>([]);
const myMeta = ref<PaginatedMeta | null>(null);
const myLoading = ref(false);
const myFilter = reactive({ page: 1, status: '' as GeneralRequestStatus | '' });

async function fetchMyRequests() {
	myLoading.value = true;
	try {
		const statusMap: Record<Tab, GeneralRequestStatus | undefined> = {
			all: undefined,
			pending: 'PENDING',
			approved: 'APPROVED',
			'pending-for-me': undefined,
		};
		const params = {
			page: myFilter.page,
			limit: 20,
			status: statusMap[activeTab.value] ?? (myFilter.status || undefined),
		};
		const res = await service.findMe(params);
		myRequests.value = res.data;
		myMeta.value = res.meta;
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Lỗi tải danh sách');
	} finally {
		myLoading.value = false;
	}
}

// ─── Pending for me ───────────────────────────────────────────────────────────
const pendingForMe = ref<GeneralRequestResponse[]>([]);
const pendingLoading = ref(false);

async function fetchPendingForMe() {
	pendingLoading.value = true;
	try {
		pendingForMe.value = await service.findPendingForMe();
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Lỗi tải đơn chờ duyệt');
	} finally {
		pendingLoading.value = false;
	}
}

// ─── Detail modal ─────────────────────────────────────────────────────────────
const detailRequest = ref<GeneralRequestResponse | null>(null);
const showApproveNote = ref(false);
const approveNote = ref('');
const showRejectNote = ref(false);
const rejectNote = ref('');
const actionLoading = ref(false);

async function openDetail(req: GeneralRequestResponse) {
	try {
		const full = await service.findOne(req.id);
		detailRequest.value = full;
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
	}
}

async function handleApprove(req: GeneralRequestResponse) {
	actionLoading.value = true;
	try {
		const updated = await service.approve(req.id, approveNote.value ? { note: approveNote.value } : undefined);
		toast.success('Đã duyệt');
		replaceInList(updated);
		detailRequest.value = updated;
		showApproveNote.value = false;
		approveNote.value = '';
		fetchPendingForMe();
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
	} finally {
		actionLoading.value = false;
	}
}

async function handleReject(req: GeneralRequestResponse) {
	if (!rejectNote.value.trim()) { toast.error('Vui lòng nhập lý do từ chối'); return; }
	actionLoading.value = true;
	try {
		const updated = await service.reject(req.id, { note: rejectNote.value });
		toast.success('Đã từ chối');
		replaceInList(updated);
		detailRequest.value = updated;
		showRejectNote.value = false;
		rejectNote.value = '';
		fetchPendingForMe();
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
	} finally {
		actionLoading.value = false;
	}
}

async function handlePrint(req: GeneralRequestResponse) {
	try {
		await printRequest(req.id);
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Không thể in');
	}
}

function replaceInList(updated: GeneralRequestResponse) {
	const idx = myRequests.value.findIndex(r => r.id === updated.id);
	if (idx !== -1) myRequests.value.splice(idx, 1, updated);
	const pIdx = pendingForMe.value.findIndex(r => r.id === updated.id);
	if (pIdx !== -1) pendingForMe.value.splice(pIdx, 1, updated);
}

function fmtDate(d: string) {
	return format(new Date(d), 'dd/MM/yyyy');
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

const tabs: { key: Tab; label: string }[] = [
	{ key: 'all', label: 'Tất cả' },
	{ key: 'pending', label: 'Chờ duyệt' },
	{ key: 'approved', label: 'Đã duyệt' },
	...(canManage.value ? [{ key: 'pending-for-me' as Tab, label: 'Chờ tôi duyệt' }] : []),
];

onMounted(() => {
	fetchMyRequests();
	if (canManage.value) fetchPendingForMe();
});

watch(activeTab, tab => {
	myFilter.page = 1;
	if (tab === 'pending-for-me') {
		fetchPendingForMe();
	} else {
		fetchMyRequests();
	}
});
</script>

<template>
	<div class="space-y-5">
		<!-- Header -->
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Văn bản nội bộ</h1>
				<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Tạo và theo dõi tờ trình, đề xuất</p>
			</div>
			<NuxtLink to="/general-requests/create">
				<CommonAppButton>
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
					</svg>
					Tạo văn bản
				</CommonAppButton>
			</NuxtLink>
		</div>

		<!-- Tabs -->
		<div class="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
			<button
				v-for="tab in tabs"
				:key="tab.key"
				:class="['px-4 py-1.5 text-sm font-medium rounded-lg transition-all', activeTab === tab.key ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200']"
				@click="activeTab = tab.key"
			>
				{{ tab.label }}
				<span v-if="tab.key === 'pending-for-me' && pendingForMe.length > 0" class="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-orange-500 text-white rounded-full">{{ pendingForMe.length }}</span>
			</button>
		</div>

		<!-- List: my requests -->
		<template v-if="activeTab !== 'pending-for-me'">
			<div v-if="myLoading" class="flex justify-center py-12">
				<svg class="animate-spin w-6 h-6 text-brand-500" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
				</svg>
			</div>
			<div v-else-if="myRequests.length === 0" class="py-16 text-center text-sm text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
				Không có văn bản nào
			</div>
			<div v-else class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Văn bản</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Trạng thái</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Người duyệt hiện tại</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Ngày tạo</th>
							<th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Thao tác</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
						<tr v-for="req in myRequests" :key="req.id" class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
							<td class="px-4 py-3">
								<div class="flex items-center gap-2">
									<span :class="['text-xs font-medium px-1.5 py-0.5 rounded', categoryColors[req.template.category] ?? categoryColors.OTHER]">
										{{ categoryLabels[req.template.category] ?? req.template.category }}
									</span>
									<p class="font-medium text-gray-900 dark:text-white">{{ req.title }}</p>
									<svg v-if="req.printCount > 0" class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" title="Đã in">
										<path stroke-linecap="round" stroke-linejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.056 48.056 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
									</svg>
								</div>
								<p class="text-xs text-gray-400 mt-0.5">{{ req.template.name }}</p>
							</td>
							<td class="px-4 py-3"><RequestStatusBadge :status="req.status" /></td>
							<td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{{ req.currentApprover?.fullName ?? '—' }}</td>
							<td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{{ fmtDate(req.createdAt) }}</td>
							<td class="px-4 py-3">
								<div class="flex items-center justify-end gap-1.5">
									<button class="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors" title="Xem chi tiết" @click="openDetail(req)">
										<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
									</button>
									<button v-if="req.canPrint" class="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors" title="In / Xuất PDF" @click="handlePrint(req)">
										<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.056 48.056 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" /></svg>
									</button>
								</div>
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			<div v-if="myMeta && myMeta.totalPages > 1" class="flex items-center justify-between">
				<p class="text-sm text-gray-500 dark:text-gray-400">Tổng <strong>{{ myMeta.total }}</strong></p>
				<CommonAppPagination
					:current-page="myFilter.page"
					:total-pages="myMeta.totalPages"
					@update:current-page="p => { myFilter.page = p; fetchMyRequests(); }"
				/>
			</div>
		</template>

		<!-- Pending for me tab -->
		<template v-else>
			<div v-if="pendingLoading" class="flex justify-center py-12">
				<svg class="animate-spin w-6 h-6 text-brand-500" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
				</svg>
			</div>
			<div v-else-if="pendingForMe.length === 0" class="py-16 text-center text-sm text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
				Không có văn bản nào chờ bạn duyệt
			</div>
			<div v-else class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Người tạo</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Văn bản</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Ngày tạo</th>
							<th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Thao tác</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
						<tr v-for="req in pendingForMe" :key="req.id" class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
							<td class="px-4 py-3">
								<p class="font-medium text-gray-900 dark:text-white">{{ req.employee.fullName }}</p>
								<p class="text-xs text-gray-400">{{ req.employee.employeeCode }}</p>
							</td>
							<td class="px-4 py-3">
								<p class="font-medium text-gray-900 dark:text-white">{{ req.title }}</p>
								<p class="text-xs text-gray-400">{{ req.template.name }}</p>
							</td>
							<td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{{ fmtDate(req.createdAt) }}</td>
							<td class="px-4 py-3">
								<div class="flex items-center justify-end gap-1.5">
									<button class="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors" title="Xem" @click="openDetail(req)">
										<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
									</button>
									<NuxtLink :to="`/general-requests/${req.id}`">
										<CommonAppButton size="sm" variant="primary">Duyệt</CommonAppButton>
									</NuxtLink>
								</div>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</template>
	</div>

	<!-- Detail modal -->
	<Teleport to="body">
		<div v-if="detailRequest" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
			<div class="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
				<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
					<div class="flex items-center gap-3">
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ detailRequest.title }}</h2>
						<RequestStatusBadge :status="detailRequest.status" />
					</div>
					<button class="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" @click="detailRequest = null">
						<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
					</button>
				</div>

				<div class="flex-1 overflow-y-auto p-6 space-y-5">
					<!-- Field values -->
					<div class="space-y-3">
						<h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Nội dung</h3>
						<div class="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 space-y-3">
							<div v-for="(value, key) in detailRequest.fieldValues" :key="key">
								<p class="text-xs text-gray-500 dark:text-gray-400">{{ key }}</p>
								<p class="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{{ String(value ?? '—') }}</p>
							</div>
						</div>
					</div>

					<!-- Approval chain -->
					<div class="space-y-3">
						<h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Quy trình duyệt</h3>
						<ApproverChain
							:approvers="detailRequest.approvers"
							:current-approver-index="detailRequest.currentApproverIndex"
							:creator-name="detailRequest.employee.fullName"
						/>
					</div>
				</div>

				<div class="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
					<div class="flex gap-2">
						<template v-if="detailRequest.currentApprover?.employeeId === user?.id && detailRequest.status === 'PENDING'">
							<template v-if="!showApproveNote && !showRejectNote">
								<CommonAppButton variant="primary" @click="showApproveNote = true">Duyệt</CommonAppButton>
								<CommonAppButton variant="danger" @click="showRejectNote = true">Từ chối</CommonAppButton>
							</template>
							<template v-else-if="showApproveNote">
								<input v-model="approveNote" type="text" placeholder="Ghi chú (tùy chọn)" class="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors w-52" />
								<CommonAppButton variant="primary" :loading="actionLoading" @click="handleApprove(detailRequest)">Xác nhận duyệt</CommonAppButton>
								<CommonAppButton variant="secondary" @click="showApproveNote = false; approveNote = ''">Hủy</CommonAppButton>
							</template>
							<template v-else-if="showRejectNote">
								<input v-model="rejectNote" type="text" placeholder="Lý do từ chối *" class="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors w-52" />
								<CommonAppButton variant="danger" :loading="actionLoading" @click="handleReject(detailRequest)">Xác nhận từ chối</CommonAppButton>
								<CommonAppButton variant="secondary" @click="showRejectNote = false; rejectNote = ''">Hủy</CommonAppButton>
							</template>
						</template>
						<button v-if="detailRequest.canPrint" class="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors" @click="handlePrint(detailRequest)">
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.056 48.056 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" /></svg>
							In / Xuất PDF
						</button>
					</div>
					<CommonAppButton variant="secondary" @click="detailRequest = null">Đóng</CommonAppButton>
				</div>
			</div>
		</div>
	</Teleport>
</template>
