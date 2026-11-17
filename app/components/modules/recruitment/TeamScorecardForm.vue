<script setup lang="ts">
	import { useRecruitmentMeService } from '~/services/recruitment-me.service';
	import { recruitErrorCode, recruitErrorMessage, formatScore } from '~/utils/recruitment.utils';
	import { formatDateTime } from '~/utils/date';
	// Nhãn lấy từ hằng số dùng chung, chép đúng chữ của `vi-labels.ts` bên BE: chữ ở nút chấm
	// phiếu và chữ ở bảng tổng hợp phải là một, nếu không cùng một kết luận hiện hai tên.
	import { VERDICT_LABELS } from '~/types/recruitment.types';
	import type { RecruitmentScorecard, RecruitmentVerdict } from '~/types/recruitment-me.types';

	/**
	 * Form chấm phiếu đánh giá của CHÍNH người đang đăng nhập.
	 *
	 * Hai loại mẫu chấm khác nhau hẳn nên một form phục vụ cả hai bằng cách đổi ô nhập:
	 * - Phiếu phỏng vấn: mỗi tiêu chí chấm số nguyên 1–5, điểm phiếu là Σ(điểm × trọng số) ÷ Σ
	 *   trọng số (BR-07), và bắt buộc có kết luận khi nộp.
	 *   - Phiếu thi: mỗi môn chấm từ 0 đến điểm tối đa của môn, tối đa hai chữ số thập phân; điểm
	 *   phiếu là tổng điểm các môn, và kết luận để trống thì BE tự gợi ý theo điểm đạt.
	 *
	 * Sau lần nộp đầu, chủ phiếu còn sửa được trong 24 giờ (`editableUntil`, BR-08); quá hạn thì
	 * cả lưu nháp lẫn nộp đều trả 409 nên form chuyển sang chỉ đọc.
	 */
	const props = defineProps<{
		scorecard: RecruitmentScorecard;
		/** Module đang chỉ xem thì BE chặn lưu và nộp, nên ẩn nút thay vì để người dùng bấm vào lỗi. */
		canWrite: boolean;
	}>();

	const emit = defineEmits<{
		/** Lưu nháp hoặc nộp xong, kèm bản mới nhất để trang cha cập nhật danh sách. */
		saved: [scorecard: RecruitmentScorecard];
		submitted: [scorecard: RecruitmentScorecard];
		close: [];
	}>();

	const service = useRecruitmentMeService();
	const toast = useToast();

	const isTest = computed(() => props.scorecard.kind === 'TEST');

	/** Chỉ chấm tiêu chí đang dùng — tiêu chí đã ngừng dùng gửi lên sẽ bị 400 `RECRUIT_CRITERION_INVALID`. */
	const criteria = computed(() =>
		[...props.scorecard.criteria].filter(c => c.isActive).sort((a, b) => a.order - b.order),
	);

	/** Điểm đang nhập, khoá theo id tiêu chí. Chuỗi rỗng = chưa chấm. */
	const scores = ref<Record<number, string>>({});
	const verdict = ref<RecruitmentVerdict | ''>('');
	const comment = ref('');
	const saving = ref(false);
	const submitting = ref(false);
	/** Tiêu chí còn thiếu điểm khi bấm nộp, để tô đỏ đúng dòng thay vì chỉ toast một câu. */
	const missingIds = ref<number[]>([]);

	function fillFrom(card: RecruitmentScorecard) {
		const next: Record<number, string> = {};
		for (const c of card.criteria) next[c.id] = c.score == null ? '' : String(c.score);
		scores.value = next;
		verdict.value = card.verdict ?? '';
		comment.value = card.comment ?? '';
		missingIds.value = [];
	}

	watch(() => props.scorecard, fillFrom, { immediate: true, deep: false });

	/** Quá 24 giờ kể từ lần nộp đầu thì khoá hẳn (BR-08). */
	const locked = computed(() => {
		const until = props.scorecard.editableUntil;
		if (!until) return false;
		return new Date(until).getTime() <= Date.now();
	});

	const readOnly = computed(() => locked.value || !props.canWrite);

	/** Điểm tạm tính để người chấm thấy ngay, BE vẫn là nơi chốt số. */
	const previewScore = computed(() => {
		const entries = criteria.value
			.map(c => ({ c, n: Number(scores.value[c.id]) }))
			.filter(x => scores.value[x.c.id] !== '' && Number.isFinite(x.n));
		if (!entries.length) return null;
		if (isTest.value) return entries.reduce((sum, x) => sum + x.n, 0);
		const weightSum = entries.reduce((sum, x) => sum + x.c.weight, 0);
		if (weightSum <= 0) return null;
		return entries.reduce((sum, x) => sum + x.n * x.c.weight, 0) / weightSum;
	});

	function payload() {
		const list: { criterionId: number; score: number }[] = [];
		for (const c of criteria.value) {
			const raw = scores.value[c.id];
			if (raw === '' || raw == null) continue;
			const n = Number(raw);
			if (Number.isFinite(n)) list.push({ criterionId: c.id, score: n });
		}
		return {
			scores: list,
			// Gửi `null` để XOÁ kết luận đã lưu; bỏ trống `verdict` thì BE giữ nguyên cái cũ.
			verdict: verdict.value === '' ? null : verdict.value,
			comment: comment.value.trim(),
		};
	}

	/** Báo lỗi của BE về đúng chỗ: thiếu điểm thì tô dòng, sai điểm thì toast câu của BE. */
	function reportError(e: unknown, fallback: string) {
		const code = recruitErrorCode(e);
		const message = recruitErrorMessage(e, fallback);
		if (code === 'RECRUIT_SCORE_MISSING') {
			missingIds.value = criteria.value.filter(c => scores.value[c.id] === '' || scores.value[c.id] == null).map(c => c.id);
		}
		toast.error(message);
	}

	async function saveDraft() {
		saving.value = true;
		try {
			const updated = await service.saveScorecard(props.scorecard.id, payload());
			fillFrom(updated);
			emit('saved', updated);
			toast.success('Đã lưu nháp phiếu');
		} catch (e) {
			reportError(e, 'Không lưu được phiếu');
		} finally {
			saving.value = false;
		}
	}

	async function submit() {
		// Chặn tại chỗ hai lỗi chắc chắn bị BE trả về, để người chấm không mất một vòng gửi.
		const missing = criteria.value.filter(c => scores.value[c.id] === '' || scores.value[c.id] == null);
		if (missing.length) {
			missingIds.value = missing.map(c => c.id);
			toast.error(`Còn ${missing.length} tiêu chí chưa chấm điểm`);
			return;
		}
		if (!isTest.value && verdict.value === '') {
			toast.error('Phiếu phỏng vấn phải có kết luận');
			return;
		}

		submitting.value = true;
		try {
			const updated = await service.submitScorecard(props.scorecard.id, payload());
			fillFrom(updated);
			emit('submitted', updated);
			toast.success('Đã nộp phiếu đánh giá');
		} catch (e) {
			reportError(e, 'Không nộp được phiếu');
		} finally {
			submitting.value = false;
		}
	}

	/**
	 * Kết luận đang chọn tô NỀN ĐẶC, không chỉ đổi viền.
	 *
	 * Đây là ô quan trọng nhất của phiếu và là thứ duy nhất BE bắt buộc khi nộp phiếu phỏng vấn;
	 * viền nhạt trên nền trắng liếc qua không thấy, người chấm dễ tưởng mình đã chọn rồi.
	 */
	const VERDICTS: { value: RecruitmentVerdict; active: string }[] = [
		{ value: 'PASS', active: 'border-emerald-600 bg-emerald-600 text-white' },
		{ value: 'CONSIDER', active: 'border-amber-500 bg-amber-500 text-white' },
		{ value: 'FAIL', active: 'border-rose-600 bg-rose-600 text-white' },
	];
