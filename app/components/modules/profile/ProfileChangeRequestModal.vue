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
		/**
		 * Trường hồ sơ bắt buộc phải có giá trị, ví dụ họ tên hay email công việc.
		 *
		 * Xoá trắng ô này nghĩa là gửi `null` lên server, và server trả 400. Chặn ngay tại form
		 * để người dùng đọc được câu nhắc thay vì một lỗi chung chung sau khi bấm gửi.
		 */
		required?: boolean;
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
	/** Giấy tờ đã tải lên trong lượt mở form này, theo thứ tự người dùng chọn. */
	const attachments = ref<{ id: number; fileName: string }[]>([]);
	const removingId = ref<number | null>(null);

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

	/**
	 * Những ô người dùng thật sự sửa.
	 *
	 * Với mục ngân hàng, thuế, căn cước và thân nhân thì server không còn trả
	 * `PROFILE_CHANGE_NO_DIFF` nữa, nên đây là chỗ duy nhất phát hiện "chưa đổi gì". Giá trị đem
	 * so là giá trị vừa lấy từ `POST /me/profile/private`, không phải giá trị trong yêu cầu cũ,
	 * vì yêu cầu cũ đã bị che.
	 */
	const changed = computed(() =>
		props.fields.filter(f => (draft[f.key] ?? '').trim() !== (f.value ?? '').trim()),
	);

	/**
	 * Tải ngay từng tệp người dùng vừa chọn.
	 *
	 * Tải lúc chọn chứ không đợi lúc gửi, để người dùng bỏ được một tệp đã tải (gọi DELETE) và
	 * để lỗi, ví dụ chạm trần 10 giấy tờ chờ, hiện ra đúng lúc họ vừa chọn. Endpoint nhận mỗi
	 * lần một tệp nên phải tải lần lượt.
	 */
	async function onFilesPicked(picked: File | File[] | null) {
		const list = Array.isArray(picked) ? picked : picked ? [picked] : [];
		files.value = [];
		if (!list.length) return;
		formError.value = null;
		if (!documentTypeId.value) {
			formError.value = 'Bạn chọn loại giấy tờ trước khi tải tệp lên.';
			return;
		}
		if (attachments.value.length + list.length > MAX_DOCUMENTS) {
			formError.value = `Mỗi đề nghị kèm được tối đa ${MAX_DOCUMENTS} giấy tờ.`;
			return;
		}
		uploading.value = true;
		try {
			for (const file of list) {
				const doc = await meService.uploadChangeRequestDocument(file, documentTypeId.value);
				attachments.value = [...attachments.value, { id: doc.id, fileName: doc.fileName }];
			}
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa tải được giấy tờ kèm theo.');
		} finally {
			uploading.value = false;
		}
	}

	/** Bỏ một giấy tờ đã tải: xoá luôn trên máy chủ để không chiếm chỗ trong trần 10 giấy tờ chờ. */
	async function removeAttachment(id: number) {
		removingId.value = id;
		try {
			await meService.removeChangeRequestDocument(id);
			attachments.value = attachments.value.filter(a => a.id !== id);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa bỏ được giấy tờ này.');
		} finally {
			removingId.value = null;
		}
	}

	/**
	 * Đóng form khi chưa gửi: dọn những giấy tờ vừa tải trong lượt này.
	 *
	 * Cố gắng hết sức rồi thôi: người dùng đã đóng form, báo lỗi dọn dẹp chỉ làm họ bối rối, và
	 * máy chủ cũng tự dọn giấy tờ chờ quá 24 giờ.
	 */
	async function closeForm() {
		const pending = attachments.value.map(a => a.id);
		attachments.value = [];
		emit('close');
		for (const id of pending) {
			try {
				await meService.removeChangeRequestDocument(id);
			} catch {
				// Bỏ qua: máy chủ sẽ tự dọn sau 24 giờ.
			}
		}
	}

	async function submit() {
		formError.value = null;
		const emptyRequired = props.fields.find(f => f.required && !(draft[f.key] ?? '').trim());
		if (emptyRequired) {
			formError.value = `Bạn điền ${emptyRequired.label.toLowerCase()}, đây là thông tin bắt buộc của hồ sơ.`;
			return;
		}
		if (!changed.value.length) {
			formError.value = 'Bạn chưa sửa thông tin nào, nên chưa có gì để đề nghị.';
			return;
		}

		const after: Record<string, unknown> = {};
		for (const f of changed.value) {
			const raw = (draft[f.key] ?? '').trim();
			after[f.key] = raw === '' ? null : raw;
		}
		// Giữ nguyên danh sách giấy tờ: gửi hỏng thì người dùng sửa rồi gửi lại vẫn còn đúng các
		// tệp đó. Gửi được thì nơi gọi đóng form, component rời màn hình mà không chạy phần dọn,
		// nên giấy tờ ở lại với yêu cầu như mong muốn.
		emit('submit', { after, documentIds: attachments.value.map(a => a.id) });
	}

	const inputCls =
		'block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm px-3 py-2.5 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500';
	const labelCls = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1';
</script>

<template>
	<Teleport to="body">
		<div
			class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
			@click.self="closeForm"
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
						@click="closeForm"
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
							<label :class="labelCls">
								{{ field.label }}
								<span v-if="field.required" class="text-red-500">*</span>
							</label>
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

						<!-- Tệp được tải lên ngay lúc chọn, nên danh sách dưới đây là giấy tờ đã nằm
						     trên máy chủ; bỏ một dòng là xoá thật. -->
						<ul v-if="attachments.length" class="space-y-2">
							<li
								v-for="item in attachments"
								:key="item.id"
								class="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800"
							>
								<span class="min-w-0 truncate text-sm text-gray-800 dark:text-gray-100">{{ item.fileName }}</span>
								<button
									type="button"
									class="flex-shrink-0 rounded-md px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
									:disabled="removingId === item.id"
									@click="removeAttachment(item.id)"
								>
									{{ removingId === item.id ? 'Đang bỏ…' : 'Bỏ' }}
								</button>
							</li>
						</ul>

						<UiFileDropzone
							:model-value="files"
							multiple
							accept=".pdf,.docx,.jpg,.jpeg,.png"
							:max-size-mb="10"
							:disabled="uploading || attachments.length >= 5"
							hint="Tối đa 5 tệp, mỗi tệp không quá 10MB. Tệp được tải lên ngay khi chọn, và chỉ vào hồ sơ sau khi đề nghị được duyệt."
							@update:model-value="onFilesPicked"
						/>
						<p v-if="uploading" class="text-xs text-gray-500 dark:text-gray-400">Đang tải tệp lên…</p>
					</div>

					<p v-if="formError" class="text-sm text-rose-600 dark:text-rose-400">{{ formError }}</p>

					<div class="flex justify-end gap-3 pt-1">
						<CommonAppButton type="button" variant="outline" @click="closeForm">Hủy</CommonAppButton>
						<CommonAppButton type="submit" :loading="submitting || uploading">Gửi đề nghị</CommonAppButton>
					</div>
				</form>
			</div>
		</div>
	</Teleport>
</template>
