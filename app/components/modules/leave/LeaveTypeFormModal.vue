<script setup lang="ts">
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import * as z from 'zod';
import { useLeaveTypeService } from '~/services/leave-type.service';
import type { LeaveType } from '~/types/leave.types';

const props = withDefaults(
	defineProps<{
		editTarget?: LeaveType;
	}>(),
	{ editTarget: undefined },
);

const emit = defineEmits<{ saved: [leaveType: LeaveType]; close: [] }>();

const service = useLeaveTypeService();
const toast = useToast();
const isEdit = computed(() => !!props.editTarget);

const schema = toTypedSchema(
	z.object({
		name: z.string().min(2, 'Tên phải có ít nhất 2 ký tự').max(100, 'Tên tối đa 100 ký tự'),
		code: z
			.string()
			.min(1, 'Mã không được trống')
			.max(20, 'Mã tối đa 20 ký tự')
			.regex(/^[A-Z0-9_]+$/, 'Mã chỉ được chứa chữ hoa, số và dấu gạch dưới'),
		isPaid: z.boolean(),
		unlimitedDays: z.boolean(),
		daysPerYear: z.number().int().positive('Số ngày phải lớn hơn 0').nullable().optional(),
	}),
);

const { handleSubmit, defineField, errors, isSubmitting, setValues } = useForm({ validationSchema: schema });

const [name, nameAttrs] = defineField('name');
const [code, codeAttrs] = defineField('code');
const [isPaid, isPaidAttrs] = defineField('isPaid');
const [unlimitedDays, unlimitedDaysAttrs] = defineField('unlimitedDays');
const [daysPerYear, daysPerYearAttrs] = defineField('daysPerYear');

onMounted(() => {
	if (props.editTarget) {
		setValues({
			name: props.editTarget.name,
			code: props.editTarget.code,
			isPaid: props.editTarget.isPaid,
			unlimitedDays: props.editTarget.daysPerYear === null,
			daysPerYear: props.editTarget.daysPerYear ?? undefined,
		});
	} else {
		setValues({ isPaid: true, unlimitedDays: false });
	}
});

function onCodeInput(e: Event) {
	const val = (e.target as HTMLInputElement).value.toUpperCase().replace(/[^A-Z0-9_]/g, '');
	code.value = val;
}

const onSubmit = handleSubmit(async values => {
	const dto = {
		name: values.name,
		code: values.code,
		isPaid: values.isPaid,
		daysPerYear: values.unlimitedDays ? null : (values.daysPerYear ?? null),
	};

	try {
		let result: LeaveType;
		if (isEdit.value && props.editTarget) {
			result = await service.update(props.editTarget.id, dto);
			toast.success('Đã cập nhật loại phép');
		} else {
			result = await service.create(dto);
			toast.success('Đã thêm loại phép mới');
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
					{{ isEdit ? 'Chỉnh sửa loại phép' : 'Thêm loại phép mới' }}
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
				<!-- Name -->
				<CommonAppInput
					v-model="name"
					v-bind="nameAttrs"
					label="Tên loại phép"
					placeholder="VD: Nghỉ phép năm"
					required
					:error="errors.name"
				/>

				<!-- Code -->
				<div class="space-y-1.5">
					<label class="text-sm font-medium text-gray-700 dark:text-gray-300">
						Mã loại phép <span class="text-red-500">*</span>
					</label>
					<input
						:value="code"
						v-bind="codeAttrs"
						type="text"
						placeholder="VD: ANNUAL"
						:class="[
							'block w-full rounded-lg border px-3 py-2.5 text-sm font-mono uppercase transition-colors',
							'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 placeholder:normal-case placeholder:font-sans',
							'focus:outline-none focus:ring-2 focus:ring-offset-0',
							errors.code
								? 'border-red-400 focus:ring-red-300'
								: 'border-gray-300 focus:border-brand-500 focus:ring-brand-200 dark:border-gray-600',
						]"
						@input="onCodeInput"
					/>
					<p v-if="errors.code" class="text-xs text-red-500">{{ errors.code }}</p>
					<p v-else class="text-xs text-gray-400">ANNUAL / HALF_DAY / LATE / EARLY là mã hệ thống</p>
				</div>

				<!-- Days per year -->
				<div class="space-y-2">
					<label class="text-sm font-medium text-gray-700 dark:text-gray-300">Số ngày / năm</label>
					<label class="flex items-center gap-2 cursor-pointer">
						<input
							v-model="unlimitedDays"
							v-bind="unlimitedDaysAttrs"
							type="checkbox"
							class="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
						/>
						<span class="text-sm text-gray-700 dark:text-gray-300">Không giới hạn</span>
					</label>
					<input
						v-if="!unlimitedDays"
						v-model.number="daysPerYear"
						v-bind="daysPerYearAttrs"
						type="number"
						min="1"
						max="365"
						placeholder="12"
						:class="[
							'block w-full rounded-lg border px-3 py-2.5 text-sm transition-colors',
							'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400',
							'focus:outline-none focus:ring-2 focus:ring-offset-0',
							errors.daysPerYear
								? 'border-red-400 focus:ring-red-300'
								: 'border-gray-300 focus:border-brand-500 focus:ring-brand-200 dark:border-gray-600',
						]"
					/>
					<p v-if="errors.daysPerYear" class="text-xs text-red-500">{{ errors.daysPerYear }}</p>
				</div>

				<!-- isPaid toggle -->
				<div class="flex items-center justify-between py-1">
					<div>
						<p class="text-sm font-medium text-gray-700 dark:text-gray-300">Có tính lương</p>
						<p class="text-xs text-gray-400 dark:text-gray-500">Nghỉ loại này vẫn được hưởng lương</p>
					</div>
					<button
						type="button"
						v-bind="isPaidAttrs"
						:class="[
							'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
							isPaid ? 'bg-brand-600' : 'bg-gray-200 dark:bg-gray-600',
						]"
						@click="isPaid = !isPaid"
					>
						<span
							:class="[
								'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200',
								isPaid ? 'translate-x-5' : 'translate-x-0',
							]"
						/>
					</button>
				</div>

				<div class="flex items-center justify-end gap-3 pt-2">
					<CommonAppButton variant="outline" @click="emit('close')">Huỷ</CommonAppButton>
					<CommonAppButton type="submit" :loading="isSubmitting">
						{{ isEdit ? 'Lưu thay đổi' : 'Thêm loại phép' }}
					</CommonAppButton>
				</div>
			</form>
		</div>
	</div>
</template>
