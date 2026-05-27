<script setup lang="ts">
	import { formatDateTime } from '~/utils/date';
	import { useLogService } from '~/services/log.service';
	import LogDetailModal from '~/components/modules/log/LogDetailModal.vue';
	import type { SystemLog, LogStatus, LogActorType, QueryLogParams } from '~/types/log.types';
	import type { PaginatedMeta } from '~/types/api.types';
	import type { SelectOption } from '~/components/ui/Select.vue';

	definePageMeta({
		title: 'Nhật ký hệ thống',
		middleware: [
			function () {
				const auth = useAuthStore();
				if (auth.user?.role !== 'ADMIN') return navigateTo('/');
			},
		],
	});

	const toast = useToast();
	const logService = useLogService();

	// ─── State ────────────────────────────────────────────────────────────────────
	const logs = ref<SystemLog[]>([]);
	const loading = ref(false);
	const meta = ref<PaginatedMeta | null>(null);
	const detailLog = ref<SystemLog | null>(null);

	// ─── Filter ───────────────────────────────────────────────────────────────────
	const filter = reactive({
		action: undefined as string | undefined,
		actorType: undefined as LogActorType | undefined,
		targetType: undefined as string | undefined,
		status: undefined as LogStatus | undefined,
		actorId: undefined as number | undefined,
		dateFrom: '',
		dateTo: '',
		page: 1,
		limit: 20,
	});

	const actorIdInput = ref('');

	// ─── Select options ───────────────────────────────────────────────────────────
	const actionOptions: SelectOption[] = [
		{ value: undefined, label: 'Tất cả hành động' },
		{ value: 'auth.login', label: 'auth.login — Đăng nhập' },
		{ value: 'auth.logout', label: 'auth.logout — Đăng xuất' },
		{ value: 'auth.change_password', label: 'auth.change_password — Đổi mật khẩu' },
		{ value: 'employee.create', label: 'employee.create — Tạo NV' },
		{ value: 'employee.update', label: 'employee.update — Cập nhật NV' },
		{ value: 'employee.deactivate', label: 'employee.deactivate — Vô hiệu hóa NV' },
		{ value: 'department.create', label: 'department.create — Tạo phòng ban' },
		{ value: 'department.update', label: 'department.update — Cập nhật phòng ban' },
		{ value: 'department.deactivate', label: 'department.deactivate — Vô hiệu hóa PB' },
		{ value: 'position.create', label: 'position.create — Tạo chức vụ' },
		{ value: 'position.update', label: 'position.update — Cập nhật chức vụ' },
		{ value: 'position.deactivate', label: 'position.deactivate — Vô hiệu hóa CV' },
		{ value: 'role.create', label: 'role.create — Tạo vai trò' },
		{ value: 'role.update', label: 'role.update — Cập nhật vai trò' },
		{ value: 'role.delete', label: 'role.delete — Xóa vai trò' },
		{ value: 'role.assign_permissions', label: 'role.assign_permissions — Gán quyền' },
		{ value: 'role.add_employees', label: 'role.add_employees — Thêm NV vào vai trò' },
		{ value: 'role.remove_employee', label: 'role.remove_employee — Xóa NV khỏi vai trò' },
	];

	const actorTypeOptions: SelectOption[] = [
		{ value: undefined, label: 'Tất cả loại tác nhân' },
		{ value: 'USER', label: 'USER — Người dùng' },
		{ value: 'SYSTEM', label: 'SYSTEM — Hệ thống' },
	];

	const targetTypeOptions: SelectOption[] = [
		{ value: undefined, label: 'Tất cả đối tượng' },
		{ value: 'employee', label: 'Nhân viên' },
		{ value: 'department', label: 'Phòng ban' },
		{ value: 'position', label: 'Chức vụ' },
		{ value: 'role', label: 'Vai trò' },
	];

	const statusOptions: SelectOption[] = [
		{ value: undefined, label: 'Tất cả trạng thái' },
		{ value: 'SUCCESS', label: 'Thành công' },
		{ value: 'FAILURE', label: 'Thất bại' },
	];

	// ─── Fetch ────────────────────────────────────────────────────────────────────
	async function fetchLogs() {
		loading.value = true;
		try {
			const actorIdNum = actorIdInput.value ? Number(actorIdInput.value) : undefined;
			const params: QueryLogParams = {
				action: filter.action,
				actorType: filter.actorType,
				targetType: filter.targetType,
				status: filter.status,
				actorId: actorIdNum && !isNaN(actorIdNum) ? actorIdNum : undefined,
				dateFrom: filter.dateFrom || undefined,
				dateTo: filter.dateTo || undefined,
				page: filter.page,
				limit: filter.limit,
			};
			const res = await logService.findAll(params);
			logs.value = res.data;
			meta.value = res.meta;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi tải nhật ký');
		} finally {
			loading.value = false;
		}
	}

	function applyFilter() {
		filter.page = 1;
		fetchLogs();
	}

	function resetFilter() {
		filter.action = undefined;
		filter.actorType = undefined;
		filter.targetType = undefined;
		filter.status = undefined;
		filter.dateFrom = '';
		filter.dateTo = '';
		actorIdInput.value = '';
		filter.page = 1;
		fetchLogs();
	}

	// ─── Helpers ──────────────────────────────────────────────────────────────────
	const actionColorMap: Record<string, string> = {
		auth: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
		employee: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
		department: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
		position: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
		role: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
	};

	function actionBadgeClass(action: string): string {
		const prefix = action.split('.')[0];
		return actionColorMap[prefix] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
	}

	function truncateAction(action: string, max = 30): string {
		return action.length > max ? action.slice(0, max) + '…' : action;
	}

	const targetTypeLabel: Record<string, string> = {
		employee: 'Nhân viên',
		department: 'Phòng ban',
		position: 'Chức vụ',
		role: 'Vai trò',
	};

	const activeFilterCount = computed(() => {
		let n = 0;
		if (filter.action) n++;
		if (filter.actorType) n++;
		if (filter.targetType) n++;
		if (filter.status) n++;
		if (actorIdInput.value) n++;
		if (filter.dateFrom || filter.dateTo) n++;
		return n;
	});

	// ─── Lifecycle ────────────────────────────────────────────────────────────────
	onMounted(() => {
		fetchLogs();
	});
