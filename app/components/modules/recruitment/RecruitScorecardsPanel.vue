<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import RecruitChip from '~/components/modules/recruitment/RecruitChip.vue';
	import {
		formatScore,
		recruitErrorMessage,
		SCORECARD_STATUS_CLASS,
		VERDICT_CLASS,
	} from '~/utils/recruitment.utils';
	import { formatDateTime } from '~/utils/date';
	import type { RecruitmentStageScorecards } from '~/types/recruitment.types';

	/**
	 * Phiếu đánh giá của một hồ sơ, nhóm theo vòng.
	 *
	 * BE ẩn phiếu của người khác theo BR-08: ai chưa nộp phiếu của mình ở một vòng thì chỉ
	 * thấy phiếu của chính mình, `hiddenCount` là số phiếu đang ẩn và điểm vòng là `null`.
	 * Vì vậy `score: null` ở đây có HAI nghĩa — chưa ai chấm, hoặc bạn chưa được xem — và
	 * `hiddenCount` là thứ phân biệt hai nghĩa đó.
	 *
	 * Panel chỉ HIỆN phiếu. Form chấm điểm nằm ở trang "Phỏng vấn của tôi", vì route lưu và
	 * nộp phiếu là `/v1/me/recruitment/scorecards/:id`, dành cho chủ phiếu ở mọi vai trò.
	 */
	const props = defineProps<{ applicationId: number }>();

	const service = useRecruitmentService();
	const { user } = useAuth();

	const groups = ref<RecruitmentStageScorecards[]>([]);
	const loading = ref(true);
	const error = ref<string | null>(null);

	async function load() {
		loading.value = true;
		error.value = null;
		try {
			groups.value = await service.applicationScorecards(props.applicationId);
		} catch (e) {
			groups.value = [];
			error.value = recruitErrorMessage(e, 'Không tải được phiếu đánh giá');
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);
	watch(() => props.applicationId, load);

	defineExpose({ reload: load });

	/**
	 * Phiếu của chính người đang xem thì còn sửa được, kể cả người đó là nhân sự.
	 *
	 * Form chấm điểm nằm ở trang "Phỏng vấn của tôi" vì route lưu và nộp phiếu là
	 * `/v1/me/recruitment/scorecards/:id`, mở cho CHỦ PHIẾU ở mọi vai trò. Trang đó nhận
	 * `?scorecard=<id>` để mở thẳng đúng phiếu, nên ở đây chỉ cần dẫn sang.
	 */
	function isMine(evaluatorId: number): boolean {
		return user.value?.id === evaluatorId;
	}

	/** Sau lần nộp đầu, chủ phiếu còn sửa trong 24 giờ; quá hạn thì phiếu khoá hẳn. */
	function stillEditable(editableUntil: string | null): boolean {
		if (!editableUntil) return true;
		return new Date(editableUntil).getTime() > Date.now();
	}
</script>

<template>
	<div class="space-y-4">
		<div v-if="loading" class="space-y-2">
			<div v-for="i in 2" :key="i" class="h-20 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
		</div>

		<p v-else-if="error" class="text-sm text-rose-600 dark:text-rose-400">{{ error }}</p>

		<p v-else-if="!groups.length" class="text-sm text-gray-500 dark:text-gray-400">
			Hồ sơ này chưa có phiếu đánh giá nào. Đặt lịch phỏng vấn hoặc nhờ một người đánh giá để tạo phiếu.
		</p>

		<div
			v-for="group in groups"
			v-else
			:key="group.stageId"
			class="rounded-xl border border-gray-200 p-4 dark:border-gray-700"
		>
			<div class="flex flex-wrap items-center justify-between gap-2">
				<h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ group.stageName }}</h3>
				<div class="flex items-center gap-2 text-xs">
					<span v-if="group.score != null" class="font-semibold text-gray-900 dark:text-white">
						Điểm vòng {{ formatScore(group.score) }}
					</span>
					<template v-if="group.verdicts">
						<RecruitChip
							v-if="group.verdicts.PASS"
							:label="`Đạt ${group.verdicts.PASS}`"
							:tone="VERDICT_CLASS.PASS"
						/>
						<RecruitChip
							v-if="group.verdicts.CONSIDER"
							:label="`Cân nhắc ${group.verdicts.CONSIDER}`"
							:tone="VERDICT_CLASS.CONSIDER"
						/>
						<RecruitChip
							v-if="group.verdicts.FAIL"
							:label="`Không đạt ${group.verdicts.FAIL}`"
							:tone="VERDICT_CLASS.FAIL"
						/>
					</template>
				</div>
			</div>

			<p
				v-if="group.hiddenCount > 0"
				class="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-gray-800/60 dark:text-gray-300"
			>
				Còn {{ group.hiddenCount }} phiếu của người khác đang ẩn. Nộp phiếu của bạn ở vòng này thì sẽ
				xem được, để đánh giá của mọi người không ảnh hưởng lẫn nhau.
			</p>

			<ul class="mt-3 space-y-3">
				<li
					v-for="card in group.scorecards"
					:key="card.id"
					class="rounded-lg border border-gray-100 px-3 py-2.5 dark:border-gray-800"
				>
					<div class="flex flex-wrap items-center justify-between gap-2">
						<div class="min-w-0">
							<p class="text-sm font-medium text-gray-900 dark:text-white">
								{{ card.evaluator.fullName }}
							</p>
							<p class="text-xs text-gray-500 dark:text-gray-400">
								{{ card.kindLabel }} · mẫu {{ card.template.name }}
								<template v-if="card.interview">
									· buổi {{ formatDateTime(card.interview.startAt) }}
								</template>
								<template v-else-if="card.requestedById"> · do nhân sự yêu cầu</template>
							</p>
						</div>
						<div class="flex items-center gap-2">
							<RecruitChip
								v-if="card.verdictLabel"
								:label="card.verdictLabel"
								:tone="card.verdict ? VERDICT_CLASS[card.verdict] : ''"
							/>
							<RecruitChip :label="card.statusLabel" :tone="SCORECARD_STATUS_CLASS[card.status]" />
						</div>
					</div>

					<template v-if="card.status === 'SUBMITTED'">
						<div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
							<span
								v-for="c in card.criteria"
								:key="c.id"
								class="text-gray-600 dark:text-gray-300"
							>
								{{ c.name }}
								<strong class="tabular-nums">{{ c.score ?? '—' }}</strong>
								<span v-if="c.maxScore != null" class="text-gray-400">/{{ c.maxScore }}</span>
								<span v-else-if="c.weight > 1" class="text-gray-400">(hệ số {{ c.weight }})</span>
							</span>
							<span v-if="card.totalScore != null" class="font-semibold text-gray-900 dark:text-white">
								Tổng {{ formatScore(card.totalScore) }}
							</span>
						</div>
						<p
							v-if="card.comment"
							class="mt-2 whitespace-pre-line rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:bg-gray-800/60 dark:text-gray-300"
						>
							{{ card.comment }}
						</p>
						<p v-if="card.submittedAt" class="mt-1 text-xs text-gray-400">
							Nộp lúc {{ formatDateTime(card.submittedAt) }}
						</p>
					</template>

					<p v-else class="mt-2 text-xs text-gray-500 dark:text-gray-400">
						Chưa nộp, nên điểm và nhận xét còn đang ẩn.
					</p>

					<NuxtLink
						v-if="isMine(card.evaluator.id) && stillEditable(card.editableUntil)"
						:to="`/recruitment/my-interviews?scorecard=${card.id}`"
						class="mt-2 inline-block text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
					>
						{{ card.status === 'SUBMITTED' ? 'Sửa phiếu của bạn' : 'Chấm phiếu của bạn' }}
					</NuxtLink>
				</li>
			</ul>
		</div>
	</div>
</template>
