<script setup lang="ts">
	import { useAssetService } from '~/services/asset.service';
	import { downloadAssetBlob } from '~/utils/asset.utils';
	import type { AssetImportResult } from '~/types/asset.types';

	const emit = defineEmits<{
		imported: [result: AssetImportResult];
		close: [];
	}>();

	const toast = useToast();
	const service = useAssetService();

	// Kiểu và dung lượng do `UiFileDropzone` tự kiểm, ở đây chỉ nhận file đã hợp lệ.
	const selectedFile = ref<File | null>(null);
	const downloading = ref(false);
	const uploading = ref(false);
	/** Kết quả lần nhập vừa rồi. Có rồi thì modal chuyển sang màn hình tổng kết. */
	const result = ref<AssetImportResult | null>(null);
	/**
	 * Bật khi server báo không đọc nổi file.
	 *
	 * Mã `ASSET_IMPORT_INVALID_FILE` chỉ nói "không đọc được", người dùng đứng hình vì
	 * file mở bằng Excel vẫn bình thường. Thủ phạm hay gặp nhất là CHÚ THÍCH Ô do công
	 * cụ ngoài Excel (openpyxl, script Python) ghi vào — thư viện đọc Excel của server
	 * vấp đúng chỗ đó. Gợi ý cách gỡ, không khẳng định chắc chắn vì mã lỗi này còn dùng
	 * cho file hỏng thật hay file .xls đổi đuôi.
	 */
	const unreadableFile = ref(false);

	function errorCode(e: unknown): string {
		const data = (e as { data?: { error?: { code?: string } } })?.data;
		return data?.error?.code ?? '';
	}

	async function downloadTemplate() {
		if (downloading.value) return;
		downloading.value = true;
		try {
			const blob = await service.downloadImportTemplate();
			downloadAssetBlob(blob, 'mau-nhap-tai-san.xlsx');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Không tải được file mẫu');
		} finally {
			downloading.value = false;
		}
	}

	async function upload() {
		if (!selectedFile.value || uploading.value) return;
		uploading.value = true;
		unreadableFile.value = false;
		try {
			result.value = await service.importFromExcel(selectedFile.value);
			const { physical, service: svc } = result.value.created;
			if (physical + svc > 0) toast.success(`Đã nhập ${physical + svc} dòng`);
			else if (result.value.errors.length) toast.warning('Không dòng nào vào được, xem bảng lỗi bên dưới');
		} catch (e) {
			unreadableFile.value = errorCode(e) === 'ASSET_IMPORT_INVALID_FILE';
			toast.error(e instanceof Error ? e.message : 'Nhập file thất bại');
		} finally {
			uploading.value = false;
		}
	}

	/** Nhập tiếp file khác mà không phải đóng rồi mở lại modal. */
	function reset() {
		result.value = null;
		selectedFile.value = null;
	}

	function finish() {
		if (result.value) emit('imported', result.value);
		else emit('close');
	}

	const createdTotal = computed(() =>
		result.value ? result.value.created.physical + result.value.created.service : 0,
	);
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-4">
			<div class="my-8 w-full max-w-2xl rounded-2xl bg-white shadow-xl dark:bg-gray-900">
				<div class="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">Nhập tài sản từ Excel</h2>
					<button
						type="button"
						class="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
						aria-label="Đóng"
						@click="finish"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<!-- ── Chọn file ────────────────────────────────────────────────── -->
				<div v-if="!result" class="space-y-4 p-6">
					<div class="rounded-xl bg-gray-50 p-4 dark:bg-gray-800/60">
						<p class="text-sm text-gray-700 dark:text-gray-300">
							File mẫu có hai sheet: <strong>Tài sản</strong> cho thiết bị và <strong>Dịch vụ</strong> cho thuê
							bao. Mỗi sheet tối đa 2.000 dòng.
						</p>
						<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
							Loại và nhà cung cấp chưa có sẽ được tạo tự động. Cột nào có chữ "password", "mật khẩu" hay
							"sudo" đều bị bỏ qua — hệ thống không lưu mật khẩu.
						</p>
						<CommonAppButton class="mt-3" size="sm" variant="outline" :loading="downloading" @click="downloadTemplate">
							Tải file mẫu
						</CommonAppButton>
					</div>

					<div class="space-y-1.5">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Chọn file .xlsx</label>
						<UiFileDropzone
							v-model="selectedFile"
							accept=".xlsx"
							:max-size-mb="10"
							:disabled="uploading"
							@update:model-value="unreadableFile = false"
						/>
					</div>

					<div
						v-if="unreadableFile"
						class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20"
					>
						<p class="text-sm font-medium text-amber-800 dark:text-amber-200">
							File mở bằng Excel vẫn bình thường mà vẫn báo lỗi?
						</p>
						<p class="mt-1 text-xs text-amber-700 dark:text-amber-300">
							Hay gặp nhất là file có <strong>chú thích ô</strong> (comment/note) do công cụ ngoài Excel
							ghi vào. Hãy mở file bằng Excel hoặc LibreOffice, xoá hết chú thích rồi
							<strong>Lưu lại (Save As .xlsx)</strong> và nhập lại — chỉ cần lưu lại bằng Excel là
							thường hết lỗi.
						</p>
					</div>

					<div class="flex justify-end gap-3 pt-2">
						<CommonAppButton variant="secondary" type="button" @click="emit('close')">Huỷ</CommonAppButton>
						<CommonAppButton variant="primary" :disabled="!selectedFile" :loading="uploading" @click="upload">
							Nhập file
						</CommonAppButton>
					</div>
				</div>

				<!-- ── Kết quả ──────────────────────────────────────────────────── -->
				<div v-else class="space-y-4 p-6">
					<div class="grid grid-cols-2 gap-3">
						<div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
							<p class="text-xs text-emerald-700 dark:text-emerald-400">Đã nhập</p>
							<p class="text-xl font-bold text-emerald-700 dark:text-emerald-300">{{ createdTotal }}</p>
							<p class="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">
								{{ result.created.physical }} thiết bị · {{ result.created.service }} dịch vụ
							</p>
						</div>
						<div
							class="rounded-xl border p-4"
							:class="
								result.errors.length
									? 'border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-900/20'
									: 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/60'
							"
						>
							<p class="text-xs" :class="result.errors.length ? 'text-rose-700 dark:text-rose-400' : 'text-gray-500 dark:text-gray-400'">
								Dòng lỗi
							</p>
							<p class="text-xl font-bold" :class="result.errors.length ? 'text-rose-700 dark:text-rose-300' : 'text-gray-700 dark:text-gray-300'">
								{{ result.errors.length }}
							</p>
						</div>
					</div>

					<div
						v-if="result.ignoredColumns.length"
						class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20"
					>
						<p class="text-sm text-amber-800 dark:text-amber-200">
							Các cột sau đã bị bỏ qua vì hệ thống không lưu mật khẩu:
							<strong>{{ result.ignoredColumns.join(', ') }}</strong>
						</p>
					</div>

					<div
						v-if="result.autoCreated.categories.length || result.autoCreated.vendors.length"
						class="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700 dark:bg-gray-800/60 dark:text-gray-300"
					>
						<p v-if="result.autoCreated.categories.length">
							Loại mới được tạo: <strong>{{ result.autoCreated.categories.join(', ') }}</strong>
						</p>
						<p v-if="result.autoCreated.vendors.length" class="mt-1">
							Nhà cung cấp mới được tạo: <strong>{{ result.autoCreated.vendors.join(', ') }}</strong>
						</p>
					</div>

					<div v-if="result.errors.length" class="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
						<div class="max-h-72 overflow-auto">
							<table class="w-full text-sm">
								<thead class="sticky top-0 bg-gray-50 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
									<tr>
										<th class="px-3 py-2 text-left font-medium">Sheet</th>
										<th class="w-16 px-3 py-2 text-left font-medium">Dòng</th>
										<th class="px-3 py-2 text-left font-medium">Lỗi</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
									<tr v-for="(err, i) in result.errors" :key="`${err.sheet}-${err.row}-${i}`">
										<td class="px-3 py-2 text-gray-600 dark:text-gray-300">{{ err.sheet }}</td>
										<td class="px-3 py-2 tabular-nums text-gray-600 dark:text-gray-300">{{ err.row }}</td>
										<td class="px-3 py-2 text-rose-600 dark:text-rose-400">{{ err.messages.join('; ') }}</td>
									</tr>
								</tbody>
							</table>
						</div>
					</div>

					<p v-if="result.errors.length" class="text-xs text-gray-500 dark:text-gray-400">
						Các dòng hợp lệ đã được nhập. Sửa những dòng trên trong file rồi nhập lại chỉ các dòng đó.
					</p>

					<div class="flex justify-end gap-3 pt-2">
						<CommonAppButton variant="secondary" type="button" @click="reset">Nhập file khác</CommonAppButton>
						<CommonAppButton variant="primary" type="button" @click="finish">Xong</CommonAppButton>
					</div>
				</div>
			</div>
		</div>
	</Teleport>
</template>
