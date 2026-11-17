<script setup lang="ts">
	import { storeToRefs } from 'pinia';
	import RequestStatusBadge from '~/components/modules/general-request/RequestStatusBadge.vue';
	// `app/services/` không được Nuxt auto-import, chỉ `composables/` và `utils/`.
	import { useGeneralRequestService } from '~/services/general-request.service';
	import { useGeneralRequestStore } from '~/stores/generalRequest';
	import { dueText, holderText, requestCodeText, roundText } from '~/utils/general-request.utils';
	import { formatDate, formatDateTime } from '~/utils/date';
	import {
		REQUEST_CATEGORY_CLASS,
		REQUEST_CATEGORY_LABELS,
		REQUEST_STATUS_LABELS,
		type DocumentTemplateDetail,
		type GeneralRequestResponse,
		type GeneralRequestStatus,
		type PendingRequest,
		type QueryRequestParams,
	} from '~/types/general-request.types';

	/**
	 * Danh sách phiếu đề xuất (UI-01, lô 4a).
	 *
	 * Năm tab là năm câu hỏi khác nhau của người dùng, và mỗi câu hỏi là một endpoint riêng:
	 * phiếu của tôi (`/me`), phiếu bị trả lại chờ tôi sửa (`/me?status=RETURNED`), phiếu chờ tôi
	 * duyệt (`/pending-for-me`), phiếu tôi theo dõi (`/watching`), và tra cứu trong phạm vi xem
	 * được (`GET /`). Từ lô 4a `/me` chỉ còn phiếu của chính mình, nên nhân sự muốn xem phiếu
	 * người khác thì vào tab Tra cứu.
	 *
	 * Ô lọc người gửi, người duyệt ở tab Tra cứu chỉ dựng cho vai trò quản lý: nhân viên không
	 * gọi được `/v1/employees` nên không có danh bạ để chọn, và họ cũng chỉ tra được phiếu liên
	 * quan tới mình.
	 */
	definePageMeta({ title: 'Phiếu đề xuất' });

	const toast = useToast();
	const route = useRoute();
	const router = useRouter();
	const { user } = useAuth();
	const service = useGeneralRequestService();
	const { printRequest } = usePrint();
	const generalRequestStore = useGeneralRequestStore();
	const approvalStore = useApprovalStore();
	const { counts } = storeToRefs(approvalStore);
	const directoryStore = useDirectoryStore();
	const { employees: directoryEmployees } = storeToRefs(directoryStore);

	const {
		myRequests,
		myMeta,
		myLoading,
		returnedRequests,
		returnedMeta,
		returnedLoading,
		pendingRequests,
		pendingLoading,
		watchingRequests,
		watchingMeta,
		watchingLoading,
		searchResults,
		searchMeta,
		searchLoading,
		fetchMine,
		fetchReturned,
		fetchPendingForMe,
		fetchWatching,
		fetchSearch,
	} = useGeneralRequests();

	/**
	 * Ô lọc người gửi và người duyệt chỉ dựng được khi có danh bạ.
	 *
	 * Không chặn theo vai trò: máy chủ cho cả nhân viên đọc danh sách nhân viên, và nhân viên tra
	 * cứu trong phạm vi của mình cũng cần lọc theo người duyệt. Danh bạ rỗng thì hai ô đó ẩn.
	 */
	const directoryReady = computed(() => directoryEmployees.value.length > 0);

	// ─── Tab ──────────────────────────────────────────────────────────────────────
	const TABS = ['mine', 'returned', 'pending', 'watching', 'search'] as const;
	type Tab = (typeof TABS)[number];

	const TAB_LABELS: Record<Tab, string> = {
		mine: 'Của tôi',
		returned: 'Cần bổ sung',
		pending: 'Chờ tôi duyệt',
		watching: 'Đang theo dõi',
		search: 'Tra cứu',
	};

	function initialTab(): Tab {
		const raw = route.query.tab as Tab | undefined;
		return raw && TABS.includes(raw) ? raw : 'mine';
	}
	const activeTab = ref<Tab>(initialTab());

	const PAGE_SIZE = 20;
	const minePage = ref(1);
	const returnedPage = ref(1);
	const watchingPage = ref(1);
	const searchPage = ref(1);

	const mineStatus = ref<GeneralRequestStatus | undefined>(undefined);

	const searchFilter = reactive<{
		status?: GeneralRequestStatus;
		templateId?: number;
		employeeId?: number;
		approverId?: number;
		from: string;
		to: string;
		code: string;
		q: string;
	}>({ from: '', to: '', code: '', q: '' });

	const templates = ref<DocumentTemplateDetail[]>([]);

	const statusOptions = computed(() => [
		{ value: undefined, label: 'Tất cả trạng thái' },
		...Object.entries(REQUEST_STATUS_LABELS).map(([value, label]) => ({ value, label })),
	]);

	const templateOptions = computed(() => [
		{ value: undefined, label: 'Tất cả loại phiếu' },
		...templates.value.map(t => ({ value: t.id, label: t.name })),
	]);

	const employeeOptions = computed(() => [
		{ value: undefined, label: 'Tất cả người gửi' },
		...directoryEmployees.value.map(e => ({ value: e.id, label: `${e.fullName} · ${e.employeeCode}` })),
	]);

	const approverOptions = computed(() => [
		{ value: undefined, label: 'Tất cả người duyệt' },
		...directoryEmployees.value.map(e => ({ value: e.id, label: `${e.fullName} · ${e.employeeCode}` })),
	]);

	// ─── Tải dữ liệu ──────────────────────────────────────────────────────────────
	/**
	 * Lỗi tải của tab đang mở.
	 *
	 * Phải tách khỏi trạng thái rỗng: mất mạng mà hiện "Bạn chưa gửi phiếu nào" là nói sai với
	 * người dùng, nên tab hỏng sẽ hiện khối lỗi kèm nút thử lại ngay trong vùng nội dung.
	 */
	const tabError = ref<string | null>(null);

	function failed(e: unknown, fallback: string) {
		tabError.value = e instanceof Error ? e.message : fallback;
	}

	async function loadMine() {
		tabError.value = null;
		try {
			await fetchMine({ page: minePage.value, limit: PAGE_SIZE, status: mineStatus.value });
		} catch (e) {
			failed(e, 'Chưa tải được danh sách phiếu, bạn thử lại sau ít phút.');
		}
	}

	/** `silent` dùng khi tab khác đang mở và lần tải này chỉ để lấy số đếm cho tab. */
	async function loadReturned(silent = false) {
		if (!silent) tabError.value = null;
		try {
			await fetchReturned({ page: returnedPage.value, limit: PAGE_SIZE });
		} catch (e) {
			if (!silent) failed(e, 'Chưa tải được phiếu cần bổ sung, bạn thử lại sau ít phút.');
		}
	}

	async function loadPending(silent = false) {
		if (!silent) tabError.value = null;
		try {
			await fetchPendingForMe();
		} catch (e) {
			if (!silent) failed(e, 'Chưa tải được phiếu chờ bạn duyệt, bạn thử lại sau ít phút.');
		}
	}

	async function loadWatching() {
		tabError.value = null;
		try {
			await fetchWatching({ page: watchingPage.value, limit: PAGE_SIZE });
		} catch (e) {
			failed(e, 'Chưa tải được phiếu bạn đang theo dõi, bạn thử lại sau ít phút.');
		}
	}

	async function loadSearch() {
		tabError.value = null;
		const params: QueryRequestParams = {
			page: searchPage.value,
			limit: PAGE_SIZE,
			status: searchFilter.status,
			templateId: searchFilter.templateId,
			employeeId: searchFilter.employeeId,
			approverId: searchFilter.approverId,
			from: searchFilter.from || undefined,
			to: searchFilter.to || undefined,
			code: searchFilter.code.trim() || undefined,
			q: searchFilter.q.trim() || undefined,
		};
		try {
			await fetchSearch(params);
		} catch (e) {
			failed(e, 'Chưa tra cứu được, bạn thử lại sau ít phút.');
		}
	}

	function loadCurrentTab() {
		switch (activeTab.value) {
			case 'mine':
				return loadMine();
			case 'returned':
				return loadReturned();
			case 'pending':
				return loadPending();
			case 'watching':
				return loadWatching();
			case 'search':
				return loadSearch();
		}
	}

	async function loadTemplates() {
		try {
			templates.value = await service.findTemplates();
		} catch {
			// Ô lọc loại phiếu không có thì vẫn tra cứu được bằng các ô còn lại.
			templates.value = [];
		}
	}

	/**
	 * Cuộn tab đang mở vào tầm nhìn.
	 *
	 * Năm tab không vừa bề ngang điện thoại nên thanh này cuộn ngang. Mở trang bằng `?tab=search`
	 * mà không cuộn thì người dùng thấy ba tab đầu, không tab nào sáng, và tưởng trang hỏng.
	 */
	const tabBarRef = ref<HTMLElement | null>(null);

	function scrollActiveTabIntoView() {
		const bar = tabBarRef.value;
		if (!bar) return;
		const current = bar.querySelector<HTMLElement>(`[data-tab="${activeTab.value}"]`);
		current?.scrollIntoView({ block: 'nearest', inline: 'center' });
	}

	onMounted(scrollActiveTabIntoView);

	watch(activeTab, tab => {
		router.replace({ query: { ...route.query, tab } });
		loadCurrentTab();
		nextTick(scrollActiveTabIntoView);
	});

	// Nhận thông báo đẩy về phiếu đề xuất thì tải lại tab đang mở.
	watch(
		() => generalRequestStore.refreshSignal,
		() => {
			loadCurrentTab();
			approvalStore.fetchCounts();
		},
	);

	/**
	 * Thông báo dẫn tới `/general-requests?id=12`: mở thẳng phiếu đó.
	 *
	 * Đổi địa chỉ bằng `replace` để nút quay lại của trình duyệt về đúng trang trước đó, chứ
	 * không quay lại một địa chỉ chỉ có tác dụng chuyển hướng.
	 */
	function openFromQuery(): boolean {
		const raw = route.query.id;
		if (!raw) return false;
		const id = Number(raw);
		if (!id || Number.isNaN(id)) return false;
		router.replace(`/general-requests/${id}`);
		return true;
	}

	onMounted(() => {
		if (openFromQuery()) return;
		loadCurrentTab();
		loadTemplates();
		approvalStore.fetchCounts();
		if (activeTab.value === 'pending') loadPending();
		// Danh bạ chỉ phục vụ hai ô lọc của tab Tra cứu, nên tải lỗi thì bỏ qua trong im lặng:
		// hai ô đó tự ẩn, còn mọi tab khác không cần danh bạ.
		directoryStore.load().catch(() => {});
	});

	// ─── Số đếm trên tab ──────────────────────────────────────────────────────────
	/** Phiếu chờ tôi duyệt: lấy số của hộp khi đã tải, còn lại dùng badge chung của hộp thư duyệt. */
	const pendingCount = computed(() =>
		pendingRequests.value.length || counts.value.generalRequests || 0,
	);
	const returnedCount = computed(() => returnedMeta.value?.total ?? returnedRequests.value.length);

	function tabCount(tab: Tab): number {
		if (tab === 'pending') return pendingCount.value;
		if (tab === 'returned') return returnedCount.value;
		return 0;
	}

	// Số phiếu cần bổ sung và số phiếu chờ duyệt phải có ngay từ đầu để tab hiện số, dù người dùng
	// đang ở tab khác. Hai lần tải này chỉ phục vụ con số nên hỏng thì im lặng, không chen thêm
	// một câu lỗi thứ hai vào trang.
	onMounted(() => {
		if (activeTab.value !== 'returned') loadReturned(true);
		if (activeTab.value !== 'pending') loadPending(true);
	});

	// ─── Thao tác nhanh trên dòng ─────────────────────────────────────────────────
	const printingId = ref<number | null>(null);

	async function handlePrint(req: GeneralRequestResponse) {
		printingId.value = req.id;
		try {
			await printRequest(req.id);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa in được phiếu.');
		} finally {
			printingId.value = null;
		}
	}

	function openDetail(id: number) {
		router.push(`/general-requests/${id}`);
	}

	/** "Trưởng phòng duyệt, Lê Văn Dũng đang giữ lượt" — một câu thay vì hai mảnh ghép bằng dấu. */
	function stepText(req: GeneralRequestResponse): string {
		if (!req.currentStep) return 'Không còn bước nào đang chờ';
		const who = req.currentStep.approvers.length
			? `${holderText(req.currentStep.approvers)} đang giữ lượt`
			: 'chưa có người giữ lượt';
		return `${req.currentStep.name}, ${who}`;
	}

	function onBehalfLabel(req: PendingRequest): string | null {
		return req.onBehalfOf ? `Bạn duyệt thay ${req.onBehalfOf.fullName}` : null;
	}

	function resetSearch() {
		searchFilter.status = undefined;
		searchFilter.templateId = undefined;
		searchFilter.employeeId = undefined;
		searchFilter.approverId = undefined;
		searchFilter.from = '';
		searchFilter.to = '';
		searchFilter.code = '';
		searchFilter.q = '';
		searchPage.value = 1;
		loadSearch();
	}
