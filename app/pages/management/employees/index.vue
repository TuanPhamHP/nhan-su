<script setup lang="ts">
	import type { EmployeeQueryParams, EmploymentType } from '~/types/employee.types';
	import EmployeeEmployeeStatusBadge from '~/components/modules/employee/EmployeeStatusBadge.vue';
	import EmploymentTypeBadge from '~/components/modules/employee/EmploymentTypeBadge.vue';
	import EmployeeImportModal from '~/components/modules/employee/EmployeeImportModal.vue';

	definePageMeta({ title: 'Nhân viên' });

	const toast = useToast();
	const router = useRouter();
	const route = useRoute();

	const { items, meta, loading, fetchList, deactivate } = useEmployee();
	const { departments, fetchAll: fetchDepartments } = useDepartment();
	const { hasPermission } = usePermissions();
	const canCreate = computed(() => hasPermission('employee:create'));
	const canUpdate = computed(() => hasPermission('employee:update'));
	const canDelete = computed(() => hasPermission('employee:delete'));
	const canImport = computed(() => hasPermission('employee:import'));
	const showImportModal = ref(false);
	const metaDataStore = useMetaDataStore();
	metaDataStore.load().catch(() => {
		/* metadata not critical */
	});
	const { employmentTypes } = storeToRefs(metaDataStore);

	const searchInput = ref(String(route.query.search || ''));
	const search = ref(searchInput.value);
	const departmentId = ref(route.query.departmentId ? Number(route.query.departmentId) : undefined);
	const employmentType = ref<EmploymentType | undefined>(
		(route.query.employmentType as EmploymentType | undefined) || undefined,
	);
	const page = ref(Number(route.query.page) || 1);

	const queryParams = computed<EmployeeQueryParams>(() => ({
		search: search.value || undefined,
		departmentId: departmentId.value,
		employmentType: employmentType.value,
		page: page.value,
		limit: 10,
	}));

	watch(queryParams, params => {
		router.replace({
			query: {
				...(params.search ? { search: params.search } : {}),
				...(params.departmentId ? { departmentId: String(params.departmentId) } : {}),
				...(params.employmentType ? { employmentType: params.employmentType } : {}),
				...(params.page && params.page > 1 ? { page: String(params.page) } : {}),
			},
		});
	});

	let searchTimer: ReturnType<typeof setTimeout>;
	function onSearchInput(val: string) {
		searchInput.value = val;
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			search.value = val;
			page.value = 1;
		}, 400);
	}

	const departmentOptions = computed(() => [
		{ value: 0, label: 'Tất cả phòng ban' },
		...departments.value.map(d => ({ value: d.id, label: d.name })),
	]);

	const employmentTypeOptions = computed(() => [
		{ value: '' as EmploymentType | '', label: 'Tất cả loại hình' },
		...employmentTypes.value.map(o => ({ value: o.value as EmploymentType | '', label: o.label })),
	]);

	function onDepartmentChange(val: string | number) {
		departmentId.value = val === 0 ? undefined : (val as number);
		page.value = 1;
	}

	function onEmploymentTypeChange(val: string | number | undefined) {
		employmentType.value = val ? (val as EmploymentType) : undefined;
		page.value = 1;
	}

	async function load() {
		try {
			await fetchList(queryParams.value);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi tải danh sách nhân viên');
		}
	}

	watch(queryParams, load, { immediate: true });

	onMounted(() => {
		fetchDepartments();
	});

	async function onImportSuccess() {
		showImportModal.value = false;
		page.value = 1;
		await load();
	}

	// Deactivate confirm modal
	const confirmId = ref<number | null>(null);
	const deactivating = ref(false);

	function openConfirm(id: number) {
		confirmId.value = id;
	}

	function closeConfirm() {
		confirmId.value = null;
	}

	async function confirmDeactivate() {
		if (!confirmId.value) return;
		// Defense-in-depth: modal không mở nếu thiếu quyền, nhưng vẫn re-check trước BE call.
		if (!canDelete.value) {
			toast.error('Bạn không có quyền vô hiệu hóa nhân viên');
			return;
		}
		deactivating.value = true;
		try {
			await deactivate(confirmId.value);
			toast.success('Đã vô hiệu hóa nhân viên');
			closeConfirm();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi vô hiệu hóa nhân viên');
		} finally {
			deactivating.value = false;
		}
	}

	import type { EmployeeSummary } from '~/types/employee.types';
	import type { DropdownMenuItem } from '~/components/ui/DropdownMenu.vue';

	function getActions(emp: EmployeeSummary): DropdownMenuItem[] {
		return [
			{
				label: 'Xem chi tiết',
				icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
				action: () => router.push(`/management/employees/${emp.id}`),
			},
			{
				label: 'Chỉnh sửa',
				icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
				action: () => router.push(`/management/employees/${emp.id}?edit=true`),
				hidden: !canUpdate.value,
			},
			{
				label: 'Vô hiệu hóa',
				icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636',
				variant: 'danger',
				action: () => openConfirm(emp.id),
				hidden: emp.status === 'INACTIVE' || !canDelete.value,
			},
		];
	}
</script>

