<script setup lang="ts">
	import { formatScore, SCORECARD_STATUS_CLASS, VERDICT_CLASS } from '~/utils/recruitment.utils';
	import { VERDICT_LABELS } from '~/types/recruitment.types';
	import { formatDateTime } from '~/utils/date';
	import type { RecruitmentScorecard, RecruitmentStageScorecards } from '~/types/recruitment-me.types';

	/**
	 * Phiếu đánh giá theo vòng, phía người ngồi hội đồng.
	 *
	 * Hai chỗ dễ hiểu sai của BR-08, nên nói thẳng trên giao diện thay vì để trống:
	 * - `hiddenCount > 0` nghĩa là còn phiếu của người khác bị ẩn cho đến khi mình nộp phiếu của
	 *   mình. Không hiện gì thì người dùng tưởng đồng nghiệp chưa chấm.
	 * - `score` và `verdicts` là `null` khi chưa được xem, KHÔNG phải "chưa ai chấm", nên hiện
	 *   dấu gạch kèm lời giải thích chứ không hiện 0.
	 */
	const props = defineProps<{
		stages: RecruitmentStageScorecards[];
		/** Id người đang đăng nhập, để tách phiếu của mình khỏi phiếu đồng nghiệp. */
		myEmployeeId: number | null;
		/** Cho bấm mở form chấm. Trang chi tiết hồ sơ bật, trang chỉ xem thì tắt. */
		scorable?: boolean;
	}>();

	const emit = defineEmits<{ open: [scorecard: RecruitmentScorecard] }>();

	function isMine(card: RecruitmentScorecard): boolean {
		return props.myEmployeeId != null && card.evaluator.id === props.myEmployeeId;
	}
</script>

<template>
	<div class="space-y-4">
		<p v-if="!stages.length" class="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
			Vòng nào cũng chưa có phiếu đánh giá.
		</p>

		<section
			v-for="stage in stages"
			:key="stage.stageId"
			class="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
		>
			<header class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
				<h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ stage.stageName }}</h3>
				<div class="flex items-center gap-3 text-xs">
					<span class="text-gray-500 dark:text-gray-400">
						Điểm vòng
						<span class="ml-0.5 font-semibold text-gray-900 dark:text-white">{{ formatScore(stage.score) }}</span>
					</span>
					<span v-if="stage.verdicts" class="flex gap-1.5">
						<span class="rounded-full bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
							{{ VERDICT_LABELS.PASS }} {{ stage.verdicts.PASS }}
						</span>
						<span class="rounded-full bg-amber-100 px-1.5 py-0.5 font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
							{{ VERDICT_LABELS.CONSIDER }} {{ stage.verdicts.CONSIDER }}
						</span>
						<span class="rounded-full bg-rose-100 px-1.5 py-0.5 font-medium text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
							{{ VERDICT_LABELS.FAIL }} {{ stage.verdicts.FAIL }}
						</span>
					</span>
				</div>
			</header>

			<ul class="divide-y divide-gray-100 dark:divide-gray-800">
				<li v-for="card in stage.scorecards" :key="card.id" class="px-4 py-3">
					<div class="flex flex-wrap items-start justify-between gap-2">
						<div class="min-w-0">
							<p class="text-sm font-medium text-gray-900 dark:text-white">
								{{ card.evaluator.fullName }}
								<span v-if="isMine(card)" class="ml-1 text-xs font-normal text-brand-600 dark:text-brand-400">
									(phiếu của bạn)
								</span>
							</p>
							<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
								{{ card.template.name }} · {{ card.kindLabel }}
								<span v-if="card.submittedAt"> · nộp {{ formatDateTime(card.submittedAt) }}</span>
							</p>
						</div>
						<div class="flex flex-shrink-0 items-center gap-2">
							<span
								v-if="card.verdictLabel"
								class="rounded-full px-2 py-0.5 text-xs font-medium"
								:class="card.verdict ? VERDICT_CLASS[card.verdict] : ''"
							>
								{{ card.verdictLabel }}
							</span>
							<span
								class="rounded-full px-2 py-0.5 text-xs font-medium"
								:class="SCORECARD_STATUS_CLASS[card.status]"
							>
								{{ card.statusLabel }}
							</span>
							<span class="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
								{{ formatScore(card.totalScore) }}
							</span>
						</div>
					</div>

					<p v-if="card.comment" class="mt-2 whitespace-pre-line text-sm text-gray-600 dark:text-gray-300">
						{{ card.comment }}
					</p>

					<CommonAppButton
						v-if="scorable && isMine(card)"
						class="mt-2"
						size="sm"
						variant="outline"
						@click="emit('open', card)"
					>
						{{ card.status === 'SUBMITTED' ? 'Xem và sửa phiếu của bạn' : 'Chấm phiếu' }}
					</CommonAppButton>
				</li>
			</ul>

			<p
				v-if="stage.hiddenCount > 0"
				class="border-t border-gray-100 px-4 py-3 text-sm text-amber-700 dark:border-gray-800 dark:text-amber-400"
			>
				Còn {{ stage.hiddenCount }} phiếu của người khác đang ẩn. Nộp phiếu của bạn ở vòng này thì sẽ xem được.
			</p>
		</section>
	</div>
</template>
