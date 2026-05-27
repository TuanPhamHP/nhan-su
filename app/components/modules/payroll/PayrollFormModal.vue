<script setup lang="ts">
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import * as z from 'zod';
import { usePayrollService } from '~/services/payroll.service';
import { useEmployeeService } from '~/services/employee.service';
import type { PayrollSummary, PayrollDetail } from '~/types/payroll.types';
import type { EmployeeSummary } from '~/types/employee.types';

const props = withDefaults(
	defineProps<{
		editTarget?: PayrollSummary;
	}>(),
	{ editTarget: undefined },
);

const emit = defineEmits<{ saved: [payroll: PayrollDetail]; close: [] }>();

const payrollService = usePayrollService();
const employeeService = useEmployeeService();
const toast = useToast();
const isEdit = computed(() => !!props.editTarget);

const employees = ref<EmployeeSummary[]>([]);

onMounted(async () => {
	const now = new Date();
	const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

	if (!isEdit.value) {
		try {
			const res = await employeeService.findAll({ limit: 200, status: 'ACTIVE' });
			employees.value = res.data;
		} catch {
			// non-critical
		}
		setValues({ month: currentMonth, allowances: 0, deductions: 0, bonus: 0 });
	} else if (props.editTarget) {
		setValues({
			month: props.editTarget.month,
			baseSalary: props.editTarget.baseSalary,
			allowances: props.editTarget.allowances,
			deductions: props.editTarget.deductions,
			bonus: props.editTarget.bonus,
		});
	}
});

const schema = toTypedSchema(
	z.object({
		employeeId: z.number({ invalid_type_error: 'Chọn nhân viên' }).optional(),
		month: z.string().min(1, 'Chọn tháng'),
		baseSalary: z
			.number({ invalid_type_error: 'Nhập lương cơ bản' })
			.min(0, 'Lương cơ bản không hợp lệ'),
		allowances: z.number().min(0).default(0),
		deductions: z.number().min(0).default(0),
		bonus: z.number().min(0).default(0),
	}),
);

const { handleSubmit, defineField, errors, isSubmitting, setValues } = useForm({ validationSchema: schema });

const [employeeId, employeeIdAttrs] = defineField('employeeId');
const [month, monthAttrs] = defineField('month');
const [baseSalary, baseSalaryAttrs] = defineField('baseSalary');
const [allowances, allowancesAttrs] = defineField('allowances');
const [deductions, deductionsAttrs] = defineField('deductions');
const [bonus, bonusAttrs] = defineField('bonus');

const previewNet = computed(() => {
	return (baseSalary.value ?? 0) + (allowances.value ?? 0) - (deductions.value ?? 0) + (bonus.value ?? 0);
});

function formatCurrency(n: number) {
	return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
}

const inputClass =
	'block w-full rounded-lg border px-3 py-2.5 text-sm transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-0 border-gray-300 focus:border-brand-500 focus:ring-brand-200 dark:border-gray-600';

const inputErrorClass =
	'block w-full rounded-lg border px-3 py-2.5 text-sm transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-0 border-red-400 focus:ring-red-300';

const onSubmit = handleSubmit(async values => {
	if (!isEdit.value && !values.employeeId) {
		toast.error('Vui lòng chọn nhân viên');
		return;
	}
	try {
		let result: PayrollDetail;
		if (isEdit.value && props.editTarget) {
			result = await payrollService.update(props.editTarget.id, {
				baseSalary: values.baseSalary,
				allowances: values.allowances,
				deductions: values.deductions,
				bonus: values.bonus,
			});
			toast.success('Đã cập nhật bảng lương');
		} else {
			result = await payrollService.create({
				employeeId: values.employeeId!,
				month: values.month,
				baseSalary: values.baseSalary,
				allowances: values.allowances ?? 0,
				deductions: values.deductions ?? 0,
				bonus: values.bonus ?? 0,
			});
			toast.success('Đã tạo bảng lương');
		}
		emit('saved', result);
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
	}
});
</script>

