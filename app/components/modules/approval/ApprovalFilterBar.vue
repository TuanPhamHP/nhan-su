<script setup lang="ts">
	import { storeToRefs } from 'pinia';
	import type { SelectOption } from '~/components/ui/Select.vue';
	import type { ApprovalFilterField, ApprovalFilterState } from '~/types/approval.types';

	const props = defineProps<{
		modelValue: ApprovalFilterState;
		defaultValue: ApprovalFilterState;
		fields: ApprovalFilterField[];
		statusOptions: SelectOption[];
	}>();

	const emit = defineEmits<{
		'update:modelValue': [value: ApprovalFilterState];
		change: [];
	}>();

	const directoryStore = useDirectoryStore();
	const { employees, departments } = storeToRefs(directoryStore);

	// ─── Options ──────────────────────────────────────────────────────────────────
	const departmentOptions = computed<SelectOption[]>(() => [
		{ value: undefined, label: 'Tất cả phòng ban' },
		...departments.value.map(d => ({ value: d.id, label: d.name })),
	]);

	// UiSelectInput không nhận undefined — dùng 0 làm giá trị "tất cả"
	const employeeOptions = computed<{ value: string | number; label: string }[]>(() => {
		const list = props.modelValue.departmentId
			? employees.value.filter(e => e.department?.id === props.modelValue.departmentId)
			: employees.value;
		return [
			{ value: 0, label: 'Tất cả nhân viên' },
			...list.map(e => ({ value: e.id, label: `${e.fullName} · ${e.employeeCode}` })),
		];
	});

	const monthOptions: SelectOption[] = [
		{ value: undefined, label: 'Tất cả tháng' },
		...Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `Tháng ${i + 1}` })),
	];

	const yearOptions = computed<SelectOption[]>(() => {
		const current = new Date().getFullYear();
		return [
			{ value: undefined, label: 'Tất cả năm' },
			...Array.from({ length: 5 }, (_, i) => current + 1 - i).map(y => ({ value: y, label: `Năm ${y}` })),
		];
	});

	// Chỉ hiện nút "Xóa lọc" khi filter đang khác mặc định của tab
	const isDirty = computed(() => {
		const f = props.modelValue;
		const d = props.defaultValue;
		return (
			f.status !== d.status ||
			f.departmentId !== d.departmentId ||
			f.employeeId !== d.employeeId ||
			(f.startDate ?? '') !== (d.startDate ?? '') ||
			(f.endDate ?? '') !== (d.endDate ?? '') ||
			f.month !== d.month ||
			f.year !== d.year
		);
	});

	// ─── Mutations ────────────────────────────────────────────────────────────────
	function has(field: ApprovalFilterField): boolean {
		return props.fields.includes(field);
	}

	function patch(part: Partial<ApprovalFilterState>) {
		emit('update:modelValue', { ...props.modelValue, ...part });
		emit('change');
	}

	function onDepartmentChange(v: string | number | undefined) {
		// Đổi phòng ban → nhân viên đang chọn có thể không còn thuộc phòng ban đó
		patch({ departmentId: typeof v === 'number' ? v : undefined, employeeId: undefined });
	}

	function resetFilters() {
		emit('update:modelValue', { ...props.defaultValue });
		emit('change');
	}
</script>

<template>
	<div
		class="flex flex-wrap items-end gap-3 p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700"
	>
		<div v-if="has('status')" class="w-full sm:w-44">
			<label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Trạng thái</label>
			<UiSelect
				:model-value="modelValue.status"
				:options="statusOptions"
				placeholder="Tất cả trạng thái"
				@update:model-value="v => patch({ status: v === undefined ? undefined : String(v) })"
			/>
		</div>

		<div v-if="has('department')" class="w-full sm:w-44">
			<label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Phòng ban</label>
			<UiSelect
				:model-value="modelValue.departmentId"
				:options="departmentOptions"
				placeholder="Tất cả phòng ban"
				@update:model-value="onDepartmentChange"
			/>
		</div>

		<div v-if="has('employee')" class="w-full sm:w-56">
			<label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Nhân viên</label>
			<UiSelectInput
				:model-value="modelValue.employeeId ?? 0"
				:options="employeeOptions"
				placeholder="Tất cả nhân viên"
				search-placeholder="Tìm tên hoặc mã NV..."
				@update:model-value="v => patch({ employeeId: Number(v) === 0 ? undefined : Number(v) })"
			/>
		</div>

		<div v-if="has('dateRange')" class="w-full sm:w-64">
			<label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Khoảng thời gian</label>
			<UiDateRangePicker
				:from-date="modelValue.startDate ?? ''"
				:to-date="modelValue.endDate ?? ''"
				placeholder="Tất cả thời gian"
				@update:from-date="v => patch({ startDate: v })"
				@update:to-date="v => patch({ endDate: v })"
			/>
		</div>

		<template v-if="has('monthYear')">
			<div class="w-full sm:w-36">
				<label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tháng</label>
				<UiSelect
					:model-value="modelValue.month"
					:options="monthOptions"
					placeholder="Tất cả tháng"
					@update:model-value="v => patch({ month: typeof v === 'number' ? v : undefined })"
				/>
			</div>
			<div class="w-full sm:w-36">
				<label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Năm</label>
				<UiSelect
					:model-value="modelValue.year"
					:options="yearOptions"
					placeholder="Tất cả năm"
					@update:model-value="v => patch({ year: typeof v === 'number' ? v : undefined })"
				/>
			</div>
		</template>

		<CommonAppResetFilterButton v-if="isDirty" @click="resetFilters" />
	</div>
</template>
