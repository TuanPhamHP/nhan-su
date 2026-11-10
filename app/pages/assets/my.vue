<script setup lang="ts">
	import { useAssetService } from '~/services/asset.service';
	import MyServiceCard from '~/components/modules/asset/MyServiceCard.vue';
	import { CONFIRMATION_CLASS } from '~/utils/asset.utils';
	import { formatDate } from '~/utils/date';
	import type { Asset, AssetAssignment, MyAssets } from '~/types/asset.types';

	definePageMeta({ title: 'Tài sản của tôi' });

	const route = useRoute();
	const router = useRouter();
	const toast = useToast();
	const service = useAssetService();

	const data = ref<MyAssets | null>(null);
	const services = ref<Asset[]>([]);
	const loading = ref(true);
	const confirming = ref<AssetAssignment | null>(null);
	const disputeReason = ref('');
	const submitting = ref(false);
	const expandedService = ref<number | null>(null);

	type TabId = 'assets' | 'services';
	const activeTab = ref<TabId>('assets');

	/** Tab dịch vụ chỉ hiện khi người này thực sự phụ trách dịch vụ nào đó. */
	const hasServices = computed(() => services.value.length > 0);

	async function loadAssets() {
		try {
			data.value = await service.myAssets();
		} catch (e) {
			data.value = null;
			toast.error(e instanceof Error ? e.message : 'Không tải được tài sản của bạn');
		}
	}

	async function loadServices() {
		try {
			services.value = await service.myServices();
		} catch {
			// Không phụ trách dịch vụ nào, hoặc module tắt: ẩn tab, không báo lỗi.
			services.value = [];
		}
	}

	onMounted(async () => {
		loading.value = true;
		await Promise.all([loadAssets(), loadServices()]);
		loading.value = false;
		applyQuery();
	});

	/**
	 * Thông báo `asset_service` mở thẳng tab Dịch vụ và bung đúng thẻ.
	 *
	 * Dọn query TRƯỚC khi dùng để F5 không mở lại, giống các trang khác trong app.
	 */
	function applyQuery() {
		const tab = route.query.tab;
		const rawId = route.query.open_id;
		if (tab !== 'services' && !rawId) return;

		router.replace({ path: '/assets/my' });

		if (tab === 'services' && hasServices.value) activeTab.value = 'services';
		const id = Number(rawId);
		if (id && !Number.isNaN(id)) expandedService.value = id;
	}

	async function confirmAssignment(assignment: AssetAssignment, accepted: boolean) {
		if (!accepted && !disputeReason.value.trim()) {
			toast.error('Nhập lý do trước khi báo không đúng');
			return;
		}
		submitting.value = true;
		try {
			await service.confirmMyAssignment(assignment.id, {
				accepted,
				reason: accepted ? undefined : disputeReason.value.trim(),
			});
			toast.success(accepted ? 'Đã xác nhận nhận tài sản' : 'Đã gửi phản hồi không đúng');
			confirming.value = null;
			disputeReason.value = '';
			await loadAssets();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Gửi xác nhận thất bại');
		} finally {
			submitting.value = false;
		}
	}

	function holderNote(a: AssetAssignment): string {
		if (a.department) {
			return `Giao cho ${a.department.name}, bạn chịu trách nhiệm`;
		}
		return '';
	}

	async function onServiceChanged() {
		await loadServices();
	}
</script>

