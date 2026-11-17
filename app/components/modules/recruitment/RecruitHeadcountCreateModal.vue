<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import { usePositionService } from '~/services/position.service';
	import { recruitErrorMessage } from '~/utils/recruitment.utils';
	import type { PositionSummary } from '~/types/position.types';

	/**
	 * Thêm một dòng định biên cho (năm, vị trí).
	 *
	 * Chọn phòng ban trước rồi mới chọn vị trí. Một danh sách vị trí phẳng của cả công ty thì
	 * vừa dài vừa lẫn những vị trí trùng tên ở hai phòng khác nhau, nên tách làm hai bước và cả
	 * hai ô đều tìm được bằng cách gõ. Danh sách vị trí tải riêng theo phòng đang chọn
	 * (`GET /v1/positions?departmentId=`) thay vì lọc trong `directoryStore`, vì store nạp
	 * `positions` theo cả công ty và `PositionSummary.department` chỉ là TÊN phòng, không phải
	 * id, nên lọc theo đó là so chuỗi.
	 *
	 * Người có quyền chốt (Giám đốc, Trưởng ban, Admin) tạo thì BE CHỐT LUÔN; người chỉ phụ
	 * trách tuyển dụng tạo thì thành đề xuất Nháp chờ gửi. Hộp thoại nói trước điều đó để
	 * người dùng không tưởng mình vừa chốt xong.
	 */
	const props = defineProps<{
		year: number;
		/** `true` khi người dùng có `recruitment:headcount:confirm`. */
		confirmsImmediately: boolean;
		/** Id vị trí đã có dòng trong năm — BE trả 409 nếu tạo trùng. */
		usedPositionIds: number[];
	}>();

	const emit = defineEmits<{ created: []; close: [] }>();

	const service = useRecruitmentService();
	const positionService = usePositionService();
	const directoryStore = useDirectoryStore();
	const { departments } = storeToRefs(directoryStore);

	const departmentId = ref<number | null>(null);
	const positionId = ref<number | null>(null);
	const quantity = ref<number>(1);
	const note = ref('');
	const submitting = ref(false);
	const error = ref<string | null>(null);

	const positions = ref<PositionSummary[]>([]);
	const loadingPositions = ref(false);
	const positionError = ref<string | null>(null);

	onMounted(() => {
		directoryStore.load().catch(() => {
			error.value = 'Không tải được danh sách phòng ban';
		});
	});

	const departmentOptions = computed(() =>
		departments.value.filter(d => d.isActive).map(d => ({ value: d.id, label: d.name })),
	);

	/** Vị trí của phòng đang chọn, trừ những vị trí đã có dòng định biên trong năm. */
	const positionOptions = computed(() =>
		positions.value
			.filter(p => p.isActive && !props.usedPositionIds.includes(p.id))
			.map(p => ({ value: p.id, label: p.name })),
	);

	/** Phòng có vị trí, nhưng vị trí nào cũng đã có dòng định biên của năm này. */
	const allPositionsUsed = computed(
		() =>
			!!departmentId.value &&
			!loadingPositions.value &&
			!positionError.value &&
			positions.value.length > 0 &&
			positionOptions.value.length === 0,
	);

	/** Phòng chưa khai vị trí nào. */
	const departmentHasNoPosition = computed(
		() =>
			!!departmentId.value &&
			!loadingPositions.value &&
			!positionError.value &&
			positions.value.length === 0,
	);

	// Đổi phòng thì vị trí đang chọn không còn thuộc phòng mới, nên xoá hẳn chứ không giữ lại.
	watch(departmentId, async id => {
		positionId.value = null;
		positions.value = [];
		positionError.value = null;
		if (!id) return;
		loadingPositions.value = true;
		// Đổi phòng lúc đang tải thì bỏ kết quả của phòng cũ, kẻo vị trí phòng A hiện dưới phòng B.
		try {
			const list = await positionService.findActive(id);
			if (departmentId.value === id) positions.value = list;
		} catch (e) {
			if (departmentId.value === id)
				positionError.value = recruitErrorMessage(e, 'Không tải được danh sách vị trí của phòng này');
		} finally {
			if (departmentId.value === id) loadingPositions.value = false;
		}
	});

	async function save() {
		if (departmentId.value == null) {
			error.value = 'Chọn phòng ban trước';
			return;
		}
		if (positionId.value == null) {
			error.value = 'Chọn vị trí cần thêm định biên';
			return;
		}
		const q = Number(quantity.value);
		if (!Number.isInteger(q) || q < 0 || q > 10000) {
			error.value = 'Số định biên phải là số nguyên từ 0 đến 10.000';
			return;
		}
		submitting.value = true;
		error.value = null;
		try {
			await service.createHeadcountPlan({
				year: props.year,
				positionId: positionId.value,
				quantity: q,
				note: note.value.trim() || undefined,
			});
			emit('created');
		} catch (e) {
			error.value = recruitErrorMessage(e, 'Thêm dòng định biên thất bại');
		} finally {
			submitting.value = false;
		}
	}
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/50 p-4">
			<div class="my-8 w-full max-w-md rounded-2xl bg-white shadow-xl dark:bg-gray-900">
				<div class="flex items-start justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
					<div>
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">Thêm dòng định biên</h2>
						<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Năm {{ year }}</p>
					</div>
					<button
						type="button"
						class="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
						aria-label="Đóng"
						@click="emit('close')"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<form class="space-y-4 p-6" @submit.prevent="save">
					<p class="text-sm text-gray-600 dark:text-gray-300">
						<template v-if="confirmsImmediately">
							Bạn có quyền chốt định biên nên dòng này được chốt ngay khi lưu.
						</template>
						<template v-else>
							Dòng này được lưu thành đề xuất ở trạng thái Nháp, và chỉ có hiệu lực sau khi người
							có quyền chốt đồng ý.
						</template>
					</p>

					<div class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
							Phòng ban <span class="text-red-500">*</span>
						</label>
						<UiSelectInput
							v-model="departmentId"
							:options="departmentOptions"
							placeholder="Chọn phòng ban..."
							search-placeholder="Gõ tên phòng ban để tìm..."
						/>
					</div>

					<div class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
							Vị trí <span class="text-red-500">*</span>
						</label>
						<UiSelectInput
							v-model="positionId"
							:options="positionOptions"
							:disabled="!departmentId || loadingPositions || !positionOptions.length"
							:placeholder="
								!departmentId
									? 'Chọn phòng ban trước'
									: loadingPositions
										? 'Đang tải danh sách vị trí...'
										: 'Chọn vị trí...'
							"
							search-placeholder="Gõ tên vị trí để tìm..."
						/>

						<p v-if="positionError" class="text-xs text-rose-600 dark:text-rose-400">
							{{ positionError }}
						</p>
						<p v-else-if="!departmentId" class="text-xs text-gray-500 dark:text-gray-400">
							Chọn phòng ban trước, danh sách vị trí lấy theo phòng đó.
						</p>
						<p v-else-if="departmentHasNoPosition" class="text-xs text-amber-700 dark:text-amber-400">
							Phòng này chưa khai vị trí nào đang dùng. Hãy thêm vị trí ở phần Cài đặt vị trí trước.
						</p>
						<p v-else-if="allPositionsUsed" class="text-xs text-amber-700 dark:text-amber-400">
							Mọi vị trí của phòng này đã có dòng định biên năm {{ year }}. Hãy sửa dòng đang có, hoặc
							chọn phòng khác.
						</p>
						<p v-else class="text-xs text-gray-500 dark:text-gray-400">
							Vị trí đã có dòng trong năm này không hiện ở đây, hãy sửa dòng đang có.
						</p>
					</div>

					<div class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
							Số định biên <span class="text-red-500">*</span>
						</label>
						<input
							v-model.number="quantity"
							type="number"
							min="0"
							max="10000"
							step="1"
							class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
						/>
					</div>

					<div class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Ghi chú</label>
						<textarea
							v-model="note"
							rows="2"
							placeholder="Căn cứ của con số này..."
							class="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
						/>
					</div>

					<p v-if="error" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
						{{ error }}
					</p>

					<div class="flex justify-end gap-3 pt-1">
						<CommonAppButton variant="secondary" type="button" @click="emit('close')">Huỷ</CommonAppButton>
						<CommonAppButton variant="primary" type="submit" :loading="submitting">Thêm</CommonAppButton>
					</div>
				</form>
			</div>
		</div>
	</Teleport>
</template>
