<script setup lang="ts">
	import { useLeaveRequests } from '~/composables/useLeaveRequests';
	import { useLeaveTypeService } from '~/services/leave-type.service';
	import type { LeaveType, LeaveStatus, QueryLeaveRequestParams } from '~/types/leave.types';
	import { formatDate } from '~/utils/date';

	definePageMeta({ title: 'Đơn nghỉ phép của tôi' });

	const toast = useToast();
	const leaveTypeService = useLeaveTypeService();
	const { requests, loading, meta, fetchMyRequests, cancelRequest, removeRequest } = useLeaveRequests();

	// ─── Filters ──────────────────────────────────────────────────────────────────
	const filterStatus = ref<LeaveStatus | ''>('');
	const filterLeaveTypeId = ref<number | ''>('');
	const currentPage = ref(1);

	// ─── Leave types for filter dropdown ──────────────────────────────────────────
	const leaveTypes = ref<LeaveType[]>([]);
	async function loadLeaveTypes() {
		try {
			leaveTypes.value = await leaveTypeService.findAll();
		} catch {
			// non-critical
		}
	}

	// ─── Load requests ─────────────────────────────────────────────────────────────
	async function load() {
		const params: QueryLeaveRequestParams = { page: currentPage.value, limit: 20 };
		if (filterStatus.value) params.status = filterStatus.value;
		if (filterLeaveTypeId.value) params.leaveTypeId = filterLeaveTypeId.value as number;
		await fetchMyRequests(params);
	}

	watch([filterStatus, filterLeaveTypeId], () => {
		currentPage.value = 1;
		load();
	});
	watch(currentPage, load);

	// ─── Action menu per card ──────────────────────────────────────────────────────
	const activeMenuId = ref<number | null>(null);
	const confirmDeleteId = ref<number | null>(null);

	function toggleMenu(id: number) {
		activeMenuId.value = activeMenuId.value === id ? null : id;
		confirmDeleteId.value = null;
	}

	function closeMenu() {
		activeMenuId.value = null;
		confirmDeleteId.value = null;
	}

	// Click outside to close menu
	function onDocumentClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('[data-menu-anchor]')) closeMenu();
	}

	// ─── Cancel (Thu hồi) ──────────────────────────────────────────────────────────
	const cancellingId = ref<number | null>(null);
	async function handleCancel(id: number) {
		closeMenu();
		cancellingId.value = id;
		try {
			await cancelRequest(id);
			toast.success('Đã thu hồi đơn thành công');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Không thể thu hồi đơn');
		} finally {
			cancellingId.value = null;
		}
	}

	// ─── Remove (Xóa hẳn) ─────────────────────────────────────────────────────────
	const removingId = ref<number | null>(null);
	async function handleRemove(id: number) {
		closeMenu();
		removingId.value = id;
		try {
			await removeRequest(id);
			toast.success('Đã xóa đơn');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Không thể xóa đơn');
		} finally {
			removingId.value = null;
		}
	}

	// ─── Status helpers ────────────────────────────────────────────────────────────
	const STATUS_LABEL: Record<LeaveStatus, string> = {
		PENDING: 'Chờ duyệt',
		APPROVED: 'Đã duyệt',
		REJECTED: 'Từ chối',
		CANCELLED: 'Đã thu hồi',
	};

	const STATUS_CLASS: Record<LeaveStatus, string> = {
		PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
		APPROVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
		REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
		CANCELLED: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
	};

	// ─── Date / detail summary per leave type ─────────────────────────────────────
	function getDateSummary(r: (typeof requests.value)[0]) {
		const code = r.leaveType.code;
		const start = formatDate(r.startDate);
		const end = formatDate(r.endDate);

		if (code === 'HALF_DAY') {
			return { start, end: start, extra: r.halfDayPeriod === 'MORNING' ? 'Buổi sáng' : 'Buổi chiều' };
		}
		if (code === 'LATE') {
			return { start, end: start, extra: `Đi muộn ${r.lateMinutes} phút` };
		}
		if (code === 'EARLY') {
			return { start, end: start, extra: `Về sớm ${r.earlyMinutes} phút` };
		}
		return { start, end, extra: null };
	}

	// ─── Lifecycle ─────────────────────────────────────────────────────────────────
	onMounted(() => {
		document.addEventListener('click', onDocumentClick);
		loadLeaveTypes();
		load();
	});

	onUnmounted(() => {
		document.removeEventListener('click', onDocumentClick);
	});
