<script setup lang="ts">
	import { format, startOfMonth, endOfMonth } from 'date-fns';
	import { storeToRefs } from 'pinia';
	import LeaveStatusBadge from '~/components/modules/leave/LeaveStatusBadge.vue';
	import LeaveDetailModal from '~/components/modules/leave/LeaveDetailModal.vue';
	import RejectModal from '~/components/modules/leave/RejectModal.vue';
	import MakeupStatusBadge from '~/components/modules/makeup-attendance/MakeupStatusBadge.vue';
	import MakeupDetailModal from '~/components/modules/makeup-attendance/MakeupDetailModal.vue';
	import MakeupRejectModal from '~/components/modules/makeup-attendance/MakeupRejectModal.vue';
	import ViolationStatusBadge from '~/components/modules/violation/ViolationStatusBadge.vue';
	import ViolationDetailModal from '~/components/modules/violation/ViolationDetailModal.vue';
	import ViolationRejectModal from '~/components/modules/violation/ViolationRejectModal.vue';
	import OvertimeStatusBadge from '~/components/modules/overtime/OvertimeStatusBadge.vue';
	import OvertimeDetailModal from '~/components/modules/overtime/OvertimeDetailModal.vue';
	import RejectOvertimeModal from '~/components/modules/overtime/RejectOvertimeModal.vue';
	import TripStatusBadge from '~/components/modules/business-trip/TripStatusBadge.vue';
	import RejectTripModal from '~/components/modules/business-trip/RejectTripModal.vue';
	import OnlineWorkStatusBadge from '~/components/modules/online-work/OnlineWorkStatusBadge.vue';
	import OnlineWorkDetailModal from '~/components/modules/online-work/OnlineWorkDetailModal.vue';
	import RejectOnlineWorkModal from '~/components/modules/online-work/RejectOnlineWorkModal.vue';
	import { useApprovalService } from '~/services/approval.service';
	import { useLeaveRequestService } from '~/services/leave-request.service';
	import { useMakeupAttendanceService } from '~/services/makeup-attendance.service';
	import { useViolationRequestService } from '~/services/violation-request.service';
	import { useOvertimeRequestService } from '~/services/overtime-request.service';
	import { useBusinessTripService } from '~/services/business-trip.service';
	import { useOnlineWorkRequestService } from '~/services/online-work-request.service';
	import ApprovalFilterBar from '~/components/modules/approval/ApprovalFilterBar.vue';
	import { VIOLATION_STATUS_OPTIONS } from '~/utils/violation.utils';
	import { MAKEUP_STATUS_OPTIONS } from '~/utils/makeup-attendance.utils';
	import type { ApprovalModuleKey, ApprovalFilterField, ApprovalFilterState } from '~/types/approval.types';
	import type { LeaveRequest, LeaveStatus, QueryLeaveRequestParams } from '~/types/leave.types';
	import type {
		MakeupRequestResponse,
		MakeupRequestStatus,
		QueryMakeupRequestParams,
	} from '~/types/makeup-attendance.types';
	import type {
		ViolationRequest,
		ViolationRequestStatus,
		QueryViolationRequestParams,
	} from '~/types/violation.types';
	import type { OvertimeRequestResponse, OvertimeStatus, QueryOvertimeParams } from '~/types/overtime.types';
	import type {
		BusinessTripResponse,
		BusinessTripStatus,
		QueryBusinessTripsParams,
	} from '~/types/business-trip.types';
	import type {
		OnlineWorkRequestResponse,
		OnlineWorkStatus,
		QueryOnlineWorkParams,
	} from '~/types/online-work-request.types';
	import type { PaginatedMeta } from '~/types/api.types';
	import type { SelectOption } from '~/components/ui/Select.vue';

	definePageMeta({ title: 'Hộp thư phê duyệt' });

	const toast = useToast();
	const route = useRoute();
	const router = useRouter();
	const approvalService = useApprovalService();
	const leaveService = useLeaveRequestService();
	const makeupService = useMakeupAttendanceService();
	const violationService = useViolationRequestService();
	const overtimeService = useOvertimeRequestService();
	const tripService = useBusinessTripService();
	const onlineWorkService = useOnlineWorkRequestService();
	const approvalStore = useApprovalStore();
	const { counts } = storeToRefs(approvalStore);
	const directoryStore = useDirectoryStore();

	type Tab = ApprovalModuleKey;

	interface TabConfig {
		key: Tab;
		label: string;
		route: string;
	}

	const tabs: TabConfig[] = [
		{ key: 'leaveRequests', label: 'Nghỉ phép', route: '/management/leave' },
		{ key: 'overtimeRequests', label: 'Làm thêm giờ', route: '/management/overtime' },
		{ key: 'onlineWorkRequests', label: 'Làm online', route: '/management/online-work' },
		{ key: 'violationRequests', label: 'Vi phạm chuyên cần', route: '/management/violations' },
		{ key: 'makeupAttendance', label: 'Bù công', route: '/management/makeup-attendance' },
		{ key: 'businessTrips', label: 'Công tác', route: '/management/business-trips' },
	];

	const activeTab = ref<Tab>((route.query.tab as Tab) || 'leaveRequests');

	watch(activeTab, tab => {
		router.replace({ query: { ...route.query, tab } });
		loadCurrentTab();
	});

	// ─── Filters ──────────────────────────────────────────────────────────────────
	// Mỗi tab giữ filter riêng — chuyển tab không mang filter cũ sang module khác.
	const FILTER_FIELDS: Record<Tab, ApprovalFilterField[]> = {
		leaveRequests: ['status', 'department', 'employee', 'dateRange'],
		overtimeRequests: ['status', 'department', 'employee', 'dateRange'],
		onlineWorkRequests: ['status', 'department', 'employee', 'dateRange'],
		violationRequests: ['status', 'department', 'monthYear'],
		makeupAttendance: ['status', 'department', 'employee', 'dateRange'],
		businessTrips: ['status', 'department', 'employee'],
	};

	const STATUS_OPTIONS: Record<Tab, SelectOption[]> = {
		leaveRequests: [
			{ value: undefined, label: 'Tất cả trạng thái' },
			{ value: 'PENDING', label: 'Chờ duyệt' },
			{ value: 'APPROVED', label: 'Đã duyệt' },
			{ value: 'REJECTED', label: 'Từ chối' },
			{ value: 'CANCELLED', label: 'Đã thu hồi' },
		],
		overtimeRequests: [
			{ value: undefined, label: 'Tất cả trạng thái' },
			{ value: 'PENDING', label: 'Chờ duyệt' },
			{ value: 'APPROVED', label: 'Đã duyệt' },
			{ value: 'REJECTED', label: 'Từ chối' },
			{ value: 'CANCELLED', label: 'Đã thu hồi' },
			{ value: 'AUTO_CANCELLED', label: 'Hết hạn' },
		],
		onlineWorkRequests: [
			{ value: undefined, label: 'Tất cả trạng thái' },
			{ value: 'PENDING_L1', label: 'Chờ cấp 1' },
			{ value: 'PENDING_L2', label: 'Chờ cấp 2' },
			{ value: 'PENDING_L3', label: 'Chờ Giám đốc' },
			{ value: 'COMPLETED', label: 'Hoàn thành' },
			{ value: 'REJECTED', label: 'Từ chối' },
			{ value: 'CANCELLED', label: 'Đã huỷ' },
		],
		violationRequests: VIOLATION_STATUS_OPTIONS,
		makeupAttendance: MAKEUP_STATUS_OPTIONS,
		businessTrips: [
			{ value: undefined, label: 'Tất cả trạng thái' },
			{ value: 'DRAFT', label: 'Nháp' },
			{ value: 'PENDING', label: 'Chờ duyệt' },
			{ value: 'APPROVED', label: 'Đã duyệt' },
			{ value: 'IN_PROGRESS', label: 'Đang công tác' },
			{ value: 'COMPLETED', label: 'Hoàn thành' },
			{ value: 'REJECTED', label: 'Bị từ chối' },
			{ value: 'CANCELLED', label: 'Đã huỷ' },
		],
	};

	const PAGE_SIZE = 15;

	// Trạng thái mặc định = "chờ duyệt". Violation (PENDING / PENDING_L2) và online-work
	// (PENDING_L1/L2/L3) có nhiều mức chờ duyệt mà API chỉ nhận 1 status → để "Tất cả"
	// cho khỏi ẩn mất đơn đang chờ chính mình ở cấp khác.
	const DEFAULT_STATUS: Record<Tab, string | undefined> = {
		leaveRequests: 'PENDING',
		overtimeRequests: 'PENDING',
		onlineWorkRequests: undefined,
		violationRequests: undefined,
		makeupAttendance: 'PENDING',
		businessTrips: 'PENDING',
	};

	// Mặc định: trạng thái chờ duyệt + tháng hiện tại (tab violation dùng month/year)
	function createFilterState(tab: Tab): ApprovalFilterState {
		const now = new Date();
		const fields = FILTER_FIELDS[tab];
		const hasDateRange = fields.includes('dateRange');
		const hasMonthYear = fields.includes('monthYear');
		return {
			status: DEFAULT_STATUS[tab],
			departmentId: undefined,
			employeeId: undefined,
			startDate: hasDateRange ? format(startOfMonth(now), 'yyyy-MM-dd') : '',
			endDate: hasDateRange ? format(endOfMonth(now), 'yyyy-MM-dd') : '',
			month: hasMonthYear ? now.getMonth() + 1 : undefined,
			year: hasMonthYear ? now.getFullYear() : undefined,
			limit: PAGE_SIZE,
		};
	}

	const DEFAULT_FILTERS: Record<Tab, ApprovalFilterState> = {
		leaveRequests: createFilterState('leaveRequests'),
		overtimeRequests: createFilterState('overtimeRequests'),
		onlineWorkRequests: createFilterState('onlineWorkRequests'),
		violationRequests: createFilterState('violationRequests'),
		makeupAttendance: createFilterState('makeupAttendance'),
		businessTrips: createFilterState('businessTrips'),
	};

	const filters = reactive<Record<Tab, ApprovalFilterState>>({
		leaveRequests: { ...DEFAULT_FILTERS.leaveRequests },
		overtimeRequests: { ...DEFAULT_FILTERS.overtimeRequests },
		onlineWorkRequests: { ...DEFAULT_FILTERS.onlineWorkRequests },
		violationRequests: { ...DEFAULT_FILTERS.violationRequests },
		makeupAttendance: { ...DEFAULT_FILTERS.makeupAttendance },
		businessTrips: { ...DEFAULT_FILTERS.businessTrips },
	});

	const activeFilter = computed<ApprovalFilterState>(() => filters[activeTab.value]);
	const activeDefaultFilter = computed<ApprovalFilterState>(() => DEFAULT_FILTERS[activeTab.value]);
	const activeFilterFields = computed<ApprovalFilterField[]>(() => FILTER_FIELDS[activeTab.value]);
	const activeStatusOptions = computed<SelectOption[]>(() => STATUS_OPTIONS[activeTab.value]);

	function onFilterUpdate(value: ApprovalFilterState) {
		filters[activeTab.value] = value;
	}

	function onFilterChange() {
		setPage(activeTab.value, 1);
		loadCurrentTab();
	}

	// ─── Per-module state ─────────────────────────────────────────────────────────
	const leaveList = ref<LeaveRequest[]>([]);
	const leaveMeta = ref<PaginatedMeta | null>(null);
	const leaveLoading = ref(false);
	const leavePage = ref(1);

	const makeupList = ref<MakeupRequestResponse[]>([]);
	const makeupMeta = ref<PaginatedMeta | null>(null);
	const makeupLoading = ref(false);
	const makeupPage = ref(1);

	const violationList = ref<ViolationRequest[]>([]);
	const violationMeta = ref<PaginatedMeta | null>(null);
	const violationLoading = ref(false);
	const violationPage = ref(1);

	const overtimeList = ref<OvertimeRequestResponse[]>([]);
	const overtimeMeta = ref<PaginatedMeta | null>(null);
	const overtimeLoading = ref(false);
	const overtimePage = ref(1);

	const tripList = ref<BusinessTripResponse[]>([]);
	const tripMeta = ref<PaginatedMeta | null>(null);
	const tripLoading = ref(false);
	const tripPage = ref(1);

	const onlineWorkList = ref<OnlineWorkRequestResponse[]>([]);
	const onlineWorkMeta = ref<PaginatedMeta | null>(null);
	const onlineWorkLoading = ref(false);
	const onlineWorkPage = ref(1);

	const pageRefs: Record<Tab, Ref<number>> = {
		leaveRequests: leavePage,
		overtimeRequests: overtimePage,
		onlineWorkRequests: onlineWorkPage,
		violationRequests: violationPage,
		makeupAttendance: makeupPage,
		businessTrips: tripPage,
	};

	function setPage(tab: Tab, page: number) {
		pageRefs[tab].value = page;
	}

	function goToPage(tab: Tab, page: number) {
		setPage(tab, page);
		loadCurrentTab();
	}

	// ─── Fetchers ─────────────────────────────────────────────────────────────────
	async function fetchLeave() {
		leaveLoading.value = true;
		try {
			const f = filters.leaveRequests;
			const params: QueryLeaveRequestParams = {
				page: leavePage.value,
				limit: f.limit,
				status: f.status as LeaveStatus | undefined,
				departmentId: f.departmentId,
				employeeId: f.employeeId,
				startDate: f.startDate || undefined,
				endDate: f.endDate || undefined,
			};
			const res = await approvalService.listLeaveRequests(params);
			leaveList.value = res.data;
			leaveMeta.value = res.meta;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi tải đơn nghỉ phép');
		} finally {
			leaveLoading.value = false;
		}
	}

	async function fetchMakeup() {
		makeupLoading.value = true;
		try {
			const f = filters.makeupAttendance;
			const params: QueryMakeupRequestParams = {
				page: makeupPage.value,
				limit: f.limit,
				status: f.status as MakeupRequestStatus | undefined,
				departmentId: f.departmentId,
				employeeId: f.employeeId,
				startDate: f.startDate || undefined,
				endDate: f.endDate || undefined,
			};
			const res = await approvalService.listMakeupAttendance(params);
			makeupList.value = res.data;
			makeupMeta.value = res.meta;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi tải đơn bù công');
		} finally {
			makeupLoading.value = false;
		}
	}

	async function fetchViolation() {
		violationLoading.value = true;
		try {
			const f = filters.violationRequests;
			const params: QueryViolationRequestParams = {
				page: violationPage.value,
				limit: f.limit,
				status: f.status as ViolationRequestStatus | undefined,
				departmentId: f.departmentId,
				month: f.month,
				year: f.year,
			};
			const res = await approvalService.listViolationRequests(params);
			violationList.value = res.data;
			violationMeta.value = res.meta;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi tải phiếu giải trình');
		} finally {
			violationLoading.value = false;
		}
	}

	async function fetchOvertime() {
		overtimeLoading.value = true;
		try {
			const f = filters.overtimeRequests;
			const params: QueryOvertimeParams = {
				page: overtimePage.value,
				limit: f.limit,
				status: f.status as OvertimeStatus | undefined,
				departmentId: f.departmentId,
				employeeId: f.employeeId,
				startDate: f.startDate || undefined,
				endDate: f.endDate || undefined,
			};
			const res = await approvalService.listOvertimeRequests(params);
			overtimeList.value = res.data;
			overtimeMeta.value = res.meta;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi tải đơn OT');
		} finally {
			overtimeLoading.value = false;
		}
	}

	async function fetchTrip() {
		tripLoading.value = true;
		try {
			const f = filters.businessTrips;
			const params: QueryBusinessTripsParams = {
				page: tripPage.value,
				limit: f.limit,
				status: f.status as BusinessTripStatus | undefined,
				departmentId: f.departmentId,
				employeeId: f.employeeId,
			};
			const res = await approvalService.listBusinessTrips(params);
			tripList.value = res.data;
			tripMeta.value = res.meta;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi tải đơn công tác');
		} finally {
			tripLoading.value = false;
		}
	}

	async function fetchOnlineWork() {
		onlineWorkLoading.value = true;
		try {
			const f = filters.onlineWorkRequests;
			const params: QueryOnlineWorkParams = {
				page: onlineWorkPage.value,
				limit: f.limit,
				status: f.status as OnlineWorkStatus | undefined,
				departmentId: f.departmentId,
				employeeId: f.employeeId,
				startDate: f.startDate || undefined,
				endDate: f.endDate || undefined,
			};
			const res = await approvalService.listOnlineWorkRequests(params);
			onlineWorkList.value = res.data;
			onlineWorkMeta.value = res.meta;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi tải đơn làm online');
		} finally {
			onlineWorkLoading.value = false;
		}
	}

	function loadCurrentTab() {
		switch (activeTab.value) {
			case 'leaveRequests':
				return fetchLeave();
			case 'makeupAttendance':
				return fetchMakeup();
			case 'violationRequests':
				return fetchViolation();
			case 'overtimeRequests':
				return fetchOvertime();
			case 'businessTrips':
				return fetchTrip();
			case 'onlineWorkRequests':
				return fetchOnlineWork();
		}
	}

	// ─── Detail / Reject modals ───────────────────────────────────────────────────
	const leaveDetail = ref<LeaveRequest | null>(null);
	const leaveReject = ref<LeaveRequest | null>(null);
	const leaveApprovingId = ref<number | null>(null);

	const makeupDetail = ref<MakeupRequestResponse | null>(null);
	const makeupReject = ref<MakeupRequestResponse | null>(null);
	const makeupApprovingId = ref<string | null>(null);

	const violationDetail = ref<ViolationRequest | null>(null);
	const violationReject = ref<ViolationRequest | null>(null);
	const violationApprovingId = ref<number | null>(null);

	const overtimeDetail = ref<OvertimeRequestResponse | null>(null);
	const overtimeReject = ref<OvertimeRequestResponse | null>(null);
	const overtimeApprovingId = ref<number | null>(null);

	const tripReject = ref<BusinessTripResponse | null>(null);
	const tripApprovingId = ref<number | null>(null);

	const onlineWorkDetail = ref<OnlineWorkRequestResponse | null>(null);
	const onlineWorkReject = ref<OnlineWorkRequestResponse | null>(null);
	const onlineWorkApprovingId = ref<number | null>(null);

	// ─── Approve / reject / cancel handlers ────────────────────────────────────────
	function removeFromList<T extends { id: number | string }>(list: Ref<T[]>, id: number | string) {
		const idx = list.value.findIndex(x => x.id === id);
		if (idx !== -1) list.value.splice(idx, 1);
	}

	async function refreshBadge() {
		approvalStore.fetchCounts();
	}

	async function approveLeave(req: LeaveRequest) {
		if (!confirm(`Duyệt đơn nghỉ phép của ${req.employee.fullName}?`)) return;
		leaveApprovingId.value = req.id;
		try {
			await leaveService.approve(req.id);
			removeFromList(leaveList, req.id);
			leaveDetail.value = null;
			toast.success('Đã duyệt đơn nghỉ phép');
			refreshBadge();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
		} finally {
			leaveApprovingId.value = null;
		}
	}

	function onLeaveRejected() {
		if (leaveReject.value) removeFromList(leaveList, leaveReject.value.id);
		leaveReject.value = null;
		leaveDetail.value = null;
		refreshBadge();
	}

	async function approveMakeup(req: MakeupRequestResponse) {
		if (!confirm(`Duyệt đơn bù công của ${req.employee.fullName}?`)) return;
		makeupApprovingId.value = req.id;
		try {
			await makeupService.approve(req.id);
			removeFromList(makeupList, req.id);
			makeupDetail.value = null;
			toast.success('Đã duyệt đơn bù công');
			refreshBadge();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
		} finally {
			makeupApprovingId.value = null;
		}
	}

	function onMakeupRejected(updated: MakeupRequestResponse) {
		removeFromList(makeupList, updated.id);
		makeupReject.value = null;
		makeupDetail.value = null;
		refreshBadge();
	}

	async function approveViolation(req: ViolationRequest) {
		const levelSuffix = req.status === 'PENDING_L2' ? ' (Cấp 2)' : req.isMultiLevel ? ' (Cấp 1)' : '';
		if (!confirm(`Duyệt phiếu giải trình của ${req.employee.fullName}${levelSuffix}?`)) return;
		violationApprovingId.value = req.id;
		try {
			const updated = await violationService.approve(req.id);
			// If still awaiting L2, keep it in the list only if current user is also the L2 approver
			if (updated.status === 'PENDING_L2') {
				removeFromList(violationList, req.id);
				toast.success('Đã duyệt cấp 1 — phiếu chuyển lên cấp 2');
			} else {
				removeFromList(violationList, req.id);
				toast.success('Đã duyệt phiếu giải trình');
			}
			violationDetail.value = null;
			refreshBadge();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
		} finally {
			violationApprovingId.value = null;
		}
	}

	function violationApproveLabel(req: ViolationRequest): string {
		if (req.status === 'PENDING') return req.isMultiLevel ? 'Duyệt (Cấp 1)' : 'Duyệt';
		return 'Duyệt (Cấp 2)';
	}

	function onViolationRejected() {
		if (violationReject.value) removeFromList(violationList, violationReject.value.id);
		violationReject.value = null;
		violationDetail.value = null;
		refreshBadge();
	}

	async function approveOvertime(req: OvertimeRequestResponse) {
		if (!confirm(`Duyệt đơn OT của ${req.employee.fullName}?`)) return;
		overtimeApprovingId.value = req.id;
		try {
			await overtimeService.approve(req.id);
			removeFromList(overtimeList, req.id);
			overtimeDetail.value = null;
			toast.success('Đã duyệt đơn OT');
			refreshBadge();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
		} finally {
			overtimeApprovingId.value = null;
		}
	}

	function onOvertimeRejected(updated: OvertimeRequestResponse) {
		removeFromList(overtimeList, updated.id);
		overtimeReject.value = null;
		overtimeDetail.value = null;
		refreshBadge();
	}

	async function approveTrip(trip: BusinessTripResponse) {
		if (!confirm(`Duyệt đơn công tác "${trip.title}"?`)) return;
		tripApprovingId.value = trip.id;
		try {
			await tripService.approve(trip.id);
			removeFromList(tripList, trip.id);
			toast.success('Đã duyệt đơn công tác');
			refreshBadge();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
		} finally {
			tripApprovingId.value = null;
		}
	}

	function onTripRejected(updated: BusinessTripResponse) {
		removeFromList(tripList, updated.id);
		tripReject.value = null;
		refreshBadge();
	}

	async function approveOnlineWork(req: OnlineWorkRequestResponse) {
		if (!confirm(`Duyệt đơn làm online của ${req.employee.fullName}?`)) return;
		onlineWorkApprovingId.value = req.id;
		try {
			await onlineWorkService.approve(req.id);
			removeFromList(onlineWorkList, req.id);
			onlineWorkDetail.value = null;
			toast.success('Đã duyệt đơn làm online');
			refreshBadge();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
		} finally {
			onlineWorkApprovingId.value = null;
		}
	}

	function onOnlineWorkRejected(updated: OnlineWorkRequestResponse) {
		removeFromList(onlineWorkList, updated.id);
		onlineWorkReject.value = null;
		onlineWorkDetail.value = null;
		refreshBadge();
	}

	// ─── Helpers ───────────────────────────────────────────────────────────────────
	function fmtDate(d: string) {
		return format(new Date(d), 'dd/MM/yyyy');
	}

	function fmtTime(iso: string | null) {
		if (!iso) return '—';
		return format(new Date(iso), 'HH:mm');
	}

	function truncate(text: string | null, len = 55) {
		if (!text) return '—';
		return text.length > len ? text.slice(0, len) + '…' : text;
	}

	function tabCount(key: Tab): number {
		return counts.value[key] ?? 0;
	}

	// "1–20" cho dòng tổng kết dưới bảng
	function rangeText(meta: PaginatedMeta): string {
		const from = (meta.page - 1) * meta.limit + 1;
		const to = Math.min(meta.page * meta.limit, meta.total);
		return `${from}–${to}`;
	}

	// ─── Lifecycle ─────────────────────────────────────────────────────────────────
	onMounted(async () => {
		approvalStore.fetchCounts();
		loadCurrentTab();
		try {
			await directoryStore.load();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi tải danh sách nhân viên / phòng ban');
		}
	});
