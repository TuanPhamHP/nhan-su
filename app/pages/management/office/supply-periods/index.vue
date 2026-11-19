<script setup lang="ts">
	import PeriodCreateModal from '~/components/modules/office/PeriodCreateModal.vue';
	import { useOfficeService } from '~/services/office.service';
	import { monthLabel, officeErrorMessage } from '~/utils/office.utils';
	import { formatDate } from '~/utils/date';
	import { OFFICE_PERMISSIONS } from '~/utils/permission';
	import type { OfficeSite, SupplyPeriod, SupplyPeriodStatus } from '~/types/office.types';

	/**
	 * Danh sách kỳ đăng ký văn phòng phẩm (UI-02).
	 *
	 * Trang mở cho cả HCNS và trưởng phòng: `permission-guard` gác bằng `office:supply:report`,
	 * còn nút mở kỳ chỉ hiện với `office:supply:manage`. Trưởng phòng mở kỳ ra chỉ thấy cột phòng
	 * mình, nên họ vẫn cần trang này để biết hạn chót và tình hình phòng mình.
	 */
	definePageMeta({ title: 'Kỳ đăng ký văn phòng phẩm' });

	const toast = useToast();
	const service = useOfficeService();
	const { hasPermission } = usePermissions();
	const { canWrite } = useModuleAccess();

	const canManage = computed(() => hasPermission(OFFICE_PERMISSIONS.supplyManage) && canWrite('OFFICE'));
	/** Quyền tạo văn phòng nằm ở Cài đặt hành chính, khác quyền mở kỳ. */
	const canSetUpOffice = computed(() => hasPermission(OFFICE_PERMISSIONS.manage) && canWrite('OFFICE'));

	const periods = ref<SupplyPeriod[]>([]);
	const sites = ref<OfficeSite[]>([]);
	const loading = ref(true);
	const loadError = ref<string | null>(null);
	const filterSiteId = ref<number | undefined>(undefined);
	const filterStatus = ref<SupplyPeriodStatus | undefined>(undefined);
	const showCreate = ref(false);

	const siteOptions = computed(() => [
		{ value: undefined, label: 'Tất cả văn phòng' },
		...sites.value.map(s => ({ value: s.id, label: s.name })),
	]);

	const statusOptions: Array<{ value: SupplyPeriodStatus | undefined; label: string }> = [
		{ value: undefined, label: 'Mọi trạng thái' },
		{ value: 'OPEN', label: 'Đang nhận đăng ký' },
		{ value: 'LOCKED', label: 'Đã khoá, chờ chốt và cấp' },
		{ value: 'CLOSED', label: 'Đã đóng' },
	];

	/** Màu viên trạng thái: đang nhận là xanh, đã khoá là hổ phách, đã đóng là xám. */
	const STATUS_CLASS: Record<SupplyPeriodStatus, string> = {
		OPEN: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
		LOCKED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
		CLOSED: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
	};

	async function loadPeriods() {
		loading.value = true;
		loadError.value = null;
		try {
			periods.value = await service.findPeriods({
				siteId: filterSiteId.value,
				status: filterStatus.value,
			});
		} catch (e) {
			periods.value = [];
			loadError.value = officeErrorMessage(e, 'Chưa tải được danh sách kỳ đăng ký. Bạn bấm Thử lại.');
		} finally {
			loading.value = false;
		}
	}

	async function loadSites() {
		try {
			sites.value = await service.findSites();
		} catch {
			// Thiếu danh sách văn phòng thì chỉ mất ô lọc, danh sách kỳ vẫn đọc được.
			sites.value = [];
		}
	}

	onMounted(async () => {
		await Promise.all([loadSites(), loadPeriods()]);
	});

	watch([filterSiteId, filterStatus], () => loadPeriods());

	function onCreated() {
		showCreate.value = false;
		loadPeriods();
	}

	/** Bao nhiêu phòng đã nhập, trên tổng số phòng tham gia. */
	function progressLabel(period: SupplyPeriod): string {
		if (period.departmentsTotal == null) return '';
		return `${period.departmentsWithLines ?? 0} / ${period.departmentsTotal} phòng đã nhập`;
	}

	/** Tên kỳ thường đã là "Tháng 12/2026", nên chỉ nhắc lại tháng khi tiêu đề kỳ khác đi. */
	function monthSuffix(period: SupplyPeriod): string {
		const label = monthLabel(period.month);
		return period.title.trim() === label ? '' : label;
	}
