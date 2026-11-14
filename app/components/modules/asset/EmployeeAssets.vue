<script setup lang="ts">
	import { useAssetService } from '~/services/asset.service';
	import ReturnModal from '~/components/modules/asset/ReturnModal.vue';
	import { CONFIRMATION_CLASS, assignmentEndText, lowerFirst } from '~/utils/asset.utils';
	import { formatDate } from '~/utils/date';
	import type { AssetAssignment } from '~/types/asset.types';

	const props = defineProps<{
		employeeId: number;
		canManage: boolean;
	}>();

	const toast = useToast();
	const service = useAssetService();

	const assignments = ref<AssetAssignment[]>([]);
	const loading = ref(true);
	const returning = ref<AssetAssignment | null>(null);
	const returningAll = ref(false);
	const confirmReturnAll = ref(false);

	const open = computed(() => assignments.value.filter(a => !a.returnedAt));
	const closed = computed(() => assignments.value.filter(a => a.returnedAt));
	/**
	 * "Thu hồi tất cả" chỉ thu tài sản cấp phát cho chính nhân viên. Tài sản cấp phát cho phòng
	 * ban mà người này chịu trách nhiệm thì ở lại, nên hộp xác nhận phải nói riêng hai con số.
	 */
	const ownOpen = computed(() => open.value.filter(a => !a.department));
	const departmentOpen = computed(() => open.value.filter(a => a.department));
	const loadError = ref<string | null>(null);

	async function load() {
		loading.value = true;
		loadError.value = null;
		try {
			assignments.value = await service.findEmployeeAssets(props.employeeId);
		} catch (e) {
			assignments.value = [];
			loadError.value =
				e instanceof Error ? e.message : 'Chưa tải được tài sản của nhân viên này. Bạn bấm Thử lại.';
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);
	watch(() => props.employeeId, load);

	function assetLabel(a: AssetAssignment): string {
		return a.department ? `${a.asset.name} (thay mặt ${a.department.name})` : a.asset.name;
	}

	async function returnAll() {
		if (returningAll.value) return;
		returningAll.value = true;
		try {
			const count = await service.returnAllEmployeeAssets(props.employeeId);
			const left = departmentOpen.value.length;
			toast.success(
				left
					? `Đã thu hồi ${count} tài sản của nhân viên này. Còn ${left} tài sản cấp phát cho phòng ban mà nhân viên này chịu trách nhiệm, bạn điều chuyển cho người khác.`
					: `Đã thu hồi ${count} tài sản của nhân viên này.`,
			);
			confirmReturnAll.value = false;
			await load();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa thu hồi được. Bạn thử lại sau ít phút.');
		} finally {
			returningAll.value = false;
		}
	}

	async function onReturned() {
		returning.value = null;
		await load();
	}
</script>

<template>
	<div class="space-y-5">
		<div v-if="loading" class="space-y-3">
			<div v-for="i in 3" :key="i" class="h-14 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
		</div>

		<div
			v-else-if="loadError"
			class="flex flex-col items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-8 text-center dark:border-rose-800 dark:bg-rose-900/20"
		>
			<p class="text-sm text-rose-700 dark:text-rose-300">{{ loadError }}</p>
			<CommonAppButton size="sm" variant="outline" @click="load">Thử lại</CommonAppButton>
		</div>

		<template v-else>
			<section class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
				<div class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
					<h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100">
						Đang giữ
						<span class="ml-1 text-xs font-normal text-gray-400">{{ open.length }}</span>
					</h3>
					<CommonAppButton
						v-if="canManage && ownOpen.length"
						size="sm"
						variant="outline"
						@click="confirmReturnAll = true"
					>
						Thu hồi tất cả
					</CommonAppButton>
				</div>

				<p v-if="!open.length" class="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
					Nhân viên không giữ tài sản nào.
				</p>

				<div v-else class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead class="bg-gray-50 text-xs text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
							<tr>
								<th class="px-4 py-2 text-left font-medium">Tài sản</th>
								<th class="px-4 py-2 text-left font-medium">Loại</th>
								<th class="px-4 py-2 text-left font-medium">Ngày cấp phát</th>
								<th class="px-4 py-2 text-left font-medium">Người nhận xác nhận</th>
								<th v-if="canManage" class="px-4 py-2" />
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
							<tr v-for="a in open" :key="a.id">
								<td class="px-4 py-3">
									<NuxtLink
										:to="`/management/assets/${a.asset.id}`"
										class="font-medium text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400"
									>
										{{ assetLabel(a) }}
									</NuxtLink>
									<p class="font-mono text-xs text-gray-400">{{ a.asset.code }}</p>
								</td>
								<td class="px-4 py-3 text-gray-600 dark:text-gray-300">
									{{ a.asset.categoryName }}
									<p class="text-xs text-gray-400">{{ a.asset.kindLabel }}</p>
								</td>
								<td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ formatDate(a.assignedAt) }}</td>
								<td class="px-4 py-3">
									<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" :class="CONFIRMATION_CLASS[a.confirmation]">
										{{ a.confirmationLabel }}
									</span>
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
					Đã kết thúc
					<span class="ml-1 text-xs font-normal text-gray-400">{{ closed.length }}</span>
				</h3>
				<ul class="divide-y divide-gray-100 dark:divide-gray-800">
					<li v-for="a in closed" :key="a.id" class="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
						<div class="min-w-0">
							<p class="text-sm text-gray-900 dark:text-white">{{ a.asset.name }}</p>
							<p class="font-mono text-xs text-gray-400">{{ a.asset.code }}</p>
						</div>
						<p class="text-xs text-gray-500 dark:text-gray-400">
							{{ formatDate(a.assignedAt) }} – {{ formatDate(a.returnedAt) }}, {{ lowerFirst(assignmentEndText(a)) }}<template v-if="a.conditionOnReturnLabel">, tình trạng {{ a.conditionOnReturnLabel.toLowerCase() }}</template>
						</p>
					</li>
				</ul>
			</section>
		</template>

		<ReturnModal v-if="returning" :assignment="returning" @returned="onReturned" @close="returning = null" />

		<Teleport to="body">
			<div v-if="confirmReturnAll" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
				<div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">Thu hồi tất cả</h2>
					<p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
						Thu hồi {{ ownOpen.length }} tài sản nhân viên này đang giữ trong một lần, ngày thu hồi là hôm nay và
						tình trạng khi thu hồi để trống. Món nào hỏng hay thiếu phụ kiện thì bạn thu hồi riêng để ghi tình
						trạng.
					</p>
					<p v-if="departmentOpen.length" class="mt-2 text-sm text-amber-800 dark:text-amber-300">
						{{ departmentOpen.length }} tài sản cấp phát cho phòng ban mà nhân viên này chịu trách nhiệm sẽ không
						được thu hồi, bạn điều chuyển chúng cho người chịu trách nhiệm mới.
					</p>
					<div class="mt-5 flex justify-end gap-3">
						<CommonAppButton variant="secondary" @click="confirmReturnAll = false">Đóng</CommonAppButton>
						<CommonAppButton variant="primary" :loading="returningAll" @click="returnAll">Thu hồi tất cả</CommonAppButton>
					</div>
				</div>
			</div>
		</Teleport>
	</div>
</template>
