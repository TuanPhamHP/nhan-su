<script setup lang="ts">
	import PeriodCreateModal from '~/components/modules/office/PeriodCreateModal.vue';
	import SupplyPeriodCard from '~/components/modules/office/SupplyPeriodCard.vue';
	import { MAX_PERIOD_SUGGESTIONS, useSupplyPeriods } from '~/composables/useSupplyPeriods';
	import { SUPPLY_STATUS, monthLabel } from '~/utils/office.utils';
	import { officeSupplyPeriodOpenTour } from '~/tours/office-supply-period';
	import type { SupplyPeriodStatus } from '~/types/office.types';

	/**
	 * Danh sách kỳ đăng ký văn phòng phẩm (UI-02).
	 *
	 * Trang mở cho cả HCNS và trưởng phòng: `permission-guard` gác bằng `office:supply:report`,
	 * còn nút mở kỳ và gợi ý mở kỳ chỉ hiện với `office:supply:manage`. Trưởng phòng mở kỳ ra chỉ thấy
	 * cột phòng mình, nên họ vẫn cần trang này để biết hạn chót và tình hình phòng mình.
	 */
	definePageMeta({ title: 'Kỳ đăng ký văn phòng phẩm' });

	const {
		canManage,
		canSetUpOffice,
		periods,
		sites,
		loading,
		loadError,
		loadingSites,
		sitesError,
		now,
		filterSiteId,
		filterStatus,
		hasFilter,
		clearFilters,
		groups,
		suggestions,
		init,
		loadPeriods,
		loadSites,
		createOpen,
		createPreset,
		openCreate,
		closeCreate,
		createPeriod,
	} = useSupplyPeriods();

	const showClosed = ref(false);

	const siteOptions = computed(() => [
		{ value: undefined, label: 'Tất cả văn phòng' },
		...sites.value.map(s => ({ value: s.id, label: s.name })),
	]);

	const statusOptions: Array<{ value: SupplyPeriodStatus | undefined; label: string }> = [
		{ value: undefined, label: 'Mọi trạng thái' },
		{ value: 'OPEN', label: SUPPLY_STATUS.OPEN.label },
		{ value: 'LOCKED', label: SUPPLY_STATUS.LOCKED.label },
		{ value: 'CLOSED', label: SUPPLY_STATUS.CLOSED.label },
	];

	const shownSuggestions = computed(() => suggestions.value.slice(0, MAX_PERIOD_SUGGESTIONS));
	const moreSuggestions = computed(() => suggestions.value.length - shownSuggestions.value.length);

	/** Đang lọc riêng "Đã đóng" thì mở sẵn nhóm đó, không bắt bấm thêm một lần nữa mới thấy. */
	const closedExpanded = computed(() => showClosed.value || filterStatus.value === 'CLOSED');

	onMounted(init);

	// Hướng dẫn "Mở kỳ văn phòng phẩm", mở từ nút Hướng dẫn nổi bên phải.
	useGuideTour('office-supply-period-open', () =>
		officeSupplyPeriodOpenTour({
			canManage: () => canManage.value,
			hasSites: () => sites.value.length > 0,
			hasPeriods: () => periods.value.length > 0,
			hasSuggestion: () => suggestions.value.length > 0,
			isFormOpen: () => createOpen.value,
			closeForm: closeCreate,
		}),
	);
</script>

