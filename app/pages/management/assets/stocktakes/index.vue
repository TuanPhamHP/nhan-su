<script setup lang="ts">
	import { useAssetService } from '~/services/asset.service';
	import StocktakeCreateModal from '~/components/modules/asset/StocktakeCreateModal.vue';
	import StocktakeOneOpenHint from '~/components/modules/asset/StocktakeOneOpenHint.vue';
	import { STOCKTAKE_STATUS_CLASS } from '~/utils/asset.utils';
	import { formatDateTime } from '~/utils/date';
	import {
		ASSET_STOCKTAKE_STATUS_LABELS,
		type AssetStocktake,
		type AssetStocktakeRef,
		type AssetStocktakeStatus,
	} from '~/types/asset.types';

	definePageMeta({ title: 'Kiểm kê tài sản' });

	const router = useRouter();
	const service = useAssetService();
	const { canWrite } = useModuleAccess();
	const { hasPermission } = usePermissions();

	const canManage = computed(() => canWrite('ASSET') && hasPermission('asset:manage'));

	const filterStatus = ref<AssetStocktakeStatus | ''>('');
	const page = ref(1);
	const limit = 20;

	const items = ref<AssetStocktake[]>([]);
	const meta = ref<{ total: number; totalPages: number } | null>(null);
	const loading = ref(true);
	const loadError = ref<string | null>(null);
	/** Đợt đang mở (L13): khoá nút Mở đợt kiểm kê và ghi tên đợt vào tooltip. */
	const openRef = ref<AssetStocktakeRef | null>(null);
	const showCreate = ref(false);

	async function load() {
		loading.value = true;
		loadError.value = null;
		try {
			const [res, open] = await Promise.all([
				service.findStocktakes({ status: filterStatus.value || undefined, page: page.value, limit }),
				service.openStocktake(),
			]);
			items.value = res.data;
			meta.value = res.meta;
			openRef.value = open;
		} catch (e) {
			// Trưởng phòng gõ thẳng URL nhận 403 ở đây: hiện câu của BE thay vì trang trắng.
			items.value = [];
			meta.value = null;
			loadError.value = e instanceof Error ? e.message : 'Chưa tải được danh sách đợt kiểm kê. Bạn bấm Thử lại.';
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);
	watch(filterStatus, () => {
		page.value = 1;
		load();
	});
	watch(page, load);

	const statusOptions = [
		{ value: '', label: 'Tất cả trạng thái' },
		...Object.entries(ASSET_STOCKTAKE_STATUS_LABELS).map(([value, label]) => ({ value, label })),
	];

	const emptyText = computed(() => {
		if (filterStatus.value) return 'Không có đợt nào ở trạng thái này. Bạn chọn Tất cả trạng thái để xem mọi đợt.';
		return canManage.value
			? 'Chưa có đợt kiểm kê nào. Bạn bấm Mở đợt kiểm kê để chốt danh sách thiết bị cần kiểm.'
			: 'Chưa có đợt kiểm kê nào.';
	});

	/** Số dòng lệch so với sổ (sai vị trí, sai người giữ, hỏng, không tìm thấy). */
	function discrepancies(s: AssetStocktake['summary']): number {
		return s.wrongLocation + s.wrongHolder + s.damaged + s.notFound;
	}

	function onCreated(st: AssetStocktake) {
		showCreate.value = false;
		router.push(`/management/assets/stocktakes/${st.id}`);
	}
</script>

<template>
	<!-- Khoảng trống cuối trang để nút tròn trợ lý AI không che nút ở dòng cuối. -->
	<div class="space-y-5 pb-44 sm:pb-36">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div class="min-w-0">
				<UiPageHeader title="Kiểm kê tài sản" description="Mỗi đợt chốt danh sách thiết bị cần kiểm, ghi kết quả bằng cách quét tem hoặc ghi tay, rồi xử lý từng chênh lệch sau khi đóng đợt." />
			</div>
			<div v-if="canManage" class="flex items-center gap-1">
				<CommonAppButton
					variant="primary"
					class="min-h-11 sm:min-h-0"
					:disabled="!!openRef"
					@click="showCreate = true"
				>
					Mở đợt kiểm kê
				</CommonAppButton>
				<StocktakeOneOpenHint :open-name="openRef?.name" />
			</div>
		</div>

		<CommonAppModuleNotice module="ASSET" />

		<div
			v-if="openRef && !loadError"
			class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800 dark:bg-blue-900/20"
		>
			<p class="text-sm text-blue-800 dark:text-blue-300">
				Đợt "{{ openRef.name }}" đang mở. Mọi lần quét tem đều ghi vào đợt này cho tới khi đóng hoặc huỷ.
			</p>
			<NuxtLink
				:to="`/management/assets/stocktakes/${openRef.id}`"
				class="text-sm font-medium text-blue-900 underline hover:no-underline dark:text-blue-200"
			>
				Xem đợt đang kiểm kê
			</NuxtLink>
		</div>

		<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
				<UiSelect v-model="filterStatus" :options="statusOptions" />
			</div>
		</div>

		<div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
			<div v-if="loading" class="space-y-3 p-6">
				<div v-for="i in 4" :key="i" class="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
			</div>

			<div v-else-if="loadError" class="flex flex-col items-center gap-3 px-4 py-12 text-center">
				<p class="max-w-md text-sm text-rose-700 dark:text-rose-300">{{ loadError }}</p>
				<div class="flex flex-wrap items-center justify-center gap-3">
					<CommonAppButton variant="outline" class="min-h-11 sm:min-h-0" @click="load">Thử lại</CommonAppButton>
					<NuxtLink to="/management/assets" class="text-sm text-brand-600 hover:underline dark:text-brand-400">Về danh sách tài sản</NuxtLink>
				</div>
			</div>

			<div v-else-if="!items.length" class="flex flex-col items-center justify-center px-4 py-16 text-center text-gray-500 dark:text-gray-400">
				<p class="max-w-md text-sm">{{ emptyText }}</p>
			</div>

			<template v-else>
				<ul class="divide-y divide-gray-100 sm:hidden dark:divide-gray-800">
					<li v-for="st in items" :key="st.id">
						<NuxtLink :to="`/management/assets/stocktakes/${st.id}`" class="block space-y-1.5 p-4 active:bg-gray-50 dark:active:bg-gray-800/40">
							<div class="flex items-start justify-between gap-2">
								<p class="min-w-0 break-words font-medium text-gray-900 dark:text-white">{{ st.name }}</p>
								<span class="inline-flex flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium" :class="STOCKTAKE_STATUS_CLASS[st.status]">
									{{ st.statusLabel }}
								</span>
							</div>
							<p class="text-sm text-gray-600 dark:text-gray-400">Phạm vi: {{ st.scope.text }}</p>
							<p class="text-sm text-gray-700 dark:text-gray-300">
								Đã kiểm {{ st.summary.checked }}/{{ st.summary.total }}, lệch {{ discrepancies(st.summary) }}, chưa xử lý
								{{ st.summary.unresolved }}
							</p>
							<p class="text-xs text-gray-600 dark:text-gray-400">{{ st.openedBy.name }} mở {{ formatDateTime(st.openedAt) }}</p>
						</NuxtLink>
					</li>
				</ul>

				<div class="hidden overflow-x-auto sm:block">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
								<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Đợt</th>
								<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Phạm vi</th>
								<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Đã kiểm</th>
								<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Chênh lệch</th>
								<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Chưa xử lý</th>
								<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Trạng thái</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
							<tr v-for="st in items" :key="st.id" class="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40">
								<td class="px-4 py-3">
									<NuxtLink
										:to="`/management/assets/stocktakes/${st.id}`"
										class="font-medium text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400"
									>
										{{ st.name }}
									</NuxtLink>
									<p class="text-xs text-gray-500">{{ st.openedBy.name }} mở {{ formatDateTime(st.openedAt) }}</p>
									<p v-if="st.closedAt" class="text-xs text-gray-500">
										{{ st.status === 'CANCELLED' ? 'Huỷ' : 'Đóng' }} {{ formatDateTime(st.closedAt) }}
									</p>
								</td>
								<td class="max-w-xs px-4 py-3 text-gray-700 dark:text-gray-300">{{ st.scope.text }}</td>
								<td class="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
									{{ st.summary.checked }}/{{ st.summary.total }}
								</td>
								<td class="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{{ discrepancies(st.summary) }}</td>
								<td
									class="px-4 py-3 text-right tabular-nums"
									:class="st.summary.unresolved ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-gray-700 dark:text-gray-300'"
								>
									{{ st.summary.unresolved }}
								</td>
								<td class="px-4 py-3">
									<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" :class="STOCKTAKE_STATUS_CLASS[st.status]">
										{{ st.statusLabel }}
									</span>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</template>

			<div
				v-if="meta && meta.totalPages > 1"
				class="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-4 py-3 dark:border-gray-800"
			>
				<p class="text-xs text-gray-600 dark:text-gray-400">{{ meta.total }} đợt</p>
				<CommonAppPagination :current-page="page" :total-pages="meta.totalPages" @update:current-page="page = $event" />
			</div>
		</div>

		<StocktakeCreateModal v-if="showCreate" @created="onCreated" @close="showCreate = false" />
	</div>
</template>
