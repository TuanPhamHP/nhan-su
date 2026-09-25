<script setup lang="ts">
	import type { AgentUsagePoint } from '~/types/agent-analytics.types';

	const props = defineProps<{ daily: AgentUsagePoint[] }>();

	// Biểu đồ cột bằng div thuần — không kéo thêm thư viện chart cho một view duy nhất
	const max = computed(() =>
		Math.max(1, ...props.daily.map((d) => d.promptTokens + d.completionTokens)),
	);
	const fmtDay = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7);
	const fmtNum = (n: number) => new Intl.NumberFormat('vi-VN').format(n);
</script>

<template>
	<div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
		<h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100">Token theo ngày</h3>
		<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
			Cột dưới là token đầu vào, cột trên là đầu ra.
		</p>

		<div v-if="!daily.length" class="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
			Chưa có dữ liệu.
		</div>

		<div v-else class="mt-4 flex h-44 items-end gap-1 overflow-x-auto">
			<div
				v-for="d in daily"
				:key="d.bucket"
				class="group flex min-w-[18px] flex-1 flex-col items-center gap-1"
				:title="`${d.bucket} — ${fmtNum(d.promptTokens + d.completionTokens)} token, ${d.requests} lượt, $${d.costUsd.toFixed(5)}`"
			>
				<div class="flex w-full flex-col justify-end" :style="{ height: '9rem' }">
					<div
						class="w-full rounded-t bg-brand-400 transition group-hover:bg-brand-500"
						:style="{ height: `${(d.completionTokens / max) * 100}%` }"
					/>
					<div
						class="w-full bg-brand-600 transition group-hover:bg-brand-700 dark:bg-brand-500"
						:style="{ height: `${(d.promptTokens / max) * 100}%` }"
					/>
				</div>
				<span class="text-[10px] text-gray-400 dark:text-gray-500">{{ fmtDay(d.bucket) }}</span>
			</div>
		</div>
	</div>
</template>
