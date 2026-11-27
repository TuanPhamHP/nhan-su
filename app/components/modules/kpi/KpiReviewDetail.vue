<script setup lang="ts">
	import KpiChangeReviewerModal from '~/components/modules/kpi/KpiChangeReviewerModal.vue';
	import KpiConfirmModal from '~/components/modules/kpi/KpiConfirmModal.vue';
	import KpiEvidencePanel from '~/components/modules/kpi/KpiEvidencePanel.vue';
	import KpiGradeBadge from '~/components/modules/kpi/KpiGradeBadge.vue';
	import KpiLineEditModal from '~/components/modules/kpi/KpiLineEditModal.vue';
	import KpiReviewLines from '~/components/modules/kpi/KpiReviewLines.vue';
	import KpiStatusBadge from '~/components/modules/kpi/KpiStatusBadge.vue';
	import KpiStepBar from '~/components/modules/kpi/KpiStepBar.vue';
	import { useKpiService } from '~/services/kpi.service';
	import type { KpiReviewDetail, KpiReviewLine } from '~/types/kpi.types';
	import {
		KPI_HINTS,
		kpiAtText,
		kpiDayText,
		kpiDaysLeft,
		kpiEventText,
		kpiGradeLegend,
		kpiAllZero,
		kpiMissingLines,
		kpiNum,
		kpiRangeText,
	} from '~/utils/kpi.utils';
	import { taskErrorInfo } from '~/utils/tasks.utils';

	/**
	 * Một phiếu KPI dùng chung cho KPI của tôi (UI-10), Đánh giá nhân viên (UI-11) và Kỳ đánh giá (UI-13).
	 *
	 * Nút hiện theo `permissions` của phiếu (bridge mục 4.2), không tự suy theo vai trò: nhân viên thấy ô phản
	 * hồi khi `canFeedback`, người chấm chấm khi `canScore` và gửi khi `canSubmit`, nhân sự chốt, công bố,
	 * mở lại, đổi người chấm theo cờ tương ứng. Mọi thao tác ghi trả phiếu mới, thay thẳng rồi báo `changed`.
	 * Hai người bấm cùng lúc (409 `KPI_REVIEW_STEP_INVALID`) thì tải lại phiếu và hiện câu của máy chủ.
	 */
	const props = defineProps<{
		reviewId: number;
		/** Người xem là chính nhân viên của phiếu: đổi giọng câu ("bạn"). */
		self?: boolean;
	}>();
	const emit = defineEmits<{ changed: [review: KpiReviewDetail]; loaded: [review: KpiReviewDetail] }>();

	const service = useKpiService();
	const toast = useToast();
	const { canWrite } = useModuleAccess();
	const readOnly = computed(() => !canWrite('TASKS'));

	const review = ref<KpiReviewDetail | null>(null);
	const loading = ref(true);
	const notFound = ref(false);
	const loadError = ref('');

	async function load(quiet = false) {
		if (!quiet) loading.value = true;
		loadError.value = '';
		notFound.value = false;
		try {
			review.value = await service.getReview(props.reviewId);
			emit('loaded', review.value);
		} catch (err) {
			const info = taskErrorInfo(err, 'Chưa tải được phiếu.');
			if (info.status === 404) notFound.value = true;
			loadError.value = info.message;
		} finally {
			loading.value = false;
		}
	}
	watch(
		() => props.reviewId,
		() => {
			missing.value = [];
			comment.value = '';
			feedbackText.value = '';
			load();
		},
	);
	onMounted(() => load());

	function apply(r: KpiReviewDetail) {
		review.value = r;
		emit('changed', r);
	}

	/** Lỗi thao tác: sai bước hay người khác vừa đổi thì tải lại phiếu. Trả câu lỗi cho nơi gọi. */
	async function fail(err: unknown, fallback: string): Promise<string> {
		const info = taskErrorInfo(err, fallback);
		toast.error(info.message);
		if (info.code === 'KPI_REVIEW_STEP_INVALID' || info.code === 'KPI_REVIEW_NOT_FOUND') await load(true);
		return info.message;
	}

	const r = computed(() => review.value);
	/**
	 * Cờ thao tác của máy chủ; công ty đang ở chế độ chỉ xem (module `READ_ONLY`) thì ẩn mọi nút ghi, vì máy chủ
	 * sẽ trả 403 `MODULE_READ_ONLY` cho mọi POST, PATCH.
	 */
	const NO_PERMS = { canScore: false, canSubmit: false, canFeedback: false, canFinalize: false, canPublish: false, canReopen: false, canChangeReviewer: false };
	const perm = computed(() => (r.value ? (readOnly.value ? NO_PERMS : r.value.permissions) : undefined));
	const provisional = computed(() => !!r.value && (!r.value.scoreComplete || r.value.status === 'OPEN' || r.value.status === 'MANAGER_REVIEW'));
	const unscoredCount = computed(() => r.value?.lines.filter(l => l.source === 'MANUAL' && l.applicable && l.value == null).length ?? 0);
	const feedbackDays = computed(() => kpiDaysLeft(r.value?.feedbackDueAt));
	const dueText = computed(() => {
		if (r.value?.status !== 'FEEDBACK' || !r.value.feedbackDueAt) return null;
		const d = feedbackDays.value ?? 0;
		return d > 0 ? `Hạn phản hồi ${kpiDayText(r.value.feedbackDueAt)}, còn ${d} ngày` : `Hạn phản hồi ${kpiDayText(r.value.feedbackDueAt)}`;
	});
	const volumeLine = computed(() => r.value?.lines.find(l => l.autoKey === 'TASK_POINTS_ACCEPTED' && l.applicable && l.completionPct != null) ?? null);
	const gradeLegend = computed(() => kpiGradeLegend(r.value?.grades ?? []));
	/** Bốn số việc của nhân viên trên phiếu (UI-16b); quá hạn tô đỏ khi khác 0. */
	const taskStatItems = computed(() => {
		const s = r.value?.taskStats;
		if (!s) return [];
		return [
			{ key: 'open', label: 'Đang mở', value: s.open, alert: false },
			{ key: 'inReview', label: 'Chờ nghiệm thu', value: s.inReview, alert: false },
			{ key: 'overdue', label: 'Quá hạn', value: s.overdue, alert: s.overdue > 0 },
			{ key: 'accepted', label: 'Đã nghiệm thu trong kỳ', value: s.acceptedInPeriod, alert: false },
		];
	});

	// ─── Chấm dòng ──────────────────────────────────────────────────────────
	const busyLineId = ref<number | null>(null);
	const missing = ref<string[]>([]);
	async function score(line: KpiReviewLine, value: number | null) {
		if (!r.value) return;
		busyLineId.value = line.id;
		try {
			apply(await service.updateLine(r.value.id, line.id, { value }));
			missing.value = missing.value.filter(n => n !== line.name);
		} catch (err) {
			await fail(err, 'Chưa lưu được điểm.');
		} finally {
			busyLineId.value = null;
		}
	}
	const editing = ref<{ line: KpiReviewLine; mode: 'adjust' | 'value' | 'note' } | null>(null);
	function onLineSaved(rv: KpiReviewDetail) {
		if (editing.value) missing.value = missing.value.filter(n => n !== editing.value!.line.name);
		editing.value = null;
		apply(rv);
	}
	const evidenceLine = ref<KpiReviewLine | null>(null);
	/** Mở việc ở thẻ mới để không mất chỗ đang chấm phiếu. */
	function openTask(code: string) {
		window.open(`/cong-viec/${encodeURIComponent(code)}`, '_blank', 'noopener');
	}

	// ─── Gửi đánh giá ───────────────────────────────────────────────────────
	const comment = ref('');
	const submitting = ref(false);
	/** Cả phiếu đang 0 điểm thì hỏi lại trước khi gửi (UI-17a). */
	const confirmZero = ref(false);
	function askSubmit() {
		if (r.value && kpiAllZero(r.value.lines)) confirmZero.value = true;
		else submit();
	}
	/** Lỗi gửi đã báo bằng toast và viền đỏ trên dòng thiếu, nên hộp hỏi lại luôn đóng. */
	async function submitAnyway(): Promise<string | null> {
		confirmZero.value = false;
		await submit();
		return null;
	}
	async function submit() {
		if (!r.value) return;
		submitting.value = true;
		missing.value = [];
		try {
			const rv = await service.submit(r.value.id, comment.value.trim() || undefined);
			toast.success(`Đã gửi đánh giá cho ${rv.employee.fullName}`);
			comment.value = '';
			apply(rv);
		} catch (err) {
			const info = taskErrorInfo(err);
			if (info.code === 'KPI_MANUAL_SCORE_MISSING') {
				const e = err as { data?: { error?: { details?: unknown } } };
				const m = kpiMissingLines(e?.data?.error?.details);
				missing.value = m.names.length ? m.names : r.value.lines.filter(l => m.ids.includes(l.id)).map(l => l.name);
				toast.error(info.message);
				nextTick(() => document.querySelector('[data-testid="kpi-lines"] .ring-rose-400')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
			} else {
				await fail(err, 'Chưa gửi được đánh giá.');
			}
		} finally {
			submitting.value = false;
		}
	}

	// ─── Phản hồi ───────────────────────────────────────────────────────────
	const feedbackText = ref('');
	const feedbackError = ref('');
	const sendingFeedback = ref<'agree' | 'disagree' | null>(null);
	async function sendFeedback(agreed: boolean) {
		if (!r.value) return;
		sendingFeedback.value = agreed ? 'agree' : 'disagree';
		feedbackError.value = '';
		try {
			const rv = await service.feedback(r.value.id, { agreed, feedback: feedbackText.value.trim() || undefined });
			toast.success(agreed ? 'Đã ghi nhận bạn đồng ý với kết quả' : 'Đã gửi phản hồi của bạn');
			feedbackText.value = '';
			apply(rv);
		} catch (err) {
			const info = taskErrorInfo(err);
			if (info.code === 'KPI_FEEDBACK_REQUIRED') {
				feedbackError.value = info.message;
				toast.error(info.message);
			} else feedbackError.value = await fail(err, 'Chưa gửi được phản hồi.');
		} finally {
			sendingFeedback.value = null;
		}
	}

	// ─── Nhân sự: chốt, công bố, mở lại, đổi người chấm ────────────────────
	type HrAction = 'finalize' | 'publish' | 'reopen';
	const confirming = ref<HrAction | null>(null);
	const changingReviewer = ref(false);
	const CONFIRM_TEXT: Record<HrAction, { title: string; message: string; label: string }> = {
		finalize: { title: 'Chốt điểm', message: 'Chốt xong thì không ai sửa được dòng nào nữa. Nhân viên vẫn gửi thêm phản hồi được tới khi công bố.', label: 'Chốt điểm' },
		publish: { title: 'Công bố kết quả', message: 'Nhân viên sẽ nhận thông báo và thấy điểm, xếp loại. Phiếu chưa chốt thì được chốt luôn.', label: 'Công bố' },
		reopen: { title: 'Mở lại phiếu', message: 'Phiếu về bước Chờ chốt để sửa. Lý do được ghi vào lịch sử phiếu.', label: 'Mở lại' },
	};
	async function doHr(action: HrAction, reason: string): Promise<string | null> {
		if (!r.value) return null;
		try {
			const rv =
				action === 'finalize' ? await service.finalize(r.value.id) : action === 'publish' ? await service.publish(r.value.id) : await service.reopen(r.value.id, reason);
			toast.success(action === 'finalize' ? 'Đã chốt điểm' : action === 'publish' ? `Đã công bố kết quả cho ${rv.employee.fullName}` : 'Đã mở lại phiếu');
			apply(rv);
			return null;
		} catch (err) {
			return await fail(err, 'Chưa thực hiện được.');
		}
	}

	const showHistory = ref(false);
	const hasHrActions = computed(() => !!perm.value && (perm.value.canFinalize || perm.value.canPublish || perm.value.canReopen || perm.value.canChangeReviewer));
	const who = computed(() => (props.self ? 'bạn' : r.value?.employee.fullName ?? ''));

	defineExpose({ reload: () => load(true) });
</script>

<template>
	<div class="space-y-4" data-testid="kpi-review">
		<div v-if="loading" class="space-y-3" aria-busy="true">
			<div class="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
			<div class="h-64 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
		</div>
		<div
			v-else-if="notFound"
			class="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-200 px-6 py-10 text-center dark:border-gray-700"
			data-testid="kpi-review-not-found"
		>
			<Icon name="heroicons:document-magnifying-glass" class="h-10 w-10 text-gray-400" />
			<h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Không tìm thấy phiếu</h3>
			<p class="max-w-md text-sm text-gray-600 dark:text-gray-400">{{ loadError }}</p>
			<slot name="not-found" />
		</div>
		<div v-else-if="loadError" class="rounded-xl border border-rose-200 bg-rose-50/50 p-4 text-sm dark:border-rose-800 dark:bg-rose-900/10" role="alert">
			<p class="text-rose-700 dark:text-rose-300">{{ loadError }}</p>
			<CommonAppButton class="mt-2" size="sm" variant="secondary" @click="load()">Thử lại</CommonAppButton>
		</div>

		<template v-else-if="r">
			<!-- Đầu phiếu -->
			<div class="flex flex-wrap items-start gap-3">
				<CommonAppAvatar :src="r.employee.avatarUrl" :name="r.employee.fullName" size="lg" />
				<div class="min-w-0 flex-1">
					<div class="flex flex-wrap items-center gap-2">
						<h2 class="text-lg font-semibold text-gray-900 dark:text-white" data-testid="kpi-review-employee">{{ r.employee.fullName }}</h2>
						<KpiStatusBadge :status="r.status" :label="r.statusLabel" />
						<span v-if="r.employeeInactive" class="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">Đã nghỉ việc</span>
					</div>
					<p class="text-sm text-gray-600 dark:text-gray-300">
						{{ [r.employee.employeeCode, r.department?.name].filter(Boolean).join(' · ') }}
					</p>
					<p class="text-xs text-gray-500">
						{{ r.period.name }} ({{ kpiRangeText(r.period.startDate, r.period.endDate) }}) · Người chấm: {{ r.reviewer.fullName }} · Mẫu {{ r.template.name }}<template v-if="r.templateVersion > 1"> (phiên bản {{ r.templateVersion }})</template>
					</p>
				</div>
				<div class="flex shrink-0 items-center gap-2">
					<slot name="tools" :review="r" />
				</div>
			</div>

			<KpiStepBar :status="r.status" :due-text="dueText" />

			<!-- Điểm -->
			<div class="flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
				<KpiGradeBadge :grade="r.grade" :grades="r.grades" size="lg" />
				<div class="min-w-0 flex-1">
					<p class="text-2xl font-bold text-gray-900 dark:text-white" data-testid="kpi-score">
						{{ kpiNum(r.totalScore, 1) }} <span class="text-sm font-medium text-gray-500">điểm</span>
						<span
							v-if="provisional"
							class="ml-1 rounded-full bg-amber-50 px-2 py-0.5 align-middle text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
							:title="KPI_HINTS.provisional"
							data-testid="kpi-provisional"
						>Điểm tạm tính</span>
					</p>
					<p v-if="r.computedAt" class="text-xs text-gray-500" data-testid="kpi-computed-at">
						Tính lúc {{ kpiAtText(r.computedAt) }}<template v-if="r.status === 'OPEN'">, hệ thống tính lại mỗi đêm</template>
					</p>
					<p v-else class="text-xs text-gray-500">Hệ thống chưa tính lần nào</p>
					<p class="text-xs text-gray-500">{{ gradeLegend }}</p>
				</div>
			</div>
			<!--
				UI-16b: số việc của nhân viên (bridge kpi mục 13.2). Chỉ là con số, không mở danh sách việc: người quản lý KPI
				đối chiếu được mà không xem nội dung việc.
			-->
			<section
				v-if="r.taskStats"
				class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
				aria-label="Số việc của nhân viên"
				data-testid="kpi-task-stats"
			>
				<p class="text-sm font-semibold text-gray-900 dark:text-white">Việc của {{ who }}</p>
				<dl class="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
					<div v-for="s in taskStatItems" :key="s.key" :data-testid="`kpi-task-stat-${s.key}`">
						<dt class="text-xs text-gray-500 dark:text-gray-400">{{ s.label }}</dt>
						<dd class="text-xl font-semibold" :class="s.alert ? 'text-rose-600 dark:text-rose-400' : 'text-gray-900 dark:text-white'">{{ s.value }}</dd>
					</div>
				</dl>
				<p class="mt-2 text-xs text-gray-500">Đang mở, chờ nghiệm thu và quá hạn tính tới hôm nay; đã nghiệm thu tính trong kỳ của phiếu.</p>
			</section>
			<p v-if="r.status === 'OPEN' && volumeLine" class="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900 dark:bg-brand-900/20 dark:text-brand-200" data-testid="kpi-midterm">
				Tính tới hôm nay, {{ who }} đang đạt {{ kpiNum(volumeLine.completionPct, 1) }}% khối lượng của kỳ.
			</p>
			<p v-if="r.workDaysRatio != null && r.workDaysRatio < 1" class="text-xs text-gray-500">
				{{ self ? 'Bạn' : r.employee.fullName }} làm {{ kpiNum(r.workDaysRatio * 100, 1) }}% số ngày làm việc của kỳ nên mức giao khối lượng và số việc hạ theo tỷ lệ đó.
			</p>
			<p v-if="readOnly" class="rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">Công ty đang dùng ở chế độ chỉ xem nên không sửa, gửi được.</p>

			<KpiReviewLines
				:review="r"
				:can-score="!!perm?.canScore"
				:busy-line-id="busyLineId"
				:missing="missing"
				:provisional="provisional"
				@evidence="l => (evidenceLine = l)"
				@score="score"
				@edit="(l, mode) => (editing = { line: l, mode })"
			/>
			<p v-if="r.status === 'OPEN' && !perm?.canScore && !self" class="text-xs text-gray-500" data-testid="kpi-open-note">
				Phiếu còn đang mở. Hệ thống tự chuyển cho người chấm vào sáng hôm sau ngày cuối kỳ, lúc đó mới chấm được.
			</p>

			<!-- Nhận xét và gửi đánh giá -->
			<div v-if="perm?.canSubmit" class="space-y-2 rounded-xl border border-brand-200 bg-brand-50/40 p-4 dark:border-brand-800 dark:bg-brand-900/10" data-testid="kpi-submit-box">
				<label for="kpi-comment" class="block text-sm font-medium text-gray-900 dark:text-gray-100">Nhận xét chung</label>
				<textarea
					id="kpi-comment"
					v-model="comment"
					rows="3"
					maxlength="2000"
					placeholder="Điểm mạnh, việc cần cải thiện kỳ sau"
					class="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
					data-testid="kpi-comment"
				/>
				<div class="flex flex-wrap items-center justify-between gap-2">
					<p class="text-xs" :class="unscoredCount ? 'text-amber-700 dark:text-amber-400' : 'text-gray-500'">
						<template v-if="unscoredCount">Còn {{ unscoredCount }} chỉ tiêu nhập tay chưa chấm. </template>Gửi xong số liệu được khoá và {{ r.employee.fullName }} nhận thông báo để phản hồi.
					</p>
					<CommonAppButton :loading="submitting" data-testid="kpi-submit" @click="askSubmit">Gửi đánh giá</CommonAppButton>
				</div>
			</div>
			<div v-else-if="r.reviewerComment" class="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
				<p class="text-xs font-medium text-gray-500">Nhận xét của {{ r.reviewer.fullName }}<template v-if="r.reviewedAt"> · {{ kpiDayText(r.reviewedAt) }}</template></p>
				<p class="mt-1 whitespace-pre-line text-sm text-gray-900 dark:text-gray-100" data-testid="kpi-reviewer-comment">{{ r.reviewerComment }}</p>
			</div>

			<!-- Phản hồi của nhân viên -->
			<div v-if="r.feedbackAt" class="rounded-xl border border-gray-200 p-4 dark:border-gray-700" data-testid="kpi-feedback-view">
				<p class="text-xs font-medium text-gray-500">
					Phản hồi của {{ self ? 'bạn' : r.employee.fullName }} · {{ kpiDayText(r.feedbackAt) }}
				</p>
				<p class="mt-1 text-sm font-medium" :class="r.feedbackAgreed ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'">
					{{ r.feedbackAgreed ? 'Đồng ý với kết quả' : 'Không đồng ý với kết quả' }}
				</p>
				<p v-if="r.employeeFeedback" class="mt-1 whitespace-pre-line text-sm text-gray-900 dark:text-gray-100">{{ r.employeeFeedback }}</p>
			</div>
			<div v-if="perm?.canFeedback" class="space-y-2 rounded-xl border border-sky-200 bg-sky-50/50 p-4 dark:border-sky-800 dark:bg-sky-900/10" data-testid="kpi-feedback-box">
				<h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ r.feedbackAt ? 'Gửi thêm phản hồi' : 'Phản hồi kết quả' }}</h3>
				<p class="text-sm text-gray-700 dark:text-gray-300" data-testid="kpi-feedback-note">
					<template v-if="r.status === 'FEEDBACK' && feedbackDays != null && feedbackDays > 0">Bạn còn {{ feedbackDays }} ngày để phản hồi, quá hạn thì phiếu tự sang bước chốt. </template>
					Bấm Đồng ý không làm mất quyền phản hồi: bạn vẫn ghi thêm được tới khi nhân sự công bố kết quả.
				</p>
				<textarea
					v-model="feedbackText"
					rows="3"
					maxlength="2000"
					aria-label="Ý kiến của bạn"
					placeholder="Ý kiến của bạn. Không đồng ý thì ghi rõ chỗ nào chưa đúng."
					class="w-full resize-none rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:text-gray-100"
					:class="feedbackError ? 'border-rose-500' : 'border-gray-300 dark:border-gray-600'"
					data-testid="kpi-feedback-text"
				/>
				<p v-if="feedbackError" class="text-xs text-rose-600" role="alert" data-testid="kpi-feedback-error">{{ feedbackError }}</p>
				<div class="flex flex-wrap justify-end gap-2">
					<CommonAppButton variant="secondary" :loading="sendingFeedback === 'disagree'" :disabled="!!sendingFeedback" data-testid="kpi-disagree" @click="sendFeedback(false)">
						Không đồng ý
					</CommonAppButton>
					<CommonAppButton :loading="sendingFeedback === 'agree'" :disabled="!!sendingFeedback" data-testid="kpi-agree" @click="sendFeedback(true)">Đồng ý với kết quả</CommonAppButton>
				</div>
			</div>

			<!-- Nhân sự -->
			<div v-if="hasHrActions" class="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 p-3 dark:border-gray-700" data-testid="kpi-hr-actions">
				<span class="mr-auto text-xs text-gray-500">
					<template v-if="r.finalizedAt">Đã chốt {{ kpiDayText(r.finalizedAt) }}<template v-if="r.finalizedBy"> bởi {{ r.finalizedBy.fullName }}</template>. </template>
					<template v-if="r.reopenCount">Đã mở lại {{ r.reopenCount }} lần.</template>
				</span>
				<CommonAppButton v-if="perm?.canChangeReviewer" size="sm" variant="secondary" data-testid="kpi-change-reviewer-btn" @click="changingReviewer = true">Đổi người chấm</CommonAppButton>
				<CommonAppButton v-if="perm?.canReopen" size="sm" variant="secondary" data-testid="kpi-reopen" @click="confirming = 'reopen'">Mở lại</CommonAppButton>
				<CommonAppButton v-if="perm?.canFinalize" size="sm" variant="secondary" data-testid="kpi-finalize" @click="confirming = 'finalize'">Chốt điểm</CommonAppButton>
				<CommonAppButton v-if="perm?.canPublish" size="sm" data-testid="kpi-publish" @click="confirming = 'publish'">Công bố</CommonAppButton>
			</div>

			<slot name="after" :review="r" />

			<!-- Lịch sử -->
			<div class="rounded-xl border border-gray-200 dark:border-gray-700">
				<button
					type="button"
					class="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-gray-100"
					:aria-expanded="showHistory"
					data-testid="kpi-history-toggle"
					@click="showHistory = !showHistory"
				>
					Lịch sử phiếu ({{ r.events.length }})
					<Icon :name="showHistory ? 'heroicons:chevron-up' : 'heroicons:chevron-down'" class="h-4 w-4 text-gray-400" />
				</button>
				<ol v-if="showHistory" class="space-y-3 border-t border-gray-100 px-4 py-3 dark:border-gray-800" data-testid="kpi-history">
					<li v-for="e in [...r.events].reverse()" :key="e.id" class="flex gap-3">
						<span class="mt-1.5 h-2 w-2 shrink-0 rounded-full" :class="e.actor ? 'bg-brand-500' : 'bg-gray-300 dark:bg-gray-600'" aria-hidden="true" />
						<div class="min-w-0">
							<p class="text-sm text-gray-900 dark:text-gray-100">{{ kpiEventText(e, r.reviewer).title }}</p>
							<p v-if="kpiEventText(e, r.reviewer).detail" class="whitespace-pre-line text-xs text-gray-600 dark:text-gray-300">{{ kpiEventText(e, r.reviewer).detail }}</p>
							<p class="text-[11px] text-gray-400">{{ kpiAtText(e.createdAt) }}</p>
						</div>
					</li>
				</ol>
			</div>
		</template>

		<KpiEvidencePanel
			v-if="evidenceLine && r"
			:review-id="r.id"
			:line="evidenceLine"
			@close="evidenceLine = null"
			@open-task="openTask"
		/>
		<KpiLineEditModal v-if="editing && r" :review-id="r.id" :line="editing.line" :mode="editing.mode" @close="editing = null" @saved="onLineSaved" />
		<KpiConfirmModal
			v-if="confirming && r"
			:title="CONFIRM_TEXT[confirming].title"
			:message="CONFIRM_TEXT[confirming].message"
			:confirm-label="CONFIRM_TEXT[confirming].label"
			:reason-label="confirming === 'reopen' ? 'Lý do mở lại' : undefined"
			:reason-required="confirming === 'reopen'"
			reason-placeholder="Ví dụ: nhân viên phản hồi đúng, cần sửa số khối lượng"
			:confirm="reason => doHr(confirming!, reason)"
			@close="confirming = null"
		/>
		<KpiConfirmModal
			v-if="confirmZero && r"
			title="Gửi phiếu toàn số 0?"
			:message="`Mọi chỉ tiêu đang là 0, nên tổng điểm của ${r.employee.fullName} là 0 và xếp loại thấp nhất. Bạn xem lại số liệu và các chỉ tiêu nhập tay trước khi gửi, vì gửi xong số liệu bị khoá.`"
			confirm-label="Vẫn gửi đánh giá"
			:confirm="submitAnyway"
			@close="confirmZero = false"
		/>
		<KpiChangeReviewerModal
			v-if="changingReviewer && r"
			:review="r"
			@close="changingReviewer = false"
			@saved="rv => { changingReviewer = false; apply(rv); }"
		/>
	</div>
</template>
