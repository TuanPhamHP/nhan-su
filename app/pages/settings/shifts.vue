<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { startOfWeek, addDays, format, addWeeks, subWeeks, parseISO } from 'date-fns';
	import type { WorkShiftResponse, CreateWorkShiftDto, CalendarDayEmployee } from '~/types/shift.types';
	import type { EmployeeSummary } from '~/types/employee.types';
	import type { SelectOption } from '~/components/ui/Select.vue';

	definePageMeta({ title: 'Quản lý ca làm việc' });

	// ─── Constants ───
	const WORK_DAY_LABELS: Record<number, string> = {
		0: 'CN',
		1: 'T2',
		2: 'T3',
		3: 'T4',
		4: 'T5',
		5: 'T6',
		6: 'T7',
	};
	// Display order: T2→T7→CN
	const ALL_WORK_DAYS = [1, 2, 3, 4, 5, 6, 0];
	const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

	// ─── Composables & stores ───
	const toast = useToast();
	const {
		shifts,
		loading: shiftsLoading,
		fetchWorkShifts,
		createWorkShift,
		updateWorkShift,
		deleteWorkShift,
	} = useWorkShifts();
	const {
		calendarDays,
		loading: calendarLoading,
		fetchCalendar,
		assignShift,
		bulkAssign,
		removeShift,
		setDefaultShift,
	} = useShiftSchedules();
	const directoryStore = useDirectoryStore();

	// ─── Tab ───
	const activeTab = ref<'shifts' | 'calendar'>('shifts');

	// ═══════════════════════════════════════════════════
	// TAB 1 — KHUÔN CA
	// ═══════════════════════════════════════════════════

	const showShiftModal = ref(false);
	const editingShift = ref<WorkShiftResponse | null>(null);
	const submittingShift = ref(false);
	const deleteTargetId = ref<number | null>(null);
	const deleting = ref(false);
	const selectedWorkDays = ref<number[]>([1, 2, 3, 4, 5]);
	const workDaysError = ref('');

	const { handleSubmit, defineField, errors, setValues, resetForm } = useForm({
		validationSchema: {
			name: (v: string) => (v && v.trim().length >= 2) || 'Tên ca phải có ít nhất 2 ký tự',
			checkInTime: (v: string) => /^\d{2}:\d{2}$/.test(v) || 'Định dạng HH:mm',
			checkOutTime: (v: string) => /^\d{2}:\d{2}$/.test(v) || 'Định dạng HH:mm',
			lateThresholdMin: (v: number) =>
				(Number.isInteger(v) && v >= 0 && v <= 120) || 'Từ 0 đến 120 phút',
			earlyThresholdMin: (v: number) =>
				(Number.isInteger(v) && v >= 0 && v <= 120) || 'Từ 0 đến 120 phút',
		},
		initialValues: {
			name: '',
			checkInTime: '08:00',
			checkOutTime: '17:00',
			lateThresholdMin: 15,
			earlyThresholdMin: 15,
		},
	});

	const [shiftName, shiftNameAttrs] = defineField('name');
	const [checkInTime, checkInTimeAttrs] = defineField('checkInTime');
	const [checkOutTime, checkOutTimeAttrs] = defineField('checkOutTime');
	const [lateThresholdMin, lateAttrs] = defineField('lateThresholdMin');
	const [earlyThresholdMin, earlyAttrs] = defineField('earlyThresholdMin');

	function openCreateModal() {
		editingShift.value = null;
		selectedWorkDays.value = [1, 2, 3, 4, 5];
		workDaysError.value = '';
		resetForm({
			values: { name: '', checkInTime: '08:00', checkOutTime: '17:00', lateThresholdMin: 15, earlyThresholdMin: 15 },
		});
		showShiftModal.value = true;
	}

	function openEditModal(shift: WorkShiftResponse) {
		editingShift.value = shift;
		selectedWorkDays.value = [...shift.workDays];
		workDaysError.value = '';
		setValues({
			name: shift.name,
			checkInTime: shift.checkInTime,
			checkOutTime: shift.checkOutTime,
			lateThresholdMin: shift.lateThresholdMin,
			earlyThresholdMin: shift.earlyThresholdMin,
		});
		showShiftModal.value = true;
	}

	function closeShiftModal() {
		showShiftModal.value = false;
		editingShift.value = null;
	}

	function toggleWorkDay(day: number) {
		const idx = selectedWorkDays.value.indexOf(day);
		if (idx === -1) selectedWorkDays.value = [...selectedWorkDays.value, day].sort((a, b) => a - b);
		else selectedWorkDays.value = selectedWorkDays.value.filter(d => d !== day);
		if (selectedWorkDays.value.length > 0) workDaysError.value = '';
	}

	const onSubmitShift = handleSubmit(async values => {
		if (selectedWorkDays.value.length === 0) {
			workDaysError.value = 'Chọn ít nhất 1 ngày làm việc';
			return;
		}
		submittingShift.value = true;
		try {
			const dto: CreateWorkShiftDto = { ...values, workDays: selectedWorkDays.value };
			if (editingShift.value) {
				await updateWorkShift(editingShift.value.id, dto);
				toast.success('Đã cập nhật khuôn ca');
			} else {
				await createWorkShift(dto);
				toast.success('Đã tạo khuôn ca mới');
			}
			closeShiftModal();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
		} finally {
			submittingShift.value = false;
		}
	});

	async function confirmDelete() {
		if (!deleteTargetId.value) return;
		deleting.value = true;
		try {
			await deleteWorkShift(deleteTargetId.value);
			toast.success('Đã xóa khuôn ca');
			deleteTargetId.value = null;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi xóa khuôn ca');
		} finally {
			deleting.value = false;
		}
	}

	// ═══════════════════════════════════════════════════
	// TAB 2 — PHÂN CA
	// ═══════════════════════════════════════════════════

	// ─── Week navigation ───
	const currentWeekStart = ref(startOfWeek(new Date(), { weekStartsOn: 1 }));

	const weekDates = computed(() => Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart.value, i)));

	const weekDateStrings = computed(() => weekDates.value.map(d => format(d, 'yyyy-MM-dd')));

	const weekLabel = computed(() => {
		const start = weekDates.value[0]!;
		const end = weekDates.value[6]!;
		return `${format(start, 'dd/MM')} – ${format(end, 'dd/MM/yyyy')}`;
	});

	function prevWeek() {
		currentWeekStart.value = subWeeks(currentWeekStart.value, 1);
	}
	function nextWeek() {
		currentWeekStart.value = addWeeks(currentWeekStart.value, 1);
	}
	function goToCurrentWeek() {
		currentWeekStart.value = startOfWeek(new Date(), { weekStartsOn: 1 });
	}

	// ─── Department filter ───
	const filterDepartmentId = ref<number | undefined>(undefined);

	const filteredEmployees = computed<EmployeeSummary[]>(() => {
		if (!filterDepartmentId.value) return directoryStore.employees;
		return directoryStore.employees.filter(e => e.department?.id === filterDepartmentId.value);
	});

	// ─── Calendar lookup map: "employeeId:date" → CalendarDayEmployee ───
	// Flatten từ grouped-by-date → flat map để tra nhanh
	const scheduleMap = computed(() => {
		const map = new Map<string, CalendarDayEmployee>();
		for (const day of calendarDays.value) {
			for (const emp of day.employees) {
				map.set(`${emp.employeeId}:${day.date}`, emp);
			}
		}
		return map;
	});

	function getSchedule(employeeId: number, date: string): CalendarDayEmployee | null {
		return scheduleMap.value.get(`${employeeId}:${date}`) ?? null;
	}

	// ─── Select options ───
	const departmentOptions = computed<SelectOption[]>(() => [
		{ value: undefined, label: 'Tất cả phòng ban' },
		...directoryStore.departments.map(d => ({ value: d.id, label: d.name })),
	]);

	const activeShiftOptions = computed<SelectOption[]>(() =>
		shifts.value
			.filter(s => s.isActive)
			.map(s => ({ value: s.id, label: `${s.name} (${s.checkInTime} – ${s.checkOutTime})` })),
	);

	function onDeptFilter(v: string | number | undefined) {
		filterDepartmentId.value = typeof v === 'number' ? v : undefined;
	}

	function onBulkShiftChange(v: string | number | undefined) {
		bulkShiftId.value = typeof v === 'number' ? v : undefined;
	}

	function onDefaultShiftChange(v: string | number | undefined) {
		selectedDefaultShiftId.value = typeof v === 'number' ? v : undefined;
	}

	// ─── Cell assign modal ───
	interface CellTarget {
		employeeId: number;
		employeeName: string;
		date: string;
		current: CalendarDayEmployee | null;
	}
	const cellTarget = ref<CellTarget | null>(null);
	const assigningCell = ref(false);

	function openCellModal(emp: EmployeeSummary, date: string) {
		cellTarget.value = {
			employeeId: emp.id,
			employeeName: emp.fullName,
			date,
			current: getSchedule(emp.id, date),
		};
	}

	function closeCellModal() {
		cellTarget.value = null;
	}

	async function onAssignCell(shiftId: number) {
		if (!cellTarget.value) return;
		assigningCell.value = true;
		try {
			await assignShift({ employeeId: cellTarget.value.employeeId, shiftId, date: cellTarget.value.date });
			toast.success('Đã gán ca');
			closeCellModal();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi gán ca');
		} finally {
			assigningCell.value = false;
		}
	}

	async function onRemoveCell() {
		if (!cellTarget.value) return;
		assigningCell.value = true;
		try {
			await removeShift(cellTarget.value.employeeId, cellTarget.value.date);
			toast.success('Đã xóa override ca');
			closeCellModal();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi xóa ca');
		} finally {
			assigningCell.value = false;
		}
	}

	// ─── Default shift modal ───
	const showDefaultShiftModal = ref(false);
	const defaultShiftTarget = ref<EmployeeSummary | null>(null);
	const selectedDefaultShiftId = ref<number | undefined>(undefined);
	const settingDefault = ref(false);

	function openDefaultShiftModal(emp: EmployeeSummary) {
		defaultShiftTarget.value = emp;
		selectedDefaultShiftId.value = undefined;
		showDefaultShiftModal.value = true;
	}

	async function submitDefaultShift() {
		if (!defaultShiftTarget.value || !selectedDefaultShiftId.value) {
			toast.error('Vui lòng chọn ca mặc định');
			return;
		}
		settingDefault.value = true;
		try {
			await setDefaultShift(defaultShiftTarget.value.id, { shiftId: selectedDefaultShiftId.value });
			toast.success(`Đã cập nhật ca mặc định cho ${defaultShiftTarget.value.fullName}`);
			showDefaultShiftModal.value = false;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi cập nhật ca mặc định');
		} finally {
			settingDefault.value = false;
		}
	}

	// ─── Bulk assign modal ───
	const showBulkModal = ref(false);
	const bulkSelectedEmployees = ref<Set<number>>(new Set());
	const bulkShiftId = ref<number | undefined>(undefined);
	const bulkStartDate = ref('');
	const bulkEndDate = ref('');
	const submittingBulk = ref(false);

	function openBulkModal() {
		bulkSelectedEmployees.value = new Set();
		bulkShiftId.value = undefined;
		bulkStartDate.value = weekDateStrings.value[0] ?? '';
		bulkEndDate.value = weekDateStrings.value[6] ?? '';
		showBulkModal.value = true;
	}

	function toggleBulkEmployee(id: number) {
		const next = new Set(bulkSelectedEmployees.value);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		bulkSelectedEmployees.value = next;
	}

	const allBulkSelected = computed(
		() => filteredEmployees.value.length > 0 && bulkSelectedEmployees.value.size === filteredEmployees.value.length,
	);

	function toggleAllBulkEmployees() {
		if (allBulkSelected.value) {
			bulkSelectedEmployees.value = new Set();
		} else {
			bulkSelectedEmployees.value = new Set(filteredEmployees.value.map(e => e.id));
		}
	}

	async function submitBulkAssign() {
		if (!bulkShiftId.value) {
			toast.error('Vui lòng chọn ca');
			return;
		}
		if (bulkSelectedEmployees.value.size === 0) {
			toast.error('Vui lòng chọn ít nhất 1 nhân viên');
			return;
		}
		if (!bulkStartDate.value || !bulkEndDate.value) {
			toast.error('Vui lòng chọn khoảng thời gian');
			return;
		}

		const start = parseISO(bulkStartDate.value);
		const end = parseISO(bulkEndDate.value);
		if (start > end) {
			toast.error('Ngày bắt đầu phải trước ngày kết thúc');
			return;
		}

		const assignments: Array<{ employeeId: number; shiftId: number; date: string }> = [];
		let current = start;
		while (current <= end) {
			const dateStr = format(current, 'yyyy-MM-dd');
			for (const empId of bulkSelectedEmployees.value) {
				assignments.push({ employeeId: empId, shiftId: bulkShiftId.value, date: dateStr });
			}
			current = addDays(current, 1);
		}

		if (assignments.length > 100) {
			toast.error(`Tổng ${assignments.length} lượt gán vượt quá 100. Thu hẹp phạm vi hoặc bớt nhân viên.`);
			return;
		}

		submittingBulk.value = true;
		try {
			await bulkAssign({ assignments });
			toast.success(`Đã gán ca hàng loạt (${assignments.length} lượt)`);
			showBulkModal.value = false;
			await loadCalendar();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi gán ca hàng loạt');
		} finally {
			submittingBulk.value = false;
		}
	}

	// ─── Data loading ───
	async function loadCalendar() {
		await fetchCalendar({
			startDate: weekDateStrings.value[0] ?? '',
			endDate: weekDateStrings.value[6] ?? '',
			...(filterDepartmentId.value ? { departmentId: filterDepartmentId.value } : {}),
		});
	}

	watch([currentWeekStart, filterDepartmentId], () => {
		if (activeTab.value === 'calendar') loadCalendar();
	});

	watch(activeTab, async tab => {
		if (tab === 'calendar') {
			await directoryStore.load();
			await loadCalendar();
		}
	});

	onMounted(async () => {
		await fetchWorkShifts();
	});
