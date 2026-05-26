<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import { eachDayOfInterval, isWeekend, parseISO, isValid } from 'date-fns';
	import { isOverLateEarlyLimit, MAX_LATE_EARLY_MINUTES } from '~/utils/leave.utils';
	import { useLeaveTypeService } from '~/services/leave-type.service';
	import { useLeaveRequestService } from '~/services/leave-request.service';
	import { useLeaveBalanceService } from '~/services/leave-balance.service';
	import { useEmployeeService } from '~/services/employee.service';
	import type { LeaveType, LeaveBalance, HalfDayPeriod, CreateLeaveRequestDto, LeavePreviewResponse } from '~/types/leave.types';
	import type { EmployeeSummary } from '~/types/employee.types';

	definePageMeta({ title: 'Tạo đơn nghỉ phép' });

	const router = useRouter();
	const toast = useToast();
	const { user } = useAuth();

	const isHrOrAdmin = computed(() => user.value?.role === 'HR' || user.value?.role === 'ADMIN');

	// ─── Services ─────────────────────────────────────────────────────────────────
	const leaveTypeService = useLeaveTypeService();
	const leaveRequestService = useLeaveRequestService();
	const leaveBalanceService = useLeaveBalanceService();
	const employeeService = useEmployeeService();

	// ─── Leave types ───────────────────────────────────────────────────────────────
	const leaveTypes = ref<LeaveType[]>([]);
	const leaveTypesLoading = ref(false);

	async function loadLeaveTypes() {
		leaveTypesLoading.value = true;
		try {
			const all = await leaveTypeService.findAll();
			leaveTypes.value = all.filter(t => t.isActive);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi tải danh sách loại phép');
		} finally {
			leaveTypesLoading.value = false;
		}
	}

	// ─── Employee search (HR/ADMIN only) ──────────────────────────────────────────
	const employeeQuery = ref('');
	const employeeResults = ref<EmployeeSummary[]>([]);
	const employeeSearchLoading = ref(false);
	const selectedEmployee = ref<EmployeeSummary | null>(null);
	const showDropdown = ref(false);
	let searchTimer: ReturnType<typeof setTimeout> | null = null;

	function onEmployeeInput() {
		if (searchTimer) clearTimeout(searchTimer);
		const q = employeeQuery.value.trim();
		if (!q) {
			employeeResults.value = [];
			showDropdown.value = false;
			return;
		}
		searchTimer = setTimeout(async () => {
			employeeSearchLoading.value = true;
			try {
				const res = await employeeService.findAll({ search: q, limit: 10 });
				employeeResults.value = res.data;
				showDropdown.value = res.data.length > 0;
			} catch {
				// ignore search errors
			} finally {
				employeeSearchLoading.value = false;
			}
		}, 300);
	}

	function selectEmployee(emp: EmployeeSummary) {
		selectedEmployee.value = emp;
		employeeQuery.value = emp.fullName;
		showDropdown.value = false;
		employeeResults.value = [];
		loadBalances(emp.id);
	}

	function clearEmployee() {
		selectedEmployee.value = null;
		employeeQuery.value = '';
		employeeResults.value = [];
		loadBalances();
	}

	function onEmployeeBlur() {
		setTimeout(() => {
			showDropdown.value = false;
		}, 150);
	}

	function onLeaveTypeChange(event: Event) {
		const val = (event.target as HTMLSelectElement).value;
		leaveTypeId.value = val ? parseInt(val, 10) : undefined;
	}

	// ─── Leave balances ────────────────────────────────────────────────────────────
	const balances = ref<LeaveBalance[]>([]);
	const balancesLoading = ref(false);

	async function loadBalances(employeeId?: number) {
		balancesLoading.value = true;
		try {
			if (employeeId) {
				const res = await leaveBalanceService.findAll({
					employeeId,
					year: new Date().getFullYear(),
				});
				balances.value = res.data;
			} else {
				balances.value = await leaveBalanceService.findMe();
			}
		} catch {
			// non-critical — panel stays empty
		} finally {
			balancesLoading.value = false;
		}
	}

	function balancePct(b: LeaveBalance) {
		return b.totalDays > 0 ? Math.round((b.usedDays / b.totalDays) * 100) : 0;
	}

	// ─── Form setup ──────────────────────────────────────────────────────────────

	// Static schema: only always-required fields enforced by zod.
	// Conditional validation (endDate, halfDayPeriod, lateMinutes, earlyMinutes)
	// is handled manually in onSubmit to avoid vee-validate resetting fields
	// whenever a computed schema is rebuilt on selectedCode change.
	const { handleSubmit, errors, defineField, isSubmitting, resetField, setFieldValue, setErrors } = useForm({
		validationSchema: toTypedSchema(
			z.object({
				leaveTypeId: z.number({ required_error: 'Vui lòng chọn hình thức' }),
				startDate: z.string().min(1, 'Vui lòng chọn ngày'),
				endDate: z.string().optional(),
				halfDayPeriod: z.enum(['MORNING', 'AFTERNOON']).optional(),
				lateMinutes: z
					.number()
					.int()
					.min(1)
					.max(MAX_LATE_EARLY_MINUTES, { message: 'Tối đa 120 phút. Vui lòng chuyển sang đơn nghỉ nửa ngày.' })
					.optional(),
				earlyMinutes: z
					.number()
					.int()
					.min(1)
					.max(MAX_LATE_EARLY_MINUTES, { message: 'Tối đa 120 phút. Vui lòng chuyển sang đơn nghỉ nửa ngày.' })
					.optional(),
				reason: z.string().min(10, 'Lý do phải có ít nhất 10 ký tự'),
			}),
		),
	});

	const [leaveTypeId, leaveTypeIdAttrs] = defineField('leaveTypeId');
	const [startDate] = defineField('startDate');
	const [endDate] = defineField('endDate');
	const [halfDayPeriod, halfDayPeriodAttrs] = defineField('halfDayPeriod');
	const [lateMinutes, lateMinutesAttrs] = defineField('lateMinutes');
	const [earlyMinutes, earlyMinutesAttrs] = defineField('earlyMinutes');
	const [reason, reasonAttrs] = defineField('reason');

	// ─── 120-minute limit warning state ──────────────────────────────────────────
	const showLimitWarning = ref(false);
	const suggestHalfDay = ref(false);

	// ─── ANNUAL preview state ─────────────────────────────────────────────────────
	const preview = ref<LeavePreviewResponse | null>(null);
	const previewLoading = ref(false);
	const showConfirmDialog = ref(false);
	const isConfirming = ref(false);
	const pendingDto = ref<CreateLeaveRequestDto | null>(null);
	let previewTimer: ReturnType<typeof setTimeout> | null = null;

	// Derived directly from leaveTypeId.value so it stays reactive without a watch
	const selectedLeaveType = computed(
		() => leaveTypes.value.find(t => t.id === (leaveTypeId.value as number | undefined)) ?? null,
	);
	const selectedCode = computed(() => selectedLeaveType.value?.code ?? null);

	// Reset type-specific fields when the selected leave type changes
	watch(selectedCode, () => {
		resetField('endDate');
		resetField('halfDayPeriod');
		resetField('lateMinutes');
		resetField('earlyMinutes');
		resetField('startDate');
		showLimitWarning.value = false;
		suggestHalfDay.value = false;
		preview.value = null;
		if (previewTimer) clearTimeout(previewTimer);
	});

	// HALF_DAY / LATE / EARLY: endDate must equal startDate
	watch(startDate, d => {
		const code = selectedCode.value;
		if ((code === 'HALF_DAY' || code === 'LATE' || code === 'EARLY') && d) {
			setFieldValue('endDate', d);
		}
	});

	// ─── ANNUAL preview: debounced call when both dates are set ──────────────────
	function triggerPreview() {
		if (selectedCode.value !== 'ANNUAL' || !startDate.value || !endDate.value) {
			preview.value = null;
			return;
		}
		if (previewTimer) clearTimeout(previewTimer);
		previewTimer = setTimeout(async () => {
			previewLoading.value = true;
			try {
				preview.value = await leaveRequestService.preview({
					leaveTypeId: leaveTypeId.value as number,
					startDate: startDate.value as string,
					endDate: endDate.value as string,
				});
			} catch {
				preview.value = null;
			} finally {
				previewLoading.value = false;
			}
		}, 500);
	}

	watch([startDate, endDate], () => {
		if (selectedCode.value === 'ANNUAL') triggerPreview();
	});

	// ─── Computed duration display ─────────────────────────────────────────────────
	const durationText = computed(() => {
		const code = selectedCode.value;
		if (!code) return null;

		if (code === 'ANNUAL' && startDate.value && endDate.value) {
			try {
				const s = parseISO(startDate.value as string);
				const e = parseISO(endDate.value as string);
				if (!isValid(s) || !isValid(e) || e < s) return null;
				const workDays = eachDayOfInterval({ start: s, end: e }).filter(d => !isWeekend(d)).length;
				return `${workDays} ngày làm việc`;
			} catch {
				return null;
			}
		}

		if (code === 'HALF_DAY') return '0.5 ngày';
		if (code === 'LATE' && lateMinutes.value) return `${lateMinutes.value} phút`;
		if (code === 'EARLY' && earlyMinutes.value) return `${earlyMinutes.value} phút`;

		return null;
	});

	// ─── Side panel note ──────────────────────────────────────────────────────────
	const typeNote = computed(() => {
		switch (selectedCode.value) {
			case 'ANNUAL':
				return 'Số ngày nghỉ sẽ được trừ vào số dư phép năm. Ngày lễ và cuối tuần không tính.';
			case 'HALF_DAY':
				return 'Nghỉ nửa ngày tính 0.5 ngày phép. Buổi sáng: nghỉ đến 12:00. Buổi chiều: đi làm từ 12:00.';
			case 'LATE':
				return 'Đơn đi muộn không trừ ngày phép. Chỉ ghi nhận để báo cáo.';
			case 'EARLY':
				return 'Đơn về sớm không trừ ngày phép. Chỉ ghi nhận để báo cáo.';
			default:
				return null;
		}
	});

	// ─── 120-minute limit helpers ─────────────────────────────────────────────────
	const isOverLimit = computed(() => {
		if (selectedCode.value === 'LATE' && lateMinutes.value) {
			return isOverLateEarlyLimit(lateMinutes.value as number);
		}
		if (selectedCode.value === 'EARLY' && earlyMinutes.value) {
			return isOverLateEarlyLimit(earlyMinutes.value as number);
		}
		return false;
	});

	function onMinutesInput(value: number) {
		if (!value) {
			showLimitWarning.value = false;
			suggestHalfDay.value = false;
			return;
		}
		const over = isOverLateEarlyLimit(value);
		showLimitWarning.value = over;
		suggestHalfDay.value = over;
	}

	function switchToHalfDay() {
		const halfDayType = leaveTypes.value.find(t => t.code === 'HALF_DAY');
		if (!halfDayType) return;

		// Save date before watch resets it
		const savedDate = startDate.value as string | undefined;

		setFieldValue('leaveTypeId', halfDayType.id);
		showLimitWarning.value = false;
		suggestHalfDay.value = false;

		// Restore date after watch fires and resets fields
		nextTick(() => {
			if (savedDate) {
				setFieldValue('startDate', savedDate);
				setFieldValue('endDate', savedDate);
			}
			document.getElementById('half-day-period-field')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		});
	}

	// ─── Submit ────────────────────────────────────────────────────────────────────
	async function doSubmit(dto: CreateLeaveRequestDto) {
		try {
			const created = await leaveRequestService.create(dto);
			if (created.leaveCode === 'P+KL' && created.paidDays !== undefined && created.unpaidDays !== undefined) {
				toast.success(`Đã gửi đơn: ${created.paidDays} ngày P + ${created.unpaidDays} ngày KL`);
			} else if (created.leaveCode === 'KL') {
				toast.success('Đã gửi đơn nghỉ không lương');
			} else {
				const approverName = created.assignedApprover?.fullName;
				if (approverName) {
					toast.success(`Đã gửi đơn thành công. Đang chờ ${approverName} duyệt.`);
				} else {
					toast.success('Đã gửi đơn. HR sẽ xem xét.');
				}
			}
			setTimeout(() => router.push('/users/leave-requests'), 1500);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
		}
	}

	async function confirmAndSubmit() {
		if (!pendingDto.value) return;
		showConfirmDialog.value = false;
		isConfirming.value = true;
		try {
			await doSubmit(pendingDto.value);
		} finally {
			isConfirming.value = false;
			pendingDto.value = null;
		}
	}

	const onSubmit = handleSubmit(async values => {
		const code = selectedCode.value;

		// Conditional validation not handled by static Zod schema
		if (code === 'ANNUAL') {
			if (!values.endDate) {
				setErrors({ endDate: 'Vui lòng chọn ngày kết thúc' });
				return;
			}
			if (values.endDate < values.startDate) {
				setErrors({ endDate: 'Ngày kết thúc phải >= ngày bắt đầu' });
				return;
			}
		}
		if (code === 'HALF_DAY' && !values.halfDayPeriod) {
			setErrors({ halfDayPeriod: 'Vui lòng chọn buổi' });
			return;
		}
		if (code === 'LATE' && !values.lateMinutes) {
			setErrors({ lateMinutes: 'Vui lòng nhập số phút đi muộn' });
			return;
		}
		if (code === 'EARLY' && !values.earlyMinutes) {
			setErrors({ earlyMinutes: 'Vui lòng nhập số phút về sớm' });
			return;
		}

		const dto: CreateLeaveRequestDto = {
			leaveTypeId: values.leaveTypeId,
			startDate: values.startDate,
			endDate:
				code === 'HALF_DAY' || code === 'LATE' || code === 'EARLY'
					? values.startDate
					: (values.endDate ?? values.startDate),
			reason: values.reason,
		};

		if (code === 'HALF_DAY') dto.halfDayPeriod = values.halfDayPeriod as HalfDayPeriod;
		if (code === 'LATE') dto.lateMinutes = values.lateMinutes;
		if (code === 'EARLY') dto.earlyMinutes = values.earlyMinutes;

		// ANNUAL with unpaid days → show confirm dialog first
		if (code === 'ANNUAL' && preview.value && preview.value.unpaidDays > 0) {
			pendingDto.value = dto;
			showConfirmDialog.value = true;
			return;
		}

		await doSubmit(dto);
	});

	// ─── Lifecycle ─────────────────────────────────────────────────────────────────
	onMounted(() => {
		loadLeaveTypes();
		loadBalances();
	});
