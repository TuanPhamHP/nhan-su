<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import RecruitChip from '~/components/modules/recruitment/RecruitChip.vue';
	import { recruitErrorMessage, toRecruitNumber } from '~/utils/recruitment.utils';
	import {
		SCORECARD_KIND_LABELS,
		type CriterionInput,
		type RecruitmentScorecardKind,
		type ScorecardTemplate,
	} from '~/types/recruitment.types';

	/**
	 * Mẫu đánh giá: phiếu phỏng vấn chấm theo tiêu chí có trọng số, phiếu thi nhập điểm từng
	 * môn theo điểm tối đa và điểm đạt.
	 *
	 * Lưu bằng `PUT` thay toàn bộ. Tiêu chí bị bỏ khỏi danh sách KHÔNG bị xoá mà chỉ ngừng
	 * dùng, vì phiếu cũ còn trỏ tới nó; response sau đó không trả tiêu chí đó nữa. Giữ `id`
	 * của tiêu chí đang có để điểm cũ vẫn gắn đúng chỗ.
	 */
	const props = defineProps<{ canManage: boolean }>();

	const toast = useToast();
	const service = useRecruitmentService();

	const templates = ref<ScorecardTemplate[]>([]);
	const loading = ref(true);
	const error = ref<string | null>(null);

	const editing = ref<ScorecardTemplate | null>(null);
	const creating = ref(false);
	const name = ref('');
	const kind = ref<RecruitmentScorecardKind>('INTERVIEW');
	const isActive = ref(true);
	const rows = ref<CriterionInput[]>([]);
	const saving = ref(false);
	const formError = ref<string | null>(null);

	async function load() {
		loading.value = true;
		error.value = null;
		try {
			templates.value = await service.findScorecardTemplates();
		} catch (e) {
			error.value = recruitErrorMessage(e, 'Không tải được mẫu đánh giá');
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);

	const kindOptions = Object.entries(SCORECARD_KIND_LABELS).map(([value, label]) => ({
		value,
		label,
	}));

	const isTest = computed(() => kind.value === 'TEST');

	function startCreate() {
		editing.value = null;
		creating.value = true;
		formError.value = null;
		name.value = '';
		kind.value = 'INTERVIEW';
		isActive.value = true;
		rows.value = [{ name: 'Chuyên môn', weight: 1 }];
	}

	function startEdit(template: ScorecardTemplate) {
		creating.value = false;
		editing.value = template;
		formError.value = null;
		name.value = template.name;
		kind.value = template.kind;
		isActive.value = template.isActive;
		rows.value = template.criteria.map(c => ({
			id: c.id,
			name: c.name,
			description: c.description ?? undefined,
			weight: c.weight,
			maxScore: c.maxScore ?? undefined,
			passScore: c.passScore ?? undefined,
		}));
	}

	function closeForm() {
		creating.value = false;
		editing.value = null;
	}

	function addRow() {
		rows.value.push(isTest.value ? { name: 'Môn mới', maxScore: 10 } : { name: 'Tiêu chí mới', weight: 1 });
	}

	const ruleError = computed(() => {
		if (!rows.value.length || rows.value.length > 30) return 'Mẫu phải có từ 1 đến 30 tiêu chí';
		if (rows.value.some(r => !r.name.trim())) return 'Mỗi tiêu chí phải có tên';
		if (isTest.value) {
			for (const r of rows.value) {
				const max = toRecruitNumber(r.maxScore);
				if (max == null || max <= 0) return `Môn "${r.name}" phải có điểm tối đa`;
				const pass = toRecruitNumber(r.passScore);
				if (pass != null && pass > max) return `Điểm đạt của "${r.name}" không được lớn hơn điểm tối đa`;
			}
		}
		return null;
	});

	async function save() {
		if (!name.value.trim()) {
			formError.value = 'Nhập tên mẫu';
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
				kind: kind.value,
				isActive: isActive.value,
				criteria: rows.value.map(r => ({
					id: r.id,
					name: r.name.trim(),
					description: r.description?.trim() || undefined,
					weight: isTest.value ? undefined : (toRecruitNumber(r.weight) ?? 1),
					maxScore: isTest.value ? toRecruitNumber(r.maxScore) : undefined,
					passScore: isTest.value ? toRecruitNumber(r.passScore) : undefined,
				})),
			};
			if (editing.value) await service.saveScorecardTemplate(editing.value.id, body);
			else await service.createScorecardTemplate(body);
			toast.success('Đã lưu mẫu đánh giá');
			closeForm();
			await load();
		} catch (e) {
			formError.value = recruitErrorMessage(e, 'Lưu mẫu đánh giá thất bại');
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
			<div v-for="i in 2" :key="i" class="h-20 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
		</div>

		<template v-else>
			<div class="flex flex-wrap items-center justify-between gap-2">
				<p class="text-sm text-gray-600 dark:text-gray-300">
					Mẫu phỏng vấn dùng cho vòng Sơ loại và Phỏng vấn, chấm từng tiêu chí từ 1 đến 5 có trọng số.
					Mẫu thi dùng cho vòng Thi tuyển, nhập điểm từng môn.
				</p>
				<CommonAppButton v-if="canManage" variant="outline" size="sm" @click="startCreate">
					Thêm mẫu
				</CommonAppButton>
			</div>

			<p v-if="!templates.length" class="text-sm text-gray-500 dark:text-gray-400">
				Chưa có mẫu đánh giá nào. Thiếu mẫu thì đặt lịch phỏng vấn vẫn chạy nhưng không ai có phiếu để
				chấm.
			</p>

			<ul v-else class="space-y-3">
				<li
					v-for="template in templates"
					:key="template.id"
					class="rounded-xl border border-gray-200 p-4 dark:border-gray-700"
				>
					<div class="flex flex-wrap items-center justify-between gap-2">
						<div class="flex flex-wrap items-center gap-2">
							<p class="text-sm font-medium text-gray-900 dark:text-white">{{ template.name }}</p>
							<RecruitChip
								:label="template.kindLabel"
								tone="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
							/>
							<RecruitChip
								v-if="!template.isActive"
								label="Ngừng dùng"
								tone="bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
							/>
						</div>
						<button
							v-if="canManage"
							type="button"
							class="text-xs text-brand-600 hover:underline dark:text-brand-400"
							@click="startEdit(template)"
						>
							Sửa
						</button>
					</div>

					<div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
						<span v-for="c in template.criteria" :key="c.id">
							{{ c.name }}
							<template v-if="c.maxScore != null">(tối đa {{ c.maxScore }})</template>
							<template v-else-if="c.weight > 1">(hệ số {{ c.weight }})</template>
						</span>
					</div>
				</li>
			</ul>
		</template>

		<Teleport to="body">
			<div
				v-if="creating || editing"
				class="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/50 p-4"
			>
				<div class="my-8 w-full max-w-2xl rounded-2xl bg-white shadow-xl dark:bg-gray-900">
					<div class="flex items-start justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">
							{{ editing ? 'Sửa mẫu đánh giá' : 'Thêm mẫu đánh giá' }}
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
									Tên mẫu <span class="text-red-500">*</span>
								</label>
								<input
									v-model="name"
									type="text"
									maxlength="150"
									class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
								/>
							</div>
							<div class="space-y-1">
								<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Loại mẫu</label>
								<UiSelect v-model="kind" :options="kindOptions" :disabled="!!editing" />
								<p v-if="editing" class="text-xs text-gray-500 dark:text-gray-400">
									Loại của mẫu đã tạo không đổi được.
								</p>
							</div>
						</div>

						<label class="flex items-center gap-2">
							<input
								v-model="isActive"
								type="checkbox"
								class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
							/>
							<span class="text-sm text-gray-700 dark:text-gray-300">Đang dùng</span>
						</label>

						<div
							v-for="(row, index) in rows"
							:key="row.id ?? `new-${index}`"
							class="rounded-xl border border-gray-200 p-3 dark:border-gray-700"
						>
							<div class="grid grid-cols-1 gap-3 sm:grid-cols-4">
								<div class="space-y-1 sm:col-span-2">
									<label class="block text-xs font-medium text-gray-600 dark:text-gray-400">
										{{ isTest ? 'Tên môn' : 'Tên tiêu chí' }}
									</label>
									<input
										v-model="row.name"
										type="text"
										maxlength="150"
										class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
									/>
								</div>

								<template v-if="isTest">
									<div class="space-y-1">
										<label class="block text-xs font-medium text-gray-600 dark:text-gray-400">Điểm tối đa</label>
										<input
											v-model="row.maxScore"
											type="number"
											min="0.5"
											max="1000"
											step="0.5"
											class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
										/>
									</div>
									<div class="space-y-1">
										<label class="block text-xs font-medium text-gray-600 dark:text-gray-400">Điểm đạt</label>
										<input
											v-model="row.passScore"
											type="number"
											min="0"
											max="1000"
											step="0.5"
											class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
										/>
									</div>
								</template>

								<div v-else class="space-y-1">
									<label class="block text-xs font-medium text-gray-600 dark:text-gray-400">Trọng số</label>
									<input
										v-model="row.weight"
										type="number"
										min="1"
										max="10"
										step="1"
										class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
									/>
								</div>

								<div class="flex items-end justify-end">
									<button
										type="button"
										class="rounded-lg p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20"
										aria-label="Bỏ tiêu chí"
										@click="rows.splice(index, 1)"
									>
										<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
											<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
										</svg>
									</button>
								</div>

								<div class="space-y-1 sm:col-span-4">
									<label class="block text-xs font-medium text-gray-600 dark:text-gray-400">Mô tả</label>
									<input
										v-model="row.description"
										type="text"
										maxlength="1000"
										placeholder="Người chấm đọc dòng này để hiểu tiêu chí"
										class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
									/>
								</div>
							</div>
						</div>

						<CommonAppButton variant="outline" size="sm" @click="addRow">
							{{ isTest ? 'Thêm môn' : 'Thêm tiêu chí' }}
						</CommonAppButton>

						<p class="text-xs text-gray-500 dark:text-gray-400">
							Bỏ một tiêu chí khỏi danh sách chỉ làm nó ngừng dùng, phiếu cũ vẫn giữ điểm đã chấm cho
							tiêu chí đó.
						</p>

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
							Lưu mẫu
						</CommonAppButton>
					</div>
				</div>
			</div>
		</Teleport>
	</div>
</template>
