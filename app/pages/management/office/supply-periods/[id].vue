<script setup lang="ts">
	import RequestDetailModal from '~/components/modules/office/RequestDetailModal.vue';
	import SupplementModal from '~/components/modules/office/SupplementModal.vue';
	import { useOfficeService } from '~/services/office.service';
	import {
		downloadOfficeFile,
		groupSummaryRows,
		monthLabel,
		officeErrorCode,
		officeErrorMessage,
		officeMoney,
	} from '~/utils/office.utils';
	import { formatDate, todayYmd, vnCalendarDaysBetween } from '~/utils/date';
	import { OFFICE_PERMISSIONS } from '~/utils/permission';
	import type { SupplyPeriodSummary, SupplyRequestStatus } from '~/types/office.types';

	/**
	 * Bảng tổng hợp một kỳ đăng ký (UI-02): ma trận mặt hàng × phòng ban như file đăng ký của
	 * HCNS, cộng dự trù, số cần mua, đơn giá thực và thành tiền.
	 *
	 * Trưởng phòng mở trang này chỉ nhận về cột phòng mình và không có dự trù (máy chủ lọc), nên
	 * mọi ô nhập và nút ghi ở đây đều hỏi `office:supply:manage` trước khi hiện.
	 */
	definePageMeta({ title: 'Bảng tổng hợp kỳ đăng ký' });

	const route = useRoute();
	const router = useRouter();
	const toast = useToast();
	const service = useOfficeService();
	const { hasPermission } = usePermissions();
	const { canWrite } = useModuleAccess();

	const periodId = computed(() => Number(route.params.id));
	const canManage = computed(() => hasPermission(OFFICE_PERMISSIONS.supplyManage) && canWrite('OFFICE'));

	const summary = ref<SupplyPeriodSummary | null>(null);
	const loading = ref(true);
	const loadError = ref<string | null>(null);
	const savingItems = ref(false);
	const working = ref(false);
	const exporting = ref(false);

	/** Dự trù và đơn giá đang sửa trên màn, theo `itemId`. */
	const reserveQty = reactive<Record<number, number | undefined>>({});
	const unitPrice = reactive<Record<number, number | undefined>>({});

	const showDeadlineForm = ref(false);
	const newDeadline = ref('');
	const deadlineError = ref('');
	const showSupplement = ref(false);
	const openRequestId = ref<number | null>(null);

	const showAddDepartments = ref(false);
	const addDepartmentIds = ref<number[]>([]);
	const confirmCancelPeriod = ref(false);
	const confirmLockPeriod = ref(false);
	const confirmClosePeriod = ref(false);

	const directoryStore = useDirectoryStore();
	const { departments: allDepartments } = storeToRefs(directoryStore);

	const STATUS_CLASS: Record<SupplyRequestStatus, string> = {
		OPEN: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
		LOCKED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
		FINALIZED: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
		ISSUED: 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400',
		RECEIVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
	};

	function fillInputs(data: SupplyPeriodSummary) {
		summary.value = data;
		for (const row of data.rows) {
			if (row.itemId == null) continue;
			// Phạm vi phòng ban không có dự trù (`null`): ô nhập để trống chứ không hiện số 0.
			reserveQty[row.itemId] = row.reserveQty ?? undefined;
			unitPrice[row.itemId] = row.unitPrice ?? undefined;
		}
	}

	async function load() {
		loading.value = true;
		loadError.value = null;
		try {
			fillInputs(await service.findPeriodSummary(periodId.value));
		} catch (e) {
			summary.value = null;
			loadError.value = officeErrorMessage(e, 'Chưa mở được kỳ này. Bạn quay lại danh sách kỳ.');
		} finally {
			loading.value = false;
		}
	}

	onMounted(() => {
		load();
		directoryStore.load().catch(() => {
			// Thiếu danh sách phòng ban thì chỉ mất nút Thêm phòng, bảng tổng hợp vẫn đọc được.
		});
	});

	const period = computed(() => summary.value?.period ?? null);

	/**
	 * Phạm vi dữ liệu của người đang xem, theo cờ `scope` của máy chủ.
	 *
	 * Trưởng phòng nhận `DEPARTMENT`: máy chủ không gửi dự trù (`reserveQty` là `null`) và `purchaseQty`
	 * chỉ là số của phòng họ. Giữ hai cột đó thì trưởng phòng đọc "Cần mua 13" và tưởng phòng mình
	 * được 13, trong khi 13 là số HCNS mua cho cả văn phòng.
	 */
	const departmentScope = computed(() => summary.value?.scope === 'DEPARTMENT');

	/** Số cột của bảng ma trận, để dòng tiêu đề nhóm và dòng tổng trải đúng chiều ngang. */
	const quantityColumns = computed(() => (departmentScope.value ? 0 : 2));
	const totalColumns = computed(() => departments.value.length + 6 + quantityColumns.value);

	/** Còn bao nhiêu ngày nữa tới hạn chót, để hộp hỏi lại nói rõ khoá sớm là sớm bao nhiêu. */
	const daysToDeadline = computed(() => {
		if (!period.value) return 0;
		return Math.max(vnCalendarDaysBetween(new Date(), `${period.value.deadline}T00:00:00+07:00`), 0);
	});

	/** Phòng chưa nhập dòng nào: khoá sớm là khoá luôn cửa của họ, nên phải nói ra. */
	const departmentsWithoutLines = computed(
		() =>
			(summary.value?.departments ?? []).filter(dept => dept.requests.every(req => req.lineCount === 0)).length,
	);

	/**
	 * Kỳ đã đóng thì khoá hẳn: mọi nút ghi ẩn đi.
	 *
	 * Ẩn chứ không chỉ để máy chủ từ chối, vì người dùng bấm vào một nút rồi nhận lỗi sẽ tưởng
	 * hệ thống hỏng, trong khi đây là quy định nghiệp vụ.
	 */
	const periodClosed = computed(() => period.value?.status === 'CLOSED');
	const canEditPeriod = computed(() => canManage.value && !periodClosed.value);

	/** Phòng chưa tham gia kỳ, để thêm vào kỳ còn mở. */
	const addableDepartments = computed(() => {
		const joined = new Set((summary.value?.departments ?? []).map(d => d.departmentId));
		return allDepartments.value.filter(d => d.isActive && !joined.has(d.id));
	});

	/** Chưa phòng nào nhập dòng nào thì kỳ mới huỷ được. */
	const periodUntouched = computed(() =>
		(summary.value?.departments ?? []).every(dept => dept.requests.every(req => req.lineCount === 0)),
	);

	/** Tên kỳ thường đã là "Tháng 12/2026", nên chỉ nhắc lại tháng khi tiêu đề kỳ khác đi. */
	const monthSuffix = computed(() => {
		if (!period.value) return '';
		const label = monthLabel(period.value.month);
		return period.value.title.trim() === label ? '' : label;
	});
	const groups = computed(() => groupSummaryRows(summary.value?.rows ?? []));
	const departments = computed(() => summary.value?.departments ?? []);

	/** Ô của một dòng cho một phòng; không có nghĩa phòng đó không xin mặt hàng này. */
	function cellQty(cells: Array<{ departmentId: number; qty: number }>, departmentId: number): string {
		const cell = cells.find(c => c.departmentId === departmentId);
		return cell ? String(cell.qty) : '';
	}

	async function saveItems() {
		const data = summary.value;
		if (!data || savingItems.value) return;
		savingItems.value = true;
		try {
			const items = data.rows
				.filter(row => row.itemId != null)
				.map(row => ({
					itemId: row.itemId as number,
					reserveQty: reserveQty[row.itemId as number] ?? 0,
					unitPrice: unitPrice[row.itemId as number],
				}));
			fillInputs(await service.savePeriodItems(data.period.id, items));
			toast.success('Đã lưu dự trù và đơn giá của kỳ này.');
		} catch (e) {
			toast.error(officeErrorMessage(e, 'Chưa lưu được dự trù và đơn giá. Bạn thử lại sau ít phút.'));
		} finally {
			savingItems.value = false;
		}
	}

	function openDeadlineForm() {
		newDeadline.value = period.value?.deadline ?? '';
		deadlineError.value = '';
		showDeadlineForm.value = !showDeadlineForm.value;
	}

	/**
	 * Người dùng vừa sửa ngày thì câu lỗi cũ hết đúng.
	 *
	 * Để treo lại thì hai chuyện xảy ra: họ sửa đúng rồi vẫn thấy câu đỏ, và câu của biểu mẫu che
	 * luôn câu của ô ngày (ví dụ "Ngày 31/11/2026 không có thật"), nên không ai biết mình sai gì.
	 */
	watch(newDeadline, () => {
		deadlineError.value = '';
	});

	/** Đổi hạn chót cả hai chiều: lùi lại để chờ thêm, hoặc rút ngắn để chốt sớm (Q6). */
	async function saveDeadline() {
		const data = period.value;
		if (!data || !newDeadline.value || working.value) return;
		working.value = true;
		deadlineError.value = '';
		try {
			await service.updatePeriod(data.id, { deadline: newDeadline.value });
			showDeadlineForm.value = false;
			toast.success(`Đã đổi hạn chót thành ngày ${formatDate(newDeadline.value)}. Các phòng vừa nhận thông báo.`);
			await load();
		} catch (e) {
			const code = officeErrorCode(e);
			if (code === 'OFFICE_SUPPLY_DEADLINE_PAST' || code === 'OFFICE_SUPPLY_DEADLINE_INVALID') {
				deadlineError.value = officeErrorMessage(e, 'Hạn chót phải là ngày từ hôm nay trở đi.');
			} else {
				toast.error(officeErrorMessage(e, 'Chưa đổi được hạn chót. Bạn thử lại sau ít phút.'));
			}
		} finally {
			working.value = false;
		}
	}

	function openAddDepartments() {
		addDepartmentIds.value = [];
		showAddDepartments.value = !showAddDepartments.value;
	}

	function toggleAddDepartment(id: number) {
		addDepartmentIds.value = addDepartmentIds.value.includes(id)
			? addDepartmentIds.value.filter(x => x !== id)
			: [...addDepartmentIds.value, id];
	}

	/** Thêm phòng bị quên vào kỳ đang mở; mỗi phòng mới có sẵn một phiếu rỗng (Q4). */
	async function addDepartments() {
		const data = period.value;
		if (!data || !addDepartmentIds.value.length || working.value) return;
		working.value = true;
		try {
			await service.addPeriodDepartments(data.id, { departmentIds: addDepartmentIds.value });
			toast.success(
				`Đã thêm ${addDepartmentIds.value.length} phòng vào kỳ. Nhân viên các phòng đó vừa nhận thông báo.`,
			);
			showAddDepartments.value = false;
			addDepartmentIds.value = [];
			await load();
		} catch (e) {
			toast.error(officeErrorMessage(e, 'Chưa thêm được phòng vào kỳ. Bạn thử lại sau ít phút.'));
		} finally {
			working.value = false;
		}
	}

	/** Huỷ kỳ mở nhầm: kỳ bị xoá hẳn nên quay về danh sách thay vì tải lại trang trống (Q4). */
	async function cancelPeriod() {
		const data = period.value;
		if (!data || working.value) return;
		working.value = true;
		try {
			await service.cancelPeriod(data.id);
			toast.success(`Đã huỷ kỳ ${data.title}. Bạn mở lại kỳ của tháng này khi cần.`);
			await router.push('/management/office/supply-periods');
		} catch (e) {
			confirmCancelPeriod.value = false;
			toast.error(officeErrorMessage(e, 'Chưa huỷ được kỳ. Bạn thử lại sau ít phút.'));
		} finally {
			working.value = false;
		}
	}

	/**
	 * Khoá sớm và đóng kỳ đều hỏi lại, và hộp hỏi nói rõ hậu quả.
	 *
	 * Hai việc này không có đường quay lại: khoá sớm là cắt cửa nhập của mọi phòng trước hạn, đóng
	 * kỳ là chốt sổ chi phí. Trước đây bấm một cái là xong, nên HCNS khoá kỳ lúc còn bảy ngày mà
	 * không ai kịp nhận ra.
	 */
	async function lockPeriod() {
		const data = period.value;
		if (!data || working.value) return;
		working.value = true;
		try {
			await service.lockPeriod(data.id);
			confirmLockPeriod.value = false;
			toast.success('Đã khoá kỳ. Các phòng không nhập thêm được nữa, bạn chốt từng phiếu rồi cấp hàng.');
			await load();
		} catch (e) {
			toast.error(officeErrorMessage(e, 'Chưa khoá được kỳ. Bạn thử lại sau ít phút.'));
		} finally {
			working.value = false;
		}
	}

	async function closePeriod() {
		const data = period.value;
		if (!data || working.value) return;
		working.value = true;
		try {
			await service.closePeriod(data.id);
			confirmClosePeriod.value = false;
			toast.success('Đã đóng kỳ.');
			await load();
		} catch (e) {
			toast.error(officeErrorMessage(e, 'Chưa đóng được kỳ. Bạn thử lại sau ít phút.'));
		} finally {
			working.value = false;
		}
	}

	async function exportExcel() {
		const data = period.value;
		if (!data || exporting.value) return;
		exporting.value = true;
		try {
			const file = await service.exportPeriod(data.id);
			// Máy chủ đặt tên theo kỳ và văn phòng; tên dự phòng chỉ dùng khi header không tới nơi.
			const name = file.fileName || `tong-hop-van-phong-pham-${data.month}.xlsx`;
			downloadOfficeFile(file.blob, name);
			toast.success(`Đã tải file ${name}.`);
		} catch (e) {
			toast.error(officeErrorMessage(e, 'Chưa xuất được file Excel. Bạn thử lại sau ít phút.'));
		} finally {
			exporting.value = false;
		}
	}

	function onRequestChanged() {
		// Chốt hay cấp một phiếu đổi cả ma trận (số đã chốt, thành tiền), nên tải lại bảng.
		load();
	}

	function onSupplementCreated() {
		showSupplement.value = false;
		load();
	}

	const inputCls =
		'w-full rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
