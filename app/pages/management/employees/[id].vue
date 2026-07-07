<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { formatDate, formatDateTime } from '~/utils/date';
	import type { UpdateEmployeeDto, EmployeeGender, EmployeeSummary } from '~/types/employee.types';
	import type { UserRole } from '~/types/auth.types';
	import { usePositionService } from '~/services/position.service';
	import { useEmployeeService } from '~/services/employee.service';
	import type { PositionSummary } from '~/types/position.types';
	import EmployeeEmployeeStatusBadge from '@/components/modules/employee/EmployeeStatusBadge.vue';
	import EmployeeDocuments from '~/components/modules/employee/EmployeeDocuments.vue';
	import EmployeeContracts from '~/components/modules/employee/EmployeeContracts.vue';
	import EmployeeSocialInsurance from '~/components/modules/employee/EmployeeSocialInsurance.vue';

	definePageMeta({ title: 'Chi tiết nhân viên' });

	const route = useRoute();
	const toast = useToast();
	const id = Number(route.params.id);
	const authStore = useAuthStore();

	const canEdit = computed(() => authStore.user?.role === 'HR' || authStore.user?.role === 'ADMIN');

	const { currentEmployee, detailLoading, fetchOne, update, deactivate, resetPassword } = useEmployee();
	const { departments, fetchAll: fetchDepartments } = useDepartment();
	const positionService = usePositionService();
	const employeeService = useEmployeeService();

	const positions = ref<PositionSummary[]>([]);
	const allEmployees = ref<EmployeeSummary[]>([]);

	async function loadAllEmployees() {
		try {
			const res = await employeeService.findAll({ pagination: false, status: 'ACTIVE' });
			allEmployees.value = res.data;
		} catch {
			allEmployees.value = [];
		}
	}

	async function loadPositions(departmentId?: number) {
		try {
			positions.value = await positionService.findActive(departmentId);
		} catch {
			positions.value = [];
		}
	}

	const validTabs = ['info', 'documents', 'contracts', 'social-insurance'] as const;
	type TabId = (typeof validTabs)[number];
	const activeTab = ref<TabId>(
		validTabs.includes(route.query.tab as TabId) ? (route.query.tab as TabId) : 'info',
	);
	const isEditing = ref(route.query.edit === 'true');
	const confirmDeactivate = ref(false);
	const deactivating = ref(false);
	const confirmResetPassword = ref(false);
	const resettingPassword = ref(false);

	onMounted(async () => {
		await Promise.all([
			fetchOne(id).catch((e: unknown) =>
				toast.error(e instanceof Error ? e.message : 'Không tải được thông tin nhân viên'),
			),
			fetchDepartments(),
			loadPositions(),
			loadAllEmployees(),
		]);
		if (isEditing.value) resetFormFromEmployee();
	});

	// ─── Form ────────────────────────────────────────────────────────────────────

	const { handleSubmit, defineField, errors, isSubmitting, resetForm } = useForm<{
		fullName: string;
		phone: string;
		joinDate: string;
		role: UserRole;
		departmentId: number | undefined;
		positionId: number | undefined;
		managerId: number | undefined;
		gender: EmployeeGender | '';
		dateOfBirth: string;
		address: string;
	}>({
		validationSchema: {
			fullName: (v: string) => (v && v.trim().length >= 2 ? true : 'Tối thiểu 2 ký tự'),
			phone: (v: string) => (!v || /^[0-9]{9,11}$/.test(v) ? true : 'Số điện thoại không hợp lệ (9-11 chữ số)'),
		},
	});

	const [fullName, fullNameAttrs] = defineField('fullName');
	const [phone, phoneAttrs] = defineField('phone');
	const [joinDate] = defineField('joinDate');
	const [role] = defineField('role');
	const [departmentId] = defineField('departmentId');
	const [positionId] = defineField('positionId');
	const [managerId] = defineField('managerId');
	const [gender] = defineField('gender');

	watch(departmentId, val => {
		positionId.value = undefined;
		loadPositions(val as number | undefined);
	});
	const [dateOfBirth] = defineField('dateOfBirth');
	const [address, addressAttrs] = defineField('address');

	function resetFormFromEmployee() {
		const emp = currentEmployee.value;
		if (!emp) return;
		const deptId = emp.department?.id ?? undefined;
		resetForm({
			values: {
				fullName: emp.fullName,
				phone: emp.phone ?? '',
				joinDate: emp.joinDate,
				role: emp.role,
				departmentId: deptId,
				positionId: emp.position?.id ?? undefined,
				managerId: emp.manager?.id ?? undefined,
				gender: emp.gender ?? '',
				dateOfBirth: emp.dateOfBirth ?? '',
				address: emp.address ?? '',
			},
		});
		loadPositions(deptId);
	}

	function startEditing() {
		resetFormFromEmployee();
		isEditing.value = true;
	}

	function cancelEditing() {
		isEditing.value = false;
	}

	const onSubmit = handleSubmit(async values => {
		const payload: UpdateEmployeeDto = {
			fullName: values.fullName,
			phone: values.phone || undefined,
			joinDate: values.joinDate,
			role: values.role,
			departmentId: values.departmentId ? Number(values.departmentId) : undefined,
			positionId: values.positionId ? Number(values.positionId) : undefined,
			managerId: values.managerId ? Number(values.managerId) : undefined,
			gender: (values.gender as EmployeeGender) || undefined,
			dateOfBirth: values.dateOfBirth || undefined,
			address: values.address || undefined,
		};
		try {
			await update(id, payload);
			toast.success('Cập nhật thông tin thành công');
			isEditing.value = false;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi cập nhật thông tin');
		}
	});

	async function handleResetPassword() {
		resettingPassword.value = true;
		try {
			const message = await resetPassword(id);
			toast.success(message || 'Mật khẩu đã được đặt lại và gửi qua email');
			confirmResetPassword.value = false;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi đặt lại mật khẩu');
		} finally {
			resettingPassword.value = false;
		}
	}

	async function handleDeactivate() {
		deactivating.value = true;
		try {
			await deactivate(id);
			toast.success('Đã vô hiệu hóa nhân viên');
			confirmDeactivate.value = false;
			navigateTo('/management/employees');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi vô hiệu hóa nhân viên');
		} finally {
			deactivating.value = false;
		}
	}

	// ─── Static options ───────────────────────────────────────────────────────────

	const metaDataStore = useMetaDataStore();
	metaDataStore.load().catch(() => { /* metadata not critical */ });
	const { roles: roleOptions } = storeToRefs(metaDataStore);

	const genderOptions = [
		{ value: undefined, label: '-- Không rõ --' },
		{ value: 'Nam', label: 'Nam' },
		{ value: 'Nữ', label: 'Nữ' },
		{ value: 'Khác', label: 'Khác' },
	];

	const departmentOptions = computed(() => [
		{ value: undefined as number | undefined, label: '-- Không thuộc phòng ban --' },
		...departments.value.map(d => ({ value: d.id as number | undefined, label: d.name })),
	]);

	const positionOptions = computed(() => [
		{ value: undefined as number | undefined, label: '-- Không có chức vụ --' },
		...positions.value.map(p => ({ value: p.id as number | undefined, label: p.name })),
	]);

	const managerOptions = computed(() => [
		{ value: 0, label: '— Không có quản lý —' },
		...allEmployees.value
			.filter(e => e.id !== id)
			.map(e => ({ value: e.id, label: `${e.fullName} (${e.employeeCode})` })),
	]);

	const roleLabel = computed(() => {
		const emp = currentEmployee.value;
		if (!emp) return '—';
		return metaDataStore.labelForRole(emp.role);
	});

	const inputCls =
		'block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm px-3 py-2.5 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50';
	const labelCls = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1';
	const valueCls = 'text-sm text-gray-900 dark:text-white';
