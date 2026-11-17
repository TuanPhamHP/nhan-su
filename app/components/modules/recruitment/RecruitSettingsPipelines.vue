<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import RecruitChip from '~/components/modules/recruitment/RecruitChip.vue';
	import { recruitErrorMessage } from '~/utils/recruitment.utils';
	import {
		STAGE_KIND_LABELS,
		type PipelineTemplate,
		type RecruitmentScorecardKind,
		type RecruitmentStageKind,
		type RecruitmentTemplate,
		type ScorecardTemplate,
		type StageInput,
	} from '~/types/recruitment.types';

	/**
	 * Quy trình mẫu: danh sách vòng dùng để tạo tin.
	 *
	 * Tin đã tạo giữ một BẢN SAO của quy trình, nên sửa ở đây không làm thay đổi tin nào đang
	 * chạy. Lưu bằng `PUT` thay toàn bộ, và id của từng vòng đổi sau mỗi lần lưu — không sao,
	 * vì không có gì khác trỏ vào id của vòng trong quy trình mẫu.
	 */
	const props = defineProps<{ canManage: boolean }>();

	const toast = useToast();
	const service = useRecruitmentService();

	const pipelines = ref<PipelineTemplate[]>([]);
	const scorecardTemplates = ref<ScorecardTemplate[]>([]);
	const emailTemplates = ref<RecruitmentTemplate[]>([]);
	const loading = ref(true);
	const error = ref<string | null>(null);

	const editing = ref<PipelineTemplate | null>(null);
	const creating = ref(false);
	const name = ref('');
	const isDefault = ref(false);
	const isActive = ref(true);
	const rows = ref<StageInput[]>([]);
	const saving = ref(false);
	const formError = ref<string | null>(null);

	async function load() {
		loading.value = true;
		error.value = null;
		try {
			const [list, cards, templates] = await Promise.all([
				service.findPipelineTemplates(),
				service.findScorecardTemplates(true),
				service.findTemplates('EMAIL'),
			]);
			pipelines.value = list;
			scorecardTemplates.value = cards;
			emailTemplates.value = templates.filter(t => t.isActive);
		} catch (e) {
			error.value = recruitErrorMessage(e, 'Không tải được quy trình mẫu');
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);

	const kindOptions = Object.entries(STAGE_KIND_LABELS).map(([value, label]) => ({ value, label }));

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

	/** Khung mặc định cho quy trình mới, đã đúng luật vòng của hệ thống. */
	function defaultStages(): StageInput[] {
		return [
			{ name: 'Ứng tuyển', kind: 'APPLIED' },
			{ name: 'Sơ loại', kind: 'SCREENING' },
			{ name: 'Phỏng vấn', kind: 'INTERVIEW' },
			{ name: 'Offer', kind: 'OFFER' },
			{ name: 'Đã tuyển', kind: 'HIRED' },
		];
	}

	function startCreate() {
		editing.value = null;
		creating.value = true;
		formError.value = null;
		name.value = '';
		isDefault.value = false;
		isActive.value = true;
		rows.value = defaultStages();
	}

	function startEdit(pipeline: PipelineTemplate) {
		creating.value = false;
		editing.value = pipeline;
		formError.value = null;
		name.value = pipeline.name;
		isDefault.value = pipeline.isDefault;
		isActive.value = pipeline.isActive;
		rows.value = pipeline.stages.map(s => ({
			name: s.name,
			kind: s.kind,
			scorecardTemplateId: s.scorecardTemplateId ?? undefined,
			autoEmailTemplateId: s.autoEmailTemplateId ?? undefined,
		}));
	}

	function closeForm() {
		creating.value = false;
		editing.value = null;
	}

	function addStage() {
		const offerIndex = rows.value.findIndex(r => r.kind === 'OFFER');
		const at = offerIndex >= 0 ? offerIndex : Math.max(rows.value.length - 1, 0);
		rows.value.splice(at, 0, { name: 'Vòng mới', kind: 'INTERVIEW' });
	}

	function move(index: number, delta: number) {
		const to = index + delta;
		if (to < 0 || to >= rows.value.length) return;
		const [row] = rows.value.splice(index, 1);
		if (row) rows.value.splice(to, 0, row);
	}

	const ruleError = computed(() => {
		const list = rows.value;
		if (list.length < 3 || list.length > 20) return 'Một quy trình phải có từ 3 đến 20 vòng';
		const count = (kind: RecruitmentStageKind) => list.filter(r => r.kind === kind).length;
		if (count('APPLIED') !== 1) return 'Phải có đúng một vòng loại Ứng tuyển';
		if (count('OFFER') !== 1) return 'Phải có đúng một vòng loại Offer';
		if (count('HIRED') !== 1) return 'Phải có đúng một vòng loại Đã tuyển';
		if (list[0]?.kind !== 'APPLIED') return 'Vòng đầu tiên phải là loại Ứng tuyển';
		if (list[list.length - 1]?.kind !== 'HIRED') return 'Vòng cuối cùng phải là loại Đã tuyển';
		if (list.findIndex(r => r.kind === 'OFFER') > list.findIndex(r => r.kind === 'HIRED')) {
			return 'Vòng Offer phải đứng trước vòng Đã tuyển';
		}
		if (list.some(r => !r.name.trim())) return 'Mỗi vòng phải có tên';
		return null;
	});

	async function save() {
		if (!name.value.trim()) {
			formError.value = 'Nhập tên quy trình';
			return;
		}
		if (ruleError.value) {
			formError.value = ruleError.value;
			return;
		}
		saving.value = true;
		formError.value = null;
		try {
			const body = {
				name: name.value.trim(),
				isDefault: isDefault.value,
				isActive: isActive.value,
				stages: rows.value.map(r => ({
					name: r.name.trim(),
					kind: r.kind,
					scorecardTemplateId: r.scorecardTemplateId,
					autoEmailTemplateId: r.autoEmailTemplateId,
				})),
			};
			if (editing.value) await service.savePipelineTemplate(editing.value.id, body);
			else await service.createPipelineTemplate(body);
			toast.success('Đã lưu quy trình mẫu');
			closeForm();
			await load();
		} catch (e) {
			formError.value = recruitErrorMessage(e, 'Lưu quy trình mẫu thất bại');
		} finally {
			saving.value = false;
		}
	}
</script>

<template>
	<div class="space-y-5">
		<p v-if="error" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
			{{ error }}
		</p>

		<div v-if="loading" class="space-y-3">
			<div v-for="i in 2" :key="i" class="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
		</div>

		<template v-else>
			<div class="flex flex-wrap items-center justify-between gap-2">
				<p class="text-sm text-gray-600 dark:text-gray-300">
					Tạo tin mới sẽ chép quy trình mẫu vào tin, nên sửa ở đây không ảnh hưởng tin đang chạy.
				</p>
				<CommonAppButton v-if="canManage" variant="outline" size="sm" @click="startCreate">
					Thêm quy trình
				</CommonAppButton>
			</div>

			<p v-if="!pipelines.length" class="text-sm text-gray-500 dark:text-gray-400">
				Chưa có quy trình mẫu nào. Phải có ít nhất một quy trình đang dùng thì mới tạo được tin.
			</p>

			<ul v-else class="space-y-3">
				<li
					v-for="pipeline in pipelines"
					:key="pipeline.id"
					class="rounded-xl border border-gray-200 p-4 dark:border-gray-700"
				>
					<div class="flex flex-wrap items-center justify-between gap-2">
						<div class="flex flex-wrap items-center gap-2">
							<p class="text-sm font-medium text-gray-900 dark:text-white">{{ pipeline.name }}</p>
							<RecruitChip
								v-if="pipeline.isDefault"
								label="Mặc định"
								tone="bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300"
							/>
							<RecruitChip
								v-if="!pipeline.isActive"
								label="Ngừng dùng"
								tone="bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
							/>
						</div>
						<button
							v-if="canManage"
							type="button"
							class="text-xs text-brand-600 hover:underline dark:text-brand-400"
							@click="startEdit(pipeline)"
						>
							Sửa
						</button>
					</div>

					<div class="mt-2 flex flex-wrap items-center gap-1.5">
						<template v-for="(stage, index) in pipeline.stages" :key="stage.id">
							<span
								class="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300"
							>
								{{ stage.name }}
							</span>
							<span v-if="index < pipeline.stages.length - 1" class="text-xs text-gray-300">→</span>
						</template>
					</div>
				</li>
			</ul>
		</template>

		<Teleport to="body">
			<div
				v-if="creating || editing"
				class="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/50 p-4"
			>
				<div class="my-8 w-full max-w-3xl rounded-2xl bg-white shadow-xl dark:bg-gray-900">
					<div class="flex items-start justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">
							{{ editing ? 'Sửa quy trình mẫu' : 'Thêm quy trình mẫu' }}
						</h2>
						<button
							type="button"
							class="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
							aria-label="Đóng"
							@click="closeForm"
						>
							<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>

					<div class="max-h-[70vh] space-y-4 overflow-y-auto p-6">
						<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
							<div class="space-y-1 sm:col-span-2">
								<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
									Tên quy trình <span class="text-red-500">*</span>
								</label>
								<input
									v-model="name"
									type="text"
									maxlength="150"
									class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
								/>
							</div>
							<div class="space-y-2 pt-6">
								<label class="flex items-center gap-2">
									<input
										v-model="isDefault"
										type="checkbox"
										class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
									/>
									<span class="text-sm text-gray-700 dark:text-gray-300">Mặc định</span>
								</label>
								<label class="flex items-center gap-2">
									<input
										v-model="isActive"
										type="checkbox"
										class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
									/>
									<span class="text-sm text-gray-700 dark:text-gray-300">Đang dùng</span>
								</label>
							</div>
						</div>

						<div
							v-for="(row, index) in rows"
							:key="index"
							class="rounded-xl border border-gray-200 p-3 dark:border-gray-700"
						>
							<div class="flex flex-wrap items-start gap-3">
								<div class="flex flex-col gap-1 pt-6">
									<button
										type="button"
										class="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-800"
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
										class="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-800"
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
										<UiSelect v-model="row.kind" :options="kindOptions" />
									</div>
									<div class="space-y-1">
										<label class="block text-xs font-medium text-gray-600 dark:text-gray-400">Mẫu đánh giá</label>
										<UiSelect v-model="row.scorecardTemplateId" :options="scorecardOptionsFor(row.kind)" />
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
									class="mt-6 rounded-lg p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20"
									aria-label="Xoá vòng"
									@click="rows.splice(index, 1)"
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

						<p
							v-if="formError"
							class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300"
						>
							{{ formError }}
						</p>
					</div>

					<div class="flex justify-end gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
						<CommonAppButton variant="secondary" @click="closeForm">Huỷ</CommonAppButton>
						<CommonAppButton variant="primary" :loading="saving" :disabled="!!ruleError" @click="save">
							Lưu quy trình
						</CommonAppButton>
					</div>
				</div>
			</div>
		</Teleport>
	</div>
</template>
