<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { formatDate, formatDateTime } from '~/utils/date';
	import type { DropdownMenuItem } from '~/components/ui/DropdownMenu.vue';
	import type { EmployeeSummary } from '~/types/employee.types';
	import EmployeeStatusBadge from '~/components/modules/employee/EmployeeStatusBadge.vue';
	import { useEmployeeService, usePositionService } from '~/services';
	import type { PositionSummary } from '~/types/position.types';

	definePageMeta({ title: 'Chi tiết phòng ban' });

	const route = useRoute();
	const toast = useToast();
	const id = Number(route.params.id);
	const directoryStore = useDirectoryStore();

	const {
		department,
		loadingDept,
		members,
		loadingMembers,
		loadDept,
		loadMembers,
		updateDept,
		assignMember,
		removeMember,
		deactivateMember,
		activateMember,
		changeManager,
	} = useDepartmentDetail(id);

	// ─── Edit dept form ───────────────────────────────────────────────────────────

	const isEditing = ref(route.query.edit === 'true');

	const { handleSubmit, defineField, errors, isSubmitting, resetForm } = useForm<{ name: string }>({
		validationSchema: {
			name: (v: string) => (v && v.trim().length >= 2 ? true : 'Tối thiểu 2 ký tự'),
		},
	});
	const [deptName, deptNameAttrs] = defineField('name');

	function startEditing() {
		resetForm({ values: { name: department.value?.name ?? '' } });
		isEditing.value = true;
	}

	function cancelEditing() {
		isEditing.value = false;
	}

	const onSubmit = handleSubmit(async values => {
		try {
			await updateDept({ name: values.name.trim() });
			directoryStore.reset();
			toast.success('Đã cập nhật tên phòng ban');
			isEditing.value = false;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi cập nhật phòng ban');
		}
	});

	// ─── Add member modal ────────────────────────────────────────────────────────

	const showAddModal = ref(false);
	const addSearch = ref('');
	const availableEmployees = ref<EmployeeSummary[]>([]);
	const loadingAvailable = ref(false);
	const addingId = ref<number | null>(null);

	const empService = useEmployeeService();

	async function fetchAvailable() {
		loadingAvailable.value = true;
		try {
			const res = await empService.findAll({ search: addSearch.value || undefined, limit: 30 });
			const memberIds = new Set(members.value.map(m => m.id));
			availableEmployees.value = res.data.filter(e => !memberIds.has(e.id));
		} finally {
			loadingAvailable.value = false;
		}
	}

	let addSearchTimer: ReturnType<typeof setTimeout>;
	function onAddSearchInput(val: string) {
		addSearch.value = val;
		clearTimeout(addSearchTimer);
		addSearchTimer = setTimeout(fetchAvailable, 400);
	}

	function openAddModal() {
		addSearch.value = '';
		availableEmployees.value = [];
		showAddModal.value = true;
		fetchAvailable();
	}

	function closeAddModal() {
		showAddModal.value = false;
	}

	async function handleAddMember(emp: EmployeeSummary) {
		addingId.value = emp.id;
		try {
			await assignMember(emp.id);
			directoryStore.reset();
			availableEmployees.value = availableEmployees.value.filter(e => e.id !== emp.id);
			toast.success(`Đã thêm ${emp.fullName} vào phòng ban`);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi thêm nhân viên');
		} finally {
			addingId.value = null;
		}
	}

	// ─── Remove member confirm ────────────────────────────────────────────────────

	const confirmRemove = ref<EmployeeSummary | null>(null);
	const removing = ref(false);

	async function handleRemove() {
		if (!confirmRemove.value) return;
		removing.value = true;
		try {
			await removeMember(confirmRemove.value.id);
			directoryStore.reset();
			toast.success(`Đã xóa ${confirmRemove.value.fullName} khỏi phòng ban`);
			confirmRemove.value = null;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi xóa nhân viên khỏi phòng ban');
		} finally {
			removing.value = false;
		}
	}

	// ─── Toggle active confirm ────────────────────────────────────────────────────

	const confirmToggle = ref<EmployeeSummary | null>(null);
	const toggling = ref(false);

	async function handleToggleActive() {
		if (!confirmToggle.value) return;
		toggling.value = true;
		const emp = confirmToggle.value;
		try {
			if (emp.status === 'INACTIVE') {
				await activateMember(emp.id);
				directoryStore.reset();
				toast.success(`Đã kích hoạt ${emp.fullName}`);
			} else {
				await deactivateMember(emp.id);
				directoryStore.reset();
				toast.success(`Đã vô hiệu hóa ${emp.fullName}`);
			}
			confirmToggle.value = null;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi thay đổi trạng thái');
		} finally {
			toggling.value = false;
		}
	}

	// ─── Change manager modal ────────────────────────────────────────────────────

	const showChangeManagerModal = ref(false);
	const managerSearch = ref('');
	const managerCandidates = ref<EmployeeSummary[]>([]);
	const loadingManagerCandidates = ref(false);
	const changingManagerId = ref<number | null>(null);

	async function fetchManagerCandidates() {
		loadingManagerCandidates.value = true;
		try {
			const res = await empService.findAll({
				departmentId: id,
				search: managerSearch.value || undefined,
				pagination: false,
			});
			managerCandidates.value = res.data;
		} finally {
			loadingManagerCandidates.value = false;
		}
	}

	let managerSearchTimer: ReturnType<typeof setTimeout>;
	function onManagerSearchInput(val: string) {
		managerSearch.value = val;
		clearTimeout(managerSearchTimer);
		managerSearchTimer = setTimeout(fetchManagerCandidates, 400);
	}

	function openChangeManagerModal() {
		managerSearch.value = '';
		managerCandidates.value = [];
		showChangeManagerModal.value = true;
		fetchManagerCandidates();
	}

	function closeChangeManagerModal() {
		showChangeManagerModal.value = false;
	}

	async function handleChangeManager(emp: EmployeeSummary) {
		changingManagerId.value = emp.id;
		try {
			await changeManager(emp.id);
			toast.success(`Đã đặt ${emp.fullName} làm trưởng phòng`);
			showChangeManagerModal.value = false;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi thay đổi trưởng phòng');
		} finally {
			changingManagerId.value = null;
		}
	}

	// ─── Tabs ─────────────────────────────────────────────────────────────────────
	type DeptTab = 'members' | 'positions';
	const activeTab = ref<DeptTab>('members');

	// ─── Positions section ───────────────────────────────────────────────────────

	const authStore = useAuthStore();
	const canManagePositions = computed(() => authStore.user?.role === 'HR' || authStore.user?.role === 'ADMIN');
	const canDeactivatePosition = computed(() => authStore.user?.role === 'ADMIN');

	const positionService = usePositionService();
	const positions = ref<PositionSummary[]>([]);
	const loadingPositions = ref(false);

	async function loadPositions() {
		loadingPositions.value = true;
		try {
			const res = await positionService.findAll({ departmentId: id, limit: 100 });
			positions.value = res.data;
		} finally {
			loadingPositions.value = false;
		}
	}

	// Create / edit position modal (mode determined by editingPosition)
	const showPositionModal = ref(false);
	const editingPosition = ref<PositionSummary | null>(null);

	const {
		handleSubmit: handlePositionSubmit,
		defineField: definePositionField,
		errors: positionErrors,
		isSubmitting: positionSubmitting,
		resetForm: resetPositionForm,
	} = useForm<{ name: string }>({
		validationSchema: {
			name: (v: string) => (v && v.trim().length >= 2 ? true : 'Tối thiểu 2 ký tự'),
		},
	});
	const [positionName, positionNameAttrs] = definePositionField('name');

	function openCreatePosition() {
		editingPosition.value = null;
		resetPositionForm({ values: { name: '' } });
		showPositionModal.value = true;
	}

	function openEditPosition(pos: PositionSummary) {
		editingPosition.value = pos;
		resetPositionForm({ values: { name: pos.name } });
		showPositionModal.value = true;
	}

	function closePositionModal() {
		showPositionModal.value = false;
		editingPosition.value = null;
	}

	const onPositionSubmit = handlePositionSubmit(async values => {
		try {
			if (editingPosition.value) {
				await positionService.update(editingPosition.value.id, { name: values.name.trim() });
				directoryStore.reset();
				toast.success('Đã cập nhật chức danh');
			} else {
				await positionService.create({ name: values.name.trim(), departmentId: id });
				directoryStore.reset();
				toast.success('Đã tạo chức danh mới');
			}
			showPositionModal.value = false;
			await loadPositions();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi lưu chức danh');
		}
	});

	// Deactivate position
	const confirmDeactivatePosition = ref<PositionSummary | null>(null);
	const deactivatingPosition = ref(false);

	async function handleDeactivatePosition() {
		if (!confirmDeactivatePosition.value) return;
		deactivatingPosition.value = true;
		try {
			await positionService.deactivate(confirmDeactivatePosition.value.id);
			directoryStore.reset();
			toast.success(`Đã vô hiệu hóa "${confirmDeactivatePosition.value.name}"`);
			confirmDeactivatePosition.value = null;
			await loadPositions();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi vô hiệu hóa chức danh');
		} finally {
			deactivatingPosition.value = false;
		}
	}

	function getPositionActions(pos: PositionSummary): DropdownMenuItem[] {
		const items: DropdownMenuItem[] = [];
		if (canManagePositions.value) {
			items.push({
				label: 'Đổi tên',
				icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
				action: () => openEditPosition(pos),
			});
		}
		if (canDeactivatePosition.value && pos.isActive) {
			items.push({
				label: 'Vô hiệu hóa',
				icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636',
				variant: 'danger' as const,
				action: () => (confirmDeactivatePosition.value = pos),
			});
		}
		return items;
	}

	// ─── Row dropdown actions ─────────────────────────────────────────────────────

	const router = useRouter();

	function getMemberActions(emp: EmployeeSummary): DropdownMenuItem[] {
		return [
			{
				label: 'Xem chi tiết',
				icon: 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
				action: () => router.push(`/management/employees/${emp.id}`),
			},
			{
				label: 'Chỉnh sửa',
				icon: 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z',
				action: () => router.push(`/management/employees/${emp.id}?edit=true`),
			},
			{
				label: emp.status === 'INACTIVE' ? 'Kích hoạt' : 'Vô hiệu hóa',
				icon:
					emp.status === 'INACTIVE'
						? 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
						: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636',
				variant: emp.status !== 'INACTIVE' ? 'danger' : undefined,
				action: () => (confirmToggle.value = emp),
			},
			{
				label: 'Xóa khỏi phòng ban',
				icon: 'M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6',
				variant: 'danger',
				action: () => (confirmRemove.value = emp),
			},
		];
	}

	// ─── Init ─────────────────────────────────────────────────────────────────────

	onMounted(async () => {
		await Promise.all([
			loadDept().catch((e: unknown) =>
				toast.error(e instanceof Error ? e.message : 'Không tải được thông tin phòng ban'),
			),
			loadMembers().catch((e: unknown) =>
				toast.error(e instanceof Error ? e.message : 'Không tải được danh sách nhân viên'),
			),
		]);
		if (isEditing.value && department.value) resetForm({ values: { name: department.value.name } });
	});

	watch(activeTab, tab => {
		if (tab === 'positions' && positions.value.length === 0 && !loadingPositions.value) {
			loadPositions().catch((e: unknown) =>
				toast.error(e instanceof Error ? e.message : 'Không tải được danh sách chức danh'),
			);
		}
	});
