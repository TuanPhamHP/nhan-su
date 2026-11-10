<script setup lang="ts">
	import { useAssetService } from '~/services/asset.service';
	import AssetInfoPanel from '~/components/modules/asset/AssetInfoPanel.vue';
	import AssetHoldersPanel from '~/components/modules/asset/AssetHoldersPanel.vue';
	import AssetEventsPanel from '~/components/modules/asset/AssetEventsPanel.vue';
	import AssetMaintenancePanel from '~/components/modules/asset/AssetMaintenancePanel.vue';
	import AssetDepreciationPanel from '~/components/modules/asset/AssetDepreciationPanel.vue';
	import AssetDocumentsPanel from '~/components/modules/asset/AssetDocumentsPanel.vue';
	import AssetRenewalsPanel from '~/components/modules/asset/AssetRenewalsPanel.vue';
	import AssetLicenseKeyCard from '~/components/modules/asset/AssetLicenseKeyCard.vue';
	import AssetFormModal from '~/components/modules/asset/AssetFormModal.vue';
	import AssignModal from '~/components/modules/asset/AssignModal.vue';
	import TransferModal from '~/components/modules/asset/TransferModal.vue';
	import ChangeStatusModal from '~/components/modules/asset/ChangeStatusModal.vue';
	import MaintenanceFormModal from '~/components/modules/asset/MaintenanceFormModal.vue';
	import { ASSET_STATUS_CLASS } from '~/utils/asset.utils';
	import type { Asset } from '~/types/asset.types';

	definePageMeta({ title: 'Chi tiết tài sản' });

	const route = useRoute();
	const router = useRouter();
	const toast = useToast();
	const service = useAssetService();
	const { canWrite } = useModuleAccess();
	const { hasPermission, isAdmin } = usePermissions();

	const assetId = computed(() => Number(route.params.id));
	const asset = ref<Asset | null>(null);
	const loading = ref(true);
	const loadError = ref<string | null>(null);

	const canManage = computed(() => canWrite('ASSET') && hasPermission('asset:manage'));
	const isService = computed(() => asset.value?.kind === 'SERVICE');

	const showEdit = ref(false);
	const showAssign = ref(false);
	const showTransfer = ref(false);
	const showStatus = ref(false);
	const deleting = ref(false);
	const confirmDelete = ref(false);

	async function load() {
		loading.value = true;
		loadError.value = null;
		try {
			asset.value = await service.findOne(assetId.value);
		} catch (e) {
			// MANAGER mở tài sản ngoài phạm vi nhận 403 ở đây: hiện lý do ngay trên trang,
			// KHÔNG để màn hình trắng.
			asset.value = null;
			loadError.value = e instanceof Error ? e.message : 'Không mở được tài sản này';
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);

	/** Tab khác nhau theo họ tài sản (bridge doc mục 11). */
	const tabs = computed(() =>
		isService.value
			? [
					{ id: 'info', label: 'Thông tin' },
					{ id: 'holders', label: 'Ghế' },
					{ id: 'renewals', label: 'Gia hạn' },
					{ id: 'events', label: 'Lịch sử' },
					{ id: 'documents', label: 'Giấy tờ' },
				]
			: [
					{ id: 'info', label: 'Thông tin' },
					{ id: 'holders', label: 'Người dùng' },
					{ id: 'events', label: 'Lịch sử' },
					{ id: 'maintenances', label: 'Sửa chữa' },
					{ id: 'depreciation', label: 'Khấu hao' },
					{ id: 'documents', label: 'Giấy tờ' },
				],
	);

	const activeTab = ref('info');
	// Đổi loại tài sản (tải xong mới biết) có thể làm tab đang chọn không còn tồn tại.
	watch(tabs, list => {
		if (!list.some(t => t.id === activeTab.value)) activeTab.value = 'info';
	});

	// ─── Thao tác trên tài sản ────────────────────────────────────────────────────

	/** Thiết bị chỉ cấp được khi Sẵn sàng; dịch vụ cấp ghế khi đang hoạt động. */
	const canAssign = computed(() => {
		if (!asset.value || !canManage.value) return false;
		return isService.value ? asset.value.status === 'ACTIVE' : asset.value.status === 'AVAILABLE';
	});
	const canTransfer = computed(
		() => !!asset.value && canManage.value && !isService.value && asset.value.status === 'IN_USE',
	);
	const canMarkStatus = computed(() => {
		if (!asset.value || !canManage.value) return false;
		return isService.value
			? ['ACTIVE', 'EXPIRED'].includes(asset.value.status)
			: ['AVAILABLE', 'IN_USE', 'BROKEN'].includes(asset.value.status);
	});
	/**
	 * Mở phiếu sửa được khi thiết bị đang Sẵn sàng, Đang dùng hoặc Hỏng (bridge doc mục 7).
	 * Đang sửa thì đã có phiếu mở — đóng phiếu đó ở tab Sửa chữa, không mở thêm.
	 */
	const canOpenRepair = computed(
		() =>
			!!asset.value &&
			canManage.value &&
			!isService.value &&
			['AVAILABLE', 'IN_USE', 'BROKEN'].includes(asset.value.status),
	);

	const showRepairForm = ref(false);
	/** Tăng lên để ép tab Sửa chữa tải lại sau khi mở phiếu từ menu Tác vụ. */
	const maintenanceVersion = ref(0);

	async function onRepairOpened() {
		showRepairForm.value = false;
		maintenanceVersion.value += 1;
		activeTab.value = 'maintenances';
		await load();
	}

	/** Mọi thao tác trên tài sản gom vào một menu, thay vì một hàng nút dài ở đầu trang. */
	const actionItems = computed(() => [
		{
			label: isService.value ? 'Cấp ghế' : 'Bàn giao',
			icon: 'M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z',
			action: () => {
				showAssign.value = true;
			},
			hidden: !canAssign.value,
		},
		{
			label: 'Điều chuyển',
			icon: 'M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5',
			action: () => {
				showTransfer.value = true;
			},
			hidden: !canTransfer.value,
		},
		{
			label: 'Mở phiếu sửa',
			icon: 'M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437',
			action: () => {
				showRepairForm.value = true;
			},
			hidden: !canOpenRepair.value,
		},
		{
			label: 'Chỉnh sửa',
			icon: 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125',
			action: () => {
				showEdit.value = true;
			},
			hidden: !canManage.value,
		},
		{
			label: isService.value ? 'Huỷ dịch vụ' : 'Đánh dấu mất',
			icon: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
			action: () => {
				showStatus.value = true;
			},
			hidden: !canMarkStatus.value,
		},
		{
			label: 'Xoá',
			icon: 'M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0',
			action: () => {
				confirmDelete.value = true;
			},
			variant: 'danger' as const,
			hidden: !canManage.value,
		},
	]);

	async function afterChange() {
		showEdit.value = false;
		showAssign.value = false;
		showTransfer.value = false;
		showStatus.value = false;
		await load();
	}

	async function removeAsset() {
		if (deleting.value) return;
		deleting.value = true;
		try {
			await service.remove(assetId.value);
			toast.success('Đã xoá tài sản');
			router.push('/management/assets');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Xoá tài sản thất bại');
		} finally {
			deleting.value = false;
			confirmDelete.value = false;
		}
	}

	// ─── License key ──────────────────────────────────────────────────────────────
	// Chỉ ADMIN xem được bản đầy đủ qua route quản lý; người phụ trách xem ở trang
	// "Tài sản của tôi" bằng route riêng của họ.
	const revealKey = () => service.revealLicenseKey(assetId.value);
	const saveKey = async (key: string) => {
		asset.value = await service.setLicenseKey(assetId.value, key);
	};
	const clearKey = async () => {
		asset.value = await service.clearLicenseKey(assetId.value);
	};
</script>

<template>
	<div class="space-y-5">
		<NuxtLink
			to="/management/assets"
			class="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400"
		>
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
			</svg>
			Danh sách tài sản
		</NuxtLink>

		<CommonAppModuleNotice module="ASSET" />

		<div v-if="loading" class="space-y-4">
			<div class="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
			<div class="h-64 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
		</div>

		<div
			v-else-if="loadError"
			class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-center dark:border-rose-800 dark:bg-rose-900/20"
		>
			<p class="text-sm text-rose-700 dark:text-rose-300">{{ loadError }}</p>
			<NuxtLink to="/management/assets" class="mt-2 inline-block text-sm text-brand-600 hover:underline dark:text-brand-400">
				Quay lại danh sách
			</NuxtLink>
		</div>

		<template v-else-if="asset">
			<!-- Đầu trang -->
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div class="min-w-0">
					<div class="flex flex-wrap items-center gap-2">
						<h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ asset.name }}</h1>
						<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" :class="ASSET_STATUS_CLASS[asset.status]">
							{{ asset.statusLabel }}
						</span>
					</div>
					<p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
						<span class="font-mono">{{ asset.code }}</span>
						· {{ asset.kindLabel }} · {{ asset.category.groupName }} → {{ asset.category.name }}
					</p>
				</div>

				<UiDropdownMenu v-if="canManage" label="Tác vụ" :items="actionItems" />
			</div>

			<!-- Tab -->
			<div class="border-b border-gray-200 dark:border-gray-700">
				<nav class="-mb-px flex flex-wrap gap-1">
					<button
						v-for="tab in tabs"
						:key="tab.id"
						type="button"
						:class="[
							'border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
							activeTab === tab.id
								? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
								: 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
						]"
						@click="activeTab = tab.id"
					>
						{{ tab.label }}
					</button>
				</nav>
			</div>

			<!-- Nội dung tab. `:key` buộc panel tải lại khi đổi tài sản. -->
			<template v-if="activeTab === 'info'">
				<AssetInfoPanel :asset="asset" />
				<AssetLicenseKeyCard
					v-if="isService"
					:has-key="asset.service?.hasLicenseKey ?? false"
					:masked="asset.service?.licenseKeyMasked ?? null"
					:can-reveal="isAdmin"
					:can-edit="canManage"
					:reveal="revealKey"
					:save="saveKey"
					:clear="clearKey"
					@changed="load"
				/>
			</template>

			<AssetHoldersPanel
				v-else-if="activeTab === 'holders'"
				:key="`holders-${asset.id}`"
				:asset="asset"
				:can-manage="canManage"
				@asset-changed="load"
			/>

			<AssetRenewalsPanel
				v-else-if="activeTab === 'renewals'"
				:key="`renewals-${asset.id}`"
				:asset="asset"
				:can-manage="canManage"
				@asset-changed="load"
			/>

			<AssetEventsPanel v-else-if="activeTab === 'events'" :key="`events-${asset.id}`" :asset-id="asset.id" />

			<AssetMaintenancePanel
				v-else-if="activeTab === 'maintenances'"
				:key="`maint-${asset.id}-${maintenanceVersion}`"
				:asset="asset"
				:can-manage="canManage"
				@asset-changed="load"
			/>

			<AssetDepreciationPanel
				v-else-if="activeTab === 'depreciation'"
				:key="`dep-${asset.id}`"
				:asset-id="asset.id"
			/>

			<AssetDocumentsPanel
				v-else-if="activeTab === 'documents'"
				:key="`docs-${asset.id}`"
				:asset="asset"
				:can-manage="canManage"
			/>

			<!-- Modal -->
			<AssetFormModal v-if="showEdit" :asset="asset" @saved="afterChange" @close="showEdit = false" />
			<MaintenanceFormModal
				v-if="showRepairForm"
				:asset-id="asset.id"
				:asset-label="`${asset.code} · ${asset.name}`"
				@saved="onRepairOpened"
				@close="showRepairForm = false"
			/>
			<AssignModal v-if="showAssign" :asset="asset" @assigned="afterChange" @close="showAssign = false" />
			<TransferModal v-if="showTransfer" :asset="asset" @transferred="afterChange" @close="showTransfer = false" />
			<ChangeStatusModal v-if="showStatus" :asset="asset" @changed="afterChange" @close="showStatus = false" />

			<Teleport to="body">
				<div v-if="confirmDelete" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
					<div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">Xoá tài sản</h2>
						<p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
							Xoá <strong>{{ asset.code }} · {{ asset.name }}</strong> khỏi hệ thống. Chỉ xoá được bản nhập
							nhầm: tài sản đã từng bàn giao, sửa chữa hay gia hạn thì hệ thống sẽ từ chối.
						</p>
						<div class="mt-5 flex justify-end gap-3">
							<CommonAppButton variant="secondary" @click="confirmDelete = false">Huỷ</CommonAppButton>
							<CommonAppButton variant="danger" :loading="deleting" @click="removeAsset">Xoá</CommonAppButton>
						</div>
					</div>
				</div>
			</Teleport>
		</template>
	</div>
</template>
