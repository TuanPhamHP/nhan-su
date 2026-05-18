<script setup lang="ts">
import type { RoleSummary, PermissionGroupDto } from '~/types/role.types';
import { formatDateTime } from '~/utils/date';
import RoleCreateModal from '~/components/modules/role/RoleCreateModal.vue';
import RoleAddUserModal from '~/components/modules/role/RoleAddUserModal.vue';

definePageMeta({ title: 'Phân quyền' });

const toast = useToast();
const {
	roles,
	currentRole,
	roleEmployees,
	employeeMeta,
	permissionGroups,
	loading,
	detailLoading,
	employeeLoading,
	fetchRoles,
	fetchRole,
	fetchPermissionGroups,
	fetchRoleEmployees,
	deleteRole,
	savePermissions,
	removeEmployeeFromRole,
	updateRole,
} = useRole();

// --- Role list ---
const searchInput = ref('');
const search = ref('');
const selectedRoleId = ref<number | null>(null);
const activeTab = ref<'permissions' | 'users'>('permissions');

let searchTimer: ReturnType<typeof setTimeout>;
function onSearchInput(val: string) {
	searchInput.value = val;
	clearTimeout(searchTimer);
	searchTimer = setTimeout(() => {
		search.value = val;
	}, 400);
}

const filteredRoles = computed(() =>
	search.value
		? roles.value.filter(r => r.name.toLowerCase().includes(search.value.toLowerCase()))
		: roles.value,
);

async function loadRoles() {
	try {
		await fetchRoles({ limit: 100 });
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Lỗi tải danh sách vai trò');
	}
}

async function selectRole(role: RoleSummary) {
	if (selectedRoleId.value === role.id) return;
	selectedRoleId.value = role.id;
	activeTab.value = 'permissions';
	pendingPermissionIds.value = null;

	try {
		await fetchRole(role.id);
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Lỗi tải chi tiết vai trò');
	}
}

// --- Permissions tab ---
const pendingPermissionIds = ref<number[] | null>(null);
const savingPermissions = ref(false);

const currentPermissionIds = computed(() =>
	currentRole.value?.permissions.map(p => p.id) ?? [],
);

const editablePermissionIds = computed({
	get: () => pendingPermissionIds.value ?? currentPermissionIds.value,
	set: (val: number[]) => { pendingPermissionIds.value = val; },
});

const permissionsChanged = computed(() => {
	if (!pendingPermissionIds.value) return false;
	const current = new Set(currentPermissionIds.value);
	const next = new Set(pendingPermissionIds.value);
	if (current.size !== next.size) return true;
	for (const id of next) if (!current.has(id)) return true;
	return false;
});

function isGroupAllChecked(group: PermissionGroupDto): boolean {
	return group.permissions.every(p => editablePermissionIds.value.includes(p.id));
}

function isGroupIndeterminate(group: PermissionGroupDto): boolean {
	const checked = group.permissions.filter(p => editablePermissionIds.value.includes(p.id));
	return checked.length > 0 && checked.length < group.permissions.length;
}

function togglePermission(id: number) {
	const current = new Set(editablePermissionIds.value);
	current.has(id) ? current.delete(id) : current.add(id);
	editablePermissionIds.value = [...current];
}

function toggleGroup(group: PermissionGroupDto) {
	const allChecked = isGroupAllChecked(group);
	const current = new Set(editablePermissionIds.value);
	group.permissions.forEach(p => allChecked ? current.delete(p.id) : current.add(p.id));
	editablePermissionIds.value = [...current];
}

async function onSavePermissions() {
	if (!selectedRoleId.value || !permissionsChanged.value) return;
	savingPermissions.value = true;
	try {
		await savePermissions(selectedRoleId.value, editablePermissionIds.value);
		pendingPermissionIds.value = null;
		toast.success('Đã cập nhật quyền cho vai trò');
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Lỗi cập nhật quyền');
	} finally {
		savingPermissions.value = false;
	}
}

