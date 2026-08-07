<script setup lang="ts">
import { useForm } from 'vee-validate';
import type { CreateEmployeeDto, EmployeeGender, EmploymentType } from '~/types/employee.types';
import type { UserRole } from '~/types/auth.types';
import { usePositionService } from '~/services/position.service';
import { useWorkShiftService } from '~/services/work-shift.service';
import { useCheckInLocationService } from '~/services/check-in-location.service';
import type { PositionSummary } from '~/types/position.types';
import type { WorkShiftResponse } from '~/types/shift.types';
import type { CheckInLocation } from '~/types/check-in-location.types';

definePageMeta({ title: 'Thêm nhân viên mới' });

const toast = useToast();
const { create } = useEmployee();
const { departments, fetchAll: fetchDepartments } = useDepartment();
const directoryStore = useDirectoryStore();
const { hasPermission } = usePermissions();
const canCreate = computed(() => hasPermission('employee:create'));
const positionService = usePositionService();
const workShiftService = useWorkShiftService();
const checkInLocationService = useCheckInLocationService();

const positions = ref<PositionSummary[]>([]);
const shifts = ref<WorkShiftResponse[]>([]);
const checkInLocations = ref<CheckInLocation[]>([]);
const selectedLocationId = ref<number | undefined>(undefined);

async function loadPositions(departmentId?: number) {
	try {
		positions.value = await positionService.findActive(departmentId);
	} catch {
		positions.value = [];
	}
}

async function loadShifts() {
	try {
		shifts.value = await workShiftService.findAll();
	} catch {
		shifts.value = [];
	}
}

async function loadCheckInLocations() {
	try {
		checkInLocations.value = await checkInLocationService.findAll();
	} catch {
		checkInLocations.value = [];
	}
}

onMounted(() => {
	fetchDepartments();
	loadPositions();
	loadShifts();
	loadCheckInLocations();
});

const { handleSubmit, defineField, errors, isSubmitting } = useForm<{
	fullName: string;
	email: string;
	password: string;
	confirmPassword: string;
	phone: string;
	joinDate: string;
	role: UserRole;
	employmentType: EmploymentType;
	departmentId: number | undefined;
	positionId: number | undefined;
	defaultShiftId: number | undefined;
	gender: EmployeeGender | '';
	dateOfBirth: string;
	address: string;
}>({
	initialValues: {
		employmentType: 'FULL_TIME',
	} as Partial<{
		fullName: string;
		email: string;
		password: string;
		confirmPassword: string;
		phone: string;
		joinDate: string;
		role: UserRole;
		employmentType: EmploymentType;
		departmentId: number | undefined;
		positionId: number | undefined;
		defaultShiftId: number | undefined;
		gender: EmployeeGender | '';
		dateOfBirth: string;
		address: string;
	}>,
	validationSchema: {
		fullName: (v: string) => (v && v.trim().length >= 2 ? true : 'Tối thiểu 2 ký tự'),
		email: (v: string) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? true : 'Email không hợp lệ'),
		password: (v: string) => (v && v.length >= 6 ? true : 'Mật khẩu tối thiểu 6 ký tự'),
		confirmPassword: (v: string, ctx: { form: { password: string } }) =>
			v === ctx.form.password ? true : 'Mật khẩu xác nhận không khớp',
		phone: (v: string) => (!v || /^[0-9]{9,11}$/.test(v) ? true : 'Số điện thoại không hợp lệ (9-11 chữ số)'),
		joinDate: (v: string) => (v ? true : 'Vui lòng chọn ngày vào làm'),
		role: (v: string) => (v ? true : 'Vui lòng chọn vai trò'),
	},
});

const [fullName, fullNameAttrs] = defineField('fullName');
const [email, emailAttrs] = defineField('email');
const [password, passwordAttrs] = defineField('password');
const [confirmPassword, confirmPasswordAttrs] = defineField('confirmPassword');
const [phone, phoneAttrs] = defineField('phone');
const [joinDate] = defineField('joinDate');
const [role] = defineField('role');
const [employmentType] = defineField('employmentType');
const [departmentId] = defineField('departmentId');
const [positionId] = defineField('positionId');
const [defaultShiftId] = defineField('defaultShiftId');
const [gender] = defineField('gender');

watch(departmentId, val => {
	positionId.value = undefined;
	loadPositions(val as number | undefined);
});
const [dateOfBirth] = defineField('dateOfBirth');
const [address, addressAttrs] = defineField('address');

const onSubmit = handleSubmit(async values => {
	// Defense-in-depth: middleware đã chặn URL nhưng vẫn re-check trước BE call.
	if (!canCreate.value) {
		toast.error('Bạn không có quyền tạo nhân viên');
		return;
	}
	const payload: CreateEmployeeDto = {
		fullName: values.fullName,
		email: values.email,
		password: values.password,
		joinDate: values.joinDate,
		role: values.role,
		employmentType: values.employmentType,
		phone: values.phone || undefined,
		departmentId: values.departmentId ? Number(values.departmentId) : undefined,
		positionId: values.positionId ? Number(values.positionId) : undefined,
		defaultShiftId: values.defaultShiftId ? Number(values.defaultShiftId) : undefined,
		gender: (values.gender as EmployeeGender) || undefined,
		dateOfBirth: values.dateOfBirth || undefined,
		address: values.address || undefined,
	};
	try {
		const emp = await create(payload);
		if (selectedLocationId.value) {
			try {
				await checkInLocationService.assignEmployee(selectedLocationId.value, emp.id);
			} catch {
				directoryStore.reset();
				toast.warning('Tạo nhân viên thành công nhưng không thể gán vị trí làm việc');
				navigateTo(`/management/employees/${emp.id}`);
				return;
			}
		}
		directoryStore.reset();
		toast.success('Thêm nhân viên thành công');
		navigateTo(`/management/employees/${emp.id}`);
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Lỗi tạo nhân viên');
	}
});