</script>

<template>
	<div class="space-y-5">
		<!-- Page header -->
		<div>
			<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Hộp thư phê duyệt</h1>
			<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
				Danh sách các đơn từ đang chờ bạn phê duyệt — tổng cộng
				<strong class="text-gray-700 dark:text-gray-300">{{ counts.total }}</strong> đơn
			</p>
		</div>

		<!-- Tabs -->
		<div class="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit overflow-x-auto max-w-full">
			<button
				v-for="tab in tabs"
				:key="tab.key"
				class="flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap"
				:class="
					activeTab === tab.key
						? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
						: 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
				"
				@click="activeTab = tab.key"
			>
				{{ tab.label }}
				<span
					v-if="tabCount(tab.key) > 0"
					class="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
				>
					{{ tabCount(tab.key) }}
				</span>
			</button>
		</div>

		<!-- Filter bar — field hiển thị theo tab đang mở -->
		<ApprovalFilterBar
			:model-value="activeFilter"
			:default-value="activeDefaultFilter"
			:fields="activeFilterFields"
			:status-options="activeStatusOptions"
			@update:model-value="onFilterUpdate"
			@change="onFilterChange"
		/>

		<!-- ══════════════════════════════ Nghỉ phép ══════════════════════════════ -->
		<template v-if="activeTab === 'leaveRequests'">
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Nhân viên</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Loại phép</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Thời gian</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Lý do</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Trạng thái</th>
								<th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Thao tác</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
							<tr v-if="leaveLoading">
								<td colspan="6" class="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">Đang tải…</td>
							</tr>
							<tr v-else-if="leaveList.length === 0">
								<td colspan="6" class="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
									Không có đơn nghỉ phép chờ duyệt
								</td>
							</tr>
							<tr v-for="req in leaveList" :key="req.id" class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
								<td class="px-4 py-3">
									<p class="font-medium text-gray-900 dark:text-white">{{ req.employee.fullName }}</p>
									<p class="text-xs text-gray-400 dark:text-gray-500">{{ req.employee.employeeCode }}</p>
								</td>
								<td class="px-4 py-3 text-gray-700 dark:text-gray-300">{{ req.leaveType.name }}</td>
								<td class="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
									{{ fmtDate(req.startDate) }}
									<template v-if="req.startDate !== req.endDate"> → {{ fmtDate(req.endDate) }}</template>
									<p v-if="req.totalDays > 0" class="text-xs text-gray-400 mt-0.5">{{ req.totalDays }} ngày</p>
								</td>
								<td class="px-4 py-3 max-w-[240px] text-gray-600 dark:text-gray-400">{{ truncate(req.reason) }}</td>
								<td class="px-4 py-3"><LeaveStatusBadge :status="req.status" /></td>
								<td class="px-4 py-3">
									<div class="flex items-center justify-end gap-1.5">
										<template v-if="req.status === 'PENDING'">
											<CommonAppButton size="sm" variant="primary" :loading="leaveApprovingId === req.id" @click="approveLeave(req)">Duyệt</CommonAppButton>
											<CommonAppButton size="sm" variant="danger" @click="leaveReject = req">Từ chối</CommonAppButton>
										</template>
										<button
											class="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
											title="Xem chi tiết"
											@click="leaveDetail = req"
										>
											<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
												<path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
												<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
											</svg>
										</button>
									</div>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
			<div v-if="leaveMeta && leaveMeta.total > 0" class="flex flex-wrap items-center justify-between gap-3 pt-1">
				<p class="text-sm text-gray-500 dark:text-gray-400">
					Hiển thị <strong class="text-gray-700 dark:text-gray-300">{{ rangeText(leaveMeta) }}</strong> trên tổng
					<strong class="text-gray-700 dark:text-gray-300">{{ leaveMeta.total }}</strong> đơn
				</p>
				<CommonAppPagination
					v-if="leaveMeta.totalPages > 1"
					:current-page="leavePage"
					:total-pages="leaveMeta.totalPages"
					@update:current-page="p => goToPage('leaveRequests', p)"
				/>
			</div>
		</template>

		<!-- ══════════════════════════════ Làm thêm giờ ══════════════════════════════ -->
		<template v-else-if="activeTab === 'overtimeRequests'">
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Nhân viên</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Ngày OT</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Thời gian</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Lý do</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Trạng thái</th>
								<th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Thao tác</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
							<tr v-if="overtimeLoading">
								<td colspan="6" class="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">Đang tải…</td>
							</tr>
							<tr v-else-if="overtimeList.length === 0">
								<td colspan="6" class="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
									Không có đơn OT chờ duyệt
								</td>
							</tr>
							<tr v-for="req in overtimeList" :key="req.id" class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
								<td class="px-4 py-3">
									<p class="font-medium text-gray-900 dark:text-white">{{ req.employee.fullName }}</p>
									<p class="text-xs text-gray-400 dark:text-gray-500">{{ req.employee.employeeCode }}</p>
								</td>
								<td class="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
									{{ fmtDate(req.startTime) }}
									<span
										v-if="fmtDate(req.startTime) !== fmtDate(req.endTime)"
										class="text-xs font-normal text-gray-400"
									>
										→ {{ fmtDate(req.endTime) }}
									</span>
								</td>
								<td class="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
									{{ fmtTime(req.startTime) }} → {{ fmtTime(req.endTime) }}
									<p class="text-xs text-gray-400 mt-0.5">{{ req.hoursDisplay }}</p>
								</td>
								<td class="px-4 py-3 max-w-[240px] text-gray-600 dark:text-gray-400">{{ truncate(req.reason) }}</td>
								<td class="px-4 py-3"><OvertimeStatusBadge :status="req.status" /></td>
								<td class="px-4 py-3">
									<div class="flex items-center justify-end gap-1.5">
										<template v-if="req.status === 'PENDING'">
											<CommonAppButton size="sm" variant="primary" :loading="overtimeApprovingId === req.id" @click="approveOvertime(req)">Duyệt</CommonAppButton>
											<CommonAppButton size="sm" variant="danger" @click="overtimeReject = req">Từ chối</CommonAppButton>
										</template>
										<button
											class="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
											title="Xem chi tiết"
											@click="overtimeDetail = req"
										>
											<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
												<path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
												<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
											</svg>
										</button>
									</div>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
			<div v-if="overtimeMeta && overtimeMeta.total > 0" class="flex flex-wrap items-center justify-between gap-3 pt-1">
				<p class="text-sm text-gray-500 dark:text-gray-400">
					Hiển thị <strong class="text-gray-700 dark:text-gray-300">{{ rangeText(overtimeMeta) }}</strong> trên tổng
					<strong class="text-gray-700 dark:text-gray-300">{{ overtimeMeta.total }}</strong> đơn
				</p>
				<CommonAppPagination
					v-if="overtimeMeta.totalPages > 1"
					:current-page="overtimePage"
					:total-pages="overtimeMeta.totalPages"
					@update:current-page="p => goToPage('overtimeRequests', p)"
				/>
			</div>
		</template>

		<!-- ══════════════════════════════ Làm online ══════════════════════════════ -->
		<template v-else-if="activeTab === 'onlineWorkRequests'">
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Nhân viên</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Thời gian</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Lý do</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Trạng thái</th>
								<th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Thao tác</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
							<tr v-if="onlineWorkLoading">
								<td colspan="5" class="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">Đang tải…</td>
							</tr>
							<tr v-else-if="onlineWorkList.length === 0">
								<td colspan="5" class="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
									Không có đơn làm online chờ duyệt
								</td>
							</tr>
							<tr v-for="req in onlineWorkList" :key="req.id" class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
								<td class="px-4 py-3">
									<p class="font-medium text-gray-900 dark:text-white">{{ req.employee.fullName }}</p>
									<p class="text-xs text-gray-400 dark:text-gray-500">{{ req.employee.employeeCode }}</p>
								</td>
								<td class="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
									{{ fmtDate(req.startDate) }}
									<template v-if="req.startDate !== req.endDate"> → {{ fmtDate(req.endDate) }}</template>
									<p class="text-xs text-gray-400 mt-0.5">{{ req.totalDays }} ngày</p>
								</td>
								<td class="px-4 py-3 max-w-[240px] text-gray-600 dark:text-gray-400">{{ truncate(req.reason) }}</td>
								<td class="px-4 py-3"><OnlineWorkStatusBadge :status="req.status" :reject-level="req.rejectLevel" /></td>
								<td class="px-4 py-3">
									<div class="flex items-center justify-end gap-1.5">
										<template v-if="req.status.startsWith('PENDING')">
											<CommonAppButton size="sm" variant="primary" :loading="onlineWorkApprovingId === req.id" @click="approveOnlineWork(req)">Duyệt</CommonAppButton>
											<CommonAppButton size="sm" variant="danger" @click="onlineWorkReject = req">Từ chối</CommonAppButton>
										</template>
										<button
											class="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
											title="Xem chi tiết"
											@click="onlineWorkDetail = req"
										>
											<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
												<path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
												<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
											</svg>
										</button>
									</div>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
			<div v-if="onlineWorkMeta && onlineWorkMeta.total > 0" class="flex flex-wrap items-center justify-between gap-3 pt-1">
				<p class="text-sm text-gray-500 dark:text-gray-400">
					Hiển thị <strong class="text-gray-700 dark:text-gray-300">{{ rangeText(onlineWorkMeta) }}</strong> trên tổng
					<strong class="text-gray-700 dark:text-gray-300">{{ onlineWorkMeta.total }}</strong> đơn
				</p>
				<CommonAppPagination
					v-if="onlineWorkMeta.totalPages > 1"
					:current-page="onlineWorkPage"
					:total-pages="onlineWorkMeta.totalPages"
					@update:current-page="p => goToPage('onlineWorkRequests', p)"
				/>
			</div>
		</template>

		<!-- ══════════════════════════════ Vi phạm ══════════════════════════════ -->
		<template v-else-if="activeTab === 'violationRequests'">
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Nhân viên</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Loại vi phạm</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Ngày</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Lý do</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Trạng thái</th>
								<th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Thao tác</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
							<tr v-if="violationLoading">
								<td colspan="6" class="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">Đang tải…</td>
							</tr>
							<tr v-else-if="violationList.length === 0">
								<td colspan="6" class="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
									Không có phiếu giải trình chờ duyệt
								</td>
							</tr>
							<tr v-for="req in violationList" :key="req.id" class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
								<td class="px-4 py-3">
									<p class="font-medium text-gray-900 dark:text-white">{{ req.employee.fullName }}</p>
									<p class="text-xs text-gray-400 dark:text-gray-500">{{ req.employee.employeeCode }}</p>
								</td>
								<td class="px-4 py-3 text-gray-700 dark:text-gray-300">{{ req.typeLabel }}</td>
								<td class="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{{ fmtDate(req.violationDate) }}</td>
								<td class="px-4 py-3 max-w-[240px] text-gray-600 dark:text-gray-400">{{ truncate(req.reason) }}</td>
								<td class="px-4 py-3">
									<div class="flex items-center gap-1.5 flex-wrap">
										<ViolationStatusBadge :status="req.status" />
										<span
											v-if="req.status === 'PENDING'"
											class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
										>Cấp 1</span>
										<span
											v-else-if="req.status === 'PENDING_L2'"
											class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
										>Cấp 2</span>
									</div>
								</td>
								<td class="px-4 py-3">
									<div class="flex items-center justify-end gap-1.5">
										<template v-if="req.status === 'PENDING' || req.status === 'PENDING_L2'">
											<CommonAppButton size="sm" variant="primary" :loading="violationApprovingId === req.id" @click="approveViolation(req)">
												{{ violationApproveLabel(req) }}
											</CommonAppButton>
											<CommonAppButton size="sm" variant="danger" @click="violationReject = req">Từ chối</CommonAppButton>
										</template>
										<button
											class="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
											title="Xem chi tiết"
											@click="violationDetail = req"
										>
											<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
												<path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
												<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
											</svg>
										</button>
									</div>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
			<div v-if="violationMeta && violationMeta.total > 0" class="flex flex-wrap items-center justify-between gap-3 pt-1">
				<p class="text-sm text-gray-500 dark:text-gray-400">
					Hiển thị <strong class="text-gray-700 dark:text-gray-300">{{ rangeText(violationMeta) }}</strong> trên tổng
					<strong class="text-gray-700 dark:text-gray-300">{{ violationMeta.total }}</strong> phiếu
				</p>
				<CommonAppPagination
					v-if="violationMeta.totalPages > 1"
					:current-page="violationPage"
					:total-pages="violationMeta.totalPages"
					@update:current-page="p => goToPage('violationRequests', p)"
				/>
			</div>
		</template>

		<!-- ══════════════════════════════ Bù công ══════════════════════════════ -->
		<template v-else-if="activeTab === 'makeupAttendance'">
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Nhân viên</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Ngày công</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Giờ đề nghị</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Lý do</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Trạng thái</th>
								<th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Thao tác</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
							<tr v-if="makeupLoading">
								<td colspan="6" class="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">Đang tải…</td>
							</tr>
							<tr v-else-if="makeupList.length === 0">
								<td colspan="6" class="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
									Không có đơn bù công chờ duyệt
								</td>
							</tr>
							<tr v-for="req in makeupList" :key="req.id" class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
								<td class="px-4 py-3">
									<p class="font-medium text-gray-900 dark:text-white">{{ req.employee.fullName }}</p>
									<p class="text-xs text-gray-400 dark:text-gray-500">{{ req.employee.employeeCode }}</p>
								</td>
								<td class="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{{ fmtDate(req.attendanceDate) }}</td>
								<td class="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
									{{ fmtTime(req.requestedCheckIn) }} → {{ fmtTime(req.requestedCheckOut) }}
								</td>
								<td class="px-4 py-3 max-w-[240px] text-gray-600 dark:text-gray-400">{{ truncate(req.reason) }}</td>
								<td class="px-4 py-3"><MakeupStatusBadge :status="req.status" /></td>
								<td class="px-4 py-3">
									<div class="flex items-center justify-end gap-1.5">
										<template v-if="req.status === 'PENDING'">
											<CommonAppButton size="sm" variant="primary" :loading="makeupApprovingId === req.id" @click="approveMakeup(req)">Duyệt</CommonAppButton>
											<CommonAppButton size="sm" variant="danger" @click="makeupReject = req">Từ chối</CommonAppButton>
										</template>
										<button
											class="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
											title="Xem chi tiết"
											@click="makeupDetail = req"
										>
											<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
												<path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
												<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
											</svg>
										</button>
									</div>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
			<div v-if="makeupMeta && makeupMeta.total > 0" class="flex flex-wrap items-center justify-between gap-3 pt-1">
				<p class="text-sm text-gray-500 dark:text-gray-400">
					Hiển thị <strong class="text-gray-700 dark:text-gray-300">{{ rangeText(makeupMeta) }}</strong> trên tổng
					<strong class="text-gray-700 dark:text-gray-300">{{ makeupMeta.total }}</strong> đơn
				</p>
				<CommonAppPagination
					v-if="makeupMeta.totalPages > 1"
					:current-page="makeupPage"
					:total-pages="makeupMeta.totalPages"
					@update:current-page="p => goToPage('makeupAttendance', p)"
				/>
			</div>
		</template>

		<!-- ══════════════════════════════ Công tác ══════════════════════════════ -->
		<template v-else-if="activeTab === 'businessTrips'">
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Nhân viên</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Tiêu đề</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Điểm đến</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Thời gian</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Trạng thái</th>
								<th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Thao tác</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
							<tr v-if="tripLoading">
								<td colspan="6" class="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">Đang tải…</td>
							</tr>
							<tr v-else-if="tripList.length === 0">
								<td colspan="6" class="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
									Không có đơn công tác chờ duyệt
								</td>
							</tr>
							<tr v-for="trip in tripList" :key="trip.id" class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
								<td class="px-4 py-3">
									<p class="font-medium text-gray-900 dark:text-white">{{ trip.employee.fullName }}</p>
									<p class="text-xs text-gray-400 dark:text-gray-500">{{ trip.employee.employeeCode }}</p>
								</td>
								<td class="px-4 py-3 max-w-[220px] text-gray-700 dark:text-gray-300">{{ trip.title }}</td>
								<td class="px-4 py-3 text-gray-700 dark:text-gray-300">{{ trip.destination }}</td>
								<td class="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
									{{ fmtDate(trip.startDate) }} → {{ fmtDate(trip.endDate) }}
									<p class="text-xs text-gray-400 mt-0.5">{{ trip.totalDays }} ngày</p>
								</td>
								<td class="px-4 py-3"><TripStatusBadge :status="trip.status" /></td>
								<td class="px-4 py-3">
									<div class="flex items-center justify-end gap-1.5">
										<template v-if="trip.canApprove && trip.status === 'PENDING'">
											<CommonAppButton size="sm" variant="primary" :loading="tripApprovingId === trip.id" @click="approveTrip(trip)">Duyệt</CommonAppButton>
											<CommonAppButton size="sm" variant="danger" @click="tripReject = trip">Từ chối</CommonAppButton>
										</template>
										<NuxtLink
											:to="`/business-trips/${trip.id}`"
											class="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
											title="Xem chi tiết"
										>
											<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
												<path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
												<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
											</svg>
										</NuxtLink>
									</div>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
			<div v-if="tripMeta && tripMeta.total > 0" class="flex flex-wrap items-center justify-between gap-3 pt-1">
				<p class="text-sm text-gray-500 dark:text-gray-400">
					Hiển thị <strong class="text-gray-700 dark:text-gray-300">{{ rangeText(tripMeta) }}</strong> trên tổng
					<strong class="text-gray-700 dark:text-gray-300">{{ tripMeta.total }}</strong> đơn
				</p>
				<CommonAppPagination
					v-if="tripMeta.totalPages > 1"
					:current-page="tripPage"
					:total-pages="tripMeta.totalPages"
					@update:current-page="p => goToPage('businessTrips', p)"
				/>
			</div>
		</template>
	</div>

	<!-- ─── Modals ───────────────────────────────────────────────────────────── -->
	<Teleport to="body">
		<!-- Leave -->
		<LeaveDetailModal
			v-if="leaveDetail"
			:leave-request="leaveDetail"
			:approving="leaveApprovingId === leaveDetail.id"
			@approve="approveLeave(leaveDetail)"
			@reject="leaveReject = leaveDetail; leaveDetail = null"
			@close="leaveDetail = null"
		/>
		<RejectModal
			v-if="leaveReject"
			:leave-request="leaveReject"
			@rejected="onLeaveRejected"
			@close="leaveReject = null"
		/>

		<!-- Makeup -->
		<MakeupDetailModal
			v-if="makeupDetail"
			:request="makeupDetail"
			:can-review="makeupDetail.status === 'PENDING'"
			:approving="makeupApprovingId === makeupDetail.id"
			@approve="approveMakeup(makeupDetail)"
			@reject="makeupReject = makeupDetail; makeupDetail = null"
			@close="makeupDetail = null"
		/>
		<MakeupRejectModal
			v-if="makeupReject"
			:request="makeupReject"
			@rejected="onMakeupRejected"
			@close="makeupReject = null"
		/>

		<!-- Violation -->
		<ViolationDetailModal
			v-if="violationDetail"
			:violation-request="violationDetail"
			:approving="violationApprovingId === violationDetail.id"
			@approve="approveViolation(violationDetail)"
			@reject="violationReject = violationDetail; violationDetail = null"
			@close="violationDetail = null"
		/>
		<ViolationRejectModal
			v-if="violationReject"
			:violation-request="violationReject"
			@rejected="onViolationRejected"
			@close="violationReject = null"
		/>

		<!-- Overtime -->
		<OvertimeDetailModal v-if="overtimeDetail" :request="overtimeDetail" @close="overtimeDetail = null" />
		<RejectOvertimeModal
			v-if="overtimeReject"
			:request="overtimeReject"
			@rejected="onOvertimeRejected"
			@close="overtimeReject = null"
		/>

		<!-- Business trip -->
		<RejectTripModal
			v-if="tripReject"
			:trip="tripReject"
			@rejected="onTripRejected"
			@close="tripReject = null"
		/>

		<!-- Online work -->
		<OnlineWorkDetailModal
			v-if="onlineWorkDetail"
			:request="onlineWorkDetail"
			:approving="onlineWorkApprovingId === onlineWorkDetail.id"
			@approve="approveOnlineWork(onlineWorkDetail)"
			@reject="onlineWorkReject = onlineWorkDetail; onlineWorkDetail = null"
			@close="onlineWorkDetail = null"
		/>
		<RejectOnlineWorkModal
			v-if="onlineWorkReject"
			:request="onlineWorkReject"
			@rejected="onOnlineWorkRejected"
			@close="onlineWorkReject = null"
		/>
	</Teleport>
</template>
