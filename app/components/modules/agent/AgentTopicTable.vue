<script setup lang="ts">
	import {
		PLAYBOOK_LABELS,
		TIER_COLORS,
		TIER_LABELS,
		type AgentTopic,
	} from '~/types/agent-analytics.types';

	defineProps<{ topics: AgentTopic[] }>();

	const label = (id: string) => PLAYBOOK_LABELS[id] ?? id;
</script>

<template>
	<div class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
		<div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
			<h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100">Chủ đề được hỏi</h3>
			<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
				Tier nào quyết định định tuyến — càng nhiều “Luật” càng rẻ và nhanh, nhiều “Không rõ”
				là dấu hiệu playbook chưa phủ hết câu hỏi thật.
			</p>
		</div>

		<div v-if="!topics.length" class="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
			Chưa có dữ liệu trong khoảng thời gian này.
		</div>

		<table v-else class="w-full text-sm">
			<thead class="bg-gray-50 text-xs text-gray-500 dark:bg-gray-900/40 dark:text-gray-400">
				<tr>
					<th class="px-4 py-2 text-left font-medium">Chủ đề</th>
					<th class="px-3 py-2 text-right font-medium">Lượt</th>
					<th class="px-3 py-2 text-left font-medium">Tỷ lệ</th>
					<th class="px-3 py-2 text-right font-medium">Thành công</th>
					<th class="px-4 py-2 text-left font-medium">Router tier</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-gray-100 dark:divide-gray-700">
				<tr v-for="t in topics" :key="t.playbookId" class="hover:bg-gray-50 dark:hover:bg-gray-700/40">
					<td class="px-4 py-2.5">
						<span class="font-medium text-gray-800 dark:text-gray-100">{{ label(t.playbookId) }}</span>
						<span class="ml-1.5 text-xs text-gray-400 dark:text-gray-500">{{ t.playbookId }}</span>
					</td>
					<td class="px-3 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-200">
						{{ t.runs }}
					</td>
					<td class="px-3 py-2.5">
						<div class="flex items-center gap-2">
							<div class="h-1.5 w-20 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
								<div class="h-full rounded-full bg-brand-500" :style="{ width: `${t.share}%` }" />
							</div>
							<span class="tabular-nums text-xs text-gray-500 dark:text-gray-400">{{ t.share }}%</span>
						</div>
					</td>
					<td
						:class="[
							'px-3 py-2.5 text-right tabular-nums',
							t.successRate >= 95
								? 'text-emerald-600 dark:text-emerald-400'
								: 'text-amber-600 dark:text-amber-400',
						]"
					>
						{{ t.successRate }}%
					</td>
					<td class="px-4 py-2.5">
						<div class="flex flex-wrap items-center gap-1.5">
							<span
								v-for="(n, tier) in t.byTier"
								v-show="n > 0"
								:key="tier"
								class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300"
							>
								<span :class="['h-1.5 w-1.5 rounded-full', TIER_COLORS[tier] ?? 'bg-gray-400']" />
								{{ TIER_LABELS[tier] ?? tier }} {{ n }}
							</span>
						</div>
					</td>
				</tr>
			</tbody>
		</table>
	</div>
</template>