</script>

<template>
	<div class="space-y-5">
		<!-- Header -->
		<div class="flex items-center gap-3">
			<NuxtLink
				to="/leave"
				class="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
				title="Quay lại"
			>
				<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
				</svg>
			</NuxtLink>
			<div>
				<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Tạo đơn nghỉ phép</h1>
				<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">HR / Admin tạo đơn thay nhân viên</p>
			</div>
		</div>

		<!-- Content -->
		<div class="flex flex-col lg:flex-row gap-6 items-start">
			<!-- ── Left: Form ─────────────────────────────────────────────────── -->
			<div class="flex-1 min-w-0">
				<form
					class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-5"
					@submit.prevent="onSubmit"
				>
					<!-- Employee selector (HR/ADMIN only) -->
					<div v-if="isHrOrAdmin">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
							Nhân viên
							<span class="ml-1 text-xs text-gray-400 font-normal">(để trống = tạo cho chính mình)</span>
						</label>
						<div class="relative">
							<div class="relative flex items-center">
								<input
									v-model="employeeQuery"
									type="text"
									placeholder="Tìm theo tên hoặc mã nhân viên…"
									class="w-full pl-3 pr-9 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
									autocomplete="off"
									@input="onEmployeeInput"
									@blur="onEmployeeBlur"
									@focus="() => employeeResults.length > 0 && (showDropdown = true)"
								/>
								<div class="absolute right-2.5 flex items-center gap-1">
									<svg
										v-if="employeeSearchLoading"
										class="animate-spin w-4 h-4 text-gray-400"
										fill="none"
										viewBox="0 0 24 24"
									>
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
									</svg>
									<button
										v-else-if="selectedEmployee"
										type="button"
										class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
										@click="clearEmployee"
									>
										<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
											<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
										</svg>
									</button>
								</div>
							</div>

							<!-- Dropdown -->
							<div
								v-if="showDropdown && employeeResults.length > 0"
								class="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden"
							>
								<button
									v-for="emp in employeeResults"
									:key="emp.id"
									type="button"
									class="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
									@mousedown.prevent="selectEmployee(emp)"
								>
									<div
										class="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-brand-700 dark:text-brand-300"
									>
										{{ emp.fullName.charAt(0) }}
									</div>
									<div class="min-w-0">
										<p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ emp.fullName }}</p>
										<p class="text-xs text-gray-400 dark:text-gray-500">
											{{ emp.employeeCode }} · {{ emp.department?.name ?? 'Chưa có phòng ban' }}
										</p>
									</div>
								</button>
							</div>
						</div>

						<!-- Selected employee badge -->
						<div v-if="selectedEmployee" class="mt-2 flex items-center gap-2">
							<span
								class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
							>
								<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
									/>
								</svg>
								{{ selectedEmployee.fullName }}
							</span>
							<span class="text-xs text-gray-400">Xem số dư phép bên phải →</span>
						</div>
					</div>

					<!-- Divider if HR/ADMIN -->
					<hr v-if="isHrOrAdmin" class="border-gray-100 dark:border-gray-800" />

					<!-- Field 1: Leave type -->
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
							Hình thức <span class="text-red-500">*</span>
						</label>
						<select
							:value="leaveTypeId"
							v-bind="leaveTypeIdAttrs"
							class="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors appearance-none"
							:class="
								errors.leaveTypeId ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
							"
							@change="onLeaveTypeChange"
						>
							<option value="" disabled selected>Chọn hình thức nghỉ phép</option>
							<option v-for="lt in leaveTypes" :key="lt.id" :value="lt.id">{{ lt.name }}</option>
						</select>
						<p v-if="errors.leaveTypeId" class="mt-1 text-xs text-red-500">{{ errors.leaveTypeId }}</p>
					</div>

					<!-- Fields 2+3: Date/time — conditional by type -->
					<template v-if="selectedCode">
						<!-- ANNUAL: date range -->
						<template v-if="selectedCode === 'ANNUAL'">
							<div>
								<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
									Thời gian <span class="text-red-500">*</span>
								</label>
								<UiDateRangePicker
									:fromDate="(startDate as string) ?? ''"
									:toDate="(endDate as string) ?? ''"
									placeholder="Chọn khoảng ngày"
									@update:fromDate="v => setFieldValue('startDate', v)"
									@update:toDate="v => setFieldValue('endDate', v)"
								/>
								<p v-if="errors.startDate" class="mt-1 text-xs text-red-500">{{ errors.startDate }}</p>
								<p v-else-if="errors.endDate" class="mt-1 text-xs text-red-500">{{ errors.endDate }}</p>
							</div>

							<!-- Preview loading -->
							<div v-if="previewLoading" class="mt-3 flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
								<svg class="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
								</svg>
								Đang tính số dư phép...
							</div>

							<!-- Preview card -->
							<div
								v-else-if="preview"
								:class="[
									'mt-3 p-3 rounded-lg border',
									preview.leaveCode === 'P'
										? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
										: preview.leaveCode === 'KL'
											? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
											: 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800',
								]"
							>
								<!-- Kịch bản P: đủ phép -->
								<template v-if="preview.leaveCode === 'P'">
									<p class="text-sm font-medium text-green-800 dark:text-green-300">
										✓ {{ preview.totalDays }} ngày nghỉ hưởng lương (P)
									</p>
									<p class="text-xs text-green-600 dark:text-green-400 mt-1">
										Số dư còn lại sau khi duyệt: {{ preview.remainingAfter }} ngày
									</p>
								</template>

								<!-- Kịch bản KL: hết phép -->
								<template v-else-if="preview.leaveCode === 'KL'">
									<p class="text-sm font-medium text-red-800 dark:text-red-300">⚠️ Số dư phép năm đã hết</p>
									<p class="text-sm text-red-700 dark:text-red-400 mt-1">
										{{ preview.totalDays }} ngày sẽ tính là Nghỉ không lương (KL)
									</p>
								</template>

								<!-- Kịch bản P+KL: split -->
								<template v-else>
									<p class="text-sm font-medium text-amber-800 dark:text-amber-300">
										⚠️ Phép năm không đủ — tự động tách đơn
									</p>
									<div class="mt-2 space-y-1">
										<div class="flex justify-between text-sm">
											<span class="text-amber-700 dark:text-amber-400">Nghỉ hưởng lương (P):</span>
											<span class="font-medium text-amber-900 dark:text-amber-200">{{ preview.paidDays }} ngày</span>
										</div>
										<div class="flex justify-between text-sm">
											<span class="text-amber-700 dark:text-amber-400">Nghỉ không lương (KL):</span>
											<span class="font-medium text-amber-900 dark:text-amber-200">{{ preview.unpaidDays }} ngày</span>
										</div>
										<div
											class="border-t border-amber-200 dark:border-amber-700 pt-1 flex justify-between text-sm"
										>
											<span class="text-amber-700 dark:text-amber-400">Số dư còn lại sau duyệt:</span>
											<span class="font-medium text-amber-900 dark:text-amber-200">0 ngày</span>
										</div>
									</div>
								</template>
							</div>
						</template>

						<!-- HALF_DAY: single date + period -->
						<template v-else-if="selectedCode === 'HALF_DAY'">
							<div class="grid sm:grid-cols-2 gap-4">
								<div>
									<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
										Ngày <span class="text-red-500">*</span>
									</label>
									<UiDateRangePicker
										:fromDate="(startDate as string) ?? ''"
										:toDate="(startDate as string) ?? ''"
										placeholder="Chọn ngày"
										@update:fromDate="v => setFieldValue('startDate', v)"
										@update:toDate="v => setFieldValue('startDate', v)"
									/>
									<p v-if="errors.startDate" class="mt-1 text-xs text-red-500">{{ errors.startDate }}</p>
								</div>
								<div id="half-day-period-field">
									<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
										Thời gian <span class="text-red-500">*</span>
									</label>
									<select
										:value="halfDayPeriod"
										v-bind="halfDayPeriodAttrs"
										class="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors appearance-none"
										:class="
											errors.halfDayPeriod
												? 'border-red-400 dark:border-red-500'
												: 'border-gray-300 dark:border-gray-600'
										"
										@change="halfDayPeriod = ($event.target as HTMLSelectElement).value as HalfDayPeriod"
									>
										<option value="" disabled selected>Chọn buổi</option>
										<option value="MORNING">Buổi sáng</option>
										<option value="AFTERNOON">Buổi chiều</option>
									</select>
									<p v-if="errors.halfDayPeriod" class="mt-1 text-xs text-red-500">{{ errors.halfDayPeriod }}</p>
								</div>
							</div>
						</template>

						<!-- LATE: single date + minutes -->
						<template v-else-if="selectedCode === 'LATE'">
							<div class="grid sm:grid-cols-2 gap-4">
								<div>
									<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
										Ngày <span class="text-red-500">*</span>
									</label>
									<UiDateRangePicker
										:fromDate="(startDate as string) ?? ''"
										:toDate="(startDate as string) ?? ''"
										placeholder="Chọn ngày"
										@update:fromDate="v => setFieldValue('startDate', v)"
										@update:toDate="v => setFieldValue('startDate', v)"
									/>
									<p v-if="errors.startDate" class="mt-1 text-xs text-red-500">{{ errors.startDate }}</p>
								</div>
								<div>
									<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
										Số phút đi muộn <span class="text-red-500">*</span>
									</label>
									<input
										:value="lateMinutes ?? ''"
										v-bind="lateMinutesAttrs"
										type="number"
										min="1"
										:max="MAX_LATE_EARLY_MINUTES"
										placeholder="Nhập số phút (tối đa 120)"
										class="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
										:class="
											errors.lateMinutes ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
										"
										@input="
											e => {
												const v = (e.target as HTMLInputElement).valueAsNumber;
												lateMinutes = v || undefined;
												onMinutesInput(v);
											}
										"
									/>
									<p v-if="errors.lateMinutes" class="mt-1 text-xs text-red-500">{{ errors.lateMinutes }}</p>
								</div>
							</div>

							<!-- Warning banner: > 120 phút -->
							<div
								v-if="showLimitWarning"
								class="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg"
							>
								<div class="flex items-start gap-2">
									<svg
										class="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0"
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
									<div>
										<p class="text-sm font-medium text-amber-800 dark:text-amber-300">Vượt quá giới hạn 2 giờ</p>
										<p class="text-sm text-amber-700 dark:text-amber-400 mt-1">
											Thời gian đi muộn không được quá 120 phút.
										</p>
										<button
											v-if="suggestHalfDay"
											type="button"
											class="mt-2 text-sm font-medium text-amber-900 dark:text-amber-200 underline underline-offset-2 hover:no-underline transition-all"
											@click="switchToHalfDay"
										>
											→ Chuyển sang đơn nghỉ nửa ngày
										</button>
									</div>
								</div>
							</div>
						</template>

						<!-- EARLY: single date + minutes -->
						<template v-else-if="selectedCode === 'EARLY'">
							<div class="grid sm:grid-cols-2 gap-4">
								<div>
									<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
										Ngày <span class="text-red-500">*</span>
									</label>
									<UiDateRangePicker
										:fromDate="(startDate as string) ?? ''"
										:toDate="(startDate as string) ?? ''"
										placeholder="Chọn ngày"
										@update:fromDate="v => setFieldValue('startDate', v)"
										@update:toDate="v => setFieldValue('startDate', v)"
									/>
									<p v-if="errors.startDate" class="mt-1 text-xs text-red-500">{{ errors.startDate }}</p>
								</div>
								<div>
									<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
										Số phút về sớm <span class="text-red-500">*</span>
									</label>
									<input
										:value="earlyMinutes ?? ''"
										v-bind="earlyMinutesAttrs"
										type="number"
										min="1"
										:max="MAX_LATE_EARLY_MINUTES"
										placeholder="Nhập số phút (tối đa 120)"
										class="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
										:class="
											errors.earlyMinutes
												? 'border-red-400 dark:border-red-500'
												: 'border-gray-300 dark:border-gray-600'
										"
										@input="
											e => {
												const v = (e.target as HTMLInputElement).valueAsNumber;
												earlyMinutes = v || undefined;
												onMinutesInput(v);
											}
										"
									/>
									<p v-if="errors.earlyMinutes" class="mt-1 text-xs text-red-500">{{ errors.earlyMinutes }}</p>
								</div>
							</div>

							<!-- Warning banner: > 120 phút -->
							<div
								v-if="showLimitWarning"
								class="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg"
							>
								<div class="flex items-start gap-2">
									<svg
										class="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0"
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
									<div>
										<p class="text-sm font-medium text-amber-800 dark:text-amber-300">Vượt quá giới hạn 2 giờ</p>
										<p class="text-sm text-amber-700 dark:text-amber-400 mt-1">
											Thời gian về sớm không được quá 120 phút.
										</p>
										<button
											v-if="suggestHalfDay"
											type="button"
											class="mt-2 text-sm font-medium text-amber-900 dark:text-amber-200 underline underline-offset-2 hover:no-underline transition-all"
											@click="switchToHalfDay"
										>
											→ Chuyển sang đơn nghỉ nửa ngày
										</button>
									</div>
								</div>
							</div>
						</template>

						<!-- Fallback: loại phép khác (code không phải 4 loại chuẩn) → date range picker -->
						<template v-else>
							<div>
								<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
									Thời gian <span class="text-red-500">*</span>
								</label>
								<UiDateRangePicker
									:fromDate="(startDate as string) ?? ''"
									:toDate="(endDate as string) ?? ''"
									placeholder="Chọn khoảng ngày"
									@update:fromDate="v => setFieldValue('startDate', v)"
									@update:toDate="v => setFieldValue('endDate', v)"
								/>
								<p v-if="errors.startDate" class="mt-1 text-xs text-red-500">{{ errors.startDate }}</p>
								<p v-else-if="errors.endDate" class="mt-1 text-xs text-red-500">{{ errors.endDate }}</p>
							</div>
						</template>
					</template>

					<!-- Field 4: Duration (readonly computed) -->
					<div
						v-if="durationText"
						class="flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
					>
						<svg
							class="w-4 h-4 text-gray-400 flex-shrink-0"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<div>
							<span class="text-sm text-gray-500 dark:text-gray-400">Khoảng thời gian: </span>
							<span class="text-sm font-semibold text-gray-900 dark:text-white">{{ durationText }}</span>
							<span v-if="selectedCode === 'ANNUAL'" class="ml-1.5 text-xs text-gray-400"
								>(chưa tính ngày lễ — server sẽ tính lại)</span
							>
						</div>
					</div>

					<!-- Field 5: Reason -->
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
							Lý do nghỉ phép <span class="text-red-500">*</span>
						</label>
						<textarea
							v-model="reason"
							v-bind="reasonAttrs"
							rows="4"
							placeholder="Nhập lý do nghỉ phép (tối thiểu 10 ký tự)"
							class="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors resize-none"
							:class="errors.reason ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'"
						/>
						<div class="flex items-center justify-between mt-1">
							<p v-if="errors.reason" class="text-xs text-red-500">{{ errors.reason }}</p>
							<p v-else class="text-xs text-gray-400">{{ (reason as string | undefined)?.length ?? 0 }} ký tự</p>
						</div>
					</div>

					<!-- Submit -->
					<div class="pt-1">
						<CommonAppButton type="submit" class="w-full justify-center" :loading="isSubmitting" :disabled="isOverLimit">
							<svg
								v-if="!isSubmitting"
								class="w-4 h-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
								/>
							</svg>
							{{ isSubmitting ? 'Đang gửi đơn…' : 'Gửi đơn' }}
						</CommonAppButton>
					</div>
				</form>
			</div>

			<!-- ── Right: Info panel ──────────────────────────────────────────── -->
			<div class="w-full lg:w-80 space-y-4">
				<!-- Balance card -->
				<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
					<h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
						<svg class="w-4 h-4 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5"
							/>
						</svg>
						Số dư phép
						<span v-if="selectedEmployee" class="font-normal text-gray-400 text-xs"
							>— {{ selectedEmployee.fullName }}</span
						>
					</h3>

					<div v-if="balancesLoading" class="flex justify-center py-4">
						<svg class="animate-spin w-5 h-5 text-brand-500" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
						</svg>
					</div>

					<div v-else-if="balances.length === 0" class="py-4 text-center text-sm text-gray-400 dark:text-gray-500">
						Không có dữ liệu số dư phép
					</div>

					<div v-else class="space-y-4">
						<div v-for="b in balances" :key="b.id">
							<div class="flex items-center justify-between mb-1.5">
								<span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ b.leaveType.name }}</span>
								<span
									class="text-xs font-semibold"
									:class="
										b.remainingDays < 2
											? 'text-red-600 dark:text-red-400'
											: b.remainingDays <= 5
												? 'text-orange-500 dark:text-orange-400'
												: 'text-green-600 dark:text-green-400'
									"
								>
									Còn {{ b.remainingDays }} ngày
								</span>
							</div>
							<!-- Progress bar -->
							<div class="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
								<div
									class="h-full rounded-full transition-all"
									:class="b.remainingDays < 2 ? 'bg-red-500' : 'bg-brand-500'"
									:style="{ width: `${balancePct(b)}%` }"
								/>
							</div>
							<div class="flex items-center justify-between mt-1">
								<span class="text-xs text-gray-400">Đã dùng: {{ b.usedDays }} / {{ b.totalDays }} ngày</span>
							</div>
							<p v-if="b.remainingDays < 2" class="mt-1 text-xs text-red-600 dark:text-red-400 font-medium">
								Cảnh báo: còn rất ít ngày phép
							</p>
						</div>
					</div>
				</div>

				<!-- Type note card -->
				<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
					<h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
						<svg class="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
							/>
						</svg>
						Ghi chú
					</h3>
					<p v-if="typeNote" class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
						{{ typeNote }}
					</p>
					<p v-else class="text-sm text-gray-400 dark:text-gray-500 italic">Chọn hình thức để xem hướng dẫn.</p>
				</div>

				<!-- Approver placeholder card -->
				<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
					<h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
						<svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
							/>
						</svg>
						Người duyệt
					</h3>
					<p class="text-sm text-gray-400 dark:text-gray-500 leading-relaxed">
						Người duyệt sẽ được xác định tự động dựa theo cấu trúc phân cấp của nhân viên.
					</p>
				</div>
			</div>
		</div>
	</div>

	<!-- ─── Confirm dialog (KL / P+KL) ───────────────────────────────────────── -->
	<Teleport to="body">
		<div
			v-if="showConfirmDialog"
			class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
			@click.self="showConfirmDialog = false"
		>
			<div class="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-md w-full mx-4 shadow-xl border border-gray-200 dark:border-gray-700">
				<h3 class="text-lg font-semibold text-gray-900 dark:text-white">Xác nhận gửi đơn</h3>

				<!-- Kịch bản KL -->
				<div v-if="preview?.leaveCode === 'KL'" class="mt-3">
					<p class="text-gray-700 dark:text-gray-300">Số dư phép năm của bạn đã hết.</p>
					<p class="mt-2 font-medium text-red-700 dark:text-red-400">
						Toàn bộ {{ preview.totalDays }} ngày sẽ tính là
						<span class="bg-red-100 dark:bg-red-900/40 px-1 rounded">Nghỉ không lương (KL)</span>.
					</p>
				</div>

				<!-- Kịch bản P+KL -->
				<div v-else-if="preview?.leaveCode === 'P+KL'" class="mt-3">
					<p class="text-gray-700 dark:text-gray-300">Đơn của bạn sẽ được tách như sau:</p>
					<div class="mt-2 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-2">
						<div class="flex justify-between">
							<span class="text-gray-600 dark:text-gray-400">Hưởng lương (P):</span>
							<span class="font-semibold text-green-700 dark:text-green-400">{{ preview.paidDays }} ngày</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-600 dark:text-gray-400">Không lương (KL):</span>
							<span class="font-semibold text-red-700 dark:text-red-400">{{ preview.unpaidDays }} ngày</span>
						</div>
					</div>
				</div>

				<p class="mt-3 text-sm text-gray-500 dark:text-gray-400">Bạn có muốn tiếp tục gửi đơn không?</p>

				<div class="mt-4 flex gap-3 justify-end">
					<button
						class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
						@click="showConfirmDialog = false"
					>
						Hủy
					</button>
					<button
						class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
						:disabled="isConfirming"
						@click="confirmAndSubmit"
					>
						{{ isConfirming ? 'Đang gửi…' : 'Xác nhận gửi đơn' }}
					</button>
				</div>
			</div>
		</div>
	</Teleport>
</template>
