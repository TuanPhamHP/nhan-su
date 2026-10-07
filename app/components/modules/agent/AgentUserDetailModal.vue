<script setup lang="ts">
	import AgentDailyChart from '~/components/modules/agent/AgentDailyChart.vue';
	import AgentTopicTable from '~/components/modules/agent/AgentTopicTable.vue';
	import AgentStatCard from '~/components/modules/agent/AgentStatCard.vue';
	import {
		PLAYBOOK_LABELS,
		type AgentAnalyticsOverview,
		type AgentTopUser,
	} from '~/types/agent-analytics.types';
	import { formatDate } from '~/utils/date';

	const props = defineProps<{
		user: AgentTopUser;
		from: string;
		to: string;
		/** Hàm tải do page truyền xuống — component không tự gọi service. */
		fetch: (employeeId: number) => Promise<AgentAnalyticsOverview>;
	}>();

	const emit = defineEmits<{ close: [] }>();

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

	onMounted(load);
	// Đổi người mà không đóng modal thì phải tải lại — props.user là nguồn duy nhất
	watch(() => props.user.employeeId, load);
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
					</template>
				</div>
			</div>
		</div>
	</Teleport>
</template>
