<script setup lang="ts">
import { format } from 'date-fns';
import { useGeneralRequestService } from '~/services/general-request.service';
import { useGeneralRequestStore } from '~/stores/generalRequest';
import RequestStatusBadge from '~/components/modules/general-request/RequestStatusBadge.vue';
import type { GeneralRequestResponse, GeneralRequestStatus } from '~/types/general-request.types';
import type { PaginatedMeta } from '~/types/api.types';
import { isManagementRole } from '~/utils/role';

definePageMeta({ title: 'Văn bản nội bộ' });

const toast = useToast();
const { user } = useAuth();
const service = useGeneralRequestService();
const { printRequest } = usePrint();
const generalRequestStore = useGeneralRequestStore();

const canManage = computed(() => isManagementRole(user.value?.role));
const isAdmin = computed(() => user.value?.role === 'ADMIN');
const canCancelRow = (req: GeneralRequestResponse) => req.canCancel || (isAdmin.value && req.status === 'PENDING');

type Tab = 'all' | 'pending' | 'approved' | 'cancelled' | 'pending-for-me';
const activeTab = ref<Tab>('all');

// ─── My requests ──────────────────────────────────────────────────────────────
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
			cancelled: 'CANCELLED',
			'pending-for-me': undefined,
		};
		const res = await service.findMe({
			page: myFilter.page,
			limit: 20,
			status: statusMap[activeTab.value] ?? (myFilter.status || undefined),
		});
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

async function handlePrint(req: GeneralRequestResponse) {
	try {
		await printRequest(req.id);
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Không thể in');
	}
}

function isMyTurnToApprove(req: GeneralRequestResponse) {
	return req.status === 'PENDING' && req.currentApprover?.employeeId === user.value?.id;
}

// ─── Inline quick approve ──────────────────────────────────────────────────
const approveLoadingId = ref<number | null>(null);

async function handleQuickApprove(req: GeneralRequestResponse) {
	approveLoadingId.value = req.id;
	try {
		await service.approve(req.id);
		toast.success('Đã duyệt');
		fetchMyRequests();
		if (canManage.value) fetchPendingForMe();
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
	} finally {
		approveLoadingId.value = null;
	}
}

// ─── Inline cancel dialog ─────────────────────────────────────────────────────
const cancelTarget = ref<GeneralRequestResponse | null>(null);
const cancelLoading = ref(false);

function openCancel(req: GeneralRequestResponse) {
	cancelTarget.value = req;
}

async function confirmCancel() {
	if (!cancelTarget.value) return;
	cancelLoading.value = true;
	try {
		await service.cancel(cancelTarget.value.id);
		toast.success('Đã thu hồi đơn');
		cancelTarget.value = null;
		fetchMyRequests();
		if (canManage.value) fetchPendingForMe();
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
	} finally {
		cancelLoading.value = false;
	}
}

// ─── Inline reject dialog ─────────────────────────────────────────────────────
const rejectTarget = ref<GeneralRequestResponse | null>(null);
const rejectNote = ref('');
const rejectLoading = ref(false);

function openReject(req: GeneralRequestResponse) {
	rejectTarget.value = req;
	rejectNote.value = '';
}

async function confirmReject() {
	if (!rejectTarget.value) return;
	if (!rejectNote.value.trim()) { toast.error('Vui lòng nhập lý do từ chối'); return; }
	rejectLoading.value = true;
	try {
		await service.reject(rejectTarget.value.id, { note: rejectNote.value });
		toast.success('Đã từ chối');
		rejectTarget.value = null;
		fetchPendingForMe();
		fetchMyRequests();
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
	} finally {
		rejectLoading.value = false;
	}
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
	{ key: 'cancelled', label: 'Đã thu hồi' },
	...(canManage.value ? [{ key: 'pending-for-me' as Tab, label: 'Chờ tôi duyệt' }] : []),
];

onMounted(() => {
	fetchMyRequests();
	if (canManage.value) fetchPendingForMe();
});

// Re-fetch khi nhận FCM general_request.*
watch(() => generalRequestStore.refreshSignal, () => {
	if (activeTab.value === 'pending-for-me') {
		fetchPendingForMe();
	} else {
		fetchMyRequests();
	}
	if (canManage.value && activeTab.value !== 'pending-for-me') fetchPendingForMe();
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

		<!-- My requests list -->
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
						<tr
							v-for="req in myRequests"
							:key="req.id"
							class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
							@click="navigateTo(`/general-requests/${req.id}`)"
						>
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
								<div class="flex items-center justify-end gap-1.5" @click.stop>
									<template v-if="isMyTurnToApprove(req)">
										<button
											class="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors border border-red-200 dark:border-red-800"
											@click="openReject(req)"
										>
											Từ chối
										</button>
										<button
											class="px-3 py-1.5 text-xs font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
											:disabled="approveLoadingId === req.id"
											@click="handleQuickApprove(req)"
										>
											<svg v-if="approveLoadingId === req.id" class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
												<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
												<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
											</svg>
											<span v-else>Duyệt</span>
										</button>
									</template>
									<button
										v-if="req.canPrint"
										class="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
										title="In / Xuất PDF"
										@click="handlePrint(req)"
									>
										<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.056 48.056 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" /></svg>
									</button>
									<button
										v-if="canCancelRow(req)"
										class="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
										@click="openCancel(req)"
									>
										Thu hồi
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
						<tr
							v-for="req in pendingForMe"
							:key="req.id"
							class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
							@click="navigateTo(`/general-requests/${req.id}`)"
						>
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
								<div class="flex items-center justify-end gap-1.5" @click.stop>
									<button
										class="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors border border-red-200 dark:border-red-800"
										@click="openReject(req)"
									>
										Từ chối
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

	<!-- Cancel dialog -->
	<Teleport to="body">
		<div v-if="cancelTarget" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" @click.self="cancelTarget = null">
			<div class="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md">
				<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">Thu hồi đơn</h2>
					<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">{{ cancelTarget.title }}</p>
				</div>
				<div class="p-6">
					<p class="text-sm text-gray-600 dark:text-gray-400">Xác nhận thu hồi đơn này? Toàn bộ người duyệt và HR sẽ nhận thông báo. Hành động này không thể hoàn tác.</p>
				</div>
				<div class="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
					<CommonAppButton variant="secondary" @click="cancelTarget = null">Hủy</CommonAppButton>
					<CommonAppButton variant="danger" :loading="cancelLoading" @click="confirmCancel">Xác nhận thu hồi</CommonAppButton>
				</div>
			</div>
		</div>
	</Teleport>

	<!-- Reject dialog -->
	<Teleport to="body">
		<div v-if="rejectTarget" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" @click.self="rejectTarget = null">
			<div class="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md">
				<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">Từ chối văn bản</h2>
					<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">{{ rejectTarget.title }}</p>
				</div>
				<div class="p-6 space-y-3">
					<label class="text-sm font-medium text-gray-700 dark:text-gray-300">
						Lý do từ chối <span class="text-red-500">*</span>
					</label>
					<textarea
						v-model="rejectNote"
						rows="3"
						placeholder="Nhập lý do từ chối..."
						class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
						autofocus
					/>
				</div>
				<div class="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
					<CommonAppButton variant="secondary" @click="rejectTarget = null">Hủy</CommonAppButton>
					<CommonAppButton variant="danger" :loading="rejectLoading" @click="confirmReject">Xác nhận từ chối</CommonAppButton>
				</div>
			</div>
		</div>
	</Teleport>
</template>
