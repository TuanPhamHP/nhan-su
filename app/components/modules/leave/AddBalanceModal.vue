<script setup lang="ts">
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import * as z from 'zod';
import { useLeaveBalanceService } from '~/services/leave-balance.service';
import { useEmployeeService } from '~/services/employee.service';
import type { LeaveType, LeaveBalance } from '~/types/leave.types';
import type { EmployeeSummary } from '~/types/employee.types';

const props = defineProps<{ leaveTypes: LeaveType[] }>();
const emit = defineEmits<{ created: [balance: LeaveBalance]; close: [] }>();

const balanceService = useLeaveBalanceService();
const employeeService = useEmployeeService();
const toast = useToast();

const currentYear = new Date().getFullYear();
const employees = ref<EmployeeSummary[]>([]);
const searchQuery = ref('');
const loadingEmployees = ref(false);

const limitedLeaveTypes = computed(() => props.leaveTypes.filter(t => t.daysPerYear !== null && t.isActive));

async function searchEmployees(q: string) {
	loadingEmployees.value = true;
	try {
		const res = await employeeService.findAll({ search: q || undefined, status: 'ACTIVE', limit: 50 });
		employees.value = res.data;
	} catch {
		employees.value = [];
	} finally {
		loadingEmployees.value = false;
	}
}

const employeeOptions = computed(() =>
	employees.value.map(e => ({
		value: e.id,
		label: `${e.fullName} (${e.employeeCode})`,
	})),
);

const schema = toTypedSchema(
	z.object({
		employeeId: z.number({ required_error: 'Vui lòng chọn nhân viên' }).positive(),
		leaveTypeId: z.number({ required_error: 'Vui lòng chọn loại phép' }).positive(),
		year: z.number().int().min(2020).max(2100),
		totalDays: z.number().positive('Số ngày phải lớn hơn 0').int('Số ngày phải là số nguyên'),
	}),
);

const { handleSubmit, defineField, errors, isSubmitting, setValues } = useForm({ validationSchema: schema });

const [employeeId, employeeIdAttrs] = defineField('employeeId');
const [leaveTypeId, leaveTypeIdAttrs] = defineField('leaveTypeId');
const [year, yearAttrs] = defineField('year');
const [totalDays, totalDaysAttrs] = defineField('totalDays');

setValues({ year: currentYear });

const onSubmit = handleSubmit(async values => {
	try {
		const balance = await balanceService.create({
			employeeId: values.employeeId,
			leaveTypeId: values.leaveTypeId,
			year: values.year,
			totalDays: values.totalDays,
		});
		toast.success('Đã thêm số dư phép');
		emit('created', balance);
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
	}
});

onMounted(() => searchEmployees(''));

watch(searchQuery, q => searchEmployees(q));
</script>

<template>
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
		<div class="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md">
			<!-- Header -->
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h2 class="text-base font-semibold text-gray-900 dark:text-white">Thêm số dư phép thủ công</h2>
				<button
					class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
					@click="emit('close')"
				>
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<form class="px-6 py-5 space-y-4" @submit.prevent="onSubmit">
				<!-- Employee search -->
				<div class="space-y-1.5">
					<label class="text-sm font-medium text-gray-700 dark:text-gray-300">
						Nhân viên <span class="text-red-500">*</span>
					</label>
					<UiSelectInput
						:model-value="employeeId ?? 0"
						:options="[{ value: 0, label: 'Chọn nhân viên...' }, ...employeeOptions]"
						placeholder="Tìm nhân viên..."
						search-placeholder="Tìm theo tên, mã..."
						v-bind="employeeIdAttrs"
						@update:model-value="employeeId = $event === 0 ? undefined : ($event as number)"
					/>
					<p v-if="errors.employeeId" class="text-xs text-red-500">{{ errors.employeeId }}</p>
				</div>

				<!-- Leave type -->
				<div class="space-y-1.5">
					<label class="text-sm font-medium text-gray-700 dark:text-gray-300">
						Loại phép <span class="text-red-500">*</span>
					</label>
					<UiSelect
						:model-value="leaveTypeId"
						:options="[
							{ value: undefined, label: 'Chọn loại phép...' },
							...limitedLeaveTypes.map(t => ({ value: t.id, label: t.name })),
						]"
						v-bind="leaveTypeIdAttrs"
						placeholder="Chọn loại phép..."
						@update:model-value="leaveTypeId = $event as number"
					/>
					<p v-if="errors.leaveTypeId" class="text-xs text-red-500">{{ errors.leaveTypeId }}</p>
				</div>

				<!-- Year -->
				<CommonAppInput
					v-model.number="year"
					v-bind="yearAttrs"
					label="Năm"
					type="number"
					:error="errors.year"
					required
				/>

				<!-- Total days -->
				<CommonAppInput
					v-model.number="totalDays"
					v-bind="totalDaysAttrs"
					label="Tổng số ngày phép"
					type="number"
					placeholder="12"
					:error="errors.totalDays"
					required
				/>

				<div class="flex items-center justify-end gap-3 pt-2">
					<CommonAppButton variant="outline" @click="emit('close')">Huỷ</CommonAppButton>
					<CommonAppButton type="submit" :loading="isSubmitting">Thêm</CommonAppButton>
				</div>
			</form>
		</div>
	</div>
</template>
