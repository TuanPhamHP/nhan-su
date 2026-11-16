<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { formatDate, formatDateTime, todayYmd } from '~/utils/date';
	import {
		GENDER_LABELS,
		TERMINATION_REASON_LABELS,
		type EmployeeSummary,
		type EmploymentType,
		type GenderCode,
		type TerminationReason,
		type UpdateEmployeeDto,
	} from '~/types/employee.types';
	import type { UserRole } from '~/types/auth.types';
	import { usePositionService } from '~/services/position.service';
	import { useEmployeeService } from '~/services/employee.service';
	import type { PositionSummary } from '~/types/position.types';
	import EmployeeEmployeeStatusBadge from '@/components/modules/employee/EmployeeStatusBadge.vue';
	import EmployeeContracts from '~/components/modules/employee/EmployeeContracts.vue';
	import EmployeeSocialInsurance from '~/components/modules/employee/EmployeeSocialInsurance.vue';
	import EmployeeCitizenId from '~/components/modules/employee/EmployeeCitizenId.vue';
	import EmployeePassport from '~/components/modules/employee/EmployeePassport.vue';
	import EmploymentTypeBadge from '~/components/modules/employee/EmploymentTypeBadge.vue';
	import EmployeeAssets from '~/components/modules/asset/EmployeeAssets.vue';
	import EmployeeExtraProfile from '~/components/modules/employee/EmployeeExtraProfile.vue';
	import EmployeeBankTax from '~/components/modules/employee/EmployeeBankTax.vue';
	import EmployeeWorkExperiences from '~/components/modules/employee/EmployeeWorkExperiences.vue';
	import EmployeeRelatives from '~/components/modules/employee/EmployeeRelatives.vue';
	import EmployeeDocuments from '~/components/modules/employee/EmployeeDocuments.vue';
	import { useAssetService } from '~/services/asset.service';
	import type { AssetAssignment } from '~/types/asset.types';

	definePageMeta({ title: 'Chi tiết nhân viên' });

	const route = useRoute();
	const router = useRouter();
	const toast = useToast();
	const id = Number(route.params.id);
	const authStore = useAuthStore();
	const imageViewer = useImageViewerStore();
	const { hasPermission } = usePermissions();
	const { canUse, canWrite } = useModuleAccess();

	function openAvatar(url: string) {
		imageViewer.open([url], 0);
	}

	// canEdit (role-based) giữ nguyên chỉ cho "Reset mật khẩu" — feature riêng của HR/ADMIN.
	const canEdit = computed(() => authStore.user?.role === 'HR' || authStore.user?.role === 'ADMIN');
	const canUpdate = computed(() => hasPermission('employee:update'));
	const canDelete = computed(() => hasPermission('employee:delete'));
	// Thủ tục nghỉ việc tách khỏi khóa tài khoản: quyền riêng `employee:terminate`, BE KHÔNG
	// tick sẵn cho vai trò nào (chỉ ADMIN bypass) → không có quyền thì ẩn hẳn nút.
	const canTerminate = computed(() => hasPermission('employee:terminate'));
	// Lô 3a: ngân hàng, mã số thuế, thân nhân và giấy tờ nhạy cảm của người khác nằm sau quyền
	// riêng, và mỗi lần xem được ghi vào nhật ký. Không có quyền thì ẩn hẳn nút Xem và tab Thân
	// nhân, thay vì để người dùng bấm rồi nhận 403.
	const canReadPrivate = computed(() => hasPermission('employee:private:read'));
	// Tab Hợp đồng lộ cả lương cơ bản → phải theo đúng quyền, không chỉ theo vai trò.
	// BE đã chặn (contract:read), đây là để không hiện tab rồi mới báo lỗi.
	// Hai tab này thuộc module CONTRACT_INSURANCE: công ty chưa mở thì ẩn, kể cả với ADMIN.
	const canReadContracts = computed(() => canUse('CONTRACT_INSURANCE') && hasPermission('contract:read'));
	// Tab BHXH lộ mức lương tham gia bảo hiểm + mã số thuế. BE chặn bằng
	// `social-insurance:read` (chỉ HR theo master list).
	const canReadSocialInsurance = computed(
		() => canUse('CONTRACT_INSURANCE') && hasPermission('social-insurance:read'),
	);
	// Tab Tài sản thuộc module ASSET: công ty chưa mở thì ẩn, kể cả với ADMIN.
	const canReadAssets = computed(() => canUse('ASSET') && hasPermission('asset:read'));
	const canManageAssets = computed(() => canWrite('ASSET') && hasPermission('asset:manage'));

	const { currentEmployee, detailLoading, fetchOne, update, deactivate, terminate, resetPassword } = useEmployee();
	const { departments, fetchAll: fetchDepartments } = useDepartment();
	const positionService = usePositionService();
	const employeeService = useEmployeeService();

	const positions = ref<PositionSummary[]>([]);
	const allEmployees = ref<EmployeeSummary[]>([]);

	async function loadAllEmployees() {
		try {
			const res = await employeeService.findAll({ pagination: false, status: 'ACTIVE' });
			allEmployees.value = res.data;
		} catch {
			allEmployees.value = [];
		}
	}

	async function loadPositions(departmentId?: number) {
		try {
			positions.value = await positionService.findActive(departmentId);
		} catch {
			positions.value = [];
		}
	}

	const validTabs = [
		'info',
		'relatives',
		'documents',
		'contracts',
		'social-insurance',
		'identity',
		'assets',
	] as const;
	type TabId = (typeof validTabs)[number];
	function initialTab(): TabId {
		const requested = route.query.tab as TabId;
		if (!validTabs.includes(requested)) return 'info';
		// Chặn cả deep-link `?tab=contracts` của người không có quyền.
		if (requested === 'contracts' && !canReadContracts.value) return 'info';
		if (requested === 'social-insurance' && !canReadSocialInsurance.value) return 'info';
		if (requested === 'assets' && !canReadAssets.value) return 'info';
		if (requested === 'relatives' && !canReadPrivate.value) return 'info';
		return requested;
	}
	const activeTab = ref<TabId>(initialTab());
	// Module bị tắt ngay lúc đang mở tab của nó (biết được khi API trả `MODULE_*`): về tab Thông tin.
	watch(
		[canReadContracts, canReadSocialInsurance, canReadAssets, canReadPrivate],
		([contracts, socialInsurance, assets, priv]) => {
			if (
				(activeTab.value === 'contracts' && !contracts) ||
				(activeTab.value === 'social-insurance' && !socialInsurance) ||
				(activeTab.value === 'assets' && !assets) ||
				(activeTab.value === 'relatives' && !priv)
			) {
				activeTab.value = 'info';
			}
		},
	);
	// Không auto-enter edit mode khi user không có employee:update.
	const isEditing = ref(route.query.edit === 'true' && canUpdate.value);
	const confirmDeactivate = ref(false);
	const deactivating = ref(false);
	// Ngày nghỉ việc nhập ở dialog KHÓA TÀI KHOẢN — default hôm nay, bỏ trống thì BE lấy ngày hiện tại.
	// KHÔNG tự validate theo joinDate ở FE; BE là nơi trả 400 và FE chỉ hiện message đó.
	const terminationDateInput = ref<string | undefined>(todayYmd());
	watch(confirmDeactivate, open => {
		if (open) terminationDateInput.value = todayYmd();
	});
	const confirmResetPassword = ref(false);
	const resettingPassword = ref(false);

	// ─── Form xác nhận nghỉ việc ─────────────────────────────────────────────────
	const showTerminateModal = ref(false);
	const terminating = ref(false);
	const terminateForm = reactive({
		date: '' as string | undefined,
		note: '',
		// Lô 3a bắt buộc lý do nghỉ việc; để trống thì nút gửi bị chặn ngay ở đây.
		reason: '' as TerminationReason | '',
	});
	const TERMINATION_NOTE_MAX = 1000;
	const terminationReasonOptions = Object.entries(TERMINATION_REASON_LABELS).map(([value, label]) => ({
		value,
		label,
	}));
	// Nhân sự đã nghỉ → cùng form này dùng để SỬA ngày/lý do (BE trả 200, không phải 400).
	const isTerminated = computed(() => currentEmployee.value?.status === 'INACTIVE');
	const terminateLabel = computed(() => (isTerminated.value ? 'Sửa thông tin nghỉ việc' : 'Xác nhận nghỉ việc'));
	const canSubmitTerminate = computed(
		() => !!terminateForm.date && !!terminateForm.reason && terminateForm.note.trim().length > 0,
	);

	// ─── Cảnh báo tài sản khi cho nghỉ việc ───────────────────────────────────────
	//
	// Chỉ cảnh báo, KHÔNG chặn cho nghỉ: BE vẫn cho nghỉ và tự gửi thông báo N-09 cho
	// người quản lý tài sản. Module tắt hay không có `asset:read` thì bỏ qua hẳn bước này,
	// đừng hiện lỗi — đó là tính năng phụ của một hộp thoại đang làm việc khác.
	const assetService = useAssetService();
	const openAssets = ref<AssetAssignment[]>([]);
	const loadingOpenAssets = ref(false);
	const returningOpenAssets = ref(false);
	/**
	 * Kiểm tài sản lỗi (mất mạng, máy chủ lỗi) thì KHÔNG được lặng lẽ ẩn khối cảnh báo: HR sẽ cho
	 * nghỉ mà không biết nhân viên còn giữ tài sản. Lỗi do không có quyền thì đã bị chặn từ
	 * `canReadAssets` ở trên nên không rơi vào đây.
	 */
	const openAssetsError = ref(false);
	/** Thu hồi tất cả từ hộp nghỉ việc cũng phải hỏi lại, giống nút cùng tên ở tab Tài sản. */
	const confirmReturnAllOpen = ref(false);

	async function loadOpenAssets() {
		openAssetsError.value = false;
		if (!canReadAssets.value) {
			openAssets.value = [];
			return;
		}
		loadingOpenAssets.value = true;
		try {
			openAssets.value = await assetService.findEmployeeAssets(id, true);
		} catch {
			openAssets.value = [];
			openAssetsError.value = true;
		} finally {
			loadingOpenAssets.value = false;
		}
	}

	async function returnAllOpenAssets() {
		if (returningOpenAssets.value) return;
		returningOpenAssets.value = true;
		try {
			const count = await assetService.returnAllEmployeeAssets(id);
			const name = currentEmployee.value?.fullName ?? 'nhân viên này';
			toast.success(`Đã thu hồi ${count} tài sản của ${name}.`);
			confirmReturnAllOpen.value = false;
			await loadOpenAssets();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa thu hồi được. Bạn thử lại sau ít phút.');
		} finally {
			returningOpenAssets.value = false;
		}
	}

	function openTerminateModal() {
		terminateForm.date = currentEmployee.value?.terminationDate ?? todayYmd();
		terminateForm.note = currentEmployee.value?.terminationNote ?? '';
		terminateForm.reason = currentEmployee.value?.terminationReason ?? '';
		showTerminateModal.value = true;
		loadOpenAssets();
	}

	async function handleTerminate() {
		if (!canSubmitTerminate.value || !terminateForm.date || !terminateForm.reason) return;
		// Chốt trước khi gọi: sau khi thành công `currentEmployee` đã là INACTIVE nên
		// `isTerminated` luôn true, đọc sau sẽ ra nhầm thông báo.
		const wasTerminated = isTerminated.value;
		terminating.value = true;
		try {
			await terminate(id, {
				terminationDate: terminateForm.date,
				terminationNote: terminateForm.note.trim(),
				terminationReason: terminateForm.reason,
			});
			toast.success(wasTerminated ? 'Đã cập nhật thông tin nghỉ việc' : 'Đã xác nhận nghỉ việc');
			showTerminateModal.value = false;
		} catch (e) {
			// Lỗi BE (ngày < ngày vào làm, 403…) → toast, modal CỐ Ý không đóng để sửa lại.
			toast.error(e instanceof Error ? e.message : 'Lỗi xác nhận nghỉ việc');
		} finally {
			terminating.value = false;
		}
	}

	/**
	 * Câu BE trả khi hồ sơ ngoài phạm vi xem (lô 3a thu hẹp phạm vi trưởng phòng về phòng mình).
	 *
	 * Giữ lại để màn hình nói đúng chuyện thay vì "Không tìm thấy nhân viên": người xem không
	 * làm gì sai, chỉ là hồ sơ này không thuộc phòng mình.
	 */
	const loadError = ref<string | null>(null);

	onMounted(async () => {
		await Promise.all([
			fetchOne(id).catch((e: unknown) => {
				const message = e instanceof Error ? e.message : 'Không tải được thông tin nhân viên';
				loadError.value = message;
				toast.error(message);
			}),
			fetchDepartments(),
			loadPositions(),
			loadAllEmployees(),
		]);
		if (isEditing.value) resetFormFromEmployee();
	});

	// ─── Form ────────────────────────────────────────────────────────────────────

	const { handleSubmit, defineField, errors, isSubmitting, resetForm } = useForm<{
		fullName: string;
		phone: string;
		joinDate: string;
		role: UserRole;
		employmentType: EmploymentType | '';
		departmentId: number | undefined;
		positionId: number | undefined;
		managerId: number | undefined;
		gender: GenderCode | '';
		dateOfBirth: string;
		address: string;
		effectiveDate: string;
		historyNote: string;
	}>({
		validationSchema: {
			fullName: (v: string) => (v && v.trim().length >= 2 ? true : 'Tối thiểu 2 ký tự'),
			phone: (v: string) => (!v || /^[0-9]{9,11}$/.test(v) ? true : 'Số điện thoại không hợp lệ (9-11 chữ số)'),
		},
	});

	const [fullName, fullNameAttrs] = defineField('fullName');
	const [phone, phoneAttrs] = defineField('phone');
	const [joinDate] = defineField('joinDate');
	const [role] = defineField('role');
	const [employmentType] = defineField('employmentType');
	const [departmentId] = defineField('departmentId');
	const [positionId] = defineField('positionId');
	const [managerId] = defineField('managerId');
	const [gender] = defineField('gender');

	watch(departmentId, val => {
		positionId.value = undefined;
		loadPositions(val as number | undefined);
	});
	const [dateOfBirth] = defineField('dateOfBirth');
	const [address, addressAttrs] = defineField('address');
	const [effectiveDate] = defineField('effectiveDate');
	const [historyNote, historyNoteAttrs] = defineField('historyNote');

	function resetFormFromEmployee() {
		const emp = currentEmployee.value;
		if (!emp) return;
		const deptId = emp.department?.id ?? undefined;
		resetForm({
			values: {
				fullName: emp.fullName,
				phone: emp.phone ?? '',
				joinDate: emp.joinDate,
				role: emp.role,
				employmentType: emp.employmentType ?? 'FULL_TIME',
				departmentId: deptId,
				positionId: emp.position?.id ?? undefined,
				managerId: emp.manager?.id ?? undefined,
				gender: emp.genderCode ?? '',
				dateOfBirth: emp.dateOfBirth ?? '',
				address: emp.address ?? '',
				effectiveDate: todayYmd(),
				historyNote: '',
			},
		});
		loadPositions(deptId);
	}

	/**
	 * Bốn trường tạo nên một mốc lịch sử công tác.
	 *
	 * Đổi một trong bốn trường này thì BE kết thúc giai đoạn đang mở và mở giai đoạn mới từ
	 * ngày hiệu lực, nên ô Ngày hiệu lực và Ghi chú chỉ hiện đúng lúc đó. Người dùng chỉ sửa số
	 * điện thoại thì không phải đọc thêm hai ô không liên quan.
	 *
	 * Ô để trống được coi là không đổi, vì payload cũng không gửi trường đó và BE giữ nguyên giá
	 * trị cũ. Điều này cần thiết: watcher của phòng ban xoá chức vụ mỗi lần phòng ban đổi, kể cả
	 * lần nạp form đầu tiên, nên so sánh thô sẽ bật hai ô kia ngay khi vừa mở form.
	 */
	const employmentChanged = computed(() => {
		const emp = currentEmployee.value;
		if (!emp) return false;
		const changedId = (value: unknown, current: number | undefined) => {
			const next = value ? Number(value) : undefined;
			return next !== undefined && next !== current;
		};
		return (
			changedId(departmentId.value, emp.department?.id) ||
			changedId(positionId.value, emp.position?.id) ||
			changedId(managerId.value, emp.manager?.id) ||
			(!!employmentType.value && employmentType.value !== emp.employmentType)
		);
	});

	function startEditing() {
		if (!canUpdate.value) {
			toast.error('Bạn không có quyền chỉnh sửa nhân viên');
			return;
		}
		resetFormFromEmployee();
		isEditing.value = true;
	}

	// URL guard: paste `?edit=true` mà không có quyền → strip query + toast.
	watch(
		() => route.query.edit,
		v => {
			if (v === 'true' && !canUpdate.value) {
				toast.error('Bạn không có quyền chỉnh sửa nhân viên');
				router.replace({ query: { ...route.query, edit: undefined } });
			}
		},
		{ immediate: true },
	);

	function cancelEditing() {
		isEditing.value = false;
	}

	const onSubmit = handleSubmit(async values => {
		// Defense-in-depth: form không hiển thị nếu thiếu quyền, nhưng vẫn re-check trước BE call.
		if (!canUpdate.value) {
			toast.error('Bạn không có quyền chỉnh sửa nhân viên');
			return;
		}
		const payload: UpdateEmployeeDto = {
			fullName: values.fullName,
			phone: values.phone || undefined,
			joinDate: values.joinDate,
			role: values.role,
			employmentType: (values.employmentType as EmploymentType) || undefined,
			departmentId: values.departmentId ? Number(values.departmentId) : undefined,
			positionId: values.positionId ? Number(values.positionId) : undefined,
			managerId: values.managerId ? Number(values.managerId) : undefined,
			gender: (values.gender as GenderCode) || undefined,
			dateOfBirth: values.dateOfBirth || undefined,
			address: values.address || undefined,
		};
		// Chỉ gửi ngày hiệu lực và ghi chú khi thật sự có mốc công tác mới, để lần sửa số điện
		// thoại không vô tình ghi thêm một dòng lịch sử.
		if (employmentChanged.value) {
			payload.effectiveDate = values.effectiveDate || undefined;
			payload.historyNote = values.historyNote || undefined;
		}
		try {
			await update(id, payload);
			toast.success('Cập nhật thông tin thành công');
			isEditing.value = false;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi cập nhật thông tin');
		}
	});

	async function handleResetPassword() {
		resettingPassword.value = true;
		try {
			const message = await resetPassword(id);
			// Hiện nguyên message của BE. Câu dự phòng không nói "mật khẩu đã gửi qua email":
			// BE không gửi mật khẩu nữa, chỉ gửi link tự đặt mật khẩu hạn 3 giờ.
			toast.success(message || 'Đã gửi link đặt mật khẩu mới tới email của nhân viên.');
			confirmResetPassword.value = false;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi đặt lại mật khẩu');
		} finally {
			resettingPassword.value = false;
		}
	}

	async function handleDeactivate() {
		if (!canDelete.value) {
			toast.error('Bạn không có quyền khóa tài khoản nhân viên');
			return;
		}
		deactivating.value = true;
		try {
			await deactivate(id, terminationDateInput.value);
			toast.success('Đã khóa tài khoản nhân viên');
			confirmDeactivate.value = false;
			// Ở lại trang chi tiết để HR thấy ngay badge "Đã nghỉ việc dd/MM/yyyy" do BE trả về.
		} catch (e) {
			// Dialog CỐ Ý không đóng khi lỗi (VD ngày nghỉ < ngày vào làm) — HR sửa ngày rồi bấm lại.
			toast.error(e instanceof Error ? e.message : 'Lỗi khóa tài khoản nhân viên');
		} finally {
			deactivating.value = false;
		}
	}

	// ─── Static options ───────────────────────────────────────────────────────────

	const metaDataStore = useMetaDataStore();
	metaDataStore.load().catch(() => { /* metadata not critical */ });
	const { roles: roleOptions } = storeToRefs(metaDataStore);

	// Ô chọn gửi mã giới tính; nhãn vẫn là chữ người dùng đọc (lô 3a).
	const genderOptions = [
		{ value: '', label: '-- Không rõ --' },
		...Object.entries(GENDER_LABELS).map(([value, label]) => ({ value, label })),
	];

	const { employmentTypes: employmentTypeOptions } = storeToRefs(metaDataStore);

	const employmentTypeLabel = computed(() => {
		const t = currentEmployee.value?.employmentType;
		return t ? metaDataStore.labelForEmploymentType(t) : null;
	});

	const departmentOptions = computed(() => [
		{ value: undefined as number | undefined, label: '-- Không thuộc phòng ban --' },
		...departments.value.map(d => ({ value: d.id as number | undefined, label: d.name })),
	]);

	const positionOptions = computed(() => [
		{ value: undefined as number | undefined, label: '-- Không có chức vụ --' },
		...positions.value.map(p => ({ value: p.id as number | undefined, label: p.name })),
	]);

	const managerOptions = computed(() => [
		{ value: 0, label: '— Không có quản lý —' },
		...allEmployees.value
			.filter(e => e.id !== id)
			.map(e => ({ value: e.id, label: `${e.fullName} (${e.employeeCode})` })),
	]);

	const roleLabel = computed(() => {
		const emp = currentEmployee.value;
		if (!emp) return '—';
		return metaDataStore.labelForRole(emp.role);
	});

	const inputCls =
		'block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm px-3 py-2.5 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50';
	const labelCls = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1';
	const valueCls = 'text-sm text-gray-900 dark:text-white';