function discardPermissions() {
	pendingPermissionIds.value = null;
}

// --- Users tab ---
const employeePage = ref(1);
const showAddUserModal = ref(false);

async function loadEmployees() {
	if (!selectedRoleId.value) return;
	try {
		await fetchRoleEmployees(selectedRoleId.value, { page: employeePage.value, limit: 10 });
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Lỗi tải danh sách người dùng');
	}
}

watch(activeTab, tab => {
	if (tab === 'users') loadEmployees();
});

const removingEmployeeId = ref<number | null>(null);

async function onRemoveEmployee(employeeId: number) {
	if (!selectedRoleId.value) return;
	removingEmployeeId.value = employeeId;
	try {
		await removeEmployeeFromRole(selectedRoleId.value, employeeId);
		toast.success('Đã xóa người dùng khỏi vai trò');
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Lỗi xóa người dùng');
	} finally {
		removingEmployeeId.value = null;
	}
}

// --- Delete role ---
const confirmDeleteId = ref<number | null>(null);
const deleting = ref(false);

function openDeleteConfirm(roleId: number) {
	confirmDeleteId.value = roleId;
}

async function onDeleteRole() {
	if (!confirmDeleteId.value) return;
	deleting.value = true;
	try {
		await deleteRole(confirmDeleteId.value);
		if (selectedRoleId.value === confirmDeleteId.value) selectedRoleId.value = null;
		confirmDeleteId.value = null;
		toast.success('Đã xóa vai trò');
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Lỗi xóa vai trò');
	} finally {
		deleting.value = false;
	}
}

// --- Create role ---
const showCreateModal = ref(false);

async function onRoleCreated(roleId: number) {
	showCreateModal.value = false;
	await loadRoles();
	const created = roles.value.find(r => r.id === roleId);
	if (created) await selectRole(created);
}

// --- Init ---
onMounted(async () => {
	await loadRoles();
	await fetchPermissionGroups();
	const first = roles.value[0];
	if (first) await selectRole(first);
});

// --- Helpers ---
function getRoleInitials(name: string): string {
	return name
		.split(' ')
		.slice(0, 2)
		.map(w => w.charAt(0).toUpperCase())
		.join('');
}
</script>