const metaDataStore = useMetaDataStore();
metaDataStore.load().catch(() => { /* metadata not critical */ });
const { roles: roleOptions, employmentTypes: employmentTypeOptions } = storeToRefs(metaDataStore);

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

const shiftOptions = computed(() => [
	{ value: undefined as number | undefined, label: '-- Không gán ca --' },
	...shifts.value
		.filter(s => s.isActive)
		.map(s => ({ value: s.id as number | undefined, label: s.name })),
]);

const locationOptions = computed(() => [
	{ value: undefined as number | undefined, label: '-- Không gán vị trí --' },
	...checkInLocations.value
		.filter(l => l.isActive)
		.map(l => ({ value: l.id as number | undefined, label: l.name })),
]);

const inputCls =
	'block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm px-3 py-2.5 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50';
const labelCls = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1';
</script>

<template>
	<div class="space-y-6">
		<!-- Header -->
		<div class="flex items-center gap-3">
			<NuxtLink
				to="/management/employees"
				class="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
			>
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
				</svg>
				Danh sách nhân viên
			</NuxtLink>
		</div>

		<form
			class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm"
			@submit.prevent="onSubmit"
		>
			<div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
				<h2 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Thêm nhân viên mới</h2>
			</div>

			<div class="p-6 space-y-6">
				<!-- Section: Thông tin tài khoản -->
				<div>
					<p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Tài khoản</p>
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
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

						<div>
							<label :class="labelCls">Email <span class="text-red-500">*</span></label>
							<input
								v-model="email"
								v-bind="emailAttrs"
								type="email"
								:class="[inputCls, errors.email ? 'border-red-400 focus:ring-red-300' : '']"
								placeholder="example@company.com"
							/>
							<p v-if="errors.email" class="mt-1 text-xs text-red-500">{{ errors.email }}</p>
						</div>

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

						<div>
							<label :class="labelCls">Mật khẩu <span class="text-red-500">*</span></label>
							<input
								v-model="password"
								v-bind="passwordAttrs"
								type="password"
								:class="[inputCls, errors.password ? 'border-red-400 focus:ring-red-300' : '']"
								placeholder="Tối thiểu 6 ký tự"
							/>
							<p v-if="errors.password" class="mt-1 text-xs text-red-500">{{ errors.password }}</p>
						</div>

						<div>
							<label :class="labelCls">Xác nhận mật khẩu <span class="text-red-500">*</span></label>
							<input
								v-model="confirmPassword"
								v-bind="confirmPasswordAttrs"
								type="password"
								:class="[inputCls, errors.confirmPassword ? 'border-red-400 focus:ring-red-300' : '']"
								placeholder="Nhập lại mật khẩu"
							/>
							<p v-if="errors.confirmPassword" class="mt-1 text-xs text-red-500">{{ errors.confirmPassword }}</p>
						</div>
					</div>
				</div>

				<!-- Section: Thông tin công việc -->
				<div>
					<p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Thông tin công việc</p>
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
						<div>
							<label :class="labelCls">Vai trò <span class="text-red-500">*</span></label>
							<UiSelect v-model="role" :options="roleOptions" />
							<p v-if="errors.role" class="mt-1 text-xs text-red-500">{{ errors.role }}</p>
						</div>

						<div>
							<label :class="labelCls">Loại hình lao động</label>
							<UiSelect v-model="employmentType" :options="employmentTypeOptions" />
						</div>

						<div>
							<label :class="labelCls">Phòng ban</label>
							<UiSelect v-model="departmentId" :options="departmentOptions" />
						</div>

						<div>
							<label :class="labelCls">Chức vụ</label>
							<UiSelect v-model="positionId" :options="positionOptions" />
						</div>

						<div>
							<label :class="labelCls">Ca làm việc mặc định</label>
							<UiSelect v-model="defaultShiftId" :options="shiftOptions" />
						</div>

						<div>
							<label :class="labelCls">Vị trí làm việc</label>
							<UiSelect v-model="selectedLocationId" :options="locationOptions" />
						</div>

						<div>
							<label :class="labelCls">Ngày vào làm <span class="text-red-500">*</span></label>
							<UiDatePicker v-model="joinDate" />
							<p v-if="errors.joinDate" class="mt-1 text-xs text-red-500">{{ errors.joinDate }}</p>
						</div>
					</div>
				</div>

				<!-- Section: Thông tin cá nhân -->
				<div>
					<p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Thông tin cá nhân</p>
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
						<div>
							<label :class="labelCls">Giới tính</label>
							<UiSelect v-model="gender" :options="genderOptions" />
						</div>

						<div>
							<label :class="labelCls">Ngày sinh</label>
							<UiDatePicker v-model="dateOfBirth" />
						</div>

						<div class="sm:col-span-2">
							<label :class="labelCls">Địa chỉ</label>
							<input v-model="address" v-bind="addressAttrs" :class="inputCls" placeholder="Nhập địa chỉ" />
						</div>
					</div>
				</div>
			</div>

			<div class="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
				<NuxtLink to="/management/employees">
					<CommonAppButton type="button" variant="outline">Hủy</CommonAppButton>
				</NuxtLink>
				<CommonAppButton
					type="submit"
					:loading="isSubmitting"
					:disabled="!canCreate"
					:title="!canCreate ? 'Bạn không có quyền tạo nhân viên' : ''"
				>
					Tạo nhân viên
				</CommonAppButton>
			</div>
		</form>
	</div>
</template>
