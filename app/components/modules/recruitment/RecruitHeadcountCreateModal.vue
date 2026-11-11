<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import { recruitErrorMessage } from '~/utils/recruitment.utils';

	/**
	 * Thêm một dòng định biên cho (năm, vị trí). Phòng ban lấy theo vị trí, không chọn riêng.
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
	const directoryStore = useDirectoryStore();
	const { positions } = storeToRefs(directoryStore);

	const positionId = ref<number | undefined>(undefined);
	const quantity = ref<number>(1);
	const note = ref('');
	const submitting = ref(false);
	const error = ref<string | null>(null);

	onMounted(() => {
		directoryStore.load().catch(() => {
			error.value = 'Không tải được danh sách vị trí';
		});
	});

	const positionOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Chọn vị trí...' },
		...positions.value
			.filter(p => p.isActive && !props.usedPositionIds.includes(p.id))
			.map(p => ({ value: p.id as number | undefined, label: `${p.name} — ${p.department}` })),
	]);

	async function save() {
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
							Vị trí <span class="text-red-500">*</span>
						</label>
						<UiSelect v-model="positionId" :options="positionOptions" />
						<p class="text-xs text-gray-500 dark:text-gray-400">
							Phòng ban được lấy theo vị trí. Vị trí đã có dòng trong năm này không hiện ở đây, hãy
							sửa dòng đang có.
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