<template>
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
		<div class="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md">
			<!-- Header -->
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h2 class="text-base font-semibold text-gray-900 dark:text-white">
					{{ isEdit ? 'Chỉnh sửa bảng lương' : 'Tạo bảng lương' }}
				</h2>
				<button
					class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
					@click="emit('close')"
				>
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Form -->
			<form class="px-6 py-5 space-y-4" @submit.prevent="onSubmit">
				<!-- Employee (create only) -->
				<div v-if="!isEdit" class="space-y-1.5">
					<label class="text-sm font-medium text-gray-700 dark:text-gray-300">
						Nhân viên <span class="text-red-500">*</span>
					</label>
					<select
						v-model.number="employeeId"
						v-bind="employeeIdAttrs"
						:class="errors.employeeId ? inputErrorClass : inputClass"
					>
						<option :value="undefined" disabled>— Chọn nhân viên —</option>
						<option v-for="emp in employees" :key="emp.id" :value="emp.id">
							{{ emp.fullName }} ({{ emp.employeeCode }})
						</option>
					</select>
					<p v-if="errors.employeeId" class="text-xs text-red-500">{{ errors.employeeId }}</p>
				</div>

				<!-- Employee display (edit mode) -->
				<div v-else class="space-y-1.5">
					<label class="text-sm font-medium text-gray-700 dark:text-gray-300">Nhân viên</label>
					<p class="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
						{{ editTarget?.employee.fullName }} ({{ editTarget?.employee.employeeCode }})
					</p>
				</div>

				<!-- Month -->
				<div class="space-y-1.5">
					<label class="text-sm font-medium text-gray-700 dark:text-gray-300">
						Tháng <span class="text-red-500">*</span>
					</label>
					<input
						v-model="month"
						v-bind="monthAttrs"
						type="month"
						:disabled="isEdit"
						:class="[errors.month ? inputErrorClass : inputClass, isEdit ? 'opacity-60 cursor-not-allowed' : '']"
					/>
					<p v-if="errors.month" class="text-xs text-red-500">{{ errors.month }}</p>
				</div>

				<!-- Salary fields grid -->
				<div class="grid grid-cols-2 gap-3">
					<!-- Base salary -->
					<div class="col-span-2 space-y-1.5">
						<label class="text-sm font-medium text-gray-700 dark:text-gray-300">
							Lương cơ bản <span class="text-red-500">*</span>
						</label>
						<input
							v-model.number="baseSalary"
							v-bind="baseSalaryAttrs"
							type="number"
							min="0"
							step="100000"
							placeholder="0"
							:class="errors.baseSalary ? inputErrorClass : inputClass"
						/>
						<p v-if="errors.baseSalary" class="text-xs text-red-500">{{ errors.baseSalary }}</p>
					</div>

					<!-- Allowances -->
					<div class="space-y-1.5">
						<label class="text-sm font-medium text-gray-700 dark:text-gray-300">Phụ cấp</label>
						<input
							v-model.number="allowances"
							v-bind="allowancesAttrs"
							type="number"
							min="0"
							step="100000"
							placeholder="0"
							:class="errors.allowances ? inputErrorClass : inputClass"
						/>
					</div>

					<!-- Deductions -->
					<div class="space-y-1.5">
						<label class="text-sm font-medium text-gray-700 dark:text-gray-300">Khấu trừ</label>
						<input
							v-model.number="deductions"
							v-bind="deductionsAttrs"
							type="number"
							min="0"
							step="100000"
							placeholder="0"
							:class="errors.deductions ? inputErrorClass : inputClass"
						/>
					</div>

					<!-- Bonus -->
					<div class="col-span-2 space-y-1.5">
						<label class="text-sm font-medium text-gray-700 dark:text-gray-300">Thưởng</label>
						<input
							v-model.number="bonus"
							v-bind="bonusAttrs"
							type="number"
							min="0"
							step="100000"
							placeholder="0"
							:class="errors.bonus ? inputErrorClass : inputClass"
						/>
					</div>
				</div>

				<!-- Net salary preview -->
				<div class="flex items-center justify-between px-4 py-3 bg-brand-50 dark:bg-brand-900/20 rounded-xl border border-brand-200 dark:border-brand-800">
					<span class="text-sm font-medium text-brand-700 dark:text-brand-300">Lương thực lĩnh (dự tính)</span>
					<span class="text-base font-bold text-brand-700 dark:text-brand-300">{{ formatCurrency(previewNet) }}</span>
				</div>

				<div class="flex items-center justify-end gap-3 pt-1">
					<CommonAppButton variant="outline" type="button" @click="emit('close')">Huỷ</CommonAppButton>
					<CommonAppButton type="submit" :loading="isSubmitting">
						{{ isEdit ? 'Lưu thay đổi' : 'Tạo bảng lương' }}
					</CommonAppButton>
				</div>
			</form>
		</div>
	</div>
</template>
