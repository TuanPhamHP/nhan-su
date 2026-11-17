<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import RecruitChip from '~/components/modules/recruitment/RecruitChip.vue';
	import RecruitNotePromptModal from '~/components/modules/recruitment/RecruitNotePromptModal.vue';
	import {
		formatRecruitMoney,
		recruitErrorMessage,
		OFFER_STATUS_CLASS,
		REQUISITION_STATUS_CLASS,
	} from '~/utils/recruitment.utils';
	import { formatDateTime } from '~/utils/date';
	import type { RecruitInbox, RecruitInboxItem } from '~/types/recruitment.types';

	definePageMeta({ title: 'Chờ tôi duyệt' });

	const toast = useToast();
	const service = useRecruitmentService();
	const { canWrite } = useModuleAccess();

	const canDecide = computed(() => canWrite('RECRUIT'));

	const filterType = ref<'' | 'REQUISITION' | 'OFFER'>('');
	const inbox = ref<RecruitInbox | null>(null);
	const loading = ref(true);
	const loadError = ref<string | null>(null);

	const typeOptions = [
		{ value: '', label: 'Tất cả loại việc' },
		{ value: 'REQUISITION', label: 'Yêu cầu tuyển dụng' },
		{ value: 'OFFER', label: 'Offer' },
	];

	async function load() {
		loading.value = true;
		loadError.value = null;
		try {
			inbox.value = await service.approvalInbox(filterType.value || undefined);
		} catch (e) {
			inbox.value = null;
			loadError.value = recruitErrorMessage(e, 'Không tải được hộp duyệt');
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);
	watch(filterType, load);

	// ─── Duyệt nhanh ──────────────────────────────────────────────────────────────
	//
	// Duyệt thì không cần lý do nên bấm là chạy; từ chối thì BE BẮT BUỘC `note`, nên phải
	// mở hộp thoại hỏi lý do — không có đường duyệt nhanh "từ chối" nào bỏ qua được bước này.

	const deciding = ref<number | null>(null);
	const rejectTarget = ref<RecruitInboxItem | null>(null);

	function itemKey(item: RecruitInboxItem): number {
		return item.stepId;
	}

	async function approve(item: RecruitInboxItem) {
		if (deciding.value !== null) return;
		deciding.value = itemKey(item);
		try {
			if (item.type === 'REQUISITION' && item.requisition) {
				await service.approveRequisition(item.requisition.id);
			} else if (item.offer) {
				await service.approveOffer(item.offer.id);
			}
			toast.success('Đã duyệt');
			await load();
		} catch (e) {
			// Người khác vừa quyết bước này (409) cũng vào đây: tải lại cho danh sách khớp thực tế.
			toast.error(recruitErrorMessage(e, 'Duyệt thất bại'));
			await load();
		} finally {
			deciding.value = null;
		}
	}

	async function doReject(note: string) {
		const item = rejectTarget.value;
		if (!item) return;
		if (item.type === 'REQUISITION' && item.requisition) {
			await service.rejectRequisition(item.requisition.id, note);
		} else if (item.offer) {
			await service.rejectOffer(item.offer.id, note);
		}
	}

	async function onRejected() {
		rejectTarget.value = null;
		toast.success('Đã từ chối');
		await load();
	}

	const rejectTitle = computed(() =>
		rejectTarget.value?.type === 'OFFER' ? 'Từ chối duyệt offer' : 'Từ chối yêu cầu tuyển dụng',
	);

	/**
	 * Vượt định biên thì bấm Duyệt chắc chắn nhận 409 `RECRUIT_HEADCOUNT_EXCEEDED` và bước vẫn
	 * đứng nguyên, nên khoá nút ngay trên thẻ. Từ chối thì không kiểm định biên, vẫn bấm được —
	 * và thường đó là việc người duyệt nên làm, nên không khoá theo.
	 */
	function exceedsHeadcount(item: RecruitInboxItem): boolean {
		const r = item.requisition;
		return !!r && r.headcountAvailable < r.quantity;
	}

	function detailRoute(item: RecruitInboxItem): string {
		if (item.type === 'REQUISITION' && item.requisition) {
			return `/management/recruitment/requisitions/${item.requisition.id}`;
		}
		return item.offer ? `/management/recruitment/offers/${item.offer.id}` : '#';
	}
</script>

<template>
	<div class="space-y-5">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<h1 class="text-xl font-bold text-gray-900 dark:text-white">Chờ tôi duyệt</h1>
				<p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
					Yêu cầu tuyển dụng, offer và đề xuất định biên đang đến lượt bạn
				</p>
			</div>
			<div class="w-52">
				<UiSelect v-model="filterType" :options="typeOptions" />
			</div>
		</div>

		<CommonAppModuleNotice module="RECRUIT" />

		<div v-if="loading" class="space-y-3">
			<div v-for="i in 3" :key="i" class="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
		</div>

		<div
			v-else-if="loadError"
			class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-center dark:border-rose-800 dark:bg-rose-900/20"
		>
			<p class="text-sm text-rose-700 dark:text-rose-300">{{ loadError }}</p>
		</div>

		<template v-else-if="inbox">
			<!-- Đề xuất định biên chờ chốt: gom theo năm, mở sang bảng định biên -->
			<div
				v-if="inbox.headcountPending.length"
				class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
			>
				<h2 class="text-base font-semibold text-gray-900 dark:text-white">Đề xuất định biên chờ chốt</h2>
				<ul class="mt-3 space-y-2">
					<li
						v-for="row in inbox.headcountPending"
						:key="row.year"
						class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-800"
					>
						<p class="text-sm text-gray-700 dark:text-gray-300">
							Năm {{ row.year }} có {{ row.count }} dòng đang chờ bạn chốt
						</p>
						<NuxtLink
							:to="`/management/recruitment/headcount?year=${row.year}`"
							class="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
						>
							Mở bảng định biên
						</NuxtLink>
					</li>
				</ul>
			</div>

			<div
				v-if="!inbox.items.length"
				class="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16 text-gray-400 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-500"
			>
				<svg class="mb-3 h-10 w-10 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<p class="text-sm">Không có việc nào đang chờ bạn duyệt</p>
			</div>

			<ul v-else class="space-y-3">
				<li
					v-for="item in inbox.items"
					:key="item.stepId"
					class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
				>
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div class="min-w-0 space-y-1">
							<div class="flex flex-wrap items-center gap-2">
								<RecruitChip
									:label="item.typeLabel"
									tone="bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300"
								/>
								<NuxtLink
									:to="detailRoute(item)"
									class="font-mono text-sm font-medium text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400"
								>
									{{ item.requisition?.code ?? item.offer?.code }}
								</NuxtLink>
								<RecruitChip
									v-if="item.requisition"
									:label="item.requisition.statusLabel"
									:tone="REQUISITION_STATUS_CLASS[item.requisition.status]"
								/>
								<RecruitChip
									v-else-if="item.offer"
									:label="item.offer.statusLabel"
									:tone="OFFER_STATUS_CLASS[item.offer.status]"
								/>
							</div>

							<p v-if="item.requisition" class="text-sm text-gray-700 dark:text-gray-300">
								{{ item.requisition.position.name }} · {{ item.requisition.department.name }} ·
								{{ item.requisition.quantity }} người · {{ item.requisition.reasonLabel }}
							</p>
							<p v-else-if="item.offer" class="text-sm text-gray-700 dark:text-gray-300">
								{{ item.offer.candidateName }} · {{ item.offer.positionName }} · phiên bản
								{{ item.offer.version }} · lương {{ formatRecruitMoney(item.offer.baseSalary) }}
							</p>

							<p class="text-xs text-gray-500 dark:text-gray-400">
								Bước {{ item.level }} · {{ item.basisLabel }} · chờ từ
								{{ formatDateTime(item.waitingSince) }}
								<template v-if="item.requisition">
									· người tạo {{ item.requisition.createdBy.fullName }}
								</template>
							</p>

							<p v-if="item.requisition" class="text-xs text-gray-500 dark:text-gray-400">
								Định biên còn trống {{ item.requisition.headcountAvailable }}, chưa tính yêu cầu này.
							</p>

							<p
								v-if="exceedsHeadcount(item)"
								class="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
							>
								Vượt định biên: xin {{ item.requisition?.quantity }}, còn trống
								{{ item.requisition?.headcountAvailable }}. Duyệt sẽ bị chặn, nên hãy từ chối kèm lý
								do, hoặc chốt thêm định biên cho vị trí này trước.
							</p>

							<p
								v-if="item.offer?.overBand"
								class="text-xs font-medium text-amber-600 dark:text-amber-400"
							>
								Offer này vượt khung lương của yêu cầu tuyển dụng.
							</p>
						</div>

						<div class="flex flex-wrap items-center gap-2">
							<NuxtLink
								:to="detailRoute(item)"
								class="text-sm text-brand-600 hover:underline dark:text-brand-400"
							>
								Xem chi tiết
							</NuxtLink>
							<template v-if="canDecide">
								<CommonAppButton
									variant="danger_outline"
									size="sm"
									@click="rejectTarget = item"
								>
									Từ chối
								</CommonAppButton>
								<CommonAppButton
									variant="primary"
									size="sm"
									:loading="deciding === item.stepId"
									:disabled="exceedsHeadcount(item)"
									@click="approve(item)"
								>
									Duyệt
								</CommonAppButton>
							</template>
						</div>
					</div>
				</li>
			</ul>
		</template>

		<RecruitNotePromptModal
			v-if="rejectTarget"
			:title="rejectTitle"
			description="Người tạo sẽ nhận được lý do này cùng thông báo, nên hãy viết rõ cần sửa gì."
			label="Lý do từ chối"
			confirm-label="Từ chối"
			variant="danger"
			:submit="doReject"
			@done="onRejected"
			@close="rejectTarget = null"
		/>
	</div>
</template>
