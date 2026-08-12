<script setup lang="ts">
	import { useEmployeeService } from '~/services/employee.service';
	import type {
		ImportEmployeesRowError,
		ImportEmployeesRowField,
		ImportEmployeesValidationErrorPayload,
	} from '~/types/employee-import.types';

	const emit = defineEmits<{
		imported: [payload: { importedCount: number; autoCreatedCount: number }];
		close: [];
	}>();

	const toast = useToast();
	const service = useEmployeeService();

	const isDragging = ref(false);
	const selectedFile = ref<File | null>(null);
	const fileError = ref<string | null>(null);
	const importing = ref(false);
	const rowErrors = ref<ImportEmployeesRowError[]>([]);
	const generalErrorMessage = ref<string | null>(null);
	const lastImportedFileUrl = ref<string | null>(null);

	// File mẫu được serve tĩnh trong public/ — không gọi API. Nếu thay đổi path,
	// nhớ sync với file thực tế do team cung cấp trong public/import-templates/.
	const TEMPLATE_URL = '/import-templates/employees-import-template.xlsx';
	const TEMPLATE_FILENAME = 'employees-import-template.xlsx';

	const ACCEPTED_EXT = ['.xlsx'];
	const MAX_SIZE_MB = 10;
	const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

	const FIELD_LABEL: Record<ImportEmployeesRowField, string> = {
		employeeCode: 'Mã nhân viên',
		fullName: 'Họ và tên',
		email: 'Email',
		phone: 'Số điện thoại',
		joinDate: 'Ngày vào làm',
		password: 'Mật khẩu',
		role: 'Vai trò hệ thống',
		employmentType: 'Loại hợp đồng',
		departmentName: 'Phòng ban',
		positionName: 'Chức vụ',
		managerCode: 'Mã quản lý',
		dateOfBirth: 'Ngày sinh',
		gender: 'Giới tính',
		address: 'Địa chỉ',
		citizenIdNumber: 'Số CCCD',
		citizenFullName: 'Họ tên trên CCCD',
		citizenIssuedDate: 'Ngày cấp CCCD',
		citizenExpiryDate: 'Ngày hết hạn CCCD',
		citizenIssuedPlace: 'Nơi cấp CCCD',
		hometown: 'Quê quán',
		passportNumber: 'Số hộ chiếu',
		passportFullName: 'Họ tên trên hộ chiếu',
		passportType: 'Loại hộ chiếu',
		passportIssuedDate: 'Ngày cấp hộ chiếu',
		passportExpiryDate: 'Ngày hết hạn hộ chiếu',
	};

	function fieldLabel(field: ImportEmployeesRowField | null): string {
		return field ? FIELD_LABEL[field] : '—';
	}

	function formatSize(bytes: number) {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function validateFile(file: File): string | null {
		const name = file.name.toLowerCase();
		if (!ACCEPTED_EXT.some(ext => name.endsWith(ext))) {
			return 'Chỉ chấp nhận file .xlsx';
		}
		if (file.size > MAX_SIZE_BYTES) {
			return `File không được vượt quá ${MAX_SIZE_MB}MB`;
		}
		return null;
	}

	function setFile(file: File) {
		const err = validateFile(file);
		if (err) {
			fileError.value = err;
			selectedFile.value = null;
		} else {
			fileError.value = null;
			selectedFile.value = file;
			rowErrors.value = [];
			generalErrorMessage.value = null;
		}
	}

	function onFileInput(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files?.[0]) setFile(input.files[0]);
		input.value = '';
	}

	function onDrop(e: DragEvent) {
		isDragging.value = false;
		const file = e.dataTransfer?.files?.[0];
		if (file) setFile(file);
	}

	function clearFile() {
		selectedFile.value = null;
		fileError.value = null;
	}

	function isValidationError(
		err: unknown,
	): err is Error & { data?: { error?: ImportEmployeesValidationErrorPayload } } {
		const e = err as { data?: { error?: { code?: string; errors?: unknown[] } } };
		return e?.data?.error?.code === 'EMPLOYEE_IMPORT_VALIDATION' && Array.isArray(e.data.error.errors);
	}

	async function onImport() {
		if (!selectedFile.value || importing.value) return;
		importing.value = true;
		rowErrors.value = [];
		generalErrorMessage.value = null;

		try {
			const res = await service.importFromExcel(selectedFile.value);
			lastImportedFileUrl.value = res.fileUrl;
			toast.success(`Import thành công ${res.importedCount} nhân viên`);
			if (res.autoCreatedPositions.length > 0) {
				toast.info(`Đã tự tạo ${res.autoCreatedPositions.length} chức vụ mới`);
			}
			emit('imported', {
				importedCount: res.importedCount,
				autoCreatedCount: res.autoCreatedPositions.length,
			});
		} catch (err) {
			if (isValidationError(err)) {
				const payload = err.data?.error;
				rowErrors.value = payload?.errors ?? [];
				generalErrorMessage.value = payload?.message ?? 'Import thất bại';
			} else if (err instanceof Error) {
				toast.error(err.message);
			} else {
				toast.error('Không upload được file, thử lại');
			}
		} finally {
			importing.value = false;
		}
	}
