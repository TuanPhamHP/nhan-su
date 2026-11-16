<script setup lang="ts">
	import { PROFILE_CHANGE_SECTION_LABELS, type ProfileChangeSection } from '~/types/hr-profile.types';
	import { useMeProfileService } from '~/services/me-profile.service';

	/** Một ô trong form đề nghị, điền sẵn giá trị đang có trong hồ sơ. */
	export interface ChangeRequestField {
		key: string;
		label: string;
		type?: 'text' | 'date' | 'select';
		options?: { value: string; label: string }[];
		/** Giá trị hiện tại; ô nào người dùng không sửa thì không nằm trong đề nghị. */
		value: string;
		hint?: string;
	}

	/**
	 * Form đề nghị thay đổi một mục thông tin của chính mình (lô 3a).
	 *
	 * Chỉ gửi những ô người dùng thật sự sửa, vì server bỏ qua trường giống giá trị hiện tại và
	 * báo lỗi khi không còn gì khác. Gửi lại cho cùng một mục sẽ huỷ yêu cầu đang chờ trước đó,
	 * nên form luôn điền sẵn giá trị hiện tại để người dùng thấy mình đang đổi từ đâu sang đâu.
	 */
	const props = withDefaults(
		defineProps<{
			section: ProfileChangeSection;
			fields: ChangeRequestField[];
			/** Cho phép gửi kèm giấy tờ, ví dụ ảnh thẻ căn cước hay giấy xác nhận của ngân hàng. */
			allowDocuments?: boolean;
			submitting?: boolean;
		}>(),
		{ allowDocuments: false, submitting: false },
	);

	const emit = defineEmits<{
		submit: [payload: { after: Record<string, unknown>; documentIds: number[] }];
		close: [];
	}>();

	const toast = useToast();
	const meService = useMeProfileService();
	const { activeTypes, fetchTypes } = useEmployeeDocumentTypes();

	/** Giá trị đang hiện trong form, khoá theo `key` của từng ô. */
	const draft = reactive<Record<string, string>>({});
	const formError = ref<string | null>(null);

	const files = ref<File[]>([]);
	const documentTypeId = ref<number | undefined>(undefined);
	const uploading = ref(false);
	const uploadedIds = ref<number[]>([]);

	const MAX_DOCUMENTS = 5;

	onMounted(async () => {
		for (const f of props.fields) draft[f.key] = f.value;
		if (!props.allowDocuments) return;
		try {
			await fetchTypes();
		} catch {
			// Không tải được danh mục thì vẫn gửi được đề nghị, chỉ là không kèm giấy tờ.
		}
	});

	const documentTypeOptions = computed(() =>
		activeTypes.value.filter(t => t.employeeVisible).map(t => ({ value: t.id, label: t.name })),
	);

	const changed = computed(() =>
		props.fields.filter(f => (draft[f.key] ?? '').trim() !== (f.value ?? '').trim()),
	);

	async function submit() {
		formError.value = null;
		if (!changed.value.length) {
			formError.value = 'Bạn chưa sửa thông tin nào, nên chưa có gì để đề nghị.';
			return;
		}
		if (files.value.length > MAX_DOCUMENTS) {
			formError.value = `Mỗi đề nghị kèm được tối đa ${MAX_DOCUMENTS} giấy tờ.`;
			return;
		}
		let documentIds = uploadedIds.value;
		if (files.value.length && !documentIds.length) {
			if (!documentTypeId.value) {
				formError.value = 'Bạn chọn loại giấy tờ cho tệp đính kèm.';
				return;
			}
			uploading.value = true;
			try {
				// Tải từng tệp một, vì endpoint nhận mỗi lần một tệp. Giấy tờ ở trạng thái chờ,
				// chỉ hiện trong hồ sơ sau khi phòng nhân sự duyệt.
				const ids: number[] = [];
				for (const file of files.value) {
					const doc = await meService.uploadChangeRequestDocument(file, documentTypeId.value);
					ids.push(doc.id);
				}
				uploadedIds.value = ids;
				documentIds = ids;
			} catch (e) {
				toast.error(e instanceof Error ? e.message : 'Chưa tải được giấy tờ kèm theo.');
				return;
			} finally {
				uploading.value = false;
			}
		}

		const after: Record<string, unknown> = {};
		for (const f of changed.value) {
			const raw = (draft[f.key] ?? '').trim();
			after[f.key] = raw === '' ? null : raw;
		}
		emit('submit', { after, documentIds });
	}

	const inputCls =
		'block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm px-3 py-2.5 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500';
	const labelCls = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1';
</script>

<template>
	<Teleport to="body">
		<div
			class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
			@click.self="emit('close')"
		>
			<div
				class="my-8 w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
			>
				<div class="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-700">
					<h3 class="text-base font-semibold text-gray-900 dark:text-white">
						Đề nghị thay đổi: {{ PROFILE_CHANGE_SECTION_LABELS[section] }}
					</h3>
					<button
						type="button"
						class="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
						@click="emit('close')"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<form class="space-y-4 p-6" @submit.prevent="submit">
					<p class="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800 dark:bg-brand-900/20 dark:text-brand-200">
						Hồ sơ chỉ đổi sau khi phòng nhân sự duyệt. Bạn gửi lại đề nghị cho cùng một mục thì đề nghị đang chờ
						trước đó được huỷ, nên lần gửi sau cần ghi đủ mọi ô muốn đổi.
					</p>

					<div v-for="field in fields" :key="field.key">
						<template v-if="field.type === 'date'">
							<UiDatePicker v-model="draft[field.key]" :label="field.label" :hint="field.hint" />
						</template>
						<template v-else-if="field.type === 'select'">
							<label :class="labelCls">{{ field.label }}</label>
							<UiSelect v-model="draft[field.key]" :options="field.options ?? []" />
							<p v-if="field.hint" class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ field.hint }}</p>
						</template>
						<template v-else>
							<label :class="labelCls">{{ field.label }}</label>
							<input v-model="draft[field.key]" :class="inputCls" />
							<p v-if="field.hint" class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ field.hint }}</p>
						</template>
					</div>

					<div v-if="allowDocuments" class="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
						<p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
							Giấy tờ kèm theo
						</p>
						<div v-if="documentTypeOptions.length">
							<label :class="labelCls">Loại giấy tờ</label>
							<UiSelect
								v-model="documentTypeId"
								:options="documentTypeOptions"
								placeholder="-- Chọn loại giấy tờ --"
							/>
						</div>
						<UiFileDropzone
							v-model="files"
							multiple
							accept=".pdf,.docx,.jpg,.jpeg,.png"
							:max-size-mb="10"
							hint="Tối đa 5 tệp, mỗi tệp không quá 10MB. Giấy tờ chỉ vào hồ sơ sau khi đề nghị được duyệt."
						/>
					</div>

					<p v-if="formError" class="text-sm text-rose-600 dark:text-rose-400">{{ formError }}</p>

					<div class="flex justify-end gap-3 pt-1">
						<CommonAppButton type="button" variant="outline" @click="emit('close')">Hủy</CommonAppButton>
						<CommonAppButton type="submit" :loading="submitting || uploading">Gửi đề nghị</CommonAppButton>
					</div>
				</form>
			</div>
		</div>
	</Teleport>
</template>
