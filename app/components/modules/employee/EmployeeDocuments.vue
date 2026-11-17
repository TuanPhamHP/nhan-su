<script setup lang="ts">
	import { formatDate } from '~/utils/date';
	import { DOCUMENT_EXPIRY_CLASS, documentExpiryNote, documentExpiryTone } from '~/utils/hr-profile.utils';
	import { useMeProfileService } from '~/services/me-profile.service';
	import UploadDocumentModal from '~/components/modules/employee/UploadDocumentModal.vue';
	import type { EmployeeDocumentResponse } from '~/types/employee-document.types';

	/**
	 * Hồ sơ giấy tờ của một nhân viên (UI-03, lô 3a).
	 *
	 * Loại giấy tờ nay là danh mục cấu hình được, nên danh sách tự nhóm theo loại server trả về
	 * thay vì ba nhóm cố định như trước. Loại nhạy cảm chỉ có trong danh sách khi người xem có
	 * `employee:private:read`; server lọc sẵn nên ở đây không phải đoán.
	 */
	const props = withDefaults(
		defineProps<{
			employeeId: number;
			/** Không hiện nút tải lên và nút xoá. */
			readonly?: boolean;
			/** Nhân viên xem giấy tờ của chính mình: đọc qua `/employees/me/documents`. */
			self?: boolean;
			/** Cho phép chọn thân nhân liên quan trong form tải lên. */
			canViewRelatives?: boolean;
		}>(),
		{ readonly: false, self: false, canViewRelatives: false },
	);

	const toast = useToast();
	const { documents, loading, fetchDocuments, deleteDocument, getDocumentUrl } = useEmployeeDocuments();
	const meService = useMeProfileService();

	const showUploadModal = ref(false);
	const deletingId = ref<number | null>(null);
	const confirmDeleteTarget = ref<EmployeeDocumentResponse | null>(null);
	const loadingSelf = ref(false);

	async function load() {
		if (!props.self) {
			try {
				await fetchDocuments(props.employeeId);
			} catch (e) {
				toast.error(e instanceof Error ? e.message : 'Chưa tải được danh sách tài liệu.');
			}
			return;
		}
		loadingSelf.value = true;
		try {
			documents.value = await meService.findDocuments();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa tải được danh sách tài liệu.');
		} finally {
			loadingSelf.value = false;
		}
	}

	onMounted(load);

	const isLoading = computed(() => loading.value || loadingSelf.value);

	/** Nhóm theo loại, giữ nguyên thứ tự server trả về trong mỗi nhóm. */
	const groups = computed(() => {
		const map = new Map<number, { label: string; isSensitive: boolean; items: EmployeeDocumentResponse[] }>();
		for (const doc of documents.value) {
			const group = map.get(doc.documentTypeId);
			if (group) group.items.push(doc);
			else map.set(doc.documentTypeId, { label: doc.typeLabel, isSensitive: doc.isSensitive, items: [doc] });
		}
		return [...map.entries()].map(([documentTypeId, group]) => ({ documentTypeId, ...group }));
	});

	function truncate(str: string, max = 40) {
		return str.length > max ? str.slice(0, max) + '…' : str;
	}

	async function handleView(doc: EmployeeDocumentResponse) {
		try {
			const url = await getDocumentUrl(props.employeeId, doc.id);
			window.open(url, '_blank');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa mở được tài liệu này.');
		}
	}

	async function handleDownload(doc: EmployeeDocumentResponse) {
		try {
			const url = await getDocumentUrl(props.employeeId, doc.id);
			const a = document.createElement('a');
			a.target = '_blank';
			a.href = url;
			a.download = doc.fileName;
			a.click();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa tải được tài liệu này.');
		}
	}

	async function handleDelete(doc: EmployeeDocumentResponse) {
		confirmDeleteTarget.value = null;
		deletingId.value = doc.id;
		try {
			await deleteDocument(props.employeeId, doc.id);
			toast.success('Đã xoá tài liệu.');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa xoá được tài liệu. Bạn thử lại sau ít phút.');
		} finally {
			deletingId.value = null;
		}
	}

	function onUploaded() {
		showUploadModal.value = false;
		load();
	}
</script>

