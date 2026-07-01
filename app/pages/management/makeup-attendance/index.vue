<script setup lang="ts">
	import { format } from 'date-fns';
	import { storeToRefs } from 'pinia';
	import { useMakeupAttendanceService } from '~/services/makeup-attendance.service';
	import MakeupStatusBadge from '~/components/modules/makeup-attendance/MakeupStatusBadge.vue';
	import MakeupDetailModal from '~/components/modules/makeup-attendance/MakeupDetailModal.vue';
	import MakeupRejectModal from '~/components/modules/makeup-attendance/MakeupRejectModal.vue';
	import type {
		MakeupRequestResponse,
		MakeupRequestStatus,
		QueryMakeupRequestParams,
	} from '~/types/makeup-attendance.types';
	import type { PaginatedMeta } from '~/types/api.types';
	import type { SelectOption } from '~/components/ui/Select.vue';
	import { MAKEUP_STATUS_OPTIONS } from '~/utils/makeup-attendance.utils';

	definePageMeta({ title: 'Quản lý bù công' });

	const toast = useToast();
	const { user } = useAuth();
	const service = useMakeupAttendanceService();
	const directoryStore = useDirectoryStore();
	const { departments } = storeToRefs(directoryStore);

	const canManage = computed(() => ['HR', 'ADMIN', 'MANAGER', 'CHIEF'].includes(user.value?.role ?? ''));
	const isManager = computed(() => user.value?.role === 'MANAGER');
	const canApprove = computed(() => ['ADMIN', 'MANAGER'].includes(user.value?.role ?? ''));
	// HR/Admin/Chief thấy filter phòng ban (xem toàn công ty). Manager bị ẩn — backend tự lock theo phòng ban.
	const showDepartmentFilter = computed(() => ['HR', 'ADMIN', 'CHIEF'].includes(user.value?.role ?? ''));

	// ─── Filters ──────────────────────────────────────────────────────────────
	const today = new Date();
	const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

	const filter = reactive({
		startDate: format(firstDayOfMonth, 'yyyy-MM-dd'),
		endDate: format(today, 'yyyy-MM-dd'),
		status: undefined as MakeupRequestStatus | undefined,
		departmentId: undefined as number | undefined,
		page: 1,
	});

	const searchQuery = ref('');

	const departmentOptions = computed<SelectOption[]>(() => [
		{ value: 0, label: 'Tất cả phòng ban' },
		...departments.value.map(d => ({ value: d.id, label: d.name })),
	]);

	const statusOptions = MAKEUP_STATUS_OPTIONS;

	// ─── Data ─────────────────────────────────────────────────────────────────
	const requests = ref<MakeupRequestResponse[]>([]);
	const loading = ref(false);
	const meta = ref<PaginatedMeta | null>(null);

	async function fetchRequests() {
		loading.value = true;
		try {
			const params: QueryMakeupRequestParams = {
				startDate: filter.startDate || undefined,
				endDate: filter.endDate || undefined,
				status: filter.status,
				departmentId: showDepartmentFilter.value ? filter.departmentId : undefined,
				page: filter.page,
				limit: 20,
			};
			const res = await service.findAll(params);
			requests.value = res.data;
			meta.value = res.meta;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi tải danh sách đơn bù công');
		} finally {
			loading.value = false;
		}
	}

	function applyFilter() {
		filter.page = 1;
		fetchRequests();
	}

	function goToPage(p: number) {
		filter.page = p;
		fetchRequests();
	}

	// ─── Client-side search (name / employeeCode, bỏ dấu + không phân biệt hoa/thường) ─
	function normalizeSearch(s: string) {
		return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
	}

	const displayedRequests = computed(() => {
		const q = normalizeSearch(searchQuery.value.trim());
		if (!q) return requests.value;
		return requests.value.filter(
			r => normalizeSearch(r.employee.fullName).includes(q) || normalizeSearch(r.employee.employeeCode).includes(q),
		);
	});

	// ─── Approve / Reject ─────────────────────────────────────────────────────
	const approvingId = ref<string | null>(null);
	const detailTarget = ref<MakeupRequestResponse | null>(null);
	const rejectTarget = ref<MakeupRequestResponse | null>(null);

	function replaceInList(updated: MakeupRequestResponse) {
		const idx = requests.value.findIndex(r => r.id === updated.id);
		if (idx !== -1) requests.value.splice(idx, 1, updated);
	}

	async function handleApprove(req: MakeupRequestResponse) {
		if (!confirm(`Duyệt đơn bù công của ${req.employee.fullName}?`)) return;
		approvingId.value = req.id;
		try {
			const updated = await service.approve(req.id);
			replaceInList(updated);
			if (detailTarget.value?.id === updated.id) detailTarget.value = updated;
			toast.success('Đã duyệt đơn bù công');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
		} finally {
			approvingId.value = null;
		}
	}

	function onRejected(updated: MakeupRequestResponse) {
		replaceInList(updated);
		if (detailTarget.value?.id === updated.id) detailTarget.value = updated;
		rejectTarget.value = null;
	}

	// ─── Helpers ──────────────────────────────────────────────────────────────
	function formatDate(d: string) {
		return format(new Date(d), 'dd/MM/yyyy');
	}

	function formatTime(iso: string | null) {
		if (!iso) return '—';
		return format(new Date(iso), 'HH:mm');
	}

	function truncate(text: string | null, len = 55) {
		if (!text) return '—';
		return text.length > len ? text.slice(0, len) + '…' : text;
	}

	// ─── Lifecycle ────────────────────────────────────────────────────────────
	onMounted(async () => {
		if (!canManage.value) {
			navigateTo('/makeup-attendance/my');
			return;
		}
		if (showDepartmentFilter.value) {
			directoryStore.load().catch(() => {
				// non-critical
			});
		}
		fetchRequests();
	});
