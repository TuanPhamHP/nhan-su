<script setup lang="ts">
	import AgentDailyChart from '~/components/modules/agent/AgentDailyChart.vue';
	import AgentTopicTable from '~/components/modules/agent/AgentTopicTable.vue';
	import AgentStatCard from '~/components/modules/agent/AgentStatCard.vue';
	import {
		PLAYBOOK_LABELS,
		RATING_COLORS,
		type AgentAnalyticsOverview,
		type AgentReviewConversation,
		type AgentReviewConversationsQuery,
		type AgentTopUser,
	} from '~/types/agent-analytics.types';
	import type { PaginatedMeta, PaginatedResponse } from '~/types/api.types';
	import { formatDate, formatDateTime } from '~/utils/date';

	const props = defineProps<{
		user: AgentTopUser;
		from: string;
		to: string;
		/** Hàm tải do page truyền xuống — component không tự gọi service. */
		fetch: (employeeId: number) => Promise<AgentAnalyticsOverview>;
		/** Chỉ ADMIN. Sai thì cả mục "Hội thoại" không hiện và không gọi API nào của nó. */
		canReview?: boolean;
		/** Nhãn mức đánh giá do server cấp, FE KHÔNG giữ bản sao. */
		ratingLabels?: Record<string, string>;
		fetchConversations?: (
			query: AgentReviewConversationsQuery,
		) => Promise<PaginatedResponse<AgentReviewConversation>>;
	}>();

	const emit = defineEmits<{ close: []; 'open-conversation': [conversationId: number] }>();

	const data = ref<AgentAnalyticsOverview | null>(null);
	const loading = ref(true);
	const error = ref<string | null>(null);

	const nf = new Intl.NumberFormat('vi-VN');
	const fmtTok = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : nf.format(n));
	const fmtUsd = (n: number) => (n === 0 ? '$0' : '$' + n.toFixed(n < 1 ? 4 : 2));

	/**
	 * Khoảng hoạt động THẬT của người này, không phải khoảng đang lọc.
	 *
	 * BE chỉ trả về ngày có phát sinh, nên độ dài mảng `daily` chính là số ngày người
	 * này có hỏi — "12 lượt trong 30 ngày" và "12 lượt trong 2 ngày" là hai câu chuyện
	 * khác hẳn nhau.
	 */
	const activity = computed(() => {
		const days = data.value?.daily ?? [];
		if (!days.length) return null;
		return {
			firstDay: days[0]?.bucket ?? '',
			lastDay: days[days.length - 1]?.bucket ?? '',
			activeDays: days.length,
		};
	});

	const topTopic = computed(() => data.value?.topics[0] ?? null);
	const topTopicLabel = computed(() => {
		const id = topTopic.value?.playbookId;
		return id ? (PLAYBOOK_LABELS[id] ?? id) : '';
	});

	async function load(): Promise<void> {
		loading.value = true;
		error.value = null;
		try {
			data.value = await props.fetch(props.user.employeeId);
		} catch (err) {
			error.value = (err as Error)?.message ?? 'Không tải được số liệu của người này';
			data.value = null;
		} finally {
			loading.value = false;
		}
	}

	const CONVERSATIONS_PER_PAGE = 10;

	const conversations = ref<AgentReviewConversation[]>([]);
	const conversationsMeta = ref<PaginatedMeta | null>(null);
	const conversationsLoading = ref(false);
	const conversationsError = ref<string | null>(null);
	const conversationsPage = ref(1);
	const onlyIssues = ref(false);

	/** Lượt tải mới nhất — bấm đổi trang liên tiếp thì response về trễ phải bị bỏ. */
	let latestConversationsRequest = 0;

	async function loadConversations(): Promise<void> {
		if (!props.canReview || !props.fetchConversations) return;
		const request = ++latestConversationsRequest;
		conversationsLoading.value = true;
		conversationsError.value = null;
		try {
			const res = await props.fetchConversations({
				from: props.from,
				to: props.to,
				employeeId: props.user.employeeId,
				// Chỉ gửi khi bật: `false` và không gửi cho cùng một kết quả.
				onlyIssues: onlyIssues.value || undefined,
				page: conversationsPage.value,
				limit: CONVERSATIONS_PER_PAGE,
			});
			if (request !== latestConversationsRequest) return;
			conversations.value = res.data;
			conversationsMeta.value = res.meta;
		} catch (err) {
			if (request !== latestConversationsRequest) return;
			const apiMessage = (err as { data?: { error?: { message?: string } } })?.data?.error?.message;
			conversationsError.value = apiMessage ?? 'Không tải được danh sách hội thoại';
			conversations.value = [];
			conversationsMeta.value = null;
		} finally {
			if (request === latestConversationsRequest) conversationsLoading.value = false;
		}
	}

	function goToConversationsPage(page: number): void {
		conversationsPage.value = page;
		void loadConversations();
	}

	function toggleOnlyIssues(): void {
		onlyIssues.value = !onlyIssues.value;
		conversationsPage.value = 1;
		void loadConversations();
	}

	/** Badge của một dòng. Số 0 không hiện: nhìn vào là biết ngay dòng nào cần đọc. */
	function issueBadges(c: AgentReviewConversation) {
		return [
			{ key: 'bad', count: c.badRatings, label: props.ratingLabels?.BAD ?? 'BAD', dot: RATING_COLORS.BAD, title: 'Số câu trả lời bị chấm thấp nhất' },
			{ key: 'average', count: c.averageRatings, label: props.ratingLabels?.AVERAGE ?? 'AVERAGE', dot: RATING_COLORS.AVERAGE, title: 'Số câu trả lời bị chấm mức trung bình' },
			{ key: 'comments', count: c.comments, label: 'Góp ý', dot: 'bg-sky-500', title: 'Số lượt chấm có kèm góp ý chữ' },
			{ key: 'fallbacks', count: c.fallbacks, label: 'Không hiểu', dot: 'bg-violet-500', title: 'Số lượt trợ lý không hiểu câu hỏi' },
			{ key: 'errors', count: c.errors, label: 'Lỗi', dot: 'bg-red-600', title: 'Số lượt lỗi tool hoặc lỗi model' },
		].filter((b) => b.count > 0);
	}

	onMounted(() => {
		void load();
		void loadConversations();
	});
	// Đổi người mà không đóng modal thì phải tải lại — props.user là nguồn duy nhất
	watch(
		() => props.user.employeeId,
		() => {
			void load();
			conversationsPage.value = 1;
			void loadConversations();
		},
	);