</script>

<template>
	<div class="space-y-5">
		<!-- Page header -->
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Nhật ký hệ thống</h1>
				<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
					Lịch sử toàn bộ hành vi mutation trong hệ thống
				</p>
			</div>
			<div
				v-if="meta"
				class="text-sm text-gray-500 dark:text-gray-400"
			>
				Tổng <strong class="text-gray-700 dark:text-gray-200">{{ meta.total }}</strong> bản ghi
			</div>
		</div>

		<!-- Filter panel -->
		<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
			<div class="flex items-center justify-between">
				<p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
					Bộ lọc
					<span
						v-if="activeFilterCount > 0"
						class="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 text-[10px] font-bold"
					>
						{{ activeFilterCount }}
					</span>
				</p>
				<button
					v-if="activeFilterCount > 0"
					class="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 underline transition-colors"
					@click="resetFilter"
				>
					Xóa bộ lọc
				</button>
			</div>

			<!-- Row 1: action, actorType, targetType, status -->
			<div class="flex flex-col sm:flex-row flex-wrap gap-3">
				<div class="w-full sm:w-72">
					<UiSelect
						:model-value="filter.action"
						:options="actionOptions"
						placeholder="Tất cả hành động"
						@update:model-value="filter.action = $event as string | undefined"
					/>
				</div>
				<div class="w-full sm:w-52">
					<UiSelect
						:model-value="filter.actorType"
						:options="actorTypeOptions"
						placeholder="Tất cả tác nhân"
						@update:model-value="filter.actorType = $event as LogActorType | undefined"
					/>
				</div>
				<div class="w-full sm:w-44">
					<UiSelect
						:model-value="filter.targetType"
						:options="targetTypeOptions"
						placeholder="Tất cả đối tượng"
						@update:model-value="filter.targetType = $event as string | undefined"
					/>
				</div>
				<div class="w-full sm:w-40">
					<UiSelect
						:model-value="filter.status"
						:options="statusOptions"
						placeholder="Tất cả trạng thái"
						@update:model-value="filter.status = $event as LogStatus | undefined"
					/>
				</div>
			</div>

			<!-- Row 2: date range + actorId -->
			<div class="flex flex-col sm:flex-row flex-wrap gap-3 items-end">
				<div class="w-full sm:w-72">
					<UiDateRangePicker
						:from-date="filter.dateFrom"
						:to-date="filter.dateTo"
						placeholder="Khoảng ngày"
						@update:from-date="filter.dateFrom = $event"
						@update:to-date="filter.dateTo = $event"
					/>
				</div>
				<div class="w-full sm:w-44">
					<input
						v-model="actorIdInput"
						type="number"
						min="1"
						placeholder="Actor ID (số)"
						class="w-full h-9 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition"
					/>
				</div>
				<div class="flex gap-2">
					<CommonAppButton :loading="loading" @click="applyFilter">
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
							/>
						</svg>
						Tìm kiếm
					</CommonAppButton>
				</div>
			</div>
		</div>

		<!-- Table -->
		<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-10">
								#
							</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">
								Thời gian
							</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
								Tác nhân
							</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
								Hành động
							</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
								Đối tượng
							</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
								Trạng thái
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
						<!-- Loading -->
						<tr v-if="loading">
							<td colspan="6" class="px-4 py-10 text-center">
								<svg class="animate-spin w-5 h-5 mx-auto text-brand-500" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
								</svg>
							</td>
						</tr>

						<!-- Empty -->
						<tr v-else-if="logs.length === 0">
							<td colspan="6" class="px-4 py-12 text-center">
								<div class="flex flex-col items-center gap-2">
									<svg class="w-8 h-8 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
										<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
									</svg>
									<p class="text-sm text-gray-400 dark:text-gray-500">Không có bản ghi nào</p>
								</div>
							</td>
						</tr>

						<!-- Rows -->
						<tr
							v-for="log in logs"
							:key="log.id"
							class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
							@click="detailLog = log"
						>
							<!-- ID -->
							<td class="px-4 py-3 text-xs font-mono text-gray-400 dark:text-gray-500">
								{{ log.id }}
							</td>

							<!-- Thời gian -->
							<td class="px-4 py-3 whitespace-nowrap">
								<span class="text-xs text-gray-600 dark:text-gray-400 font-mono">
									{{ formatDateTime(log.createdAt) }}
								</span>
							</td>

							<!-- Tác nhân -->
							<td class="px-4 py-3 max-w-[180px]">
								<div class="flex items-center gap-2 min-w-0">
									<div
										:class="[
											'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-semibold',
											log.actor.type === 'USER'
												? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
												: 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
										]"
									>
										{{ log.actor.type === 'USER' ? (log.actor.name?.charAt(0)?.toUpperCase() ?? '?') : 'S' }}
									</div>
									<div class="min-w-0">
										<p class="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[130px]">
											{{ log.actor.name ?? 'Hệ thống' }}
										</p>
										<p
											v-if="log.actor.email"
											class="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[130px]"
										>
											{{ log.actor.email }}
										</p>
									</div>
								</div>
							</td>

							<!-- Hành động -->
							<td class="px-4 py-3">
								<span
									:class="['inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium', actionBadgeClass(log.action)]"
									:title="log.action"
								>
									{{ truncateAction(log.action) }}
								</span>
							</td>

							<!-- Đối tượng -->
							<td class="px-4 py-3 whitespace-nowrap">
								<template v-if="log.targetType">
									<span class="text-sm text-gray-600 dark:text-gray-400">
										{{ targetTypeLabel[log.targetType] ?? log.targetType }}
									</span>
									<span
										v-if="log.targetId"
										class="ml-1 text-xs text-gray-400 dark:text-gray-500 font-mono"
									>
										#{{ log.targetId }}
									</span>
								</template>
								<span v-else class="text-gray-300 dark:text-gray-600">—</span>
							</td>

							<!-- Trạng thái -->
							<td class="px-4 py-3">
								<span
									:class="[
										'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
										log.status === 'SUCCESS'
											? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
											: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
									]"
								>
									<span
										:class="['w-1.5 h-1.5 rounded-full', log.status === 'SUCCESS' ? 'bg-green-500' : 'bg-red-500']"
									/>
									{{ log.status === 'SUCCESS' ? 'OK' : 'LỖI' }}
								</span>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>

		<!-- Pagination -->
		<div v-if="meta && meta.totalPages > 1" class="flex items-center justify-between pt-1">
			<p class="text-sm text-gray-500 dark:text-gray-400">
				Trang <strong class="text-gray-700 dark:text-gray-300">{{ meta.page }}</strong> /
				{{ meta.totalPages }} — tổng
				<strong class="text-gray-700 dark:text-gray-300">{{ meta.total }}</strong> bản ghi
			</p>
			<CommonAppPagination
				:current-page="filter.page"
				:total-pages="meta.totalPages"
				@update:current-page="
					p => {
						filter.page = p;
						fetchLogs();
					}
				"
			/>
		</div>
	</div>

	<!-- Detail modal -->
	<Teleport to="body">
		<LogDetailModal v-if="detailLog" :log="detailLog" @close="detailLog = null" />
	</Teleport>
</template>