</script>

<template>
	<div class="space-y-5">
		<!-- Header -->
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
			<div>
				<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Quản lý đơn bù công</h1>
				<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
					Xem xét và duyệt đơn bù công cho các bản ghi chấm công đã khoá
				</p>
			</div>
		</div>

		<!-- Filter bar -->
		<div class="flex flex-col sm:flex-row flex-wrap gap-3">
			<!-- Date range -->
			<div class="w-full sm:w-72">
				<UiDateRangePicker
					:from-date="filter.startDate"
					:to-date="filter.endDate"
					placeholder="Khoảng thời gian"
					@update:from-date="filter.startDate = $event"
					@update:to-date="filter.endDate = $event"
				/>
			</div>

			<!-- Status -->
			<div class="w-full sm:w-44">
				<UiSelect
					:model-value="filter.status"
					:options="statusOptions"
					placeholder="Tất cả trạng thái"
					@update:model-value="filter.status = $event as MakeupRequestStatus | undefined"
				/>
			</div>

			<!-- Department (HR/Admin/Chief only) -->
			<div v-if="showDepartmentFilter" class="w-full sm:w-52">
				<UiSelectInput
					:model-value="filter.departmentId ?? 0"
					:options="departmentOptions"
					placeholder="Tất cả phòng ban"
					@update:model-value="filter.departmentId = $event === 0 ? undefined : ($event as number)"
				/>
			</div>

			<!-- Search by name/code -->
			<div class="relative w-full sm:w-64">
				<svg
					class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z" />
				</svg>
				<input
					v-model="searchQuery"
					type="text"
					placeholder="Tìm theo tên hoặc mã NV..."
					class="w-full h-10 pl-9 pr-9 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:focus:ring-brand-800 focus:border-brand-500"
				/>
				<button
					v-if="searchQuery"
					type="button"
					class="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
					@click="searchQuery = ''"
				>
					<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<CommonAppButton class="h-10" :loading="loading" @click="applyFilter">
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z" />
				</svg>
				Áp dụng
			</CommonAppButton>
		</div>

		<!-- Manager scope hint -->
		<div
			v-if="isManager"
			class="flex items-start gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300"
		>
			<svg class="w-4 h-4 flex-shrink-0 mt-px" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			Bạn chỉ xem được đơn bù công của nhân viên trong phòng ban mình.
		</div>

		<!-- Table -->
		<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
								Nhân viên
							</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
								Ngày bù
							</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
								Giờ đề xuất
							</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
								Lý do
							</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
								Minh chứng
							</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
								Trạng thái
							</th>
							<th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
								Thao tác
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
						<tr v-if="loading">
							<td colspan="7" class="px-4 py-8 text-center">
								<svg class="animate-spin w-5 h-5 mx-auto text-brand-500" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
								</svg>
							</td>
						</tr>
						<tr v-else-if="displayedRequests.length === 0">
							<td colspan="7" class="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
								Không có đơn bù công nào
							</td>
						</tr>
						<tr
							v-for="req in displayedRequests"
							:key="req.id"
							class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
						>
							<td class="px-4 py-3">
								<p class="font-medium text-gray-900 dark:text-white">{{ req.employee.fullName }}</p>
								<p class="text-xs text-gray-400 dark:text-gray-500">{{ req.employee.employeeCode }}</p>
							</td>
							<td class="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
								{{ formatDate(req.attendanceDate) }}
							</td>
							<td class="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap font-mono text-xs">
								{{ formatTime(req.requestedCheckIn) }} → {{ formatTime(req.requestedCheckOut) }}
							</td>
							<td class="px-4 py-3 max-w-[220px]">
								<UiTooltip v-if="req.reason && req.reason.length > 55" :label="req.reason">
									<span class="text-gray-600 dark:text-gray-400 cursor-default">{{ truncate(req.reason) }}</span>
								</UiTooltip>
								<span v-else class="text-gray-600 dark:text-gray-400">{{ req.reason || '—' }}</span>
							</td>
							<td class="px-4 py-3">
								<a
									v-if="req.evidencePhotoUrl"
									:href="req.evidencePhotoUrl"
									target="_blank"
									rel="noopener noreferrer"
									class="inline-flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:underline"
								>
									<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
									</svg>
									Xem ảnh
								</a>
								<span v-else class="text-xs text-gray-400 dark:text-gray-500">—</span>
							</td>
							<td class="px-4 py-3">
								<MakeupStatusBadge :status="req.status" />
							</td>
							<td class="px-4 py-3">
								<div class="flex items-center justify-end gap-1.5">
									<button
										class="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/10 transition-colors"
										title="Xem chi tiết"
										@click="detailTarget = req"
									>
										<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
											/>
											<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
										</svg>
									</button>
									<template v-if="req.status === 'PENDING' && canApprove">
										<CommonAppButton
											size="sm"
											variant="primary"
											:loading="approvingId === req.id"
											@click="handleApprove(req)"
										>
											Duyệt
										</CommonAppButton>
										<CommonAppButton size="sm" variant="danger" @click="rejectTarget = req">Từ chối</CommonAppButton>
									</template>
								</div>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>

		<!-- Pagination -->
		<div v-if="meta && meta.totalPages > 1" class="flex items-center justify-between pt-1">
			<p class="text-sm text-gray-500 dark:text-gray-400">
				Tổng <strong class="text-gray-700 dark:text-gray-300">{{ meta.total }}</strong> đơn
			</p>
			<CommonAppPagination
				:current-page="filter.page"
				:total-pages="meta.totalPages"
				@update:current-page="goToPage"
			/>
		</div>
	</div>

	<!-- Modals -->
	<Teleport to="body">
		<MakeupDetailModal
			v-if="detailTarget"
			:request="detailTarget"
			:can-review="canApprove && detailTarget.status === 'PENDING'"
			:approving="approvingId === detailTarget.id"
			@approve="handleApprove(detailTarget)"
			@reject="rejectTarget = detailTarget"
			@close="detailTarget = null"
		/>
		<MakeupRejectModal
			v-if="rejectTarget"
			:request="rejectTarget"
			@rejected="onRejected"
			@close="rejectTarget = null"
		/>
	</Teleport>
</template>
