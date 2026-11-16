<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import {
		DEPENDENT_REGISTRATION_LABELS,
		RELATIVE_RELATIONSHIP_LABELS,
		type CreateRelativeDto,
		type DependentRegistration,
		type Relative,
		type RelativeRelationship,
	} from '~/types/hr-profile.types';

	/**
	 * Form một thân nhân.
	 *
	 * Hai dáng dùng chung một form: phòng nhân sự nhập đủ (kể cả người phụ thuộc và trạng thái
	 * đăng ký giảm trừ), còn nhân viên tự thêm liên hệ khẩn cấp thì chỉ có mấy ô liên hệ, vì
	 * người phụ thuộc phải qua yêu cầu thay đổi mới sửa được.
	 *
	 * Các luật của server được kiểm ngay tại form để người dùng thấy lỗi trước khi gửi: người
	 * phụ thuộc phải có tháng bắt đầu giảm trừ, quan hệ Khác phải sống cùng, và tháng kết thúc
	 * không được trước tháng bắt đầu.
	 */
	const props = withDefaults(
		defineProps<{
			target?: Relative | null;
			variant?: 'full' | 'emergency';
			submitting?: boolean;
			submitLabel?: string;
			note?: string;
		}>(),
		{ target: null, variant: 'full', submitting: false, submitLabel: 'Lưu', note: '' },
	);

	const emit = defineEmits<{
		submit: [payload: CreateRelativeDto];
		close: [];
	}>();

	const isFull = computed(() => props.variant === 'full');

	const schema = toTypedSchema(
		z
			.object({
				fullName: z.string().min(2, 'Tối thiểu 2 ký tự').max(100, 'Tối đa 100 ký tự'),
				relationship: z.enum([
					'CHILD',
					'SPOUSE',
					'FATHER',
					'MOTHER',
					'FATHER_IN_LAW',
					'MOTHER_IN_LAW',
					'SIBLING',
					'OTHER',
				]),
				dateOfBirth: z.string().optional().or(z.literal('')),
				identityNumber: z
					.string()
					.refine(v => !v || /^\d{12}$/.test(v), 'Số định danh phải đúng 12 chữ số')
					.optional()
					.or(z.literal('')),
				occupation: z.string().max(150, 'Tối đa 150 ký tự').optional().or(z.literal('')),
				phone: z
					.string()
					.refine(v => !v || /^[0-9]{9,11}$/.test(v), 'Số điện thoại không hợp lệ, cần 9 đến 11 chữ số')
					.optional()
					.or(z.literal('')),
				isEmergencyContact: z.boolean().optional(),
				isPrimaryEmergency: z.boolean().optional(),
				isDependent: z.boolean().optional(),
				dependentFrom: z.string().optional().or(z.literal('')),
				dependentTo: z.string().optional().or(z.literal('')),
				livesWith: z.boolean().optional(),
				registration: z
					.enum(['NOT_REGISTERED', 'SUBMITTED', 'REGISTERED', 'UNVERIFIED'])
					.or(z.literal(''))
					.optional(),
				note: z.string().max(500, 'Tối đa 500 ký tự').optional().or(z.literal('')),
			})
			.refine(v => !v.isDependent || !!v.dependentFrom, {
				message: 'Người phụ thuộc phải có tháng bắt đầu giảm trừ',
				path: ['dependentFrom'],
			})
			.refine(v => !v.dependentFrom || !v.dependentTo || v.dependentTo >= v.dependentFrom, {
				message: 'Tháng kết thúc không được trước tháng bắt đầu',
				path: ['dependentTo'],
			})
			.refine(v => v.relationship !== 'OTHER' || !v.isDependent || v.livesWith === true, {
				message: 'Người phụ thuộc có quan hệ Khác thì phải sống cùng nhân viên',
				path: ['livesWith'],
			}),
	);

	const { handleSubmit, defineField, errors, resetForm, setFieldValue, values } = useForm({
		validationSchema: schema,
	});

	const [fullName, fullNameAttrs] = defineField('fullName');
	const [relationship] = defineField('relationship');
	const [dateOfBirth] = defineField('dateOfBirth');
	const [identityNumber, identityNumberAttrs] = defineField('identityNumber');
	const [occupation, occupationAttrs] = defineField('occupation');
	const [phone, phoneAttrs] = defineField('phone');
	const [isEmergencyContact] = defineField('isEmergencyContact');
	const [isPrimaryEmergency] = defineField('isPrimaryEmergency');
	const [isDependent] = defineField('isDependent');
	const [dependentFrom] = defineField('dependentFrom');
	const [dependentTo] = defineField('dependentTo');
	const [livesWith] = defineField('livesWith');
	const [registration] = defineField('registration');
	const [noteField, noteAttrs] = defineField('note');

	const relationshipOptions = Object.entries(RELATIVE_RELATIONSHIP_LABELS).map(([value, label]) => ({
		value,
		label,
	}));

	const registrationOptions = [
		{ value: '', label: '-- Chưa đặt --' },
		...Object.entries(DEPENDENT_REGISTRATION_LABELS).map(([value, label]) => ({ value, label })),
	];

	onMounted(() => {
		const t = props.target;
		resetForm({
			values: {
				fullName: t?.fullName ?? '',
				relationship: t?.relationship ?? 'CHILD',
				dateOfBirth: t?.dateOfBirth ?? '',
				identityNumber: t?.identityNumber ?? '',
				occupation: t?.occupation ?? '',
				phone: t?.phone ?? '',
				isEmergencyContact: props.variant === 'emergency' ? true : (t?.isEmergencyContact ?? false),
				isPrimaryEmergency: t?.isPrimaryEmergency ?? false,
				isDependent: t?.isDependent ?? false,
				dependentFrom: t?.dependentFrom ?? '',
				dependentTo: t?.dependentTo ?? '',
				livesWith: t?.livesWith ?? false,
				registration: t?.registration ?? '',
				note: t?.note ?? '',
			},
		});
	});

	// Người liên hệ chính đương nhiên là liên hệ khẩn cấp, nên tick ô trên thì ô dưới tự bật.
	watch(isPrimaryEmergency, v => {
		if (v) setFieldValue('isEmergencyContact', true);
	});

	const onSubmit = handleSubmit(v => {
		const base: CreateRelativeDto = {
			fullName: v.fullName,
			relationship: v.relationship as RelativeRelationship,
			phone: v.phone || null,
			occupation: v.occupation || null,
			isPrimaryEmergency: !!v.isPrimaryEmergency,
			note: v.note || null,
		};
		if (!isFull.value) {
			emit('submit', base);
			return;
		}
		emit('submit', {
			...base,
			dateOfBirth: v.dateOfBirth || null,
			identityNumber: v.identityNumber || null,
			isEmergencyContact: !!v.isEmergencyContact || !!v.isPrimaryEmergency,
			isDependent: !!v.isDependent,
			dependentFrom: v.isDependent ? v.dependentFrom || null : null,
			dependentTo: v.isDependent ? v.dependentTo || null : null,
			livesWith: !!v.livesWith,
			registration: v.isDependent ? ((v.registration as DependentRegistration) || null) : null,
		});
	});

	const title = computed(() => {
		if (props.variant === 'emergency') {
			return props.target ? 'Sửa liên hệ khẩn cấp' : 'Thêm liên hệ khẩn cấp';
		}
		return props.target ? 'Sửa thân nhân' : 'Thêm thân nhân';
	});

	const inputCls =
		'block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm px-3 py-2.5 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500';
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
				class="my-8 w-full max-w-xl rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
			>
				<div class="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-700">
					<h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ title }}</h3>
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

					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div>
							<label :class="labelCls">Họ và tên <span class="text-red-500">*</span></label>
							<input
								v-model="fullName"
								v-bind="fullNameAttrs"
								:class="[inputCls, errors.fullName ? 'border-red-400' : '']"
								placeholder="Nguyễn Văn A"
							/>
							<p v-if="errors.fullName" class="mt-1 text-xs text-red-500">{{ errors.fullName }}</p>
						</div>
						<div>
							<label :class="labelCls">Quan hệ <span class="text-red-500">*</span></label>
							<UiSelect v-model="relationship" :options="relationshipOptions" :error="errors.relationship" />
						</div>

						<div v-if="isFull">
							<UiDatePicker v-model="dateOfBirth" label="Ngày sinh" />
						</div>
						<div v-if="isFull">
							<label :class="labelCls">Số định danh cá nhân</label>
							<input
								v-model="identityNumber"
								v-bind="identityNumberAttrs"
								:class="[inputCls, errors.identityNumber ? 'border-red-400' : '']"
								placeholder="12 chữ số"
							/>
							<p v-if="errors.identityNumber" class="mt-1 text-xs text-red-500">{{ errors.identityNumber }}</p>
							<p v-else class="mt-1 text-xs text-gray-500 dark:text-gray-400">
								Số này cũng là mã số thuế của người phụ thuộc.
							</p>
						</div>

						<div>
							<label :class="labelCls">Nghề nghiệp</label>
							<input v-model="occupation" v-bind="occupationAttrs" :class="inputCls" placeholder="Ví dụ Học sinh" />
							<p v-if="errors.occupation" class="mt-1 text-xs text-red-500">{{ errors.occupation }}</p>
						</div>
						<div>
							<label :class="labelCls">Số điện thoại</label>
							<input
								v-model="phone"
								v-bind="phoneAttrs"
								:class="[inputCls, errors.phone ? 'border-red-400' : '']"
								placeholder="09xxxxxxxx"
							/>
							<p v-if="errors.phone" class="mt-1 text-xs text-red-500">{{ errors.phone }}</p>
						</div>
					</div>

					<!-- Liên hệ khẩn cấp -->
					<div class="space-y-2 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
						<p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
							Liên hệ khẩn cấp
						</p>
						<label v-if="isFull" class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
							<input v-model="isEmergencyContact" type="checkbox" :class="checkboxCls" />
							Là người liên hệ khi có việc khẩn cấp
						</label>
						<label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
							<input v-model="isPrimaryEmergency" type="checkbox" :class="checkboxCls" />
							Là người liên hệ chính
						</label>
						<p class="text-xs text-gray-500 dark:text-gray-400">
							Mỗi nhân viên chỉ có một người liên hệ chính, nên đặt người mới thì người đang giữ vai này tự được bỏ.
						</p>
					</div>

					<!-- Người phụ thuộc -->
					<div v-if="isFull" class="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
						<p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
							Giảm trừ người phụ thuộc
						</p>
						<label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
							<input v-model="isDependent" type="checkbox" :class="checkboxCls" />
							Là người phụ thuộc được giảm trừ thuế
						</label>
						<label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
							<input v-model="livesWith" type="checkbox" :class="checkboxCls" />
							Sống cùng nhân viên
						</label>
						<p v-if="errors.livesWith" class="text-xs text-red-500">{{ errors.livesWith }}</p>

						<template v-if="values.isDependent">
							<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<UiDatePicker
									v-model="dependentFrom"
									label="Giảm trừ từ tháng *"
									:error="errors.dependentFrom"
									hint="Hệ thống chỉ lưu tháng và năm."
								/>
								<UiDatePicker
									v-model="dependentTo"
									label="Giảm trừ đến tháng"
									:error="errors.dependentTo"
									hint="Bỏ trống nghĩa là đang được giảm trừ."
								/>
							</div>
							<div>
								<label :class="labelCls">Trạng thái đăng ký</label>
								<UiSelect v-model="registration" :options="registrationOptions" placeholder="-- Chưa đặt --" />
								<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
									Để trống thì hệ thống ghi là chưa đăng ký.
								</p>
							</div>
						</template>
					</div>

					<div>
						<label :class="labelCls">Ghi chú</label>
						<textarea
							v-model="noteField"
							v-bind="noteAttrs"
							rows="2"
							:class="[inputCls, errors.note ? 'border-red-400' : '']"
							placeholder="Thông tin cần lưu ý"
						/>
						<p v-if="errors.note" class="mt-1 text-xs text-red-500">{{ errors.note }}</p>
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