</script>

<template>
	<div class="space-y-6">
		<!-- Back + actions header -->
		<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
			<NuxtLink
				to="/management/employees"
				class="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
			>
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
				</svg>
				Danh sách nhân viên
			</NuxtLink>

			<div v-if="currentEmployee && (activeTab === 'info') && !isEditing" class="flex items-center gap-2">
				<CommonAppButton variant="primary" @click="startEditing">
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
						/>
					</svg>
					Chỉnh sửa
				</CommonAppButton>
				<CommonAppButton v-if="canEdit" variant="danger_outline" @click="confirmResetPassword = true">
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
						/>
					</svg>
					Reset mật khẩu
				</CommonAppButton>
				<CommonAppButton
					v-if="currentEmployee.status !== 'INACTIVE'"
					variant="danger"
					@click="confirmDeactivate = true"
				>
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
						/>
					</svg>
					Vô hiệu hóa
				</CommonAppButton>
			</div>
		</div>

		<!-- Loading state -->
		<div
			v-if="detailLoading"
			class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 space-y-4"
		>
			<div class="flex items-center gap-4">
				<div class="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
				<div class="space-y-2">
					<div class="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
					<div class="h-3.5 w-24 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
				</div>
			</div>
			<div class="grid grid-cols-2 gap-4 pt-2">
				<div v-for="i in 6" :key="i" class="space-y-1.5">
					<div class="h-3 w-20 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
					<div class="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
				</div>
			</div>
		</div>

		<!-- Not found -->
		<div v-else-if="!currentEmployee && !detailLoading" class="flex flex-col items-center justify-center py-20">
			<p class="text-gray-500 dark:text-gray-400">Không tìm thấy nhân viên</p>
			<NuxtLink to="/management/employees" class="mt-3">
				<CommonAppButton variant="outline" size="sm">Quay lại danh sách</CommonAppButton>
			</NuxtLink>
		</div>

		<template v-else-if="currentEmployee">
			<!-- Profile header card -->
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
				<div class="flex flex-col sm:flex-row sm:items-center gap-4">
					<img
						v-if="currentEmployee.avatarUrl"
						:src="currentEmployee.avatarUrl"
						:alt="currentEmployee.fullName"
						class="w-16 h-16 rounded-full object-cover flex-shrink-0 border border-gray-200 dark:border-gray-700"
					/>
					<div
						v-else
						class="w-16 h-16 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0"
					>
						<span class="text-2xl font-bold text-brand-600 dark:text-brand-400">
							{{ currentEmployee.fullName.charAt(0).toUpperCase() }}
						</span>
					</div>
					<div class="flex-1 min-w-0">
						<div class="flex flex-wrap items-center gap-2">
							<h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ currentEmployee.fullName }}</h2>
							<EmployeeEmployeeStatusBadge :status="currentEmployee.status" />
						</div>
						<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
							{{ currentEmployee.email }}
							<span class="mx-1.5">·</span>
							<span class="font-mono text-xs">{{ currentEmployee.employeeCode }}</span>
						</p>
					</div>
				</div>
			</div>

			<!-- Tab bar -->
			<div class="border-b border-gray-200 dark:border-gray-700">
				<nav class="-mb-px flex gap-1">
					<button
						type="button"
						class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors"
						:class="
							activeTab === 'info'
								? 'border-brand-500 text-brand-600 dark:text-brand-400'
								: 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
						"
						@click="activeTab = 'info'"
					>
						Thông tin
					</button>
					<button
						type="button"
						class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors"
						:class="
							activeTab === 'documents'
								? 'border-brand-500 text-brand-600 dark:text-brand-400'
								: 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
						"
						@click="
							activeTab = 'documents';
							isEditing = false;
						"
					>
						Tài liệu
					</button>
					<button
						type="button"
						class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors"
						:class="
							activeTab === 'contracts'
								? 'border-brand-500 text-brand-600 dark:text-brand-400'
								: 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
						"
						@click="
							activeTab = 'contracts';
							isEditing = false;
						"
					>
						Hợp đồng
					</button>
					<button
						type="button"
						class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors"
						:class="
							activeTab === 'social-insurance'
								? 'border-brand-500 text-brand-600 dark:text-brand-400'
								: 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
						"
						@click="
							activeTab = 'social-insurance';
							isEditing = false;
						"
					>
						BHXH &amp; Thuế
					</button>
				</nav>
			</div>

			<!-- Tab: Thông tin -->
			<template v-if="activeTab === 'info'">
				<!-- View mode -->
				<div
					v-if="!isEditing"
					class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm"
				>
					<div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
						<h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Thông tin cá nhân</h3>
					</div>
					<div class="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
						<div>
							<p :class="labelCls">Mã nhân viên</p>
							<p :class="[valueCls, 'font-mono']">{{ currentEmployee.employeeCode }}</p>
						</div>
						<div>
							<p :class="labelCls">Họ và tên</p>
							<p :class="valueCls">{{ currentEmployee.fullName }}</p>
						</div>
						<div>
							<p :class="labelCls">Email</p>
							<p :class="valueCls">{{ currentEmployee.email }}</p>
						</div>
						<div>
							<p :class="labelCls">Số điện thoại</p>
							<p :class="valueCls">{{ currentEmployee.phone ?? '—' }}</p>
						</div>
						<div>
							<p :class="labelCls">Nhóm quyền</p>
							<p :class="valueCls">{{ roleLabel }}</p>
						</div>
						<div>
							<p :class="labelCls">Phòng ban</p>
							<p :class="valueCls">{{ currentEmployee.department?.name ?? '—' }}</p>
						</div>
						<div>
							<p :class="labelCls">Chức vụ</p>
							<p :class="valueCls">{{ currentEmployee.position?.name ?? '—' }}</p>
						</div>
						<div>
							<p :class="labelCls">Quản lý trực tiếp</p>
							<NuxtLink
								v-if="currentEmployee.manager"
								:to="`/management/employees/${currentEmployee.manager.id}`"
								class="text-sm text-brand-600 dark:text-brand-400 hover:underline"
							>
								{{ currentEmployee.manager.fullName }}
							</NuxtLink>
							<p v-else :class="valueCls">—</p>
						</div>
						<div>
							<p :class="labelCls">Ngày vào làm</p>
							<p :class="valueCls">{{ formatDate(currentEmployee.joinDate) }}</p>
						</div>
						<div>
							<p :class="labelCls">Ngày sinh</p>
							<p :class="valueCls">{{ formatDate(currentEmployee.dateOfBirth) }}</p>
						</div>
						<div>
							<p :class="labelCls">Giới tính</p>
							<p :class="valueCls">{{ currentEmployee.gender ?? '—' }}</p>
						</div>
						<div class="sm:col-span-2">
							<p :class="labelCls">Địa chỉ</p>
							<p :class="valueCls">{{ currentEmployee.address ?? '—' }}</p>
						</div>
						<div>
							<p :class="labelCls">Ngày tạo</p>
							<p :class="valueCls">{{ formatDateTime(currentEmployee.createdAt) }}</p>
						</div>
					</div>
				</div>

				<!-- Edit form -->
				<form
					v-else
					class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm"
					@submit.prevent="onSubmit"
				>
					<div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
						<h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Chỉnh sửa thông tin</h3>
					</div>

					<div class="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
						<!-- Full name -->
						<div class="sm:col-span-2">
							<label :class="labelCls">Họ và tên <span class="text-red-500">*</span></label>
							<input
								v-model="fullName"
								v-bind="fullNameAttrs"
								:class="[inputCls, errors.fullName ? 'border-red-400 focus:ring-red-300' : '']"
								placeholder="Nhập họ và tên"
							/>
							<p v-if="errors.fullName" class="mt-1 text-xs text-red-500">{{ errors.fullName }}</p>
						</div>

						<!-- Phone -->
						<div>
							<label :class="labelCls">Số điện thoại</label>
							<input
								v-model="phone"
								v-bind="phoneAttrs"
								:class="[inputCls, errors.phone ? 'border-red-400 focus:ring-red-300' : '']"
								placeholder="09xxxxxxxx"
							/>
							<p v-if="errors.phone" class="mt-1 text-xs text-red-500">{{ errors.phone }}</p>
						</div>

						<!-- Join date -->
						<div>
							<label :class="labelCls">Ngày vào làm</label>
							<UiDatePicker v-model="joinDate" />
						</div>

						<!-- Role -->
						<div>
							<label :class="labelCls">Vai trò</label>
							<UiSelect v-model="role" :options="roleOptions" />
						</div>

						<!-- Department -->
						<div>
							<label :class="labelCls">Phòng ban</label>
							<UiSelect v-model="departmentId" :options="departmentOptions" />
						</div>

						<!-- Position -->
						<div>
							<label :class="labelCls">Chức vụ</label>
							<UiSelect v-model="positionId" :options="positionOptions" />
						</div>

						<!-- Manager -->
						<div>
							<label :class="labelCls">Quản lý trực tiếp</label>
							<UiSelectInput
								:model-value="managerId ?? 0"
								:options="managerOptions"
								placeholder="— Không có quản lý —"
								search-placeholder="Tìm nhân viên..."
								@update:model-value="managerId = $event === 0 ? undefined : ($event as number)"
							/>
						</div>

						<!-- Gender -->
						<div>
							<label :class="labelCls">Giới tính</label>
							<UiSelect v-model="gender" :options="genderOptions" />
						</div>

						<!-- Date of birth -->
						<div>
							<label :class="labelCls">Ngày sinh</label>
							<UiDatePicker v-model="dateOfBirth" />
						</div>

						<!-- Address -->
						<div class="sm:col-span-2">
							<label :class="labelCls">Địa chỉ</label>
							<input v-model="address" v-bind="addressAttrs" :class="inputCls" placeholder="Nhập địa chỉ" />
						</div>
					</div>

					<div class="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
						<CommonAppButton type="button" variant="outline" @click="cancelEditing">Hủy</CommonAppButton>
						<CommonAppButton type="submit" :loading="isSubmitting">Lưu thay đổi</CommonAppButton>
					</div>
				</form>
			</template>

			<!-- Tab: Tài liệu -->
			<EmployeeDocuments v-else-if="activeTab === 'documents'" :employee-id="id" :readonly="!canEdit" />

			<!-- Tab: Hợp đồng -->
			<div
				v-else-if="activeTab === 'contracts'"
				class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6"
			>
				<EmployeeContracts :employee-id="id" />
			</div>

			<!-- Tab: BHXH & Thuế -->
			<EmployeeSocialInsurance v-else-if="activeTab === 'social-insurance'" :employee-id="id" />
		</template>

		<!-- Confirm reset password modal -->
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
					v-if="confirmResetPassword"
					class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
					@click.self="confirmResetPassword = false"
				>
					<div
						class="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl border border-gray-200 dark:border-gray-700"
					>
						<div class="flex items-start gap-4">
							<div
								class="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0"
							>
								<svg
									class="w-5 h-5 text-amber-600 dark:text-amber-400"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
									/>
								</svg>
							</div>
							<div>
								<h3 class="font-semibold text-gray-900 dark:text-white">Reset mật khẩu</h3>
								<p class="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
									Mật khẩu của
									<strong class="text-gray-700 dark:text-gray-300">{{ currentEmployee?.fullName }}</strong>
									sẽ được đặt lại theo mặc định và gửi về email
									<strong class="text-gray-700 dark:text-gray-300">{{ currentEmployee?.email }}</strong
									>.
								</p>
							</div>
						</div>
						<div class="flex justify-end gap-3 mt-6">
							<CommonAppButton variant="outline" @click="confirmResetPassword = false">Hủy</CommonAppButton>
							<CommonAppButton :loading="resettingPassword" @click="handleResetPassword">
								Xác nhận reset
							</CommonAppButton>
						</div>
					</div>
				</div>
			</Transition>
		</Teleport>

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
					v-if="confirmDeactivate"
					class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
					@click.self="confirmDeactivate = false"
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
									<strong class="text-gray-700 dark:text-gray-300">{{ currentEmployee?.fullName }}</strong>
									sẽ không thể đăng nhập hệ thống. Bạn có thể kích hoạt lại bất kỳ lúc nào.
								</p>
							</div>
						</div>
						<div class="flex justify-end gap-3 mt-6">
							<CommonAppButton variant="outline" @click="confirmDeactivate = false">Hủy</CommonAppButton>
							<CommonAppButton variant="danger" :loading="deactivating" @click="handleDeactivate">
								Xác nhận
							</CommonAppButton>
						</div>
					</div>
				</div>
			</Transition>
		</Teleport>
	</div>
</template>