<template>
	<div class="space-y-5">
		<div>
			<h1 class="text-xl font-bold text-gray-900 dark:text-white">Tài sản của tôi</h1>
			<p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
				Thiết bị bạn đang giữ và dịch vụ bạn phụ trách
			</p>
		</div>

		<CommonAppModuleNotice module="ASSET" />

		<div v-if="hasServices" class="border-b border-gray-200 dark:border-gray-700">
			<nav class="-mb-px flex gap-1">
				<button
					type="button"
					:class="[
						'border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
						activeTab === 'assets'
							? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
							: 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400',
					]"
					@click="activeTab = 'assets'"
				>
					Thiết bị
					<!-- Badge là số lần bàn giao CHỜ XÁC NHẬN, không phải số món đang giữ:
					     nhãn tab vì thế không được trùng chữ với mục "Đang giữ" bên dưới. -->
					<span
						v-if="data?.pendingConfirmationCount"
						:title="`${data.pendingConfirmationCount} lần bàn giao chờ bạn xác nhận`"
						class="ml-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-amber-500 px-1 text-xs text-white"
					>
						{{ data.pendingConfirmationCount }}
					</span>
				</button>
				<button
					type="button"
					:class="[
						'border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
						activeTab === 'services'
							? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
							: 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400',
					]"
					@click="activeTab = 'services'"
				>
					Dịch vụ tôi phụ trách
					<span class="ml-1 text-xs font-normal text-gray-400">{{ services.length }}</span>
				</button>
			</nav>
		</div>

		<div v-if="loading" class="space-y-3">
			<div v-for="i in 3" :key="i" class="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
		</div>

		<!-- ── Tài sản đang giữ ─────────────────────────────────────────────── -->
		<template v-else-if="activeTab === 'assets'">
			<div
				v-if="!data?.holding.length && !data?.history.length"
				class="rounded-xl border border-gray-200 bg-white py-16 text-center dark:border-gray-700 dark:bg-gray-900"
			>
				<p class="text-sm text-gray-500 dark:text-gray-400">Bạn chưa được giao tài sản nào.</p>
			</div>

			<template v-else>
				<section v-if="data?.holding.length">
					<h2 class="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">
						Đang giữ
						<span class="ml-1 text-xs font-normal text-gray-400">{{ data.holding.length }}</span>
					</h2>

					<!-- Thẻ trên điện thoại -->
					<div class="space-y-3 sm:hidden">
						<article
							v-for="a in data.holding"
							:key="a.id"
							class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
						>
							<div class="flex items-start justify-between gap-2">
								<div class="min-w-0">
									<p class="font-medium text-gray-900 dark:text-white">{{ a.asset.name }}</p>
									<p class="font-mono text-xs text-gray-400">{{ a.asset.code }}</p>
								</div>
								<span class="inline-flex flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium" :class="CONFIRMATION_CLASS[a.confirmation]">
									{{ a.confirmationLabel }}
								</span>
							</div>
							<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
								{{ a.asset.categoryName }} · nhận ngày {{ formatDate(a.assignedAt) }}
							</p>
							<p v-if="holderNote(a)" class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ holderNote(a) }}</p>
							<div v-if="a.confirmation === 'PENDING'" class="mt-3 flex gap-2">
								<CommonAppButton size="sm" variant="primary" :loading="submitting" @click="confirmAssignment(a, true)">
									Đã nhận
								</CommonAppButton>
								<CommonAppButton size="sm" variant="outline" @click="confirming = a">Không đúng</CommonAppButton>
							</div>
						</article>
					</div>

					<!-- Bảng từ sm trở lên -->
					<div class="hidden overflow-hidden rounded-xl border border-gray-200 bg-white sm:block dark:border-gray-700 dark:bg-gray-900">
						<table class="w-full text-sm">
							<thead class="bg-gray-50 text-xs text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
								<tr>
									<th class="px-4 py-2 text-left font-medium">Tài sản</th>
									<th class="px-4 py-2 text-left font-medium">Loại</th>
									<th class="px-4 py-2 text-left font-medium">Nhận ngày</th>
									<th class="px-4 py-2 text-left font-medium">Xác nhận</th>
									<th class="px-4 py-2" />
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
								<tr v-for="a in data.holding" :key="a.id">
									<td class="px-4 py-3">
										<p class="font-medium text-gray-900 dark:text-white">{{ a.asset.name }}</p>
										<p class="font-mono text-xs text-gray-400">{{ a.asset.code }}</p>
										<p v-if="holderNote(a)" class="text-xs text-gray-400">{{ holderNote(a) }}</p>
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
										<p v-if="a.disputeReason" class="mt-1 text-xs text-rose-600 dark:text-rose-400">
											{{ a.disputeReason }}
										</p>
									</td>
									<td class="px-4 py-3 text-right">
										<div v-if="a.confirmation === 'PENDING'" class="flex justify-end gap-2">
											<CommonAppButton size="sm" variant="primary" :loading="submitting" @click="confirmAssignment(a, true)">
												Đã nhận
											</CommonAppButton>
											<CommonAppButton size="sm" variant="outline" @click="confirming = a">Không đúng</CommonAppButton>
										</div>
									</td>
								</tr>
							</tbody>
						</table>
					</div>
				</section>

				<section v-if="data?.history.length">
					<h2 class="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">
						Đã trả
						<span class="ml-1 text-xs font-normal text-gray-400">{{ data.history.length }}</span>
					</h2>
					<div class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
						<ul class="divide-y divide-gray-100 dark:divide-gray-800">
							<li v-for="a in data.history" :key="a.id" class="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
								<div class="min-w-0">
									<p class="text-sm text-gray-900 dark:text-white">{{ a.asset.name }}</p>
									<p class="font-mono text-xs text-gray-400">{{ a.asset.code }}</p>
								</div>
								<p class="text-xs text-gray-500 dark:text-gray-400">
									{{ formatDate(a.assignedAt) }} – {{ formatDate(a.returnedAt) }}
									<template v-if="a.conditionOnReturnLabel"> · {{ a.conditionOnReturnLabel }}</template>
								</p>
							</li>
						</ul>
					</div>
				</section>
			</template>
		</template>

		<!-- ── Dịch vụ tôi phụ trách ────────────────────────────────────────── -->
		<template v-else>
			<div class="space-y-3">
				<MyServiceCard
					v-for="s in services"
					:key="s.id"
					:service="s"
					:expanded="expandedService === s.id"
					@toggle="expandedService = expandedService === s.id ? null : s.id"
					@changed="onServiceChanged"
				/>
			</div>
		</template>

		<!-- Hộp thoại báo không đúng -->
		<Teleport to="body">
			<div v-if="confirming" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
				<div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">Báo không đúng</h2>
					<p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
						{{ confirming.asset.code }} · {{ confirming.asset.name }}
					</p>
					<div class="mt-4 space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
							Lý do <span class="text-red-500">*</span>
						</label>
						<textarea
							v-model="disputeReason"
							rows="3"
							placeholder="VD: máy không đúng serial ghi trên phiếu"
							class="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
						/>
						<p class="text-xs text-gray-500 dark:text-gray-400">
							Người bàn giao sẽ nhận được thông báo. Sau khi hai bên thống nhất, bạn vẫn bấm "Đã nhận" được.
						</p>
					</div>
					<div class="mt-5 flex justify-end gap-3">
						<CommonAppButton variant="secondary" @click="confirming = null; disputeReason = ''">Huỷ</CommonAppButton>
						<CommonAppButton
							variant="primary"
							:disabled="!disputeReason.trim()"
							:loading="submitting"
							@click="confirmAssignment(confirming, false)"
						>
							Gửi
						</CommonAppButton>
					</div>
				</div>
			</div>
		</Teleport>
	</div>
</template>
