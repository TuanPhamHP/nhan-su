<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import { formatDate, formatDateTime } from '~/utils/date';
	import type { DependentDetail } from '~/types/social-insurance.types';

	const props = defineProps<{ employeeId: number }>();

	const toast = useToast();
	const authStore = useAuthStore();
	const { record, loading, saving, fetchByEmployee, save } = useSocialInsurance();

	const canEdit = computed(() => authStore.user?.role === 'HR' || authStore.user?.role === 'ADMIN');

	onMounted(() => fetchByEmployee(props.employeeId));

	// ─── Dependent details (managed separately from vee-validate) ────────────────
	const dependentList = ref<DependentDetail[]>([]);

	const relationshipOptions = [
		{ value: '', label: '-- Quan hệ --' },
		{ value: 'CON', label: 'Con' },
		{ value: 'VỢ', label: 'Vợ' },
		{ value: 'CHỒNG', label: 'Chồng' },
		{ value: 'BỐ', label: 'Bố' },
		{ value: 'MẸ', label: 'Mẹ' },
	];

	function addDependent() {
		dependentList.value.push({ name: '', relationship: '', idNumber: '', effectiveDate: '' });
	}

	function removeDependent(idx: number) {
		dependentList.value.splice(idx, 1);
	}

	// ─── File upload ──────────────────────────────────────────────────────────────
	const selectedFile = ref<File | null>(null);
	const fileInputRef = ref<HTMLInputElement | null>(null);

	function handleFileChange(e: Event) {
		const input = e.target as HTMLInputElement;
		selectedFile.value = input.files?.[0] ?? null;
	}

	// ─── Form ─────────────────────────────────────────────────────────────────────
	const schema = toTypedSchema(
		z.object({
			socialInsuranceNumber: z.string().optional(),
			healthInsuranceNumber: z.string().optional(),
			healthInsuranceExpiry: z.string().optional(),
			registeredHospital: z.string().optional(),
			effectiveDate: z.string().optional(),
			socialInsuranceRate: z.coerce.number().min(0, 'Tối thiểu 0').max(100, 'Tối đa 100').optional(),
			healthInsuranceRate: z.coerce.number().min(0, 'Tối thiểu 0').max(100, 'Tối đa 100').optional(),
			unemploymentInsuranceRate: z.coerce.number().min(0, 'Tối thiểu 0').max(100, 'Tối đa 100').optional(),
			taxCode: z.string().optional(),
			dependentsCount: z.coerce.number().min(0, 'Tối thiểu 0').optional(),
			note: z.string().optional(),
		}),
	);

	const { handleSubmit, defineField, errors, setValues, values: formValues } = useForm({
		validationSchema: schema,
		initialValues: {
			socialInsuranceRate: 8,
			healthInsuranceRate: 1.5,
			unemploymentInsuranceRate: 1.0,
			dependentsCount: 0,
		},
	});

	const [socialInsuranceNumber, siNumAttrs] = defineField('socialInsuranceNumber');
	const [healthInsuranceNumber, hiNumAttrs] = defineField('healthInsuranceNumber');
	const [healthInsuranceExpiry] = defineField('healthInsuranceExpiry');
	const [registeredHospital, hospitalAttrs] = defineField('registeredHospital');
	const [effectiveDate] = defineField('effectiveDate');
	const [socialInsuranceRate, siRateAttrs] = defineField('socialInsuranceRate');
	const [healthInsuranceRate, hiRateAttrs] = defineField('healthInsuranceRate');
	const [unemploymentInsuranceRate, uiRateAttrs] = defineField('unemploymentInsuranceRate');
	const [taxCode, taxCodeAttrs] = defineField('taxCode');
	const [dependentsCount, dependentsCountAttrs] = defineField('dependentsCount');
	const [note, noteAttrs] = defineField('note');

	const localTotalRate = computed(() => {
		const si = Number(formValues.socialInsuranceRate) || 0;
		const hi = Number(formValues.healthInsuranceRate) || 0;
		const ui = Number(formValues.unemploymentInsuranceRate) || 0;
		return (si + hi + ui).toFixed(1);
	});

	// Populate form when record loads
	watch(
		record,
		r => {
			if (!r) return;
			setValues({
				socialInsuranceNumber: r.socialInsuranceNumber ?? '',
				healthInsuranceNumber: r.healthInsuranceNumber ?? '',
				healthInsuranceExpiry: r.healthInsuranceExpiry ?? '',
				registeredHospital: r.registeredHospital ?? '',
				effectiveDate: r.effectiveDate ?? '',
				socialInsuranceRate: r.rates.socialInsurance,
				healthInsuranceRate: r.rates.healthInsurance,
				unemploymentInsuranceRate: r.rates.unemployment,
				taxCode: r.taxInfo.taxCode ?? '',
				dependentsCount: r.taxInfo.dependents,
				note: r.note ?? '',
			});
			dependentList.value = r.taxInfo.dependentDetails.map(d => ({ ...d }));
		},
		{ immediate: false },
	);

	const onSubmit = handleSubmit(async values => {
		try {
			await save(
				props.employeeId,
				{
					socialInsuranceNumber: values.socialInsuranceNumber || undefined,
					healthInsuranceNumber: values.healthInsuranceNumber || undefined,
					healthInsuranceExpiry: values.healthInsuranceExpiry || undefined,
					registeredHospital: values.registeredHospital || undefined,
					effectiveDate: values.effectiveDate || undefined,
					socialInsuranceRate: values.socialInsuranceRate,
					healthInsuranceRate: values.healthInsuranceRate,
					unemploymentInsuranceRate: values.unemploymentInsuranceRate,
					taxCode: values.taxCode || undefined,
					dependents: values.dependentsCount,
					dependentDetails: dependentList.value.filter(d => d.name || d.idNumber),
					note: values.note || undefined,
				},
				selectedFile.value ?? undefined,
			);
			toast.success('Lưu thông tin BHXH thành công');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
		}
	});

	// ─── Styling helpers ──────────────────────────────────────────────────────────
	const inputCls =
		'block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50';
	const labelCls = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5';
	const sectionTitleCls = 'text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4';
