<script setup lang="ts">
	import { format } from 'date-fns';
	import { useMakeupAttendanceService } from '~/services/makeup-attendance.service';
	import MakeupStatusBadge from '~/components/modules/makeup-attendance/MakeupStatusBadge.vue';
	import MakeupDetailModal from '~/components/modules/makeup-attendance/MakeupDetailModal.vue';
	import type {
		MakeupRequestResponse,
		MakeupRequestStatus,
		QueryMakeupRequestParams,
	} from '~/types/makeup-attendance.types';
	import type { PaginatedMeta } from '~/types/api.types';
	import { MAKEUP_STATUS_OPTIONS } from '~/utils/makeup-attendance.utils';

	definePageMeta({ title: 'Đơn bù công của tôi' });

	const toast = useToast();
	const route = useRoute();
	const router = useRouter();
	const service = useMakeupAttendanceService();

	const today = new Date();
	const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

	// ─── Filters ──────────────────────────────────────────────────────────────
	const filter = reactive({
		startDate: format(firstDayOfMonth, 'yyyy-MM-dd'),
		endDate: format(today, 'yyyy-MM-dd'),
		status: undefined as MakeupRequestStatus | undefined,
		page: 1,
	});

	const statusOptions = MAKEUP_STATUS_OPTIONS;

	// ─── Data ─────────────────────────────────────────────────────────────────
	const requests = ref<MakeupRequestResponse[]>([]);
	const loading = ref(false);
	const meta = ref<PaginatedMeta | null>(null);

	async function fetchMyRequests() {
		loading.value = true;
		try {
			const params: QueryMakeupRequestParams = {
				startDate: filter.startDate || undefined,
				endDate: filter.endDate || undefined,
				status: filter.status,
				page: filter.page,
				limit: 20,
			};
			const res = await service.findMyRequests(params);
			requests.value = res.data;
			meta.value = res.meta;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Lỗi tải đơn bù công');
		} finally {
			loading.value = false;
		}
	}

	function applyFilter() {
		filter.page = 1;
		fetchMyRequests();
	}

	function goToPage(p: number) {
		filter.page = p;
		fetchMyRequests();
	}

	// ─── Detail modal ─────────────────────────────────────────────────────────
	const detailTarget = ref<MakeupRequestResponse | null>(null);

	// ─── Cancel (withdraw) ────────────────────────────────────────────────────
	const cancellingId = ref<string | null>(null);

	async function handleCancel(req: MakeupRequestResponse) {
		if (req.status !== 'PENDING') return;
		if (!confirm(`Bạn có chắc muốn thu hồi đơn bù công ngày ${formatDate(req.attendanceDate)}?`)) return;
		cancellingId.value = req.id;
		try {
			const updated = await service.cancel(req.id);
			const idx = requests.value.findIndex(r => r.id === updated.id);
			if (idx !== -1) requests.value.splice(idx, 1, updated);
			if (detailTarget.value?.id === updated.id) detailTarget.value = updated;
			toast.success('Đã thu hồi đơn bù công');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Không thể thu hồi đơn');
		} finally {
			cancellingId.value = null;
		}
	}

	// ─── Helpers ──────────────────────────────────────────────────────────────
	function formatDate(d: string) {
		return format(new Date(d), 'dd/MM/yyyy');
	}

	function formatTime(iso: string | null) {
		if (!iso) return '—';
		return format(new Date(iso), 'HH:mm');
	}

	function truncate(text: string | null, len = 55) {
		if (!text) return '—';
		return text.length > len ? text.slice(0, len) + '…' : text;
	}

	// ─── Auto-open detail from ?open_id ───────────────────────────────────────
	// BE không expose GET /:id → chỉ tra trong list vừa fetch. Nếu record không nằm
	// trong page/filter hiện tại, mở rộng khoảng thời gian rồi thử lại 1 lần.
	async function openByQueryId() {
		const raw = route.query.open_id;
		if (!raw) return;
		const targetId = String(raw);
		router.replace({ path: '/makeup-attendance/my' });

		let hit = requests.value.find(r => String(r.id) === targetId);
		if (!hit) {
			try {
				const res = await service.findMyRequests({ page: 1, limit: 100 });
				hit = res.data.find(r => String(r.id) === targetId);
			} catch {
				// non-critical
			}
		}
		if (hit) detailTarget.value = hit;
	}

	// ─── Lifecycle ────────────────────────────────────────────────────────────
	onMounted(async () => {
		await fetchMyRequests();
		openByQueryId();
	});
</script>

