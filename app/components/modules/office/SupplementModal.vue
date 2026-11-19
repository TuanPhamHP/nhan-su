<script setup lang="ts">
	import { useOfficeService } from '~/services/office.service';
	import { officeErrorMessage } from '~/utils/office.utils';
	import type { CreateSupplyLineBody, SummaryDepartment, SupplyItem, SupplyRequest } from '~/types/office.types';

	/**
	 * Phiếu bổ sung cho một phòng sau khi kỳ đã khoá.
	 *
	 * Khác phiếu chính ở hai chỗ: ghi chú là bắt buộc (phải nói vì sao phát sinh), và ô chọn mặt
	 * hàng ở đây có CẢ nhóm chỉ HCNS đặt, vì chính HCNS là người lập phiếu này.
	 */
	const props = defineProps<{
		periodId: number;
		periodTitle: string;
		/** Phòng đang tham gia kỳ, lấy từ bảng tổng hợp đang mở. */
		departments: SummaryDepartment[];
	}>();

	const emit = defineEmits<{
		created: [request: SupplyRequest];
		close: [];
	}>();

	const toast = useToast();
	const service = useOfficeService();

	const departmentId = ref<number | undefined>(props.departments[0]?.departmentId);
	const note = ref('');
	const items = ref<SupplyItem[]>([]);
	const loadingItems = ref(true);
	const saving = ref(false);

	interface DraftLine {
		custom: boolean;
		itemId: number | undefined;
		customName: string;
		customUnit: string;
		qty: number | undefined;
	}

	const lines = ref<DraftLine[]>([{ custom: false, itemId: undefined, customName: '', customUnit: '', qty: undefined }]);

	const departmentOptions = computed(() =>
		props.departments.map(d => ({ value: d.departmentId, label: d.name })),
	);

	const itemOptions = computed(() =>
		items.value.map(i => ({
			value: i.id,
			label: `${i.groupName} · ${i.name} (${i.unit})${i.hrOnly ? ' — chỉ HCNS đặt' : ''}`,
		})),
	);

	onMounted(async () => {
		try {
			items.value = (await service.findSupplyItems()).filter(i => i.isActive);
		} catch (e) {
			toast.error(officeErrorMessage(e, 'Chưa tải được danh mục mặt hàng. Bạn đóng hộp rồi mở lại.'));
		} finally {
			loadingItems.value = false;
		}
	});

	useEscapeKey(
		() => emit('close'),
		() => !saving.value,
	);

	function addLine() {
		lines.value = [...lines.value, { custom: false, itemId: undefined, customName: '', customUnit: '', qty: undefined }];
	}

	function removeLine(index: number) {
		lines.value = lines.value.filter((_, i) => i !== index);
	}

	/** Dòng đủ dữ liệu để gửi: có số lượng, và có mặt hàng hoặc tên kèm đơn vị. */
	const readyLines = computed<CreateSupplyLineBody[]>(() =>
		lines.value
			.filter(line => line.qty != null && (line.custom ? line.customName.trim() && line.customUnit.trim() : line.itemId))
			.map(line =>
				line.custom
					? {
							customName: line.customName.trim(),
							customUnit: line.customUnit.trim(),
							requestedQty: line.qty as number,
						}
					: { itemId: line.itemId as number, requestedQty: line.qty as number },
			),
	);

	async function submit() {
		if (!departmentId.value || !note.value.trim() || !readyLines.value.length || saving.value) return;
		saving.value = true;
		try {
			const created = await service.createSupplement(props.periodId, {
				departmentId: departmentId.value,
				note: note.value.trim(),
				lines: readyLines.value,
			});
			toast.success(
				`Đã tạo phiếu bổ sung lần ${created.sequence} cho phòng ${created.department.name}. Trưởng phòng và đầu mối vừa nhận thông báo.`,
			);
			emit('created', created);
		} catch (e) {
			toast.error(officeErrorMessage(e, 'Chưa tạo được phiếu bổ sung. Bạn thử lại sau ít phút.'));
		} finally {
			saving.value = false;
		}
	}

	const inputCls =
		'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
	const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300';
</script>

<template>
	<Teleport to="body">
		<div
			class="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-2 sm:p-4"
			role="dialog"
			aria-modal="true"
			aria-label="Tạo phiếu bổ sung"
		>
			<div class="my-4 w-full max-w-3xl rounded-2xl bg-white shadow-xl sm:my-8 dark:bg-gray-900">
				<div class="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-4 sm:px-6 dark:border-gray-700">
					<div>
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">Phiếu bổ sung</h2>
						<p class="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
							{{ periodTitle }}. Phiếu bổ sung chỉ lập được khi kỳ đã khoá, và luôn phải có ghi chú.
						</p>
					</div>
					<button
						type="button"
						class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 sm:h-8 sm:w-8 dark:hover:bg-gray-800 dark:hover:text-gray-300"
						aria-label="Đóng hộp phiếu bổ sung"
						@click="emit('close')"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<form class="space-y-5 p-4 sm:p-6" @submit.prevent="submit">
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div class="space-y-1">
							<label :class="labelCls">Phòng ban <span class="text-red-500">*</span></label>
							<UiSelect v-model="departmentId" :options="departmentOptions" placeholder="Chọn phòng ban" />
						</div>
						<div class="space-y-1 sm:col-span-2">
							<label :class="labelCls">Ghi chú <span class="text-red-500">*</span></label>
							<input v-model="note" type="text" maxlength="500" :class="inputCls" placeholder="VD: Thiếu giấy in cho đợt quyết toán" />
						</div>
					</div>

					<div v-if="loadingItems" class="space-y-2">
						<div v-for="i in 2" :key="i" class="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
					</div>

					<div v-else class="space-y-3">
						<p :class="labelCls">Mặt hàng <span class="text-red-500">*</span></p>
						<div v-for="(line, index) in lines" :key="index" class="space-y-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
							<label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
								<input v-model="line.custom" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
								Mặt hàng ngoài danh mục
							</label>
							<div class="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px_auto] sm:items-center">
								<template v-if="line.custom">
									<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
										<input v-model="line.customName" type="text" maxlength="255" :class="inputCls" placeholder="Tên mặt hàng" />
										<input v-model="line.customUnit" type="text" maxlength="50" :class="inputCls" placeholder="Đơn vị tính" />
									</div>
								</template>
								<UiSelectInput
									v-else
									:model-value="line.itemId ?? null"
									:options="itemOptions"
									placeholder="Chọn mặt hàng"
									search-placeholder="Tìm mặt hàng"
									@update:model-value="line.itemId = Number($event)"
								/>
								<UiNumberInput v-model="line.qty" :min="1" :input-class="inputCls" placeholder="Số lượng" />
								<CommonAppButton v-if="lines.length > 1" size="sm" variant="ghost" type="button" @click="removeLine(index)">
									Bỏ dòng
								</CommonAppButton>
							</div>
						</div>
						<CommonAppButton size="sm" variant="outline" type="button" @click="addLine">Thêm dòng</CommonAppButton>
					</div>

					<div class="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
						<CommonAppButton variant="secondary" type="button" class="min-h-11 sm:min-h-0" @click="emit('close')">
							Đóng
						</CommonAppButton>
						<CommonAppButton
							variant="primary"
							type="submit"
							class="min-h-11 sm:min-h-0"
							:disabled="!departmentId || !note.trim() || !readyLines.length"
							:loading="saving"
						>
							Tạo phiếu bổ sung
						</CommonAppButton>
					</div>
				</form>
			</div>
		</div>
	</Teleport>
</template>