<template>
	<div class="space-y-5">
		<!-- Header -->
		<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
			<div>
				<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Nhân viên</h1>
				<p v-if="meta" class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Tổng {{ meta.total }} nhân viên</p>
			</div>
			<div class="flex items-center gap-2">
				<CommonAppButton v-if="canImport" variant="primary" @click="showImportModal = true">
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
						/>
					</svg>
					Import Excel
				</CommonAppButton>
				<NuxtLink v-if="canCreate" to="/management/employees/new">
					<CommonAppButton>
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
						</svg>
						Thêm nhân viên
					</CommonAppButton>
				</NuxtLink>
			</div>
		</div>

		<!-- Filters -->
		<div class="flex flex-col sm:flex-row gap-3">
			<div class="flex-1">
				<CommonAppInput
					:model-value="searchInput"
					placeholder="Tìm theo tên, email, mã NV..."
					@update:model-value="onSearchInput"
				/>
			</div>
			<div class="min-w-[200px]">
				<UiSelectInput
					:model-value="departmentId ?? 0"
					:options="departmentOptions"
					placeholder="Tất cả phòng ban"
					@update:model-value="onDepartmentChange"
				/>
			</div>
			<div class="min-w-[200px]">
				<UiSelectInput
					:model-value="employmentType ?? ''"
					:options="employmentTypeOptions"
					placeholder="Tất cả loại hình"
					@update:model-value="onEmploymentTypeChange"
				/>
			</div>
		</div>

		<!-- Table card -->
		<div
			class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
		>
			<!-- Loading skeleton -->
			<div v-if="loading" class="divide-y divide-gray-100 dark:divide-gray-800">
				<div v-for="i in 6" :key="i" class="flex items-center gap-4 px-6 py-4">
					<div class="h-3.5 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
					<div class="flex flex-col gap-1.5 flex-1">
						<div class="h-3.5 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
						<div class="h-3 w-48 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
					</div>
					<div class="h-3.5 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
					<div class="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
					<div class="flex gap-2 ml-auto">
						<div class="h-7 w-16 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
						<div class="h-7 w-12 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
					</div>
				</div>
			</div>

			<!-- Empty state -->
			<div v-else-if="!items.length" class="flex flex-col items-center justify-center py-16 text-center">
				<div class="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
					<svg class="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
						/>
					</svg>
				</div>
				<p class="text-sm font-medium text-gray-600 dark:text-gray-300">Không có nhân viên nào</p>
				<p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Thử thay đổi bộ lọc hoặc thêm nhân viên mới</p>
			</div>

			<!-- Table -->
			<div v-else class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
							<th
								class="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
							>
								Mã NV
							</th>
							<th
								class="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
							>
								Họ tên
							</th>
							<th
								class="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
							>
								Phòng ban
							</th>
							<th
								class="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
							>
								Vị trí
							</th>
							<th
								class="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
							>
								Loại hình
							</th>
							<th
								class="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
							>
								Trạng thái
							</th>
							<th
								class="text-right px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
							>
								Hành động
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100 dark:divide-gray-700/50">
						<tr v-for="emp in items" :key="emp.id" class="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
							<td
								class="px-6 py-4 font-mono text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap cursor-pointer hover:underline"
								@click="router.push(`/management/employees/${emp.id}`)"
							>
								{{ emp.employeeCode }}
							</td>
							<td class="px-6 py-4">
								<div class="font-medium text-gray-900 dark:text-white">{{ emp.fullName }}</div>
								<div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ emp.email }}</div>
							</td>
							<td class="px-6 py-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
								{{ emp.department?.name ?? '—' }}
							</td>
							<td class="px-6 py-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
								{{ emp.position?.name ?? '—' }}
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<EmploymentTypeBadge v-if="emp.employmentType" :type="emp.employmentType" />
								<span v-else class="text-xs text-gray-400">—</span>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<EmployeeEmployeeStatusBadge :status="emp.status" />
							</td>
							<td class="px-6 py-4 text-right">
								<UiDropdownMenu :items="getActions(emp)" />
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>

		<!-- Pagination -->
		<div v-if="meta && meta.totalPages > 1" class="flex items-center justify-between">
			<p class="text-sm text-gray-500 dark:text-gray-400">
				Trang {{ meta.page }} / {{ meta.totalPages }} &middot; {{ meta.total }} kết quả
			</p>
			<CommonAppPagination :current-page="page" :total-pages="meta.totalPages" @update:current-page="p => (page = p)" />
		</div>

		<!-- Confirm deactivate modal -->
		<Teleport to="body">
			<Transition
				enter-active-class="transition ease-out duration-150"
				enter-from-class="opacity-0"
				enter-to-class="opacity-100"
				leave-active-class="transition ease-in duration-100"
				leave-from-class="opacity-100"
				leave-to-class="opacity-0"
			>
				<div
					v-if="confirmId"
					class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
					@click.self="closeConfirm"
				>
					<div
						class="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl border border-gray-200 dark:border-gray-700"
					>
						<div class="flex items-start gap-4">
							<div
								class="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0"
							>
								<svg
									class="w-5 h-5 text-red-600 dark:text-red-400"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
									/>
								</svg>
							</div>
							<div>
								<h3 class="font-semibold text-gray-900 dark:text-white">Vô hiệu hóa nhân viên</h3>
								<p class="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
									Nhân viên sẽ không thể đăng nhập hệ thống. Bạn có thể kích hoạt lại bất kỳ lúc nào.
								</p>
							</div>
						</div>
						<div class="flex justify-end gap-3 mt-6">
							<CommonAppButton variant="outline" @click="closeConfirm">Hủy</CommonAppButton>
							<CommonAppButton variant="danger" :loading="deactivating" @click="confirmDeactivate">
								Xác nhận vô hiệu hóa
							</CommonAppButton>
						</div>
					</div>
				</div>
			</Transition>
		</Teleport>

		<!-- Import Excel modal -->
		<EmployeeImportModal v-if="showImportModal" @close="showImportModal = false" @imported="onImportSuccess" />
	</div>
</template>