</script>

<template>
	<!-- `pb-24`: chừa chỗ cho nút trợ lý nổi ở góc dưới phải, nếu không nó đè lên dòng cuối bảng. -->
	<div class="space-y-5 pb-24">
		<button
			type="button"
			class="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
			@click="router.push('/management/office/supply-periods')"
		>
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
			</svg>
			Danh sách kỳ đăng ký
		</button>

		<div v-if="loading" class="space-y-3">
			<div v-for="i in 4" :key="i" class="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
		</div>

		<div
			v-else-if="loadError"
			class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300"
		>
			<p>{{ loadError }}</p>
			<CommonAppButton class="mt-3" size="sm" variant="outline" @click="load">Thử lại</CommonAppButton>
		</div>

		<template v-else-if="period && summary">
			<!--
				Dòng dưới tiêu đề ở đây là DỮ LIỆU của kỳ (văn phòng, hạn chót, trạng thái) nên vẫn hiện
				thẳng; chỉ câu giải thích cách dùng trang mới nằm sau dấu hỏi.
			-->
			<UiPageHeader
				:title="period.title"
				description="Bảng tổng hợp gộp số của mọi phòng trong kỳ theo từng mặt hàng. Bạn nhập dự trù và đơn giá ở đây, rồi mở từng phiếu để chốt, cấp và theo dõi phòng đã nhận hàng chưa."
			>
				<div class="flex flex-wrap gap-2">
					<CommonAppButton variant="outline" :loading="exporting" @click="exportExcel">Xuất Excel</CommonAppButton>
					<template v-if="canEditPeriod">
						<CommonAppButton v-if="period.status === 'OPEN'" variant="outline" @click="openDeadlineForm">
							Đổi hạn chót
						</CommonAppButton>
						<CommonAppButton
							v-if="period.status === 'OPEN' && addableDepartments.length"
							variant="outline"
							@click="openAddDepartments"
						>
							Thêm phòng
						</CommonAppButton>
						<CommonAppButton v-if="period.status === 'OPEN'" variant="outline" @click="confirmLockPeriod = true">
							Khoá sớm
						</CommonAppButton>
						<CommonAppButton
							v-if="period.status === 'OPEN' && periodUntouched"
							variant="danger_outline"
							@click="confirmCancelPeriod = true"
						>
							Huỷ kỳ
						</CommonAppButton>
						<CommonAppButton v-if="period.status === 'LOCKED'" variant="outline" @click="showSupplement = true">
							Phiếu bổ sung
						</CommonAppButton>
						<CommonAppButton v-if="period.status === 'LOCKED'" variant="primary" @click="confirmClosePeriod = true">
							Đóng kỳ
						</CommonAppButton>
					</template>
				</div>
			</UiPageHeader>

			<p class="-mt-2 text-sm text-gray-600 dark:text-gray-400">
				{{ period.officeSite.name }}
				<template v-if="monthSuffix"> · {{ monthSuffix }}</template>
				· hạn chót {{ formatDate(period.deadline) }} · {{ period.statusLabel }}
			</p>

			<CommonAppModuleNotice module="OFFICE" />

			<div
				v-if="showDeadlineForm"
				class="rounded-xl border border-brand-200 bg-white p-4 shadow-sm dark:border-brand-700 dark:bg-gray-900"
			>
				<div class="flex flex-wrap items-end gap-3">
					<div class="w-48">
						<label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Hạn chót mới</label>
						<UiDatePicker v-model="newDeadline" :min="todayYmd()" :error="deadlineError" />
					</div>
					<CommonAppButton variant="primary" :disabled="!newDeadline" :loading="working" @click="saveDeadline">
						Lưu hạn chót
					</CommonAppButton>
					<CommonAppButton variant="secondary" @click="showDeadlineForm = false">Thôi</CommonAppButton>
				</div>
				<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
					Bạn lùi hạn để chờ thêm, hoặc rút ngắn để chốt sớm. Các phòng đã nhận thông báo mở kỳ sẽ được báo hạn mới.
				</p>
			</div>

			<div
				v-if="showAddDepartments"
				class="rounded-xl border border-brand-200 bg-white p-4 shadow-sm dark:border-brand-700 dark:bg-gray-900"
			>
				<p class="text-sm font-medium text-gray-700 dark:text-gray-300">
					Thêm phòng vào kỳ
					<span class="ml-1 text-xs font-normal text-gray-500 dark:text-gray-400">
						đã chọn {{ addDepartmentIds.length }} phòng
					</span>
				</p>
				<div class="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2 dark:border-gray-700">
					<label
						v-for="dept in addableDepartments"
						:key="dept.id"
						class="flex min-h-11 cursor-pointer items-center gap-2 rounded px-1 text-sm text-gray-800 hover:bg-gray-50 sm:min-h-0 sm:py-1 dark:text-gray-200 dark:hover:bg-gray-800"
					>
						<input
							type="checkbox"
							class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
							:checked="addDepartmentIds.includes(dept.id)"
							@change="toggleAddDepartment(dept.id)"
						/>
						{{ dept.name }}
					</label>
				</div>
				<div class="mt-3 flex flex-wrap gap-3">
					<CommonAppButton
						variant="primary"
						:disabled="!addDepartmentIds.length"
						:loading="working"
						@click="addDepartments"
					>
						Thêm vào kỳ
					</CommonAppButton>
					<CommonAppButton variant="secondary" @click="showAddDepartments = false">Thôi</CommonAppButton>
				</div>
			</div>

			<!-- Hộp hỏi lại trước khi khoá sớm: nói còn mấy ngày và phòng nào chưa nhập gì. -->
			<div
				v-if="confirmLockPeriod"
				class="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20"
			>
				<p class="text-sm text-amber-900 dark:text-amber-200">
					Khoá kỳ {{ period.title }} ngay bây giờ thì các phòng không nhập hay sửa được nữa, dù hạn chót còn
					{{ daysToDeadline }} ngày.
					<template v-if="departmentsWithoutLines > 0">
						Hiện còn {{ departmentsWithoutLines }} phòng chưa nhập dòng nào, các phòng đó sẽ không kịp đăng ký.
					</template>
					Sau khi khoá, phòng cần thêm thì bạn tạo phiếu bổ sung.
				</p>
				<div class="mt-3 flex flex-wrap gap-3">
					<CommonAppButton variant="primary" :loading="working" @click="lockPeriod">Khoá kỳ ngay</CommonAppButton>
					<CommonAppButton variant="secondary" @click="confirmLockPeriod = false">Thôi</CommonAppButton>
				</div>
			</div>

			<!-- Hộp hỏi lại trước khi đóng kỳ: đóng kỳ là chốt sổ, không sửa số được nữa. -->
			<div
				v-if="confirmClosePeriod"
				class="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20"
			>
				<p class="text-sm text-amber-900 dark:text-amber-200">
					Đóng kỳ {{ period.title }} thì kỳ chốt sổ: bạn không sửa số chốt, số thực nhận hay đơn giá được nữa, và
					chi phí của kỳ giữ nguyên như bảng hiện tại. Bạn kiểm tra các phòng đã nhận hàng xong chưa trước khi đóng.
				</p>
				<div class="mt-3 flex flex-wrap gap-3">
					<CommonAppButton variant="primary" :loading="working" @click="closePeriod">Đóng kỳ này</CommonAppButton>
					<CommonAppButton variant="secondary" @click="confirmClosePeriod = false">Thôi</CommonAppButton>
				</div>
			</div>

			<div
				v-if="confirmCancelPeriod"
				class="rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-800 dark:bg-rose-900/20"
			>
				<p class="text-sm text-rose-800 dark:text-rose-300">
					Huỷ kỳ {{ period.title }} thì kỳ này biến mất khỏi danh sách và các phiếu rỗng của nó cũng mất. Bạn mở
					lại kỳ của tháng này bất cứ lúc nào.
				</p>
				<div class="mt-3 flex flex-wrap gap-3">
					<CommonAppButton variant="danger" :loading="working" @click="cancelPeriod">Huỷ kỳ này</CommonAppButton>
					<CommonAppButton variant="secondary" @click="confirmCancelPeriod = false">Thôi</CommonAppButton>
				</div>
			</div>

			<!-- Phiếu của từng phòng -->
			<section class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
				<h2 class="text-sm font-semibold text-gray-800 dark:text-gray-100">Phiếu của từng phòng</h2>
				<p v-if="!departments.length" class="py-6 text-sm text-gray-500 dark:text-gray-400">
					Kỳ này chưa có phòng nào tham gia.
				</p>
				<div v-else class="mt-3 space-y-2">
					<div
						v-for="dept in departments"
						:key="dept.departmentId"
						class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-800"
					>
						<p class="text-sm font-medium text-gray-900 dark:text-white">{{ dept.name }}</p>
						<div class="flex flex-wrap items-center gap-2">
							<button
								v-for="req in dept.requests"
								:key="req.id"
								type="button"
								class="inline-flex max-w-full items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-1.5 text-left text-xs transition-colors hover:border-brand-300 hover:bg-brand-50 dark:border-gray-700 dark:hover:border-brand-700 dark:hover:bg-brand-900/20"
								:title="req.note ?? undefined"
								@click="openRequestId = req.id"
							>
								<span class="text-gray-700 dark:text-gray-200">
									{{ req.sequence === 0 ? 'Phiếu chính' : `Bổ sung ${req.sequence}` }} · {{ req.lineCount }} dòng
									<!-- Ghi chú phiếu bổ sung nói vì sao phát sinh, nên hiện luôn chứ không giấu. -->
									<span v-if="req.note" class="block text-gray-500 dark:text-gray-400">{{ req.note }}</span>
								</span>
								<span :class="['flex-shrink-0 rounded-full px-2 py-0.5 font-medium', STATUS_CLASS[req.status]]">
									{{ req.statusLabel }}
								</span>
							</button>
							<span v-if="!dept.requests.length" class="text-xs text-gray-400">Chưa có phiếu</span>
						</div>
					</div>
				</div>
			</section>

			<!-- Ma trận mặt hàng × phòng -->
			<section class="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
				<div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
					<div>
						<h2 class="text-sm font-semibold text-gray-800 dark:text-gray-100">
							Bảng tổng hợp
							<!--
								Tổng tiền hiện ở ĐẦU bảng chứ không chỉ ở dòng cuối: dòng cuối nằm sát đáy trang,
								chỗ nút trợ lý nổi che mất, nên người đọc phải cuộn thêm mới thấy con số quan trọng nhất.
							-->
							<span class="ml-2 font-normal text-gray-600 dark:text-gray-300">
								Tổng tiền kỳ {{ officeMoney(summary.totalAmount) }}
							</span>
						</h2>
						<!--
							Nói rõ con số tiền ở bảng này là tiền CẦN MUA.
							Cùng một kỳ có hai con số tiền hợp lệ mà khác nghĩa: bảng này tính theo số cần mua
							(gồm dự trù), còn phiếu của phòng và báo cáo chi phí tính theo số phòng thực nhận.
							Không nói ra thì người đọc thấy 650.000 ở đây và 585.000 ở báo cáo rồi đi hỏi chỗ nào sai.
						-->
						<p class="text-xs text-gray-500 dark:text-gray-400">
							Số của mỗi phòng là số đã chốt; phiếu chưa chốt thì là số phòng xin.
							<template v-if="!departmentScope">Số cần mua bằng tổng số các phòng cộng dự trù.</template>
							<template v-else>Bạn đang xem phạm vi phòng mình, nên bảng không có dự trù của cả văn phòng.</template>
							Thành tiền ở bảng này là số cần mua nhân đơn giá, tức tiền phải mua; chi phí thực của từng
							phòng tính theo số thực nhận và nằm ở báo cáo chi phí.
						</p>
					</div>
					<CommonAppButton v-if="canEditPeriod" variant="primary" size="sm" :loading="savingItems" @click="saveItems">
						Lưu dự trù và đơn giá
					</CommonAppButton>
				</div>

				<p
					v-if="summary.unpricedRows > 0"
					class="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
				>
					{{ summary.unpricedRows }} mặt hàng chưa có đơn giá nên chưa tính vào tổng tiền. Bạn nhập đơn giá ở cột
					Đơn giá rồi lưu lại.
				</p>

				<p v-if="!summary.rows.length" class="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
					Chưa có phòng nào nhập dòng nào trong kỳ này.
				</p>

				<div v-else class="overflow-x-auto">
					<table class="w-full min-w-[900px] text-sm">
						<thead>
							<tr class="border-b border-gray-200 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
								<th class="sticky left-0 z-10 bg-white px-3 py-2 text-left dark:bg-gray-900">Mặt hàng</th>
								<th class="px-2 py-2 text-left">ĐVT</th>
								<th v-for="dept in departments" :key="dept.departmentId" class="px-2 py-2 text-right">
									{{ dept.name }}
								</th>
								<th class="px-2 py-2 text-right">Tổng</th>
								<!-- Phạm vi phòng ban không có hai cột này: xem ghi chú ở `departmentScope`. -->
								<template v-if="!departmentScope">
									<th class="px-2 py-2 text-right">Dự trù</th>
									<th class="px-2 py-2 text-right">Cần mua</th>
								</template>
								<th class="px-2 py-2 text-right">Đơn giá</th>
								<!--
									Điện thoại KHÔNG có cột Thành tiền: ghim nó ở mép phải thì nó đè lên cột số của
									phòng ban (tiêu đề chỉ còn "Tài c" và không thấy số nào). Thay vào đó mỗi dòng in
									thành tiền ngay dưới tên mặt hàng, ở ô dính bên trái, nơi còn chỗ.
								-->
								<th class="hidden px-2 py-2 text-right sm:table-cell">Thành tiền</th>
								<th class="px-2 py-2 text-left">Ghi chú</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
							<template v-for="group in groups" :key="group.groupName">
								<tr class="bg-gray-50 dark:bg-gray-800/60">
									<td
										class="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300"
										:colspan="totalColumns"
									>
										{{ group.numeral }}. {{ group.groupName }}
									</td>
								</tr>
								<!--
									Dòng có phòng xin vượt định mức được tô vàng: HCNS phải đọc lý do ở cột Ghi chú
									trước khi chốt, mà trong một bảng mấy chục dòng thì không ai tự soi ra.
								-->
								<tr
									v-for="row in group.rows"
									:key="`${group.groupName}-${row.itemId ?? row.name}`"
									:class="row.overQuota ? 'bg-amber-50/70 dark:bg-amber-900/10' : ''"
								>
									<td
										:class="[
											'sticky left-0 z-10 px-3 py-2 text-gray-900 dark:text-white',
											row.overQuota ? 'bg-amber-50 dark:bg-gray-900' : 'bg-white dark:bg-gray-900',
										]"
									>
										{{ row.name }}
										<span v-if="row.overQuota" class="block text-xs font-medium text-amber-700 dark:text-amber-400">
											có phòng xin vượt định mức
										</span>
										<!-- Thành tiền của dòng, chỉ trên điện thoại (bảng không có cột này ở đó). -->
										<span class="block text-xs text-gray-600 sm:hidden dark:text-gray-300">
											Thành tiền {{ officeMoney(row.amount) }}
										</span>
									</td>
									<td class="px-2 py-2 text-gray-600 dark:text-gray-300">{{ row.unit || '—' }}</td>
									<td
										v-for="dept in departments"
										:key="dept.departmentId"
										class="px-2 py-2 text-right text-gray-700 dark:text-gray-200"
									>
										{{ cellQty(row.cells, dept.departmentId) }}
									</td>
									<td class="px-2 py-2 text-right font-medium text-gray-900 dark:text-white">{{ row.totalQty }}</td>
									<template v-if="!departmentScope">
										<td class="px-2 py-2 text-right">
											<UiNumberInput
												v-if="canEditPeriod && row.itemId != null"
												v-model="reserveQty[row.itemId]"
												:min="0"
												:max="100000"
												:input-class="`${inputCls} text-right`"
											/>
											<span v-else class="text-gray-700 dark:text-gray-200">{{ row.reserveQty ?? '—' }}</span>
										</td>
										<td class="px-2 py-2 text-right font-semibold text-gray-900 dark:text-white">
											{{ row.purchaseQty }}
										</td>
									</template>
									<td class="px-2 py-2 text-right">
										<UiNumberInput
											v-if="canEditPeriod && row.itemId != null"
											v-model="unitPrice[row.itemId]"
											:min="0"
											:max="1000000000"
											:input-class="`${inputCls} text-right`"
										/>
										<span v-else class="text-gray-700 dark:text-gray-200">{{ officeMoney(row.unitPrice) }}</span>
									</td>
									<td class="hidden px-2 py-2 text-right text-gray-900 sm:table-cell dark:text-white">
										{{ officeMoney(row.amount) }}
									</td>
									<td class="px-2 py-2 text-xs text-gray-600 dark:text-gray-300">
										<p v-for="(note, idx) in row.notes" :key="idx">{{ note }}</p>
									</td>
								</tr>
							</template>
						</tbody>
						<tfoot>
							<tr class="border-t border-gray-200 dark:border-gray-700">
								<!--
									Ô nhãn trải hết phần đầu bảng để ô tiền đứng đúng dưới cột Thành tiền. Số cột đổi
									theo phạm vi, nên lấy `totalColumns` trừ hai ô cuối (thành tiền và ghi chú).
								-->
								<td class="px-3 py-2 font-medium text-gray-700 dark:text-gray-200" :colspan="totalColumns - 2">
									Tổng tiền kỳ
									<!-- Điện thoại không có cột Thành tiền, nên tổng tiền đi kèm nhãn ngay ở đây. -->
									<span class="font-semibold text-gray-900 sm:hidden dark:text-white">
										{{ officeMoney(summary.totalAmount) }}
									</span>
								</td>
								<td class="hidden px-2 py-2 text-right font-semibold text-gray-900 sm:table-cell dark:text-white">
									{{ officeMoney(summary.totalAmount) }}
								</td>
								<td />
							</tr>
						</tfoot>
					</table>
				</div>
				<p v-if="canManage" class="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
					Mặt hàng ngoài danh mục không có ô dự trù và ô đơn giá ở đây: đơn giá của chúng nhập khi bạn chốt phiếu
					của phòng.
				</p>
			</section>
		</template>

		<RequestDetailModal
			v-if="openRequestId"
			:request-id="openRequestId"
			:can-manage="canEditPeriod"
			@changed="onRequestChanged"
			@close="openRequestId = null"
		/>

		<SupplementModal
			v-if="showSupplement && period"
			:period-id="period.id"
			:period-title="period.title"
			:departments="departments"
			@created="onSupplementCreated"
			@close="showSupplement = false"
		/>
	</div>
</template>
