<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import { useEmployeeProfileService } from '~/services/employee-profile.service';
	import {
		EDUCATION_LEVEL_LABELS,
		MARITAL_STATUS_LABELS,
		type EducationLevel,
		type EmployeeProfile,
		type MaritalStatus,
	} from '~/types/hr-profile.types';

	/**
	 * Khối "Thông tin thêm" của hồ sơ nhân viên (lô 3a).
	 *
	 * Đây là phần không nhạy cảm nên tải ngay cùng trang; ngân hàng và mã số thuế nằm ở khối
	 * riêng có cửa quyền, xem `EmployeeBankTax.vue`.
	 */
	const props = defineProps<{
		employeeId: number;
		canUpdate: boolean;
	}>();

	const toast = useToast();
	const service = useEmployeeProfileService();

	const profile = ref<EmployeeProfile | null>(null);
	const loading = ref(true);
	const loadError = ref<string | null>(null);
	const isEditing = ref(false);

	const schema = toTypedSchema(
		z.object({
			nationality: z.string().max(60, 'Tối đa 60 ký tự').optional().or(z.literal('')),
			maritalStatus: z.enum(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED']).or(z.literal('')).optional(),
			personalEmail: z.string().email('Email không hợp lệ').or(z.literal('')).optional(),
			educationLevel: z
				.enum(['NONE', 'ELEMENTARY_VOCATIONAL', 'INTERMEDIATE', 'COLLEGE', 'UNIVERSITY', 'MASTER', 'DOCTOR'])
				.or(z.literal(''))
				.optional(),
		}),
	);

	const { handleSubmit, defineField, errors, isSubmitting, resetForm } = useForm({ validationSchema: schema });

	const [nationality, nationalityAttrs] = defineField('nationality');
	const [maritalStatus] = defineField('maritalStatus');
	const [personalEmail, personalEmailAttrs] = defineField('personalEmail');
	const [educationLevel] = defineField('educationLevel');

	const maritalOptions = [
		{ value: '', label: '-- Chưa rõ --' },
		...Object.entries(MARITAL_STATUS_LABELS).map(([value, label]) => ({ value, label })),
	];

	const educationOptions = [
		{ value: '', label: '-- Chưa rõ --' },
		...Object.entries(EDUCATION_LEVEL_LABELS).map(([value, label]) => ({ value, label })),
	];

	async function load() {
		loading.value = true;
		loadError.value = null;
		try {
			profile.value = await service.findProfile(props.employeeId);
		} catch (e) {
			loadError.value = e instanceof Error ? e.message : 'Không tải được thông tin thêm của nhân viên.';
		} finally {
			loading.value = false;
		}
	}

	function startEditing() {
		const p = profile.value;
		resetForm({
			values: {
				nationality: p?.nationality ?? '',
				maritalStatus: p?.maritalStatus ?? '',
				personalEmail: p?.personalEmail ?? '',
				educationLevel: p?.educationLevel ?? '',
			},
		});
		isEditing.value = true;
	}

	const onSubmit = handleSubmit(async values => {
		try {
			// Ô để trống nghĩa là xoá giá trị, nên gửi `null` chứ không bỏ trường ra khỏi body:
			// không gửi là giữ nguyên giá trị cũ.
			profile.value = await service.updateProfile(props.employeeId, {
				nationality: values.nationality || null,
				maritalStatus: (values.maritalStatus as MaritalStatus) || null,
				personalEmail: values.personalEmail || null,
				educationLevel: (values.educationLevel as EducationLevel) || null,
			});
			toast.success('Đã lưu thông tin thêm của nhân viên.');
			isEditing.value = false;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa lưu được thông tin thêm. Bạn thử lại sau ít phút.');
		}
	});

	onMounted(load);

	const inputCls =
		'block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm px-3 py-2.5 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500';
	const labelCls = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1';
	const valueCls = 'text-sm text-gray-900 dark:text-white';
</script>

<template>
	<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
		<div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-3">
			<h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Thông tin thêm</h3>
			<CommonAppButton v-if="canUpdate && !isEditing && !loading && !loadError" size="sm" variant="outline" @click="startEditing">
				Chỉnh sửa
			</CommonAppButton>
		</div>

		<div v-if="loading" class="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
			<div v-for="i in 4" :key="i" class="space-y-1.5">
				<div class="h-3 w-24 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
				<div class="h-4 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
			</div>
		</div>

		<div v-else-if="loadError" class="p-6 flex flex-wrap items-center justify-between gap-3">
			<p class="text-sm text-rose-700 dark:text-rose-300">{{ loadError }}</p>
			<CommonAppButton size="sm" variant="outline" @click="load">Thử lại</CommonAppButton>
		</div>

		<!-- Xem -->
		<div v-else-if="!isEditing" class="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
			<div>
				<p :class="labelCls">Quốc tịch</p>
				<p :class="valueCls">{{ profile?.nationality ?? 'Việt Nam' }}</p>
				<p v-if="!profile?.nationality" class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
					Chưa điền, hệ thống hiểu là Việt Nam.
				</p>
			</div>
			<div>
				<p :class="labelCls">Tình trạng hôn nhân</p>
				<p :class="valueCls">{{ profile?.maritalStatusLabel ?? '—' }}</p>
			</div>
			<div>
				<p :class="labelCls">Email cá nhân</p>
				<p :class="[valueCls, 'break-all']">{{ profile?.personalEmail ?? '—' }}</p>
			</div>
			<div>
				<p :class="labelCls">Trình độ chuyên môn</p>
				<p :class="valueCls">{{ profile?.educationLevelLabel ?? '—' }}</p>
			</div>
		</div>

		<!-- Sửa -->
		<form v-else @submit.prevent="onSubmit">
			<div class="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
				<div>
					<label :class="labelCls">Quốc tịch</label>
					<input
						v-model="nationality"
						v-bind="nationalityAttrs"
						:class="[inputCls, errors.nationality ? 'border-red-400' : '']"
						placeholder="Bỏ trống nghĩa là Việt Nam"
					/>
					<p v-if="errors.nationality" class="mt-1 text-xs text-red-500">{{ errors.nationality }}</p>
				</div>
				<div>
					<label :class="labelCls">Tình trạng hôn nhân</label>
					<UiSelect v-model="maritalStatus" :options="maritalOptions" placeholder="-- Chưa rõ --" />
				</div>
				<div>
					<label :class="labelCls">Email cá nhân</label>
					<input
						v-model="personalEmail"
						v-bind="personalEmailAttrs"
						:class="[inputCls, errors.personalEmail ? 'border-red-400' : '']"
						placeholder="email@gmail.com"
					/>
					<p v-if="errors.personalEmail" class="mt-1 text-xs text-red-500">{{ errors.personalEmail }}</p>
				</div>
				<div>
					<label :class="labelCls">Trình độ chuyên môn</label>
					<UiSelect v-model="educationLevel" :options="educationOptions" placeholder="-- Chưa rõ --" />
				</div>
			</div>
			<div class="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
				<CommonAppButton type="button" variant="outline" @click="isEditing = false">Hủy</CommonAppButton>
				<CommonAppButton type="submit" :loading="isSubmitting">Lưu thay đổi</CommonAppButton>
			</div>
		</form>
	</div>
</template>