</script>

<template>
	<!-- Chừa lề đáy trên điện thoại vì nút trợ lý nổi ở góc dưới phải che mất dòng cuối danh sách. -->
	<div class="space-y-5 pb-24 sm:pb-0">
		<!-- Đầu trang -->
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Phiếu đề xuất</h1>
				<p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
					Tại đây bạn gửi phiếu, theo dõi phiếu của mình và xử lý phiếu đang chờ bạn duyệt.
				</p>
			</div>
			<NuxtLink to="/general-requests/create">
				<CommonAppButton>
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
					</svg>
					Gửi phiếu mới
				</CommonAppButton>
			</NuxtLink>
		</div>

		<!-- Tab: trên điện thoại thanh này cuộn ngang, nên tab đang mở được cuộn vào tầm nhìn -->
		<div
			ref="tabBarRef"
			class="flex w-full items-center gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1 dark:bg-gray-800 sm:w-fit"
		>
			<button
				v-for="tab in TABS"
				:key="tab"
				:data-tab="tab"
				class="flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-1.5 text-sm font-medium transition-all"
				:class="
					activeTab === tab
						? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
						: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
				"
				@click="activeTab = tab"
			>
				{{ TAB_LABELS[tab] }}
				<span
					v-if="tabCount(tab) > 0"
					class="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-100 px-1.5 text-xs font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
				>
					{{ tabCount(tab) }}
				</span>
			</button>
		</div>

		<!-- Tải hỏng: nói đúng là lỗi tải, kèm nút thử lại, thay vì hiện như tab không có phiếu -->
		<div
			v-if="tabError"
			class="rounded-xl border border-rose-200 bg-rose-50 px-6 py-12 text-center dark:border-rose-900/40 dark:bg-rose-900/10"
		>
			<p class="text-base font-medium text-rose-900 dark:text-rose-200">Chưa tải được danh sách</p>
			<p class="mx-auto mt-2 max-w-md text-sm text-rose-800 dark:text-rose-300">{{ tabError }}</p>
			<CommonAppButton class="mt-5" @click="loadCurrentTab">Thử lại</CommonAppButton>
		</div>

		<!-- ═════════════════════════════ Của tôi ═════════════════════════════ -->
		<template v-else-if="activeTab === 'mine'">
			<div class="max-w-xs">
				<UiSelect
					:model-value="mineStatus"
					:options="statusOptions"
					placeholder="Tất cả trạng thái"
					@update:model-value="
						value => {
							mineStatus = (value as GeneralRequestStatus) || undefined;
							minePage = 1;
							loadMine();
						}
					"
				/>
			</div>

			<div v-if="myLoading" class="space-y-2">
				<div v-for="i in 3" :key="i" class="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
			</div>

			<div
				v-else-if="!myRequests.length"
				class="rounded-xl border border-gray-200 bg-white py-16 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
			>
				Bạn chưa gửi phiếu nào. Bấm "Gửi phiếu mới" để bắt đầu.
			</div>

			<template v-else>
				<!-- Điện thoại -->
				<ul class="space-y-2 sm:hidden">
					<li
						v-for="req in myRequests"
						:key="req.id"
						class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
						@click="openDetail(req.id)"
					>
						<div class="flex items-start justify-between gap-2">
							<div class="min-w-0">
								<p class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ requestCodeText(req.code) }}</p>
								<p class="mt-0.5 truncate text-sm font-medium text-gray-900 dark:text-white">{{ req.title }}</p>
								<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ req.template.name }}</p>
							</div>
							<RequestStatusBadge :status="req.status" :status-label="req.statusLabel" />
						</div>
						<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">{{ stepText(req) }}</p>
						<p class="mt-0.5 text-xs text-gray-400">
							Tạo ngày {{ formatDate(req.createdAt) }}
							<span v-if="roundText(req.round)"> · {{ roundText(req.round) }}</span>
						</p>
					</li>
				</ul>

				<!-- Máy tính -->
				<div
					class="hidden overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 sm:block"
				>
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead>
								<tr class="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
									<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Số hiệu</th>
									<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Phiếu</th>
									<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Trạng thái</th>
									<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Bước hiện tại</th>
									<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Ngày tạo</th>
									<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Thao tác</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
								<tr
									v-for="req in myRequests"
									:key="req.id"
									class="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
									@click="openDetail(req.id)"
								>
									<td class="whitespace-nowrap px-4 py-3 font-medium text-gray-700 dark:text-gray-200">
										{{ requestCodeText(req.code) }}
										<p v-if="roundText(req.round)" class="text-xs font-normal text-gray-400">{{ roundText(req.round) }}</p>
									</td>
									<td class="px-4 py-3">
										<div class="flex items-center gap-2">
											<span
												class="rounded px-1.5 py-0.5 text-xs font-medium"
												:class="REQUEST_CATEGORY_CLASS[req.template.category] ?? REQUEST_CATEGORY_CLASS.OTHER"
											>
												{{ REQUEST_CATEGORY_LABELS[req.template.category] ?? req.template.category }}
											</span>
											<p class="font-medium text-gray-900 dark:text-white">{{ req.title }}</p>
										</div>
										<p class="mt-0.5 text-xs text-gray-400">{{ req.template.name }}</p>
									</td>
									<td class="px-4 py-3"><RequestStatusBadge :status="req.status" :status-label="req.statusLabel" /></td>
									<td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ stepText(req) }}</td>
									<td class="whitespace-nowrap px-4 py-3 text-gray-500 dark:text-gray-400">{{ formatDate(req.createdAt) }}</td>
									<td class="px-4 py-3">
										<div class="flex items-center justify-end gap-1.5" @click.stop>
											<button
												v-if="req.canPrint"
												class="rounded-md px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
												:disabled="printingId === req.id"
												@click="handlePrint(req)"
											>
												{{ printingId === req.id ? 'Đang in…' : 'In phiếu' }}
											</button>
											<button
												class="rounded-md px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-900/20"
												@click="openDetail(req.id)"
											>
												Mở phiếu
											</button>
										</div>
									</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>

				<div v-if="myMeta && myMeta.totalPages > 1" class="flex flex-wrap items-center justify-between gap-3">
					<p class="text-sm text-gray-500 dark:text-gray-400">
						Tổng <strong class="text-gray-700 dark:text-gray-300">{{ myMeta.total }}</strong> phiếu
					</p>
					<CommonAppPagination
						:current-page="minePage"
						:total-pages="myMeta.totalPages"
						@update:current-page="
							p => {
								minePage = p;
								loadMine();
							}
						"
					/>
				</div>
			</template>
		</template>

		<!-- ═══════════════════════════ Cần bổ sung ═══════════════════════════ -->
		<template v-else-if="activeTab === 'returned'">
			<p class="text-sm text-gray-500 dark:text-gray-400">
				Người duyệt đã trả lại những phiếu này để bạn bổ sung. Bạn sửa rồi nộp lại, số hiệu phiếu giữ nguyên.
			</p>

			<div v-if="returnedLoading" class="space-y-2">
				<div v-for="i in 2" :key="i" class="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
			</div>

			<div
				v-else-if="!returnedRequests.length"
				class="rounded-xl border border-gray-200 bg-white py-16 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
			>
				Không có phiếu nào cần bổ sung.
			</div>

			<ul v-else class="space-y-2">
				<li
					v-for="req in returnedRequests"
					:key="req.id"
					class="cursor-pointer rounded-xl border border-amber-200 bg-amber-50 p-4 transition-colors hover:border-amber-300 dark:border-amber-900/40 dark:bg-amber-900/10"
					@click="openDetail(req.id)"
				>
					<div class="flex flex-wrap items-start justify-between gap-2">
						<div class="min-w-0">
							<p class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ requestCodeText(req.code) }}</p>
							<p class="mt-0.5 text-sm font-medium text-gray-900 dark:text-white">{{ req.title }}</p>
							<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ req.template.name }}</p>
						</div>
						<div class="flex flex-shrink-0 items-center gap-2">
							<RequestStatusBadge :status="req.status" :status-label="req.statusLabel" />
							<NuxtLink :to="`/general-requests/create?id=${req.id}`" @click.stop>
								<CommonAppButton size="sm">Sửa và nộp lại</CommonAppButton>
							</NuxtLink>
						</div>
					</div>
					<p v-if="req.returnedAt" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
						Bị trả lại ngày {{ formatDate(req.returnedAt) }}
					</p>
				</li>
			</ul>

			<div v-if="returnedMeta && returnedMeta.totalPages > 1" class="flex justify-end">
				<CommonAppPagination
					:current-page="returnedPage"
					:total-pages="returnedMeta.totalPages"
					@update:current-page="
						p => {
							returnedPage = p;
							loadReturned();
						}
					"
				/>
			</div>
		</template>

		<!-- ═══════════════════════════ Chờ tôi duyệt ═════════════════════════ -->
		<template v-else-if="activeTab === 'pending'">
			<div v-if="pendingLoading" class="space-y-2">
				<div v-for="i in 3" :key="i" class="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
			</div>

			<div
				v-else-if="!pendingRequests.length"
				class="rounded-xl border border-gray-200 bg-white py-16 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
			>
				Không có phiếu nào chờ bạn duyệt.
			</div>

			<template v-else>
				<ul class="space-y-2 sm:hidden">
					<li
						v-for="req in pendingRequests"
						:key="req.id"
						class="rounded-xl border bg-white p-4 dark:bg-gray-900"
						:class="req.overdue ? 'border-rose-300 dark:border-rose-900/60' : 'border-gray-200 dark:border-gray-700'"
						@click="openDetail(req.id)"
					>
						<p class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ requestCodeText(req.code) }}</p>
						<p class="mt-0.5 text-sm font-medium text-gray-900 dark:text-white">{{ req.title }}</p>
						<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
							{{ req.employee.fullName }} · {{ req.template.name }}
						</p>
						<p
							v-if="dueText(req.dueAt, req.overdue)"
							class="mt-1 text-xs"
							:class="req.overdue ? 'text-rose-600 dark:text-rose-400' : 'text-gray-500 dark:text-gray-400'"
						>
							{{ dueText(req.dueAt, req.overdue) }}
						</p>
						<p v-if="onBehalfLabel(req)" class="mt-0.5 text-xs text-sky-700 dark:text-sky-300">{{ onBehalfLabel(req) }}</p>
					</li>
				</ul>

				<div
					class="hidden overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 sm:block"
				>
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead>
								<tr class="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
									<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Số hiệu</th>
									<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Phiếu</th>
									<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Người gửi</th>
									<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Bước của tôi</th>
									<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Hạn xử lý</th>
									<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Thao tác</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
								<tr
									v-for="req in pendingRequests"
									:key="req.id"
									class="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
									:class="req.overdue ? 'bg-rose-50/60 dark:bg-rose-900/10' : ''"
									@click="openDetail(req.id)"
								>
									<td class="whitespace-nowrap px-4 py-3 font-medium text-gray-700 dark:text-gray-200">
										{{ requestCodeText(req.code) }}
									</td>
									<td class="px-4 py-3">
										<p class="font-medium text-gray-900 dark:text-white">{{ req.title }}</p>
										<p class="mt-0.5 text-xs text-gray-400">{{ req.template.name }}</p>
									</td>
									<td class="px-4 py-3 text-gray-600 dark:text-gray-300">
										{{ req.employee.fullName }}
										<p class="text-xs text-gray-400">{{ req.employee.employeeCode }}</p>
									</td>
									<td class="px-4 py-3 text-gray-600 dark:text-gray-300">
										{{ req.currentStep?.name ?? '—' }}
										<p v-if="onBehalfLabel(req)" class="text-xs text-sky-700 dark:text-sky-300">{{ onBehalfLabel(req) }}</p>
									</td>
									<!-- Cột đã mang tên "Hạn xử lý" nên ô chỉ cần mốc thời gian. -->
									<td class="whitespace-nowrap px-4 py-3">
										<template v-if="req.dueAt">
											<span
												class="text-xs"
												:class="req.overdue ? 'font-medium text-rose-600 dark:text-rose-400' : 'text-gray-500 dark:text-gray-400'"
											>
												{{ formatDateTime(req.dueAt) }}
											</span>
											<p v-if="req.overdue" class="text-xs font-medium text-rose-600 dark:text-rose-400">Đã quá hạn</p>
										</template>
										<span v-else class="text-xs text-gray-400">Không có hạn</span>
									</td>
									<td class="px-4 py-3 text-right" @click.stop>
										<CommonAppButton size="sm" class="whitespace-nowrap" @click="openDetail(req.id)">
											Mở phiếu để duyệt
										</CommonAppButton>
									</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>
			</template>
		</template>

		<!-- ═══════════════════════════ Đang theo dõi ═════════════════════════ -->
		<template v-else-if="activeTab === 'watching'">
			<p class="text-sm text-gray-500 dark:text-gray-400">
				Đây là những phiếu mà bạn được thêm làm người theo dõi hoặc được mời cho ý kiến.
			</p>

			<div v-if="watchingLoading" class="space-y-2">
				<div v-for="i in 2" :key="i" class="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
			</div>

			<div
				v-else-if="!watchingRequests.length"
				class="rounded-xl border border-gray-200 bg-white py-16 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
			>
				Bạn chưa được thêm vào phiếu nào để theo dõi. Phiếu hiện ở đây khi người gửi thêm bạn làm người theo dõi, hoặc
				khi người duyệt mời bạn cho ý kiến.
			</div>

			<ul v-else class="space-y-2">
				<li
					v-for="req in watchingRequests"
					:key="req.id"
					class="cursor-pointer rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800/50"
					@click="openDetail(req.id)"
				>
					<div class="flex flex-wrap items-start justify-between gap-2">
						<div class="min-w-0">
							<p class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ requestCodeText(req.code) }}</p>
							<p class="mt-0.5 text-sm font-medium text-gray-900 dark:text-white">{{ req.title }}</p>
							<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
								{{ req.employee.fullName }} · {{ req.template.name }}
							</p>
						</div>
						<RequestStatusBadge :status="req.status" :status-label="req.statusLabel" />
					</div>
					<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">{{ stepText(req) }}</p>
				</li>
			</ul>

			<div v-if="watchingMeta && watchingMeta.totalPages > 1" class="flex justify-end">
				<CommonAppPagination
					:current-page="watchingPage"
					:total-pages="watchingMeta.totalPages"
					@update:current-page="
						p => {
							watchingPage = p;
							loadWatching();
						}
					"
				/>
			</div>
		</template>

		<!-- ═════════════════════════════ Tra cứu ═════════════════════════════ -->
		<template v-else>
			<div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
					<UiSelect
						:model-value="searchFilter.status"
						:options="statusOptions"
						label="Trạng thái"
						placeholder="Tất cả trạng thái"
						@update:model-value="value => (searchFilter.status = (value as GeneralRequestStatus) || undefined)"
					/>
					<UiSelect
						:model-value="searchFilter.templateId"
						:options="templateOptions"
						label="Loại phiếu"
						placeholder="Tất cả loại phiếu"
						@update:model-value="value => (searchFilter.templateId = value ? Number(value) : undefined)"
					/>
					<div class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Số hiệu</label>
						<input
							v-model="searchFilter.code"
							type="text"
							placeholder="Ví dụ TT-0012/2026"
							class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							@keyup.enter="
								searchPage = 1;
								loadSearch();
							"
						/>
					</div>
					<div class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Tìm trong tiêu đề</label>
						<input
							v-model="searchFilter.q"
							type="text"
							placeholder="Gõ một phần tiêu đề phiếu"
							class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							@keyup.enter="
								searchPage = 1;
								loadSearch();
							"
						/>
					</div>
					<UiSelect
						v-if="directoryReady"
						:model-value="searchFilter.employeeId"
						:options="employeeOptions"
						label="Người gửi"
						placeholder="Tất cả người gửi"
						@update:model-value="value => (searchFilter.employeeId = value ? Number(value) : undefined)"
					/>
					<UiSelect
						v-if="directoryReady"
						:model-value="searchFilter.approverId"
						:options="approverOptions"
						label="Người duyệt"
						placeholder="Tất cả người duyệt"
						@update:model-value="value => (searchFilter.approverId = value ? Number(value) : undefined)"
					/>
					<div class="space-y-1 sm:col-span-2">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Khoảng ngày gửi</label>
						<UiDateRangePicker
							:from-date="searchFilter.from"
							:to-date="searchFilter.to"
							@update:from-date="value => (searchFilter.from = value)"
							@update:to-date="value => (searchFilter.to = value)"
						/>
					</div>
				</div>
				<div class="mt-3 flex flex-wrap justify-end gap-2">
					<CommonAppButton variant="secondary" @click="resetSearch">Xoá bộ lọc</CommonAppButton>
					<CommonAppButton
						@click="
							searchPage = 1;
							loadSearch();
						"
					>
						Tra cứu
					</CommonAppButton>
				</div>
			</div>

			<div v-if="searchLoading" class="space-y-2">
				<div v-for="i in 3" :key="i" class="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
			</div>

			<div
				v-else-if="!searchResults.length"
				class="rounded-xl border border-gray-200 bg-white py-16 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
			>
				Không có phiếu nào khớp bộ lọc này. Bạn nới bộ lọc rồi tra cứu lại.
			</div>

			<template v-else>
				<p v-if="searchMeta" class="text-sm text-gray-500 dark:text-gray-400">
					Tìm thấy <strong class="text-gray-700 dark:text-gray-300">{{ searchMeta.total }}</strong> phiếu khớp bộ lọc.
				</p>
				<div
					class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
				>
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead>
								<tr class="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
									<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Số hiệu</th>
									<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tiêu đề</th>
									<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Người gửi</th>
									<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Trạng thái</th>
									<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Bước hiện tại</th>
									<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Ngày gửi</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
								<tr
									v-for="req in searchResults"
									:key="req.id"
									class="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
									@click="openDetail(req.id)"
								>
									<td class="whitespace-nowrap px-4 py-3 font-medium text-gray-700 dark:text-gray-200">
										{{ requestCodeText(req.code) }}
									</td>
									<td class="px-4 py-3">
										<p class="font-medium text-gray-900 dark:text-white">{{ req.title }}</p>
										<p class="mt-0.5 text-xs text-gray-400">{{ req.template.name }}</p>
									</td>
									<td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ req.employee.fullName }}</td>
									<td class="px-4 py-3"><RequestStatusBadge :status="req.status" :status-label="req.statusLabel" /></td>
									<td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ stepText(req) }}</td>
									<td class="whitespace-nowrap px-4 py-3 text-gray-500 dark:text-gray-400">
										{{ req.submittedAt ? formatDate(req.submittedAt) : '—' }}
									</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>

				<div v-if="searchMeta" class="flex flex-wrap items-center justify-end gap-3">
					<CommonAppPagination
						v-if="searchMeta.totalPages > 1"
						:current-page="searchPage"
						:total-pages="searchMeta.totalPages"
						@update:current-page="
							p => {
								searchPage = p;
								loadSearch();
							}
						"
					/>
				</div>
			</template>
		</template>
	</div>
</template>
