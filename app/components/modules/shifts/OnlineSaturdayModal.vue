<script setup lang="ts">
import type { WorkShiftResponse } from '~/types/shift.types';
import type { EmployeeSummary } from '~/types/employee.types';

const props = defineProps<{
	modelValue: boolean;
	shifts: WorkShiftResponse[];
}>();

const emit = defineEmits<{
	'update:modelValue': [value: boolean];
	success: [];
}>();

// ─── Composables ───
const toast = useToast();
const directoryStore = useDirectoryStore();
const { bulkAssignOnlineSaturday } = useShiftSchedules();

// ─── Form state ───
const now = new Date();
type AssignMode = 'month' | 'year';
const mode = ref<AssignMode>('month');
const selectedMonth = ref(now.getMonth() + 1);
const selectedYear = ref(now.getFullYear());
const selectedShiftId = ref<number | undefined>(undefined);
const selectedEmployeeIds = ref<Set<number>>(new Set());
const employeeSearch = ref('');
const selectedDepartmentId = ref<number | null>(null);
const submitting = ref(false);

// ─── Computed ───
const yearOptions = computed(() =>
	[-1, 0, 1, 2].map(offset => {
		const y = now.getFullYear() + offset;
		return { value: y, label: String(y) };
	}),
);

const activeShiftOptions = computed(() =>
	props.shifts
		.filter(s => s.isActive)
		.map(s => ({
			value: s.id,
			label: `${s.name} (${s.checkInTime} – ${s.checkOutTime})`,
		})),
);

function normalize(s: string) {
	return s
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase();
}

const departmentOptions = computed(() => {
	const seen = new Map<number, string>();
	for (const e of directoryStore.employees) {
		if (e.department && !seen.has(e.department.id)) {
			seen.set(e.department.id, e.department.name);
		}
	}
	return Array.from(seen.entries())
		.sort((a, b) => a[1].localeCompare(b[1], 'vi'))
		.map(([id, name]) => ({ id, name }));
});

const filteredEmployees = computed<EmployeeSummary[]>(() => {
	const q = normalize(employeeSearch.value.trim());
	return directoryStore.employees.filter(e => {
		if (selectedDepartmentId.value !== null && e.department?.id !== selectedDepartmentId.value) return false;
		if (!q) return true;
		return normalize(e.fullName).includes(q) || e.employeeCode.toLowerCase().includes(q);
	});
});

const allSelected = computed(
	() =>
		filteredEmployees.value.length > 0 &&
		filteredEmployees.value.every(e => selectedEmployeeIds.value.has(e.id)),
);

const saturdayCount = computed(() => {
	if (mode.value === 'year') {
		let count = 0;
		const d = new Date(selectedYear.value, 0, 1);
		while (d.getFullYear() === selectedYear.value) {
			if (d.getDay() === 6) count++;
			d.setDate(d.getDate() + 1);
		}
		return count;
	}
	let count = 0;
	const d = new Date(selectedYear.value, selectedMonth.value - 1, 1);
	while (d.getMonth() === selectedMonth.value - 1) {
		if (d.getDay() === 6) count++;
		d.setDate(d.getDate() + 1);
	}
	return count;
});

const scopeLabel = computed(() =>
	mode.value === 'year'
		? `cả năm ${selectedYear.value}`
		: `tháng ${selectedMonth.value}/${selectedYear.value}`,
);

// ─── Methods ───
function close() {
	emit('update:modelValue', false);
}

function resetForm() {
	mode.value = 'month';
	selectedMonth.value = now.getMonth() + 1;
	selectedYear.value = now.getFullYear();
	selectedShiftId.value = undefined;
	selectedEmployeeIds.value = new Set();
	employeeSearch.value = '';
	selectedDepartmentId.value = null;
}

function toggleEmployee(id: number) {
	const next = new Set(selectedEmployeeIds.value);
	if (next.has(id)) next.delete(id);
	else next.add(id);
	selectedEmployeeIds.value = next;
}

function toggleAll() {
	if (allSelected.value) {
		selectedEmployeeIds.value = new Set();
	} else {
		selectedEmployeeIds.value = new Set(filteredEmployees.value.map(e => e.id));
	}
}

function onShiftChange(v: string | number | undefined) {
	selectedShiftId.value = typeof v === 'number' ? v : undefined;
}

async function submit() {
	if (!selectedShiftId.value) {
		toast.error('Vui lòng chọn ca làm việc');
		return;
	}
	if (selectedEmployeeIds.value.size === 0) {
		toast.error('Vui lòng chọn ít nhất 1 nhân viên');
		return;
	}

	submitting.value = true;
	try {
		const dto = {
			year: selectedYear.value,
			shiftId: selectedShiftId.value,
			employeeIds: Array.from(selectedEmployeeIds.value),
			...(mode.value === 'month' ? { month: selectedMonth.value } : {}),
		};
		const result = await bulkAssignOnlineSaturday(dto);
		toast.success(
			`Đã cấu hình T7 online ${scopeLabel.value} cho ${selectedEmployeeIds.value.size} nhân viên (${result.saturdays} ngày T7, ${result.assigned} lượt gán)`,
		);
		emit('success');
		close();
		resetForm();
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
	} finally {
		submitting.value = false;
	}
}

// ─── Lifecycle ───
watch(
	() => props.modelValue,
	open => {
		if (open) {
			resetForm();
			directoryStore.load();
		}
	},
);
</script>

