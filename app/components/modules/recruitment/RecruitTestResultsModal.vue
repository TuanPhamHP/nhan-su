<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import { recruitErrorMessage } from '~/utils/recruitment.utils';
	import type {
		RecruitmentApplicationCard,
		RecruitmentTestResult,
		ScorecardTemplate,
		TestResultEntry,
	} from '~/types/recruitment.types';

	/**
	 * Nhập điểm thi cho nhiều hồ sơ của cùng một vòng Bài test.
	 *
	 * Mỗi hồ sơ thành một phiếu loại thi đã nộp, người đánh giá là người đang nhập. Nhập lại
	 * cho cùng hồ sơ thì ghi đè phiếu cũ của chính mình, nhưng chỉ trong 24 giờ kể từ lần
	 * nhập đầu — quá hạn thì dòng đó báo lỗi riêng và các dòng khác vẫn lưu được.
	 */
	const props = defineProps<{
		stageId: number;
		stageName: string;
		applications: RecruitmentApplicationCard[];
	}>();

	const emit = defineEmits<{ done: []; close: [] }>();

	const service = useRecruitmentService();

	const templates = ref<ScorecardTemplate[]>([]);
	const templateId = ref<number | undefined>(undefined);
	const loadingTemplates = ref(true);
	const submitting = ref(false);
	const error = ref<string | null>(null);
	const results = ref<RecruitmentTestResult[]>([]);

	/** `scores[applicationId][criterionId]` — ô nhập giữ chuỗi để người dùng xoá được số. */
	const scores = ref<Record<number, Record<number, string>>>({});
	const verdicts = ref<Record<number, '' | 'PASS' | 'FAIL'>>({});

	onMounted(async () => {
		try {
			const list = await service.findScorecardTemplates(true);
			templates.value = list.filter(t => t.kind === 'TEST');
			templateId.value = templates.value[0]?.id;
		} catch (e) {
			error.value = recruitErrorMessage(e, 'Không tải được mẫu điểm thi');
		} finally {
			loadingTemplates.value = false;
		}
	});

	const templateOptions = computed(() =>
		templates.value.map(t => ({ value: t.id as number | undefined, label: t.name })),
	);

	const template = computed(() => templates.value.find(t => t.id === templateId.value) ?? null);

	const verdictOptions = [
		{ value: '', label: 'Hệ thống tự gợi ý' },
		{ value: 'PASS', label: 'Đạt' },
		{ value: 'FAIL', label: 'Không đạt' },
	];

	function scoreOf(applicationId: number, criterionId: number): string {
		return scores.value[applicationId]?.[criterionId] ?? '';
	}

	function setScore(applicationId: number, criterionId: number, value: string) {
		const row = scores.value[applicationId] ?? {};
		row[criterionId] = value;
		scores.value[applicationId] = row;
	}

	/** Tổng điểm một hồ sơ, để người nhập thấy ngay mà không phải chờ BE. */
	function totalOf(applicationId: number): number | null {
		const criteria = template.value?.criteria ?? [];
		let sum = 0;
		let any = false;
		for (const c of criteria) {
			const raw = scoreOf(applicationId, c.id);
			if (raw === '') continue;
			const n = Number(raw);
			if (!Number.isFinite(n)) return null;
			sum += n;
			any = true;
		}
		return any ? Math.round(sum * 100) / 100 : null;
	}

	function buildEntries(): TestResultEntry[] {
		const criteria = template.value?.criteria ?? [];
		const entries: TestResultEntry[] = [];
		for (const app of props.applications) {
			const list = criteria
				.map(c => ({ criterionId: c.id, raw: scoreOf(app.id, c.id) }))
				.filter(x => x.raw !== '')
				.map(x => ({ criterionId: x.criterionId, score: Number(x.raw) }));
			// Hồ sơ chưa nhập điểm nào thì bỏ qua, đừng gửi phiếu rỗng.
			if (!list.length) continue;
			const verdict = verdicts.value[app.id];
			entries.push({
				applicationId: app.id,
				scores: list,
				verdict: verdict === 'PASS' || verdict === 'FAIL' ? verdict : undefined,
			});
		}
		return entries;
	}

	const filledCount = computed(() => buildEntries().length);

	async function submit() {
		if (templateId.value == null) {
			error.value = 'Chọn mẫu điểm thi';
			return;
		}
		const entries = buildEntries();
		if (!entries.length) {
			error.value = 'Chưa nhập điểm cho hồ sơ nào';
			return;
		}
		submitting.value = true;
		error.value = null;
		results.value = [];
		try {
			const res = await service.saveTestResults({
				templateId: templateId.value,
				stageId: props.stageId,
				entries,
			});
			const failed = res.filter(r => !r.ok);
			if (failed.length) {
				// Dòng hỏng không kéo dòng khác, nên hiện riêng từng dòng rồi giữ hộp thoại mở.
				results.value = failed;
				error.value = `${failed.length}/${res.length} hồ sơ không lưu được.`;
				return;
			}
			emit('done');
		} catch (e) {
			error.value = recruitErrorMessage(e, 'Lưu điểm thi thất bại');
		} finally {
			submitting.value = false;
		}
	}

	function candidateName(applicationId: number): string {
		return props.applications.find(a => a.id === applicationId)?.candidate.fullName ?? `#${applicationId}`;
	}
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/50 p-4">
			<div class="my-8 w-full max-w-4xl rounded-2xl bg-white shadow-xl dark:bg-gray-900">
				<div class="flex items-start justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
					<div>
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">Nhập điểm thi</h2>
						<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
							Vòng {{ stageName }} · {{ applications.length }} hồ sơ
						</p>
					</div>
					<button
						type="button"
						class="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
						aria-label="Đóng"
						@click="emit('close')"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<div class="max-h-[70vh] space-y-4 overflow-y-auto p-6">
					<div v-if="loadingTemplates" class="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />

					<p
						v-else-if="!templates.length"
						class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
					>
						Công ty chưa có mẫu điểm thi nào đang dùng. Hãy tạo mẫu loại "Phiếu điểm thi" ở Cài đặt
						tuyển dụng trước.
					</p>

					<template v-else>
						<div class="max-w-sm space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Mẫu điểm thi</label>
							<UiSelect v-model="templateId" :options="templateOptions" />
						</div>

						<div v-if="template" class="overflow-x-auto">
							<table class="w-full text-sm">
								<thead>
									<tr class="border-b border-gray-200 dark:border-gray-700">
										<th class="py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
											Ứng viên
										</th>
										<th
											v-for="c in template.criteria"
											:key="c.id"
											class="px-2 py-2 text-center text-xs font-semibold text-gray-500 dark:text-gray-400"
										>
											{{ c.name }}
											<span class="block font-normal normal-case text-gray-400">
												tối đa {{ c.maxScore ?? '—' }}<template v-if="c.passScore != null">, đạt từ {{ c.passScore }}</template>
											</span>
										</th>
										<th class="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
											Tổng
										</th>
										<th class="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
											Kết luận
										</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
									<tr v-for="app in applications" :key="app.id">
										<td class="py-2 pr-3">
											<p class="font-medium text-gray-900 dark:text-white">{{ app.candidate.fullName }}</p>
											<p class="text-xs text-gray-400">{{ app.candidate.email ?? app.candidate.phone ?? '' }}</p>
										</td>
										<td v-for="c in template.criteria" :key="c.id" class="px-2 py-2">
											<input
												type="number"
												min="0"
												:max="c.maxScore ?? undefined"
												step="0.01"
												:value="scoreOf(app.id, c.id)"
												class="w-20 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-center text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
												:aria-label="`${c.name} của ${app.candidate.fullName}`"
												@input="setScore(app.id, c.id, ($event.target as HTMLInputElement).value)"
											/>
										</td>
										<td class="px-2 py-2 text-center tabular-nums text-gray-900 dark:text-white">
											{{ totalOf(app.id) ?? '—' }}
										</td>
										<td class="px-2 py-2">
											<UiSelect v-model="verdicts[app.id]" :options="verdictOptions" />
										</td>
									</tr>
								</tbody>
							</table>
						</div>

						<p class="text-xs text-gray-500 dark:text-gray-400">
							Hồ sơ để trống hết các ô điểm sẽ không được gửi lên. Bỏ trống kết luận thì hệ thống gợi
							ý Đạt khi mọi môn có điểm đạt đều vượt mức.
						</p>
					</template>

					<p v-if="error" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
						{{ error }}
					</p>

					<ul v-if="results.length" class="space-y-1">
						<li
							v-for="row in results"
							:key="row.applicationId"
							class="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-900/20 dark:text-rose-300"
						>
							{{ candidateName(row.applicationId) }}: {{ row.message ?? row.code }}
						</li>
					</ul>
				</div>

				<div class="flex items-center justify-between gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
					<p class="text-xs text-gray-500 dark:text-gray-400">Đã nhập điểm cho {{ filledCount }} hồ sơ</p>
					<div class="flex gap-3">
						<CommonAppButton variant="secondary" @click="emit('close')">Huỷ</CommonAppButton>
						<CommonAppButton
							variant="primary"
							:loading="submitting"
							:disabled="!templates.length"
							@click="submit"
						>
							Lưu điểm
						</CommonAppButton>
					</div>
				</div>
			</div>
		</div>
	</Teleport>
</template>
