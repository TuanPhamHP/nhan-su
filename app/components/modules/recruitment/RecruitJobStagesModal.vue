<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import { recruitErrorMessage } from '~/utils/recruitment.utils';
	import {
		STAGE_KIND_LABELS,
		type RecruitmentJob,
		type RecruitmentScorecardKind,
		type RecruitmentStageKind,
		type RecruitmentTemplate,
		type ScorecardTemplate,
		type StageInput,
	} from '~/types/recruitment.types';

	/**
	 * Sửa danh sách vòng của một tin.
	 *
	 * Route là `PUT` thay toàn bộ, và **giữ `id` của vòng đang có là cách duy nhất để không
	 * xoá vòng đó**: vòng không có `id` được coi là vòng mới, vòng cũ vắng mặt bị xoá. Vòng
	 * đã có hồ sơ, lịch hay phiếu đánh giá thì BE từ chối xoá và từ chối đổi loại, nên ở đây
	 * khoá sẵn những vòng đó để người dùng không mất công.
	 */
	const props = defineProps<{ job: RecruitmentJob }>();

	const emit = defineEmits<{ saved: [job: RecruitmentJob]; close: [] }>();

	const service = useRecruitmentService();

	interface Row extends StageInput {
		/** Số hồ sơ đang xét — vòng còn hồ sơ thì không xoá, không đổi loại được. */
		activeCount: number;
	}

	const rows = ref<Row[]>(
		props.job.stages.map(s => ({
			id: s.id,
			name: s.name,
			kind: s.kind,
			scorecardTemplateId: s.scorecardTemplate?.id,
			autoEmailTemplateId: s.autoEmailTemplate?.id,
			activeCount: s.activeCount,
		})),
	);

	const scorecardTemplates = ref<ScorecardTemplate[]>([]);
	const emailTemplates = ref<RecruitmentTemplate[]>([]);
	const submitting = ref(false);
	const error = ref<string | null>(null);

	onMounted(async () => {
		try {
			const [cards, templates] = await Promise.all([
				service.findScorecardTemplates(true),
				service.findTemplates('EMAIL'),
			]);
			scorecardTemplates.value = cards;
			emailTemplates.value = templates.filter(t => t.isActive);
		} catch (e) {
			error.value = recruitErrorMessage(e, 'Không tải được mẫu đánh giá và mẫu email');
		}
	});

	const kindOptions = Object.entries(STAGE_KIND_LABELS).map(([value, label]) => ({ value, label }));

	/** Mẫu đánh giá phải cùng loại với vòng: vòng Thi tuyển dùng mẫu thi, còn lại dùng mẫu phỏng vấn. */
	function scorecardOptionsFor(kind: RecruitmentStageKind) {
		const wanted: RecruitmentScorecardKind | null =
			kind === 'TEST' ? 'TEST' : kind === 'INTERVIEW' || kind === 'SCREENING' ? 'INTERVIEW' : null;
		return [
			{ value: undefined as number | undefined, label: 'Không gắn mẫu' },
			...scorecardTemplates.value
				.filter(t => wanted == null || t.kind === wanted)
				.map(t => ({ value: t.id as number | undefined, label: t.name })),
		];
	}

	const emailOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Không gửi email tự động' },
		...emailTemplates.value.map(t => ({
			value: t.id as number | undefined,
			label: `${t.name} (${t.purposeLabel})`,
		})),
	]);

	function addStage() {
		// Chèn trước vòng Offer nếu có, vì Offer phải đứng trước Đã tuyển.
		const offerIndex = rows.value.findIndex(r => r.kind === 'OFFER');
		const at = offerIndex >= 0 ? offerIndex : Math.max(rows.value.length - 1, 0);
		rows.value.splice(at, 0, { name: 'Vòng mới', kind: 'INTERVIEW', activeCount: 0 });
	}

	function removeStage(index: number) {
		rows.value.splice(index, 1);
	}

	function move(index: number, delta: number) {
		const to = index + delta;
		if (to < 0 || to >= rows.value.length) return;
		const [row] = rows.value.splice(index, 1);
		if (row) rows.value.splice(to, 0, row);
	}

	/** Khoá vòng còn hồ sơ: BE trả 409 khi xoá, và 409 khi đổi loại. */
	function locked(row: Row): boolean {
		return row.activeCount > 0;
	}

	/** Kiểm trước đúng luật BE để người dùng không phải thử rồi mới biết sai. */
	const ruleError = computed(() => {
		const list = rows.value;
		if (list.length < 3 || list.length > 20) return 'Một tin phải có từ 3 đến 20 vòng';
		const count = (kind: RecruitmentStageKind) => list.filter(r => r.kind === kind).length;
		if (count('APPLIED') !== 1) return 'Phải có đúng một vòng loại Ứng tuyển';
		if (count('OFFER') !== 1) return 'Phải có đúng một vòng loại Offer';
		if (count('HIRED') !== 1) return 'Phải có đúng một vòng loại Đã tuyển';
		if (list[0]?.kind !== 'APPLIED') return 'Vòng đầu tiên phải là loại Ứng tuyển';
		if (list[list.length - 1]?.kind !== 'HIRED') return 'Vòng cuối cùng phải là loại Đã tuyển';
		const offerAt = list.findIndex(r => r.kind === 'OFFER');
		const hiredAt = list.findIndex(r => r.kind === 'HIRED');
		if (offerAt > hiredAt) return 'Vòng Offer phải đứng trước vòng Đã tuyển';
		if (list.some(r => !r.name.trim())) return 'Mỗi vòng phải có tên';
		return null;
	});

	async function save() {
		if (ruleError.value) {
			error.value = ruleError.value;
			return;
		}
		submitting.value = true;
		error.value = null;
		try {
			const payload: StageInput[] = rows.value.map(r => ({
				id: r.id,
				name: r.name.trim(),
				kind: r.kind,
				scorecardTemplateId: r.scorecardTemplateId,
				autoEmailTemplateId: r.autoEmailTemplateId,
			}));
			const saved = await service.saveJobStages(props.job.id, payload);
			emit('saved', saved);
		} catch (e) {
			error.value = recruitErrorMessage(e, 'Lưu quy trình của tin thất bại');
		} finally {
			submitting.value = false;
		}
	}
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/50 p-4">
			<div class="my-8 w-full max-w-3xl rounded-2xl bg-white shadow-xl dark:bg-gray-900">
				<div class="flex items-start justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
					<div>
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">Quy trình của tin</h2>
						<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
							{{ job.code }} · {{ job.title }}
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

				<div class="max-h-[70vh] space-y-3 overflow-y-auto p-6">
					<p class="text-sm text-gray-600 dark:text-gray-300">
						Quy trình này là bản sao riêng của tin, nên sửa ở đây không đụng tới quy trình mẫu trong
						cài đặt.
					</p>

					<div
						v-for="(row, index) in rows"
						:key="row.id ?? `new-${index}`"
						class="rounded-xl border border-gray-200 p-3 dark:border-gray-700"
					>
						<div class="flex flex-wrap items-start gap-3">
							<div class="flex flex-col gap-1 pt-6">
								<button
									type="button"
									class="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 dark:hover:bg-gray-800"
									:disabled="index === 0"
									aria-label="Lên trên"
									@click="move(index, -1)"
								>
									<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" />
									</svg>
								</button>
								<button
									type="button"
									class="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 dark:hover:bg-gray-800"
									:disabled="index === rows.length - 1"
									aria-label="Xuống dưới"
									@click="move(index, 1)"
								>
									<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
									</svg>
								</button>
							</div>

							<div class="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
								<div class="space-y-1">
									<label class="block text-xs font-medium text-gray-600 dark:text-gray-400">Tên vòng</label>
									<input
										v-model="row.name"
										type="text"
										maxlength="100"
										class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
									/>
								</div>
								<div class="space-y-1">
									<label class="block text-xs font-medium text-gray-600 dark:text-gray-400">Loại vòng</label>
									<UiSelect v-model="row.kind" :options="kindOptions" :disabled="locked(row)" />
									<p v-if="locked(row)" class="text-xs text-gray-500 dark:text-gray-400">
										Vòng đang có {{ row.activeCount }} hồ sơ nên không đổi loại được.
									</p>
								</div>
								<div class="space-y-1">
									<label class="block text-xs font-medium text-gray-600 dark:text-gray-400">
										Mẫu đánh giá
									</label>
									<UiSelect
										v-model="row.scorecardTemplateId"
										:options="scorecardOptionsFor(row.kind)"
									/>
								</div>
								<div class="space-y-1">
									<label class="block text-xs font-medium text-gray-600 dark:text-gray-400">
										Email tự gửi khi vào vòng
									</label>
									<UiSelect v-model="row.autoEmailTemplateId" :options="emailOptions" />
								</div>
							</div>

							<button
								type="button"
								class="mt-6 rounded-lg p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 dark:hover:bg-rose-900/20"
								:disabled="locked(row)"
								:title="locked(row) ? 'Vòng đang có hồ sơ nên không xoá được' : 'Xoá vòng'"
								aria-label="Xoá vòng"
								@click="removeStage(index)"
							>
								<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>
					</div>

					<CommonAppButton variant="outline" size="sm" @click="addStage">Thêm vòng</CommonAppButton>

					<p
						v-if="ruleError"
						class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
					>
						{{ ruleError }}
					</p>

					<p v-if="error" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
						{{ error }}
					</p>
				</div>

				<div class="flex justify-end gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
					<CommonAppButton variant="secondary" @click="emit('close')">Huỷ</CommonAppButton>
					<CommonAppButton variant="primary" :loading="submitting" :disabled="!!ruleError" @click="save">
						Lưu quy trình
					</CommonAppButton>
				</div>
			</div>
		</div>
	</Teleport>
</template>
