<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import { formatDate } from '~/utils/date';
	import type { ContractResponse, ContractType, ContractStatus } from '~/types/contract.types';

	const props = defineProps<{ employeeId: number }>();

	const toast = useToast();
	const authStore = useAuthStore();
	const { contracts, loading, fetchByEmployee, create, update, activate, terminate } = useContracts();

	const canEdit = computed(() => authStore.user?.role === 'HR' || authStore.user?.role === 'ADMIN');

	// ─── Modal state ──────────────────────────────────────────────────────────────
	const showContractModal = ref(false);
	const editingContract = ref<ContractResponse | null>(null);
	const terminatingContract = ref<ContractResponse | null>(null);
	const activatingId = ref<number | null>(null);
	const selectedFile = ref<File | null>(null);
	const fileInputRef = ref<HTMLInputElement | null>(null);

	onMounted(() => fetchByEmployee(props.employeeId));

	// ─── Create/Edit form ─────────────────────────────────────────────────────────
	const schema = toTypedSchema(
		z.object({
			contractNumber: z.string().min(1, 'Vui lòng nhập số hợp đồng'),
			contractType: z.enum(['PROBATION', 'FIXED_TERM', 'INDEFINITE', 'SEASONAL'] as const, {
				required_error: 'Vui lòng chọn loại hợp đồng',
				invalid_type_error: 'Vui lòng chọn loại hợp đồng',
			}),
			startDate: z.string().min(1, 'Vui lòng chọn ngày bắt đầu'),
			endDate: z.string().optional(),
			baseSalary: z.union([z.coerce.number().positive('Lương phải lớn hơn 0'), z.literal('')]).optional(),
			position: z.string().optional(),
			note: z.string().optional(),
		}),
	);

	const { handleSubmit, defineField, errors, isSubmitting, resetForm } = useForm({
		validationSchema: schema,
	});

	const [contractNumber, contractNumberAttrs] = defineField('contractNumber');
	const [contractType] = defineField('contractType');
	const [startDate] = defineField('startDate');
	const [endDate] = defineField('endDate');
	const [baseSalary, baseSalaryAttrs] = defineField('baseSalary');
	const [position, positionAttrs] = defineField('position');
	const [note, noteAttrs] = defineField('note');

	const showEndDate = computed(() => contractType.value !== 'INDEFINITE');

	// ─── Salary display (formatted input) ────────────────────────────────────────

	const salaryDisplay = ref('');
	let salaryDebounceTimer: ReturnType<typeof setTimeout> | null = null;

	function formatSalaryNumber(val: number | string | undefined | null): string {
		if (val === '' || val === undefined || val === null) return '';
		const num = Number(val);
		if (isNaN(num) || num <= 0) return '';
		return new Intl.NumberFormat('vi-VN').format(num);
	}

	function syncSalaryDisplay() {
		salaryDisplay.value = formatSalaryNumber(baseSalary.value);
	}

	function handleSalaryInput(e: Event) {
		const raw = (e.target as HTMLInputElement).value;
		const digits = raw.replace(/\D/g, '');
		const num = digits ? Number(digits) : '';

		// Update vee-validate field immediately for validation
		baseSalary.value = num as number | '';

		// Debounce 100ms to format display
		if (salaryDebounceTimer) clearTimeout(salaryDebounceTimer);
		salaryDebounceTimer = setTimeout(() => {
			salaryDisplay.value = formatSalaryNumber(num);
		}, 100);
	}

	function openCreate() {
		editingContract.value = null;
		selectedFile.value = null;
		resetForm({
			values: {
				contractNumber: '',
				contractType: undefined as unknown as ContractType,
				startDate: '',
				endDate: '',
				baseSalary: '',
				position: '',
				note: '',
			},
		});
		syncSalaryDisplay();
		showContractModal.value = true;
	}

	function openEdit(contract: ContractResponse) {
		editingContract.value = contract;
		selectedFile.value = null;
		resetForm({
			values: {
				contractNumber: contract.contractNumber,
				contractType: contract.contractType,
				startDate: contract.startDate,
				endDate: contract.endDate ?? '',
				baseSalary: contract.baseSalary ?? '',
				position: contract.position ?? '',
				note: contract.note ?? '',
			},
		});
		syncSalaryDisplay();
		showContractModal.value = true;
	}

	function closeContractModal() {
		showContractModal.value = false;
		editingContract.value = null;
		selectedFile.value = null;
	}

	function handleFileChange(e: Event) {
		const input = e.target as HTMLInputElement;
		selectedFile.value = input.files?.[0] ?? null;
	}

	const onSubmit = handleSubmit(async values => {
		try {
			const dto = {
				employeeId: props.employeeId,
				contractNumber: values.contractNumber,
				contractType: values.contractType as ContractType,
				startDate: values.startDate,
				endDate: showEndDate.value && values.endDate ? values.endDate : undefined,
				baseSalary: values.baseSalary ? Number(values.baseSalary) : undefined,
				position: values.position || undefined,
				note: values.note || undefined,
			};

			if (editingContract.value) {
				const { employeeId: _eid, ...updateDto } = dto;
				await update(editingContract.value.id, updateDto, selectedFile.value ?? undefined);
				toast.success('Cập nhật hợp đồng thành công');
			} else {
				await create(dto, selectedFile.value ?? undefined);
				toast.success('Tạo hợp đồng thành công');
			}
			closeContractModal();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
		}
	});

	// ─── Terminate ────────────────────────────────────────────────────────────────
	const terminateNote = ref('');
	const terminating = ref(false);

	function openTerminate(contract: ContractResponse) {
		terminatingContract.value = contract;
		terminateNote.value = '';
	}

	function closeTerminate() {
		terminatingContract.value = null;
		terminateNote.value = '';
	}

	async function handleTerminate() {
		if (!terminatingContract.value) return;
		terminating.value = true;
		try {
			await terminate(terminatingContract.value.id, { note: terminateNote.value || undefined });
			toast.success('Đã chấm dứt hợp đồng');
			closeTerminate();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
		} finally {
			terminating.value = false;
		}
	}

	async function handleActivate(contract: ContractResponse) {
		activatingId.value = contract.id;
		try {
			await activate(contract.id);
			toast.success('Kích hoạt hợp đồng thành công');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
		} finally {
			activatingId.value = null;
		}
	}

	// ─── Helpers ──────────────────────────────────────────────────────────────────
	function formatCurrency(amount: number | null): string {
		if (amount === null) return '—';
		return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
	}

	const contractTypeOptions = [
		{ value: 'PROBATION', label: 'Thử việc' },
		{ value: 'FIXED_TERM', label: 'Xác định thời hạn' },
		{ value: 'INDEFINITE', label: 'Không xác định thời hạn' },
		{ value: 'SEASONAL', label: 'Thời vụ' },
	];

	const inputCls =
		'block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50';
	const labelCls = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5';

	const statusCls: Record<ContractStatus, string> = {
		DRAFT: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
		ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
		EXPIRED: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
		TERMINATED: 'bg-rose-200 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
	};

	const typeCls: Record<ContractType, string> = {
		PROBATION: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
		FIXED_TERM: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
		INDEFINITE: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
		SEASONAL: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
	};
