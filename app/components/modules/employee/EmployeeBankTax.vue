<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import { useEmployeeProfileService } from '~/services/employee-profile.service';
	import type { PrivateProfile } from '~/types/hr-profile.types';

	/**
	 * Khối "Ngân hàng và thuế" của hồ sơ nhân viên (lô 3a).
	 *
	 * Khối này đóng sẵn và chỉ mở khi người xem bấm Xem, vì mỗi lần gọi `/private-profile` là
	 * một dòng nhật ký `employee.private_view`. Không có quyền `employee:private:read` thì nút
	 * Xem không hiện, và BE cũng chặn luôn ở phía máy chủ.
	 */
	const props = defineProps<{
		employeeId: number;
		employeeName: string;
		canUpdate: boolean;
	}>();

	const toast = useToast();
	const service = useEmployeeProfileService();

	const profile = ref<PrivateProfile | null>(null);
	const loading = ref(false);
	const loadError = ref<string | null>(null);
	const isEditing = ref(false);

	const schema = toTypedSchema(
		z.object({
			bankName: z.string().max(150, 'Tối đa 150 ký tự').optional().or(z.literal('')),
			bankBranch: z.string().max(150, 'Tối đa 150 ký tự').optional().or(z.literal('')),
			// Người dùng gõ số tài khoản có dấu cách hoặc dấu chấm là chuyện thường; server bỏ
			// các dấu đó rồi mới kiểm 6 đến 20 chữ số, nên ở đây chỉ kiểm phần chữ số.
			bankAccountNumber: z
				.string()
				.refine(v => !v || /^\d{6,20}$/.test(v.replace(/[\s.\-_]/g, '')), 'Số tài khoản phải có 6 đến 20 chữ số')
				.optional()
				.or(z.literal('')),
			bankAccountHolder: z.string().max(100, 'Tối đa 100 ký tự').optional().or(z.literal('')),
			taxCode: z
				.string()
				.refine(v => !v || /^(\d{10}|\d{12}|\d{13})$/.test(v.trim()), 'Mã số thuế phải có 10, 12 hoặc 13 chữ số')
				.optional()
				.or(z.literal('')),
		}),
	);

	const { handleSubmit, defineField, errors, isSubmitting, resetForm } = useForm({ validationSchema: schema });

	const [bankName, bankNameAttrs] = defineField('bankName');
	const [bankBranch, bankBranchAttrs] = defineField('bankBranch');
	const [bankAccountNumber, bankAccountNumberAttrs] = defineField('bankAccountNumber');
	const [bankAccountHolder, bankAccountHolderAttrs] = defineField('bankAccountHolder');
	const [taxCode, taxCodeAttrs] = defineField('taxCode');

	async function reveal() {
		loading.value = true;
		loadError.value = null;
		try {
			profile.value = await service.findPrivateProfile(props.employeeId);
		} catch (e) {
			loadError.value = e instanceof Error ? e.message : 'Chưa xem được thông tin ngân hàng và thuế.';
		} finally {
			loading.value = false;
		}
	}

	function hide() {
		profile.value = null;
		isEditing.value = false;
		loadError.value = null;
	}

	function startEditing() {
		const p = profile.value;
		resetForm({
			values: {
				bankName: p?.bankName ?? '',
				bankBranch: p?.bankBranch ?? '',
				bankAccountNumber: p?.bankAccountNumber ?? '',
				bankAccountHolder: p?.bankAccountHolder ?? '',
				taxCode: p?.taxCode ?? '',
			},
		});
		isEditing.value = true;
	}

	const onSubmit = handleSubmit(async values => {
		try {
			await service.updateProfile(props.employeeId, {
				bankName: values.bankName || null,
				bankBranch: values.bankBranch || null,
				bankAccountNumber: values.bankAccountNumber || null,
				bankAccountHolder: values.bankAccountHolder || null,
				taxCode: values.taxCode || null,
			});
			// `PATCH /profile` chỉ trả phần không nhạy cảm, nên đọc lại để thấy đúng số tài khoản
			// server đã chuẩn hoá và mã số thuế đang dùng thật.
			await reveal();
			isEditing.value = false;
			toast.success(`Đã lưu thông tin ngân hàng và thuế của ${props.employeeName}.`);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa lưu được. Bạn thử lại sau ít phút.');
		}
	});

	const taxCodeSourceNote = computed(() =>
		profile.value?.effectiveTaxCodeSource === 'CITIZEN_ID' ? 'lấy từ CCCD' : null,
	);

	const inputCls =
		'block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm px-3 py-2.5 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500';
	const labelCls = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1';
	const valueCls = 'text-sm text-gray-900 dark:text-white';
</script>

