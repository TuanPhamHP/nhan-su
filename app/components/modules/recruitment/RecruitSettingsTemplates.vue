<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import RecruitChip from '~/components/modules/recruitment/RecruitChip.vue';
	import { recruitErrorMessage } from '~/utils/recruitment.utils';
	import {
		TEMPLATE_PURPOSES_CREATABLE,
		TEMPLATE_PURPOSE_LABELS,
		type RecruitmentTemplate,
		type RecruitmentTemplateKind,
		type RecruitmentTemplatePurpose,
		type RecruitmentTemplateVariables,
	} from '~/types/recruitment.types';

	/**
	 * Mẫu email gửi ứng viên và mẫu thư mời nhận việc.
	 *
	 * Biến trong mẫu viết dạng `{ten_bien}` và **mỗi mục đích có danh sách biến riêng**: dùng
	 * biến ngoài danh sách thì BE từ chối lưu. Vì vậy màn hình hiện sẵn các biến hợp lệ của
	 * mục đích đang chọn và cho chèn bằng một cú bấm, thay vì để người dùng gõ nhớ.
	 */
	const props = defineProps<{ canManage: boolean }>();

	const toast = useToast();
	const service = useRecruitmentService();

	const templates = ref<RecruitmentTemplate[]>([]);
	const variables = ref<RecruitmentTemplateVariables>({});
	const loading = ref(true);
	const error = ref<string | null>(null);

	const editing = ref<RecruitmentTemplate | null>(null);
	const creating = ref(false);

	const form = reactive({
		kind: 'EMAIL' as RecruitmentTemplateKind,
		purpose: 'CUSTOM' as RecruitmentTemplatePurpose,
		name: '',
		subject: '',
		body: '',
		isDefault: false,
		isActive: true,
	});
	const saving = ref(false);
	const formError = ref<string | null>(null);
	const bodyRef = ref<HTMLTextAreaElement>();

	async function load() {
		loading.value = true;
		error.value = null;
		try {
			const [list, vars] = await Promise.all([service.findTemplates(), service.templateVariables()]);
			templates.value = list;
			variables.value = vars;
		} catch (e) {
			error.value = recruitErrorMessage(e, 'Không tải được danh sách mẫu');
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);

	const purposeOptions = TEMPLATE_PURPOSES_CREATABLE.map(value => ({
		value,
		label: TEMPLATE_PURPOSE_LABELS[value],
	}));

	const isOfferLetter = computed(() => form.purpose === 'OFFER_LETTER');

	// Thư mời nhận việc và mẫu email là hai loại khác nhau, và BE bắt hai trường đi với nhau.
	watch(
		() => form.purpose,
		purpose => {
			form.kind = purpose === 'OFFER_LETTER' ? 'OFFER_LETTER' : 'EMAIL';
		},
	);

	const allowedVariables = computed(() => variables.value[form.purpose] ?? []);

	function startCreate() {
		editing.value = null;
		creating.value = true;
		formError.value = null;
		Object.assign(form, {
			kind: 'EMAIL' as RecruitmentTemplateKind,
			purpose: 'CUSTOM' as RecruitmentTemplatePurpose,
			name: '',
			subject: '',
			body: '',
			isDefault: false,
			isActive: true,
		});
	}

	function startEdit(template: RecruitmentTemplate) {
		creating.value = false;
		editing.value = template;
		formError.value = null;
		Object.assign(form, {
			kind: template.kind,
			purpose: template.purpose,
			name: template.name,
			subject: template.subject ?? '',
			body: template.body,
			isDefault: template.isDefault,
			isActive: template.isActive,
		});
	}

	function closeForm() {
		creating.value = false;
		editing.value = null;
	}

	/** Chèn biến vào đúng vị trí con trỏ trong ô nội dung. */
	function insertVariable(name: string) {
		const token = `{${name}}`;
		const el = bodyRef.value;
		if (!el) {
			form.body += token;
			return;
		}
		const start = el.selectionStart ?? form.body.length;
		const end = el.selectionEnd ?? start;
		form.body = form.body.slice(0, start) + token + form.body.slice(end);
		nextTick(() => {
			el.focus();
			el.setSelectionRange(start + token.length, start + token.length);
		});
	}

	async function save() {
		if (!form.name.trim()) {
			formError.value = 'Nhập tên mẫu';
			return;
		}
		if (!isOfferLetter.value && !form.subject.trim()) {
			formError.value = 'Mẫu email phải có tiêu đề';
			return;
		}
		if (!form.body.trim()) {
			formError.value = 'Nhập nội dung mẫu';
			return;
		}
		saving.value = true;
		formError.value = null;
		try {
			if (editing.value) {
				await service.updateTemplate(editing.value.id, {
					name: form.name.trim(),
					subject: isOfferLetter.value ? undefined : form.subject.trim(),
					body: form.body,
					isDefault: form.isDefault,
					isActive: form.isActive,
				});
			} else {
				await service.createTemplate({
					kind: form.kind,
					purpose: form.purpose,
					name: form.name.trim(),
					subject: isOfferLetter.value ? undefined : form.subject.trim(),
					body: form.body,
					isDefault: form.isDefault,
					isActive: form.isActive,
				});
			}
			toast.success('Đã lưu mẫu');
			closeForm();
			await load();
		} catch (e) {
			formError.value = recruitErrorMessage(e, 'Lưu mẫu thất bại');
		} finally {
			saving.value = false;
		}
	}

	const grouped = computed(() => ({
		EMAIL: templates.value.filter(t => t.kind === 'EMAIL'),
		OFFER_LETTER: templates.value.filter(t => t.kind === 'OFFER_LETTER'),
	}));
</script>

<template>
	<div class="space-y-5">
		<p v-if="error" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
			{{ error }}
		</p>

		<div v-if="loading" class="space-y-3">
			<div v-for="i in 3" :key="i" class="h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
		</div>

		<template v-else>
			<div class="flex flex-wrap items-center justify-between gap-2">
				<p class="text-sm text-gray-600 dark:text-gray-300">
					Mỗi mục đích có một mẫu mặc định; hệ thống dùng mẫu đó khi gửi tự động. Không xoá được mẫu,
					chỉ ngừng dùng.
				</p>
				<CommonAppButton v-if="canManage" variant="outline" size="sm" @click="startCreate">
					Thêm mẫu
				</CommonAppButton>
			</div>

			<section v-for="(list, kind) in grouped" :key="kind" class="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
				<h3 class="text-sm font-semibold text-gray-900 dark:text-white">
					{{ kind === 'EMAIL' ? 'Mẫu email' : 'Mẫu thư mời nhận việc' }}
				</h3>

				<p v-if="!list.length" class="mt-2 text-sm text-gray-500 dark:text-gray-400">Chưa có mẫu nào.</p>

				<ul v-else class="mt-3 space-y-2">
					<li
						v-for="template in list"
						:key="template.id"
						class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-800"
					>
						<div class="min-w-0">
							<p class="text-sm font-medium text-gray-900 dark:text-white">{{ template.name }}</p>
							<p class="text-xs text-gray-400">
								{{ template.purposeLabel }}
								<template v-if="template.subject"> · {{ template.subject }}</template>
							</p>
						</div>
						<div class="flex items-center gap-2">
							<RecruitChip
								v-if="template.isDefault"
								label="Mặc định"
								tone="bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300"
							/>
							<RecruitChip
								v-if="!template.isActive"
								label="Ngừng dùng"
								tone="bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
							/>
							<button
								v-if="canManage"
								type="button"
								class="text-xs text-brand-600 hover:underline dark:text-brand-400"
								@click="startEdit(template)"
							>
								Sửa
							</button>
						</div>
					</li>
				</ul>
			</section>
		</template>

		<Teleport to="body">
			<div
				v-if="creating || editing"
				class="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/50 p-4"
			>
				<div class="my-8 w-full max-w-2xl rounded-2xl bg-white shadow-xl dark:bg-gray-900">
					<div class="flex items-start justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">
							{{ editing ? 'Sửa mẫu' : 'Thêm mẫu' }}
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

					<form class="max-h-[70vh] space-y-4 overflow-y-auto p-6" @submit.prevent="save">
						<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<div class="space-y-1">
								<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
									Mục đích <span class="text-red-500">*</span>
								</label>
								<UiSelect v-model="form.purpose" :options="purposeOptions" :disabled="!!editing" />
								<p v-if="editing" class="text-xs text-gray-500 dark:text-gray-400">
									Mục đích của mẫu đã tạo không đổi được.
								</p>
							</div>

							<div class="space-y-1">
								<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
									Tên mẫu <span class="text-red-500">*</span>
								</label>
								<input
									v-model="form.name"
									type="text"
									maxlength="150"
									class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
								/>
							</div>

							<div v-if="!isOfferLetter" class="space-y-1 sm:col-span-2">
								<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
									Tiêu đề <span class="text-red-500">*</span>
								</label>
								<input
									v-model="form.subject"
									type="text"
									maxlength="300"
									class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
								/>
							</div>

							<div class="space-y-1 sm:col-span-2">
								<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
									Nội dung <span class="text-red-500">*</span>
								</label>
								<textarea
									ref="bodyRef"
									v-model="form.body"
									rows="10"
									maxlength="50000"
									class="w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
								/>
								<p class="text-xs text-gray-500 dark:text-gray-400">
									{{
										isOfferLetter
											? 'Thư mời là văn bản thường, hệ thống tự dựng thành PDF.'
											: 'Nội dung email viết bằng HTML.'
									}}
								</p>
							</div>

							<div v-if="allowedVariables.length" class="space-y-1 sm:col-span-2">
								<p class="text-xs font-medium text-gray-600 dark:text-gray-400">
									Biến dùng được cho mục đích này
								</p>
								<div class="flex flex-wrap gap-1.5">
									<button
										v-for="name in allowedVariables"
										:key="name"
										type="button"
										class="rounded-full border border-gray-300 px-2.5 py-1 font-mono text-xs text-gray-600 transition-colors hover:border-brand-400 hover:text-brand-600 dark:border-gray-600 dark:text-gray-300"
										@click="insertVariable(name)"
									>
										{{ '{' + name + '}' }}
									</button>
								</div>
								<p class="text-xs text-gray-500 dark:text-gray-400">
									Dùng biến ngoài danh sách này thì hệ thống từ chối lưu.
								</p>
							</div>

							<label class="flex items-center gap-2">
								<input
									v-model="form.isDefault"
									type="checkbox"
									class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
								/>
								<span class="text-sm text-gray-700 dark:text-gray-300">
									Dùng làm mẫu mặc định của mục đích này
								</span>
							</label>

							<label class="flex items-center gap-2">
								<input
									v-model="form.isActive"
									type="checkbox"
									class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
								/>
								<span class="text-sm text-gray-700 dark:text-gray-300">Đang dùng</span>
							</label>
						</div>

						<p
							v-if="formError"
							class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300"
						>
							{{ formError }}
						</p>

						<div class="flex justify-end gap-3 pt-1">
							<CommonAppButton variant="secondary" type="button" @click="closeForm">Huỷ</CommonAppButton>
							<CommonAppButton variant="primary" type="submit" :loading="saving">Lưu mẫu</CommonAppButton>
						</div>
					</form>
				</div>
			</div>
		</Teleport>
	</div>
</template>