</script>

<template>
	<div class="space-y-5">
		<UiPageHeader
			title="Kỳ đăng ký văn phòng phẩm"
			description="Mỗi kỳ là một tháng chi phí của một văn phòng. Bạn mở kỳ, các phòng nhập tới hạn chót, rồi bạn chốt và cấp hàng theo từng phiếu."
		>
			<CommonAppButton v-if="canManage && sites.length" variant="primary" @click="showCreate = true">
				Mở kỳ mới
			</CommonAppButton>
		</UiPageHeader>

		<CommonAppModuleNotice module="OFFICE" />

		<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
			<div>
				<p class="mb-1 text-xs text-gray-500 dark:text-gray-400">Văn phòng</p>
				<UiSelect v-model="filterSiteId" :options="siteOptions" />
			</div>
			<div>
				<p class="mb-1 text-xs text-gray-500 dark:text-gray-400">Trạng thái</p>
				<UiSelect v-model="filterStatus" :options="statusOptions" />
			</div>
		</div>

		<div v-if="loading" class="space-y-3">
			<div v-for="i in 3" :key="i" class="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
		</div>

		<div
			v-else-if="loadError"
			class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300"
		>
			<p>{{ loadError }}</p>
			<CommonAppButton class="mt-3" size="sm" variant="outline" @click="loadPeriods">Thử lại</CommonAppButton>
		</div>

		<!--
			Chưa có văn phòng thì nút "Mở kỳ mới" cũng không hiện, nên câu "bấm Mở kỳ mới" chỉ đường tới
			một nút không có. Việc đầu tiên là tạo văn phòng ở Cài đặt hành chính, và chính HCNS làm việc
			đó, nên không bảo họ "liên hệ HCNS".
		-->
		<div
			v-else-if="!sites.length"
			class="rounded-xl border border-gray-200 bg-white py-16 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
		>
			<p>Công ty chưa có văn phòng nào nên chưa mở kỳ đăng ký được.</p>
			<p v-if="canSetUpOffice" class="mt-2">
				<!-- Dấu phẩy dính liền thẻ đóng, nếu không thì xuống dòng thành "Cài đặt hành chính ,". -->
				Bạn tạo văn phòng ở
				<NuxtLink to="/management/office/settings" class="text-brand-600 hover:underline dark:text-brand-400"
					>Cài đặt hành chính</NuxtLink
				>, rồi quay lại đây mở kỳ.
			</p>
			<p v-else class="mt-2">Bạn nhờ người quản trị tạo văn phòng ở Cài đặt hành chính trước.</p>
		</div>

		<p
			v-else-if="!periods.length"
			class="rounded-xl border border-gray-200 bg-white py-16 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
		>
			Chưa có kỳ đăng ký nào.<template v-if="canManage"> Bạn bấm Mở kỳ mới để mở kỳ đầu tiên.</template>
		</p>

		<div v-else class="space-y-3">
			<NuxtLink
				v-for="period in periods"
				:key="period.id"
				:to="`/management/office/supply-periods/${period.id}`"
				class="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-brand-700"
			>
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div>
						<p class="font-semibold text-gray-900 dark:text-white">{{ period.title }}</p>
						<p class="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
							{{ period.officeSite.name }}
							<template v-if="monthSuffix(period)"> · {{ monthSuffix(period) }}</template>
							· hạn chót {{ formatDate(period.deadline) }}
						</p>
					</div>
					<span :class="['inline-flex rounded-full px-2.5 py-1 text-xs font-medium', STATUS_CLASS[period.status]]">
						{{ period.statusLabel }}
					</span>
				</div>
				<div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
					<span v-if="progressLabel(period)">{{ progressLabel(period) }}</span>
					<span v-if="period.createdBy">Người mở: {{ period.createdBy.fullName }}</span>
					<span v-if="period.closedAt">Đã đóng ngày {{ formatDate(period.closedAt) }}</span>
				</div>
			</NuxtLink>
		</div>

		<PeriodCreateModal
			v-if="showCreate"
			:sites="sites"
			:periods="periods"
			@created="onCreated"
			@close="showCreate = false"
		/>
	</div>
</template>
