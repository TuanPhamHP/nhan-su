<script setup lang="ts">
	import { useAssetService } from '~/services/asset.service';
	import RenewalModal from '~/components/modules/asset/RenewalModal.vue';
	import { formatAssetMoney, renewalDaysClass, renewalDaysLabel } from '~/utils/asset.utils';
	import { formatDate } from '~/utils/date';
	import type { Asset, AssetRenewal, AssetRenewalBody } from '~/types/asset.types';

	const props = defineProps<{
		asset: Asset;
		canManage: boolean;
	}>();

	const emit = defineEmits<{ 'asset-changed': [] }>();

	const toast = useToast();
	const service = useAssetService();

	const renewals = ref<AssetRenewal[]>([]);
	const loading = ref(true);
	const showModal = ref(false);

	/** Mua đứt và dịch vụ đã huỷ thì không gia hạn được (BE trả `ASSET_NOT_RENEWABLE`). */
	const canRenew = computed(
		() =>
			props.canManage &&
			props.asset.service?.billingCycle !== 'ONE_TIME' &&
			props.asset.status !== 'CANCELLED',
	);

	async function load() {
		loading.value = true;
		try {
			renewals.value = await service.findRenewals(props.asset.id);
		} catch (e) {
			renewals.value = [];
			toast.error(e instanceof Error ? e.message : 'Không tải được lịch sử gia hạn');
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);

	function submitRenewal(body: AssetRenewalBody) {
		return service.createRenewal(props.asset.id, body);
	}

	async function onRenewed() {
		showModal.value = false;
		await load();
		emit('asset-changed');
	}
</script>

<template>
	<section class="space-y-4">
		<div
			v-if="asset.service"
			class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
		>
			<div>
				<p class="text-xs text-gray-500 dark:text-gray-400">Hạn gia hạn kế tiếp</p>
				<p class="text-sm font-semibold text-gray-900 dark:text-white">
					{{ asset.service.nextRenewalDate ? formatDate(asset.service.nextRenewalDate) : 'Mua đứt, không gia hạn' }}
				</p>
				<p v-if="asset.service.nextRenewalDate" class="text-xs" :class="renewalDaysClass(asset.service.daysUntilRenewal)">
					{{ renewalDaysLabel(asset.service.daysUntilRenewal) }}
				</p>
			</div>
			<CommonAppButton v-if="canRenew" variant="primary" size="sm" @click="showModal = true">
				Ghi nhận gia hạn
			</CommonAppButton>
		</div>

		<div class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
			<h3 class="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-800 dark:border-gray-700 dark:text-gray-100">
				Lịch sử gia hạn
			</h3>

			<div v-if="loading" class="space-y-3 p-4">
				<div v-for="i in 3" :key="i" class="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
			</div>

			<p v-else-if="!renewals.length" class="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
				Chưa ghi nhận lần gia hạn nào.
			</p>

			<div v-else class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead class="bg-gray-50 text-xs text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
						<tr>
							<th class="px-4 py-2 text-left font-medium">Kỳ</th>
							<th class="px-4 py-2 text-left font-medium">Ngày trả</th>
							<th class="px-4 py-2 text-right font-medium">Ghế</th>
							<th v-if="asset.canViewValue" class="px-4 py-2 text-right font-medium">Số tiền</th>
							<th class="px-4 py-2 text-left font-medium">Người ghi</th>
							<th class="px-4 py-2 text-left font-medium">Ghi chú</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
						<tr v-for="r in renewals" :key="r.id">
							<td class="px-4 py-3 text-gray-900 dark:text-white">
								{{ formatDate(r.periodStart) }} – {{ formatDate(r.periodEnd) }}
							</td>
							<td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ formatDate(r.paidAt) }}</td>
							<td class="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-300">
								{{ r.seatCount ?? '—' }}
							</td>
							<td v-if="asset.canViewValue" class="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
								{{ formatAssetMoney(r.amount, r.currency) }}
								<p v-if="r.currency !== 'VND' && r.amountVnd != null" class="text-xs text-gray-400">
									= {{ formatAssetMoney(r.amountVnd) }}
								</p>
							</td>
							<td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ r.createdBy.name }}</td>
							<td class="px-4 py-3 text-gray-500 dark:text-gray-400">{{ r.note ?? '—' }}</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>

		<RenewalModal
			v-if="showModal"
			:asset="asset"
			:submit="submitRenewal"
			@renewed="onRenewed"
			@close="showModal = false"
		/>
	</section>
</template>
