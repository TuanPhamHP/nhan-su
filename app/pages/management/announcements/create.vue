<script setup lang="ts">
	import TiptapEditor from '~/components/common/TiptapEditor.vue';
	import AnnouncementPreviewModal from '~/components/modules/announcement/AnnouncementPreviewModal.vue';
	import { useCompanyAnnouncements } from '~/composables/useCompanyAnnouncements';
	import { useDirectoryStore } from '~/stores/directory';
	import {
		ANNOUNCEMENT_TYPE_CONFIG,
		type AnnouncementLink,
		type AnnouncementType,
	} from '~/types/announcement.types';

	interface RecipientOption {
		id: number;
		fullName: string;
		departmentId: number | null;
	}

	definePageMeta({ title: 'Tạo thông báo công ty' });

	const toast = useToast();
	const router = useRouter();
	const { create, uploadInlineMedia } = useCompanyAnnouncements();
	const directoryStore = useDirectoryStore();
	const { departments, employees: directoryEmployees, loading: directoryLoading } = storeToRefs(directoryStore);

	const MAX_FILES = 5;
	const MAX_FILE_SIZE = 20 * 1024 * 1024;
	const MAX_TOTAL_SIZE = 100 * 1024 * 1024;
	const MAX_LINKS = 5;
	const ACCEPTED_MIMES = [
		'image/jpeg',
		'image/png',
		'application/pdf',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	];

	interface FormState {
		title: string;
		body: string;
		announcementType: AnnouncementType;
		links: AnnouncementLink[];
	}

	const form = reactive<FormState>({
		title: '',
		body: '',
		announcementType: 'GENERAL',
		links: [],
	});

	const attachmentFiles = ref<File[]>([]);
	const { getUrl: getImagePreviewUrl, isImage: isImageFile } = useFileImagePreviews(attachmentFiles);
	const sendToAll = ref(true);
	const selectedIds = ref<Set<number>>(new Set());
	const searchTerm = ref('');
	const showPreview = ref(false);
	const submitting = ref(false);

	const recipients = computed<RecipientOption[]>(() =>
		directoryEmployees.value.map(e => ({
			id: e.id,
			fullName: e.fullName,
			departmentId: e.department?.id ?? null,
		})),
	);
	const recipientsLoading = computed(() => directoryLoading.value && recipients.value.length === 0);

	const typeOptions = computed(() =>
		(Object.keys(ANNOUNCEMENT_TYPE_CONFIG) as AnnouncementType[]).map(key => ({
			value: key,
			label: ANNOUNCEMENT_TYPE_CONFIG[key].label,
			icon: ANNOUNCEMENT_TYPE_CONFIG[key].icon,
		})),
	);

	const bodyCharCount = computed(() => {
		if (!form.body) return 0;
		const text = form.body.replace(/<[^>]+>/g, '');
		return text.length;
	});

	const totalSize = computed(() => attachmentFiles.value.reduce((sum, f) => sum + f.size, 0));
	const totalSizeMb = computed(() => (totalSize.value / 1024 / 1024).toFixed(1));

	const canSubmit = computed(() => {
		if (submitting.value) return false;
		if (!form.title.trim()) return false;
		if (bodyCharCount.value === 0) return false;
		return true;
	});

	const groupedRecipients = computed(() => {
		const filtered = searchTerm.value.trim()
			? recipients.value.filter(r => r.fullName.toLowerCase().includes(searchTerm.value.trim().toLowerCase()))
			: recipients.value;
		const groups = new Map<number | null, RecipientOption[]>();
		for (const r of filtered) {
			const key = r.departmentId;
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key)!.push(r);
		}
		return Array.from(groups.entries()).map(([depId, list]) => ({
			departmentId: depId,
			departmentName: getDepartmentName(depId),
			employees: list,
		}));
	});

	function getDepartmentName(depId: number | null): string {
		if (depId === null) return 'Không thuộc phòng ban';
		const dep = departments.value.find(d => d.id === depId);
		return dep?.name ?? `Phòng ban #${depId}`;
	}

	function selectedCount() {
		return selectedIds.value.size;
	}

	function isEmployeeSelected(id: number) {
		return selectedIds.value.has(id);
	}

	function toggleEmployee(id: number) {
		if (selectedIds.value.has(id)) selectedIds.value.delete(id);
		else selectedIds.value.add(id);
		selectedIds.value = new Set(selectedIds.value);
	}

	function isDepartmentFullySelected(employees: RecipientOption[]) {
		return employees.length > 0 && employees.every(e => selectedIds.value.has(e.id));
	}

	function toggleDepartment(employees: RecipientOption[]) {
		const fully = isDepartmentFullySelected(employees);
		if (fully) employees.forEach(e => selectedIds.value.delete(e.id));
		else employees.forEach(e => selectedIds.value.add(e.id));
		selectedIds.value = new Set(selectedIds.value);
	}

	async function ensureRecipients() {
		try {
			await directoryStore.load();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Không tải được danh sách nhân viên');
		}
	}

	watch(sendToAll, val => {
		if (!val) ensureRecipients();
	});

	// ── Links ──
	function addLink() {
		if (form.links.length >= MAX_LINKS) return;
		form.links.push({ label: '', url: '' });
	}
	function removeLink(index: number) {
		form.links.splice(index, 1);
	}

	// ── Files ──
	const fileInputRef = ref<HTMLInputElement | null>(null);

	function onFilesChosen(e: Event) {
		const input = e.target as HTMLInputElement;
		const files = input.files ? Array.from(input.files) : [];
		for (const f of files) {
			if (attachmentFiles.value.length >= MAX_FILES) {
				toast.error(`Tối đa ${MAX_FILES} file`);
				break;
			}
			if (!ACCEPTED_MIMES.includes(f.type)) {
				toast.error(`File "${f.name}" không đúng định dạng cho phép`);
				continue;
			}
			if (f.size > MAX_FILE_SIZE) {
				toast.error(`File "${f.name}" vượt quá 20MB`);
				continue;
			}
			if (totalSize.value + f.size > MAX_TOTAL_SIZE) {
				toast.error('Tổng dung lượng vượt quá 100MB');
				break;
			}
			attachmentFiles.value.push(f);
		}
		input.value = '';
	}

	function removeFile(index: number) {
		attachmentFiles.value.splice(index, 1);
	}

	function fileIcon(f: File): string {
		if (f.type === 'application/pdf') return '📕';
		if (f.type.includes('spreadsheet') || f.name.endsWith('.xlsx')) return '📊';
		if (f.type.includes('word') || f.name.endsWith('.docx')) return '📝';
		return '📎';
	}

	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	}

	// ── Submit ──
	async function handleSubmit() {
		if (!canSubmit.value) return;

		const cleanLinks: AnnouncementLink[] = [];
		for (const l of form.links) {
			const label = l.label.trim();
			const url = l.url.trim();
			if (!label && !url) continue;
			if (!label || !url) {
				toast.error('Liên kết cần có cả tên hiển thị và URL');
				return;
			}
			try {
				new URL(url);
			} catch {
				toast.error(`URL không hợp lệ: ${url}`);
				return;
			}
			cleanLinks.push({ label, url });
		}

		if (!sendToAll.value && selectedIds.value.size === 0) {
			toast.error('Vui lòng chọn ít nhất 1 người nhận');
			return;
		}

		submitting.value = true;
		try {
			const formData = new FormData();
			formData.append('title', form.title.trim());
			formData.append('body', form.body);
			formData.append('announcementType', form.announcementType);
			if (cleanLinks.length > 0) {
				formData.append('links', JSON.stringify(cleanLinks));
			}
			if (!sendToAll.value) {
				formData.append('recipientIds', JSON.stringify(Array.from(selectedIds.value)));
			}
			attachmentFiles.value.forEach(f => formData.append('attachments', f));

			await create(formData);
			toast.success('Đã gửi thông báo');
			router.push('/management/announcements');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
		} finally {
			submitting.value = false;
		}
	}

	function handleCancel() {
		router.push('/management/announcements');
	}

	onMounted(() => {
		if (departments.value.length === 0) {
			directoryStore.load().catch(() => {});
		}
	});