</script>

<template>
	<div>
		<!-- Loading -->
		<div v-if="loading" class="space-y-4">
			<div v-for="i in 3" :key="i" class="h-32 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
		</div>

		<form v-else class="space-y-6" @submit.prevent="onSubmit">
			<!-- Last updated info -->
			<p v-if="record" class="text-xs text-gray-400 dark:text-gray-500">
				Cập nhật lần cuối: {{ formatDateTime(record.updatedAt) }}
			</p>
			<p v-else class="text-xs text-amber-600 dark:text-amber-400">
				Chưa có dữ liệu BHXH — điền thông tin và nhấn Lưu để tạo mới.
			</p>

			<!-- ─── Section 1: Insurance info ─────────────────────────────────── -->
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
				<div class="px-5 py-3.5 border-b border-gray-100 dark:border-gray-700">
					<p :class="sectionTitleCls">Thông tin bảo hiểm</p>
				</div>
				<div class="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
					<div>
						<label :class="labelCls">Số sổ BHXH</label>
						<input
							v-model="socialInsuranceNumber"
							v-bind="siNumAttrs"
							:class="inputCls"
							:disabled="!canEdit"
							placeholder="10 chữ số"
						/>
					</div>
					<div>
						<label :class="labelCls">Số thẻ BHYT</label>
						<input
							v-model="healthInsuranceNumber"
							v-bind="hiNumAttrs"
							:class="inputCls"
							:disabled="!canEdit"
							placeholder="VD: AB1234567890"
						/>
					</div>
					<div>
						<label :class="labelCls">Ngày hết hạn BHYT</label>
						<UiDatePicker v-model="healthInsuranceExpiry" :disabled="!canEdit" />
					</div>
					<div>
						<label :class="labelCls">Cơ sở KCB ban đầu</label>
						<input
							v-model="registeredHospital"
							v-bind="hospitalAttrs"
							:class="inputCls"
							:disabled="!canEdit"
							placeholder="Tên bệnh viện / phòng khám"
						/>
					</div>
					<div>
						<label :class="labelCls">Ngày tham gia BHXH</label>
						<UiDatePicker v-model="effectiveDate" :disabled="!canEdit" />
					</div>
				</div>
			</div>

			<!-- ─── Section 2: Rates ───────────────────────────────────────────── -->
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
				<div class="px-5 py-3.5 border-b border-gray-100 dark:border-gray-700">
					<p :class="sectionTitleCls">Tỷ lệ đóng bảo hiểm (%)</p>
				</div>
				<div class="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
					<div>
						<label :class="labelCls">BHXH (%)</label>
						<input
							v-model="socialInsuranceRate"
							v-bind="siRateAttrs"
							type="number"
							step="0.1"
							min="0"
							max="100"
							:class="[inputCls, errors.socialInsuranceRate ? 'border-red-400' : '']"
							:disabled="!canEdit"
						/>
						<p v-if="errors.socialInsuranceRate" class="mt-1 text-xs text-red-500">{{ errors.socialInsuranceRate }}</p>
					</div>
					<div>
						<label :class="labelCls">BHYT (%)</label>
						<input
							v-model="healthInsuranceRate"
							v-bind="hiRateAttrs"
							type="number"
							step="0.1"
							min="0"
							max="100"
							:class="[inputCls, errors.healthInsuranceRate ? 'border-red-400' : '']"
							:disabled="!canEdit"
						/>
						<p v-if="errors.healthInsuranceRate" class="mt-1 text-xs text-red-500">{{ errors.healthInsuranceRate }}</p>
					</div>
					<div>
						<label :class="labelCls">BHTN (%)</label>
						<input
							v-model="unemploymentInsuranceRate"
							v-bind="uiRateAttrs"
							type="number"
							step="0.1"
							min="0"
							max="100"
							:class="[inputCls, errors.unemploymentInsuranceRate ? 'border-red-400' : '']"
							:disabled="!canEdit"
						/>
						<p v-if="errors.unemploymentInsuranceRate" class="mt-1 text-xs text-red-500">{{ errors.unemploymentInsuranceRate }}</p>
					</div>
					<div>
						<label :class="labelCls">Tổng khấu trừ (%)</label>
						<input
							type="text"
							:value="localTotalRate"
							:class="[inputCls, 'bg-gray-50 dark:bg-gray-800/60 font-semibold']"
							readonly
							disabled
						/>
					</div>
				</div>
			</div>

			<!-- ─── Section 3: Tax ────────────────────────────────────────────── -->
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
				<div class="px-5 py-3.5 border-b border-gray-100 dark:border-gray-700">
					<p :class="sectionTitleCls">Thuế thu nhập cá nhân</p>
				</div>
				<div class="p-5 space-y-5">
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div>
							<label :class="labelCls">Mã số thuế TNCN</label>
							<input
								v-model="taxCode"
								v-bind="taxCodeAttrs"
								:class="inputCls"
								:disabled="!canEdit"
								placeholder="VD: 8123456789"
							/>
						</div>
						<div>
							<label :class="labelCls">Số người phụ thuộc</label>
							<input
								v-model="dependentsCount"
								v-bind="dependentsCountAttrs"
								type="number"
								min="0"
								:class="[inputCls, errors.dependentsCount ? 'border-red-400' : '']"
								:disabled="!canEdit"
							/>
							<p v-if="errors.dependentsCount" class="mt-1 text-xs text-red-500">{{ errors.dependentsCount }}</p>
						</div>
					</div>

					<!-- Dependent details editor -->
					<div>
						<div class="flex items-center justify-between mb-3">
							<p class="text-xs font-medium text-gray-600 dark:text-gray-400">Chi tiết người phụ thuộc</p>
							<button
								v-if="canEdit"
								type="button"
								class="inline-flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700 font-medium"
								@click="addDependent"
							>
								<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
									<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
								</svg>
								Thêm người phụ thuộc
							</button>
						</div>

						<div v-if="dependentList.length === 0" class="text-xs text-gray-400 dark:text-gray-500 py-3">
							Chưa có người phụ thuộc
						</div>

						<div v-else class="space-y-3">
							<div
								v-for="(dep, idx) in dependentList"
								:key="idx"
								class="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"
							>
								<div>
									<label class="block text-xs text-gray-500 mb-1">Họ tên</label>
									<input
										v-model="dep.name"
										:class="inputCls"
										:disabled="!canEdit"
										placeholder="Nguyễn Văn A"
									/>
								</div>
								<div>
									<label class="block text-xs text-gray-500 mb-1">Quan hệ</label>
									<UiSelect v-model="dep.relationship" :options="relationshipOptions" :disabled="!canEdit" />
								</div>
								<div>
									<label class="block text-xs text-gray-500 mb-1">Số CMND/CCCD</label>
									<input
										v-model="dep.idNumber"
										:class="inputCls"
										:disabled="!canEdit"
										placeholder="CMND/CCCD"
									/>
								</div>
								<div class="flex items-end gap-2">
									<div class="flex-1">
										<label class="block text-xs text-gray-500 mb-1">Ngày hiệu lực</label>
										<UiDatePicker v-model="dep.effectiveDate" :disabled="!canEdit" />
									</div>
									<button
										v-if="canEdit"
										type="button"
										class="mb-0.5 p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
										@click="removeDependent(idx)"
									>
										<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
											<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
										</svg>
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- ─── Section 4: File upload ────────────────────────────────────── -->
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
				<div class="px-5 py-3.5 border-b border-gray-100 dark:border-gray-700">
					<p :class="sectionTitleCls">File đính kèm</p>
				</div>
				<div class="p-5 space-y-3">
					<!-- Existing file -->
					<div v-if="record?.siDocUrl" class="flex items-center gap-3">
						<svg
							class="w-5 h-5 text-gray-400 flex-shrink-0"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="1.5"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
							/>
						</svg>
						<a
							:href="record.siDocUrl"
							target="_blank"
							rel="noopener noreferrer"
							class="text-sm text-brand-600 dark:text-brand-400 hover:underline"
						>
							Xem scan BHYT / sổ BHXH
						</a>
					</div>

					<div v-if="canEdit">
						<label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
							{{ record?.siDocUrl ? 'Tải lên file mới (thay thế)' : 'Tải lên scan BHYT / sổ BHXH' }}
							<span class="font-normal text-gray-400">(PDF/JPG/PNG, tối đa 10MB)</span>
						</label>
						<div
							class="flex items-center gap-3 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 px-4 py-3 cursor-pointer hover:border-brand-400 transition-colors"
							@click="fileInputRef?.click()"
						>
							<svg
								class="w-5 h-5 text-gray-400 flex-shrink-0"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="1.5"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"
								/>
							</svg>
							<span class="text-sm text-gray-500 dark:text-gray-400">
								{{ selectedFile ? selectedFile.name : 'Chọn tệp đính kèm' }}
							</span>
						</div>
						<input
							ref="fileInputRef"
							type="file"
							accept=".pdf,.jpg,.jpeg,.png"
							class="hidden"
							@change="handleFileChange"
						/>
					</div>
				</div>
			</div>

			<!-- ─── Note ──────────────────────────────────────────────────────── -->
			<div v-if="canEdit" class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
				<label :class="labelCls">Ghi chú</label>
				<textarea
					v-model="note"
					v-bind="noteAttrs"
					rows="2"
					:class="inputCls"
					placeholder="Ghi chú bổ sung (nếu có)"
				/>
			</div>

			<!-- ─── Save button ───────────────────────────────────────────────── -->
			<div v-if="canEdit" class="flex justify-end">
				<CommonAppButton type="submit" :loading="saving">Lưu thay đổi</CommonAppButton>
			</div>
		</form>
	</div>
</template>
