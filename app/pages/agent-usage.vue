<script setup lang="ts">
	import AgentStatCard from '~/components/modules/agent/AgentStatCard.vue';
	import AgentTopicTable from '~/components/modules/agent/AgentTopicTable.vue';
	import AgentDailyChart from '~/components/modules/agent/AgentDailyChart.vue';
	import { useAuth } from '~/composables/useAuth';

	definePageMeta({ title: 'Trợ lý AI — Mức dùng' });

	const { user } = useAuth();
	// ADMIN/HR/DIRECTOR xem toàn hệ thống; còn lại chỉ xem được của chính mình
	const canSeeAll = computed(() => ['ADMIN', 'HR', 'DIRECTOR'].includes(user.value?.role ?? ''));
	const scope = computed<'all' | 'me'>(() => (canSeeAll.value ? 'all' : 'me'));

	const { data, loading, error, from, to, load, setRange } = useAgentAnalytics(scope.value);

	onMounted(load);

	const RANGES = [
		{ label: '7 ngày', days: 7 },
		{ label: '30 ngày', days: 30 },
		{ label: '90 ngày', days: 90 },
	];

	const nf = new Intl.NumberFormat('vi-VN');
	const fmtTok = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : nf.format(n));
	const fmtUsd = (n: number) => '$' + n.toFixed(n < 1 ? 4 : 2);

	/** Ước tính chi phí tháng theo nhịp dùng hiện tại — con số người duyệt ngân sách cần. */
	const monthlyProjection = computed(() => {
		const s = data.value?.summary;
		if (!s) return 0;
		const days = Math.max(1, (new Date(s.to).getTime() - new Date(s.from).getTime()) / 86400000);
		return (s.costUsd / days) * 30;
	});
</script>

<template>
	<div class="space-y-5 p-1">
		<header class="flex flex-wrap items-end justify-between gap-3">
			<div>
				<h1 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
					Trợ lý AI — Mức dùng & Chủ đề
				</h1>
				<p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
					{{ canSeeAll ? 'Toàn hệ thống' : 'Dữ liệu của bạn' }}
					<span v-if="data"> · {{ data.summary.from }} → {{ data.summary.to }}</span>
				</p>
			</div>

			<div class="flex flex-wrap items-center gap-2">
				<button
					v-for="r in RANGES"
					:key="r.days"
					type="button"
					class="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 transition hover:border-brand-500 hover:text-brand-600 dark:border-gray-600 dark:text-gray-300"
					@click="setRange(r.days)"
				>
					{{ r.label }}
				</button>
				<input
					v-model="from"
					type="date"
					class="rounded-lg border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
				/>
				<span class="text-xs text-gray-400">→</span>
				<input
					v-model="to"
					type="date"
					class="rounded-lg border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
				/>
				<CommonAppButton size="sm" :loading="loading" @click="load">Áp dụng</CommonAppButton>
			</div>
		</header>

		<div
			v-if="error"
			class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
		>
			{{ error }}
		</div>

		<div v-else-if="loading && !data" class="py-16 text-center text-sm text-gray-500">Đang tải…</div>

		<template v-else-if="data">
			<section class="grid grid-cols-2 gap-3 lg:grid-cols-6">
				<AgentStatCard label="Lượt hỏi" :value="nf.format(data.summary.requests)" :hint="`${data.summary.conversations} hội thoại`" />
				<AgentStatCard v-if="canSeeAll" label="Người dùng" :value="nf.format(data.summary.activeUsers)" hint="có phát sinh token" />
				<AgentStatCard label="Tổng token" :value="fmtTok(data.summary.totalTokens)" :hint="`vào ${fmtTok(data.summary.promptTokens)} · ra ${fmtTok(data.summary.completionTokens)}`" />
				<AgentStatCard
					label="Cache provider"
					:value="`${data.summary.cacheHitRate}%`"
					hint="token nạp lại từ cache"
					:tone="data.summary.cacheHitRate > 30 ? 'good' : 'default'"
				/>
				<AgentStatCard label="Chi phí" :value="fmtUsd(data.summary.costUsd)" :hint="`${fmtUsd(data.summary.costPerRequestUsd)}/lượt`" />
				<AgentStatCard label="Ước tính / tháng" :value="fmtUsd(monthlyProjection)" hint="theo nhịp dùng hiện tại" />
			</section>

			<AgentDailyChart :daily="data.daily" />

			<AgentTopicTable :topics="data.topics" />

			<section class="grid gap-4 lg:grid-cols-2">
				<div
					v-if="canSeeAll"
					class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
				>
					<h3 class="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-800 dark:border-gray-700 dark:text-gray-100">
						Người dùng nhiều nhất
					</h3>
					<table class="w-full text-sm">
						<tbody class="divide-y divide-gray-100 dark:divide-gray-700">
							<tr v-for="u in data.topUsers" :key="u.employeeId">
								<td class="px-4 py-2.5 text-gray-800 dark:text-gray-100">{{ u.fullName }}</td>
								<td class="px-3 py-2.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{{ u.requests }} lượt</td>
								<td class="px-3 py-2.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{{ fmtTok(u.totalTokens) }}</td>
								<td class="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-200">{{ fmtUsd(u.costUsd) }}</td>
							</tr>
							<tr v-if="!data.topUsers.length">
								<td colspan="4" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">Chưa có dữ liệu.</td>
							</tr>
						</tbody>
					</table>
				</div>

				<div class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
					<h3 class="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-800 dark:border-gray-700 dark:text-gray-100">
						Phân bổ theo model &amp; mục đích
					</h3>
					<table class="w-full text-sm">
						<tbody class="divide-y divide-gray-100 dark:divide-gray-700">
							<tr v-for="m in data.byModel" :key="'m-' + m.bucket">
								<td class="px-4 py-2.5 font-mono text-xs text-gray-800 dark:text-gray-100">{{ m.bucket }}</td>
								<td class="px-3 py-2.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{{ m.requests }} lượt</td>
								<td class="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-200">{{ fmtUsd(m.costUsd) }}</td>
							</tr>
							<tr v-for="p in data.byPurpose" :key="'p-' + p.bucket" class="bg-gray-50/50 dark:bg-gray-900/20">
								<td class="px-4 py-2.5 text-xs text-gray-600 dark:text-gray-300">{{ p.bucket }}</td>
								<td class="px-3 py-2.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{{ p.requests }} lượt</td>
								<td class="px-4 py-2.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{{ fmtUsd(p.costUsd) }}</td>
							</tr>
						</tbody>
					</table>
				</div>
			</section>
		</template>
	</div>
</template>
