<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import { formatDateTime } from '~/utils/date';
	import { formatMonth } from '~/utils/hr-profile.utils';

	const props = defineProps<{ employeeId: number }>();

	const toast = useToast();
	const authStore = useAuthStore();
	const { record, loadError, loading, saving, fetchByEmployee, save } = useSocialInsurance();

	const { canWrite } = useModuleAccess();
	const canEdit = computed(
		() => canWrite('CONTRACT_INSURANCE') && (authStore.user?.role === 'HR' || authStore.user?.role === 'ADMIN'),
	);

	onMounted(() => fetchByEmployee(props.employeeId));

	/**
	 * Lô 3a: mã số thuế và người phụ thuộc chuyển lên hồ sơ nhân viên.
	 *
	 * `PUT /v1/social-insurance/:id` bỏ qua ba trường `taxCode`, `dependents`,
	 * `dependentDetails`, nên form này không còn ô nhập; phần thuế chỉ hiện lại những gì hồ sơ
	 * đang có, kèm đường dẫn sang tab Thân nhân để sửa đúng chỗ.
	 */
	const dependents = computed(() => record.value?.taxInfo.dependentDetails ?? []);
	const relativesTabUrl = computed(() => `/management/employees/${props.employeeId}?tab=relatives`);

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
			socialInsuranceNumber: z.string().min(1, 'Mã số BHXH không được để trống'),
			// `z.coerce.number()` KHÔNG dùng được ở đây: Number('') === 0 nên ô để trống sẽ
			// lọt qua min(0) và âm thầm gửi 0. preprocess đẩy chuỗi rỗng về undefined để
			// required_error bắn đúng.
			insuranceSalary: z.preprocess(
				v => (v === '' || v === null || v === undefined ? undefined : Number(v)),
				z
					.number({
						required_error: 'Vui lòng nhập mức lương tham gia BHXH',
						invalid_type_error: 'Mức lương tham gia BHXH không hợp lệ',
					})
					.min(0, 'Mức lương tham gia BHXH không được âm'),
			),
			hasSocialInsuranceBook: z.boolean(),
			healthInsuranceNumber: z.string().optional(),
			healthInsuranceExpiry: z.string().optional(),
			registeredHospital: z.string().optional(),
			effectiveDate: z.string().optional(),
			note: z.string().optional(),
		}),
	);

	const { handleSubmit, defineField, errors, setValues } = useForm({
		validationSchema: schema,
		initialValues: {
			socialInsuranceNumber: '',
			insuranceSalary: '' as unknown as number,
			hasSocialInsuranceBook: false,
		},
	});

	const [socialInsuranceNumber, siNumAttrs] = defineField('socialInsuranceNumber');
	const [insuranceSalary] = defineField('insuranceSalary');
	const [hasSocialInsuranceBook] = defineField('hasSocialInsuranceBook');
	const [healthInsuranceNumber, hiNumAttrs] = defineField('healthInsuranceNumber');
	const [healthInsuranceExpiry] = defineField('healthInsuranceExpiry');
	const [registeredHospital, hospitalAttrs] = defineField('registeredHospital');
	const [effectiveDate] = defineField('effectiveDate');
	const [note, noteAttrs] = defineField('note');

	// ─── Mức lương: gõ số thuần, hiển thị có dấu nghìn ───────────────────────────
	const salaryDisplay = ref('');

	/** Khác helper bên Contracts ở chỗ GIỮ số 0 — 0 là mức lương hợp lệ, không phải "rỗng". */
	function formatSalary(val: number | string | null | undefined): string {
		if (val === '' || val === null || val === undefined) return '';
		const num = Number(val);
		if (Number.isNaN(num)) return '';
		return new Intl.NumberFormat('vi-VN').format(num);
	}

	/**
	 * Cập nhật `salaryDisplay` NGAY, không debounce.
	 *
	 * Ô nhập bind `:value="salaryDisplay"` một chiều. Mỗi phím gõ làm vee-validate đổi
	 * `errors.insuranceSalary` → component re-render → Vue thấy DOM value lệch với
	 * `salaryDisplay` và ghi đè ngược ô nhập. Nếu để debounce 100ms thì giữa hai phím ô
	 * nhập bị trả về giá trị cũ, nên phím sau THAY THẾ phím trước thay vì nối vào: gõ
	 * "12500000" chỉ còn đúng ký tự cuối → lưu nhầm 0. (Bẫy này cũng có ở
	 * EmployeeContracts.vue, chỉ chưa lộ vì form đó không bật/tắt lỗi theo từng phím.)
	 */
	function handleSalaryInput(e: Event) {
		const digits = (e.target as HTMLInputElement).value.replace(/\D/g, '');
		const num = digits ? Number(digits) : '';

		insuranceSalary.value = num as unknown as number;
		salaryDisplay.value = digits ? formatSalary(num) : '';
	}

	// Populate form when record loads
	watch(
		record,
		r => {
			if (!r) return;
			setValues({
				socialInsuranceNumber: r.socialInsuranceNumber ?? '',
				insuranceSalary: r.insuranceSalary,
				hasSocialInsuranceBook: r.hasSocialInsuranceBook,
				healthInsuranceNumber: r.healthInsuranceNumber ?? '',
				healthInsuranceExpiry: r.healthInsuranceExpiry ?? '',
				registeredHospital: r.registeredHospital ?? '',
				effectiveDate: r.effectiveDate ?? '',
				note: r.note ?? '',
			});
			salaryDisplay.value = formatSalary(r.insuranceSalary);
		},
		{ immediate: false },
	);

	const onSubmit = handleSubmit(async values => {
		try {
			await save(
				props.employeeId,
				{
					// Hai field này bắt buộc ở MỌI request (upsert, không phải PATCH từng phần)
					// nên không được rơi về undefined như các field dưới.
					socialInsuranceNumber: values.socialInsuranceNumber,
					insuranceSalary: values.insuranceSalary,
					hasSocialInsuranceBook: values.hasSocialInsuranceBook,
					healthInsuranceNumber: values.healthInsuranceNumber || undefined,
					healthInsuranceExpiry: values.healthInsuranceExpiry || undefined,
					registeredHospital: values.registeredHospital || undefined,
					effectiveDate: values.effectiveDate || undefined,
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
		<CommonAppModuleNotice module="CONTRACT_INSURANCE" class="mb-4" />

		<!-- Loading -->
		<div v-if="loading" class="space-y-4">
			<div v-for="i in 3" :key="i" class="h-32 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
		</div>

		<!--
			Tải hỏng thì DỪNG ở đây, không rơi xuống form.
			`record = null` vừa có nghĩa "chưa nhập BHXH" vừa có nghĩa "tải hỏng", nên nếu
			không chặn, người bị 403 vẫn thấy form nhập BHXH của nhân viên khác.
		-->
		<div
			v-else-if="loadError"
			class="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-5 py-4"
		>
			<p class="text-sm font-medium text-amber-800 dark:text-amber-300">
				Không hiển thị được thông tin BHXH
			</p>
			<p class="mt-1 text-xs text-amber-700 dark:text-amber-400">{{ loadError }}</p>
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
						<label :class="labelCls">Mã số BHXH <span class="text-red-500">*</span></label>
						<input
							v-model="socialInsuranceNumber"
							v-bind="siNumAttrs"
							:class="[inputCls, errors.socialInsuranceNumber ? 'border-red-400' : '']"
							:disabled="!canEdit"
							placeholder="10 chữ số"
						/>
						<p v-if="errors.socialInsuranceNumber" class="mt-1 text-xs text-red-500">
							{{ errors.socialInsuranceNumber }}
						</p>
					</div>
					<div>
						<label :class="labelCls">Mức lương tham gia BHXH <span class="text-red-500">*</span></label>
						<div class="relative">
							<input
								:value="salaryDisplay"
								inputmode="numeric"
								:class="[inputCls, 'pr-12', errors.insuranceSalary ? 'border-red-400' : '']"
								:disabled="!canEdit"
								placeholder="VD: 12.500.000"
								@input="handleSalaryInput"
							/>
							<span
								class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-gray-400"
							>
								VNĐ
							</span>
						</div>
						<p v-if="errors.insuranceSalary" class="mt-1 text-xs text-red-500">
							{{ errors.insuranceSalary }}
						</p>
					</div>
					<div>
						<label :class="labelCls">Có sổ BHXH</label>
						<div class="flex items-center gap-2">
							<button
								v-for="opt in [
									{ value: true, label: 'Có' },
									{ value: false, label: 'Không' },
								]"
								:key="String(opt.value)"
								type="button"
								:disabled="!canEdit"
								:class="[
									'flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors disabled:opacity-50',
									hasSocialInsuranceBook === opt.value
										? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
										: 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800',
								]"
								@click="hasSocialInsuranceBook = opt.value"
							>
								{{ opt.label }}
							</button>
						</div>
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

			<!-- ─── Section 2: Thuế, chỉ đọc từ hồ sơ nhân viên (lô 3a) ──────── -->
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
				<div class="px-5 py-3.5 border-b border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
					<p :class="sectionTitleCls" class="!mb-0">Thuế thu nhập cá nhân</p>
					<NuxtLink
						:to="relativesTabUrl"
						class="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
					>
						Mở tab Thân nhân để sửa
					</NuxtLink>
				</div>
				<div class="p-5 space-y-5">
					<p class="text-xs text-gray-500 dark:text-gray-400">
						Mã số thuế và người phụ thuộc nay nằm trong hồ sơ nhân viên, nên ở đây chỉ xem. Mã số thuế sửa ở khối
						Ngân hàng và thuế của tab Thông tin, người phụ thuộc sửa ở tab Thân nhân.
					</p>

					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div>
							<p :class="labelCls">Mã số thuế đang dùng</p>
							<p class="text-sm font-mono tabular-nums text-gray-900 dark:text-white">
								{{ record?.taxInfo.taxCode ?? '—' }}
							</p>
						</div>
						<div>
							<p :class="labelCls">Người phụ thuộc giảm trừ tháng này</p>
							<p class="text-sm text-gray-900 dark:text-white">{{ record?.taxInfo.dependents ?? 0 }}</p>
						</div>
					</div>

					<div>
						<p class="mb-3 text-xs font-medium text-gray-600 dark:text-gray-400">Chi tiết người phụ thuộc</p>
						<p v-if="!dependents.length" class="py-3 text-xs text-gray-400 dark:text-gray-500">
							Hồ sơ chưa có người phụ thuộc nào.
						</p>
						<div v-else class="overflow-x-auto">
							<table class="w-full text-sm">
								<thead>
									<tr class="border-b border-gray-200 dark:border-gray-700 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
										<th class="py-2 pr-4 text-left font-medium">Họ tên</th>
										<th class="py-2 pr-4 text-left font-medium">Quan hệ</th>
										<th class="py-2 pr-4 text-left font-medium">Số định danh</th>
										<th class="py-2 text-left font-medium">Giảm trừ</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
									<tr v-for="dep in dependents" :key="dep.relativeId">
										<td class="py-2 pr-4 text-gray-900 dark:text-white">{{ dep.name }}</td>
										<td class="py-2 pr-4 text-gray-700 dark:text-gray-300">{{ dep.relationship }}</td>
										<td class="py-2 pr-4 font-mono text-xs text-gray-700 dark:text-gray-300">
											{{ dep.idNumber || '—' }}
										</td>
										<td class="py-2 whitespace-nowrap tabular-nums text-gray-700 dark:text-gray-300">
											{{ dep.effectiveDate ? formatMonth(dep.effectiveDate) : '—' }}
											<template v-if="dep.endDate"> → {{ formatMonth(dep.endDate) }}</template>
											<template v-else-if="dep.effectiveDate"> → nay</template>
										</td>
									</tr>
								</tbody>
							</table>
						</div>
					</div>
				</div>
			</div>

			<!-- ─── Section 3: File upload ────────────────────────────────────── -->
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
