<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import { useMeProfileService } from '~/services/me-profile.service';
	import type { MyProfile } from '~/types/hr-profile.types';

	/**
	 * Khối liên hệ trên trang cá nhân (UI-04, lô 3a).
	 *
	 * Số điện thoại, email cá nhân và địa chỉ được ghi ngay, không cần duyệt: đây là thông tin
	 * để liên lạc, sai thì chính nhân viên chịu, nên bắt chờ duyệt chỉ làm chậm việc.
	 *
	 * Quốc tịch, tình trạng hôn nhân và trình độ nằm cùng khối nhưng chỉ xem được, vì chúng đi
	 * vào sổ quản lý lao động và chỉ phòng nhân sự sửa.
	 */
	const props = defineProps<{
		profile: MyProfile;
	}>();

	const emit = defineEmits<{
		updated: [profile: MyProfile];
	}>();

	const toast = useToast();
	const service = useMeProfileService();
	const isEditing = ref(false);

	const schema = toTypedSchema(
		z.object({
			phone: z
				.string()
				.regex(/^[0-9]{9,11}$/, 'Số điện thoại không hợp lệ, cần 9 đến 11 chữ số')
				.or(z.literal(''))
				.optional(),
			personalEmail: z.string().email('Email không hợp lệ').or(z.literal('')).optional(),
			address: z.string().max(255, 'Tối đa 255 ký tự').or(z.literal('')).optional(),
		}),
	);

	const { handleSubmit, defineField, errors, isSubmitting, resetForm } = useForm({ validationSchema: schema });

	const [phone, phoneAttrs] = defineField('phone');
	const [personalEmail, personalEmailAttrs] = defineField('personalEmail');
	const [address, addressAttrs] = defineField('address');

	function startEditing() {
		resetForm({
			values: {
				phone: props.profile.phone ?? '',
				personalEmail: props.profile.personalEmail ?? '',
				address: props.profile.address ?? '',
			},
		});
		isEditing.value = true;
	}

	const onSubmit = handleSubmit(async values => {
		try {
			// Ô để trống nghĩa là xoá, nên gửi `null`: không gửi trường thì server giữ giá trị cũ.
			const updated = await service.updateContact({
				phone: values.phone || null,
				personalEmail: values.personalEmail || null,
				address: values.address || null,
			});
			emit('updated', updated);
			isEditing.value = false;
			toast.success('Đã lưu thông tin liên hệ.');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa lưu được. Bạn thử lại sau ít phút.');
		}
	});

	const inputCls =
		'block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm px-3 py-2.5 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500';
	const labelCls = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1';
	const valueCls = 'text-sm text-gray-900 dark:text-white';
</script>

<template>
	<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<h3 class="text-sm font-semibold text-gray-900 dark:text-white">Liên hệ</h3>
				<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
					Ba thông tin này bạn tự sửa và lưu được ngay, không cần chờ duyệt.
				</p>
			</div>
			<CommonAppButton v-if="!isEditing" size="sm" variant="outline" @click="startEditing">Chỉnh sửa</CommonAppButton>
		</div>

		<div v-if="!isEditing" class="mt-5 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
			<div>
				<p :class="labelCls">Số điện thoại</p>
				<p :class="valueCls">{{ profile.phone ?? '—' }}</p>
			</div>
			<div>
				<p :class="labelCls">Email cá nhân</p>
				<p :class="[valueCls, 'break-all']">{{ profile.personalEmail ?? '—' }}</p>
			</div>
			<div class="sm:col-span-2">
				<p :class="labelCls">Địa chỉ</p>
				<p :class="valueCls">{{ profile.address ?? '—' }}</p>
			</div>
			<div>
				<p :class="labelCls">Quốc tịch</p>
				<p :class="valueCls">{{ profile.nationality ?? 'Việt Nam' }}</p>
			</div>
			<div>
				<p :class="labelCls">Tình trạng hôn nhân</p>
				<p :class="valueCls">{{ profile.maritalStatusLabel ?? '—' }}</p>
			</div>
			<div>
				<p :class="labelCls">Trình độ chuyên môn</p>
				<p :class="valueCls">{{ profile.educationLevelLabel ?? '—' }}</p>
			</div>
			<p class="text-xs text-gray-500 dark:text-gray-400 sm:col-span-2">
				Quốc tịch, tình trạng hôn nhân và trình độ do phòng nhân sự ghi. Thông tin sai thì bạn nhờ phòng nhân sự
				sửa giúp.
			</p>
		</div>

		<form v-else class="mt-5 space-y-5" @submit.prevent="onSubmit">
			<div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
				<div>
					<label :class="labelCls">Số điện thoại</label>
					<input
						v-model="phone"
						v-bind="phoneAttrs"
						:class="[inputCls, errors.phone ? 'border-red-400' : '']"
						placeholder="0901234567"
					/>
					<p v-if="errors.phone" class="mt-1 text-xs text-red-500">{{ errors.phone }}</p>
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
				<div class="sm:col-span-2">
					<label :class="labelCls">Địa chỉ</label>
					<input
						v-model="address"
						v-bind="addressAttrs"
						:class="[inputCls, errors.address ? 'border-red-400' : '']"
						placeholder="123 Lê Lợi, Quận 1, TP.HCM"
					/>
					<p v-if="errors.address" class="mt-1 text-xs text-red-500">{{ errors.address }}</p>
				</div>
			</div>
			<div class="flex justify-end gap-3">
				<CommonAppButton type="button" variant="outline" @click="isEditing = false">Hủy</CommonAppButton>
				<CommonAppButton type="submit" :loading="isSubmitting">Lưu thay đổi</CommonAppButton>
			</div>
		</form>
	</div>
</template>
