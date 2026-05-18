<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { formatDate, formatDateTime } from '~/utils/date';
	import type { UpdateEmployeeDto, EmployeeGender } from '~/types/employee.types';
	import type { UserRole } from '~/types/auth.types';
	import EmployeeEmployeeStatusBadge from '@/components/modules/employee/EmployeeStatusBadge.vue';

	definePageMeta({ title: 'Chi tiết nhân viên' });

	const route = useRoute();
	const toast = useToast();
	const id = Number(route.params.id);

	const { currentEmployee, detailLoading, fetchOne, update, deactivate } = useEmployee();
	const { departments, fetchAll: fetchDepartments } = useDepartment();

	const isEditing = ref(route.query.edit === 'true');
	const confirmDeactivate = ref(false);
	const deactivating = ref(false);

	onMounted(async () => {
		await Promise.all([
			fetchOne(id).catch((e: unknown) =>
				toast.error(e instanceof Error ? e.message : 'Không tải được thông tin nhân viên'),
			),
			fetchDepartments(),
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
	const [gender] = defineField('gender');
	const [dateOfBirth] = defineField('dateOfBirth');
	const [address, addressAttrs] = defineField('address');

	function resetFormFromEmployee() {
		const emp = currentEmployee.value;
		if (!emp) return;
		resetForm({
			values: {
				fullName: emp.fullName,
				phone: emp.phone ?? '',
				joinDate: emp.joinDate,
				role: emp.role,
				departmentId: emp.department?.id ?? undefined,
				gender: emp.gender ?? '',
				dateOfBirth: emp.dateOfBirth ?? '',
				address: emp.address ?? '',
			},
		});
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

	async function handleDeactivate() {
		deactivating.value = true;
		try {
			await deactivate(id);
			toast.success('Đã vô hiệu hóa nhân viên');
			confirmDeactivate.value = false;
			navigateTo('/employees');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi vô hiệu hóa nhân viên');
		} finally {
			deactivating.value = false;
		}
	}

	// ─── Static options ───────────────────────────────────────────────────────────

	const roleOptions: { value: UserRole; label: string }[] = [
		{ value: 'EMPLOYEE', label: 'Nhân viên' },
		{ value: 'MANAGER', label: 'Quản lý' },
		{ value: 'HR', label: 'Nhân sự' },
		{ value: 'ADMIN', label: 'Quản trị viên' },
	];

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

	const roleLabel = computed(() => {
		const emp = currentEmployee.value;
		if (!emp) return '—';
		return roleOptions.find(r => r.value === emp.role)?.label ?? emp.role;
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
				to="/employees"
				class="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
			>
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
				</svg>
				Danh sách nhân viên
			</NuxtLink>

			<div v-if="currentEmployee && !isEditing" class="flex items-center gap-2">
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
			<NuxtLink to="/employees" class="mt-3">
				<CommonAppButton variant="outline" size="sm">Quay lại danh sách</CommonAppButton>
			</NuxtLink>
		</div>

		<template v-else-if="currentEmployee">
			<!-- Profile header card -->
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
				<div class="flex flex-col sm:flex-row sm:items-center gap-4">
					<div
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
						<p :class="labelCls">Vai trò</p>
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
