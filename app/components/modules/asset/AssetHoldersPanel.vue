<script setup lang="ts">
	import { useAssetService } from '~/services/asset.service';
	import ReturnModal from '~/components/modules/asset/ReturnModal.vue';
	import { CONFIRMATION_CLASS } from '~/utils/asset.utils';
	import { formatDate } from '~/utils/date';
	import type { Asset, AssetAssignment } from '~/types/asset.types';

	const props = defineProps<{
		asset: Asset;
		canManage: boolean;
	}>();

	const emit = defineEmits<{ 'asset-changed': [] }>();

	const toast = useToast();
	const service = useAssetService();

	const assignments = ref<AssetAssignment[]>([]);
	const loading = ref(true);
	const returning = ref<AssetAssignment | null>(null);

	const isService = computed(() => props.asset.kind === 'SERVICE');
	const open = computed(() => assignments.value.filter(a => !a.returnedAt));
	const closed = computed(() => assignments.value.filter(a => a.returnedAt));

	async function load() {
		loading.value = true;
		try {
			assignments.value = await service.findAssignments(props.asset.id);
		} catch (e) {
			assignments.value = [];
			toast.error(e instanceof Error ? e.message : 'Không tải được lịch sử cấp phát');
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);

	function holderName(a: AssetAssignment): string {
		if (a.employee) return a.employee.fullName;
		if (a.department) {
			return a.responsible ? `${a.department.name} (${a.responsible.fullName})` : a.department.name;
		}
		return '—';
	}

	async function onReturned() {
		returning.value = null;
		await load();
		emit('asset-changed');
	}
</script>

<template>
	<div class="space-y-5">
		<div v-if="loading" class="space-y-3">
			<div v-for="i in 3" :key="i" class="h-14 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
		</div>

		<template v-else>
			<section class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
				<h3 class="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-800 dark:border-gray-700 dark:text-gray-100">
					{{ isService ? 'Ghế đang dùng' : 'Đang giữ' }}
					<span class="ml-1 text-xs font-normal text-gray-400">{{ open.length }}</span>
				</h3>

				<p v-if="!open.length" class="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
					{{ isService ? 'Chưa cấp ghế cho ai.' : 'Tài sản chưa giao cho ai.' }}
				</p>

				<div v-else class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead class="bg-gray-50 text-xs text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
							<tr>
								<th class="px-4 py-2 text-left font-medium">Người giữ</th>
								<th class="px-4 py-2 text-left font-medium">Từ ngày</th>
								<th class="px-4 py-2 text-left font-medium">Xác nhận</th>
								<th v-if="!isService" class="px-4 py-2 text-left font-medium">Tình trạng khi giao</th>
								<th v-if="canManage" class="px-4 py-2" />
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
							<tr v-for="a in open" :key="a.id">
								<td class="px-4 py-3">
									<p class="font-medium text-gray-900 dark:text-white">{{ holderName(a) }}</p>
									<p v-if="a.employee" class="font-mono text-xs text-gray-400">{{ a.employee.employeeCode }}</p>
								</td>
								<td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ formatDate(a.assignedAt) }}</td>
								<td class="px-4 py-3">
									<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" :class="CONFIRMATION_CLASS[a.confirmation]">
										{{ a.confirmationLabel }}
									</span>
									<p v-if="a.disputeReason" class="mt-1 text-xs text-rose-600 dark:text-rose-400">
										{{ a.disputeReason }}
									</p>
								</td>
								<td v-if="!isService" class="px-4 py-3 text-gray-600 dark:text-gray-300">
									{{ a.conditionOnAssignLabel ?? '—' }}
								</td>
								<td v-if="canManage" class="px-4 py-3 text-right">
									<CommonAppButton size="sm" variant="outline" @click="returning = a">Thu hồi</CommonAppButton>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</section>

			<section
				v-if="closed.length"
				class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
			>
				<h3 class="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-800 dark:border-gray-700 dark:text-gray-100">
					Đã trả
					<span class="ml-1 text-xs font-normal text-gray-400">{{ closed.length }}</span>
				</h3>
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead class="bg-gray-50 text-xs text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
							<tr>
								<th class="px-4 py-2 text-left font-medium">Người giữ</th>
								<th class="px-4 py-2 text-left font-medium">Từ</th>
								<th class="px-4 py-2 text-left font-medium">Đến</th>
								<th class="px-4 py-2 text-left font-medium">Tình trạng khi trả</th>
								<th class="px-4 py-2 text-left font-medium">Ghi chú</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
							<tr v-for="a in closed" :key="a.id">
								<td class="px-4 py-3 text-gray-900 dark:text-white">{{ holderName(a) }}</td>
								<td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ formatDate(a.assignedAt) }}</td>
								<td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ formatDate(a.returnedAt) }}</td>
								<td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ a.conditionOnReturnLabel ?? '—' }}</td>
								<td class="px-4 py-3 text-gray-500 dark:text-gray-400">{{ a.returnNote ?? '—' }}</td>
							</tr>
						</tbody>
					</table>
				</div>
			</section>
		</template>

		<ReturnModal
			v-if="returning"
			:assignment="returning"
			@returned="onReturned"
			@close="returning = null"
		/>
	</div>
</template>