</script>

<template>
	<div class="space-y-6">
		<!-- Header -->
		<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
			<NuxtLink
				to="/management/departments"
				class="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
			>
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
				</svg>
				Danh sách phòng ban
			</NuxtLink>

			<div v-if="department && !isEditing" class="flex items-center gap-2">
				<CommonAppButton variant="outline" @click="openChangeManagerModal">
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
						/>
					</svg>
					Thay đổi trưởng phòng
				</CommonAppButton>
				<CommonAppButton variant="outline" @click="startEditing">
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
						/>
					</svg>
					Chỉnh sửa
				</CommonAppButton>
			</div>
		</div>

		<!-- Loading skeleton (dept) -->
		<div
			v-if="loadingDept"
			class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 space-y-4"
		>
			<div class="h-5 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
			<div class="grid grid-cols-2 gap-4 pt-2">
				<div v-for="i in 4" :key="i" class="space-y-1.5">
					<div class="h-3 w-20 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
					<div class="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
				</div>
			</div>
		</div>

		<!-- Not found -->
		<div v-else-if="!department && !loadingDept" class="flex flex-col items-center justify-center py-20">
			<p class="text-gray-500 dark:text-gray-400">Không tìm thấy phòng ban</p>
			<NuxtLink to="/management/departments" class="mt-3">
				<CommonAppButton variant="outline" size="sm">Quay lại danh sách</CommonAppButton>
			</NuxtLink>
		</div>

		<template v-else-if="department">
			<!-- Info card — view mode -->
			<div
				v-if="!isEditing"
				class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm"
			>
				<div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
					<div
						class="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0"
					>
						<svg
							class="w-5 h-5 text-brand-600 dark:text-brand-400"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="1.75"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
							/>
						</svg>
					</div>
					<div class="flex-1 min-w-0">
						<div class="flex flex-wrap items-center gap-2">
							<h2 class="text-lg font-semibold text-gray-900 dark:text-white truncate">{{ department.name }}</h2>
							<span
								:class="[
									'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0',
									department.isActive
										? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
										: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
								]"
							>
								<span
									:class="[
										'w-1.5 h-1.5 rounded-full',
										department.isActive ? 'bg-green-500 dark:bg-green-400' : 'bg-red-500 dark:bg-red-400',
									]"
								/>
								{{ department.isActive ? 'Hoạt động' : 'Vô hiệu' }}
							</span>
						</div>
					</div>
				</div>

				<div class="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
					<div>
						<p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Trưởng phòng</p>
						<p class="text-sm text-gray-900 dark:text-white">
							{{ department.manager?.fullName ?? '—' }}
						</p>
						<p v-if="department.manager" class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
							{{ department.manager.email }}
						</p>
					</div>
					<div>
						<p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Số nhân viên</p>
						<p class="text-sm text-gray-900 dark:text-white">{{ department.employeeCount }} người</p>
					</div>
					<div>
						<p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Ngày tạo</p>
						<p class="text-sm text-gray-900 dark:text-white">{{ formatDate(department.createdAt) }}</p>
					</div>
					<div>
						<p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Cập nhật lần cuối</p>
						<p class="text-sm text-gray-900 dark:text-white">{{ formatDateTime(department.updatedAt) }}</p>
					</div>
				</div>
			</div>

			<!-- Info card — edit mode -->
			<form
				v-else
				class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm"
				@submit.prevent="onSubmit"
			>
				<div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
					<h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Chỉnh sửa thông tin</h3>
				</div>
				<div class="p-6">
					<div class="max-w-sm">
						<label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
							Tên phòng ban <span class="text-red-500">*</span>
						</label>
						<input
							v-model="deptName"
							v-bind="deptNameAttrs"
							:class="[
								'block w-full rounded-lg border px-3 py-2.5 text-sm transition-colors',
								'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
								'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-0',
								errors.name
									? 'border-red-400 focus:border-red-400 focus:ring-red-300'
									: 'border-gray-300 focus:border-brand-500 focus:ring-brand-200 dark:border-gray-600',
							]"
							placeholder="Nhập tên phòng ban"
						/>
						<p v-if="errors.name" class="mt-1 text-xs text-red-500">{{ errors.name }}</p>
					</div>
				</div>
				<div class="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
					<CommonAppButton type="button" variant="outline" @click="cancelEditing">Hủy</CommonAppButton>
					<CommonAppButton type="submit" :loading="isSubmitting">Lưu thay đổi</CommonAppButton>
				</div>
			</form>

			<!-- Tab switcher -->
			<div class="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
				<button
					v-for="tab in [
						{ key: 'members', label: 'Nhân sự' },
						{ key: 'positions', label: 'Chức danh' },
					] as const"
					:key="tab.key"
					class="px-4 py-1.5 text-sm font-medium rounded-lg transition-all"
					:class="
						activeTab === tab.key
							? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
							: 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
					"
					@click="activeTab = tab.key"
				>
					{{ tab.label }}
				</button>
			</div>

			<!-- Members section -->
			<div
				v-if="activeTab === 'members'"
				class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
			>
				<!-- Section header -->
				<div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-3">
					<div>
						<h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">
							Nhân sự
							<span
								v-if="!loadingMembers"
								class="ml-1.5 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-600 dark:text-gray-400"
							>
								{{ members.length }}
							</span>
						</h3>
					</div>
					<CommonAppButton size="sm" @click="openAddModal">
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
						</svg>
						Thêm nhân viên
					</CommonAppButton>
				</div>

				<!-- Members loading skeleton -->
				<div v-if="loadingMembers" class="divide-y divide-gray-100 dark:divide-gray-800">
					<div v-for="i in 4" :key="i" class="flex items-center gap-4 px-6 py-4">
						<div class="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse flex-shrink-0" />
						<div class="flex flex-col gap-1.5 flex-1">
							<div class="h-3.5 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
							<div class="h-3 w-48 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
						</div>
						<div class="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
						<div class="h-7 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse ml-auto" />
					</div>
				</div>

				<!-- Members empty state -->
				<div v-else-if="!members.length" class="flex flex-col items-center justify-center py-14 text-center">
					<div class="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
						<svg class="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
							/>
						</svg>
					</div>
					<p class="text-sm font-medium text-gray-600 dark:text-gray-300">Chưa có nhân viên</p>
					<p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Thêm nhân viên vào phòng ban này</p>
				</div>

				<!-- Members table -->
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
									Chức danh
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
							<tr
								v-for="emp in members"
								:key="emp.id"
								class="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
							>
								<td class="px-6 py-4 font-mono text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
									{{ emp.employeeCode }}
								</td>
								<td class="px-6 py-4">
									<div class="flex items-center gap-3">
										<div
											class="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0"
										>
											<span class="text-sm font-semibold text-brand-600 dark:text-brand-400">
												{{ emp.fullName.charAt(0).toUpperCase() }}
											</span>
										</div>
										<div class="min-w-0">
											<p class="font-medium text-gray-900 dark:text-white truncate">{{ emp.fullName }}</p>
											<p class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{{ emp.email }}</p>
										</div>
									</div>
								</td>
								<td class="px-6 py-4 whitespace-nowrap">
									<span v-if="emp.position" class="text-sm text-gray-700 dark:text-gray-300">
										{{ emp.position.name }}
									</span>
									<span v-else class="text-sm text-gray-400 dark:text-gray-500">—</span>
								</td>
								<td class="px-6 py-4 whitespace-nowrap">
									<EmployeeStatusBadge :status="emp.status" />
								</td>
								<td class="px-6 py-4 text-right">
									<UiDropdownMenu :items="getMemberActions(emp)" />
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>

			<!-- Positions section -->
			<div
				v-if="activeTab === 'positions'"
				class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
			>
				<!-- Section header -->
				<div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-3">
					<div>
						<h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">
							Chức danh
							<span
								v-if="!loadingPositions"
								class="ml-1.5 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-600 dark:text-gray-400"
							>
								{{ positions.length }}
							</span>
						</h3>
						<p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Chức danh thuộc phòng ban này</p>
					</div>
					<CommonAppButton v-if="canManagePositions" size="sm" @click="openCreatePosition">
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
						</svg>
						Thêm chức danh
					</CommonAppButton>
				</div>

				<!-- Loading skeleton -->
				<div v-if="loadingPositions" class="divide-y divide-gray-100 dark:divide-gray-800">
					<div v-for="i in 3" :key="i" class="flex items-center gap-4 px-6 py-4">
						<div class="w-7 h-7 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse flex-shrink-0" />
						<div class="h-4 w-44 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
						<div class="ml-auto flex items-center gap-3">
							<div class="h-3.5 w-12 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
							<div class="h-5 w-16 bg-gray-100 dark:bg-gray-800 rounded-full animate-pulse" />
							<div class="h-7 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
						</div>
					</div>
				</div>

				<!-- Empty state -->
				<div v-else-if="!positions.length" class="flex flex-col items-center justify-center py-14 text-center">
					<div class="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
						<svg class="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z"
							/>
						</svg>
					</div>
					<p class="text-sm font-medium text-gray-600 dark:text-gray-300">Chưa có chức danh</p>
					<p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Thêm chức danh cho phòng ban này</p>
				</div>

				<!-- Positions table -->
				<div v-else class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
								<th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
									Tên chức danh
								</th>
								<th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">
									Nhân viên
								</th>
								<th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">
									Trạng thái
								</th>
								<th
									v-if="canManagePositions || canDeactivatePosition"
									class="text-right px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
								>
									Hành động
								</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100 dark:divide-gray-700/50">
							<tr
								v-for="pos in positions"
								:key="pos.id"
								class="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
							>
								<td class="px-6 py-4">
									<div class="flex items-center gap-2.5">
										<div
											class="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0"
										>
											<svg
												class="w-3.5 h-3.5 text-violet-600 dark:text-violet-400"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
												stroke-width="2"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z"
												/>
											</svg>
										</div>
										<span class="font-medium text-gray-900 dark:text-white">{{ pos.name }}</span>
									</div>
								</td>
								<td class="px-6 py-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
									{{ pos.employeeCount }} người
								</td>
								<td class="px-6 py-4 whitespace-nowrap">
									<span
										:class="[
											'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
											pos.isActive
												? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
												: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
										]"
									>
										<span
											:class="[
												'w-1.5 h-1.5 rounded-full',
												pos.isActive ? 'bg-green-500 dark:bg-green-400' : 'bg-red-500 dark:bg-red-400',
											]"
										/>
										{{ pos.isActive ? 'Hoạt động' : 'Vô hiệu' }}
									</span>
								</td>
								<td v-if="canManagePositions || canDeactivatePosition" class="px-6 py-4 text-right">
									<UiDropdownMenu :items="getPositionActions(pos)" />
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</template>

		<!-- ─── Add member modal ───────────────────────────────────────────────── -->
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
					v-if="showAddModal"
					class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
					@click.self="closeAddModal"
				>
					<div
						class="bg-white dark:bg-gray-900 rounded-xl w-full max-w-lg shadow-xl border border-gray-200 dark:border-gray-700 flex flex-col max-h-[85vh]"
					>
						<!-- Modal header -->
						<div
							class="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0"
						>
							<h3 class="text-sm font-semibold text-gray-900 dark:text-white">Thêm nhân viên vào phòng ban</h3>
							<button
								type="button"
								class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
								@click="closeAddModal"
							>
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>

						<!-- Search input -->
						<div class="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
							<div class="relative">
								<svg
									class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
									/>
								</svg>
								<input
									:value="addSearch"
									type="text"
									placeholder="Tìm theo tên, email, mã NV..."
									class="block w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 pl-9 pr-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
									@input="onAddSearchInput(($event.target as HTMLInputElement).value)"
								/>
							</div>
						</div>

						<!-- Results list -->
						<div class="flex-1 overflow-y-auto">
							<!-- Loading -->
							<div v-if="loadingAvailable" class="divide-y divide-gray-100 dark:divide-gray-800">
								<div v-for="i in 4" :key="i" class="flex items-center gap-3 px-5 py-3.5">
									<div class="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse flex-shrink-0" />
									<div class="flex-1 space-y-1.5">
										<div class="h-3.5 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
										<div class="h-3 w-44 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
									</div>
									<div class="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
								</div>
							</div>

							<!-- Empty -->
							<div
								v-else-if="!availableEmployees.length"
								class="flex flex-col items-center justify-center py-12 text-center px-4"
							>
								<p class="text-sm text-gray-500 dark:text-gray-400">
									{{ addSearch ? 'Không tìm thấy nhân viên phù hợp' : 'Tất cả nhân viên đã ở trong phòng ban này' }}
								</p>
							</div>

							<!-- List -->
							<div v-else class="divide-y divide-gray-100 dark:divide-gray-800">
								<div
									v-for="emp in availableEmployees"
									:key="emp.id"
									class="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
								>
									<div
										class="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0"
									>
										<span class="text-sm font-semibold text-brand-600 dark:text-brand-400">
											{{ emp.fullName.charAt(0).toUpperCase() }}
										</span>
									</div>
									<div class="flex-1 min-w-0">
										<p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ emp.fullName }}</p>
										<p class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
											{{ emp.email }}
											<span v-if="emp.department" class="text-gray-400 dark:text-gray-500">
												· {{ emp.department.name }}
											</span>
										</p>
									</div>
									<CommonAppButton
										size="sm"
										variant="secondary"
										:loading="addingId === emp.id"
										:disabled="addingId !== null"
										@click="handleAddMember(emp)"
									>
										Thêm
									</CommonAppButton>
								</div>
							</div>
						</div>

						<!-- Modal footer -->
						<div class="px-5 py-3 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
							<CommonAppButton variant="outline" full-width @click="closeAddModal">Đóng</CommonAppButton>
						</div>
					</div>
				</div>
			</Transition>
		</Teleport>

		<!-- ─── Confirm remove modal ──────────────────────────────────────────── -->
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
					v-if="confirmRemove"
					class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
					@click.self="confirmRemove = null"
				>
					<div
						class="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-sm w-full shadow-xl border border-gray-200 dark:border-gray-700"
					>
						<div class="flex items-start gap-4">
							<div
								class="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0"
							>
								<svg
									class="w-5 h-5 text-orange-600 dark:text-orange-400"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6"
									/>
								</svg>
							</div>
							<div>
								<h3 class="font-semibold text-gray-900 dark:text-white">Xóa khỏi phòng ban</h3>
								<p class="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
									Xóa <strong class="text-gray-700 dark:text-gray-300">{{ confirmRemove.fullName }}</strong> khỏi phòng
									ban này. Nhân viên vẫn tồn tại trong hệ thống.
								</p>
							</div>
						</div>
						<div class="flex justify-end gap-3 mt-6">
							<CommonAppButton variant="outline" @click="confirmRemove = null">Hủy</CommonAppButton>
							<CommonAppButton variant="danger" :loading="removing" @click="handleRemove">
								Xác nhận xóa
							</CommonAppButton>
						</div>
					</div>
				</div>
			</Transition>
		</Teleport>

		<!-- ─── Change manager modal ────────────────────────────────────────── -->
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
					v-if="showChangeManagerModal"
					class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
					@click.self="closeChangeManagerModal"
				>
					<div
						class="bg-white dark:bg-gray-900 rounded-xl w-full max-w-lg shadow-xl border border-gray-200 dark:border-gray-700 flex flex-col max-h-[85vh]"
					>
						<!-- Modal header -->
						<div
							class="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0"
						>
							<div>
								<h3 class="text-sm font-semibold text-gray-900 dark:text-white">Thay đổi trưởng phòng</h3>
								<p v-if="department?.manager" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
									Hiện tại: {{ department.manager.fullName }}
								</p>
							</div>
							<button
								type="button"
								class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
								@click="closeChangeManagerModal"
							>
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>

						<!-- Search input -->
						<div class="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
							<div class="relative">
								<svg
									class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
									/>
								</svg>
								<input
									:value="managerSearch"
									type="text"
									placeholder="Tìm theo tên, email, mã NV..."
									class="block w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 pl-9 pr-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
									@input="onManagerSearchInput(($event.target as HTMLInputElement).value)"
								/>
							</div>
						</div>

						<!-- Results list -->
						<div class="flex-1 overflow-y-auto">
							<!-- Loading -->
							<div v-if="loadingManagerCandidates" class="divide-y divide-gray-100 dark:divide-gray-800">
								<div v-for="i in 4" :key="i" class="flex items-center gap-3 px-5 py-3.5">
									<div class="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse flex-shrink-0" />
									<div class="flex-1 space-y-1.5">
										<div class="h-3.5 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
										<div class="h-3 w-44 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
									</div>
									<div class="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
								</div>
							</div>

							<!-- Empty -->
							<div
								v-else-if="!managerCandidates.length"
								class="flex flex-col items-center justify-center py-12 text-center px-4"
							>
								<p class="text-sm text-gray-500 dark:text-gray-400">Không tìm thấy nhân viên phù hợp</p>
							</div>

							<!-- List -->
							<div v-else class="divide-y divide-gray-100 dark:divide-gray-800">
								<div
									v-for="emp in managerCandidates"
									:key="emp.id"
									class="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
								>
									<div
										class="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0"
									>
										<span class="text-sm font-semibold text-brand-600 dark:text-brand-400">
											{{ emp.fullName.charAt(0).toUpperCase() }}
										</span>
									</div>
									<div class="flex-1 min-w-0">
										<div class="flex items-center gap-2">
											<p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ emp.fullName }}</p>
											<span
												v-if="department?.manager?.id === emp.id"
												class="flex-shrink-0 text-xs px-1.5 py-0.5 rounded bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 font-medium"
											>
												Hiện tại
											</span>
										</div>
										<p class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{{ emp.email }}</p>
									</div>
									<CommonAppButton
										size="sm"
										:variant="department?.manager?.id === emp.id ? 'secondary' : 'primary'"
										:loading="changingManagerId === emp.id"
										:disabled="changingManagerId !== null || department?.manager?.id === emp.id"
										@click="handleChangeManager(emp)"
									>
										{{ department?.manager?.id === emp.id ? 'Đang chọn' : 'Chọn' }}
									</CommonAppButton>
								</div>
							</div>
						</div>

						<!-- Modal footer -->
						<div class="px-5 py-3 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
							<CommonAppButton variant="outline" full-width @click="closeChangeManagerModal">Đóng</CommonAppButton>
						</div>
					</div>
				</div>
			</Transition>
		</Teleport>

		<!-- ─── Confirm toggle active modal ──────────────────────────────────── -->
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
					v-if="confirmToggle"
					class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
					@click.self="confirmToggle = null"
				>
					<div
						class="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-sm w-full shadow-xl border border-gray-200 dark:border-gray-700"
					>
						<div class="flex items-start gap-4">
							<div
								:class="[
									'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
									confirmToggle.status === 'INACTIVE'
										? 'bg-green-100 dark:bg-green-900/30'
										: 'bg-red-100 dark:bg-red-900/30',
								]"
							>
								<svg
									:class="[
										'w-5 h-5',
										confirmToggle.status === 'INACTIVE'
											? 'text-green-600 dark:text-green-400'
											: 'text-red-600 dark:text-red-400',
									]"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path
										v-if="confirmToggle.status === 'INACTIVE'"
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
									<path
										v-else
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
									/>
								</svg>
							</div>
							<div>
								<h3 class="font-semibold text-gray-900 dark:text-white">
									{{ confirmToggle.status === 'INACTIVE' ? 'Kích hoạt nhân viên' : 'Vô hiệu hóa nhân viên' }}
								</h3>
								<p class="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
									<strong class="text-gray-700 dark:text-gray-300">{{ confirmToggle.fullName }}</strong>
									{{
										confirmToggle.status === 'INACTIVE'
											? ' sẽ có thể đăng nhập hệ thống trở lại.'
											: ' sẽ không thể đăng nhập hệ thống. Bạn có thể kích hoạt lại bất kỳ lúc nào.'
									}}
								</p>
							</div>
						</div>
						<div class="flex justify-end gap-3 mt-6">
							<CommonAppButton variant="outline" @click="confirmToggle = null">Hủy</CommonAppButton>
							<CommonAppButton
								:variant="confirmToggle.status === 'INACTIVE' ? 'primary' : 'danger'"
								:loading="toggling"
								@click="handleToggleActive"
							>
								{{ confirmToggle.status === 'INACTIVE' ? 'Kích hoạt' : 'Vô hiệu hóa' }}
							</CommonAppButton>
						</div>
					</div>
				</div>
			</Transition>
		</Teleport>

		<!-- ─── Create / Edit position modal ────────────────────────────────────── -->
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
					v-if="showPositionModal"
					class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
					@click.self="closePositionModal"
				>
					<div
						class="bg-white dark:bg-gray-900 rounded-xl w-full max-w-sm shadow-xl border border-gray-200 dark:border-gray-700"
					>
						<!-- Header -->
						<div class="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
							<h3 class="text-sm font-semibold text-gray-900 dark:text-white">
								{{ editingPosition ? 'Đổi tên chức danh' : 'Thêm chức danh' }}
							</h3>
							<button
								type="button"
								class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
								@click="closePositionModal"
							>
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>

						<!-- Form -->
						<form @submit.prevent="onPositionSubmit">
							<div class="p-5">
								<label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
									Tên chức danh <span class="text-red-500">*</span>
								</label>
								<input
									v-model="positionName"
									v-bind="positionNameAttrs"
									:class="[
										'block w-full rounded-lg border px-3 py-2.5 text-sm transition-colors',
										'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
										'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-0',
										positionErrors.name
											? 'border-red-400 focus:border-red-400 focus:ring-red-300'
											: 'border-gray-300 focus:border-brand-500 focus:ring-brand-200 dark:border-gray-600',
									]"
									placeholder="VD: Kỹ sư phần mềm, Tester, BA..."
									autofocus
								/>
								<p v-if="positionErrors.name" class="mt-1 text-xs text-red-500">{{ positionErrors.name }}</p>
							</div>
							<div class="px-5 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
								<CommonAppButton type="button" variant="outline" @click="closePositionModal">Hủy</CommonAppButton>
								<CommonAppButton type="submit" :loading="positionSubmitting">
									{{ editingPosition ? 'Lưu thay đổi' : 'Thêm chức danh' }}
								</CommonAppButton>
							</div>
						</form>
					</div>
				</div>
			</Transition>
		</Teleport>

		<!-- ─── Confirm deactivate position modal ────────────────────────────────── -->
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
					v-if="confirmDeactivatePosition"
					class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
					@click.self="confirmDeactivatePosition = null"
				>
					<div
						class="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-sm w-full shadow-xl border border-gray-200 dark:border-gray-700"
					>
						<div class="flex items-start gap-4">
							<div class="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
								<svg class="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
									/>
								</svg>
							</div>
							<div>
								<h3 class="font-semibold text-gray-900 dark:text-white">Vô hiệu hóa chức danh</h3>
								<p class="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
									Chức danh
									<strong class="text-gray-700 dark:text-gray-300">{{ confirmDeactivatePosition.name }}</strong>
									sẽ bị vô hiệu hóa và không thể gán cho nhân viên mới.
								</p>
								<div
									v-if="confirmDeactivatePosition.employeeCount > 0"
									class="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 px-3 py-2.5"
								>
									<svg class="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
									</svg>
									<p class="text-xs text-amber-700 dark:text-amber-400">
										Hiện có
										<strong>{{ confirmDeactivatePosition.employeeCount }} nhân viên</strong>
										đang giữ chức danh này. Họ sẽ không bị ảnh hưởng nhưng không thể gán chức danh này cho người mới.
									</p>
								</div>
							</div>
						</div>
						<div class="flex justify-end gap-3 mt-6">
							<CommonAppButton variant="outline" @click="confirmDeactivatePosition = null">Hủy</CommonAppButton>
							<CommonAppButton variant="danger" :loading="deactivatingPosition" @click="handleDeactivatePosition">
								Vô hiệu hóa
							</CommonAppButton>
						</div>
					</div>
				</div>
			</Transition>
		</Teleport>
	</div>
</template>
