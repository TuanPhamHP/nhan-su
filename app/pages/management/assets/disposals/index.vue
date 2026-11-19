<script setup lang="ts">
	import { useAssetService } from '~/services/asset.service';
	import DisposalFormModal from '~/components/modules/asset/DisposalFormModal.vue';
	import {
		DISPOSAL_STATUS_CLASS,
		disposalCountText,
		disposalItemsSummary,
		disposalNumber,
		disposalResubmitText,
	} from '~/utils/asset.utils';
	import { formatDate, formatDateTime } from '~/utils/date';
	import {
		ASSET_DISPOSAL_STATUS_LABELS,
		type AssetDisposal,
		type AssetDisposalStatus,
	} from '~/types/asset.types';

	definePageMeta({ title: 'Thanh lý tài sản' });

	const route = useRoute();
	const router = useRouter();
	const service = useAssetService();
	const { canWrite } = useModuleAccess();
	const { hasPermission } = usePermissions();

	const canManage = computed(() => canWrite('ASSET') && hasPermission('asset:manage'));

	/** `?status=` đến từ thẻ "Phiếu thanh lý chờ duyệt" ở Tổng quan; giá trị lạ thì bỏ qua. */
	function statusFromQuery(): AssetDisposalStatus | '' {
		const raw = route.query.status;
		return typeof raw === 'string' && raw in ASSET_DISPOSAL_STATUS_LABELS ? (raw as AssetDisposalStatus) : '';
	}

	const filterStatus = ref<AssetDisposalStatus | ''>(statusFromQuery());
	const page = ref(1);
	const limit = 20;

	const items = ref<AssetDisposal[]>([]);
	const meta = ref<{ total: number; totalPages: number } | null>(null);
	const loading = ref(true);
	const loadError = ref<string | null>(null);
	const showForm = ref(false);

	async function load() {
		loading.value = true;
		loadError.value = null;
		try {
			const res = await service.findDisposals({ status: filterStatus.value || undefined, page: page.value, limit });
			items.value = res.data;
			meta.value = res.meta;
		} catch (e) {
			items.value = [];
			meta.value = null;
			loadError.value = e instanceof Error ? e.message : 'Chưa tải được danh sách phiếu thanh lý. Bạn bấm Thử lại.';
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);

	// Bấm thẻ Tổng quan khi đang đứng ở trang này chỉ đổi query.
	watch(
		() => route.query.status,
		() => {
			const next = statusFromQuery();
			if (next !== filterStatus.value) filterStatus.value = next;
		},
	);

	watch(filterStatus, value => {
		page.value = 1;
		const query = { ...route.query };
		if (value) query.status = value;
		else delete query.status;
		router.replace({ path: '/management/assets/disposals', query });
		load();
	});
	watch(page, load);

	const statusOptions = [
		{ value: '', label: 'Tất cả trạng thái' },
		...Object.entries(ASSET_DISPOSAL_STATUS_LABELS).map(([value, label]) => ({ value, label })),
	];

	const emptyText = computed(() => {
		if (filterStatus.value === 'PENDING') return 'Không có phiếu thanh lý nào đang chờ duyệt.';
		if (filterStatus.value) return 'Không có phiếu nào ở trạng thái này. Bạn chọn Tất cả trạng thái để xem mọi phiếu.';
		return canManage.value
			? 'Chưa có phiếu thanh lý nào. Bạn bấm Tạo phiếu thanh lý để đề nghị thanh lý thiết bị hỏng, mất hoặc không còn dùng.'
			: 'Chưa có phiếu thanh lý nào.';
	});

	/**
	 * Tên vài thiết bị đầu tiên của phiếu, đủ để nhận ra phiếu trong danh sách. Trưởng phòng chỉ nhận
	 * thiết bị của phòng mình (`hiddenItemCount` là phần còn lại), nên số "khác" tính cả phần ẩn.
	 */
	const itemsSummary = (d: AssetDisposal) => disposalItemsSummary(d);

	function onSaved(d: AssetDisposal) {
		showForm.value = false;
		router.push(`/management/assets/disposals/${d.id}`);
	}
</script>

<template>
	<!-- Khoảng trống cuối trang để nút tròn trợ lý AI không che nút ở dòng cuối. -->
	<div class="space-y-5 pb-44 sm:pb-36">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div class="min-w-0">
				<UiPageHeader title="Thanh lý tài sản" description="Trang này liệt kê các phiếu đề nghị thanh lý thiết bị cùng kết quả duyệt." />
			</div>
			<CommonAppButton v-if="canManage" variant="primary" class="min-h-11 sm:min-h-0" @click="showForm = true">
				Tạo phiếu thanh lý
			</CommonAppButton>
		</div>

		<CommonAppModuleNotice module="ASSET" />

		<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
				<UiSelect v-model="filterStatus" :options="statusOptions" />
			</div>
		</div>

		<div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
			<div v-if="loading" class="space-y-3 p-6">
				<div v-for="i in 5" :key="i" class="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
			</div>

			<div v-else-if="loadError" class="flex flex-col items-center gap-3 px-4 py-12 text-center">
				<p class="text-sm text-rose-700 dark:text-rose-300">{{ loadError }}</p>
				<CommonAppButton variant="outline" class="min-h-11 sm:min-h-0" @click="load">Thử lại</CommonAppButton>
			</div>

			<div v-else-if="!items.length" class="flex flex-col items-center justify-center px-4 py-16 text-center text-gray-500 dark:text-gray-400">
				<p class="max-w-md text-sm">{{ emptyText }}</p>
			</div>

			<template v-else>
				<!-- Thẻ trên điện thoại. -->
				<ul class="divide-y divide-gray-100 sm:hidden dark:divide-gray-800">
					<li v-for="d in items" :key="d.id">
						<NuxtLink :to="`/management/assets/disposals/${d.id}`" class="block space-y-1.5 p-4 active:bg-gray-50 dark:active:bg-gray-800/40">
							<div class="flex items-start justify-between gap-2">
								<p class="font-medium text-gray-900 dark:text-white">Phiếu {{ disposalNumber(d.id) }} · {{ d.methodLabel }}</p>
								<span class="inline-flex flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium" :class="DISPOSAL_STATUS_CLASS[d.status]">
									{{ d.statusLabel }}
								</span>
							</div>
							<p class="break-words text-sm text-gray-700 dark:text-gray-300">{{ itemsSummary(d) }}</p>
							<p class="text-xs text-gray-600 dark:text-gray-400">{{ disposalCountText(d) }}</p>
							<p class="text-xs text-gray-600 dark:text-gray-400">
								Ngày thanh lý {{ formatDate(d.disposalDate) }}<template v-if="disposalResubmitText(d.round)"> · {{ disposalResubmitText(d.round) }}</template>
							</p>
							<p class="text-xs text-gray-600 dark:text-gray-400">{{ d.createdBy.name }} gửi {{ formatDateTime(d.submittedAt) }}</p>
						</NuxtLink>
					</li>
				</ul>

				<div class="hidden overflow-x-auto sm:block">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
								<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Phiếu</th>
								<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Thiết bị</th>
								<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Ngày thanh lý</th>
								<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Người lập</th>
								<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Trạng thái</th>
								<th class="px-4 py-3" />
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
							<tr v-for="d in items" :key="d.id" class="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40">
								<td class="whitespace-nowrap px-4 py-3">
									<NuxtLink
										:to="`/management/assets/disposals/${d.id}`"
										class="font-medium text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400"
									>
										Phiếu {{ disposalNumber(d.id) }}
									</NuxtLink>
									<p class="text-xs text-gray-500">{{ d.methodLabel }}</p>
								</td>
								<td class="max-w-xs px-4 py-3">
									<p class="break-words text-gray-700 dark:text-gray-300">{{ itemsSummary(d) }}</p>
									<p class="text-xs text-gray-500">{{ disposalCountText(d) }}</p>
								</td>
								<td class="whitespace-nowrap px-4 py-3 text-gray-700 dark:text-gray-300">{{ formatDate(d.disposalDate) }}</td>
								<td class="px-4 py-3 text-gray-600 dark:text-gray-300">
									{{ d.createdBy.name }}
									<p class="text-xs text-gray-500">Gửi {{ formatDateTime(d.submittedAt) }}</p>
								</td>
								<td class="px-4 py-3">
									<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" :class="DISPOSAL_STATUS_CLASS[d.status]">
										{{ d.statusLabel }}
									</span>
									<p v-if="disposalResubmitText(d.round)" class="mt-1 text-xs text-gray-500">{{ disposalResubmitText(d.round) }}</p>
								</td>
								<td class="px-4 py-3 text-right">
									<NuxtLink :to="`/management/assets/disposals/${d.id}`" class="text-xs text-brand-600 hover:underline dark:text-brand-400">
										Xem phiếu
									</NuxtLink>
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
				<p class="text-xs text-gray-600 dark:text-gray-400">{{ meta.total }} phiếu</p>
				<CommonAppPagination :current-page="page" :total-pages="meta.totalPages" @update:current-page="page = $event" />
			</div>
		</div>

		<DisposalFormModal v-if="showForm" @saved="onSaved" @close="showForm = false" />
	</div>
</template>