<template>
	<div class="flex h-full gap-0 -m-6 overflow-hidden" style="height: calc(100vh - 4rem)">
		<!-- Left panel: Role list -->
		<div
			class="w-72 flex-shrink-0 flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700"
		>
			<!-- Header -->
			<div class="flex items-center gap-2 px-4 pt-5 pb-3 flex-shrink-0">
				<h1 class="text-base font-semibold text-gray-900 dark:text-white flex-1">Danh sách vai trò</h1>
				<button
					class="w-8 h-8 flex items-center justify-center rounded-lg bg-brand-600 hover:bg-brand-700 text-white transition-colors"
					title="Tạo vai trò mới"
					@click="showCreateModal = true"
				>
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
					</svg>
				</button>
			</div>

			<!-- Search -->
			<div class="px-3 pb-3 flex-shrink-0">
				<div class="relative">
					<svg
						class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="1.5"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
					</svg>
					<input
						:value="searchInput"
						type="text"
						placeholder="Tìm kiếm vai trò..."
						class="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-500 transition-colors"
						@input="onSearchInput(($event.target as HTMLInputElement).value)"
					/>
				</div>
			</div>

			<!-- Role list -->
			<div class="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
				<div v-if="loading" class="space-y-1 px-1 pt-1">
					<div v-for="i in 5" :key="i" class="flex items-center gap-3 px-3 py-3 rounded-lg">
						<div class="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse flex-shrink-0" />
						<div class="flex-1 space-y-1.5">
							<div class="h-3.5 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
						</div>
					</div>
				</div>

				<button
					v-for="role in filteredRoles"
					:key="role.id"
					:class="[
						'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors group',
						selectedRoleId === role.id
							? 'bg-brand-50 dark:bg-brand-900/20'
							: 'hover:bg-gray-100 dark:hover:bg-gray-800',
					]"
					@click="selectRole(role)"
				>
					<div
						:class="[
							'w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
							selectedRoleId === role.id
								? 'bg-brand-600 text-white'
								: 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
						]"
					>
						{{ getRoleInitials(role.name) }}
					</div>
					<div class="flex-1 min-w-0">
						<p
							:class="[
								'text-sm font-medium truncate',
								selectedRoleId === role.id
									? 'text-brand-700 dark:text-brand-400'
									: 'text-gray-800 dark:text-gray-200',
							]"
						>
							{{ role.name }}
						</p>
					</div>
					<span
						v-if="role.type === 'DEFAULT'"
						:class="[
							'text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0',
							selectedRoleId === role.id
								? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-400'
								: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
						]"
					>
						Mặc định
					</span>
				</button>
			</div>
		</div>

		<!-- Center panel: Content -->
		<div class="flex-1 flex flex-col min-w-0 overflow-hidden bg-gray-50 dark:bg-gray-950">
			<div v-if="!selectedRoleId" class="flex-1 flex items-center justify-center">
				<div class="text-center">
					<div class="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
						<svg class="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					</div>
					<p class="text-sm font-medium text-gray-600 dark:text-gray-300">Chọn vai trò để xem chi tiết</p>
				</div>
			</div>

			<template v-else>
				<!-- Tabs -->
				<div class="flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6">
					<div class="flex gap-0">
						<button
							:class="[
								'px-4 py-4 text-sm font-medium border-b-2 transition-colors',
								activeTab === 'permissions'
									? 'border-brand-600 text-brand-600 dark:text-brand-400 dark:border-brand-400'
									: 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
							]"
							@click="activeTab = 'permissions'"
						>
							Quyền
						</button>
						<button
							:class="[
								'px-4 py-4 text-sm font-medium border-b-2 transition-colors',
								activeTab === 'users'
									? 'border-brand-600 text-brand-600 dark:text-brand-400 dark:border-brand-400'
									: 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
							]"
							@click="activeTab = 'users'"
						>
							Người dùng
						</button>
					</div>
				</div>

				<!-- Tab: Permissions -->
				<div v-if="activeTab === 'permissions'" class="flex-1 overflow-y-auto p-6">
					<div v-if="detailLoading" class="space-y-4">
						<div v-for="i in 3" :key="i" class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
							<div class="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
							<div class="grid grid-cols-3 gap-3">
								<div v-for="j in 4" :key="j" class="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
							</div>
						</div>
					</div>

					<div v-else class="space-y-4">
						<!-- Permission changed notice -->
						<div
							v-if="permissionsChanged"
							class="flex items-center gap-3 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-lg px-4 py-3"
						>
							<svg class="w-4 h-4 text-brand-600 dark:text-brand-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<p class="text-sm text-brand-700 dark:text-brand-300 flex-1">Bạn có thay đổi chưa được lưu.</p>
							<button
								class="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
								@click="discardPermissions"
							>
								Hủy thay đổi
							</button>
						</div>

						<div
							v-for="group in permissionGroups"
							:key="group.group"
							class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5"
						>
							<!-- Group header -->
							<div class="flex items-center justify-between mb-4">
								<h3 class="text-sm font-semibold text-brand-700 dark:text-brand-400">{{ group.group }}</h3>
								<label class="flex items-center gap-1.5 cursor-pointer">
									<input
										type="checkbox"
										:checked="isGroupAllChecked(group)"
										class="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600"
										@change="toggleGroup(group)"
									/>
									<span class="text-xs text-gray-500 dark:text-gray-400 select-none">Chọn tất cả</span>
								</label>
							</div>

							<!-- Permissions grid -->
							<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
								<label
									v-for="perm in group.permissions"
									:key="perm.id"
									class="flex items-center gap-2.5 cursor-pointer group/perm"
								>
									<input
										type="checkbox"
										:checked="editablePermissionIds.includes(perm.id)"
										class="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 flex-shrink-0"
										@change="togglePermission(perm.id)"
									/>
									<span class="text-sm text-gray-700 dark:text-gray-300 group-hover/perm:text-gray-900 dark:group-hover/perm:text-white transition-colors select-none">
										{{ perm.name }}
									</span>
								</label>
							</div>
						</div>
					</div>
				</div>

				<!-- Tab: Users -->
				<div v-else-if="activeTab === 'users'" class="flex-1 overflow-y-auto p-6">
					<div class="flex items-center justify-between mb-4">
						<p class="text-sm text-gray-500 dark:text-gray-400">
							{{ currentRole?.employeeCount ?? 0 }} người trong vai trò này
						</p>
						<CommonAppButton size="sm" @click="showAddUserModal = true">
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
							</svg>
							Thêm người dùng
						</CommonAppButton>
					</div>

					<div
						class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
					>
						<div v-if="employeeLoading" class="divide-y divide-gray-100 dark:divide-gray-800">
							<div v-for="i in 4" :key="i" class="flex items-center gap-3 px-5 py-4">
								<div class="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse flex-shrink-0" />
								<div class="flex-1 space-y-1.5">
									<div class="h-3.5 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
									<div class="h-3 w-48 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
								</div>
								<div class="h-7 w-16 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
							</div>
						</div>

						<div
							v-else-if="!roleEmployees.length"
							class="flex flex-col items-center justify-center py-12 text-center"
						>
							<div class="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
								<svg class="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
									<path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
								</svg>
							</div>
							<p class="text-sm font-medium text-gray-600 dark:text-gray-300">Chưa có người dùng nào</p>
							<p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Thêm người vào vai trò này</p>
						</div>

						<div v-else class="divide-y divide-gray-100 dark:divide-gray-800">
							<div v-for="emp in roleEmployees" :key="emp.id" class="flex items-center gap-3 px-5 py-3.5">
								<div
									class="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center flex-shrink-0"
								>
									<span class="text-xs font-semibold text-brand-700 dark:text-brand-400">
										{{ emp.fullName.charAt(0).toUpperCase() }}
									</span>
								</div>
								<div class="flex-1 min-w-0">
									<p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ emp.fullName }}</p>
									<p class="text-xs text-gray-500 dark:text-gray-400 truncate">
										{{ emp.employeeCode }} &middot; {{ emp.email }}
									</p>
								</div>
								<span
									v-if="emp.department"
									class="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap hidden sm:block"
								>
									{{ emp.department }}
								</span>
								<CommonAppButton
									variant="ghost"
									size="sm"
									:loading="removingEmployeeId === emp.id"
									class="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
									@click="onRemoveEmployee(emp.id)"
								>
									<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
									</svg>
									Xóa
								</CommonAppButton>
							</div>
						</div>
					</div>

					<div v-if="employeeMeta && employeeMeta.totalPages > 1" class="flex items-center justify-between mt-4">
						<p class="text-sm text-gray-500 dark:text-gray-400">
							Trang {{ employeeMeta.page }} / {{ employeeMeta.totalPages }}
						</p>
						<CommonAppPagination
							:current-page="employeePage"
							:total-pages="employeeMeta.totalPages"
							@update:current-page="p => { employeePage = p; loadEmployees(); }"
						/>
					</div>
				</div>
			</template>
		</div>

		<!-- Right panel: Role info + actions -->
		<div
			v-if="selectedRoleId"
			class="w-56 flex-shrink-0 flex flex-col bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700"
		>
			<div class="flex-1 p-5 space-y-4 overflow-y-auto">
				<!-- Role name -->
				<div>
					<h2 class="text-base font-semibold text-gray-900 dark:text-white break-words">
						{{ currentRole?.name ?? roles.find(r => r.id === selectedRoleId)?.name }}
					</h2>
					<p class="text-xs text-gray-400 dark:text-gray-500 mt-1 leading-relaxed break-words">
						{{ currentRole?.description ?? '(Chưa có mô tả)' }}
					</p>
				</div>

				<div class="w-full h-px bg-gray-100 dark:bg-gray-800" />

				<!-- Stats -->
				<div class="space-y-2.5">
					<div class="flex items-center gap-2.5 text-sm text-gray-600 dark:text-gray-400">
						<svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
						</svg>
						<span>{{ currentRole?.employeeCount ?? 0 }} người</span>
					</div>
					<div class="flex items-center gap-2.5 text-sm text-gray-600 dark:text-gray-400">
						<svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
						</svg>
						<span>{{ currentRole?.permissionCount ?? 0 }} quyền</span>
					</div>
				</div>

				<div class="w-full h-px bg-gray-100 dark:bg-gray-800" />

				<!-- Last updated -->
				<div v-if="currentRole">
					<p class="text-xs text-gray-400 dark:text-gray-500">Cập nhật lần cuối</p>
					<p class="text-xs text-gray-600 dark:text-gray-300 mt-0.5">{{ formatDateTime(currentRole.updatedAt) }}</p>
				</div>

				<!-- Type badge -->
				<span
					:class="[
						'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
						currentRole?.type === 'DEFAULT'
							? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
							: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
					]"
				>
					{{ currentRole?.type === 'DEFAULT' ? 'Mặc định' : 'Tùy chỉnh' }}
				</span>
			</div>

			<!-- Actions -->
			<div class="p-4 space-y-2 flex-shrink-0 border-t border-gray-100 dark:border-gray-800">
				<!-- Save permissions (only visible on permissions tab with changes) -->
				<CommonAppButton
					v-if="activeTab === 'permissions' && permissionsChanged"
					full-width
					:loading="savingPermissions"
					@click="onSavePermissions"
				>
					Cập nhật quyền
				</CommonAppButton>
				<CommonAppButton
					v-else-if="activeTab === 'permissions'"
					full-width
					:loading="savingPermissions"
					:disabled="!permissionsChanged"
					@click="onSavePermissions"
				>
					Cập nhật
				</CommonAppButton>

				<!-- Delete (only CUSTOM roles) -->
				<CommonAppButton
					v-if="currentRole?.type === 'CUSTOM'"
					variant="outline"
					full-width
					class="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20"
					@click="selectedRoleId && openDeleteConfirm(selectedRoleId)"
				>
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
					</svg>
					Xóa vai trò
				</CommonAppButton>
			</div>
		</div>
	</div>

	<!-- Create role modal -->
	<RoleCreateModal
		v-if="showCreateModal"
		@close="showCreateModal = false"
		@created="onRoleCreated"
	/>

	<!-- Add user modal -->
	<RoleAddUserModal
		v-if="showAddUserModal && selectedRoleId"
		:role-id="selectedRoleId"
		:existing-employees="roleEmployees"
		@close="showAddUserModal = false"
		@added="showAddUserModal = false; loadEmployees()"
	/>

	<!-- Delete confirm modal -->
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
				v-if="confirmDeleteId"
				class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
				@click.self="confirmDeleteId = null"
			>
				<div
					class="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl border border-gray-200 dark:border-gray-700"
				>
					<div class="flex items-start gap-4">
						<div class="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
							<svg class="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
							</svg>
						</div>
						<div>
							<h3 class="font-semibold text-gray-900 dark:text-white">Xóa vai trò</h3>
							<p class="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
								Bạn có chắc muốn xóa vai trò này? Hành động không thể hoàn tác.
							</p>
						</div>
					</div>
					<div class="flex justify-end gap-3 mt-6">
						<CommonAppButton variant="outline" @click="confirmDeleteId = null">Hủy</CommonAppButton>
						<CommonAppButton variant="danger" :loading="deleting" @click="onDeleteRole">Xóa vai trò</CommonAppButton>
					</div>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>
