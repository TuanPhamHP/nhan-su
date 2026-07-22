<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { startOfWeek, addDays, format, addWeeks, subWeeks, startOfYear, endOfYear } from 'date-fns';
	import type { WorkShiftResponse, CreateWorkShiftDto, CalendarDayEmployee } from '~/types/shift.types';
	import type { EmployeeSummary } from '~/types/employee.types';
	import type { SelectOption } from '~/components/ui/Select.vue';
	import OnlineSaturdayModal from '~/components/modules/shifts/OnlineSaturdayModal.vue';

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
		bulkAssignRange,
		removeShift,
		setDefaultShift,
		bulkAssignOnlineSaturday,
	} = useShiftSchedules();
	const directoryStore = useDirectoryStore();

	// ─── Tab ───
	const activeTab = ref<'shifts' | 'calendar'>('shifts');

	// ─── Online Saturday modal ───
	const showOnlineModal = ref(false);

	function openOnlineSetupModal() {
		showOnlineModal.value = true;
	}

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

	// ─── Cửa sổ chấm công + require flags ───
	// Empty string = null (BE dùng default ±60p). UiTimeInput bind trực tiếp.
	const checkInWindowStart = ref('');
	const checkInWindowEnd = ref('');
	const checkOutWindowStart = ref('');
	const checkOutWindowEnd = ref('');
	const requireCheckIn = ref(true);
	const requireCheckOut = ref(true);
	const windowErrors = ref<{ ciStart?: string; ciEnd?: string; coStart?: string; coEnd?: string }>({});

	const requireError = computed(() =>
		!requireCheckIn.value && !requireCheckOut.value ? 'Ca làm việc phải yêu cầu ít nhất check-in hoặc check-out' : '',
	);

	// Convert HH:mm → phút trong ngày; trả undefined nếu format sai.
	function hhmmToMinutes(t: string): number | undefined {
		if (!/^\d{2}:\d{2}$/.test(t)) return undefined;
		const [h, m] = t.split(':').map(Number);
		if (h === undefined || m === undefined || h > 23 || m > 59) return undefined;
		return h * 60 + m;
	}

	// Offset (start → shift, hoặc shift → end) tính theo modulo 1440 để cross-midnight vẫn đúng.
	function circularOffset(from: number, to: number): number {
		return (((to - from) % 1440) + 1440) % 1440;
	}

	// Validate 1 pair (start hoặc end) của cửa sổ. Trả về error message nếu vi phạm.
	// side='start' → window phải nằm TRƯỚC hoặc bằng shiftTime, cách tối đa 240p.
	// side='end'   → window phải nằm SAU hoặc bằng shiftTime, cách tối đa 240p.
	// Dùng circular offset (mod 1440) để cross-midnight vẫn đúng. offset > 720 ≡ user đặt sai phía.
	function validateWindowSide(window: string, shift: string, side: 'start' | 'end'): string | undefined {
		if (!window) return undefined;
		if (!/^\d{2}:\d{2}$/.test(window)) return 'Định dạng HH:mm';
		const wMin = hhmmToMinutes(window);
		const sMin = hhmmToMinutes(shift);
		if (wMin === undefined || sMin === undefined) return undefined; // shift chưa hợp lệ — bỏ qua
		const offset = side === 'start' ? circularOffset(wMin, sMin) : circularOffset(sMin, wMin);
		if (offset === 0) return undefined;
		if (offset > 720) {
			return side === 'start' ? `Phải trước hoặc bằng ${shift}` : `Phải sau hoặc bằng ${shift}`;
		}
		if (offset > 240) return 'Cách giờ ca không quá 4 tiếng';
		return undefined;
	}

	// Collapse state cho 2 khối trong modal (default expanded)
	const showTimeSection = ref(true);
	const showWindowSection = ref(false);

	const { handleSubmit, defineField, errors, setValues, resetForm, setFieldError } = useForm({
		validationSchema: {
			name: (v: string) => (v && v.trim().length >= 2) || 'Tên ca phải có ít nhất 2 ký tự',
			checkInTime: (v: string) => /^\d{2}:\d{2}$/.test(v) || 'Định dạng HH:mm',
			checkOutTime: (v: string) => /^\d{2}:\d{2}$/.test(v) || 'Định dạng HH:mm',
			breakStartTime: (v: string) => !v || /^\d{2}:\d{2}$/.test(v) || 'Định dạng HH:mm',
			breakEndTime: (v: string) => !v || /^\d{2}:\d{2}$/.test(v) || 'Định dạng HH:mm',
			lateThresholdMin: (v: number) => (Number.isInteger(v) && v >= 0 && v <= 120) || 'Từ 0 đến 120 phút',
			earlyThresholdMin: (v: number) => (Number.isInteger(v) && v >= 0 && v <= 120) || 'Từ 0 đến 120 phút',
		},
		initialValues: {
			name: '',
			checkInTime: '08:00',
			checkOutTime: '17:00',
			breakStartTime: '',
			breakEndTime: '',
			lateThresholdMin: 15,
			earlyThresholdMin: 15,
			isOnline: false,
			requiresLocationCheck: true,
		},
	});

	const [shiftName, shiftNameAttrs] = defineField('name');
	const [checkInTime, checkInTimeAttrs] = defineField('checkInTime');
	const [checkOutTime, checkOutTimeAttrs] = defineField('checkOutTime');
	const [breakStartTime, breakStartTimeAttrs] = defineField('breakStartTime');
	const [breakEndTime, breakEndTimeAttrs] = defineField('breakEndTime');
	const [lateThresholdMin, lateAttrs] = defineField('lateThresholdMin');
	const [earlyThresholdMin, earlyAttrs] = defineField('earlyThresholdMin');
	const [isOnline] = defineField('isOnline');
	const [requiresLocationCheck] = defineField('requiresLocationCheck');

	// `isOnline = true` override mọi setting GPS — cron sẽ ghi PRESENT, không cho check-in thủ công.
	// Khi bật online, lock `requiresLocationCheck` về true để khỏi gây nhầm lẫn cho HR (giá trị không có tác dụng).
	watch(isOnline, online => {
		if (online) requiresLocationCheck.value = true;
	});

	// Ca cross-midnight (checkOut <= checkIn) không hỗ trợ nghỉ trưa — BE reject 400.
	const isCrossMidnight = computed(() => {
		const ci = checkInTime.value as string | undefined;
		const co = checkOutTime.value as string | undefined;
		if (!ci || !co || !/^\d{2}:\d{2}$/.test(ci) || !/^\d{2}:\d{2}$/.test(co)) return false;
		return co <= ci;
	});

	// Khi ca chuyển sang cross-midnight, tự động clear break fields để tránh gửi lên BE bị 400.
	watch(isCrossMidnight, cross => {
		if (cross) {
			breakStartTime.value = '';
			breakEndTime.value = '';
		}
	});

	// Preview realtime cửa sổ chấm công. null → fallback 60p.
	const previewWindows = computed(() => {
		const ci = checkInTime.value as string | undefined;
		const co = checkOutTime.value as string | undefined;
		if (!ci || !co || !/^\d{2}:\d{2}$/.test(ci) || !/^\d{2}:\d{2}$/.test(co)) return null;

		const parseTime = (t: string) => {
			const [h, m] = t.split(':').map(Number);
			return (h ?? 0) * 60 + (m ?? 0);
		};
		const formatMin = (totalMin: number) => {
			const normalized = ((totalMin % 1440) + 1440) % 1440;
			const h = Math.floor(normalized / 60);
			const m = normalized % 60;
			return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
		};

		const shiftStart = parseTime(ci);
		const shiftEnd = parseTime(co);
		// Windows là HH:mm tuyệt đối; null/empty → fallback ±60p quanh giờ ca.
		const resolveStart = (window: string, shift: number) =>
			window && /^\d{2}:\d{2}$/.test(window) ? parseTime(window) : shift - 60;
		const resolveEnd = (window: string, shift: number) =>
			window && /^\d{2}:\d{2}$/.test(window) ? parseTime(window) : shift + 60;

		return {
			checkIn: {
				earliest: formatMin(resolveStart(checkInWindowStart.value, shiftStart)),
				shiftTime: formatMin(shiftStart),
				deadline: formatMin(resolveEnd(checkInWindowEnd.value, shiftStart)),
			},
			checkOut: {
				earliest: formatMin(resolveStart(checkOutWindowStart.value, shiftEnd)),
				shiftTime: formatMin(shiftEnd),
				deadline: formatMin(resolveEnd(checkOutWindowEnd.value, shiftEnd)),
			},
		};
	});

	// Placeholder human-friendly cho 4 input Khung giờ — hiển thị mốc default (±60p quanh giờ ca).
	const windowPlaceholders = computed(() => {
		const ci = checkInTime.value as string | undefined;
		const co = checkOutTime.value as string | undefined;
		const parseTime = (t: string) => {
			const [h, m] = t.split(':').map(Number);
			return (h ?? 0) * 60 + (m ?? 0);
		};
		const formatMin = (totalMin: number) => {
			const normalized = ((totalMin % 1440) + 1440) % 1440;
			const h = Math.floor(normalized / 60);
			const m = normalized % 60;
			return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
		};
		const withOffset = (t: string | undefined, off: number) =>
			t && /^\d{2}:\d{2}$/.test(t) ? formatMin(parseTime(t) + off) : '--:--';
		return {
			ciStart: withOffset(ci, -60),
			ciEnd: withOffset(ci, 60),
			coStart: withOffset(co, -60),
			coEnd: withOffset(co, 60),
		};
	});

	// Compute khung giờ hợp lệ hiển thị trên card. null → fallback shift ± 60p.
	function effectiveWindows(s: WorkShiftResponse) {
		const parseTime = (t: string) => {
			const [h, m] = t.split(':').map(Number);
			return (h ?? 0) * 60 + (m ?? 0);
		};
		const formatMin = (totalMin: number) => {
			const normalized = ((totalMin % 1440) + 1440) % 1440;
			const h = Math.floor(normalized / 60);
			const m = normalized % 60;
			return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
		};
		const ci = parseTime(s.checkInTime);
		const co = parseTime(s.checkOutTime);
		return {
			ciStart: s.checkInWindowStart ?? formatMin(ci - 60),
			ciEnd: s.checkInWindowEnd ?? formatMin(ci + 60),
			coStart: s.checkOutWindowStart ?? formatMin(co - 60),
			coEnd: s.checkOutWindowEnd ?? formatMin(co + 60),
		};
	}

	// Helpers cho list view: badge + tooltip khi ca có custom window
	function hasCustomWindow(s: WorkShiftResponse) {
		return (
			s.checkInWindowStart !== null ||
			s.checkInWindowEnd !== null ||
			s.checkOutWindowStart !== null ||
			s.checkOutWindowEnd !== null
		);
	}

	function customWindowTooltip(s: WorkShiftResponse) {
		const fmt = (v: string | null) => v ?? 'mặc định ±60p';
		return (
			'Khung giờ tùy chỉnh:\n' +
			`Check-in: ${fmt(s.checkInWindowStart)} – ${fmt(s.checkInWindowEnd)}\n` +
			`Check-out: ${fmt(s.checkOutWindowStart)} – ${fmt(s.checkOutWindowEnd)}`
		);
	}

	function openCreateModal() {
		editingShift.value = null;
		selectedWorkDays.value = [1, 2, 3, 4, 5];
		workDaysError.value = '';
		checkInWindowStart.value = '';
		checkInWindowEnd.value = '';
		checkOutWindowStart.value = '';
		checkOutWindowEnd.value = '';
		windowErrors.value = {};
		requireCheckIn.value = true;
		requireCheckOut.value = true;
		resetForm({
			values: {
				name: '',
				checkInTime: '08:00',
				checkOutTime: '17:00',
				breakStartTime: '',
				breakEndTime: '',
				lateThresholdMin: 15,
				earlyThresholdMin: 15,
				isOnline: false,
				requiresLocationCheck: true,
			},
		});
		showShiftModal.value = true;
	}

	function openEditModal(shift: WorkShiftResponse) {
		editingShift.value = shift;
		selectedWorkDays.value = [...shift.workDays];
		workDaysError.value = '';
		// null → '' để UiTimeInput hiển thị placeholder mặc định
		checkInWindowStart.value = shift.checkInWindowStart ?? '';
		checkInWindowEnd.value = shift.checkInWindowEnd ?? '';
		checkOutWindowStart.value = shift.checkOutWindowStart ?? '';
		checkOutWindowEnd.value = shift.checkOutWindowEnd ?? '';
		windowErrors.value = {};
		requireCheckIn.value = shift.requireCheckIn;
		requireCheckOut.value = shift.requireCheckOut;
		setValues({
			name: shift.name,
			checkInTime: shift.checkInTime,
			checkOutTime: shift.checkOutTime,
			breakStartTime: shift.breakStartTime ?? '',
			breakEndTime: shift.breakEndTime ?? '',
			lateThresholdMin: shift.lateThresholdMin,
			earlyThresholdMin: shift.earlyThresholdMin,
			isOnline: shift.isOnline,
			requiresLocationCheck: shift.requiresLocationCheck,
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

		// Cả 2 require flags OFF → BE reject; chặn client-side.
		if (requireError.value) return;

		// XOR client-side: breakStart và breakEnd phải cùng có hoặc cùng trống.
		const bs = (values.breakStartTime ?? '').trim();
		const be = (values.breakEndTime ?? '').trim();
		if ((bs && !be) || (!bs && be)) {
			setFieldError(bs ? 'breakEndTime' : 'breakStartTime', 'Phải điền cả 2 giờ nghỉ trưa (hoặc để trống cả 2)');
			return;
		}

		// Validate 4 window fields dựa trên checkInTime/checkOutTime hiện tại
		const ciWinStart = checkInWindowStart.value.trim();
		const ciWinEnd = checkInWindowEnd.value.trim();
		const coWinStart = checkOutWindowStart.value.trim();
		const coWinEnd = checkOutWindowEnd.value.trim();
		windowErrors.value = {
			ciStart: validateWindowSide(ciWinStart, values.checkInTime, 'start'),
			ciEnd: validateWindowSide(ciWinEnd, values.checkInTime, 'end'),
			coStart: validateWindowSide(coWinStart, values.checkOutTime, 'start'),
			coEnd: validateWindowSide(coWinEnd, values.checkOutTime, 'end'),
		};
		if (Object.values(windowErrors.value).some(Boolean)) return;

		submittingShift.value = true;
		try {
			const { breakStartTime: _bs, breakEndTime: _be, ...rest } = values;
			const dto: CreateWorkShiftDto = {
				...rest,
				workDays: selectedWorkDays.value,
				breakStartTime: bs || null,
				breakEndTime: be || null,
				// empty → null: BE dùng default ±60p, hoặc clear override khi PATCH
				checkInWindowStart: ciWinStart || null,
				checkInWindowEnd: ciWinEnd || null,
				checkOutWindowStart: coWinStart || null,
				checkOutWindowEnd: coWinEnd || null,
				requireCheckIn: requireCheckIn.value,
				requireCheckOut: requireCheckOut.value,
			};
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

	// ─── Department + search filter ───
	const filterDepartmentId = ref<number | undefined>(undefined);
	const searchQuery = ref('');

	function normalizeSearch(s: string) {
		return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
	}

	const filteredEmployees = computed<EmployeeSummary[]>(() => {
		const q = normalizeSearch(searchQuery.value.trim());
		return directoryStore.employees.filter(e => {
			if (filterDepartmentId.value && e.department?.id !== filterDepartmentId.value) return false;
			if (!q) return true;
			return normalizeSearch(e.fullName).includes(q) || normalizeSearch(e.employeeCode).includes(q);
		});
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

	function getCellStyle(employeeId: number, date: string): string {
		const s = scheduleMap.value.get(`${employeeId}:${date}`);
		if (s?.isOnline)
			return 'bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-900/30 dark:border-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/50';
		if (s?.shift && !s.isDefault)
			return 'bg-brand-50 border-brand-200 text-brand-700 dark:bg-brand-900/30 dark:border-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/50';
		if (s?.shift && s.isDefault)
			return 'bg-gray-100 border-gray-200 text-gray-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700';
		return 'bg-red-50 border-transparent text-red-300 dark:bg-red-900/10 dark:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/20';
	}

	function cellTitle(employeeId: number, date: string): string {
		const s = scheduleMap.value.get(`${employeeId}:${date}`);
		if (!s?.shift) return 'Chưa có ca';
		const { name, checkInTime, checkOutTime, breakStartTime, breakEndTime } = s.shift;
		const range = `${checkInTime}–${checkOutTime}`;
		if (breakStartTime && breakEndTime) {
			return `${name}: ${checkInTime}–${breakStartTime} · Nghỉ trưa ${breakStartTime}–${breakEndTime} · ${breakEndTime}–${checkOutTime}`;
		}
		return `${name}: ${range}`;
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
			await loadCalendar();
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
			await loadCalendar();
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
	const bulkFilterDepartmentId = ref<number | undefined>(undefined);
	const submittingBulk = ref(false);

	const bulkFilteredEmployees = computed<EmployeeSummary[]>(() => {
		if (!bulkFilterDepartmentId.value) return directoryStore.employees;
		return directoryStore.employees.filter(e => e.department?.id === bulkFilterDepartmentId.value);
	});

	function openBulkModal() {
		bulkSelectedEmployees.value = new Set();
		bulkShiftId.value = undefined;
		bulkFilterDepartmentId.value = undefined;
		const now = new Date();
		bulkStartDate.value = format(startOfYear(now), 'yyyy-MM-dd');
		bulkEndDate.value = format(endOfYear(now), 'yyyy-MM-dd');
		showBulkModal.value = true;
	}

	function onBulkDeptFilter(v: string | number | undefined) {
		bulkFilterDepartmentId.value = typeof v === 'number' ? v : undefined;
		bulkSelectedEmployees.value = new Set();
	}

	function toggleBulkEmployee(id: number) {
		const next = new Set(bulkSelectedEmployees.value);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		bulkSelectedEmployees.value = next;
	}

	const allBulkSelected = computed(
		() =>
			bulkFilteredEmployees.value.length > 0 && bulkSelectedEmployees.value.size === bulkFilteredEmployees.value.length,
	);

	function toggleAllBulkEmployees() {
		if (allBulkSelected.value) {
			bulkSelectedEmployees.value = new Set();
		} else {
			bulkSelectedEmployees.value = new Set(bulkFilteredEmployees.value.map(e => e.id));
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

		if (bulkStartDate.value > bulkEndDate.value) {
			toast.error('Ngày bắt đầu phải trước ngày kết thúc');
			return;
		}

		submittingBulk.value = true;
		try {
			const result = await bulkAssignRange({
				fromDate: bulkStartDate.value,
				toDate: bulkEndDate.value,
				shiftId: bulkShiftId.value,
				employeeIds: Array.from(bulkSelectedEmployees.value),
			});
			toast.success(`Đã gán ca hàng loạt (${result.totalAssignments} lượt)`);
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
				<NuxtLink
					to="/management/settings"
					class="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors mb-1"
				>
					<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
					</svg>
					Cài đặt
				</NuxtLink>
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

					<!-- Time info grid — labels căn cùng cột nhờ grid-cols-[auto_1fr] -->
					<div class="grid grid-cols-[auto_1fr] gap-x-2 items-baseline mb-1">
						<span class="text-sm text-gray-700 dark:text-gray-300">Thời gian:</span>
						<span class="text-sm font-mono font-semibold text-brand-600 dark:text-brand-400">
							{{ shift.checkInTime }} → {{ shift.checkOutTime }}
						</span>

						<template v-if="shift.breakStartTime && shift.breakEndTime">
							<span class="text-xs text-gray-500 dark:text-gray-400">Nghỉ trưa:</span>
							<span class="text-xs font-mono text-gray-500 dark:text-gray-400">
								{{ shift.breakStartTime }} – {{ shift.breakEndTime }}
							</span>
						</template>

						<span class="text-xs text-gray-500 dark:text-gray-400">Thời gian vào hợp lệ:</span>
						<span class="text-xs font-mono text-gray-500 dark:text-gray-400">
							{{ effectiveWindows(shift).ciStart }} – {{ effectiveWindows(shift).ciEnd }}
						</span>

						<span class="text-xs text-gray-500 dark:text-gray-400">Thời gian ra hợp lệ:</span>
						<span class="text-xs font-mono text-gray-500 dark:text-gray-400">
							{{ effectiveWindows(shift).coStart }} – {{ effectiveWindows(shift).coEnd }}
						</span>
					</div>

					<!-- Thresholds -->
					<p class="text-xs text-gray-400 dark:text-gray-500 mb-2">
						Trễ ≤ {{ shift.lateThresholdMin }}&thinsp;phút · Về sớm ≤ {{ shift.earlyThresholdMin }}&thinsp;phút
					</p>

					<!-- Mode badges -->
					<div class="flex flex-wrap gap-1 mb-3">
						<span
							v-if="shift.isOnline"
							class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400"
							title="Cron tự ghi PRESENT, không cho check-in thủ công"
						>
							🖥️ Online
						</span>
						<span
							v-else-if="!shift.requiresLocationCheck"
							class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
							title="Check-in thủ công nhưng không kiểm tra GPS"
						>
							🌐 Không GPS
						</span>
						<span
							v-else
							class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
							title="Check-in thủ công + validate GPS"
						>
							📍 GPS
						</span>
						<span
							v-if="!shift.requireCheckIn"
							class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
							title="Ca này không yêu cầu check-in"
						>
							Chỉ check-out
						</span>
						<span
							v-if="!shift.requireCheckOut"
							class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
							title="Ca này không yêu cầu check-out"
						>
							Chỉ check-in
						</span>
						<span
							v-if="hasCustomWindow(shift)"
							class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
							:title="customWindowTooltip(shift)"
						>
							⚙️ Khung giờ tùy chỉnh
						</span>
					</div>

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
					class="flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-1"
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

				<!-- Search by name / employee code -->
				<div class="relative min-w-[240px]">
					<svg
						class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z"
						/>
					</svg>
					<input
						v-model="searchQuery"
						type="text"
						placeholder="Tìm theo tên hoặc mã NV..."
						class="w-full h-10 pl-9 pr-9 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:focus:ring-brand-800 focus:border-brand-500"
					/>
					<button
						v-if="searchQuery"
						type="button"
						class="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
						@click="searchQuery = ''"
					>
						<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

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

			<!-- T7 Online config card -->
			<div class="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
				<div class="flex items-center justify-between gap-4">
					<div>
						<h3 class="font-medium text-blue-900 dark:text-blue-200">🖥️ Làm việc online Thứ 7</h3>
						<p class="text-sm text-blue-700 dark:text-blue-400 mt-1">
							Nhân viên được chọn sẽ được tự động ghi nhận PRESENT mỗi T7 mà không cần chấm công GPS.
						</p>
					</div>
					<button
						class="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white text-sm font-medium transition-colors"
						@click="openOnlineSetupModal"
					>
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3"
							/>
						</svg>
						Cấu hình T7 Online
					</button>
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

								<!-- Day cells — 4 trạng thái: online T7 (xanh nhạt) / override (brand) / mặc định (xám) / không có ca (đỏ nhạt) -->
								<td v-for="date in weekDateStrings" :key="date" class="px-2 py-2 text-center">
									<button
										:title="cellTitle(emp.id, date)"
										:class="[
											'w-full min-h-[40px] rounded-lg border text-xs font-medium px-2 py-1.5 transition-colors leading-tight',
											getCellStyle(emp.id, date),
										]"
										@click="openCellModal(emp, date)"
									>
										<template v-if="getSchedule(emp.id, date)?.isOnline">
											<span class="block">🖥️ Online</span>
										</template>
										<template v-else-if="getSchedule(emp.id, date)?.shift">
											<span class="block truncate">{{ getSchedule(emp.id, date)!.shift!.name }}</span>
											<span v-if="getSchedule(emp.id, date)?.isDefault" class="block text-[10px] opacity-60"
												>mặc định</span
											>
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
					class="bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md lg:max-w-lg xl:max-w-2xl max-h-[90vh] overflow-y-auto"
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

						<!-- ═══════════════════════════════════════════════════ -->
						<!-- KHỐI 1: Thông tin thời gian (collapse)             -->
						<!-- ═══════════════════════════════════════════════════ -->
						<div class="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
							<button
								type="button"
								class="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
								@click="showTimeSection = !showTimeSection"
							>
								<span class="text-sm font-semibold text-gray-800 dark:text-gray-200">Thông tin thời gian</span>
								<svg
									class="w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform"
									:class="{ 'rotate-180': showTimeSection }"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
								</svg>
							</button>

							<div v-show="showTimeSection" class="p-4 space-y-4">
								<!-- Giờ vào / Giờ ra -->
								<div class="grid grid-cols-2 gap-3">
									<div>
										<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
											Giờ vào <span class="text-red-500">*</span>
										</label>
										<UiTimeInput v-model="checkInTime" v-bind="checkInTimeAttrs" :error="errors.checkInTime" />
										<p v-if="errors.checkInTime" class="mt-1 text-xs text-red-500">{{ errors.checkInTime }}</p>
									</div>
									<div>
										<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
											Giờ ra <span class="text-red-500">*</span>
										</label>
										<UiTimeInput v-model="checkOutTime" v-bind="checkOutTimeAttrs" :error="errors.checkOutTime" />
										<p v-if="errors.checkOutTime" class="mt-1 text-xs text-red-500">{{ errors.checkOutTime }}</p>
									</div>
								</div>

								<!-- Giờ nghỉ trưa -->
								<div>
									<div class="grid grid-cols-2 gap-3">
										<div>
											<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
												Bắt đầu nghỉ trưa
											</label>
											<UiTimeInput
												v-model="breakStartTime"
												v-bind="breakStartTimeAttrs"
												placeholder="12:00"
												:disabled="isCrossMidnight"
												:error="errors.breakStartTime"
											/>
											<p v-if="errors.breakStartTime" class="mt-1 text-xs text-red-500">{{ errors.breakStartTime }}</p>
										</div>
										<div>
											<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
												Kết thúc nghỉ trưa
											</label>
											<UiTimeInput
												v-model="breakEndTime"
												v-bind="breakEndTimeAttrs"
												placeholder="13:30"
												:disabled="isCrossMidnight"
												:error="errors.breakEndTime"
											/>
											<p v-if="errors.breakEndTime" class="mt-1 text-xs text-red-500">{{ errors.breakEndTime }}</p>
										</div>
									</div>
									<p v-if="isCrossMidnight" class="mt-1.5 text-xs text-amber-600 dark:text-amber-400 leading-snug">
										Ca cross-midnight (giờ ra ≤ giờ vào) không hỗ trợ nghỉ trưa.
									</p>
									<p v-else class="mt-1.5 text-xs text-gray-400 dark:text-gray-500 leading-snug">
										Để trống nếu ca không có nghỉ trưa (ca liên tục / ca đêm). Khi trống, nhân viên không thể tạo đơn
										nghỉ nửa ngày cho ca này.
									</p>
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
										<p v-if="errors.lateThresholdMin" class="mt-1 text-xs text-red-500">
											{{ errors.lateThresholdMin }}
										</p>
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
										<p v-if="errors.earlyThresholdMin" class="mt-1 text-xs text-red-500">
											{{ errors.earlyThresholdMin }}
										</p>
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

								<!-- Chế độ ca làm việc -->
								<div class="space-y-3 pt-1">
									<label class="flex items-start gap-3 cursor-pointer">
										<input
											v-model="isOnline"
											type="checkbox"
											class="mt-0.5 rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500"
										/>
										<div class="flex-1 min-w-0">
											<p class="text-sm font-medium text-gray-700 dark:text-gray-300">
												Ca online (hệ thống tự ghi công)
											</p>
											<p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-snug">
												Cron tự ghi PRESENT cuối ngày, nhân viên KHÔNG cần check-in thủ công (vd: ca T7 WFH).
											</p>
										</div>
									</label>

									<label
										class="flex items-start gap-3"
										:class="isOnline ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'"
									>
										<input
											v-model="requiresLocationCheck"
											type="checkbox"
											:disabled="!!isOnline"
											class="mt-0.5 rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500 disabled:cursor-not-allowed"
										/>
										<div class="flex-1 min-w-0">
											<p class="text-sm font-medium text-gray-700 dark:text-gray-300">Yêu cầu check vị trí GPS</p>
											<p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-snug">
												Tắt nếu nhân sự làm remote toàn thời gian — vẫn check-in/out thủ công nhưng không kiểm tra GPS.
											</p>
											<p v-if="isOnline" class="text-xs text-amber-600 dark:text-amber-400 mt-1 leading-snug">
												Ca online luôn override — không cho check-in thủ công, GPS không có tác dụng.
											</p>
										</div>
									</label>
								</div>
							</div>
						</div>

						<!-- ═══════════════════════════════════════════════════ -->
						<!-- KHỐI 2: Khung giờ được phép chấm công (collapse)   -->
						<!-- ═══════════════════════════════════════════════════ -->
						<div class="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
							<button
								type="button"
								class="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
								@click="showWindowSection = !showWindowSection"
							>
								<div class="text-left">
									<span class="block text-sm font-semibold text-gray-800 dark:text-gray-200">
										Khung giờ được phép chấm công
									</span>
									<span class="block text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-snug">
										Để trống → hệ thống tự động cộng ±60 phút
									</span>
								</div>
								<svg
									class="w-4 h-4 flex-shrink-0 text-gray-500 dark:text-gray-400 transition-transform"
									:class="{ 'rotate-180': showWindowSection }"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
								</svg>
							</button>

							<div v-show="showWindowSection" class="p-4 space-y-4">
								<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
									<!-- Check-in -->
									<div class="space-y-3">
										<p class="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
											Check-in
										</p>
										<div>
											<label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
												Cửa sổ mở lúc
											</label>
											<UiTimeInput
												:model-value="checkInWindowStart || undefined"
												:placeholder="windowPlaceholders.ciStart"
												:error="windowErrors.ciStart"
												@update:model-value="v => (checkInWindowStart = v)"
											/>
											<p v-if="windowErrors.ciStart" class="mt-1 text-[11px] text-red-500">
												{{ windowErrors.ciStart }}
											</p>
										</div>
										<div>
											<label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
												Cửa sổ đóng lúc
											</label>
											<UiTimeInput
												:model-value="checkInWindowEnd || undefined"
												:placeholder="windowPlaceholders.ciEnd"
												:error="windowErrors.ciEnd"
												@update:model-value="v => (checkInWindowEnd = v)"
											/>
											<p v-if="windowErrors.ciEnd" class="mt-1 text-[11px] text-red-500">{{ windowErrors.ciEnd }}</p>
										</div>
									</div>

									<!-- Check-out -->
									<div class="space-y-3">
										<p class="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
											Check-out
										</p>
										<div>
											<label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
												Cửa sổ mở lúc
											</label>
											<UiTimeInput
												:model-value="checkOutWindowStart || undefined"
												:placeholder="windowPlaceholders.coStart"
												:error="windowErrors.coStart"
												@update:model-value="v => (checkOutWindowStart = v)"
											/>
											<p v-if="windowErrors.coStart" class="mt-1 text-[11px] text-red-500">
												{{ windowErrors.coStart }}
											</p>
										</div>
										<div>
											<label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
												Cửa sổ đóng lúc
											</label>
											<UiTimeInput
												:model-value="checkOutWindowEnd || undefined"
												:placeholder="windowPlaceholders.coEnd"
												:error="windowErrors.coEnd"
												@update:model-value="v => (checkOutWindowEnd = v)"
											/>
											<p v-if="windowErrors.coEnd" class="mt-1 text-[11px] text-red-500">{{ windowErrors.coEnd }}</p>
										</div>
									</div>
								</div>

								<!-- Preview realtime -->
								<div
									v-if="previewWindows"
									class="mt-3 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700 px-3 py-2 space-y-1"
								>
									<p class="text-[11px] font-mono text-gray-600 dark:text-gray-300">
										Check-in: {{ previewWindows.checkIn.earliest }} → {{ previewWindows.checkIn.shiftTime }}
										<span class="text-gray-400 dark:text-gray-500"
											>(deadline: {{ previewWindows.checkIn.deadline }})</span
										>
									</p>
									<p class="text-[11px] font-mono text-gray-600 dark:text-gray-300">
										Check-out: {{ previewWindows.checkOut.earliest }} → {{ previewWindows.checkOut.shiftTime }}
										<span class="text-gray-400 dark:text-gray-500"
											>(deadline: {{ previewWindows.checkOut.deadline }})</span
										>
									</p>
								</div>

								<!-- ─── Sub-section: Yêu cầu chấm công ─── -->
								<div class="pt-4 border-t border-gray-100 dark:border-gray-800">
									<p class="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Yêu cầu chấm công</p>

									<div class="space-y-3">
										<label class="flex items-start gap-3 cursor-pointer">
											<input
												v-model="requireCheckIn"
												type="checkbox"
												class="mt-0.5 rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500"
											/>
											<div class="flex-1 min-w-0">
												<p class="text-sm font-medium text-gray-700 dark:text-gray-300">Yêu cầu check-in</p>
												<p
													v-if="!requireCheckIn"
													class="text-xs text-amber-600 dark:text-amber-400 mt-0.5 leading-snug"
												>
													⚠️ Nhân viên không cần check-in cho ca này
												</p>
											</div>
										</label>

										<label class="flex items-start gap-3 cursor-pointer">
											<input
												v-model="requireCheckOut"
												type="checkbox"
												class="mt-0.5 rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500"
											/>
											<div class="flex-1 min-w-0">
												<p class="text-sm font-medium text-gray-700 dark:text-gray-300">Yêu cầu check-out</p>
												<p
													v-if="!requireCheckOut"
													class="text-xs text-amber-600 dark:text-amber-400 mt-0.5 leading-snug"
												>
													⚠️ Nhân viên không cần check-out cho ca này
												</p>
											</div>
										</label>
									</div>

									<p v-if="requireError" class="mt-2 text-xs text-red-500 leading-snug">
										{{ requireError }}
									</p>
								</div>
							</div>
						</div>

						<!-- Actions -->
						<div class="flex justify-end gap-3 pt-2">
							<CommonAppButton variant="outline" type="button" @click="closeShiftModal">Hủy</CommonAppButton>
							<CommonAppButton type="submit" :loading="submittingShift" :disabled="!!requireError">
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
							}}<template v-if="cellTarget.current!.shift!.breakStartTime && cellTarget.current!.shift!.breakEndTime">
								· nghỉ {{ cellTarget.current!.shift!.breakStartTime }}–{{
									cellTarget.current!.shift!.breakEndTime
								}}</template
							>)
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
						<div
							v-if="cellTarget.current?.shift && !cellTarget.current.isDefault"
							class="pt-2 border-t border-gray-100 dark:border-gray-800 mt-2"
						>
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
	<!-- MODAL: T7 Online                                  -->
	<!-- ═══════════════════════════════════════════════════ -->
	<OnlineSaturdayModal v-model="showOnlineModal" :shifts="shifts" @success="loadCalendar" />

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
						<div>
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Khoảng thời gian</label>
							<UiDateRangePicker
								:from-date="bulkStartDate"
								:to-date="bulkEndDate"
								placeholder="Chọn khoảng ngày"
								@update:from-date="bulkStartDate = $event"
								@update:to-date="bulkEndDate = $event"
							/>
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

						<!-- Department filter -->
						<div>
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phòng ban</label>
							<UiSelect
								:model-value="bulkFilterDepartmentId"
								:options="departmentOptions"
								@update:model-value="onBulkDeptFilter"
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
									v-for="emp in bulkFilteredEmployees"
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
						<p class="text-xs text-gray-400 dark:text-gray-500">Server sẽ gán toàn bộ ngày trong khoảng</p>
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
