<script setup lang="ts">
	import OfficeDialog from '~/components/modules/office/OfficeDialog.vue';
	import OfficeFullscreen from '~/components/modules/office/OfficeFullscreen.vue';
	import PeriodDeadlineDialog from '~/components/modules/office/PeriodDeadlineDialog.vue';
	import PeriodDepartmentsCard from '~/components/modules/office/PeriodDepartmentsCard.vue';
	import PeriodStageBar from '~/components/modules/office/PeriodStageBar.vue';
	import PeriodSummaryTable from '~/components/modules/office/PeriodSummaryTable.vue';
	import RequestDetailModal from '~/components/modules/office/RequestDetailModal.vue';
	import SupplementModal from '~/components/modules/office/SupplementModal.vue';
	import { useSupplyPeriodDetail } from '~/composables/useSupplyPeriodDetail';
	import { monthLabel, officeMoney, supplyStatusMeta } from '~/utils/office.utils';
	import { vnCalendarDaysBetween } from '~/utils/date';
	import type { DropdownMenuItem } from '~/components/ui/DropdownMenu.vue';

	/**
	 * Chi tiết một kỳ đăng ký (UI-02): kỳ đang ở bước nào, phòng nào đã đăng ký, và bảng tổng hợp mỗi mặt
	 * hàng một dòng (số từng phòng ở dòng con mở ra được), cộng dự trù, số cần mua, đơn giá thực và thành tiền.
	 *
	 * Trưởng phòng mở trang này chỉ nhận về số của phòng mình và không có dự trù (máy chủ lọc), nên mọi ô
	 * nhập và nút ghi ở đây đều hỏi `office:supply:manage` trước khi hiện.
	 */
	definePageMeta({ title: 'Bảng tổng hợp kỳ đăng ký' });

	const detail = useSupplyPeriodDetail();
	const {
		canManage,
		canEditPeriod,
		departmentScope,
		summary,
		period,
		departments,
		rows,
		loading,
		loadError,
		notFound,
		now,
		registration,
		stageCounts,
		nextStep,
		departmentsWithoutLines,
		periodUntouched,
		reserveDraft,
		priceDraft,
		isDirty,
		setDraft,
		dirtyCount,
		hasChanges,
		saving,
		saveError,
		saveStatus,
		saveItems,
		discardChanges,
		search,
		onlyRegistered,
		onlyUnpriced,
		hasFilter,
		clearFilters,
		unpricedRows,
		groups,
		working,
		exporting,
		load,
		exportExcel,
		saveDeadline,
		lockPeriod,
		closePeriod,
		addDepartments,
		cancelPeriod,
		leavePending,
		answerLeave,
	} = detail;

	const directoryStore = useDirectoryStore();
	const { departments: allDepartments } = storeToRefs(directoryStore);

	const openRequestId = ref<number | null>(null);
	const showSupplement = ref(false);
	const dialog = ref<'deadline' | 'lock' | 'close' | 'cancel' | 'add' | 'export' | null>(null);
	const addDepartmentIds = ref<number[]>([]);

	/** Tên kỳ thường đã là "Tháng 12/2026", nên chỉ nhắc lại tháng khi tiêu đề kỳ khác đi. */
	const monthSuffix = computed(() => {
		if (!period.value) return '';
		const label = monthLabel(period.value.month);
		return period.value.title.trim() === label ? '' : label;
	});

	const isOpen = computed(() => period.value?.status === 'OPEN');
	const isLocked = computed(() => period.value?.status === 'LOCKED');

	/** Còn bao nhiêu ngày tới hạn chót, để hộp hỏi lại nói rõ khoá sớm là sớm bao nhiêu. */
	const daysToDeadline = computed(() =>
		period.value ? Math.max(vnCalendarDaysBetween(new Date(), `${period.value.deadline}T00:00:00+07:00`), 0) : 0,
	);

	/** Đã qua giờ khoá mà job khoá kỳ (00:05) chưa chạy. */
	const lockPassed = computed(() => !!period.value && new Date(period.value.lockAt).getTime() <= now.value.getTime());

	/** Phòng chưa tham gia kỳ, để thêm vào kỳ còn mở. */
	const addableDepartments = computed(() => {
		const joined = new Set(departments.value.map(d => d.departmentId));
		return allDepartments.value.filter(d => d.isActive && !joined.has(d.id));
	});

	/**
	 * Việc ít dùng hoặc có rủi ro nằm trong menu: khoá sớm, huỷ kỳ không quay lại được nên không đứng
	 * ngang hàng với Xuất Excel. Điều kiện hiện của từng việc giữ đúng như trước khi đổi bố cục.
	 */
	const menuItems = computed<DropdownMenuItem[]>(() => [
		{
			label: 'Thêm phòng',
			icon: 'heroicons:user-group',
			action: () => {
				addDepartmentIds.value = [];
				dialog.value = 'add';
			},
			hidden: !(canEditPeriod.value && isOpen.value && addableDepartments.value.length),
		},
		{
			label: 'Phiếu bổ sung',
			icon: 'heroicons:document-plus',
			action: () => (showSupplement.value = true),
			hidden: !(canEditPeriod.value && isLocked.value),
		},
		{
			label: 'Đóng kỳ',
			icon: 'heroicons:archive-box',
			action: () => (dialog.value = 'close'),
			hidden: !(canEditPeriod.value && isLocked.value && nextStep.value?.kind !== 'close'),
		},
		{
			label: 'Khoá sớm',
			icon: 'heroicons:lock-closed',
			action: () => (dialog.value = 'lock'),
			variant: 'danger',
			hidden: !(canEditPeriod.value && isOpen.value),
		},
		{
			label: 'Huỷ kỳ',
			icon: 'heroicons:trash',
			action: () => (dialog.value = 'cancel'),
			variant: 'danger',
			hidden: !(canEditPeriod.value && isOpen.value && periodUntouched.value),
		},
	]);
	const hasMenu = computed(() => menuItems.value.some(item => !item.hidden));

	/** Nút chính theo giai đoạn: chốt phiếu chưa chốt, cấp phiếu đã chốt, rồi đóng kỳ. */
	const primaryLabel = computed(() => {
		const step = nextStep.value;
		if (!step) return '';
		const supplement = step.sequence ? ` (bổ sung ${step.sequence})` : '';
		if (step.kind === 'finalize') return `Chốt phiếu ${step.departmentName}${supplement}`;
		if (step.kind === 'issue') return `Cấp hàng ${step.departmentName}${supplement}`;
		return 'Đóng kỳ';
	});

	function onPrimary() {
		const step = nextStep.value;
		if (!step) return;
		if (step.kind === 'close') dialog.value = 'close';
		else if (step.requestId) openRequestId.value = step.requestId;
	}

	/** Xuất Excel khi còn số chưa lưu thì hỏi: file lấy theo số đã lưu trên máy chủ. */
	function onExport() {
		if (hasChanges.value) dialog.value = 'export';
		else exportExcel();
	}

	async function saveThenExport() {
		dialog.value = null;
		if (await saveItems()) await exportExcel();
	}

	async function confirm(task: () => Promise<boolean>) {
		if (await task()) dialog.value = null;
	}

	function toggleAddDepartment(id: number) {
		addDepartmentIds.value = addDepartmentIds.value.includes(id)
			? addDepartmentIds.value.filter(x => x !== id)
			: [...addDepartmentIds.value, id];
	}

	/** Đến mặt hàng thiếu đơn giá đầu tiên: cuộn tới dòng và đặt con trỏ vào ô đơn giá. */
	async function goToFirstUnpriced() {
		const target = unpricedRows.value.find(row => row.itemId != null) ?? unpricedRows.value[0];
		if (!target) return;
		search.value = '';
		await nextTick();
		const id = target.itemId;
		if (id == null) {
			onlyUnpriced.value = true;
			return;
		}
		document.getElementById(`summary-row-${id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
		document.querySelector<HTMLInputElement>(`#price-cell-${id} input`)?.focus({ preventScroll: true });
	}

	function onRequestChanged() {
		// Chốt hay cấp một phiếu đổi cả ma trận (số đã chốt, thành tiền), nên tải lại bảng.
		load(true);
	}

	function onSupplementCreated() {
		showSupplement.value = false;
		load(true);
	}

	const lockedReason = computed(() => (period.value?.status === 'CLOSED' ? 'Kỳ đã đóng nên không sửa được.' : ''));

	// ─── Giải thích cách tính, mở từ dấu ⓘ cạnh tiêu đề bảng ─────────────────
	const { open: helpOpen, root: helpRoot, alignEnd: helpAlignEnd, toggle: toggleHelp } = usePopover();

	// ─── Bảng toàn màn hình ───────────────────────────────────────────────────
	const tableFullscreen = ref(false);
	const fullscreenBtn = ref<HTMLButtonElement | null>(null);

	/** Đóng xong thì con trỏ về nút mở, vì khi bảng chuyển chỗ trình duyệt đã bỏ mất con trỏ. */
	function setTableFullscreen(open: boolean) {
		tableFullscreen.value = open;
		if (!open) nextTick(() => fullscreenBtn.value?.focus());
	}

	onMounted(() => {
		directoryStore.load().catch(() => {
			// Thiếu danh sách phòng ban thì chỉ mất việc Thêm phòng, bảng tổng hợp vẫn đọc được.
		});
	});
</script>

<template>
	<div class="space-y-4">
		<NuxtLink
			to="/management/office/supply-periods"
			class="inline-flex items-center gap-1 rounded text-sm text-gray-500 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-gray-400 dark:hover:text-gray-200"
		>
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
			</svg>
			Kỳ đăng ký văn phòng phẩm
		</NuxtLink>

		<div v-if="loading" class="space-y-3" aria-busy="true">
			<div class="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
			<div class="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
			<div class="h-80 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
		</div>

		<div
			v-else-if="loadError"
			role="alert"
			class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300"
		>
			<p>{{ loadError }}</p>
			<div class="mt-3 flex flex-wrap gap-2">
				<CommonAppButton v-if="!notFound" size="sm" variant="outline" @click="load()">Thử lại</CommonAppButton>
				<CommonAppButton size="sm" variant="outline" @click="navigateTo('/management/office/supply-periods')">
					Về danh sách kỳ
				</CommonAppButton>
			</div>
		</div>

		<template v-else-if="period && summary">
			<UiPageHeader
				:title="period.title"
				description="Đầu trang cho biết kỳ đang ở bước nào và phòng nào đã đăng ký. Bấm chip một phòng để mở phiếu của phòng đó: chốt, cấp và theo dõi đã nhận hàng chưa. Ở bảng tổng hợp bạn nhập dự trù và đơn giá; số vừa sửa được đánh dấu và lưu bằng nút ở thanh dưới cùng."
			>
				<CommonAppButton variant="outline" :loading="exporting" @click="onExport">Xuất Excel</CommonAppButton>
				<CommonAppButton v-if="canEditPeriod && isOpen" variant="outline" @click="dialog = 'deadline'">
					Đổi hạn chót
				</CommonAppButton>
				<CommonAppButton v-if="primaryLabel" data-tour="period-next-step" variant="primary" @click="onPrimary">
					{{ primaryLabel }}
				</CommonAppButton>
				<UiDropdownMenu v-if="hasMenu" :items="menuItems" label="Khác" />
			</UiPageHeader>

			<div class="-mt-2 flex flex-wrap items-center gap-2">
				<span :class="['inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', supplyStatusMeta(period.status).class]">
					{{ supplyStatusMeta(period.status).label }}
				</span>
				<span v-if="monthSuffix" class="text-sm text-gray-600 dark:text-gray-400">{{ monthSuffix }}</span>
				<span v-if="period.status === 'LOCKED' && period.statusLabel !== supplyStatusMeta('LOCKED').label" class="text-sm text-gray-600 dark:text-gray-400">
					· {{ period.statusLabel }}
				</span>
			</div>

			<CommonAppModuleNotice module="OFFICE" />

			<PeriodStageBar :period="period" :now="now" :counts="stageCounts" />

			<PeriodDepartmentsCard
				:key="period.status"
				:departments="departments"
				:period-status="period.status"
				:can-act="canEditPeriod"
				:registered="registration.done"
				@open="openRequestId = $event"
			/>

			<!--
				Bảng tổng hợp và thanh lưu đi cùng nhau khi mở toàn màn hình: ở đó vẫn nhập, lọc và lưu được
				như trong trang, không phải đóng ra mới bấm Lưu.
			-->
			<OfficeFullscreen
				:open="tableFullscreen"
				:title="`Bảng tổng hợp · ${period.title}`"
				inline-class="space-y-4"
				@close="setTableFullscreen(false)"
			>
				<section
					:class="
						tableFullscreen
							? 'flex min-h-0 flex-1 flex-col bg-white dark:bg-gray-900'
							: 'rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900'
					"
					aria-labelledby="period-summary-title"
				>
					<div class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
						<div ref="helpRoot" class="relative flex items-center gap-1.5">
							<h2 id="period-summary-title" class="text-sm font-semibold text-gray-800 dark:text-gray-100">Bảng tổng hợp</h2>
							<button
								type="button"
								data-popover-trigger
								:aria-expanded="helpOpen"
								aria-label="Cách tính của bảng tổng hợp"
								class="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
								@click="toggleHelp()"
							>
								<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
									<circle cx="12" cy="12" r="9" />
									<path stroke-linecap="round" d="M12 11v5M12 8h.01" />
								</svg>
							</button>
							<!--
								Nói rõ con số tiền ở bảng này là tiền CẦN MUA: bảng này tính theo số cần mua (gồm dự trù),
								còn phiếu của phòng và báo cáo chi phí tính theo số phòng thực nhận.
							-->
							<div
								v-if="helpOpen"
								role="dialog"
								aria-label="Cách tính của bảng tổng hợp"
								:class="[
									'absolute top-full z-40 mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 bg-white p-3 text-xs leading-relaxed text-gray-600 shadow-xl dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300',
									helpAlignEnd ? 'right-0' : 'left-0',
								]"
							>
								Số của mỗi phòng là số đã chốt; phiếu chưa chốt thì là số phòng xin.
								<template v-if="!departmentScope">Số cần mua bằng tổng số các phòng cộng dự trù.</template>
								<template v-else>Bạn đang xem phạm vi phòng mình, nên bảng không có dự trù của cả văn phòng.</template>
								Thành tiền ở bảng này là số cần mua nhân đơn giá, tức tiền phải mua; chi phí thực của từng phòng tính
								theo số thực nhận và nằm ở báo cáo chi phí.
							</div>
						</div>

						<div class="relative w-full sm:w-64">
							<svg class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
								<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
							</svg>
							<input
								v-model="search"
								type="search"
								aria-label="Tìm mặt hàng"
								placeholder="Tìm mặt hàng"
								class="h-9 w-full rounded-lg border border-gray-300 bg-white pl-8 pr-3 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							/>
						</div>
						<label class="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
							<input v-model="onlyRegistered" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
							Chỉ mặt hàng có đăng ký
						</label>
						<label v-if="unpricedRows.length" class="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
							<input v-model="onlyUnpriced" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
							Thiếu đơn giá ({{ unpricedRows.length }})
						</label>
						<button
							v-if="rows.length"
							ref="fullscreenBtn"
							type="button"
							:aria-label="tableFullscreen ? 'Thu nhỏ bảng' : 'Xem bảng toàn màn hình'"
							:title="tableFullscreen ? 'Thu nhỏ bảng (Esc)' : 'Xem bảng toàn màn hình'"
							class="ml-auto flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-400 hover:bg-brand-100 hover:text-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:bg-gray-800 dark:hover:bg-gray-700 dark:hover:text-brand-300"
							@click="setTableFullscreen(!tableFullscreen)"
						>
							<svg v-if="tableFullscreen" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25"
								/>
							</svg>
							<svg v-else class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
								/>
							</svg>
						</button>
					</div>

					<div
						v-if="unpricedRows.length"
						data-tour="period-unpriced"
						class="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
					>
						<span>{{ unpricedRows.length }} mặt hàng chưa có đơn giá nên chưa tính vào tổng tiền.</span>
						<button
							v-if="canEditPeriod"
							type="button"
							class="rounded font-medium underline hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
							@click="goToFirstUnpriced"
						>
							Đến mặt hàng đầu tiên
						</button>
					</div>

					<p v-if="!rows.length" class="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
						Chưa có phòng nào đăng ký dòng nào trong kỳ này.
					</p>
					<div v-else-if="!groups.length" class="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
						<p>Không có mặt hàng phù hợp.</p>
						<CommonAppButton v-if="hasFilter" class="mt-3" size="sm" variant="outline" @click="clearFilters">Xoá bộ lọc</CommonAppButton>
					</div>
					<PeriodSummaryTable
						v-else
						data-tour="period-summary"
						:groups="groups"
						:departments="departments"
						:department-scope="departmentScope"
						:can-edit="canEditPeriod"
						:locked-reason="lockedReason"
						:reserve-draft="reserveDraft"
						:price-draft="priceDraft"
						:is-dirty="isDirty"
						:fill="tableFullscreen"
						@draft="setDraft"
					/>
					<p v-if="canManage" class="border-t border-gray-100 px-4 py-2 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
						Mặt hàng ngoài danh mục không có ô dự trù và ô đơn giá ở đây: đơn giá của chúng nhập khi bạn chốt phiếu của
						phòng.
					</p>
				</section>

				<!--
					Thanh dưới dính đáy: tổng tiền kỳ luôn thấy khi đang nhập giá, và nút lưu duy nhất của bảng.
					`-bottom-4 lg:-bottom-6` bù phần đệm của `<main>` như trang Văn phòng phẩm; `pr-24` chừa chỗ
					cho nút trợ lý nổi ở góc dưới phải. Ở chế độ toàn màn hình thanh nằm đáy khung, không cần dính.
				-->
				<div
					data-tour="period-save-bar"
					:class="[
						'z-20 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-gray-200 bg-white/95 py-2.5 pl-4 pr-24 text-sm backdrop-blur dark:border-gray-700 dark:bg-gray-900/95',
						tableFullscreen ? '' : 'sticky -bottom-4 -mx-4 lg:-bottom-6 lg:-mx-6 lg:pl-6',
					]"
				>
					<p class="text-gray-700 dark:text-gray-300">
						Tổng tiền kỳ
						<span class="font-semibold tabular-nums text-gray-900 dark:text-white">{{ officeMoney(summary.totalAmount) }} đ</span>
						<template v-if="unpricedRows.length">
							<span class="text-amber-700 dark:text-amber-400"> · chưa gồm {{ unpricedRows.length }} mặt hàng chưa có đơn giá</span>
							<button
								type="button"
								class="ml-1 rounded font-medium text-brand-600 underline hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-brand-400"
								@click="goToFirstUnpriced"
							>
								Xem
							</button>
						</template>
						<span v-if="hasChanges" class="block text-xs text-gray-500 dark:text-gray-400">Tổng tiền tính theo số đã lưu.</span>
					</p>
					<div v-if="canEditPeriod" class="flex flex-wrap items-center gap-2" role="status" aria-live="polite">
						<template v-if="saveError">
							<span class="font-medium text-rose-600 dark:text-rose-400">{{ saveError }}</span>
						</template>
						<template v-if="hasChanges">
							<span class="font-medium text-amber-700 dark:text-amber-400">
								<span class="tabular-nums">{{ dirtyCount }}</span> thay đổi chưa lưu
							</span>
							<CommonAppButton size="sm" variant="ghost" :disabled="saving" @click="discardChanges">Huỷ thay đổi</CommonAppButton>
							<CommonAppButton size="sm" variant="primary" :loading="saving" @click="saveItems">
								{{ saveError ? 'Thử lại' : 'Lưu dự trù và đơn giá' }}
							</CommonAppButton>
						</template>
						<span v-else-if="saveStatus" class="text-emerald-600 dark:text-emerald-400">✓ {{ saveStatus }}</span>
					</div>
				</div>
			</OfficeFullscreen>
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

		<PeriodDeadlineDialog
			v-if="dialog === 'deadline' && period"
			:current="period.deadline"
			:saving="working"
			:save="saveDeadline"
			@close="dialog = null"
		/>

		<!--
			Khoá sớm: nói đúng hệ quả theo máy chủ. Khoá là cắt cửa đăng ký của mọi phòng trước hạn, trưởng
			phòng và đầu mối nhận thông báo, và không có đường mở lại; phòng cần thêm thì tạo phiếu bổ sung.
		-->
		<OfficeDialog v-if="dialog === 'lock' && period" title="Khoá kỳ ngay bây giờ?" :busy="working" @close="dialog = null">
			<p>
				Khoá kỳ {{ period.title }} thì các phòng không đăng ký hay sửa được nữa<template v-if="lockPassed"
					>. Hạn chót đã qua, máy chủ tự khoá kỳ ở lần chạy kế tiếp lúc 00:05</template
				><template v-else-if="daysToDeadline > 0">, dù hạn chót còn {{ daysToDeadline }} ngày</template
				><template v-else>, dù hôm nay mới là hạn chót</template>.
				<template v-if="departmentsWithoutLines > 0">
					Hiện còn {{ departmentsWithoutLines }} phòng chưa đăng ký dòng nào, các phòng đó sẽ không kịp đăng ký.
				</template>
			</p>
			<p class="mt-2">
				Trưởng phòng và đầu mối của các phòng nhận thông báo kỳ đã khoá. Kỳ đã khoá không mở lại được; phòng cần thêm thì
				bạn tạo phiếu bổ sung.
			</p>
			<template #actions>
				<CommonAppButton variant="secondary" :disabled="working" @click="dialog = null">Thôi</CommonAppButton>
				<CommonAppButton variant="danger" :loading="working" @click="confirm(lockPeriod)">Khoá kỳ ngay</CommonAppButton>
			</template>
		</OfficeDialog>

		<OfficeDialog v-if="dialog === 'close' && period" title="Đóng kỳ?" :busy="working" @close="dialog = null">
			<p>
				Đóng kỳ {{ period.title }} thì kỳ chốt sổ: bạn không sửa số chốt, số thực nhận hay đơn giá được nữa, và chi phí
				của kỳ giữ nguyên như bảng hiện tại. Bạn kiểm tra các phòng đã nhận hàng xong chưa trước khi đóng.
			</p>
			<template #actions>
				<CommonAppButton variant="secondary" :disabled="working" @click="dialog = null">Thôi</CommonAppButton>
				<CommonAppButton variant="primary" :loading="working" @click="confirm(closePeriod)">Đóng kỳ này</CommonAppButton>
			</template>
		</OfficeDialog>

		<OfficeDialog v-if="dialog === 'cancel' && period" title="Huỷ kỳ?" :busy="working" @close="dialog = null">
			<p>
				Huỷ kỳ {{ period.title }} thì kỳ này biến mất khỏi danh sách và các phiếu rỗng của nó cũng mất. Bạn mở lại kỳ
				của tháng này bất cứ lúc nào.
			</p>
			<template #actions>
				<CommonAppButton variant="secondary" :disabled="working" @click="dialog = null">Thôi</CommonAppButton>
				<CommonAppButton variant="danger" :loading="working" @click="confirm(cancelPeriod)">Huỷ kỳ này</CommonAppButton>
			</template>
		</OfficeDialog>

		<OfficeDialog v-if="dialog === 'add'" title="Thêm phòng vào kỳ" :busy="working" @close="dialog = null">
			<p class="text-xs text-gray-500 dark:text-gray-400">
				Mỗi phòng thêm vào có sẵn một phiếu rỗng và nhân viên phòng đó nhận thông báo mở kỳ. Đã chọn
				{{ addDepartmentIds.length }} phòng.
			</p>
			<div class="mt-2 grid max-h-60 grid-cols-1 gap-x-3 overflow-y-auto rounded-lg border border-gray-200 p-2 sm:grid-cols-2 dark:border-gray-700">
				<label
					v-for="dept in addableDepartments"
					:key="dept.id"
					class="flex cursor-pointer items-start gap-2 rounded px-1 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
				>
					<input
						type="checkbox"
						class="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
						:checked="addDepartmentIds.includes(dept.id)"
						@change="toggleAddDepartment(dept.id)"
					/>
					<span class="[overflow-wrap:anywhere]">{{ dept.name }}</span>
				</label>
			</div>
			<template #actions>
				<CommonAppButton variant="secondary" :disabled="working" @click="dialog = null">Thôi</CommonAppButton>
				<CommonAppButton
					variant="primary"
					:disabled="!addDepartmentIds.length"
					:loading="working"
					@click="confirm(() => addDepartments(addDepartmentIds))"
				>
					Thêm {{ addDepartmentIds.length || '' }} phòng vào kỳ
				</CommonAppButton>
			</template>
		</OfficeDialog>

		<OfficeDialog v-if="dialog === 'export'" title="Còn thay đổi chưa lưu" :busy="saving || exporting" @close="dialog = null">
			<p>
				Bảng còn {{ dirtyCount }} thay đổi chưa lưu. File Excel lấy số đã lưu trên máy chủ, nên bạn lưu trước nếu muốn file
				có các số vừa sửa.
			</p>
			<template #actions>
				<CommonAppButton variant="secondary" @click="dialog = null">Huỷ</CommonAppButton>
				<CommonAppButton
					variant="outline"
					@click="
						dialog = null;
						exportExcel();
					"
				>
					Xuất bản đã lưu
				</CommonAppButton>
				<CommonAppButton variant="primary" :loading="saving" @click="saveThenExport">Lưu rồi xuất</CommonAppButton>
			</template>
		</OfficeDialog>

		<OfficeDialog v-if="leavePending" title="Rời trang khi chưa lưu?" @close="answerLeave(false)">
			<p>Bảng còn {{ dirtyCount }} thay đổi dự trù, đơn giá chưa lưu. Rời trang thì các số này mất.</p>
			<template #actions>
				<CommonAppButton variant="primary" @click="answerLeave(false)">Ở lại</CommonAppButton>
				<CommonAppButton variant="danger_outline" @click="answerLeave(true)">Bỏ thay đổi và rời trang</CommonAppButton>
			</template>
		</OfficeDialog>
	</div>
</template>