<template>
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
				v-if="modelValue"
				class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
				@click.self="close"
			>
				<div
					class="bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-lg max-h-[90vh] flex flex-col"
				>
					<!-- Header -->
					<div class="flex items-center gap-3 px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
						<div
							class="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center flex-shrink-0"
						>
							<span class="text-base">🖥️</span>
						</div>
						<h2 class="text-base font-semibold text-gray-900 dark:text-white flex-1">Cấu hình T7 Online</h2>
						<button
							class="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
							@click="close"
						>
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>

					<!-- Body -->
					<div class="flex-1 overflow-y-auto p-6 space-y-5">
						<!-- Warning box -->
						<div
							class="flex gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
						>
							<span class="text-base flex-shrink-0">ℹ️</span>
							<p class="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
								Hệ thống sẽ tự động tạo bản ghi <strong>PRESENT</strong> lúc 23:50 mỗi T7.
								Nếu nhân viên có đơn nghỉ phép T7 đó, bản ghi PRESENT sẽ không được tạo
								(đơn nghỉ ưu tiên hơn).
							</p>
						</div>

						<!-- Mode toggle -->
						<div>
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Phạm vi gán</label>
							<div
								class="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-1 gap-1"
							>
								<button
									:class="[
										'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
										mode === 'month'
											? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
											: 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
									]"
									@click="mode = 'month'"
								>
									1 tháng
								</button>
								<button
									:class="[
										'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
										mode === 'year'
											? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
											: 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
									]"
									@click="mode = 'year'"
								>
									Cả năm
								</button>
							</div>
						</div>

						<!-- Tháng / Năm -->
						<div :class="mode === 'month' ? 'grid grid-cols-2 gap-3' : ''">
							<!-- Tháng — chỉ hiện khi mode = month -->
							<div v-if="mode === 'month'">
								<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Tháng <span class="text-red-500">*</span>
								</label>
								<select
									v-model.number="selectedMonth"
									class="w-full h-10 px-3 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
								>
									<option v-for="m in 12" :key="m" :value="m">Tháng {{ m }}</option>
								</select>
							</div>

							<!-- Năm -->
							<div>
								<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Năm <span class="text-red-500">*</span>
								</label>
								<select
									v-model.number="selectedYear"
									class="w-full h-10 px-3 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
								>
									<option v-for="opt in yearOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
								</select>
							</div>
						</div>

						<!-- Ca làm việc -->
						<div>
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
								Ca làm việc <span class="text-red-500">*</span>
							</label>
							<UiSelect
								:model-value="selectedShiftId"
								:options="activeShiftOptions"
								placeholder="Chọn ca online T7..."
								@update:model-value="onShiftChange"
							/>
						</div>

						<!-- Nhân viên -->
						<div>
							<div class="flex items-center justify-between mb-2">
								<label class="text-sm font-medium text-gray-700 dark:text-gray-300">
									Nhân viên <span class="text-red-500">*</span>
									<span class="font-normal text-gray-400 dark:text-gray-500 ml-1">
										({{ selectedEmployeeIds.size }} đã chọn)
									</span>
								</label>
								<button
									type="button"
									class="text-xs text-brand-600 dark:text-brand-400 hover:underline"
									@click="toggleAll"
								>
									{{ allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả' }}
								</button>
							</div>

							<!-- Filters row -->
							<div class="flex gap-2 mb-2">
								<!-- Department filter -->
								<select
									v-model.number="selectedDepartmentId"
									class="h-9 px-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent min-w-0 flex-1"
								>
									<option :value="null">Tất cả phòng ban</option>
									<option v-for="dept in departmentOptions" :key="dept.id" :value="dept.id">
										{{ dept.name }}
									</option>
								</select>

								<!-- Search -->
								<div class="relative flex-1">
									<svg
										class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
										/>
									</svg>
									<input
										v-model="employeeSearch"
										type="text"
										placeholder="Tìm theo tên hoặc mã NV..."
										class="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
									/>
								</div>
							</div>

							<!-- List -->
							<div
								class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden max-h-52 overflow-y-auto"
							>
								<div v-if="directoryStore.loading" class="py-8 flex items-center justify-center">
									<svg class="animate-spin w-5 h-5 text-brand-600" fill="none" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
										<path
											class="opacity-75"
											fill="currentColor"
											d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
										/>
									</svg>
								</div>
								<p
									v-else-if="!filteredEmployees.length"
									class="py-6 text-center text-sm text-gray-400 dark:text-gray-500"
								>
									Không tìm thấy nhân viên
								</p>
								<label
									v-for="emp in filteredEmployees"
									:key="emp.id"
									class="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border-b border-gray-50 dark:border-gray-800 last:border-0"
								>
									<input
										type="checkbox"
										:checked="selectedEmployeeIds.has(emp.id)"
										class="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500"
										@change="toggleEmployee(emp.id)"
									/>
									<div class="flex-1 min-w-0">
										<p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ emp.fullName }}</p>
										<p class="text-xs text-gray-400 dark:text-gray-500">{{ emp.employeeCode }}</p>
									</div>
									<span
										v-if="emp.department"
										class="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[100px]"
									>
										{{ emp.department.name }}
									</span>
								</label>
							</div>
						</div>

						<!-- Preview -->
						<div
							v-if="selectedEmployeeIds.size > 0"
							class="flex items-center gap-2 px-4 py-3 rounded-lg bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800"
						>
							<svg
								class="w-4 h-4 text-sky-600 dark:text-sky-400 flex-shrink-0"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
							<p class="text-sm text-sky-800 dark:text-sky-300">
								Sẽ assign
								<strong>{{ saturdayCount }} ngày T7</strong>
								cho
								<strong>{{ selectedEmployeeIds.size }} nhân viên</strong>
								trong {{ scopeLabel }}
							</p>
						</div>
					</div>

					<!-- Footer -->
					<div
						class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex-shrink-0"
					>
						<CommonAppButton variant="outline" @click="close">Hủy</CommonAppButton>
						<CommonAppButton :loading="submitting" @click="submit">Xác nhận cấu hình</CommonAppButton>
					</div>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>