<template>
	<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
		<div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
			<div class="min-w-0">
				<h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Hồ sơ và giấy tờ</h3>
				<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
					Giấy tờ nhạy cảm như căn cước hay giấy khám sức khoẻ chỉ hiện với người được xem thông tin riêng.
				</p>
			</div>
			<CommonAppButton v-if="!readonly" size="sm" @click="showUploadModal = true">
				<svg class="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
					/>
				</svg>
				Tải lên tài liệu
			</CommonAppButton>
		</div>

		<!-- Đang tải -->
		<div v-if="isLoading" class="p-6 space-y-6">
			<div v-for="i in 2" :key="i" class="space-y-3">
				<div class="h-4 w-32 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
				<div class="h-14 w-full bg-gray-50 dark:bg-gray-800 rounded-lg animate-pulse" />
			</div>
		</div>

		<p v-else-if="!groups.length" class="px-6 py-8 text-sm text-gray-500 dark:text-gray-400">
			Chưa có giấy tờ nào trong hồ sơ.
		</p>

		<div v-else class="p-6 space-y-6">
			<div v-for="group in groups" :key="group.documentTypeId">
				<p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
					{{ group.label }}
					<span v-if="group.isSensitive" class="ml-1 normal-case font-medium text-amber-600 dark:text-amber-400">
						· thông tin riêng
					</span>
				</p>

				<div class="space-y-2">
					<div
						v-for="doc in group.items"
						:key="doc.id"
						class="flex flex-wrap items-center gap-3 px-4 py-3 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
					>
						<!-- Loại file -->
						<div class="flex-shrink-0">
							<svg
								v-if="doc.fileType === 'pdf'"
								class="w-8 h-8 text-red-500"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="1.5"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
								/>
							</svg>
							<svg
								v-else-if="doc.fileType === 'docx'"
								class="w-8 h-8 text-blue-500"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="1.5"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
								/>
							</svg>
							<svg
								v-else
								class="w-8 h-8 text-green-500"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="1.5"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
								/>
							</svg>
						</div>

						<!-- Thông tin -->
						<div class="flex-1 min-w-[12rem]">
							<p class="text-sm font-medium text-gray-800 dark:text-gray-200 truncate" :title="doc.fileName">
								{{ truncate(doc.fileName) }}
							</p>
							<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
								<span v-if="doc.issuedDate">Ngày cấp {{ formatDate(doc.issuedDate) }}</span>
								<span v-else>Không ghi ngày cấp</span>
								<template v-if="doc.expiryDate">
									<span class="mx-1">·</span>
									<span :class="DOCUMENT_EXPIRY_CLASS[documentExpiryTone(doc.expiryDate) ?? 'ok']">
										Hết hạn {{ formatDate(doc.expiryDate) }}
										<template v-if="documentExpiryNote(doc.expiryDate)">
											({{ documentExpiryNote(doc.expiryDate) }})
										</template>
									</span>
								</template>
							</p>
							<p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
								Tải lên {{ formatDate(doc.uploadedAt) }}
								<template v-if="doc.uploadedBy"> bởi {{ doc.uploadedBy.name }}</template>
								<template v-if="doc.relativeName"> · thuộc {{ doc.relativeName }}</template>
							</p>
							<p v-if="doc.note" class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ doc.note }}</p>
						</div>

						<!-- Thao tác -->
						<div class="flex items-center gap-1 flex-shrink-0">
							<button
								type="button"
								class="px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-white dark:hover:bg-gray-700 rounded-md transition-colors"
								@click="handleView(doc)"
							>
								Xem
							</button>
							<button
								type="button"
								class="px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-white dark:hover:bg-gray-700 rounded-md transition-colors"
								@click="handleDownload(doc)"
							>
								Tải về
							</button>
							<button
								v-if="!readonly"
								type="button"
								:disabled="deletingId === doc.id"
								class="px-2.5 py-1 text-xs font-medium text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-50"
								@click="confirmDeleteTarget = doc"
							>
								{{ deletingId === doc.id ? '...' : 'Xóa' }}
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Hỏi lại trước khi xoá -->
	<Teleport to="body">
		<div
			v-if="confirmDeleteTarget"
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
			@click.self="confirmDeleteTarget = null"
		>
			<div
				class="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900"
			>
				<h3 class="font-semibold text-gray-900 dark:text-white">Xoá tài liệu</h3>
				<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
					Hệ thống sẽ xoá {{ confirmDeleteTarget.fileName }} khỏi hồ sơ. Việc này không hoàn lại được.
				</p>
				<div class="mt-6 flex justify-end gap-3">
					<CommonAppButton variant="outline" @click="confirmDeleteTarget = null">Giữ lại</CommonAppButton>
					<CommonAppButton
						variant="danger"
						:loading="deletingId !== null"
						@click="confirmDeleteTarget && handleDelete(confirmDeleteTarget)"
					>
						Xoá
					</CommonAppButton>
				</div>
			</div>
		</div>
	</Teleport>

	<!-- Form tải lên -->
	<UploadDocumentModal
		v-if="showUploadModal"
		:employee-id="employeeId"
		:can-view-relatives="canViewRelatives"
		@uploaded="onUploaded"
		@close="showUploadModal = false"
	/>
</template>