<template>
	<div class="space-y-5">
		<UiPageHeader
			title="Kỳ đăng ký văn phòng phẩm"
			description="Mỗi kỳ là một tháng chi phí của một văn phòng. Bạn mở kỳ, các phòng đăng ký tới hạn chót, phiếu tự khoá lúc 00:00 ngày sau hạn chót, rồi bạn chốt và cấp hàng theo từng phiếu. Thẻ kỳ cho biết bao nhiêu phòng đã đăng ký và còn bao lâu."
		>
			<CommonAppButton
				v-if="canManage && sites.length"
				data-tour="period-open"
				variant="primary"
				@click="openCreate()"
			>
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

		<div v-if="loading || loadingSites" class="space-y-3" aria-busy="true">
			<div v-for="i in 3" :key="i" class="h-32 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
		</div>

		<div
			v-else-if="loadError"
			class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300"
		>
			<p>{{ loadError }}</p>
			<CommonAppButton class="mt-3" size="sm" variant="outline" @click="loadPeriods()">Thử lại</CommonAppButton>
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
			<template v-if="sitesError">
				<p>{{ sitesError }}</p>
				<CommonAppButton class="mt-3" size="sm" variant="outline" @click="loadSites">Thử lại</CommonAppButton>
			</template>
			<template v-else>
				<p>Công ty chưa có văn phòng nào nên chưa mở kỳ đăng ký được.</p>
				<p v-if="canSetUpOffice" class="mt-2">
					Bạn tạo văn phòng ở
					<NuxtLink to="/management/office/settings?tab=places" class="text-brand-600 hover:underline dark:text-brand-400"
						>Cài đặt hành chính → Văn phòng và phòng họp</NuxtLink
					>, rồi quay lại đây mở kỳ.
				</p>
				<p v-else class="mt-2">Bạn nhờ người quản trị tạo văn phòng ở Cài đặt hành chính trước.</p>
			</template>
		</div>

		<div
			v-else-if="!periods.length"
			class="rounded-xl border border-gray-200 bg-white py-16 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
		>
			<p>Chưa có kỳ nào.</p>
			<CommonAppButton v-if="canManage" class="mt-3" variant="primary" @click="openCreate()">Mở kỳ đầu tiên</CommonAppButton>
		</div>

		<template v-else>
			<!-- Gợi ý mở kỳ tháng sau: chỉ khi kỳ gần nhất của văn phòng đã khoá hoặc đã đóng. -->
			<section
				v-if="shownSuggestions.length"
				data-tour="period-suggest"
				aria-label="Gợi ý mở kỳ tiếp theo"
				class="space-y-2 rounded-xl border border-brand-200 bg-brand-50 p-3 dark:border-brand-800 dark:bg-brand-900/20"
			>
				<div
					v-for="s in shownSuggestions"
					:key="s.site.id"
					class="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-800 dark:text-gray-200"
				>
					<span class="[overflow-wrap:anywhere]">
						Chưa có kỳ {{ monthLabel(s.month).toLocaleLowerCase('vi') }} · {{ s.site.name }}
					</span>
					<CommonAppButton size="sm" variant="primary" @click="openCreate({ siteId: s.site.id, month: s.month })">
						Mở kỳ {{ monthLabel(s.month).toLocaleLowerCase('vi') }}
					</CommonAppButton>
				</div>
				<p v-if="moreSuggestions > 0" class="text-xs text-gray-600 dark:text-gray-400">
					Còn {{ moreSuggestions }} văn phòng nữa chưa có kỳ tiếp theo.
				</p>
			</section>

			<div
				v-if="!groups.active.length && !groups.closed.length"
				class="rounded-xl border border-gray-200 bg-white py-12 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
			>
				<p>Không có kỳ phù hợp.</p>
				<CommonAppButton v-if="hasFilter" class="mt-3" size="sm" variant="outline" @click="clearFilters">
					Xoá bộ lọc
				</CommonAppButton>
			</div>

			<section v-if="groups.active.length" aria-labelledby="periods-active" class="space-y-3">
				<h2 id="periods-active" class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
					Đang diễn ra
				</h2>
				<div data-tour="period-list" class="space-y-3">
					<SupplyPeriodCard v-for="period in groups.active" :key="period.id" :period="period" :now="now" />
				</div>
			</section>

			<!-- Chưa có kỳ nào đang diễn ra thì mốc của hướng dẫn nằm trên cả nhóm, vì danh sách đang thu gọn. -->
			<section
				v-if="groups.closed.length"
				aria-labelledby="periods-closed"
				:data-tour="groups.active.length ? undefined : 'period-list'"
				class="space-y-3"
			>
				<h2 id="periods-closed">
					<button
						type="button"
						:aria-expanded="closedExpanded"
						aria-controls="periods-closed-list"
						class="flex items-center gap-1.5 rounded text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-gray-400 dark:hover:text-gray-200"
						@click="showClosed = !closedExpanded"
					>
						<svg
							:class="['h-3.5 w-3.5 transition-transform', closedExpanded ? 'rotate-90' : '']"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2.5"
							aria-hidden="true"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
						</svg>
						Đã đóng ({{ groups.closed.length }})
					</button>
				</h2>
				<div
					v-show="closedExpanded"
					id="periods-closed-list"
					class="space-y-3"
				>
					<SupplyPeriodCard v-for="period in groups.closed" :key="period.id" :period="period" :now="now" />
				</div>
			</section>
		</template>

		<PeriodCreateModal
			v-if="createOpen"
			:sites="sites"
			:periods="periods"
			:preset="createPreset"
			:loading-sites="loadingSites"
			:sites-error="sitesError"
			:can-set-up-office="canSetUpOffice"
			:submit="createPeriod"
			@close="closeCreate"
			@retry-sites="loadSites"
		/>
	</div>
</template>