</script>

<template>
	<div class="p-6 space-y-6">
		<!-- Page header -->
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Quản lý ca làm việc</h1>
				<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Tạo khuôn ca và phân ca cho nhân viên</p>
			</div>
		</div>

		<!-- Tab nav -->
		<div class="flex gap-1 border-b border-gray-200 dark:border-gray-700">
			<button
				:class="[
					'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
					activeTab === 'shifts'
						? 'border-brand-600 text-brand-600 dark:text-brand-400 dark:border-brand-400'
						: 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
				]"
				@click="activeTab = 'shifts'"
			>
				Khuôn ca
			</button>
			<button
				:class="[
					'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
					activeTab === 'calendar'
						? 'border-brand-600 text-brand-600 dark:text-brand-400 dark:border-brand-400'
						: 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
				]"
				@click="activeTab = 'calendar'"
			>
				Phân ca
			</button>
		</div>

		<!-- ═══════════════════════════════════════════════════ -->
		<!-- TAB 1: Khuôn ca                                    -->
		<!-- ═══════════════════════════════════════════════════ -->
		<div v-show="activeTab === 'shifts'">
			<div class="flex items-center justify-between mb-4">
				<p class="text-sm text-gray-500 dark:text-gray-400">{{ shifts.length }} khuôn ca</p>
				<CommonAppButton @click="openCreateModal">
					<template #icon>
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
						</svg>
					</template>
					Thêm khuôn ca
				</CommonAppButton>
			</div>

			<!-- Loading skeleton -->
			<div v-if="shiftsLoading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
				<div
					v-for="i in 4"
					:key="i"
					class="rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse space-y-3"
				>
					<div class="h-4 w-2/3 bg-gray-200 dark:bg-gray-700 rounded" />
					<div class="h-3 w-1/2 bg-gray-100 dark:bg-gray-800 rounded" />
					<div class="flex gap-1">
						<div v-for="j in 5" :key="j" class="h-5 w-6 bg-gray-100 dark:bg-gray-800 rounded-full" />
					</div>
				</div>
			</div>

			<!-- Empty state -->
			<div v-else-if="!shifts.length" class="flex flex-col items-center justify-center py-20 text-center">
				<div class="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
					<svg class="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
				</div>
				<p class="text-sm font-medium text-gray-600 dark:text-gray-300">Chưa có khuôn ca nào</p>
				<p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Nhấn "Thêm khuôn ca" để bắt đầu</p>
			</div>

			<!-- Shift cards grid -->
			<div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
				<div
					v-for="shift in shifts"
					:key="shift.id"
					class="relative rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 hover:border-brand-300 dark:hover:border-brand-700 transition-colors group cursor-pointer"
					@click="openEditModal(shift)"
				>
					<!-- Active badge -->
					<span
						:class="[
							'absolute top-3 right-3 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold',
							shift.isActive
								? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
								: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
						]"
					>
						{{ shift.isActive ? 'Hoạt động' : 'Vô hiệu' }}
					</span>

					<!-- Shift name -->
					<p class="text-sm font-semibold text-gray-900 dark:text-white pr-20 truncate mb-1">
						{{ shift.name }}
					</p>

					<!-- Time range -->
					<p class="text-sm font-mono text-brand-600 dark:text-brand-400 mb-1">
						{{ shift.checkInTime }} → {{ shift.checkOutTime }}
					</p>

					<!-- Thresholds -->
					<p class="text-xs text-gray-400 dark:text-gray-500 mb-3">
						Trễ ≤ {{ shift.lateThresholdMin }}&thinsp;phút · Về sớm ≤ {{ shift.earlyThresholdMin }}&thinsp;phút
					</p>

					<!-- Work days pills -->
					<div class="flex flex-wrap gap-1">
						<span
							v-for="day in ALL_WORK_DAYS"
							:key="day"
							:class="[
								'inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium',
								shift.workDays.includes(day)
									? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-400'
									: 'bg-gray-100 text-gray-300 dark:bg-gray-800 dark:text-gray-600',
							]"
						>
							{{ WORK_DAY_LABELS[day] }}
						</span>
					</div>

					<!-- Delete button -->
					<button
						class="absolute bottom-3 right-3 text-xs text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
						@click.stop="deleteTargetId = shift.id"
					>
						Xóa
					</button>
				</div>
			</div>
		</div>

		<!-- ═══════════════════════════════════════════════════ -->
		<!-- TAB 2: Phân ca                                     -->
		<!-- ═══════════════════════════════════════════════════ -->
		<div v-show="activeTab === 'calendar'">
			<!-- Controls bar -->
			<div class="flex flex-wrap items-center gap-3 mb-4">
				<!-- Week navigation -->
				<div
					class="flex items-center gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-1"
				>
					<button
						class="w-8 h-8 flex items-center justify-center rounded text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
						@click="prevWeek"
					>
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
						</svg>
					</button>
					<button
						class="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors min-w-[160px] text-center"
						@click="goToCurrentWeek"
					>
						{{ weekLabel }}
					</button>
					<button
						class="w-8 h-8 flex items-center justify-center rounded text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
						@click="nextWeek"
					>
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
						</svg>
					</button>
				</div>

				<!-- Department filter -->
				<UiSelect
					class="min-w-[180px]"
					:model-value="filterDepartmentId"
					:options="departmentOptions"
					@update:model-value="onDeptFilter"
				/>

				<div class="ml-auto">
					<CommonAppButton variant="outline" @click="openBulkModal">
						<template #icon>
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
								/>
							</svg>
						</template>
						Gán hàng loạt
					</CommonAppButton>
				</div>
			</div>

			<!-- Calendar grid -->
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
				<!-- Loading overlay -->
				<div v-if="calendarLoading || directoryStore.loading" class="p-12 flex items-center justify-center">
					<svg class="animate-spin w-6 h-6 text-brand-600" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
					</svg>
				</div>

				<div v-else class="overflow-x-auto">
					<table class="w-full min-w-[700px] text-sm">
						<thead>
							<tr class="border-b border-gray-100 dark:border-gray-800">
								<th
									class="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400 w-48 sticky left-0 bg-white dark:bg-gray-900 z-10"
								>
									Nhân viên
								</th>
								<th
									v-for="(label, idx) in DAY_LABELS"
									:key="label"
									class="px-2 py-3 font-medium text-gray-500 dark:text-gray-400 text-center min-w-[100px]"
								>
									<div class="text-xs">{{ label }}</div>
									<div class="text-[11px] text-gray-400 dark:text-gray-500 font-normal">
										{{ weekDates[idx] ? format(weekDates[idx]!, 'dd/MM') : '' }}
									</div>
								</th>
							</tr>
						</thead>
						<tbody>
							<!-- Empty state -->
							<tr v-if="!filteredEmployees.length">
								<td :colspan="8" class="py-12 text-center text-sm text-gray-400 dark:text-gray-500">
									Không có nhân viên nào
								</td>
							</tr>

							<tr
								v-for="emp in filteredEmployees"
								:key="emp.id"
								class="border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-800/30"
							>
								<!-- Employee name column -->
								<td class="px-4 py-2 sticky left-0 bg-white dark:bg-gray-900 z-10 group">
									<button
										class="flex items-center gap-2 text-left w-full rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 px-1 py-1 transition-colors"
										title="Đặt ca mặc định"
										@click="openDefaultShiftModal(emp)"
									>
										<div
											class="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center flex-shrink-0"
										>
											<span class="text-xs font-bold text-brand-700 dark:text-brand-400">{{
												emp.fullName.charAt(0)
											}}</span>
										</div>
										<div class="min-w-0">
											<p class="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[120px]">
												{{ emp.fullName }}
											</p>
											<p class="text-[11px] text-gray-400 dark:text-gray-500">{{ emp.employeeCode }}</p>
										</div>
									</button>
								</td>

								<!-- Day cells — 3 trạng thái: override (xanh) / mặc định (xám) / không có ca (đỏ nhạt) -->
								<td v-for="(date) in weekDateStrings" :key="date" class="px-2 py-2 text-center">
									<button
										:class="[
											'w-full min-h-[40px] rounded-lg border text-xs font-medium px-2 py-1.5 transition-colors leading-tight',
											getSchedule(emp.id, date)?.shift && !getSchedule(emp.id, date)?.isDefault
												? 'bg-brand-50 border-brand-200 text-brand-700 dark:bg-brand-900/30 dark:border-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/50'
												: getSchedule(emp.id, date)?.shift && getSchedule(emp.id, date)?.isDefault
													? 'bg-gray-100 border-gray-200 text-gray-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
													: 'bg-red-50 border-transparent text-red-300 dark:bg-red-900/10 dark:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/20',
										]"
										@click="openCellModal(emp, date)"
									>
										<template v-if="getSchedule(emp.id, date)?.shift">
											<span class="block truncate">{{ getSchedule(emp.id, date)!.shift!.name }}</span>
											<span v-if="getSchedule(emp.id, date)?.isDefault" class="block text-[10px] opacity-60">mặc định</span>
										</template>
										<span v-else>—</span>
									</button>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</div>
	</div>

	<!-- ═══════════════════════════════════════════════════ -->
	<!-- MODAL: Tạo / Sửa khuôn ca                         -->
	<!-- ═══════════════════════════════════════════════════ -->
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
				v-if="showShiftModal"
				class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
				@click.self="closeShiftModal"
			>
				<div
					class="bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md max-h-[90vh] overflow-y-auto"
				>
					<!-- Header -->
					<div class="flex items-center gap-3 px-6 py-4 border-b border-gray-100 dark:border-gray-800">
						<svg
							class="w-5 h-5 text-brand-600 dark:text-brand-400 flex-shrink-0"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="1.5"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<h2 class="text-base font-semibold text-gray-900 dark:text-white flex-1">
							{{ editingShift ? 'Chỉnh sửa khuôn ca' : 'Thêm khuôn ca' }}
						</h2>
						<button
							class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
							@click="closeShiftModal"
						>
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>

					<!-- Form -->
					<form class="p-6 space-y-4" @submit.prevent="onSubmitShift">
						<!-- Tên ca -->
						<div>
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
								Tên ca <span class="text-red-500">*</span>
							</label>
							<input
								v-model="shiftName"
								v-bind="shiftNameAttrs"
								type="text"
								placeholder="VD: Ca sáng, Ca đêm"
								class="w-full h-10 px-3 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
							/>
							<p v-if="errors.name" class="mt-1 text-xs text-red-500">{{ errors.name }}</p>
						</div>

						<!-- Giờ vào / Giờ ra -->
						<div class="grid grid-cols-2 gap-3">
							<div>
								<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Giờ vào <span class="text-red-500">*</span>
								</label>
								<UiTimeInput
									v-model="checkInTime"
									v-bind="checkInTimeAttrs"
									:error="errors.checkInTime"
								/>
								<p v-if="errors.checkInTime" class="mt-1 text-xs text-red-500">{{ errors.checkInTime }}</p>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Giờ ra <span class="text-red-500">*</span>
								</label>
								<UiTimeInput
									v-model="checkOutTime"
									v-bind="checkOutTimeAttrs"
									:error="errors.checkOutTime"
								/>
								<p v-if="errors.checkOutTime" class="mt-1 text-xs text-red-500">{{ errors.checkOutTime }}</p>
							</div>
						</div>

						<!-- Ngưỡng trễ / sớm -->
						<div class="grid grid-cols-2 gap-3">
							<div>
								<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Ngưỡng đến trễ (phút)
								</label>
								<input
									v-model.number="lateThresholdMin"
									v-bind="lateAttrs"
									type="number"
									min="0"
									max="120"
									class="w-full h-10 px-3 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
								/>
								<p v-if="errors.lateThresholdMin" class="mt-1 text-xs text-red-500">{{ errors.lateThresholdMin }}</p>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Ngưỡng về sớm (phút)
								</label>
								<input
									v-model.number="earlyThresholdMin"
									v-bind="earlyAttrs"
									type="number"
									min="0"
									max="120"
									class="w-full h-10 px-3 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
								/>
								<p v-if="errors.earlyThresholdMin" class="mt-1 text-xs text-red-500">{{ errors.earlyThresholdMin }}</p>
							</div>
						</div>

						<!-- Ngày làm việc -->
						<div>
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
								Ngày làm việc <span class="text-red-500">*</span>
							</label>
							<div class="flex flex-wrap gap-2">
								<button
									v-for="day in ALL_WORK_DAYS"
									:key="day"
									type="button"
									:class="[
										'w-9 h-9 rounded-full text-xs font-medium transition-colors',
										selectedWorkDays.includes(day)
											? 'bg-brand-600 text-white'
											: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
									]"
									@click="toggleWorkDay(day)"
								>
									{{ WORK_DAY_LABELS[day] }}
								</button>
							</div>
							<p v-if="workDaysError" class="mt-1.5 text-xs text-red-500">{{ workDaysError }}</p>
						</div>

						<!-- Actions -->
						<div class="flex justify-end gap-3 pt-2">
							<CommonAppButton variant="outline" type="button" @click="closeShiftModal">Hủy</CommonAppButton>
							<CommonAppButton type="submit" :loading="submittingShift">
								{{ editingShift ? 'Cập nhật' : 'Tạo khuôn ca' }}
							</CommonAppButton>
						</div>
					</form>
				</div>
			</div>
		</Transition>
	</Teleport>

	<!-- ═══════════════════════════════════════════════════ -->
	<!-- MODAL: Xác nhận xóa ca                            -->
	<!-- ═══════════════════════════════════════════════════ -->
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
				v-if="deleteTargetId"
				class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
				@click.self="deleteTargetId = null"
			>
				<div
					class="bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-sm p-6"
				>
					<div class="flex items-start gap-4">
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
									d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
								/>
							</svg>
						</div>
						<div>
							<h3 class="font-semibold text-gray-900 dark:text-white">Xóa khuôn ca</h3>
							<p class="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
								Hành động này không thể hoàn tác. Nhân viên đang dùng ca này có thể bị ảnh hưởng.
							</p>
						</div>
					</div>
					<div class="flex justify-end gap-3 mt-6">
						<CommonAppButton variant="outline" @click="deleteTargetId = null">Hủy</CommonAppButton>
						<CommonAppButton variant="danger" :loading="deleting" @click="confirmDelete">Xóa</CommonAppButton>
					</div>
				</div>
			</div>
		</Transition>
	</Teleport>

	<!-- ═══════════════════════════════════════════════════ -->
	<!-- MODAL: Gán ca cho cell                            -->
	<!-- ═══════════════════════════════════════════════════ -->
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
				v-if="cellTarget"
				class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
				@click.self="closeCellModal"
			>
				<div
					class="bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-sm"
				>
					<div class="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-800">
						<div>
							<p class="text-sm font-semibold text-gray-900 dark:text-white">{{ cellTarget.employeeName }}</p>
							<p class="text-xs text-gray-400 dark:text-gray-500">{{ cellTarget.date }}</p>
						</div>
						<button
							class="ml-auto w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
							@click="closeCellModal"
						>
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>

					<div class="p-4 space-y-1">
						<!-- Current shift info -->
						<div
							v-if="cellTarget.current?.shift"
							class="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg bg-brand-50 dark:bg-brand-900/20 text-xs text-brand-700 dark:text-brand-300"
						>
							<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
							Đang gán: {{ cellTarget.current!.shift!.name }} ({{ cellTarget.current!.shift!.checkInTime }}–{{
								cellTarget.current!.shift!.checkOutTime
							}})
						</div>

						<p class="text-xs font-medium text-gray-500 dark:text-gray-400 px-1 mb-1">Chọn ca:</p>

						<!-- Shift list -->
						<button
							v-for="shift in shifts"
							:key="shift.id"
							:disabled="assigningCell || !shift.isActive"
							:class="[
								'w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
								shift.isActive ? 'hover:bg-gray-50 dark:hover:bg-gray-800' : 'opacity-40 cursor-not-allowed',
								cellTarget.current?.shift?.id === shift.id ? 'bg-brand-50 dark:bg-brand-900/20' : '',
							]"
							@click="shift.isActive && onAssignCell(shift.id)"
						>
							<div>
								<p class="text-sm font-medium text-gray-900 dark:text-white">{{ shift.name }}</p>
								<p class="text-xs text-gray-400 dark:text-gray-500 font-mono">
									{{ shift.checkInTime }} – {{ shift.checkOutTime }}
								</p>
							</div>
							<svg
								v-if="cellTarget.current?.shift?.id === shift.id"
								class="w-4 h-4 text-brand-600 dark:text-brand-400 flex-shrink-0"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2.5"
							>
								<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
							</svg>
						</button>

						<!-- Remove override — chỉ hiện khi là explicit override (không phải ca mặc định) -->
						<div v-if="cellTarget.current?.shift && !cellTarget.current.isDefault" class="pt-2 border-t border-gray-100 dark:border-gray-800 mt-2">
							<button
								:disabled="assigningCell"
								class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
								@click="onRemoveCell"
							>
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
								</svg>
								Xóa override — về ca mặc định
							</button>
						</div>
					</div>
				</div>
			</div>
		</Transition>
	</Teleport>

	<!-- ═══════════════════════════════════════════════════ -->
	<!-- MODAL: Ca mặc định cho nhân viên                  -->
	<!-- ═══════════════════════════════════════════════════ -->
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
				v-if="showDefaultShiftModal && defaultShiftTarget"
				class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
				@click.self="showDefaultShiftModal = false"
			>
				<div
					class="bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-sm"
				>
					<div class="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-800">
						<div
							class="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center flex-shrink-0"
						>
							<span class="text-sm font-bold text-brand-700 dark:text-brand-400">{{
								defaultShiftTarget.fullName.charAt(0)
							}}</span>
						</div>
						<div>
							<p class="text-sm font-semibold text-gray-900 dark:text-white">{{ defaultShiftTarget.fullName }}</p>
							<p class="text-xs text-gray-400 dark:text-gray-500">Cài đặt ca mặc định</p>
						</div>
						<button
							class="ml-auto w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
							@click="showDefaultShiftModal = false"
						>
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>

					<div class="p-5 space-y-4">
						<div>
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
								Ca mặc định hàng ngày
							</label>
							<UiSelect
								:model-value="selectedDefaultShiftId"
								:options="activeShiftOptions"
								placeholder="Chọn ca..."
								@update:model-value="onDefaultShiftChange"
							/>
						</div>

						<div class="flex justify-end gap-3">
							<CommonAppButton variant="outline" @click="showDefaultShiftModal = false">Hủy</CommonAppButton>
							<CommonAppButton :loading="settingDefault" @click="submitDefaultShift">Lưu</CommonAppButton>
						</div>
					</div>
				</div>
			</div>
		</Transition>
	</Teleport>

	<!-- ═══════════════════════════════════════════════════ -->
	<!-- MODAL: Gán ca hàng loạt                           -->
	<!-- ═══════════════════════════════════════════════════ -->
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
				v-if="showBulkModal"
				class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
				@click.self="showBulkModal = false"
			>
				<div
					class="bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-lg max-h-[90vh] flex flex-col"
				>
					<!-- Header -->
					<div class="flex items-center gap-3 px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
						<h2 class="text-base font-semibold text-gray-900 dark:text-white flex-1">Gán ca hàng loạt</h2>
						<button
							class="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
							@click="showBulkModal = false"
						>
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>

					<div class="flex-1 overflow-y-auto p-6 space-y-5">
						<!-- Date range -->
						<div class="grid grid-cols-2 gap-3">
							<div>
								<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Từ ngày</label>
								<input
									v-model="bulkStartDate"
									type="date"
									class="w-full h-10 px-3 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
								/>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Đến ngày</label>
								<input
									v-model="bulkEndDate"
									type="date"
									class="w-full h-10 px-3 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
								/>
							</div>
						</div>

						<!-- Shift selector -->
						<div>
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ca làm việc</label>
							<UiSelect
								:model-value="bulkShiftId"
								:options="activeShiftOptions"
								placeholder="Chọn ca..."
								@update:model-value="onBulkShiftChange"
							/>
						</div>

						<!-- Employee list -->
						<div>
							<div class="flex items-center justify-between mb-2">
								<label class="text-sm font-medium text-gray-700 dark:text-gray-300">
									Nhân viên ({{ bulkSelectedEmployees.size }} đã chọn)
								</label>
								<button
									type="button"
									class="text-xs text-brand-600 dark:text-brand-400 hover:underline"
									@click="toggleAllBulkEmployees"
								>
									{{ allBulkSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả' }}
								</button>
							</div>
							<div
								class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden max-h-48 overflow-y-auto"
							>
								<label
									v-for="emp in filteredEmployees"
									:key="emp.id"
									class="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border-b border-gray-50 dark:border-gray-800 last:border-0"
								>
									<input
										type="checkbox"
										:checked="bulkSelectedEmployees.has(emp.id)"
										class="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500"
										@change="toggleBulkEmployee(emp.id)"
									/>
									<div class="flex-1 min-w-0">
										<p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ emp.fullName }}</p>
										<p class="text-xs text-gray-400 dark:text-gray-500">{{ emp.employeeCode }}</p>
									</div>
									<span v-if="emp.department" class="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[100px]">
										{{ emp.department.name }}
									</span>
								</label>
							</div>
						</div>
					</div>

					<!-- Footer -->
					<div
						class="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex-shrink-0"
					>
						<p class="text-xs text-gray-400 dark:text-gray-500">Tối đa 100 lượt gán mỗi lần</p>
						<div class="flex gap-3">
							<CommonAppButton variant="outline" @click="showBulkModal = false">Hủy</CommonAppButton>
							<CommonAppButton :loading="submittingBulk" @click="submitBulkAssign"> Gán ca </CommonAppButton>
						</div>
					</div>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>