</script>

<template>
	<div class="space-y-4">
		<!-- Header -->
		<div class="flex items-center justify-between gap-3">
			<div>
				<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Xin nghỉ phép</h1>
				<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Danh sách đơn của bạn</p>
			</div>
			<NuxtLink
				to="/users/leave-requests/create"
				class="hidden sm:inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 dark:bg-brand-500 dark:hover:bg-brand-600 flex-shrink-0"
			>
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
				</svg>
				Tạo đơn
			</NuxtLink>
		</div>

		<!-- Filters -->
		<div class="flex flex-wrap gap-3">
			<select
				v-model="filterLeaveTypeId"
				class="flex-1 min-w-[140px] max-w-xs px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 appearance-none"
			>
				<option value="">Loại đơn</option>
				<option v-for="lt in leaveTypes" :key="lt.id" :value="lt.id">{{ lt.name }}</option>
			</select>

			<select
				v-model="filterStatus"
				class="flex-1 min-w-[140px] max-w-xs px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 appearance-none"
			>
				<option value="">Tất cả trạng thái</option>
				<option value="PENDING">Chờ duyệt</option>
				<option value="APPROVED">Đã duyệt</option>
				<option value="REJECTED">Từ chối</option>
				<option value="CANCELLED">Đã thu hồi</option>
			</select>
		</div>

		<!-- Loading skeleton -->
		<div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
			<div
				v-for="i in 8"
				:key="i"
				class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse"
			>
				<div class="flex items-center justify-between mb-3">
					<div class="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
					<div class="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
				</div>
				<div class="grid grid-cols-2 gap-4 mb-3">
					<div class="h-3 bg-gray-100 dark:bg-gray-800 rounded" />
					<div class="h-3 bg-gray-100 dark:bg-gray-800 rounded" />
				</div>
				<div class="h-3 w-3/4 bg-gray-100 dark:bg-gray-800 rounded" />
			</div>
		</div>

		<!-- Empty state -->
		<div v-else-if="requests.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
			<div class="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
				<svg class="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
					/>
				</svg>
			</div>
			<p class="text-sm font-medium text-gray-700 dark:text-gray-300">Chưa có đơn nào</p>
			<p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Nhấn "+ Tạo đơn" để gửi đơn nghỉ phép đầu tiên</p>
		</div>

		<!-- Card list -->
		<div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
			<div
				v-for="r in requests"
				:key="r.id"
				class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 transition-opacity flex flex-col"
				:class="{ 'opacity-60': cancellingId === r.id || removingId === r.id }"
			>
				<!-- Card header -->
				<div class="flex items-start justify-between gap-2 mb-3">
					<div class="flex items-center gap-2 flex-wrap">
						<span class="text-sm font-semibold text-gray-900 dark:text-white">{{ r.leaveType.name }}</span>
						<span
							class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
							:class="STATUS_CLASS[r.status]"
						>
							{{ STATUS_LABEL[r.status] }}
						</span>
					</div>

					<!-- "..." action button -->
					<div v-if="r.canBeRevoked || r.canBeRemoved" class="relative flex-shrink-0" data-menu-anchor>
						<button
							type="button"
							class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
							:disabled="cancellingId === r.id || removingId === r.id"
							@click.stop="toggleMenu(r.id)"
						>
							<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
								<circle cx="5" cy="12" r="1.5" />
								<circle cx="12" cy="12" r="1.5" />
								<circle cx="19" cy="12" r="1.5" />
							</svg>
						</button>

						<!-- Dropdown menu -->
						<div
							v-if="activeMenuId === r.id"
							class="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg z-10 overflow-hidden"
							@click.stop
						>
							<!-- Xóa -->
							<template v-if="r.canBeRemoved">
								<div v-if="confirmDeleteId === r.id" class="p-3">
									<p class="text-xs text-gray-600 dark:text-gray-400 mb-2">Xác nhận xóa đơn này?</p>
									<div class="flex gap-2">
										<button
											type="button"
											class="flex-1 py-1 text-xs rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 transition-colors"
											@click="handleRemove(r.id)"
										>
											Xóa
										</button>
										<button
											type="button"
											class="flex-1 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
											@click="confirmDeleteId = null"
										>
											Hủy
										</button>
									</div>
								</div>
								<button
									v-else
									type="button"
									class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
									@click="confirmDeleteId = r.id"
								>
									<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
										/>
									</svg>
									Xóa đơn
								</button>
							</template>

							<!-- Thu hồi -->
							<button
								v-if="r.canBeRevoked"
								type="button"
								class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
								:class="
									r.canBeRemoved && confirmDeleteId !== r.id ? 'border-t border-gray-100 dark:border-gray-700' : ''
								"
								@click="handleCancel(r.id)"
							>
								<svg
									class="w-4 h-4 text-gray-400"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path stroke-linecap="round" stroke-linejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
								</svg>
								Thu hồi
							</button>
						</div>
					</div>
				</div>

				<!-- Date info -->
				<div class="grid grid-cols-2 gap-x-4 gap-y-1 mb-3">
					<div>
						<p class="text-xs text-gray-400 dark:text-gray-500">Bắt đầu</p>
						<p class="text-sm font-medium text-gray-800 dark:text-gray-200">{{ getDateSummary(r).start }}</p>
					</div>
					<div>
						<p class="text-xs text-gray-400 dark:text-gray-500">Kết thúc</p>
						<p class="text-sm font-medium text-gray-800 dark:text-gray-200">{{ getDateSummary(r).end }}</p>
					</div>
					<div v-if="getDateSummary(r).extra" class="col-span-2 mt-0.5">
						<span
							class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
						>
							{{ getDateSummary(r).extra }}
						</span>
					</div>
				</div>

				<!-- Reason -->
				<div v-if="r.reason" class="pt-2.5 border-t border-gray-100 dark:border-gray-800">
					<p class="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Lý do</p>
					<p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{{ r.reason }}</p>
				</div>

				<!-- Reject note -->
				<div
					v-if="r.status === 'REJECTED' && r.rejectNote"
					class="mt-2.5 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30"
				>
					<p class="text-xs text-red-500 dark:text-red-400 font-medium mb-0.5">Lý do từ chối</p>
					<p class="text-xs text-red-600 dark:text-red-400">{{ r.rejectNote }}</p>
				</div>

				<!-- Approver info (for PENDING) -->
				<div
					v-if="r.status === 'PENDING' && r.assignedApprover"
					class="mt-2.5 flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500"
				>
					<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
						/>
					</svg>
					Chờ {{ r.assignedApprover.fullName }} duyệt
				</div>

				<!-- Spinner overlay when actioning -->
				<div
					v-if="cancellingId === r.id || removingId === r.id"
					class="mt-2 flex items-center gap-1.5 text-xs text-gray-400"
				>
					<svg class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
					</svg>
					{{ cancellingId === r.id ? 'Đang thu hồi…' : 'Đang xóa…' }}
				</div>
			</div>
		</div>

		<!-- Pagination -->
		<div v-if="meta && meta.totalPages > 1" class="flex justify-center pt-2">
			<CommonAppPagination
				:current-page="currentPage"
				:total-pages="meta.totalPages"
				@update:current-page="currentPage = $event"
			/>
		</div>

	</div>

	<!-- FAB Tạo đơn — chỉ hiện trên mobile -->
	<Teleport to="body">
		<NuxtLink
			to="/users/leave-requests/create"
			class="sm:hidden fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-brand-600 hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600 text-white flex items-center justify-center shadow-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500"
			aria-label="Tạo đơn nghỉ phép"
		>
			<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
			</svg>
		</NuxtLink>
	</Teleport>
</template>
