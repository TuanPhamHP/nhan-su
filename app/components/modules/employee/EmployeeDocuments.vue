<script setup lang="ts">
	import { formatDate } from '~/utils/date';
	import type { DocumentType, EmployeeDocumentResponse } from '~/types/employee.types';
	import UploadDocumentModal from '~/components/modules/employee/UploadDocumentModal.vue';

	const props = withDefaults(
		defineProps<{
			employeeId: number;
			readonly?: boolean;
		}>(),
		{ readonly: false },
	);

	const toast = useToast();
	const { documents, loading, fetchDocuments, deleteDocument, getDocumentUrl } = useEmployeeDocuments();

	const showUploadModal = ref(false);
	const deletingId = ref<number | null>(null);
	const confirmDeleteId = ref<number | null>(null);

	onMounted(() => fetchDocuments(props.employeeId));

	const groups: { type: DocumentType; label: string }[] = [
		{ type: 'ID_CARD', label: 'CCCD / Hộ chiếu' },
		{ type: 'CONTRACT', label: 'Hợp đồng lao động' },
		{ type: 'OTHER', label: 'Tài liệu khác' },
	];

	const documentsByType = computed(() => {
		const map: Record<DocumentType, EmployeeDocumentResponse[]> = {
			ID_CARD: [],
			CONTRACT: [],
			OTHER: [],
		};
		for (const doc of documents.value) {
			map[doc.type].push(doc);
		}
		return map;
	});

	function truncate(str: string, max = 40) {
		return str.length > max ? str.slice(0, max) + '…' : str;
	}

	async function handleView(doc: EmployeeDocumentResponse) {
		try {
			const url = await getDocumentUrl(props.employeeId, doc.id);
			window.open(url, '_blank');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Không lấy được URL tài liệu');
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
			toast.error(e instanceof Error ? e.message : 'Không tải được tài liệu');
		}
	}

	async function handleDelete(doc: EmployeeDocumentResponse) {
		confirmDeleteId.value = null;
		deletingId.value = doc.id;
		try {
			await deleteDocument(props.employeeId, doc.id);
			toast.success('Đã xóa tài liệu');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Xóa tài liệu thất bại');
		} finally {
			deletingId.value = null;
		}
	}

	function onUploaded() {
		showUploadModal.value = false;
		fetchDocuments(props.employeeId);
	}
</script>

<template>
	<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
		<!-- Header -->
		<div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
			<h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Hồ sơ &amp; Tài liệu</h3>
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

		<!-- Loading skeleton -->
		<div v-if="loading" class="p-6 space-y-6">
			<div v-for="i in 3" :key="i" class="space-y-3">
				<div class="h-4 w-32 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
				<div class="h-14 w-full bg-gray-50 dark:bg-gray-800 rounded-lg animate-pulse" />
			</div>
		</div>

		<!-- Content -->
		<div v-else class="p-6 space-y-6">
			<div v-for="group in groups" :key="group.type">
				<p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
					{{ group.label }}
				</p>

				<div v-if="documentsByType[group.type].length === 0" class="text-sm text-gray-400 dark:text-gray-600 italic">
					Chưa có tài liệu
				</div>

				<div v-else class="space-y-2">
					<div
						v-for="doc in documentsByType[group.type]"
						:key="doc.id"
						class="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
					>
						<!-- File icon -->
						<div class="flex-shrink-0">
							<!-- PDF -->
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
							<!-- DOCX -->
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
							<!-- Image -->
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

						<!-- Info -->
						<div class="flex-1 min-w-0">
							<p class="text-sm font-medium text-gray-800 dark:text-gray-200 truncate" :title="doc.fileName">
								{{ truncate(doc.fileName) }}
							</p>
							<p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
								{{ formatDate(doc.uploadedAt) }}
							</p>
						</div>

						<!-- Actions -->
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
								@click="confirmDeleteId = doc.id"
							>
								{{ deletingId === doc.id ? '...' : 'Xóa' }}
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Confirm delete dialog -->
	<Teleport to="body">
		<Transition
			enter-active-class="transition ease-out duration-150"
			enter-from-class="opacity-0"
			enter-to-class="opacity-100"
			leave-active-class="transition ease-in duration-100"
			leave-from-class="opacity-100"
			leave-to-class="opacity-0"
		>
			<div
				v-if="confirmDeleteId !== null"
				class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
				@click.self="confirmDeleteId = null"
			>
				<div
					class="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl border border-gray-200 dark:border-gray-700"
				>
					<div class="flex items-start gap-4">
						<div
							class="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0"
						>
							<svg
								class="w-5 h-5 text-red-600 dark:text-red-400"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
								/>
							</svg>
						</div>
						<div>
							<h3 class="font-semibold text-gray-900 dark:text-white">Xóa tài liệu</h3>
							<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
								Bạn có chắc muốn xóa tài liệu này? Hành động này không thể hoàn tác.
							</p>
						</div>
					</div>
					<div class="flex justify-end gap-3 mt-6">
						<CommonAppButton variant="outline" @click="confirmDeleteId = null">Hủy</CommonAppButton>
						<CommonAppButton
							variant="danger"
							:loading="deletingId !== null"
							@click="
								() => {
									const id = confirmDeleteId;
									if (id !== null) {
										const doc = documents.find(d => d.id === id);
										if (doc) handleDelete(doc);
									}
								}
							"
						>
							Xóa
						</CommonAppButton>
					</div>
				</div>
			</div>
		</Transition>
	</Teleport>

	<!-- Upload modal -->
	<UploadDocumentModal
		v-if="showUploadModal"
		:employee-id="employeeId"
		@uploaded="onUploaded"
		@close="showUploadModal = false"
	/>
</template>
