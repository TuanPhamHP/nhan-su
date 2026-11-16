<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import type {
		CreateEmployeeDocumentTypeDto,
		EmployeeDocumentType,
	} from '~/types/hr-profile.types';

	/**
	 * Form một loại giấy tờ trong danh mục (UI-06, lô 3a).
	 *
	 * Loại mặc định của hệ thống không đổi được mã, vì mã đó được dùng trong luồng nghiệp vụ,
	 * ví dụ ảnh thẻ căn cước gửi kèm yêu cầu thay đổi phải là loại `ID_CARD`. Tên thì vẫn sửa
	 * được để công ty gọi theo cách của mình.
	 */
	const props = withDefaults(
		defineProps<{
			target?: EmployeeDocumentType | null;
			submitting?: boolean;
		}>(),
		{ target: null, submitting: false },
	);

	const emit = defineEmits<{
		submit: [payload: CreateEmployeeDocumentTypeDto];
		close: [];
	}>();

	const schema = toTypedSchema(
		z.object({
			code: z
				.string()
				.min(2, 'Tối thiểu 2 ký tự')
				.max(50, 'Tối đa 50 ký tự')
				.regex(/^[A-Za-z0-9_]+$/, 'Mã chỉ gồm chữ không dấu, số và gạch dưới'),
			name: z.string().min(2, 'Tối thiểu 2 ký tự').max(100, 'Tối đa 100 ký tự'),
			isSensitive: z.boolean().optional(),
			employeeVisible: z.boolean().optional(),
			validityMonths: z
				.string()
				.refine(v => !v || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 240), 'Thời hạn từ 1 đến 240 tháng')
				.optional()
				.or(z.literal('')),
			sortOrder: z
				.string()
				.refine(v => !v || /^\d+$/.test(v), 'Thứ tự phải là số')
				.optional()
				.or(z.literal('')),
		}),
	);

	const { handleSubmit, defineField, errors, resetForm } = useForm({ validationSchema: schema });

	const [code, codeAttrs] = defineField('code');
	const [name, nameAttrs] = defineField('name');
	const [isSensitive] = defineField('isSensitive');
	const [employeeVisible] = defineField('employeeVisible');
	const [validityMonths, validityMonthsAttrs] = defineField('validityMonths');
	const [sortOrder, sortOrderAttrs] = defineField('sortOrder');

	onMounted(() => {
		const t = props.target;
		resetForm({
			values: {
				code: t?.code ?? '',
				name: t?.name ?? '',
				isSensitive: t?.isSensitive ?? false,
				employeeVisible: t?.employeeVisible ?? true,
				validityMonths: t?.validityMonths ? String(t.validityMonths) : '',
				sortOrder: t?.sortOrder != null ? String(t.sortOrder) : '',
			},
		});
	});

	const onSubmit = handleSubmit(v => {
		emit('submit', {
			code: v.code.toUpperCase(),
			name: v.name,
			isSensitive: !!v.isSensitive,
			employeeVisible: !!v.employeeVisible,
			validityMonths: v.validityMonths ? Number(v.validityMonths) : null,
			sortOrder: v.sortOrder ? Number(v.sortOrder) : undefined,
		});
	});

	const inputCls =
		'block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm px-3 py-2.5 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60';
	const labelCls = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1';
	const checkboxCls =
		'h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800';
</script>

<template>
	<Teleport to="body">
		<div
			class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
			@click.self="emit('close')"
		>
			<div
				class="my-8 w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
			>
				<div class="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-700">
					<h3 class="text-base font-semibold text-gray-900 dark:text-white">
						{{ target ? 'Sửa loại giấy tờ' : 'Thêm loại giấy tờ' }}
					</h3>
					<button
						type="button"
						class="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
						@click="emit('close')"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<form class="space-y-4 p-6" @submit.prevent="onSubmit">
					<div>
						<label :class="labelCls">Mã loại <span class="text-red-500">*</span></label>
						<input
							v-model="code"
							v-bind="codeAttrs"
							:class="[inputCls, 'font-mono uppercase', errors.code ? 'border-red-400' : '']"
							:disabled="!!target?.isSystem"
							placeholder="VD WORK_PERMIT"
						/>
						<p v-if="errors.code" class="mt-1 text-xs text-red-500">{{ errors.code }}</p>
						<p v-else-if="target?.isSystem" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
							Đây là loại mặc định của hệ thống nên mã giữ nguyên, bạn chỉ sửa được tên và các tuỳ chọn khác.
						</p>
					</div>

					<div>
						<label :class="labelCls">Tên loại <span class="text-red-500">*</span></label>
						<input
							v-model="name"
							v-bind="nameAttrs"
							:class="[inputCls, errors.name ? 'border-red-400' : '']"
							placeholder="VD Giấy phép lao động"
						/>
						<p v-if="errors.name" class="mt-1 text-xs text-red-500">{{ errors.name }}</p>
					</div>

					<div>
						<label :class="labelCls">Thời hạn mặc định</label>
						<input
							v-model="validityMonths"
							v-bind="validityMonthsAttrs"
							:class="[inputCls, errors.validityMonths ? 'border-red-400' : '']"
							placeholder="Số tháng, để trống nếu không có thời hạn"
						/>
						<p v-if="errors.validityMonths" class="mt-1 text-xs text-red-500">{{ errors.validityMonths }}</p>
						<p v-else class="mt-1 text-xs text-gray-500 dark:text-gray-400">
							Khi tải giấy tờ mà bỏ trống ngày hết hạn, hệ thống lấy ngày cấp cộng số tháng này.
						</p>
					</div>

					<div>
						<label :class="labelCls">Thứ tự hiện trong danh sách</label>
						<input
							v-model="sortOrder"
							v-bind="sortOrderAttrs"
							:class="[inputCls, errors.sortOrder ? 'border-red-400' : '']"
							placeholder="Số nhỏ hiện trước"
						/>
						<p v-if="errors.sortOrder" class="mt-1 text-xs text-red-500">{{ errors.sortOrder }}</p>
					</div>

					<div class="space-y-2 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
						<label class="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
							<input v-model="isSensitive" type="checkbox" :class="[checkboxCls, 'mt-0.5']" />
							<span>
								Là giấy tờ nhạy cảm
								<span class="block text-xs text-gray-500 dark:text-gray-400">
									Chỉ người có quyền xem thông tin riêng mới thấy, và mỗi lần mở đều được ghi vào nhật ký.
								</span>
							</span>
						</label>
						<label class="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
							<input v-model="employeeVisible" type="checkbox" :class="[checkboxCls, 'mt-0.5']" />
							<span>
								Nhân viên thấy giấy tờ loại này trong hồ sơ của mình
								<span class="block text-xs text-gray-500 dark:text-gray-400">
									Tắt đi thì loại này chỉ dành cho nội bộ phòng nhân sự.
								</span>
							</span>
						</label>
					</div>

					<div class="flex justify-end gap-3 pt-1">
						<CommonAppButton type="button" variant="outline" @click="emit('close')">Hủy</CommonAppButton>
						<CommonAppButton type="submit" :loading="submitting">Lưu</CommonAppButton>
					</div>
				</form>
			</div>
		</div>
	</Teleport>
</template>
