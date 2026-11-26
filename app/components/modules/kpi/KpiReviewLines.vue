<script setup lang="ts">
	import type { KpiReviewDetail, KpiReviewLine } from '~/types/kpi.types';
	import { KPI_HINTS, kpiNum, kpiPct, kpiTargetText, kpiValueText, kpiWeightShiftText } from '~/utils/kpi.utils';

	/**
	 * Bảng chỉ tiêu của phiếu (mục 9.2 "Phiếu KPI"): Chỉ tiêu, Mức giao, Kết quả, Tỷ lệ, Trọng số, Điểm, dòng cuối
	 * Tổng điểm và Xếp loại. Màn rộng là bảng, màn hẹp mỗi dòng thành một thẻ có nhãn từng ô (cùng một khung).
	 *
	 * - Số tự động gạch chân, bấm mở bằng chứng (`hasEvidence`).
	 * - Số đã chỉnh: số gốc gạch ngang, số mới, lý do.
	 * - Dòng không áp dụng ghi "Không áp dụng", trọng số hiệu lực của dòng còn lại hiện cạnh trọng số gốc.
	 * - `canScore`: chấm 1–5 bằng năm nút, đạt hay không bằng hai nút, số nhập tay bằng hộp; số tự động có nút
	 *   Chỉnh; dòng nào cũng ghi chú được. Chỉ tiêu nhập tay chưa chấm có viền nhắc, dòng máy chủ báo thiếu
	 *   (`missing`) viền đỏ.
	 */
	const props = defineProps<{
		review: KpiReviewDetail;
		/** `permissions.canScore` đã xét chế độ chỉ xem. */
		canScore: boolean;
		/** Id dòng đang gửi lên máy chủ, để khoá nút của dòng đó. */
		busyLineId: number | null;
		/** Tên chỉ tiêu máy chủ báo chưa chấm (`KPI_MANUAL_SCORE_MISSING`). */
		missing: string[];
		provisional: boolean;
	}>();
	const emit = defineEmits<{
		evidence: [line: KpiReviewLine];
		score: [line: KpiReviewLine, value: number | null];
		edit: [line: KpiReviewLine, mode: 'adjust' | 'value' | 'note'];
	}>();

	const weightShifted = computed(() => props.review.lines.some(l => l.effectiveWeight !== l.weight));

	function unscored(l: KpiReviewLine): boolean {
		return l.source === 'MANUAL' && l.applicable && l.value == null;
	}
	function flagged(l: KpiReviewLine): boolean {
		return props.missing.includes(l.name);
	}
	const CELL_LABEL = 'text-[11px] font-medium text-gray-500 sm:hidden';
</script>