</script>

<template>
	<div class="space-y-4">
		<!-- Header -->
		<div class="flex items-center justify-between">
			<h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Hợp đồng lao động</h3>
			<CommonAppButton v-if="canEdit" size="sm" @click="openCreate">
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
				</svg>
				Thêm hợp đồng
			</CommonAppButton>
		</div>

		<!-- Loading -->
		<div v-if="loading" class="space-y-3">
			<div v-for="i in 2" :key="i" class="h-28 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
		</div>

		<!-- Empty state -->
		<div
			v-else-if="!contracts.length"
			class="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500"
		>
			<svg class="w-10 h-10 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
				/>
			</svg>
			<p class="text-sm">Chưa có hợp đồng nào</p>
		</div>

		<!-- Contract timeline -->
		<div v-else class="relative space-y-4">
			<!-- Timeline line -->
			<div class="absolute left-4 top-5 bottom-5 w-0.5 bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

			<div v-for="contract in contracts" :key="contract.id" class="relative pl-10">
				<!-- Timeline dot -->
				<div
					class="absolute left-2.5 top-5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900 shadow-sm"
					:class="contract.status === 'ACTIVE' ? 'bg-green-500' : contract.status === 'DRAFT' ? 'bg-gray-400' : 'bg-red-400'"
				/>

				<!-- Contract card -->
				<div
					class="bg-white dark:bg-gray-900 rounded-xl border shadow-sm overflow-hidden"
					:class="
						contract.isExpiringSoon
							? 'border-amber-300 dark:border-amber-600'
							: 'border-gray-200 dark:border-gray-700'
					"
				>
					<!-- Expiry warning banner -->
					<div
						v-if="contract.isExpiringSoon && contract.daysUntilExpiry !== null"
						class="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700"
					>
						<svg
							class="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
							/>
						</svg>
						<span class="text-xs font-medium text-amber-700 dark:text-amber-400">
							Sắp hết hạn — còn {{ contract.daysUntilExpiry }} ngày
						</span>
					</div>

					<div class="p-4">
						<!-- Top row: badges + number -->
						<div class="flex flex-wrap items-center gap-2 mb-3">
							<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" :class="typeCls[contract.contractType]">
								{{ contract.contractTypeLabel }}
							</span>
							<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" :class="statusCls[contract.status]">
								{{ contract.statusLabel }}
							</span>
							<span class="ml-auto font-mono text-xs font-semibold text-gray-700 dark:text-gray-300">
								{{ contract.contractNumber }}
							</span>
						</div>

						<!-- Details grid -->
						<div class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
							<div>
								<p class="text-xs text-gray-500 dark:text-gray-400">Ngày bắt đầu</p>
								<p class="font-medium text-gray-900 dark:text-white">{{ formatDate(contract.startDate) }}</p>
							</div>
							<div>
								<p class="text-xs text-gray-500 dark:text-gray-400">Ngày kết thúc</p>
								<p class="font-medium text-gray-900 dark:text-white">
									{{ contract.endDate ? formatDate(contract.endDate) : 'Không xác định' }}
								</p>
							</div>
							<div>
								<p class="text-xs text-gray-500 dark:text-gray-400">Lương cơ bản</p>
								<p class="font-medium text-gray-900 dark:text-white">{{ formatCurrency(contract.baseSalary) }}</p>
							</div>
							<div v-if="contract.position" class="col-span-2 sm:col-span-3">
								<p class="text-xs text-gray-500 dark:text-gray-400">Chức vụ theo HĐ</p>
								<p class="font-medium text-gray-900 dark:text-white">{{ contract.position }}</p>
							</div>
						</div>

						<!-- Actions row -->
						<div class="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
							<!-- PDF viewer -->
							<a
								v-if="contract.fileUrl"
								:href="contract.fileUrl"
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-1.5 text-xs text-brand-600 dark:text-brand-400 hover:underline"
							>
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
									/>
								</svg>
								Xem file hợp đồng
							</a>

							<template v-if="canEdit">
								<div class="ml-auto flex items-center gap-2">
									<!-- Activate (DRAFT only) -->
									<CommonAppButton
										v-if="contract.status === 'DRAFT'"
										size="sm"
										variant="outline"
										:loading="activatingId === contract.id"
										@click="handleActivate(contract)"
									>
										Kích hoạt
									</CommonAppButton>

									<!-- Edit (DRAFT only) -->
									<CommonAppButton
										v-if="contract.status === 'DRAFT'"
										size="sm"
										variant="outline"
										@click="openEdit(contract)"
									>
										Sửa
									</CommonAppButton>

									<!-- Terminate (ACTIVE only) -->
									<CommonAppButton
										v-if="contract.status === 'ACTIVE'"
										size="sm"
										variant="danger_outline"
										@click="openTerminate(contract)"
									>
										Chấm dứt
									</CommonAppButton>
								</div>
							</template>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- ─── Create/Edit Modal ───────────────────────────────────────────────────── -->
	<Teleport to="body">
		<Transition
			enter-active-class="transition ease-out duration-150"
			enter-from-class="opacity-0"
			enter-to-class="opacity-100"
			leave-active-class="transition ease-in duration-100"
			leave-from-class="opacity-100"
			leave-to-class="opacity-0"
		>
			<div
				v-if="showContractModal"
				class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
				@click.self="closeContractModal"
			>
				<div
					class="bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-lg max-h-[90vh] overflow-y-auto"
				>
					<div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">
							{{ editingContract ? 'Chỉnh sửa hợp đồng' : 'Tạo hợp đồng lao động' }}
						</h2>
						<button
							type="button"
							class="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
							@click="closeContractModal"
						>
							<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>

					<form class="p-6 space-y-4" @submit.prevent="onSubmit">
						<!-- Contract number -->
						<div>
							<label :class="labelCls">Số hợp đồng <span class="text-red-500">*</span></label>
							<input
								v-model="contractNumber"
								v-bind="contractNumberAttrs"
								:class="[inputCls, errors.contractNumber ? 'border-red-400 focus:ring-red-300' : '']"
								placeholder="VD: HĐ-2025-001"
							/>
							<p v-if="errors.contractNumber" class="mt-1 text-xs text-red-500">{{ errors.contractNumber }}</p>
						</div>

						<!-- Contract type -->
						<div>
							<label :class="labelCls">Loại hợp đồng <span class="text-red-500">*</span></label>
							<UiSelect v-model="contractType" :options="[{ value: '', label: '-- Chọn loại --' }, ...contractTypeOptions]" />
							<p v-if="errors.contractType" class="mt-1 text-xs text-red-500">{{ errors.contractType }}</p>
						</div>

						<!-- Start date -->
						<div>
							<label :class="labelCls">Ngày bắt đầu <span class="text-red-500">*</span></label>
							<UiDatePicker v-model="startDate" />
							<p v-if="errors.startDate" class="mt-1 text-xs text-red-500">{{ errors.startDate }}</p>
						</div>

						<!-- End date (hidden for INDEFINITE) -->
						<div v-if="showEndDate">
							<label :class="labelCls">Ngày kết thúc</label>
							<UiDatePicker v-model="endDate" />
							<p v-if="errors.endDate" class="mt-1 text-xs text-red-500">{{ errors.endDate }}</p>
						</div>

						<!-- Base salary -->
						<div>
							<label :class="labelCls">Lương cơ bản</label>
							<input
								:value="salaryDisplay"
								type="text"
								inputmode="numeric"
								:class="[inputCls, errors.baseSalary ? 'border-red-400 focus:ring-red-300' : '']"
								placeholder="VD: 15.000.000"
								@input="handleSalaryInput"
								@blur="salaryDisplay = formatSalaryNumber(baseSalary)"
							/>
							<p v-if="errors.baseSalary" class="mt-1 text-xs text-red-500">{{ errors.baseSalary }}</p>
						</div>

						<!-- Position -->
						<div>
							<label :class="labelCls">Chức vụ theo hợp đồng</label>
							<input
								v-model="position"
								v-bind="positionAttrs"
								:class="inputCls"
								placeholder="VD: Software Engineer"
							/>
						</div>

						<!-- Note -->
						<div>
							<label :class="labelCls">Ghi chú</label>
							<textarea
								v-model="note"
								v-bind="noteAttrs"
								rows="2"
								:class="inputCls"
								placeholder="Ghi chú thêm (nếu có)"
							/>
						</div>

						<!-- File upload -->
						<div>
							<label :class="labelCls">File hợp đồng (PDF/DOCX/JPG/PNG, tối đa 10MB)</label>
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
							<input ref="fileInputRef" type="file" accept=".pdf,.docx,.jpg,.jpeg,.png" class="hidden" @change="handleFileChange" />
						</div>

						<!-- Actions -->
						<div class="flex justify-end gap-3 pt-2">
							<CommonAppButton type="button" variant="outline" @click="closeContractModal">Hủy</CommonAppButton>
							<CommonAppButton type="submit" :loading="isSubmitting">
								{{ editingContract ? 'Lưu thay đổi' : 'Tạo hợp đồng' }}
							</CommonAppButton>
						</div>
					</form>
				</div>
			</div>
		</Transition>
	</Teleport>

	<!-- ─── Terminate Modal ──────────────────────────────────────────────────────── -->
	<Teleport to="body">
		<Transition
			enter-active-class="transition ease-out duration-150"
			enter-from-class="opacity-0"
			enter-to-class="opacity-100"
			leave-active-class="transition ease-in duration-100"
			leave-from-class="opacity-100"
			leave-to-class="opacity-0"
		>
			<div
				v-if="terminatingContract"
				class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
				@click.self="closeTerminate"
			>
				<div
					class="bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md"
				>
					<div class="flex items-start gap-4 p-6">
						<div
							class="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0"
						>
							<svg
								class="w-5 h-5 text-red-600 dark:text-red-400"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
								/>
							</svg>
						</div>
						<div class="flex-1">
							<h3 class="font-semibold text-gray-900 dark:text-white">Chấm dứt hợp đồng</h3>
							<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
								Hợp đồng
								<strong class="text-gray-700 dark:text-gray-300">{{ terminatingContract.contractNumber }}</strong>
								sẽ bị chấm dứt. Hành động này không thể hoàn tác.
							</p>

							<div class="mt-4">
								<label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
									Lý do chấm dứt
								</label>
								<textarea
									v-model="terminateNote"
									rows="3"
									class="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
									placeholder="Nhập lý do chấm dứt hợp đồng (nếu có)"
								/>
							</div>

							<div class="flex justify-end gap-3 mt-5">
								<CommonAppButton type="button" variant="outline" @click="closeTerminate">Hủy</CommonAppButton>
								<CommonAppButton variant="danger" :loading="terminating" @click="handleTerminate">
									Xác nhận chấm dứt
								</CommonAppButton>
							</div>
						</div>
					</div>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>