</script>

<template>
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
				class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
				@click.self="!importing && emit('close')"
			>
				<div
					class="bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl max-h-[90vh] flex flex-col"
				>
					<!-- Header -->
					<div
						class="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0"
					>
						<div>
							<h3 class="text-base font-semibold text-gray-900 dark:text-white">Import nhân sự từ Excel</h3>
							<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
								Tạo hàng loạt nhân viên từ file .xlsx (tối đa 10MB)
							</p>
						</div>
						<button
							type="button"
							class="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
							:disabled="importing"
							@click="emit('close')"
						>
							<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>

					<!-- Body -->
					<div class="flex-1 overflow-y-auto px-6 py-5 space-y-5">
						<!-- Step 1: Tải template -->
						<div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-4">
							<div class="flex items-start gap-3">
								<div
									class="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-300 flex items-center justify-center font-semibold text-sm flex-shrink-0"
								>
									1
								</div>
								<div class="flex-1 min-w-0">
									<h4 class="text-sm font-semibold text-gray-900 dark:text-white">Tải file mẫu</h4>
									<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
										File gồm 24 cột. Dữ liệu bắt đầu từ dòng 2.
									</p>
									<ul class="mt-2 space-y-1 text-xs text-gray-500 dark:text-gray-400 list-disc list-inside">
										<li>
											Các cột CCCD (N–S) và Hộ chiếu (T–X) là <strong>điều kiện</strong> — nếu điền 1 field trong nhóm
											thì phải điền đủ các field bắt buộc trong nhóm đó.
										</li>
										<li>
											<strong>Chức vụ</strong> mới sẽ được tự tạo trong phòng ban tương ứng.
											<strong>Phòng ban</strong> phải có sẵn trong hệ thống trước khi import.
										</li>
										<li>
											Mỗi nhân viên sẽ nhận welcome email kèm password. Chọn password mạnh (≥8 ký tự, có chữ hoa, số và
											ký tự đặc biệt).
										</li>
									</ul>
									<a
										:href="TEMPLATE_URL"
										:download="TEMPLATE_FILENAME"
										class="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
									>
										<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
											/>
										</svg>
										Tải file mẫu
									</a>
								</div>
							</div>
						</div>

						<!-- Step 2: Upload file -->
						<div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-4">
							<div class="flex items-start gap-3">
								<div
									class="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-300 flex items-center justify-center font-semibold text-sm flex-shrink-0"
								>
									2
								</div>
								<div class="flex-1 min-w-0">
									<h4 class="text-sm font-semibold text-gray-900 dark:text-white">Chọn file để upload</h4>
									<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
										Hệ thống chỉ tạo khi TẤT CẢ dòng đều hợp lệ. Nếu có lỗi, không nhân viên nào được tạo.
									</p>

									<!-- Selected file preview -->
									<div
										v-if="selectedFile"
										class="mt-3 flex items-center gap-3 px-4 py-3 rounded-lg border border-brand-200 dark:border-brand-700 bg-brand-50 dark:bg-brand-900/20"
									>
										<svg
											class="w-8 h-8 text-brand-500 flex-shrink-0"
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
										<div class="flex-1 min-w-0">
											<p class="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
												{{ selectedFile.name }}
											</p>
											<p class="text-xs text-gray-500 dark:text-gray-400">{{ formatSize(selectedFile.size) }}</p>
										</div>
										<button
											type="button"
											class="p-1 rounded text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
											:disabled="importing"
											@click="clearFile"
										>
											<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
												<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
											</svg>
										</button>
									</div>

									<!-- Drop zone -->
									<label
										v-else
										class="mt-3 flex flex-col items-center justify-center gap-2 px-4 py-8 rounded-lg border-2 border-dashed transition-colors cursor-pointer"
										:class="
											isDragging
												? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
												: 'border-gray-300 dark:border-gray-600 hover:border-brand-400 hover:bg-white dark:hover:bg-gray-800'
										"
										@dragover.prevent="isDragging = true"
										@dragleave="isDragging = false"
										@drop.prevent="onDrop"
									>
										<svg
											class="w-8 h-8 text-gray-400"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											stroke-width="1.5"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
											/>
										</svg>
										<p class="text-sm text-gray-600 dark:text-gray-300 font-medium">Kéo thả hoặc nhấn để chọn file</p>
										<p class="text-xs text-gray-400 dark:text-gray-500">Chỉ chấp nhận .xlsx, tối đa 10MB</p>
										<input
											type="file"
											class="sr-only"
											accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
											@change="onFileInput"
										/>
									</label>

									<p v-if="fileError" class="mt-2 text-xs text-red-500">{{ fileError }}</p>
								</div>
							</div>
						</div>

						<!-- Validation error table -->
						<div
							v-if="rowErrors.length"
							class="rounded-lg border border-red-200 dark:border-red-800/70 bg-red-50/60 dark:bg-red-900/10 overflow-hidden"
						>
							<div class="px-4 py-3 border-b border-red-200 dark:border-red-800/70 flex items-center gap-2">
								<svg
									class="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0"
									fill="currentColor"
									viewBox="0 0 20 20"
								>
									<path
										fill-rule="evenodd"
										d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
										clip-rule="evenodd"
									/>
								</svg>
								<h4 class="text-sm font-semibold text-red-700 dark:text-red-300">
									{{ generalErrorMessage || `Có ${rowErrors.length} lỗi trong file` }}
								</h4>
							</div>
							<div class="overflow-x-auto max-h-80">
								<table class="w-full text-xs">
									<thead class="bg-red-100/60 dark:bg-red-900/30 sticky top-0">
										<tr>
											<th class="text-left px-3 py-2 font-semibold text-red-700 dark:text-red-300 w-16">Dòng</th>
											<th class="text-left px-3 py-2 font-semibold text-red-700 dark:text-red-300 w-40">Cột</th>
											<th class="text-left px-3 py-2 font-semibold text-red-700 dark:text-red-300 w-40">Giá trị</th>
											<th class="text-left px-3 py-2 font-semibold text-red-700 dark:text-red-300">Lỗi</th>
										</tr>
									</thead>
									<tbody class="divide-y divide-red-200/70 dark:divide-red-800/40">
										<tr
											v-for="(e, idx) in rowErrors"
											:key="`${e.row}-${e.field}-${idx}`"
											class="bg-white/40 dark:bg-transparent"
										>
											<td class="px-3 py-2 font-mono text-gray-700 dark:text-gray-300">{{ e.row }}</td>
											<td class="px-3 py-2 text-gray-700 dark:text-gray-300">{{ fieldLabel(e.field) }}</td>
											<td
												class="px-3 py-2 font-mono text-gray-500 dark:text-gray-400 truncate max-w-40"
												:title="e.value ?? ''"
											>
												{{ e.value || '—' }}
											</td>
											<td class="px-3 py-2 text-red-700 dark:text-red-300">{{ e.message }}</td>
										</tr>
									</tbody>
								</table>
							</div>
							<div class="px-4 py-2 border-t border-red-200 dark:border-red-800/70 bg-red-100/40 dark:bg-red-900/20">
								<p class="text-xs text-red-700 dark:text-red-300">Sửa file rồi upload lại.</p>
							</div>
						</div>

						<!-- Last-imported file link -->
						<div v-if="lastImportedFileUrl" class="text-xs text-gray-500 dark:text-gray-400">
							<a
								:href="lastImportedFileUrl"
								target="_blank"
								rel="noopener"
								class="text-brand-600 dark:text-brand-400 hover:underline"
							>
								Xem file đã import
							</a>
						</div>
					</div>

					<!-- Footer -->
					<div
						class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex-shrink-0"
					>
						<CommonAppButton type="button" variant="outline" :disabled="importing" @click="emit('close')">
							Đóng
						</CommonAppButton>
						<CommonAppButton type="button" :loading="importing" :disabled="!selectedFile" @click="onImport">
							Import
						</CommonAppButton>
					</div>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>
