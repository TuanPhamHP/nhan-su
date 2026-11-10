<script setup lang="ts">
	import { useAssetService } from '~/services/asset.service';
	import { formatAssetMoney } from '~/utils/asset.utils';
	import { formatDate, todayYmd } from '~/utils/date';
	import type { AssetDepreciation } from '~/types/asset.types';

	const props = defineProps<{ assetId: number }>();

	const toast = useToast();
	const service = useAssetService();

	const data = ref<AssetDepreciation | null>(null);
	const loading = ref(true);
	const asOf = ref(todayYmd());
	const error = ref<string | null>(null);

	async function load() {
		loading.value = true;
		error.value = null;
		try {
			data.value = await service.findDepreciation(props.assetId, asOf.value);
		} catch (e) {
			// Thiếu `asset:value:read` hay tài sản không khấu hao đều rơi vào đây: nói rõ
			// bằng message của BE thay vì để bảng trống không giải thích.
			data.value = null;
			error.value = e instanceof Error ? e.message : 'Không tải được bảng khấu hao';
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);
	watch(asOf, load);

	/** Chưa đặt phân loại thì nói rõ là chưa đặt, kèm bản BE gợi ý. Nhãn đều lấy từ response. */
	const accountingClassText = computed(() => {
		const d = data.value;
		if (!d) return '';
		if (d.accountingClassLabel) return d.accountingClassLabel;
		return `chưa đặt (gợi ý: ${d.suggestedAccountingClassLabel})`;
	});

	const summary = computed(() => {
		const d = data.value;
		if (!d) return [];
		return [
			{ label: 'Nguyên giá', value: formatAssetMoney(d.costVnd) },
			{ label: 'Giá trị thu hồi', value: formatAssetMoney(d.salvageValue) },
			{ label: 'Bắt đầu', value: d.startDate ? formatDate(d.startDate) : '—' },
			{ label: 'Số tháng', value: d.months != null ? String(d.months) : '—' },
			{ label: 'Đã trích', value: formatAssetMoney(d.accumulated) },
			{ label: 'Còn lại', value: formatAssetMoney(d.bookValue) },
		];
	});
</script>

<template>
	<section class="space-y-4">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100">Khấu hao</h3>
			<label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
				Tính đến ngày
				<UiDatePicker v-model="asOf" />
			</label>
		</div>

		<div v-if="loading" class="space-y-3">
			<div v-for="i in 4" :key="i" class="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
		</div>

		<div
			v-else-if="error"
			class="rounded-xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
		>
			{{ error }}
		</div>

		<template v-else-if="data">
			<div class="grid grid-cols-2 gap-3 lg:grid-cols-3">
				<div
					v-for="row in summary"
					:key="row.label"
					class="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900"
				>
					<p class="text-xs text-gray-500 dark:text-gray-400">{{ row.label }}</p>
					<p class="mt-0.5 text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{{ row.value }}</p>
				</div>
			</div>

			<p class="text-xs text-gray-500 dark:text-gray-400">
				Phân loại kế toán:
				<strong class="text-gray-700 dark:text-gray-200">{{ accountingClassText }}</strong>
				<template v-if="data.stopDate"> · đã dừng trích từ {{ formatDate(data.stopDate) }}</template>
			</p>

			<div class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
				<p v-if="!data.schedule.length" class="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
					Tài sản này không có lịch khấu hao.
				</p>
				<div v-else class="max-h-96 overflow-auto">
					<table class="w-full text-sm">
						<thead class="sticky top-0 bg-gray-50 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
							<tr>
								<th class="px-4 py-2 text-left font-medium">Tháng</th>
								<th class="px-4 py-2 text-left font-medium">Kỳ</th>
								<th class="px-4 py-2 text-right font-medium">Số ngày</th>
								<th class="px-4 py-2 text-right font-medium">Trích trong kỳ</th>
								<th class="px-4 py-2 text-right font-medium">Luỹ kế</th>
								<th class="px-4 py-2 text-right font-medium">Còn lại</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
							<tr v-for="p in data.schedule" :key="p.month">
								<td class="px-4 py-2 font-mono text-xs text-gray-700 dark:text-gray-300">{{ p.month }}</td>
								<td class="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
									{{ formatDate(p.from) }} – {{ formatDate(p.to) }}
								</td>
								<td class="px-4 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">
									{{ p.days }}/{{ p.daysInMonth }}
								</td>
								<td class="px-4 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
									{{ formatAssetMoney(p.amount) }}
								</td>
								<td class="px-4 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
									{{ formatAssetMoney(p.accumulated) }}
								</td>
								<td class="px-4 py-2 text-right tabular-nums font-medium text-gray-900 dark:text-white">
									{{ formatAssetMoney(p.bookValue) }}
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</template>
	</section>
</template>
