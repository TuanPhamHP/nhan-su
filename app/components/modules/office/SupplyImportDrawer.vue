<script setup lang="ts">
	import { useInjectedSupplyCatalog } from '~/composables/useSupplyCatalog';

	/**
	 * Nhập danh mục từ Excel trong một ngăn kéo bên phải: việc làm một lần nên không chiếm đầu trang.
	 *
	 * Quy tắc nhập, file mẫu, ô chọn file, nút nhập và phần kết quả giữ nguyên văn như khối cũ. Đang
	 * nhập thì không đóng được (Esc, bấm nền, nút đóng đều chờ), để không ai tưởng đã huỷ một lần nhập
	 * vẫn đang chạy. Đóng thì con trỏ trở về nút "Nhập từ Excel".
	 */
	const {
		canEdit,
		importOpen,
		importFile,
		importing,
		downloadingTemplate,
		importResult,
		importSkippedRows,
		downloadTemplate,
		runImport,
	} = useInjectedSupplyCatalog();

	const panelRef = ref<HTMLElement | null>(null);
	useFocusTrap(panelRef);
	useEscapeKey(
		() => (importOpen.value = false),
		() => !importing.value,
	);

	function close() {
		if (!importing.value) importOpen.value = false;
	}
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-[60] flex justify-end bg-black/40" @click.self="close">
			<aside
				ref="panelRef"
				role="dialog"
				aria-modal="true"
				aria-labelledby="supply-import-title"
				:aria-busy="importing"
				class="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl dark:bg-gray-900"
			>
				<div class="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
					<h2 id="supply-import-title" class="text-base font-semibold text-gray-900 dark:text-white">Nhập mặt hàng từ Excel</h2>
					<button
						type="button"
						aria-label="Đóng ngăn nhập từ Excel"
						:disabled="importing"
						class="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-40 dark:hover:bg-gray-800"
						@click="close"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<div class="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm">
					<p class="text-gray-600 dark:text-gray-400">
						Bạn nhập được cả file mẫu và chính file đăng ký văn phòng phẩm hằng tháng đang dùng. Dòng số La Mã là tên
						nhóm, nhóm ghi "(HCNS đặt)" thành nhóm chỉ HCNS đặt, còn nhóm ngoài danh sách thì bỏ qua. Mặt hàng trùng tên
						không bị tạo lại, chỉ điền đơn giá khi danh mục đang để trống.
					</p>

					<CommonAppButton variant="outline" size="sm" :loading="downloadingTemplate" @click="downloadTemplate">
						Tải file mẫu
					</CommonAppButton>

					<UiFileDropzone
						v-model="importFile"
						accept=".xlsx"
						:max-size-mb="10"
						:disabled="!canEdit || importing"
					/>

					<p v-if="!canEdit" class="text-xs text-amber-700 dark:text-amber-400">
						Phân hệ đang ở chế độ chỉ xem nên chưa nhập được; bạn vẫn tải được file mẫu.
					</p>

					<div v-if="canEdit && importFile" class="flex justify-end">
						<CommonAppButton variant="primary" :loading="importing" @click="runImport">Import danh mục</CommonAppButton>
					</div>

					<p v-if="importing" role="status" aria-live="polite" class="text-gray-600 dark:text-gray-400">
						Đang nhập danh mục, bạn chờ một chút…
					</p>

					<div
						v-if="importResult"
						role="status"
						aria-live="polite"
						class="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-900/20"
					>
						<p class="font-medium text-emerald-800 dark:text-emerald-300">
							Thêm {{ importResult.createdItems }} mặt hàng, {{ importResult.createdGroups.length }} nhóm mới; điền đơn giá
							cho {{ importResult.updatedPrices }} mặt hàng; {{ importResult.existingItems }} mặt hàng đã có từ trước.
							<template v-if="importSkippedRows > 0">
								{{ importSkippedRows }} dòng không được nhập, bạn xem danh sách dưới.
							</template>
						</p>
						<p v-if="importResult.createdGroups.length" class="mt-1 text-emerald-700 dark:text-emerald-400">
							Nhóm mới: {{ importResult.createdGroups.join(', ') }}.
						</p>
						<!--
							`errors` gồm cả lỗi (dòng bị bỏ) lẫn cảnh báo (dòng vẫn tạo, ví dụ không hiểu được đơn
							giá nên để trống), nên tiêu đề nói chung là "chỗ cần xem lại" và danh sách hiện nguyên văn
							câu của máy chủ, mỗi câu đã có số dòng.
						-->
						<div v-if="importResult.errors.length" class="mt-2">
							<p class="font-medium text-amber-700 dark:text-amber-400">
								{{ importResult.errors.length }} chỗ cần bạn xem lại:
							</p>
							<ul class="mt-1 list-inside list-disc text-amber-700 dark:text-amber-400">
								<li v-for="(issue, idx) in importResult.errors" :key="idx">{{ issue.message }}</li>
							</ul>
						</div>
					</div>
				</div>
			</aside>
		</div>
	</Teleport>
</template>
