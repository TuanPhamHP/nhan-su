<script setup lang="ts">
	import { useAssetService } from '~/services/asset.service';
	import { ASSET_STATUS_CLASS, formatAssetMoney } from '~/utils/asset.utils';
	import { formatDate } from '~/utils/date';
	import { PHYSICAL_STATUSES, SERVICE_STATUSES, type AssetOverview, type AssetStatus } from '~/types/asset.types';

	/**
	 * Tổng quan tài sản (F-22) ở đầu trang danh sách.
	 *
	 * Thẻ trạng thái không tự điều hướng mà phát `pick-status` để trang danh sách ngay bên
	 * dưới lọc lại: người dùng thấy kết quả ở cùng màn hình, không phải tải trang mới.
	 *
	 * Thẻ tiền và cột tiền của bảng phòng ban đi theo `canViewValue` của chính response,
	 * không suy từ vai trò — người thiếu `asset:value:read` nhận `null` ở mọi trường tiền.
	 */
	const emit = defineEmits<{ 'pick-status': [status: AssetStatus] }>();

	const service = useAssetService();

	const data = ref<AssetOverview | null>(null);
	const loading = ref(true);
	const loadError = ref<string | null>(null);
	const open = ref(true);

	/**
	 * Tổng quan hỏng thì bảng danh sách bên dưới vẫn dùng được, nhưng khối này không được biến
	 * mất không một lời: hiện câu lỗi gọn kèm nút Thử lại.
	 */
	async function load() {
		loading.value = true;
		loadError.value = null;
		try {
			data.value = await service.overview();
		} catch (e) {
			data.value = null;
			loadError.value = e instanceof Error ? e.message : 'Chưa tải được tổng quan tài sản. Bạn bấm Thử lại.';
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);

	const moneyCards = computed(() => {
		const d = data.value;
		if (!d || !d.canViewValue) return [];
		return [
			{ label: 'Tổng nguyên giá', value: formatAssetMoney(d.totals?.costVnd ?? null), hint: '' },
			{ label: 'Giá trị còn lại', value: formatAssetMoney(d.totals?.bookValue ?? null), hint: '' },
			{
				label: 'Chi phí dịch vụ tháng này',
				value: formatAssetMoney(d.serviceCostThisMonth),
				hint: 'Tiền mỗi kỳ gia hạn được chia đều cho các tháng của kỳ đó.',
			},
		];
	});

	/** Trạng thái tách hai nhóm (G10): "Sẵn sàng" của thiết bị không lẫn với "Đang hoạt động" của dịch vụ. */
	const physicalStatuses = computed(() =>
		(data.value?.byStatus ?? []).filter(s => PHYSICAL_STATUSES.includes(s.status)),
	);
	const serviceStatuses = computed(() =>
		(data.value?.byStatus ?? []).filter(s => SERVICE_STATUSES.includes(s.status)),
	);

	/** BE ghi "Chưa giao" cho thiết bị chưa ở ai: đổi theo thuật ngữ đã chốt và xếp xuống cuối. */
	const UNASSIGNED = 'Chưa giao';
	const departmentRows = computed(() => {
		const rows = [...(data.value?.byDepartment ?? [])];
		rows.sort((a, b) => Number(a.departmentName === UNASSIGNED) - Number(b.departmentName === UNASSIGNED));
		return rows.map(r => ({
			...r,
			label: r.departmentName === UNASSIGNED ? 'Chưa cấp phát' : r.departmentName,
		}));
	});
</script>

<template>
	<section class="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
		<button
			type="button"
			class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
			:aria-expanded="open"
			@click="open = !open"
		>
			<div>
				<h2 class="text-sm font-semibold text-gray-800 dark:text-gray-100">Tổng quan</h2>
				<p v-if="data" class="text-sm text-gray-600 dark:text-gray-400">
					Đang quản lý {{ data.physicalCount }} thiết bị và {{ data.serviceCount }} dịch vụ thuê bao, tính đến
					ngày {{ formatDate(data.asOf) }}.
				</p>
			</div>
			<svg
				class="h-5 w-5 flex-shrink-0 text-gray-400 transition-transform"
				:class="open ? 'rotate-180' : ''"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
			</svg>
		</button>

		<div v-if="loading" class="space-y-3 border-t border-gray-100 p-4 dark:border-gray-800">
			<div v-for="i in 2" :key="i" class="h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
		</div>

		<div
			v-else-if="loadError && open"
			class="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 p-4 dark:border-gray-800"
		>
			<p class="text-sm text-rose-700 dark:text-rose-300">{{ loadError }}</p>
			<CommonAppButton size="sm" variant="outline" @click="load">Thử lại</CommonAppButton>
		</div>

		<div v-else-if="data && open" class="space-y-5 border-t border-gray-100 p-4 dark:border-gray-800">
			<!-- Tiền -->
			<div v-if="moneyCards.length" class="grid grid-cols-1 gap-3 sm:grid-cols-3">
				<div
					v-for="card in moneyCards"
					:key="card.label"
					class="rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700"
				>
					<p class="text-xs text-gray-600 dark:text-gray-400">{{ card.label }}</p>
					<p class="mt-0.5 text-lg font-bold tabular-nums text-gray-900 dark:text-white">{{ card.value }}</p>
					<p v-if="card.hint" class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ card.hint }}</p>
				</div>
			</div>

			<!-- Theo trạng thái, thiết bị và dịch vụ tách riêng -->
			<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<div v-if="physicalStatuses.length" class="space-y-2">
					<p class="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
						Thiết bị theo trạng thái
					</p>
					<div class="flex flex-wrap gap-2">
						<button
							v-for="row in physicalStatuses"
							:key="row.status"
							type="button"
							class="flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-left transition-colors hover:border-brand-500 sm:min-h-0 dark:border-gray-700"
							@click="emit('pick-status', row.status)"
						>
							<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" :class="ASSET_STATUS_CLASS[row.status]">
								{{ row.statusLabel }}
							</span>
							<span class="text-base font-bold tabular-nums text-gray-900 dark:text-white">{{ row.count }}</span>
						</button>
					</div>
				</div>
				<div v-if="serviceStatuses.length" class="space-y-2">
					<p class="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
						Dịch vụ thuê bao theo trạng thái
					</p>
					<div class="flex flex-wrap gap-2">
						<button
							v-for="row in serviceStatuses"
							:key="row.status"
							type="button"
							class="flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-left transition-colors hover:border-brand-500 sm:min-h-0 dark:border-gray-700"
							@click="emit('pick-status', row.status)"
						>
							<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" :class="ASSET_STATUS_CLASS[row.status]">
								{{ row.statusLabel }}
							</span>
							<span class="text-base font-bold tabular-nums text-gray-900 dark:text-white">{{ row.count }}</span>
						</button>
					</div>
				</div>
			</div>

			<!-- Việc đang chờ -->
			<div class="space-y-2">
				<p class="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">Việc đang chờ</p>
				<div class="grid grid-cols-2 gap-3 lg:grid-cols-5">
					<NuxtLink
						to="/management/assets/reports?tab=expiring"
						class="rounded-xl border border-gray-200 px-4 py-3 transition-colors hover:border-brand-500 dark:border-gray-700"
					>
						<p class="text-xs text-gray-600 dark:text-gray-400">Sắp đến hạn 30 ngày</p>
						<p class="mt-0.5 text-lg font-bold tabular-nums text-gray-900 dark:text-white">{{ data.expiringIn30Days }}</p>
					</NuxtLink>
					<NuxtLink
						to="/management/assets?maintenanceDueWithinDays=30"
						class="rounded-xl border border-gray-200 px-4 py-3 transition-colors hover:border-brand-500 dark:border-gray-700"
					>
						<p class="text-xs text-gray-600 dark:text-gray-400">Sắp bảo dưỡng 30 ngày</p>
						<p class="mt-0.5 text-lg font-bold tabular-nums text-gray-900 dark:text-white">{{ data.maintenanceDueIn30Days }}</p>
					</NuxtLink>
					<NuxtLink
						to="/management/assets?pendingConfirmation=true"
						class="rounded-xl border border-gray-200 px-4 py-3 transition-colors hover:border-brand-500 dark:border-gray-700"
					>
						<p class="text-xs text-gray-600 dark:text-gray-400">Chờ người nhận xác nhận</p>
						<p class="mt-0.5 text-lg font-bold tabular-nums text-gray-900 dark:text-white">{{ data.pendingConfirmations }}</p>
					</NuxtLink>
					<NuxtLink
						to="/management/assets?disputed=true"
						class="rounded-xl border border-gray-200 px-4 py-3 transition-colors hover:border-brand-500 dark:border-gray-700"
					>
						<p class="text-xs text-gray-600 dark:text-gray-400">Người nhận báo chưa đúng</p>
						<p
							class="mt-0.5 text-lg font-bold tabular-nums"
							:class="data.disputedConfirmations ? 'text-rose-600 dark:text-rose-400' : 'text-gray-900 dark:text-white'"
						>
							{{ data.disputedConfirmations }}
						</p>
					</NuxtLink>
					<NuxtLink
						to="/management/assets/incidents"
						class="rounded-xl border border-gray-200 px-4 py-3 transition-colors hover:border-brand-500 dark:border-gray-700"
					>
						<p class="text-xs text-gray-600 dark:text-gray-400">Báo hỏng, báo mất đang mở</p>
						<p
							class="mt-0.5 text-lg font-bold tabular-nums"
							:class="data.openIncidents ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'"
						>
							{{ data.openIncidents }}
						</p>
					</NuxtLink>
				</div>
			</div>

			<!-- Theo phòng ban -->
			<div v-if="departmentRows.length" class="space-y-2">
				<p class="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
					Thiết bị theo phòng ban
				</p>
				<div class="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
					<table class="w-full text-sm">
						<thead class="bg-gray-50 text-xs text-gray-600 dark:bg-gray-800/50 dark:text-gray-400">
							<tr>
								<th class="px-4 py-2 text-left font-medium">Phòng ban</th>
								<th class="px-4 py-2 text-right font-medium">Số lượng</th>
								<th v-if="data.canViewValue" class="px-4 py-2 text-right font-medium">Nguyên giá</th>
								<th v-if="data.canViewValue" class="px-4 py-2 text-right font-medium">Giá trị còn lại</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
							<tr v-for="row in departmentRows" :key="row.departmentName">
								<td
									class="px-4 py-2"
									:class="row.label === 'Chưa cấp phát' ? 'italic text-gray-600 dark:text-gray-400' : 'text-gray-800 dark:text-gray-200'"
								>
									{{ row.label }}
								</td>
								<td class="px-4 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">{{ row.count }}</td>
								<td v-if="data.canViewValue" class="px-4 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
									{{ formatAssetMoney(row.costVnd) }}
								</td>
								<td v-if="data.canViewValue" class="px-4 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
									{{ formatAssetMoney(row.bookValue) }}
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</div>
	</section>
</template>