</script>

<template>
	<div class="space-y-6">
		<!-- Back + actions header -->
		<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
			<NuxtLink
				to="/management/employees"
				class="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
			>
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
				</svg>
				Danh sách nhân viên
			</NuxtLink>

			<div v-if="currentEmployee && (activeTab === 'info') && !isEditing" class="flex items-center gap-2">
				<CommonAppButton v-if="canUpdate" variant="primary" @click="startEditing">
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
						/>
					</svg>
					Chỉnh sửa
				</CommonAppButton>
				<CommonAppButton v-if="canEdit" variant="danger_outline" @click="confirmResetPassword = true">
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
						/>
					</svg>
					Reset mật khẩu
				</CommonAppButton>
				<CommonAppButton v-if="canTerminate" variant="danger_outline" @click="openTerminateModal">
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
						/>
					</svg>
					{{ terminateLabel }}
				</CommonAppButton>
				<CommonAppButton
					v-if="canDelete && currentEmployee.status !== 'INACTIVE'"
					variant="danger"
					@click="confirmDeactivate = true"
				>
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
						/>
					</svg>
					Khóa tài khoản
				</CommonAppButton>
			</div>
		</div>

		<!-- Loading state -->
		<div
			v-if="detailLoading"
			class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 space-y-4"
		>
			<div class="flex items-center gap-4">
				<div class="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
				<div class="space-y-2">
					<div class="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
					<div class="h-3.5 w-24 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
				</div>
			</div>
			<div class="grid grid-cols-2 gap-4 pt-2">
				<div v-for="i in 6" :key="i" class="space-y-1.5">
					<div class="h-3 w-20 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
					<div class="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
				</div>
			</div>
		</div>

		<!-- Không mở được hồ sơ: ngoài phạm vi xem, không tồn tại, hoặc lỗi tải -->
		<div v-else-if="!currentEmployee && !detailLoading" class="flex flex-col items-center justify-center py-20 px-6">
			<p class="max-w-xl text-center text-gray-600 dark:text-gray-300">
				{{ loadError ?? 'Không tìm thấy nhân viên.' }}
			</p>
			<NuxtLink to="/management/employees" class="mt-3">
				<CommonAppButton variant="outline" size="sm">Quay lại danh sách</CommonAppButton>
			</NuxtLink>
		</div>

		<template v-else-if="currentEmployee">
			<!-- Profile header card -->
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
				<div class="flex flex-col sm:flex-row sm:items-center gap-4">
					<CommonAppAvatar
						:src="currentEmployee.avatarUrl"
						:name="currentEmployee.fullName"
						size="xl"
						bordered
						clickable
						:title="`Xem ảnh ${currentEmployee.fullName}`"
						@click="openAvatar"
					/>
					<div class="flex-1 min-w-0">
						<div class="flex flex-wrap items-center gap-2">
							<h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ currentEmployee.fullName }}</h2>
							<EmployeeEmployeeStatusBadge
								:status="currentEmployee.status"
								:termination-date="currentEmployee.terminationDate"
							/>
							<EmploymentTypeBadge v-if="currentEmployee.employmentType" :type="currentEmployee.employmentType" />
						</div>
						<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
							{{ currentEmployee.email }}
							<span class="mx-1.5">·</span>
							<span class="font-mono text-xs">{{ currentEmployee.employeeCode }}</span>
						</p>
					</div>
				</div>
			</div>

			<!-- Tab bar -->
			<div class="border-b border-gray-200 dark:border-gray-700">
				<!-- Lô 3a thêm hai tab nữa nên hàng tab phải cuộn ngang được trên điện thoại. -->
				<nav class="-mb-px flex gap-1 overflow-x-auto whitespace-nowrap">
					<button
						type="button"
						class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors"
						:class="
							activeTab === 'info'
								? 'border-brand-500 text-brand-600 dark:text-brand-400'
								: 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
						"
						@click="activeTab = 'info'"
					>
						Thông tin
					</button>
					<button
						v-if="canReadPrivate"
						type="button"
						class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors"
						:class="
							activeTab === 'relatives'
								? 'border-brand-500 text-brand-600 dark:text-brand-400'
								: 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
						"
						@click="
							activeTab = 'relatives';
							isEditing = false;
						"
					>
						Thân nhân
					</button>
					<button
						type="button"
						class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors"
						:class="
							activeTab === 'documents'
								? 'border-brand-500 text-brand-600 dark:text-brand-400'
								: 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
						"
						@click="
							activeTab = 'documents';
							isEditing = false;
						"
					>
						Tài liệu
					</button>
					<button
						v-if="canReadContracts"
						type="button"
						class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors"
						:class="
							activeTab === 'contracts'
								? 'border-brand-500 text-brand-600 dark:text-brand-400'
								: 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
						"
						@click="
							activeTab = 'contracts';
							isEditing = false;
						"
					>
						Hợp đồng
					</button>
					<button
						v-if="canReadSocialInsurance"
						type="button"
						class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors"
						:class="
							activeTab === 'social-insurance'
								? 'border-brand-500 text-brand-600 dark:text-brand-400'
								: 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
						"
						@click="
							activeTab = 'social-insurance';
							isEditing = false;
						"
					>
						BHXH &amp; Thuế
					</button>
					<button
						type="button"
						class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors"
						:class="
							activeTab === 'identity'
								? 'border-brand-500 text-brand-600 dark:text-brand-400'
								: 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
						"
						@click="
							activeTab = 'identity';
							isEditing = false;
						"
					>
						Định danh
					</button>
					<button
						v-if="canReadAssets"
						type="button"
						class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors"
						:class="
							activeTab === 'assets'
								? 'border-brand-500 text-brand-600 dark:text-brand-400'
								: 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
						"
						@click="
							activeTab = 'assets';
							isEditing = false;
						"
					>
						Tài sản
					</button>
				</nav>
			</div>

			<!-- Tab: Thông tin -->
			<template v-if="activeTab === 'info'">
				<!-- View mode -->
				<div
					v-if="!isEditing"
					class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm"
				>
					<div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
						<h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Thông tin cá nhân</h3>
					</div>
					<div class="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
						<div>
							<p :class="labelCls">Mã nhân viên</p>
							<p :class="[valueCls, 'font-mono']">{{ currentEmployee.employeeCode }}</p>
						</div>
						<div>
							<p :class="labelCls">Họ và tên</p>
							<p :class="valueCls">{{ currentEmployee.fullName }}</p>
						</div>
						<div>
							<p :class="labelCls">Email</p>
							<p :class="valueCls">{{ currentEmployee.email }}</p>
						</div>
						<div>
							<p :class="labelCls">Số điện thoại</p>
							<p :class="valueCls">{{ currentEmployee.phone ?? '—' }}</p>
						</div>
						<div>
							<p :class="labelCls">Nhóm quyền</p>
							<p :class="valueCls">{{ roleLabel }}</p>
						</div>
						<div>
							<p :class="labelCls">Loại hình lao động</p>
							<p :class="valueCls">{{ employmentTypeLabel ?? '—' }}</p>
						</div>
						<div>
							<p :class="labelCls">Phòng ban</p>
							<p :class="valueCls">{{ currentEmployee.department?.name ?? '—' }}</p>
						</div>
						<div>
							<p :class="labelCls">Chức vụ</p>
							<p :class="valueCls">{{ currentEmployee.position?.name ?? '—' }}</p>
						</div>
						<div>
							<p :class="labelCls">Quản lý trực tiếp</p>
							<NuxtLink
								v-if="currentEmployee.manager"
								:to="`/management/employees/${currentEmployee.manager.id}`"
								class="text-sm text-brand-600 dark:text-brand-400 hover:underline"
							>
								{{ currentEmployee.manager.fullName }}
							</NuxtLink>
							<p v-else :class="valueCls">—</p>
						</div>
						<div>
							<p :class="labelCls">Ngày vào làm</p>
							<p :class="valueCls">{{ formatDate(currentEmployee.joinDate) }}</p>
						</div>
						<div v-if="currentEmployee.status === 'INACTIVE'">
							<p :class="labelCls">Ngày nghỉ việc</p>
							<p class="text-sm font-medium text-red-600 dark:text-red-400">
								{{ formatDate(currentEmployee.terminationDate) }}
							</p>
						</div>
						<div v-if="currentEmployee.status === 'INACTIVE'">
							<p :class="labelCls">Trường hợp nghỉ việc</p>
							<p :class="valueCls">{{ currentEmployee.terminationReasonLabel ?? '—' }}</p>
						</div>
						<div v-if="currentEmployee.status === 'INACTIVE'" class="sm:col-span-2">
							<p :class="labelCls">Lý do nghỉ việc</p>
							<p :class="[valueCls, 'whitespace-pre-line']">
								{{ currentEmployee.terminationNote ?? '—' }}
							</p>
						</div>
						<div>
							<p :class="labelCls">Ngày sinh</p>
							<p :class="valueCls">{{ formatDate(currentEmployee.dateOfBirth) }}</p>
						</div>
						<div>
							<p :class="labelCls">Giới tính</p>
							<p :class="valueCls">{{ currentEmployee.gender ?? '—' }}</p>
						</div>
						<div class="sm:col-span-2">
							<p :class="labelCls">Địa chỉ</p>
							<p :class="valueCls">{{ currentEmployee.address ?? '—' }}</p>
						</div>
						<div>
							<p :class="labelCls">Ngày tạo</p>
							<p :class="valueCls">{{ formatDateTime(currentEmployee.createdAt) }}</p>
						</div>
					</div>
				</div>

				<!-- Edit form -->
				<form
					v-else
					class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm"
					@submit.prevent="onSubmit"
				>
					<div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
						<h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Chỉnh sửa thông tin</h3>
					</div>

					<div class="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
						<!-- Full name -->
						<div class="sm:col-span-2">
							<label :class="labelCls">Họ và tên <span class="text-red-500">*</span></label>
							<input
								v-model="fullName"
								v-bind="fullNameAttrs"
								:class="[inputCls, errors.fullName ? 'border-red-400 focus:ring-red-300' : '']"
								placeholder="Nhập họ và tên"
							/>
							<p v-if="errors.fullName" class="mt-1 text-xs text-red-500">{{ errors.fullName }}</p>
						</div>

						<!-- Phone -->
						<div>
							<label :class="labelCls">Số điện thoại</label>
							<input
								v-model="phone"
								v-bind="phoneAttrs"
								:class="[inputCls, errors.phone ? 'border-red-400 focus:ring-red-300' : '']"
								placeholder="09xxxxxxxx"
							/>
							<p v-if="errors.phone" class="mt-1 text-xs text-red-500">{{ errors.phone }}</p>
						</div>

						<!-- Join date -->
						<div>
							<label :class="labelCls">Ngày vào làm</label>
							<UiDatePicker v-model="joinDate" />
						</div>

						<!-- Role -->
						<div>
							<label :class="labelCls">Vai trò</label>
							<UiSelect v-model="role" :options="roleOptions" />
						</div>

						<!-- Employment type -->
						<div>
							<label :class="labelCls">Loại hình lao động</label>
							<UiSelect v-model="employmentType" :options="employmentTypeOptions" />
						</div>

						<!-- Department -->
						<div>
							<label :class="labelCls">Phòng ban</label>
							<UiSelect v-model="departmentId" :options="departmentOptions" />
						</div>

						<!-- Position -->
						<div>
							<label :class="labelCls">Chức vụ</label>
							<UiSelect v-model="positionId" :options="positionOptions" />
						</div>

						<!-- Manager -->
						<div>
							<label :class="labelCls">Quản lý trực tiếp</label>
							<UiSelectInput
								:model-value="managerId ?? 0"
								:options="managerOptions"
								placeholder="— Không có quản lý —"
								search-placeholder="Tìm nhân viên..."
								@update:model-value="managerId = $event === 0 ? undefined : ($event as number)"
							/>
						</div>

						<!-- Gender -->
						<div>
							<label :class="labelCls">Giới tính</label>
							<UiSelect v-model="gender" :options="genderOptions" />
						</div>

						<!-- Date of birth -->
						<div>
							<label :class="labelCls">Ngày sinh</label>
							<UiDatePicker v-model="dateOfBirth" />
						</div>

						<!-- Address -->
						<div class="sm:col-span-2">
							<label :class="labelCls">Địa chỉ</label>
							<input v-model="address" v-bind="addressAttrs" :class="inputCls" placeholder="Nhập địa chỉ" />
						</div>

						<!-- Mốc lịch sử công tác (lô 3a): chỉ hiện khi phòng ban, chức vụ, quản lý hoặc
						     loại lao động thay đổi, vì chỉ lúc đó hệ thống mới ghi một giai đoạn mới. -->
						<div
							v-if="employmentChanged"
							class="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-5 rounded-lg border border-brand-200 bg-brand-50/60 p-4 dark:border-brand-800 dark:bg-brand-900/20"
						>
							<p class="sm:col-span-2 text-xs text-brand-800 dark:text-brand-200">
								Bạn vừa đổi phòng ban, chức vụ, quản lý hoặc loại lao động, nên hệ thống sẽ ghi một mốc công tác
								mới. Ngày hiệu lực không được sau hôm nay và không trước ngày bắt đầu của giai đoạn đang mở.
							</p>
							<UiDatePicker v-model="effectiveDate" label="Ngày hiệu lực" :max="todayYmd()" />
							<div>
								<label :class="labelCls">Ghi chú mốc công tác</label>
								<input
									v-model="historyNote"
									v-bind="historyNoteAttrs"
									:class="inputCls"
									placeholder="Ví dụ Điều động theo quyết định số 12"
								/>
							</div>
						</div>
					</div>

					<div class="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
						<CommonAppButton type="button" variant="outline" @click="cancelEditing">Hủy</CommonAppButton>
						<CommonAppButton type="submit" :loading="isSubmitting">Lưu thay đổi</CommonAppButton>
					</div>
				</form>

				<!-- Hồ sơ mở rộng (lô 3a). Khối nhạy cảm đóng sẵn, mở ra là một dòng nhật ký. -->
				<template v-if="!isEditing">
					<EmployeeExtraProfile :employee-id="id" :can-update="canUpdate" />
					<EmployeeBankTax
						v-if="canReadPrivate"
						:employee-id="id"
						:employee-name="currentEmployee.fullName"
						:can-update="canUpdate"
					/>
					<EmployeeWorkExperiences :employee-id="id" :can-update="canUpdate" />
				</template>
			</template>

			<!-- Tab: Thân nhân (lô 3a) -->
			<EmployeeRelatives
				v-else-if="activeTab === 'relatives' && canReadPrivate"
				:employee-id="id"
				:employee-name="currentEmployee.fullName"
				:can-update="canUpdate"
			/>

			<!-- Tab: Tài liệu -->
			<EmployeeDocuments
				v-else-if="activeTab === 'documents'"
				:employee-id="id"
				:readonly="!canUpdate"
				:can-view-relatives="canReadPrivate"
			/>

			<!-- Tab: Hợp đồng -->
			<div
				v-else-if="activeTab === 'contracts' && canReadContracts"
				class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6"
			>
				<EmployeeContracts :employee-id="id" />
			</div>

			<!-- Tab: BHXH & Thuế -->
			<EmployeeSocialInsurance
				v-else-if="activeTab === 'social-insurance' && canReadSocialInsurance"
				:employee-id="id"
			/>

			<!-- Tab: Định danh (CCCD + Hộ chiếu) -->
			<div v-else-if="activeTab === 'identity'" class="space-y-6">
				<EmployeeCitizenId :employee-id="id" />
				<EmployeePassport :employee-id="id" />
			</div>

			<!-- Tab: Tài sản -->
			<EmployeeAssets
				v-else-if="activeTab === 'assets' && canReadAssets"
				:employee-id="id"
				:can-manage="canManageAssets"
			/>
		</template>

		<!-- Confirm reset password modal -->
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
					v-if="confirmResetPassword"
					class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
					@click.self="confirmResetPassword = false"
				>
					<div
						class="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl border border-gray-200 dark:border-gray-700"
					>
						<div class="flex items-start gap-4">
							<div
								class="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0"
							>
								<svg
									class="w-5 h-5 text-amber-600 dark:text-amber-400"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
									/>
								</svg>
							</div>
							<div>
								<h3 class="font-semibold text-gray-900 dark:text-white">Reset mật khẩu</h3>
								<p class="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
									<strong class="text-gray-700 dark:text-gray-300">{{ currentEmployee?.fullName }}</strong>
									sẽ nhận email kèm link tự đặt mật khẩu mới, có hạn 3 giờ. Email gửi tới địa chỉ đăng nhập của tài
									khoản, có thể khác email công việc trong hồ sơ. Link gửi trước đó (nếu có) cũng hết hiệu lực.
								</p>
								<p class="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
									Nếu tài khoản chỉ dùng ở công ty này thì mật khẩu hiện tại hết hiệu lực ngay và nhân viên bị đăng xuất
									khỏi mọi thiết bị.
								</p>
							</div>
						</div>
						<div class="flex justify-end gap-3 mt-6">
							<CommonAppButton variant="outline" @click="confirmResetPassword = false">Hủy</CommonAppButton>
							<CommonAppButton :loading="resettingPassword" @click="handleResetPassword">
								Xác nhận reset
							</CommonAppButton>
						</div>
					</div>
				</div>
			</Transition>
		</Teleport>

		<!-- Confirm deactivate modal -->
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
					v-if="confirmDeactivate"
					class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
					@click.self="confirmDeactivate = false"
				>
					<div
						class="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl border border-gray-200 dark:border-gray-700"
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
								<h3 class="font-semibold text-gray-900 dark:text-white">Khóa tài khoản nhân viên</h3>
								<p class="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
									<strong class="text-gray-700 dark:text-gray-300">{{ currentEmployee?.fullName }}</strong>
									sẽ không thể đăng nhập hệ thống. Đây KHÔNG phải thủ tục nghỉ việc — nhân sự nghỉ thật thì
									dùng "Xác nhận nghỉ việc" để ghi cả ngày và lý do.
								</p>
							</div>
						</div>
						<div class="mt-5">
							<UiDatePicker
								v-model="terminationDateInput"
								label="Ngày nghỉ việc"
								hint="Bỏ trống → hệ thống lấy ngày hôm nay. Ngày này quyết định tháng cuối cùng còn xuất được bảng công."
							/>
						</div>
						<div class="flex justify-end gap-3 mt-6">
							<CommonAppButton variant="outline" @click="confirmDeactivate = false">Hủy</CommonAppButton>
							<CommonAppButton variant="danger" :loading="deactivating" @click="handleDeactivate">
								Xác nhận
							</CommonAppButton>
						</div>
					</div>
				</div>
			</Transition>
		</Teleport>

		<!-- Xác nhận nghỉ việc / sửa thông tin nghỉ việc -->
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
					v-if="showTerminateModal"
					class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
					@click.self="showTerminateModal = false"
				>
					<div
						class="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-lg w-full shadow-xl border border-gray-200 dark:border-gray-700"
					>
						<div class="flex items-start gap-4">
							<div
								class="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0"
							>
								<svg
									class="w-5 h-5 text-amber-600 dark:text-amber-400"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
									/>
								</svg>
							</div>
							<div class="min-w-0">
								<h3 class="font-semibold text-gray-900 dark:text-white">{{ terminateLabel }}</h3>
								<p class="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
									<strong class="text-gray-700 dark:text-gray-300">{{ currentEmployee?.fullName }}</strong>
									— ngày nghỉ quyết định tháng cuối cùng còn xuất được bảng công.
								</p>
							</div>
						</div>

						<p v-if="loadingOpenAssets" class="mt-4 text-xs text-gray-500 dark:text-gray-400">
							Đang kiểm tra tài sản nhân viên còn giữ…
						</p>

						<div
							v-else-if="openAssetsError"
							class="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 dark:border-rose-800 dark:bg-rose-900/20"
						>
							<p class="text-sm text-rose-800 dark:text-rose-200">
								Chưa kiểm tra được tài sản nhân viên đang giữ. Bạn xem tab Tài sản của nhân viên trước khi chốt
								ngày nghỉ.
							</p>
							<CommonAppButton size="sm" variant="outline" @click="loadOpenAssets">Thử lại</CommonAppButton>
						</div>

						<div
							v-else-if="openAssets.length"
							class="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20"
						>
							<p class="text-sm font-medium text-amber-800 dark:text-amber-200">
								{{ currentEmployee?.fullName ?? 'Nhân viên' }} còn giữ {{ openAssets.length }} tài sản chưa thu hồi.
							</p>
							<ul class="mt-1.5 space-y-0.5">
								<li v-for="a in openAssets" :key="a.id" class="text-xs text-amber-700 dark:text-amber-300">
									<NuxtLink :to="`/management/assets/${a.asset.id}`" class="hover:underline">
										{{ a.asset.code }} · {{ a.asset.name }}
									</NuxtLink>
								</li>
							</ul>
							<p class="mt-2 text-xs text-amber-700 dark:text-amber-300">
								Bạn nên thu hồi trước khi chốt ngày nghỉ; nếu vẫn cho nghỉ, hệ thống sẽ nhắc người quản lý tài sản
								thu hồi sau.
							</p>
							<template v-if="canManageAssets">
								<CommonAppButton
									v-if="!confirmReturnAllOpen"
									class="mt-2"
									size="sm"
									variant="outline"
									@click="confirmReturnAllOpen = true"
								>
									Thu hồi tất cả
								</CommonAppButton>
								<div v-else class="mt-2 space-y-2 rounded-lg bg-white/70 p-2 dark:bg-gray-900/40">
									<p class="text-xs text-amber-800 dark:text-amber-200">
										Thu hồi {{ openAssets.length }} tài sản trong một lần, ngày thu hồi là hôm nay và tình trạng để
										trống. Tài sản cấp phát cho phòng ban mà nhân viên này chịu trách nhiệm sẽ không được thu hồi.
									</p>
									<div class="flex gap-2">
										<CommonAppButton size="sm" variant="secondary" @click="confirmReturnAllOpen = false">
											Giữ lại
										</CommonAppButton>
										<CommonAppButton size="sm" variant="primary" :loading="returningOpenAssets" @click="returnAllOpenAssets">
											Thu hồi tất cả
										</CommonAppButton>
									</div>
								</div>
							</template>
						</div>

						<div class="mt-5 space-y-4">
							<UiDatePicker v-model="terminateForm.date" label="Ngày nghỉ việc *" />
							<div class="flex flex-col gap-1">
								<label class="text-sm font-medium text-gray-700 dark:text-gray-300">Lý do nghỉ việc *</label>
								<UiSelect
									v-model="terminateForm.reason"
									:options="terminationReasonOptions"
									placeholder="-- Chọn trường hợp nghỉ việc --"
								/>
								<p class="text-xs text-gray-500 dark:text-gray-400">
									Trường hợp nghỉ việc theo Bộ luật Lao động, dùng cho báo cáo lao động định kỳ.
								</p>
							</div>
							<div class="flex flex-col gap-1">
								<label for="termination-note" class="text-sm font-medium text-gray-700 dark:text-gray-300">
									Diễn giải *
								</label>
								<textarea
									id="termination-note"
									v-model="terminateForm.note"
									rows="4"
									:maxlength="TERMINATION_NOTE_MAX"
									placeholder="Ví dụ: Nghỉ theo thỏa thuận hai bên, đã bàn giao xong ngày 17/09."
									class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:focus:ring-brand-800"
								/>
								<p class="text-xs text-gray-500 dark:text-gray-400 text-right">
									{{ terminateForm.note.length }}/{{ TERMINATION_NOTE_MAX }}
								</p>
							</div>
						</div>

						<div class="flex justify-end gap-3 mt-6">
							<CommonAppButton variant="outline" @click="showTerminateModal = false">Hủy</CommonAppButton>
							<CommonAppButton
								variant="danger"
								:loading="terminating"
								:disabled="!canSubmitTerminate"
								@click="handleTerminate"
							>
								{{ isTerminated ? 'Lưu thay đổi' : 'Xác nhận nghỉ việc' }}
							</CommonAppButton>
						</div>
					</div>
				</div>
			</Transition>
		</Teleport>
	</div>
</template>
