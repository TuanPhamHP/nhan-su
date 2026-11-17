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
			toast.success('Đã tải file mẫu mau-nhap-tai-san.xlsx gồm hai sheet Tài sản và Dịch vụ.');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa tải được file mẫu. Bạn thử lại sau ít phút.');
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
			const errorRows = result.value.errors.length;
			const warningRows = result.value.warnings.length;
			if (physical + svc > 0) {
				// Ba con số nói ba việc khác nhau: đã nhập là xong, cảnh báo là phải vào cấp phát,
				// dòng lỗi là phải sửa file. Câu nào cũng trọn vẹn để đọc liền một mạch.
				const parts = [`Đã nhập ${physical + svc} tài sản, gồm ${physical} thiết bị và ${svc} dịch vụ.`];
				if (warningRows) {
					parts.push(`Trong đó ${warningRows} tài sản chưa gắn người dùng, bạn xem bảng bên dưới.`);
				}
				if (errorRows) {
					parts.push(warningRows ? `Còn ${errorRows} dòng lỗi.` : `Còn ${errorRows} dòng lỗi, bạn xem bảng bên dưới.`);
				}
				toast.success(parts.join(' '));
			} else if (errorRows) {
				toast.warning(
					`Chưa nhập được dòng nào vì cả ${errorRows} dòng đều có lỗi. Bạn sửa theo bảng bên dưới rồi tải lại file.`,
				);
			} else {
				toast.warning(
					'File không có dòng dữ liệu nào. Bạn kiểm tra lại sheet Tài sản và sheet Dịch vụ, nhớ giữ nguyên dòng tiêu đề.',
				);
			}
		} catch (e) {
			unreadableFile.value = errorCode(e) === 'ASSET_IMPORT_INVALID_FILE';
			toast.error(e instanceof Error ? e.message : 'Chưa nhập được file. Bạn thử lại sau ít phút.');
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
						aria-label="Đóng hộp nhập Excel"
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
							Loại và nhà cung cấp chưa có sẽ được tạo tự động. Người sử dụng không tìm thấy trên hệ thống
							thì tài sản vẫn được nhập vào kho, chưa cấp phát cho ai. Hệ thống không lưu mật khẩu, nên cột
							nào chứa mật khẩu sẽ bị bỏ qua.
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
						<CommonAppButton variant="secondary" type="button" @click="emit('close')">Đóng</CommonAppButton>
						<CommonAppButton variant="primary" :disabled="!selectedFile" :loading="uploading" @click="upload">
							Nhập file
						</CommonAppButton>
					</div>
				</div>

				<!-- ── Kết quả ──────────────────────────────────────────────────── -->
				<div v-else class="space-y-4 p-6">
					<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
								result.warnings.length
									? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
									: 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/60'
							"
						>
							<p
								class="text-xs"
								:class="result.warnings.length ? 'text-amber-700 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'"
							>
								Chưa gắn người dùng
							</p>
							<p
								class="text-xl font-bold"
								:class="result.warnings.length ? 'text-amber-700 dark:text-amber-300' : 'text-gray-700 dark:text-gray-300'"
							>
								{{ result.warnings.length }}
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

					<!--
						Cảnh báo đứng trước bảng lỗi vì hai việc trái ngược nhau: dòng cảnh báo đã nằm
						trong hệ thống nên người dùng vào cấp phát, còn dòng lỗi thì sửa file rồi nhập
						lại. Link mã tài sản mở tab mới để bảng này còn nguyên ở tab cũ.
					-->
					<div v-if="result.warnings.length" class="space-y-2">
						<p class="text-sm font-medium text-gray-800 dark:text-gray-100">
							Đã nhập nhưng chưa gắn người dùng
						</p>
						<div class="overflow-hidden rounded-xl border border-amber-200 dark:border-amber-800">
							<!--
								`table-fixed` với ba cột đầu có bề rộng cố định: câu của BE dài, để bảng tự
								co giãn thì trên điện thoại cột Nội dung bị đẩy ra ngoài và người dùng phải
								kéo ngang mới đọc được.
							-->
							<div class="max-h-72 overflow-y-auto">
								<table class="w-full table-fixed text-sm">
									<thead
										class="sticky top-0 bg-amber-50 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
									>
										<tr>
											<th class="w-14 px-2 py-2 text-left font-medium sm:w-20 sm:px-3">Sheet</th>
											<th class="w-10 px-2 py-2 text-left font-medium sm:w-14 sm:px-3">Dòng</th>
											<th class="w-24 px-2 py-2 text-left font-medium sm:w-28 sm:px-3">Tài sản</th>
											<th class="px-2 py-2 text-left font-medium sm:px-3">Nội dung</th>
										</tr>
									</thead>
									<tbody class="divide-y divide-amber-100 dark:divide-amber-900/40">
										<tr v-for="(warn, i) in result.warnings" :key="`${warn.sheet}-${warn.row}-${i}`">
											<td class="px-2 py-2 text-gray-600 dark:text-gray-300 sm:px-3">{{ warn.sheet }}</td>
											<td class="px-2 py-2 tabular-nums text-gray-600 dark:text-gray-300 sm:px-3">{{ warn.row }}</td>
											<td class="px-2 py-2 sm:px-3">
												<NuxtLink
													:to="`/management/assets/${warn.assetId}`"
													target="_blank"
													rel="noopener"
													class="break-all font-medium text-brand-600 underline decoration-dotted hover:text-brand-700 dark:text-brand-400"
												>
													{{ warn.assetCode }}
												</NuxtLink>
											</td>
											<td class="break-words px-2 py-2 text-amber-700 dark:text-amber-300 sm:px-3">
												{{ warn.messages.join(' ') }}
											</td>
										</tr>
									</tbody>
								</table>
							</div>
						</div>
						<p class="text-xs text-gray-500 dark:text-gray-400">
							Các tài sản trên đã có trong hệ thống. Bạn mở từng tài sản để cấp phát, đừng nhập lại các dòng
							này vì sẽ tạo trùng tài sản.
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