<template>
	<div class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900" data-testid="kpi-lines">
		<!-- Đầu bảng, chỉ màn rộng -->
		<div
			class="hidden gap-3 bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500 sm:grid sm:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,0.7fr)] dark:bg-gray-800/60 dark:text-gray-400"
			role="row"
		>
			<span>Chỉ tiêu</span>
			<span class="text-right">Mức giao</span>
			<span class="text-right">Kết quả</span>
			<span class="text-right">Tỷ lệ</span>
			<span class="text-right">
				Trọng số
				<Icon v-if="weightShifted" name="heroicons:information-circle" class="-mt-0.5 inline h-3.5 w-3.5" :title="KPI_HINTS.effectiveWeight" />
			</span>
			<span class="text-right">Điểm<template v-if="provisional"> tạm tính</template></span>
		</div>

		<div
			v-for="l in review.lines"
			:key="l.id"
			class="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-gray-100 px-4 py-3 first:border-t-0 sm:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,0.7fr)] sm:items-start sm:first:border-t dark:border-gray-800"
			:class="[
				!l.applicable ? 'bg-gray-50/60 dark:bg-gray-800/30' : '',
				flagged(l) ? 'ring-2 ring-inset ring-rose-400' : canScore && unscored(l) ? 'ring-1 ring-inset ring-amber-300 dark:ring-amber-600' : '',
			]"
			:data-testid="`kpi-line-${l.id}`"
			:data-line-name="l.name"
		>
			<!-- Chỉ tiêu -->
			<div class="col-span-2 min-w-0 sm:col-span-1">
				<p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ l.name }}</p>
				<p class="text-xs text-gray-500">
					{{ l.source === 'AUTO' ? 'Tự động' : 'Nhập tay' }} · {{ l.directionLabel }}<template v-if="l.manualScale"> · chấm 1–5</template>
				</p>
				<!-- UI-17b: vì sao không áp dụng (máy chủ tính từ bằng chứng), trọng số của dòng này chia sang dòng khác. -->
				<p
					v-if="!l.applicable && l.notApplicableReason"
					class="mt-1 text-xs text-gray-600 dark:text-gray-300"
					data-testid="kpi-line-na-reason"
				>
					{{ l.notApplicableReason }} Trọng số chia sang các chỉ tiêu còn lại.
				</p>
				<p v-if="l.reviewerNote" class="mt-1 text-xs text-gray-700 dark:text-gray-300" data-testid="kpi-line-note-text">
					<Icon name="heroicons:chat-bubble-bottom-center-text" class="-mt-0.5 mr-0.5 inline h-3.5 w-3.5 text-gray-400" aria-hidden="true" />{{ l.reviewerNote }}
				</p>
				<p v-if="flagged(l)" class="mt-1 text-xs font-medium text-rose-600">Chưa chấm chỉ tiêu này</p>
				<div v-if="canScore" class="mt-1 flex flex-wrap gap-3">
					<button
						v-if="l.source === 'AUTO' && l.applicable"
						type="button"
						class="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
						:data-testid="`kpi-adjust-${l.id}`"
						@click="emit('edit', l, 'adjust')"
					>
						<Icon name="heroicons:pencil-square" class="h-3.5 w-3.5" />{{ l.adjusted ? 'Sửa số đã chỉnh' : 'Chỉnh số' }}
					</button>
					<button
						type="button"
						class="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:underline dark:text-gray-300"
						:data-testid="`kpi-note-${l.id}`"
						@click="emit('edit', l, 'note')"
					>
						<Icon name="heroicons:chat-bubble-bottom-center-text" class="h-3.5 w-3.5" />{{ l.reviewerNote ? 'Sửa ghi chú' : 'Ghi chú' }}
					</button>
				</div>
			</div>

			<!-- Mức giao -->
			<div class="sm:text-right">
				<p :class="CELL_LABEL">Mức giao</p>
				<p class="text-sm text-gray-700 dark:text-gray-200">{{ kpiTargetText(l, l.effectiveTarget) }}</p>
				<p v-if="l.effectiveTarget !== l.target" class="text-[11px] text-gray-500" title="Hạ theo số ngày làm thực tế trong kỳ">
					gốc {{ kpiTargetText(l, l.target) }}
				</p>
			</div>

			<!-- Kết quả: màn hẹp thì hàng nút chấm chiếm cả chiều ngang để dễ bấm -->
			<div class="sm:text-right" :class="canScore && l.applicable && l.source === 'MANUAL' && (l.manualScale || l.direction === 'PASS_FAIL') ? 'col-span-2 sm:col-span-1' : ''">
				<p :class="CELL_LABEL">Kết quả</p>
				<template v-if="!l.applicable">
					<p class="text-sm italic text-gray-500" data-testid="kpi-line-na">Không áp dụng</p>
				</template>
				<!-- Chấm 1–5 -->
				<template v-else-if="l.source === 'MANUAL' && l.manualScale">
					<div v-if="canScore" class="flex gap-1 sm:justify-end" role="radiogroup" :aria-label="`Chấm ${l.name}`">
						<button
							v-for="n in 5"
							:key="n"
							type="button"
							role="radio"
							:aria-checked="l.value === n"
							:disabled="busyLineId === l.id"
							class="h-11 min-w-0 flex-1 rounded-lg border text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 sm:h-8 sm:w-8 sm:flex-none"
							:class="l.value === n ? 'border-brand-600 bg-brand-600 text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-brand-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200'"
							:data-testid="`kpi-score-${l.id}-${n}`"
							@click="emit('score', l, l.value === n ? null : n)"
						>
							{{ n }}
						</button>
					</div>
					<p v-else class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ l.value == null ? 'Chưa chấm' : `${kpiNum(l.value)}/5` }}</p>
				</template>
				<!-- Đạt hoặc không đạt nhập tay -->
				<template v-else-if="l.source === 'MANUAL' && l.direction === 'PASS_FAIL'">
					<div v-if="canScore" class="flex gap-1 sm:justify-end" role="radiogroup" :aria-label="`Chấm ${l.name}`">
						<button
							v-for="opt in [{ v: 1, t: 'Đạt' }, { v: 0, t: 'Không đạt' }]"
							:key="opt.v"
							type="button"
							role="radio"
							:aria-checked="l.value === opt.v"
							:disabled="busyLineId === l.id"
							class="flex-1 rounded-lg border px-2.5 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 sm:flex-none sm:py-1.5"
							:class="l.value === opt.v ? 'border-brand-600 bg-brand-600 text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-brand-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200'"
							@click="emit('score', l, l.value === opt.v ? null : opt.v)"
						>
							{{ opt.t }}
						</button>
					</div>
					<p v-else class="text-sm font-medium">{{ l.value == null ? 'Chưa chấm' : kpiValueText(l, l.value) }}</p>
				</template>
				<!-- Số nhập tay -->
				<template v-else-if="l.source === 'MANUAL'">
					<p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ l.value == null ? 'Chưa nhập' : kpiValueText(l, l.value) }}</p>
					<button v-if="canScore" type="button" class="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300" @click="emit('edit', l, 'value')">
						{{ l.value == null ? 'Nhập kết quả' : 'Sửa' }}
					</button>
				</template>
				<!-- Số tự động -->
				<template v-else>
					<div class="flex flex-wrap items-baseline gap-x-1.5 sm:justify-end">
						<s v-if="l.adjusted" class="text-xs text-gray-400" data-testid="kpi-line-auto-struck" :title="'Số hệ thống tính'">{{ kpiValueText(l, l.autoValue) }}</s>
						<button
							v-if="l.hasEvidence"
							type="button"
							class="rounded text-sm font-medium text-brand-700 underline decoration-dotted underline-offset-2 hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-brand-300 dark:hover:bg-brand-900/30"
							:aria-label="`${l.name}: ${kpiValueText(l, l.value)}, bấm để xem bằng chứng`"
							:data-testid="`kpi-evidence-${l.id}`"
							@click="emit('evidence', l)"
						>
							{{ kpiValueText(l, l.value) }}
						</button>
						<span v-else class="text-sm font-medium">{{ kpiValueText(l, l.value) }}</span>
					</div>
					<p v-if="l.adjusted" class="text-[11px] text-amber-700 dark:text-amber-400" data-testid="kpi-line-adjust-reason">
						{{ l.adjustedBy ? `${l.adjustedBy.fullName} chỉnh` : 'Đã chỉnh' }}<template v-if="l.adjustReason">: {{ l.adjustReason }}</template>
					</p>
				</template>
			</div>

			<!-- Tỷ lệ -->
			<div class="sm:text-right">
				<p :class="CELL_LABEL">Tỷ lệ hoàn thành</p>
				<p class="text-sm text-gray-700 dark:text-gray-200">{{ l.applicable ? kpiPct(l.completionPct) : '—' }}</p>
			</div>

			<!-- Trọng số -->
			<div class="sm:text-right">
				<p :class="CELL_LABEL">Trọng số</p>
				<p class="text-sm text-gray-700 dark:text-gray-200">
					<template v-if="l.effectiveWeight !== l.weight">
						<s class="text-xs text-gray-400">{{ kpiNum(l.weight) }}%</s>
						{{ kpiNum(l.effectiveWeight) }}%
					</template>
					<template v-else>{{ kpiNum(l.weight) }}%</template>
				</p>
				<p v-if="kpiWeightShiftText(review.lines, l)" class="text-[11px] text-gray-500" data-testid="kpi-line-weight-note">
					{{ kpiWeightShiftText(review.lines, l) }}
				</p>
			</div>

			<!-- Điểm và thao tác -->
			<div class="sm:text-right">
				<p :class="CELL_LABEL">Điểm<template v-if="provisional"> tạm tính</template></p>
				<p class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ l.applicable ? kpiNum(l.score, 1) : '—' }}</p>
			</div>


		</div>

		<!-- Tổng -->
		<div class="flex items-center justify-between gap-3 border-t-2 border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/60">
			<span class="text-sm font-semibold text-gray-900 dark:text-white">Tổng điểm<template v-if="provisional"> (tạm tính)</template></span>
			<span class="text-sm font-bold text-gray-900 dark:text-white" data-testid="kpi-total">
				{{ kpiNum(review.totalScore, 1) }}<template v-if="review.grade"> · xếp loại {{ review.grade }}</template>
			</span>
		</div>
	</div>
</template>
