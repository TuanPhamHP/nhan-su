<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import type { CreateWorkExperienceDto, WorkExperience } from '~/types/hr-profile.types';

	/**
	 * Form một mốc kinh nghiệm.
	 *
	 * Chỉ dựng dữ liệu rồi phát ra ngoài: nơi gọi quyết định gửi thẳng lên hồ sơ (phòng nhân
	 * sự) hay gói thành yêu cầu thay đổi (nhân viên tự đề nghị).
	 */
	const props = withDefaults(
		defineProps<{
			target?: WorkExperience | null;
			submitting?: boolean;
			/** Nhãn nút gửi, vì cùng form này dùng cho "Lưu" và "Gửi đề nghị". */
			submitLabel?: string;
			note?: string;
		}>(),
		{ target: null, submitting: false, submitLabel: 'Lưu', note: '' },
	);

	const emit = defineEmits<{
		submit: [payload: CreateWorkExperienceDto];
		close: [];
	}>();

	const schema = toTypedSchema(
		z
			.object({
				companyName: z.string().min(2, 'Tối thiểu 2 ký tự').max(200, 'Tối đa 200 ký tự'),
				title: z.string().max(150, 'Tối đa 150 ký tự').optional().or(z.literal('')),
				fromMonth: z.string().optional().or(z.literal('')),
				toMonth: z.string().optional().or(z.literal('')),
				leaveReason: z.string().max(255, 'Tối đa 255 ký tự').optional().or(z.literal('')),
				description: z.string().max(2000, 'Tối đa 2000 ký tự').optional().or(z.literal('')),
			})
			.refine(v => !v.fromMonth || !v.toMonth || v.toMonth >= v.fromMonth, {
				message: 'Tháng kết thúc không được trước tháng bắt đầu',
				path: ['toMonth'],
			}),
	);

	const { handleSubmit, defineField, errors, resetForm } = useForm({ validationSchema: schema });

	const [companyName, companyNameAttrs] = defineField('companyName');
	const [title, titleAttrs] = defineField('title');
	const [fromMonth] = defineField('fromMonth');
	const [toMonth] = defineField('toMonth');
	const [leaveReason, leaveReasonAttrs] = defineField('leaveReason');
	const [description, descriptionAttrs] = defineField('description');

	onMounted(() => {
		const t = props.target;
		resetForm({
			values: {
				companyName: t?.companyName ?? '',
				title: t?.title ?? '',
				fromMonth: t?.fromMonth ?? '',
				toMonth: t?.toMonth ?? '',
				leaveReason: t?.leaveReason ?? '',
				description: t?.description ?? '',
			},
		});
	});

	const onSubmit = handleSubmit(values => {
		emit('submit', {
			companyName: values.companyName,
			title: values.title || null,
			fromMonth: values.fromMonth || null,
			toMonth: values.toMonth || null,
			leaveReason: values.leaveReason || null,
			description: values.description || null,
		});
	});

	const inputCls =
		'block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm px-3 py-2.5 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500';
	const labelCls = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1';
</script>

<template>
	<Teleport to="body">
		<div
			class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
			@click.self="emit('close')"
		>
			<div
				class="my-8 w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
			>
				<div class="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-700">
					<h3 class="text-base font-semibold text-gray-900 dark:text-white">
						{{ target ? 'Sửa kinh nghiệm làm việc' : 'Thêm kinh nghiệm làm việc' }}
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
					<p v-if="note" class="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800 dark:bg-brand-900/20 dark:text-brand-200">
						{{ note }}
					</p>

					<div>
						<label :class="labelCls">Công ty <span class="text-red-500">*</span></label>
						<input
							v-model="companyName"
							v-bind="companyNameAttrs"
							:class="[inputCls, errors.companyName ? 'border-red-400' : '']"
							placeholder="Tên công ty cũ"
						/>
						<p v-if="errors.companyName" class="mt-1 text-xs text-red-500">{{ errors.companyName }}</p>
					</div>

					<div>
						<label :class="labelCls">Chức danh</label>
						<input v-model="title" v-bind="titleAttrs" :class="inputCls" placeholder="Ví dụ Nhân viên kinh doanh" />
						<p v-if="errors.title" class="mt-1 text-xs text-red-500">{{ errors.title }}</p>
					</div>

					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<UiDatePicker v-model="fromMonth" label="Từ tháng" hint="Hệ thống chỉ lưu tháng và năm." />
						<UiDatePicker
							v-model="toMonth"
							label="Đến tháng"
							:error="errors.toMonth"
							hint="Bỏ trống nghĩa là vẫn đang làm."
						/>
					</div>

					<div>
						<label :class="labelCls">Lý do rời đi</label>
						<input
							v-model="leaveReason"
							v-bind="leaveReasonAttrs"
							:class="[inputCls, errors.leaveReason ? 'border-red-400' : '']"
							placeholder="Ví dụ Hết hạn hợp đồng"
						/>
						<p v-if="errors.leaveReason" class="mt-1 text-xs text-red-500">{{ errors.leaveReason }}</p>
					</div>

					<div>
						<label :class="labelCls">Mô tả công việc</label>
						<textarea
							v-model="description"
							v-bind="descriptionAttrs"
							rows="3"
							:class="[inputCls, errors.description ? 'border-red-400' : '']"
							placeholder="Những việc chính đã làm"
						/>
						<p v-if="errors.description" class="mt-1 text-xs text-red-500">{{ errors.description }}</p>
					</div>

					<div class="flex justify-end gap-3 pt-1">
						<CommonAppButton type="button" variant="outline" @click="emit('close')">Hủy</CommonAppButton>
						<CommonAppButton type="submit" :loading="submitting">{{ submitLabel }}</CommonAppButton>
					</div>
				</form>
			</div>
		</div>
	</Teleport>
</template>