</script>

<template>
	<div class="max-w-6xl mx-auto space-y-5">
		<!-- Page header -->
		<div class="flex items-center gap-3">
			<button
				type="button"
				class="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors"
				title="Quay lại"
				@click="handleCancel"
			>
				<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
				</svg>
			</button>
			<div>
				<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Tạo thông báo công ty</h1>
				<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Soạn nội dung, đính kèm file và chọn người nhận</p>
			</div>
		</div>

		<!-- 2-column layout: main form + sticky recipients on the right -->
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
			<!-- ─── Left: form content ─── -->
			<div
				class="lg:col-span-2 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-6"
			>
				<!-- Section 1: Basic info -->
				<div class="space-y-4">
					<div class="space-y-1.5">
						<label class="text-sm font-medium text-gray-700 dark:text-gray-300">
							Tiêu đề <span class="text-red-500">*</span>
						</label>
						<input
							v-model="form.title"
							type="text"
							maxlength="255"
							placeholder="VD: Báo cáo chấm công tháng 07/2026"
							class="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
						/>
					</div>

					<div class="space-y-1.5">
						<label class="text-sm font-medium text-gray-700 dark:text-gray-300">
							Loại thông báo <span class="text-red-500">*</span>
						</label>
						<select
							v-model="form.announcementType"
							class="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors appearance-none"
						>
							<option v-for="opt in typeOptions" :key="opt.value" :value="opt.value">
								{{ opt.icon }} {{ opt.label }}
							</option>
						</select>
					</div>
				</div>

				<!-- Section 2: Body -->
				<div class="space-y-1.5">
					<label class="text-sm font-medium text-gray-700 dark:text-gray-300">
						Nội dung thông báo <span class="text-red-500">*</span>
					</label>
					<TiptapEditor
					v-model="form.body"
					placeholder="Nhập nội dung thông báo..."
					:on-image-upload="uploadInlineMedia"
				/>
					<p class="text-xs text-gray-400 dark:text-gray-500">{{ bodyCharCount }} ký tự</p>
				</div>

				<!-- Section 3: Links -->
				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<label class="text-sm font-medium text-gray-700 dark:text-gray-300">
							Liên kết đính kèm
							<span class="text-xs font-normal text-gray-400">(tuỳ chọn, tối đa {{ MAX_LINKS }})</span>
						</label>
						<button
							v-if="form.links.length < MAX_LINKS"
							type="button"
							class="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-brand-500 text-brand-600 dark:text-brand-400 dark:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
							@click="addLink"
						>
							+ Thêm liên kết
						</button>
					</div>
					<div v-if="form.links.length === 0" class="text-xs text-gray-400 dark:text-gray-500 italic">
						Chưa có liên kết
					</div>
					<div v-for="(link, idx) in form.links" :key="idx" class="flex items-start gap-2">
						<div class="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
							<input
								v-model="link.label"
								type="text"
								placeholder="Tên hiển thị"
								class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
							/>
							<input
								v-model="link.url"
								type="url"
								placeholder="https://..."
								class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
							/>
						</div>
						<button
							type="button"
							class="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors flex-shrink-0"
							title="Xoá liên kết"
							@click="removeLink(idx)"
						>
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
				</div>

				<!-- Section 4: Attachments -->
				<div class="space-y-2">
					<label class="text-sm font-medium text-gray-700 dark:text-gray-300">
						File đính kèm
						<span class="text-xs font-normal text-gray-400"> (tối đa {{ MAX_FILES }} file, 20MB/file) </span>
					</label>
					<input
						ref="fileInputRef"
						type="file"
						multiple
						accept=".jpg,.jpeg,.png,.pdf,.docx,.xlsx"
						class="hidden"
						@change="onFilesChosen"
					/>
					<div class="flex items-center gap-3">
						<button
							type="button"
							:disabled="attachmentFiles.length >= MAX_FILES"
							class="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
							@click="fileInputRef?.click()"
						>
							📎 Chọn file
						</button>
						<span class="text-xs text-gray-500 dark:text-gray-400">
							Tổng dung lượng: {{ totalSizeMb }} MB / 100 MB
						</span>
					</div>

					<div v-if="attachmentFiles.length > 0" class="space-y-1.5">
						<div
							v-for="(f, idx) in attachmentFiles"
							:key="`${f.name}-${idx}`"
							class="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
						>
							<img
								v-if="isImageFile(f)"
								:src="getImagePreviewUrl(f)"
								:alt="f.name"
								class="w-10 h-10 rounded object-cover flex-shrink-0"
							/>
							<span v-else class="text-lg flex-shrink-0">{{ fileIcon(f) }}</span>
							<div class="flex-1 min-w-0">
								<p class="text-sm text-gray-700 dark:text-gray-300 truncate">{{ f.name }}</p>
								<p class="text-xs text-gray-500 dark:text-gray-400">{{ formatSize(f.size) }}</p>
							</div>
							<button
								type="button"
								class="p-1 rounded text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
								@click="removeFile(idx)"
							>
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>
					</div>
				</div>
				<!-- Bottom actions (inline, không sticky) -->
				<div class="flex items-center justify-between flex-wrap gap-3 pt-4 border-t">
					<CommonAppButton type="button" @click="showPreview = true"> Xem trước </CommonAppButton>
					<div class="flex items-center gap-3">
						<CommonAppButton variant="secondary" type="button" @click="handleCancel"> Huỷ </CommonAppButton>
						<CommonAppButton type="button" :loading="submitting" :disabled="!canSubmit" @click="handleSubmit">
							Gửi thông báo
						</CommonAppButton>
					</div>
				</div>
			</div>

			<!-- ─── Right: sticky recipients ─── -->
			<aside class="lg:col-span-1 lg:sticky lg:top-4 self-start">
				<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
					<div class="flex items-center justify-between gap-2">
						<h3 class="text-sm font-semibold text-gray-900 dark:text-white">Người nhận</h3>
						<span class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
							<template v-if="sendToAll">Tất cả nhân viên</template>
							<template v-else>Đã chọn {{ selectedCount() }}</template>
						</span>
					</div>

					<label class="flex items-center gap-2 cursor-pointer">
						<input
							v-model="sendToAll"
							type="checkbox"
							class="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
						/>
						<span class="text-sm font-medium text-gray-700 dark:text-gray-300"> Gửi cho tất cả nhân viên </span>
					</label>

					<div v-if="!sendToAll" class="space-y-3 pt-1">
						<input
							v-model="searchTerm"
							type="search"
							placeholder="Tìm nhân viên..."
							class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-colors"
						/>

						<div v-if="recipientsLoading" class="py-6 text-center">
							<svg class="animate-spin w-5 h-5 mx-auto text-brand-500" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
							</svg>
						</div>

						<div
							v-else
							class="max-h-[calc(100vh-22rem)] min-h-[16rem] overflow-y-auto space-y-3 pr-1 border-t border-gray-100 dark:border-gray-800 pt-3"
						>
							<div v-for="group in groupedRecipients" :key="group.departmentId ?? 'none'" class="space-y-1">
								<label
									class="flex items-center gap-2 cursor-pointer font-medium text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 px-2 py-1 rounded"
								>
									<input
										type="checkbox"
										:checked="isDepartmentFullySelected(group.employees)"
										class="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
										@change="toggleDepartment(group.employees)"
									/>
									<span class="truncate">{{ group.departmentName }}</span>
									<span class="text-xs text-gray-500 dark:text-gray-400 ml-auto">
										{{ group.employees.length }}
									</span>
								</label>
								<div class="pl-6 space-y-0.5">
									<label
										v-for="emp in group.employees"
										:key="emp.id"
										class="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 px-2 py-1 rounded"
									>
										<input
											type="checkbox"
											:checked="isEmployeeSelected(emp.id)"
											class="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
											@change="toggleEmployee(emp.id)"
										/>
										<span class="truncate">{{ emp.fullName }}</span>
									</label>
								</div>
							</div>

							<div
								v-if="groupedRecipients.length === 0"
								class="text-center py-4 text-sm text-gray-400 dark:text-gray-500"
							>
								Không tìm thấy nhân viên nào
							</div>
						</div>
					</div>
				</div>
			</aside>
		</div>

		<AnnouncementPreviewModal
			v-if="showPreview"
			v-model="showPreview"
			:title="form.title"
			:body="form.body"
			:announcement-type="form.announcementType"
			:links="form.links"
			:attachments="attachmentFiles"
		/>
	</div>
</template>