<template>
	<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
		<div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-3">
			<div class="min-w-0">
				<h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Ngân hàng và thuế</h3>
				<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
					Mỗi lần xem được ghi vào nhật ký hệ thống.
				</p>
			</div>
			<div class="flex items-center gap-2">
				<CommonAppButton v-if="!profile && !loading" size="sm" variant="outline" @click="reveal">Xem</CommonAppButton>
				<template v-if="profile">
					<CommonAppButton v-if="canUpdate && !isEditing" size="sm" variant="outline" @click="startEditing">
						Chỉnh sửa
					</CommonAppButton>
					<CommonAppButton v-if="!isEditing" size="sm" variant="secondary" @click="hide">Ẩn</CommonAppButton>
				</template>
			</div>
		</div>

		<div v-if="loading" class="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
			<div v-for="i in 4" :key="i" class="space-y-1.5">
				<div class="h-3 w-24 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
				<div class="h-4 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
			</div>
		</div>

		<div v-else-if="loadError" class="p-6 flex flex-wrap items-center justify-between gap-3">
			<p class="text-sm text-rose-700 dark:text-rose-300">{{ loadError }}</p>
			<CommonAppButton size="sm" variant="outline" @click="reveal">Thử lại</CommonAppButton>
		</div>

		<p v-else-if="!profile" class="px-6 py-5 text-sm text-gray-500 dark:text-gray-400">
			Số tài khoản ngân hàng và mã số thuế đang được ẩn. Bạn bấm Xem khi thật sự cần dùng.
		</p>

		<!-- Xem -->
		<div v-else-if="!isEditing" class="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
			<div>
				<p :class="labelCls">Ngân hàng</p>
				<p :class="valueCls">{{ profile.bankName ?? '—' }}</p>
			</div>
			<div>
				<p :class="labelCls">Chi nhánh</p>
				<p :class="valueCls">{{ profile.bankBranch ?? '—' }}</p>
			</div>
			<div>
				<p :class="labelCls">Số tài khoản</p>
				<p :class="[valueCls, 'font-mono tabular-nums']">{{ profile.bankAccountNumber ?? '—' }}</p>
			</div>
			<div>
				<p :class="labelCls">Chủ tài khoản</p>
				<p :class="valueCls">{{ profile.bankAccountHolder ?? '—' }}</p>
			</div>
			<div>
				<p :class="labelCls">Mã số thuế</p>
				<p :class="[valueCls, 'font-mono tabular-nums']">
					{{ profile.effectiveTaxCode ?? '—' }}
					<span v-if="taxCodeSourceNote" class="font-sans text-xs text-gray-500 dark:text-gray-400">
						({{ taxCodeSourceNote }})
					</span>
				</p>
			</div>
		</div>

		<!-- Sửa -->
		<form v-else @submit.prevent="onSubmit">
			<div class="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
				<div>
					<label :class="labelCls">Ngân hàng</label>
					<input
						v-model="bankName"
						v-bind="bankNameAttrs"
						:class="[inputCls, errors.bankName ? 'border-red-400' : '']"
						placeholder="Ví dụ Vietcombank"
					/>
					<p v-if="errors.bankName" class="mt-1 text-xs text-red-500">{{ errors.bankName }}</p>
				</div>
				<div>
					<label :class="labelCls">Chi nhánh</label>
					<input
						v-model="bankBranch"
						v-bind="bankBranchAttrs"
						:class="[inputCls, errors.bankBranch ? 'border-red-400' : '']"
						placeholder="Ví dụ Chi nhánh Tân Bình"
					/>
					<p v-if="errors.bankBranch" class="mt-1 text-xs text-red-500">{{ errors.bankBranch }}</p>
				</div>
				<div>
					<label :class="labelCls">Số tài khoản</label>
					<input
						v-model="bankAccountNumber"
						v-bind="bankAccountNumberAttrs"
						:class="[inputCls, errors.bankAccountNumber ? 'border-red-400' : '']"
						placeholder="6 đến 20 chữ số"
					/>
					<p v-if="errors.bankAccountNumber" class="mt-1 text-xs text-red-500">{{ errors.bankAccountNumber }}</p>
					<p v-else class="mt-1 text-xs text-gray-500 dark:text-gray-400">
						Bạn gõ có dấu cách cũng được, hệ thống tự bỏ dấu cách khi lưu.
					</p>
				</div>
				<div>
					<label :class="labelCls">Chủ tài khoản</label>
					<input
						v-model="bankAccountHolder"
						v-bind="bankAccountHolderAttrs"
						:class="[inputCls, errors.bankAccountHolder ? 'border-red-400' : '']"
						placeholder="Tên in trên thẻ"
					/>
					<p v-if="errors.bankAccountHolder" class="mt-1 text-xs text-red-500">{{ errors.bankAccountHolder }}</p>
				</div>
				<div class="sm:col-span-2">
					<label :class="labelCls">Mã số thuế riêng</label>
					<input
						v-model="taxCode"
						v-bind="taxCodeAttrs"
						:class="[inputCls, errors.taxCode ? 'border-red-400' : '']"
						placeholder="Để trống nếu mã số thuế là số CCCD"
					/>
					<p v-if="errors.taxCode" class="mt-1 text-xs text-red-500">{{ errors.taxCode }}</p>
					<p v-else class="mt-1 text-xs text-gray-500 dark:text-gray-400">
						Chỉ điền khi mã số thuế khác số căn cước, ví dụ người nước ngoài hoặc mã 10 số cũ. Để trống thì hệ
						thống dùng số căn cước làm mã số thuế.
					</p>
				</div>
			</div>
			<div class="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
				<p class="text-xs text-gray-500 dark:text-gray-400">
					Lưu xong, {{ employeeName }} nhận một thông báo rằng hồ sơ vừa được cập nhật.
				</p>
				<div class="flex gap-3">
					<CommonAppButton type="button" variant="outline" @click="isEditing = false">Hủy</CommonAppButton>
					<CommonAppButton type="submit" :loading="isSubmitting">Lưu thay đổi</CommonAppButton>
				</div>
			</div>
		</form>
	</div>
</template>
