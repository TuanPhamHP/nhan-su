<script setup lang="ts">
	import { useOfficeService } from '~/services/office.service';
	import { officeErrorCode, officeErrorMessage } from '~/utils/office.utils';
	import type { MeetingRoom, OfficeSite } from '~/types/office.types';

	/**
	 * Thêm hoặc sửa một phòng họp, trong hộp thoại.
	 *
	 * Phòng luôn thuộc đúng văn phòng mà người dùng bấm thêm từ đó, nên hộp thoại không có ô chọn
	 * văn phòng: nó chỉ ghi tên văn phòng ở đầu hộp. Như vậy không ai tạo nhầm phòng sang văn phòng
	 * khác, và cũng không phải chọn lại một thứ mình vừa chọn.
	 *
	 * Thêm liền vài phòng cho cùng một văn phòng là việc người dùng làm nhiều nhất lúc mới khai báo,
	 * nên lúc thêm mới hộp có hai nút lưu: "Lưu" đóng hộp, còn "Lưu và thêm phòng nữa" giữ hộp mở và
	 * xoá trắng các ô để gõ tiếp phòng sau.
	 */
	const props = defineProps<{
		/** Phòng đang sửa; bỏ trống là thêm mới. */
		room?: MeetingRoom | null;
		/** Văn phòng chứa phòng này, chọn sẵn theo khối mà người dùng bấm thêm. */
		site: OfficeSite;
		/** Gợi ý thiết bị: danh sách mẫu cộng thứ các phòng khác đang dùng. */
		equipmentSuggestions?: string[];
	}>();

	const emit = defineEmits<{
		/** Lưu xong; `keepOpen` là true khi người dùng bấm "Lưu và thêm phòng nữa". */
		saved: [room: MeetingRoom, keepOpen: boolean];
		close: [];
	}>();

	const toast = useToast();
	const service = useOfficeService();

	const editing = computed(() => !!props.room);

	const form = reactive({
		name: props.room?.name ?? '',
		capacity: props.room?.capacity ?? undefined,
		equipment: [...(props.room?.equipment ?? [])],
		note: props.room?.note ?? '',
		sortOrder: props.room?.sortOrder,
		isActive: props.room?.isActive ?? true,
	});

	const nameError = ref('');
	const saving = ref(false);
	/** Thứ tự hiện nằm trong mục gấp lại: phần lớn phòng không cần đặt. */
	const showMoreOptions = ref(false);
	const nameInput = ref<HTMLInputElement | null>(null);

	useEscapeKey(
		() => emit('close'),
		() => !saving.value,
	);

	onMounted(() => nameInput.value?.focus());

	watch(
		() => form.name,
		() => {
			nameError.value = '';
		},
	);

	/** Xoá trắng các ô để gõ phòng tiếp theo, giữ nguyên văn phòng. */
	function resetForNext() {
		Object.assign(form, {
			name: '',
			capacity: undefined,
			equipment: [],
			note: '',
			sortOrder: undefined,
			isActive: true,
		});
		nameError.value = '';
		nextTick(() => nameInput.value?.focus());
	}

	async function submit(keepOpen = false) {
		if (!form.name.trim() || saving.value) return;
		saving.value = true;
		nameError.value = '';
		try {
			const saved = props.room
				? await service.updateRoom(props.room.id, {
						officeSiteId: props.site.id,
						name: form.name.trim(),
						capacity: form.capacity,
						equipment: [...form.equipment],
						note: form.note.trim(),
						sortOrder: form.sortOrder,
						isActive: form.isActive,
					})
				: await service.createRoom({
						officeSiteId: props.site.id,
						name: form.name.trim(),
						capacity: form.capacity,
						equipment: [...form.equipment],
						note: form.note.trim() || undefined,
						sortOrder: form.sortOrder,
					});
			toast.success(`Đã lưu phòng họp ${form.name.trim()}.`);
			if (keepOpen) resetForNext();
			emit('saved', saved, keepOpen);
		} catch (e) {
			// Trùng tên là lỗi của đúng một ô, nên câu lỗi nằm ngay dưới ô tên. Các lỗi khác, kể cả
			// `OFFICE_ROOM_HAS_BOOKINGS` khi ngừng phòng còn lượt sắp tới, hiện nguyên văn câu máy
			// chủ trả về vì câu đó nêu số lượt phải dời.
			if (officeErrorCode(e) === 'OFFICE_ROOM_NAME_EXISTS') {
				nameError.value = officeErrorMessage(e, 'Văn phòng này đã có phòng họp tên như vậy.');
			} else {
				toast.error(officeErrorMessage(e, 'Chưa lưu được phòng họp. Bạn thử lại sau ít phút.'));
			}
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
			:aria-label="editing ? 'Sửa phòng họp' : 'Thêm phòng họp'"
		>
			<div class="my-4 w-full max-w-xl rounded-2xl bg-white shadow-xl sm:my-8 dark:bg-gray-900">
				<div
					class="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-4 sm:px-6 dark:border-gray-700"
				>
					<div class="min-w-0">
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">
							{{ editing ? `Sửa phòng ${room?.name}` : 'Thêm phòng họp' }}
						</h2>
						<!-- Tên văn phòng ở đây thay cho ô chọn: phòng thuộc đúng khối người dùng vừa bấm. -->
						<p class="mt-0.5 truncate text-xs text-gray-600 dark:text-gray-400">
							Trong {{ site.name }}
						</p>
					</div>
					<button
						type="button"
						class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 sm:h-8 sm:w-8 dark:hover:bg-gray-800 dark:hover:text-gray-300"
						aria-label="Đóng hộp phòng họp"
						@click="emit('close')"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<form class="space-y-4 p-4 sm:p-6" @submit.prevent="submit(false)">
					<div class="space-y-1">
						<label :class="labelCls">Tên phòng <span class="text-red-500">*</span></label>
						<input
							ref="nameInput"
							v-model="form.name"
							type="text"
							maxlength="200"
							:class="inputCls"
							placeholder="VD: Phòng họp tầng 3"
						/>
						<p v-if="nameError" class="text-xs text-red-500">{{ nameError }}</p>
					</div>

					<div class="space-y-1">
						<div class="flex items-center gap-1.5">
							<label :class="labelCls">Sức chứa</label>
							<UiTooltip label="Số người ngồi được trong phòng. Người đặt phòng thấy số này khi chọn phòng.">
								<Icon
									name="heroicons:information-circle"
									class="h-4 w-4 text-gray-400 dark:text-gray-500"
									aria-label="Số người ngồi được trong phòng. Người đặt phòng thấy số này khi chọn phòng."
								/>
							</UiTooltip>
						</div>
						<UiNumberInput v-model="form.capacity" :min="1" :input-class="inputCls" placeholder="Số người" />
					</div>

					<!--
						Thiết bị chọn bằng chip: gợi ý gồm danh sách mẫu và thứ các phòng khác đang dùng, nên
						cùng một cái máy chiếu không bị ghi thành ba kiểu chữ khác nhau ở ba phòng.
					-->
					<UiTagInput
						v-model="form.equipment"
						label="Thiết bị"
						hint="Chọn trong gợi ý, hoặc gõ tên rồi nhấn Enter để thêm."
						placeholder="Chọn hoặc gõ tên thiết bị"
						:suggestions="equipmentSuggestions"
						:max-items="20"
						:max-length="50"
					/>

					<div class="space-y-1">
						<label :class="labelCls">Ghi chú</label>
						<input
							v-model="form.note"
							type="text"
							maxlength="255"
							:class="inputCls"
							placeholder="VD: Mượn chìa khoá ở lễ tân"
						/>
					</div>

					<!-- Thứ tự hiện và trạng thái gấp vào đây: hai thứ ít ai đặt, để lộ ra thì hộp trông dài. -->
					<div class="rounded-lg border border-gray-200 dark:border-gray-700">
						<button
							type="button"
							class="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300"
							:aria-expanded="showMoreOptions"
							@click="showMoreOptions = !showMoreOptions"
						>
							Tuỳ chọn thêm
							<Icon
								:name="showMoreOptions ? 'heroicons:chevron-up' : 'heroicons:chevron-down'"
								class="h-4 w-4 flex-shrink-0 text-gray-400"
								aria-hidden="true"
							/>
						</button>
						<div v-if="showMoreOptions" class="space-y-4 border-t border-gray-200 p-3 dark:border-gray-700">
							<div class="space-y-1">
								<div class="flex items-center gap-1.5">
									<label :class="labelCls">Thứ tự hiện</label>
									<UiTooltip
										label="Số nhỏ hiện trước trong danh sách chọn phòng. Bỏ trống thì phòng xếp cuối."
									>
										<Icon
											name="heroicons:information-circle"
											class="h-4 w-4 text-gray-400 dark:text-gray-500"
											aria-label="Số nhỏ hiện trước trong danh sách chọn phòng. Bỏ trống thì phòng xếp cuối."
										/>
									</UiTooltip>
								</div>
								<UiNumberInput
									v-model="form.sortOrder"
									:min="0"
									:input-class="inputCls"
									placeholder="Bỏ trống thì xếp cuối"
								/>
							</div>
							<label v-if="editing" class="flex items-center gap-2">
								<input
									v-model="form.isActive"
									type="checkbox"
									class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
								/>
								<span class="text-sm text-gray-700 dark:text-gray-300">Đang dùng</span>
							</label>
						</div>
					</div>

					<div class="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
						<CommonAppButton variant="secondary" type="button" class="min-h-11 sm:min-h-0" @click="emit('close')">
							Đóng
						</CommonAppButton>
						<!-- Chỉ lúc thêm mới có nút này: sửa một phòng thì không có "phòng nữa" nào để thêm. -->
						<CommonAppButton
							v-if="!editing"
							variant="outline"
							type="button"
							class="min-h-11 sm:min-h-0"
							:disabled="!form.name.trim()"
							:loading="saving"
							@click="submit(true)"
						>
							Lưu và thêm phòng nữa
						</CommonAppButton>
						<CommonAppButton
							variant="primary"
							type="submit"
							class="min-h-11 sm:min-h-0"
							:disabled="!form.name.trim()"
							:loading="saving"
						>
							Lưu
						</CommonAppButton>
					</div>
				</form>
			</div>
		</div>
	</Teleport>
</template>
