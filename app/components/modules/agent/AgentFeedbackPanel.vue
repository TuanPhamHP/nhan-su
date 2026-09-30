<script setup lang="ts">
	import {
		PLAYBOOK_LABELS,
		RATING_COLORS,
		TIER_LABELS,
		type AgentFeedbackAnalytics,
		type AgentFeedbackGroup,
	} from '~/types/agent-analytics.types';
	import { formatDateTime } from '~/utils/date';

	const props = defineProps<{ data: AgentFeedbackAnalytics }>();

	/** Thứ tự cố định tệ → tốt, để dải phân bố không nhảy chỗ giữa các lần tải. */
	const RATING_ORDER = ['BAD', 'AVERAGE', 'USEFUL', 'GREAT'] as const;

	// `KHÔNG_RÕ` là rổ gom của backend cho lượt không tra được playbook lúc chấm — nó là
	// MÃ, không phải chữ để đọc, nên đổi sang nhãn thường như mọi mã khác.
	const label = (id: string | null) =>
		!id || id === 'KHÔNG_RÕ' ? 'Không rõ' : (PLAYBOOK_LABELS[id] ?? id);

	/**
	 * Nhãn mức đánh giá lấy từ response, KHÔNG khai ở FE.
	 *
	 * Nguồn duy nhất là `vi-labels.ts` của backend; giữ bản sao ở đây thì sửa chữ bên kia
	 * xong web vẫn hiện chữ cũ. Thiếu nhãn thì hiện mã gốc — xấu nhưng vẫn là thông tin.
	 */
	const ratingLabel = (r: string) => props.data.ratingLabels?.[r] ?? r;

	/** Nhóm có quá ít lượt chấm thì tỷ lệ % không nói được gì — đánh dấu để khỏi kết luận sớm. */
	const THIN_SAMPLE = 5;
	const isThin = (g: AgentFeedbackGroup) => g.total < THIN_SAMPLE;

	const share = (n: number) =>
		props.data.summary.total === 0 ? 0 : (n / props.data.summary.total) * 100;
</script>

<template>
	<!-- `data-testid` là điểm neo cho tests/e2e/agent-feedback-shots.mjs — đừng đổi tên -->
	<div
		data-testid="agent-feedback-panel"
		class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
	>
		<div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
			<h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100">
				Người dùng chấm điểm câu trả lời
			</h3>
			<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
				Trợ lý chỉ hỏi ý kiến thi thoảng, nên
				<span class="font-medium">{{ data.summary.responseRate }}%</span> câu trả lời được chấm là
				bình thường. Điểm trung bình {{ data.summary.score }}/4 trên
				{{ data.summary.total }} lượt.
			</p>
		</div>

		<div
			v-if="!data.summary.total"
			class="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400"
		>
			Chưa có ai chấm điểm trong khoảng thời gian này.
		</div>

		<template v-else>
			<!-- Dải phân bố: đọc một cái là thấy tỷ lệ tệ / hay -->
			<div class="px-4 py-3">
				<div class="flex h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
					<div
						v-for="r in RATING_ORDER"
						:key="r"
						:class="RATING_COLORS[r]"
						:style="{ width: `${share(data.summary.byRating[r] ?? 0)}%` }"
					/>
				</div>
				<div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
					<span
						v-for="r in RATING_ORDER"
						:key="r"
						class="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300"
					>
						<span :class="['h-2 w-2 rounded-full', RATING_COLORS[r]]" />
						{{ ratingLabel(r) }}
						<span class="tabular-nums text-gray-400">{{ data.summary.byRating[r] ?? 0 }}</span>
					</span>
					<span class="text-xs text-gray-400 dark:text-gray-500">
						· {{ data.summary.withComment }} lượt có góp ý chữ
					</span>
				</div>
			</div>

			<table class="w-full border-t border-gray-200 text-sm dark:border-gray-700">
				<thead class="bg-gray-50 text-xs text-gray-500 dark:bg-gray-900/40 dark:text-gray-400">
					<tr>
						<th class="px-4 py-2 text-left font-medium">Chủ đề</th>
						<th class="px-3 py-2 text-right font-medium">Lượt chấm</th>
						<th class="px-3 py-2 text-right font-medium">Hài lòng</th>
						<th class="px-4 py-2 text-right font-medium">Điểm</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100 dark:divide-gray-700">
					<tr
						v-for="g in data.byPlaybook"
						:key="g.bucket"
						class="hover:bg-gray-50 dark:hover:bg-gray-700/40"
					>
						<td class="px-4 py-2.5">
							<span class="font-medium text-gray-800 dark:text-gray-100">
								{{ label(g.bucket) }}
							</span>
							<span
								v-if="isThin(g)"
								class="ml-1.5 text-xs text-gray-400 dark:text-gray-500"
								title="Quá ít lượt chấm để kết luận"
							>
								ít mẫu
							</span>
						</td>
						<td class="px-3 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-200">
							{{ g.total }}
						</td>
						<td
							:class="[
								'px-3 py-2.5 text-right tabular-nums',
								isThin(g)
									? 'text-gray-400 dark:text-gray-500'
									: g.satisfactionRate >= 70
										? 'text-emerald-600 dark:text-emerald-400'
										: 'text-amber-600 dark:text-amber-400',
							]"
						>
							{{ g.satisfactionRate }}%
						</td>
						<td class="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-200">
							{{ g.score }}/4
						</td>
					</tr>
				</tbody>
			</table>

			<!--
				Góp ý chữ. Backend KHÔNG trả câu hỏi/câu trả lời của lượt đó — hội thoại chỉ
				chủ hội thoại đọc được, nên đừng chờ có nội dung chat ở đây.
			-->
			<div v-if="data.comments.length" class="border-t border-gray-200 dark:border-gray-700">
				<h4 class="px-4 pt-3 text-xs font-semibold text-gray-600 dark:text-gray-300">
					Góp ý mới nhất
				</h4>
				<ul class="divide-y divide-gray-100 px-4 dark:divide-gray-700">
					<li v-for="c in data.comments" :key="c.id" class="py-2.5">
						<div class="flex flex-wrap items-center gap-2 text-xs">
							<span
								class="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300"
							>
								<span :class="['h-1.5 w-1.5 rounded-full', RATING_COLORS[c.rating] ?? 'bg-gray-400']" />
								{{ c.ratingLabel }}
							</span>
							<span class="text-gray-700 dark:text-gray-200">{{ c.fullName }}</span>
							<span class="text-gray-400 dark:text-gray-500">
								{{ label(c.playbookId) }}
								<template v-if="c.routerTier">
									· {{ TIER_LABELS[c.routerTier] ?? c.routerTier }}
								</template>
								· {{ formatDateTime(c.createdAt) }}
							</span>
						</div>
						<p class="mt-1 text-sm text-gray-700 dark:text-gray-200">{{ c.comment }}</p>
					</li>
				</ul>
			</div>
		</template>
	</div>
</template>