<template>
	<div class="space-y-5">
		<!-- Header -->
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
			<div>
				<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Đơn bù công của tôi</h1>
				<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
					Theo dõi trạng thái các đơn bù công đã gửi
				</p>
			</div>
			<NuxtLink
				to="/attendance/my"
				class="inline-flex items-center gap-1.5 text-sm text-brand-600 dark:text-brand-400 hover:underline"
			>
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
				</svg>
				Tạo đơn từ lịch chấm công
			</NuxtLink>
		</div>

		<!-- Filter bar -->
		<div class="flex flex-col sm:flex-row flex-wrap gap-3">
			<div class="w-full sm:w-72">
				<UiDateRangePicker
					:from-date="filter.startDate"
					:to-date="filter.endDate"
					placeholder="Khoảng thời gian"
					@update:from-date="filter.startDate = $event"
					@update:to-date="filter.endDate = $event"
				/>
			</div>

			<div class="w-full sm:w-44">
				<UiSelect
					:model-value="filter.status"
					:options="statusOptions"
					placeholder="Tất cả trạng thái"
					@update:model-value="filter.status = $event as MakeupRequestStatus | undefined"
				/>
			</div>

			<CommonAppButton class="h-10" :loading="loading" @click="applyFilter">
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z" />
				</svg>
				Áp dụng
			</CommonAppButton>
		</div>

		<!-- Table -->
		<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
								Ngày bù
							</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
								Giờ đề xuất
							</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
								Lý do
							</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
								Minh chứng
							</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
								Trạng thái
							</th>
							<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
								Người duyệt
							</th>
							<th class="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
								Thao tác
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
						<tr v-if="loading">
							<td colspan="7" class="px-4 py-8 text-center">
								<svg class="animate-spin w-5 h-5 mx-auto text-brand-500" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
								</svg>
							</td>
						</tr>
						<tr v-else-if="requests.length === 0">
							<td colspan="7" class="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
								Chưa có đơn bù công nào. Vào
								<NuxtLink to="/attendance/my" class="text-brand-600 dark:text-brand-400 hover:underline">
									lịch chấm công
								</NuxtLink>
								để tạo đơn cho ngày đã bị khoá.
							</td>
						</tr>
						<tr
							v-for="req in requests"
							:key="req.id"
							class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
						>
							<td class="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap font-medium">
								{{ formatDate(req.attendanceDate) }}
							</td>
							<td class="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap font-mono text-xs">
								{{ formatTime(req.requestedCheckIn) }} → {{ formatTime(req.requestedCheckOut) }}
							</td>
							<td class="px-4 py-3 max-w-[220px]">
								<UiTooltip v-if="req.reason && req.reason.length > 55" :label="req.reason">
									<span class="text-gray-600 dark:text-gray-400 cursor-default">{{ truncate(req.reason) }}</span>
								</UiTooltip>
								<span v-else class="text-gray-600 dark:text-gray-400">{{ req.reason || '—' }}</span>
							</td>
							<td class="px-4 py-3">
								<a
									v-if="req.evidencePhotoUrl"
									:href="req.evidencePhotoUrl"
									target="_blank"
									rel="noopener noreferrer"
									class="inline-flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:underline"
								>
									<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
									</svg>
									Xem ảnh
								</a>
								<span v-else class="text-xs text-gray-400 dark:text-gray-500">—</span>
							</td>
							<td class="px-4 py-3">
								<MakeupStatusBadge :status="req.status" />
							</td>
							<td class="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
								{{ req.reviewedBy?.fullName ?? '—' }}
							</td>
							<td class="px-4 py-3">
								<div class="flex items-center justify-end gap-1.5">
									<button
										class="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/10 transition-colors"
										title="Xem chi tiết"
										@click="detailTarget = req"
									>
										<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
											/>
											<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
										</svg>
									</button>
									<CommonAppButton
										v-if="req.status === 'PENDING'"
										size="sm"
										variant="danger_outline"
										:loading="cancellingId === req.id"
										@click="handleCancel(req)"
									>
										Thu hồi
									</CommonAppButton>
								</div>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>

		<!-- Pagination -->
		<div v-if="meta && meta.totalPages > 1" class="flex items-center justify-between pt-1">
			<p class="text-sm text-gray-500 dark:text-gray-400">
				Tổng <strong class="text-gray-700 dark:text-gray-300">{{ meta.total }}</strong> đơn
			</p>
			<CommonAppPagination
				:current-page="filter.page"
				:total-pages="meta.totalPages"
				@update:current-page="goToPage"
			/>
		</div>
	</div>

	<!-- Detail modal -->
	<Teleport to="body">
		<MakeupDetailModal
			v-if="detailTarget"
			:request="detailTarget"
			:can-cancel="detailTarget.status === 'PENDING'"
			:cancelling="cancellingId === detailTarget.id"
			@cancel="handleCancel(detailTarget)"
			@close="detailTarget = null"
		/>
	</Teleport>
</template>