</script>

<template>
	<section class="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
		<header class="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
			<div class="min-w-0">
				<h3 class="truncate text-sm font-semibold text-gray-900 dark:text-white">
					{{ scorecard.template.name }}
				</h3>
				<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
					{{ scorecard.stage.name }} · {{ scorecard.kindLabel }}
					<span v-if="scorecard.interview">
						· buổi {{ formatDateTime(scorecard.interview.startAt) }}
					</span>
				</p>
			</div>
			<button
				type="button"
				class="flex-shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
				aria-label="Đóng phiếu"
				@click="emit('close')"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</header>

		<div class="space-y-4 p-4">
			<p
				v-if="locked"
				class="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-400"
			>
				Phiếu đã nộp quá 24 giờ nên khoá, không sửa được nữa.
			</p>
			<p
				v-else-if="!canWrite"
				class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
			>
				Module tuyển dụng đang ở chế độ chỉ xem nên chưa chấm được phiếu.
			</p>
			<p
				v-else-if="scorecard.status === 'SUBMITTED' && scorecard.editableUntil"
				class="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"
			>
				Đã nộp. Bạn còn sửa được đến {{ formatDateTime(scorecard.editableUntil) }}.
			</p>

			<ul class="space-y-3">
				<li
					v-for="c in criteria"
					:key="c.id"
					class="rounded-lg border p-3"
					:class="missingIds.includes(c.id) ? 'border-red-400 bg-red-50/50 dark:border-red-500 dark:bg-red-900/10' : 'border-gray-200 dark:border-gray-700'"
				>
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0">
							<p class="text-sm font-medium text-gray-900 dark:text-white">{{ c.name }}</p>
							<p v-if="c.description" class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
								{{ c.description }}
							</p>
							<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
								<template v-if="isTest">
									Điểm tối đa {{ c.maxScore }}<span v-if="c.passScore != null"> · đạt từ {{ c.passScore }}</span>
								</template>
								<template v-else>Trọng số {{ c.weight }}</template>
							</p>
						</div>

						<!-- Phiếu thi nhập số; phiếu phỏng vấn bấm thang 1–5 cho nhanh và khỏi gõ sai. -->
						<input
							v-if="isTest"
							v-model="scores[c.id]"
							type="number"
							step="0.01"
							min="0"
							:max="c.maxScore ?? undefined"
							:disabled="readOnly"
							class="w-24 flex-shrink-0 rounded-lg border border-gray-300 px-2.5 py-1.5 text-right text-sm tabular-nums focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:disabled:bg-gray-800/50"
						/>
						<div v-else class="flex flex-shrink-0 gap-1" role="group" :aria-label="`Điểm ${c.name}`">
							<button
								v-for="n in 5"
								:key="n"
								type="button"
								:disabled="readOnly"
								class="h-8 w-8 rounded-lg border text-sm font-medium transition-colors disabled:opacity-60"
								:class="Number(scores[c.id]) === n
									? 'border-brand-600 bg-brand-600 text-white'
									: 'border-gray-300 text-gray-600 hover:border-brand-400 dark:border-gray-600 dark:text-gray-300'"
								@click="scores[c.id] = String(n)"
							>
								{{ n }}
							</button>
						</div>
					</div>
				</li>
			</ul>

			<p class="text-sm text-gray-600 dark:text-gray-400">
				Điểm tạm tính:
				<span class="font-semibold text-gray-900 dark:text-white">{{ formatScore(previewScore) }}</span>
				<span v-if="!isTest" class="text-xs"> (theo trọng số)</span>
			</p>

			<!-- Phiếu thi cũng có kết luận, chỉ khác là không bắt buộc khi nộp. -->
			<div>
				<p class="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
					Kết luận
					<span v-if="!isTest" class="text-red-500">*</span>
					<span v-else class="text-xs font-normal text-gray-500 dark:text-gray-400">
						— để trống thì hệ thống tự gợi ý theo điểm đạt
					</span>
				</p>
				<div class="flex flex-wrap gap-2">
					<button
						v-for="v in VERDICTS"
						:key="v.value"
						type="button"
						:disabled="readOnly"
						class="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60"
						:class="verdict === v.value ? v.active : 'border-gray-300 text-gray-600 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300'"
						@click="verdict = verdict === v.value ? '' : v.value"
					>
						{{ VERDICT_LABELS[v.value] }}
					</button>
				</div>
			</div>

			<label class="block">
				<span class="text-sm font-medium text-gray-700 dark:text-gray-300">Nhận xét</span>
				<textarea
					v-model="comment"
					rows="3"
					maxlength="5000"
					:disabled="readOnly"
					placeholder="Điểm mạnh, điểm cần xem thêm, câu hỏi đã dùng…"
					class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:disabled:bg-gray-800/50"
				/>
			</label>

			<div v-if="!readOnly" class="flex flex-col gap-2 sm:flex-row">
				<CommonAppButton :loading="submitting" :disabled="saving" @click="submit">
					{{ scorecard.status === 'SUBMITTED' ? 'Cập nhật phiếu' : 'Nộp phiếu' }}
				</CommonAppButton>
				<CommonAppButton variant="outline" :loading="saving" :disabled="submitting" @click="saveDraft">
					Lưu nháp
				</CommonAppButton>
			</div>
		</div>
	</section>
</template>
