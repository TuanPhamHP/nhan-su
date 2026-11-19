<script setup lang="ts">
	import { useAssetService } from '~/services/asset.service';
	import AssetIncidentDetailModal from '~/components/modules/asset/AssetIncidentDetailModal.vue';
	import { INCIDENT_STATUS_CLASS, INCIDENT_TYPE_CLASS } from '~/utils/asset.utils';
	import { formatDate, formatDateTime } from '~/utils/date';
	import {
		ASSET_INCIDENT_STATUS_LABELS,
		ASSET_INCIDENT_TYPE_LABELS,
		type AssetIncident,
		type AssetIncidentStatus,
		type AssetIncidentType,
	} from '~/types/asset.types';

	definePageMeta({ title: 'Báo hỏng, báo mất' });

	const route = useRoute();
	const router = useRouter();
	const toast = useToast();
	const service = useAssetService();
	const { canWrite } = useModuleAccess();
	const { hasPermission } = usePermissions();

	const canManage = computed(() => canWrite('ASSET') && hasPermission('asset:manage'));

	/**
	 * Mặc định chỉ những báo cáo còn chờ xử lý, vì đó là việc cần làm của trang này.
	 *
	 * Mở từ thông báo (`?open_id=`) thì bỏ lọc ngay từ đầu: báo cáo trong thông báo có thể đã được
	 * người khác xử lý, và trưởng phòng mở ra mà thấy "không có báo cáo nào đang chờ" thì tưởng
	 * báo cáo đã biến mất. Đặt trước khi đăng ký watcher để không tải hai lần.
	 */
	const filterStatus = ref<AssetIncidentStatus | ''>(route.query.open_id ? '' : 'OPEN');
	const filterType = ref<AssetIncidentType | ''>('');
	const page = ref(1);
	const limit = 20;

	const items = ref<AssetIncident[]>([]);
	const meta = ref<{ total: number; totalPages: number } | null>(null);
	const loading = ref(true);
	const loadError = ref<string | null>(null);
	const selected = ref<AssetIncident | null>(null);

	async function load() {
		loading.value = true;
		loadError.value = null;
		try {
			const res = await service.findIncidents({
				status: filterStatus.value || undefined,
				type: filterType.value || undefined,
				page: page.value,
				limit,
			});
			items.value = res.data;
			meta.value = res.meta;
		} catch (e) {
			// Lỗi tải thì hiện khung lỗi có nút Thử lại tại chỗ, không để câu "không có báo cáo
			// nào" khiến người dùng tin là đã hết việc.
			items.value = [];
			meta.value = null;
			loadError.value =
				e instanceof Error ? e.message : 'Chưa tải được danh sách báo hỏng, báo mất. Bạn bấm Thử lại.';
		} finally {
			loading.value = false;
		}
	}

	/**
	 * Thông báo N-06 mở thẳng một báo cáo qua `?open_id=`, kể cả báo cáo đã xử lý.
	 *
	 * Dọn query TRƯỚC khi gọi API để F5 không mở lại, giống các trang khác trong app.
	 */
	async function openByQueryId() {
		const raw = route.query.open_id;
		if (!raw) return;
		const id = Number(raw);
		router.replace({ path: '/management/assets/incidents' });
		if (!id || Number.isNaN(id)) return;
		try {
			selected.value = await service.findIncident(id);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa mở được báo cáo này. Bạn thử lại sau ít phút.');
		}
	}

	onMounted(async () => {
		await Promise.all([load(), openByQueryId()]);
	});

	// Bấm thông báo khi đang ở sẵn trang này chỉ đổi query, trang không tạo lại nên phải nghe query.
	watch(
		() => route.query.open_id,
		raw => {
			if (raw) openByQueryId();
		},
	);

	watch([filterStatus, filterType], () => {
		page.value = 1;
		load();
	});
	watch(page, load);

	const statusOptions = [
		{ value: '', label: 'Tất cả trạng thái' },
		...Object.entries(ASSET_INCIDENT_STATUS_LABELS).map(([value, label]) => ({ value, label })),
	];
	const typeOptions = [
		{ value: '', label: 'Báo hỏng và báo mất' },
		...Object.entries(ASSET_INCIDENT_TYPE_LABELS).map(([value, label]) => ({ value, label })),
	];

	/** Câu trạng thái rỗng phân biệt "đã hết việc" với "lọc không ra". */
	const emptyText = computed(() => {
		if (filterStatus.value === 'OPEN' && !filterType.value) {
			return 'Không có báo hỏng, báo mất nào đang chờ xử lý. Bạn chọn Tất cả trạng thái để xem cả những báo cáo đã xử lý.';
		}
		if (!filterStatus.value && !filterType.value) return 'Chưa có ai gửi báo hỏng hay báo mất.';
		return 'Không có báo cáo nào khớp bộ lọc. Bạn bỏ bớt điều kiện lọc để xem thêm.';
	});

	/** Kết quả phiếu sửa của báo cáo đã xử lý xong, hiện ngay trong danh sách. */
	function resultLine(item: AssetIncident): string {
		if (item.status !== 'RESOLVED' || !item.maintenance) return '';
		return `Phiếu sửa: ${item.maintenance.statusLabel}`;
	}

	async function onHandled() {
		selected.value = null;
		await load();
	}
</script>