</script>

<template>
	<Teleport to="body">
		<div
			class="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
			@click.self="emit('close')"
		>
			<div
				class="my-8 flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900"
			>
				<header class="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
					<div>
						<h2 class="text-base font-bold text-gray-900 dark:text-white">{{ user.fullName }}</h2>
						<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
							<template v-if="user.employeeCode || user.department">
								{{ [user.employeeCode, user.department].filter(Boolean).join(' · ') }} ·
							</template>
							{{ formatDate(from, 'dd/MM/yyyy') }} → {{ formatDate(to, 'dd/MM/yyyy') }}
						</p>
					</div>
					<button
						type="button"
						class="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
						aria-label="Đóng"
						@click="emit('close')"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</header>

				<div class="space-y-4 p-6">
					<p v-if="loading" class="py-16 text-center text-sm text-gray-500 dark:text-gray-400">
						Đang tải…
					</p>

					<div
						v-else-if="error"
						class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
					>
						{{ error }}
					</div>

					<template v-else-if="data">
						<p class="text-sm text-gray-600 dark:text-gray-300">
							<template v-if="activity">
								Hỏi trong <strong class="text-gray-900 dark:text-gray-100">{{ activity.activeDays }}</strong>
								ngày, từ {{ formatDate(activity.firstDay, 'dd/MM') }} đến
								{{ formatDate(activity.lastDay, 'dd/MM') }}.
								<template v-if="topTopic">
									Chủ đề hỏi nhiều nhất:
									<strong class="text-gray-900 dark:text-gray-100">{{ topTopicLabel }}</strong>
									({{ topTopic.runs }} lượt).
								</template>
							</template>
							<template v-else>Không có lượt nào trong khoảng này.</template>
						</p>

						<section class="grid grid-cols-2 gap-3 lg:grid-cols-4">
							<AgentStatCard
								label="Lượt hỏi"
								:value="nf.format(data.summary.requests)"
								:hint="`${data.summary.conversations} hội thoại`"
							/>
							<AgentStatCard
								label="Tổng token"
								:value="fmtTok(data.summary.totalTokens)"
								:hint="`vào ${fmtTok(data.summary.promptTokens)} · ra ${fmtTok(data.summary.completionTokens)}`"
							/>
							<AgentStatCard
								label="Chi phí"
								:value="fmtUsd(data.summary.costUsd)"
								:hint="`${fmtUsd(data.summary.costPerRequestUsd)}/lượt`"
							/>
							<AgentStatCard
								label="Cache provider"
								:value="`${data.summary.cacheHitRate}%`"
								hint="token nạp lại từ cache"
								:tone="data.summary.cacheHitRate > 30 ? 'good' : 'default'"
							/>
						</section>

						<AgentDailyChart :daily="data.daily" :from="from" :to="to" />

						<AgentTopicTable
							:topics="data.topics"
							description="Những việc người này nhờ trợ lý làm, xếp theo số lượt."
						/>

						<section
							v-if="canReview"
							data-testid="agent-conversation-list"
							class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
						>
							<header class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
								<!-- `basis-64`: màn hẹp thì công tắc xuống dòng, chữ không bị ép thành một cột -->
								<div class="min-w-0 grow basis-64">
									<h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100">Hội thoại</h3>
									<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
										<template v-if="conversationsMeta">{{ conversationsMeta.total }} hội thoại có tin nhắn trong khoảng đang lọc.</template>
										Bấm vào một dòng để đọc, mỗi lần mở đều được ghi vào nhật ký hệ thống.
									</p>
								</div>
								<label class="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300">
									Chỉ hội thoại có vấn đề
									<button
										type="button"
										role="switch"
										:aria-checked="onlyIssues"
										aria-label="Chỉ hội thoại có vấn đề"
										:class="[
											'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
											onlyIssues ? 'bg-brand-600' : 'bg-gray-200 dark:bg-gray-600',
										]"
										@click="toggleOnlyIssues"
									>
										<span
											:class="[
												'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200',
												onlyIssues ? 'translate-x-5' : 'translate-x-0',
											]"
										/>
									</button>
								</label>
							</header>

							<div
								v-if="conversationsError"
								class="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
							>
								{{ conversationsError }}
							</div>

							<p
								v-else-if="conversationsLoading && !conversations.length"
								class="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400"
							>
								Đang tải…
							</p>

							<p
								v-else-if="!conversations.length"
								class="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400"
							>
								{{ onlyIssues ? 'Không có hội thoại nào có vấn đề trong khoảng này.' : 'Không có hội thoại nào trong khoảng này.' }}
							</p>

							<template v-else>
								<ul :class="['divide-y divide-gray-100 transition-opacity dark:divide-gray-700', conversationsLoading ? 'opacity-50' : '']">
									<li v-for="c in conversations" :key="c.id">
										<button
											type="button"
											data-testid="agent-conversation-row"
											class="flex w-full flex-col gap-1.5 px-4 py-2.5 text-left transition hover:bg-gray-50 focus:bg-gray-50 focus:outline-none dark:hover:bg-gray-700/40 dark:focus:bg-gray-700/40"
											@click="emit('open-conversation', c.id)"
										>
											<span class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
												<span class="min-w-0 break-words text-sm font-medium text-gray-800 dark:text-gray-100">
													{{ c.title || 'Hội thoại chưa có tiêu đề' }}
												</span>
												<span class="shrink-0 text-xs tabular-nums text-gray-400 dark:text-gray-500">
													{{ c.messageCount }} tin nhắn · {{ formatDateTime(c.lastMessageAt ?? c.createdAt) }}
												</span>
											</span>
											<span v-if="issueBadges(c).length" class="flex flex-wrap items-center gap-1.5">
												<span
													v-for="b in issueBadges(c)"
													:key="b.key"
													:data-badge="b.key"
													:title="b.title"
													class="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300"
												>
													<span :class="['h-1.5 w-1.5 rounded-full', b.dot]" />
													{{ b.label }}
													<span class="tabular-nums">{{ b.count }}</span>
												</span>
											</span>
										</button>
									</li>
								</ul>

								<div
									v-if="conversationsMeta && conversationsMeta.totalPages > 1"
									class="flex justify-end border-t border-gray-200 px-4 py-2 dark:border-gray-700"
								>
									<CommonAppPagination
										:current-page="conversationsPage"
										:total-pages="conversationsMeta.totalPages"
										@update:current-page="goToConversationsPage"
									/>
								</div>
							</template>
						</section>
					</template>
				</div>
			</div>
		</div>
	</Teleport>
</template>
