<script setup lang="ts">
	import { useOfficeService } from '~/services/office.service';
	import { officeErrorCode, officeErrorMessage } from '~/utils/office.utils';
	import { vnSearchText } from '~/utils/vn-text';
	import type { OfficeSite } from '~/types/office.types';

	/**
	 * Thêm hoặc sửa một văn phòng, trong hộp thoại.
	 *
	 * Vì sao là hộp thoại chứ không phải form chen trong trang: form cũ mở ra ngay phía trên các thẻ
	 * văn phòng, nên nó trông như một thẻ văn phòng nữa đang được dựng, và người dùng nhìn vào không
	 * biết mình đang ở bước nào. Hộp thoại tách hẳn việc "khai một văn phòng mới" khỏi danh sách
	 * đang có.
	 *
	 * Form "Thêm phòng họp" thì vẫn nằm trong thẻ của văn phòng, không đưa vào hộp thoại: thêm liền
	 * vài phòng cho cùng một văn phòng là việc người dùng làm nhiều nhất, và mở hộp thoại cho từng
	 * phòng sẽ phá đúng chỗ đó.
	 */
	const props = defineProps<{
		/** Văn phòng đang sửa; bỏ trống là thêm mới. */
		site?: OfficeSite | null;
		/** Danh sách văn phòng đang có, để chỉ đúng thẻ khi người dùng gõ trùng tên. */
		sites: OfficeSite[];
	}>();

	const emit = defineEmits<{
		saved: [site: OfficeSite];
		/** Người dùng bấm "Đi tới thẻ …" ở câu lỗi trùng tên. */
		goToSite: [siteId: number];
		close: [];
	}>();

	const toast = useToast();
	const service = useOfficeService();

	const editing = computed(() => !!props.site);

	const form = reactive({
		name: props.site?.name ?? '',
		address: props.site?.address ?? '',
		isActive: props.site?.isActive ?? true,
	});

	const nameError = ref('');
	/** Văn phòng đã có cùng tên; hiện kèm liên kết đi tới thẻ của nó. */
	const duplicate = ref<OfficeSite | null>(null);
	const saving = ref(false);

	useEscapeKey(
		() => emit('close'),
		() => !saving.value,
	);

	watch(
		() => form.name,
		() => {
			// Người dùng vừa sửa tên thì câu lỗi cũ hết đúng.
			nameError.value = '';
			duplicate.value = null;
		},
	);

	async function submit() {
		if (!form.name.trim() || saving.value) return;
		saving.value = true;
		nameError.value = '';
		duplicate.value = null;
		try {
			const saved = props.site
				? await service.updateSite(props.site.id, {
						name: form.name.trim(),
						address: form.address.trim() || undefined,
						isActive: form.isActive,
					})
				: await service.createSite({ name: form.name.trim(), address: form.address.trim() || undefined });
			toast.success(`Đã lưu văn phòng ${form.name.trim()}.`);
			emit('saved', saved);
		} catch (e) {
			// Trùng tên là lỗi của ĐÚNG một ô, nên câu lỗi nằm ngay dưới ô tên. Người gặp lỗi này
			// thường đang muốn thêm một phòng họp cho văn phòng đã có, nên kèm luôn đường đi tới thẻ
			// của nó thay vì bỏ họ lại trong hộp thoại.
			if (officeErrorCode(e) === 'OFFICE_SITE_NAME_EXISTS') {
				nameError.value = officeErrorMessage(e, 'Tên văn phòng này đã có.');
				duplicate.value =
					props.sites.find(site => vnSearchText(site.name) === vnSearchText(form.name.trim())) ?? null;
			} else {
				// Ngừng văn phòng còn lượt đặt sắp tới: câu của máy chủ nêu rõ còn bao nhiêu lượt.
				toast.error(officeErrorMessage(e, 'Chưa lưu được văn phòng. Bạn thử lại sau ít phút.'));
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
			:aria-label="editing ? 'Sửa văn phòng' : 'Thêm văn phòng'"
		>
			<div class="my-4 w-full max-w-xl rounded-2xl bg-white shadow-xl sm:my-8 dark:bg-gray-900">
				<div class="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-4 sm:px-6 dark:border-gray-700">
					<div>
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">
							{{ editing ? `Sửa văn phòng ${site?.name}` : 'Thêm văn phòng' }}
						</h2>
						<p class="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
							Văn phòng là toà nhà hay địa điểm làm việc của công ty.
						</p>
					</div>
					<button
						type="button"
						class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 sm:h-8 sm:w-8 dark:hover:bg-gray-800 dark:hover:text-gray-300"
						aria-label="Đóng hộp văn phòng"
						@click="emit('close')"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<form class="space-y-4 p-4 sm:p-6" @submit.prevent="submit">
					<div class="space-y-1">
						<label :class="labelCls">Tên văn phòng <span class="text-red-500">*</span></label>
						<input
							v-model="form.name"
							type="text"
							maxlength="200"
							:class="inputCls"
							placeholder="VD: Văn phòng Hữu Nghị"
						/>
						<p v-if="nameError" class="text-xs text-red-500">{{ nameError }}</p>
						<p v-if="duplicate" class="text-sm text-amber-700 dark:text-amber-300">
							Văn phòng này đã có trong danh sách. Bạn thêm phòng họp cho nó ở thẻ của nó.
							<button
								type="button"
								class="font-medium text-brand-600 underline hover:text-brand-700 dark:text-brand-400"
								@click="emit('goToSite', duplicate.id)"
							>
								Đi tới thẻ {{ duplicate.name }}
							</button>
						</p>
					</div>

					<div class="space-y-1">
						<label :class="labelCls">Địa chỉ</label>
						<!-- Địa chỉ là địa chỉ của TOÀ NHÀ: ví dụ phải là đường phố, không phải tầng và số phòng. -->
						<input
							v-model="form.address"
							type="text"
							maxlength="255"
							:class="inputCls"
							placeholder="VD: 25 Lý Thường Kiệt, Hoàn Kiếm"
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

					<!-- Nhắc trước điều người dùng hay nhầm: tầng và số phòng là phòng họp, không phải văn phòng. -->
					<p class="text-xs text-gray-500 dark:text-gray-400">
						Tầng, số phòng là phòng họp: bạn thêm vào văn phòng ở bước sau.
					</p>

					<div class="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
						<CommonAppButton variant="secondary" type="button" class="min-h-11 sm:min-h-0" @click="emit('close')">
							Đóng
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