<template>
	<div class="space-y-5 pb-40 sm:pb-24">
		<div>
			<UiPageHeader title="Báo hỏng, báo mất" description="Báo cáo do nhân viên gửi về thiết bị họ đang giữ. Bạn mở từng báo cáo để tạo phiếu sửa, xác nhận mất hoặc đóng lại." />
		</div>

		<CommonAppModuleNotice module="ASSET" />

		<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<UiSelect v-model="filterStatus" :options="statusOptions" />
				<UiSelect v-model="filterType" :options="typeOptions" />
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

			<div
				v-else-if="!items.length"
				class="flex flex-col items-center justify-center px-4 py-16 text-center text-gray-500 dark:text-gray-400"
			>
				<svg class="mb-3 h-10 w-10 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<p class="max-w-md text-sm">{{ emptyText }}</p>
			</div>

			<template v-else>
				<!-- Thẻ trên điện thoại: bảng bảy cột bóp vào 390 px thì phải vuốt ngang. -->
				<ul class="divide-y divide-gray-100 sm:hidden dark:divide-gray-800">
					<li v-for="item in items" :key="item.id" class="space-y-2 p-4">
						<div class="flex flex-wrap items-center gap-2">
							<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" :class="INCIDENT_TYPE_CLASS[item.type]">
								{{ item.typeLabel }}
							</span>
							<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" :class="INCIDENT_STATUS_CLASS[item.status]">
								{{ item.statusLabel }}
							</span>
						</div>
						<div>
							<NuxtLink
								:to="`/management/assets/${item.asset.id}`"
								class="font-medium text-gray-900 hover:text-brand-600 dark:text-white"
							>
								{{ item.asset.name }}
							</NuxtLink>
							<p class="font-mono text-xs text-gray-600 dark:text-gray-400">{{ item.asset.code }} · {{ item.asset.statusLabel }}</p>
						</div>
						<p class="break-words text-sm text-gray-700 dark:text-gray-300">{{ item.description }}</p>
						<p class="text-xs text-gray-600 dark:text-gray-400">
							{{ item.reportedBy.name }} gửi {{ formatDateTime(item.createdAt)
							}}<template v-if="item.photoDocumentIds.length">, kèm {{ item.photoDocumentIds.length }} ảnh</template>
						</p>
						<p v-if="resultLine(item)" class="text-xs text-emerald-700 dark:text-emerald-400">{{ resultLine(item) }}</p>
						<CommonAppButton
							size="sm"
							class="min-h-11 w-full"
							:variant="canManage && item.status === 'OPEN' ? 'primary' : 'outline'"
							@click="selected = item"
						>
							{{ canManage && item.status === 'OPEN' ? 'Xử lý' : 'Xem chi tiết' }}
						</CommonAppButton>
					</li>
				</ul>

				<div class="hidden overflow-x-auto sm:block">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
								<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tài sản</th>
								<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Loại</th>
								<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Nội dung</th>
								<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Người báo</th>
								<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Phát hiện / Gửi</th>
								<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Trạng thái</th>
								<th class="px-4 py-3" />
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
							<tr v-for="item in items" :key="item.id" class="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40">
								<td class="px-4 py-3">
									<NuxtLink
										:to="`/management/assets/${item.asset.id}`"
										class="font-medium text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400"
									>
										{{ item.asset.name }}
									</NuxtLink>
									<p class="font-mono text-xs text-gray-500">{{ item.asset.code }}</p>
									<p class="text-xs text-gray-500">{{ item.asset.statusLabel }}</p>
								</td>
								<td class="px-4 py-3">
									<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" :class="INCIDENT_TYPE_CLASS[item.type]">
										{{ item.typeLabel }}
									</span>
									<p class="mt-1 text-xs text-gray-500">
										{{ item.photoDocumentIds.length ? `${item.photoDocumentIds.length} ảnh` : 'Không có ảnh' }}
									</p>
								</td>
								<td class="max-w-xs px-4 py-3">
									<p class="break-words text-gray-700 dark:text-gray-300">{{ item.description }}</p>
								</td>
								<td class="px-4 py-3 text-gray-600 dark:text-gray-300">
									{{ item.reportedBy.name }}
									<p v-if="item.handledBy" class="text-xs text-gray-500">Xử lý: {{ item.handledBy.name }}</p>
								</td>
								<td class="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
									<p>{{ item.occurredOn ? formatDate(item.occurredOn) : '—' }}</p>
									<p class="text-gray-500">{{ formatDateTime(item.createdAt) }}</p>
								</td>
								<td class="px-4 py-3">
									<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" :class="INCIDENT_STATUS_CLASS[item.status]">
										{{ item.statusLabel }}
									</span>
									<p v-if="resultLine(item)" class="mt-1 text-xs text-emerald-700 dark:text-emerald-400">{{ resultLine(item) }}</p>
								</td>
								<td class="px-4 py-3 text-right">
									<CommonAppButton
										size="sm"
										:variant="canManage && item.status === 'OPEN' ? 'primary' : 'outline'"
										@click="selected = item"
									>
										{{ canManage && item.status === 'OPEN' ? 'Xử lý' : 'Xem' }}
									</CommonAppButton>
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
				<p class="text-xs text-gray-600 dark:text-gray-400">{{ meta.total }} báo cáo</p>
				<CommonAppPagination :current-page="page" :total-pages="meta.totalPages" @update:current-page="page = $event" />
			</div>
		</div>

		<AssetIncidentDetailModal
			v-if="selected"
			:incident="selected"
			:can-manage="canManage"
			@handled="onHandled"
			@stale="onHandled"
			@close="selected = null"
		/>
	</div>
</template>
