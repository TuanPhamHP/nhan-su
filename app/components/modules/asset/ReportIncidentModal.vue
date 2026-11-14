<script setup lang="ts">
	import { useAssetService } from '~/services/asset.service';
	import { todayYmd } from '~/utils/date';
	import { formatPhotoSize, preparePhoto } from '~/utils/image-compress';
	import type { AssetIncident, AssetIncidentType } from '~/types/asset.types';

	/**
	 * Nhân viên báo hỏng hoặc báo mất thiết bị mình đang giữ.
	 *
	 * Giống các hộp tải file khác của module, form này dùng `ref` thường chứ không qua
	 * vee-validate: phần cần kiểm là file và số lượng ảnh, thứ mà vài dòng dưới đây lo gọn hơn
	 * một schema.
	 *
	 * Ảnh không còn bị ô chọn file loại ngay: ảnh JPG, PNG lớn được thu nhỏ trên máy trước khi
	 * gửi, còn tệp không gửi được (PDF, HEIC quá nặng) vẫn nằm trong danh sách kèm lý do và nút
	 * Gửi tắt cho tới khi người dùng bỏ tệp đó ra. Trước đây ảnh 6 MB bị loại âm thầm và báo hỏng
	 * đi mà không có ảnh nào. BE vẫn kiểm lại và có mã lỗi riêng cho từng trường hợp.
	 */
	const props = defineProps<{
		assetId: number;
		assetLabel: string;
		type: AssetIncidentType;
	}>();

	const emit = defineEmits<{
		reported: [incident: AssetIncident];
		close: [];
	}>();

	const toast = useToast();
	const service = useAssetService();

	const MAX_PHOTOS = 10;
	const MAX_BYTES = 5 * 1024 * 1024;
	const ACCEPT = '.jpg,.jpeg,.png,.heic,image/jpeg,image/png,image/heic';
	const MAX_DESCRIPTION = 4000;

	interface PhotoItem {
		key: string;
		name: string;
		originalSize: number;
		status: 'processing' | 'ready' | 'invalid';
		/** File sẽ gửi đi, có thể là bản đã thu nhỏ. */
		file: File | null;
		compressed: boolean;
		error: string | null;
	}

	const description = ref('');
	const occurredOn = ref(todayYmd());
	const photos = ref<PhotoItem[]>([]);
	const photoError = ref<string | null>(null);
	const submitting = ref(false);

	const isLoss = computed(() => props.type === 'LOSS');
	const title = computed(() => (isLoss.value ? 'Báo mất tài sản' : 'Báo hỏng tài sản'));
	const descriptionLabel = computed(() =>
		isLoss.value ? 'Mất trong hoàn cảnh nào' : 'Hỏng ở đâu, hỏng thế nào',
	);
	const descriptionPlaceholder = computed(() =>
		isLoss.value
			? 'VD: để quên ở điểm giao hàng, quay lại tìm không thấy'
			: 'VD: màn hình máy quét bị nứt, bấm phím quét không ăn',
	);

	/**
	 * Ngày phát hiện không được ở tương lai (400 `ASSET_INCIDENT_DATE_IN_FUTURE`).
	 *
	 * `UiDatePicker` chặn ngày tương lai trong lịch, nhưng người dùng vẫn gõ tay được vào ô,
	 * nên kiểm lại ở đây và báo ngay dưới ô thay vì để họ bấm gửi rồi mới biết.
	 */
	const dateError = computed(() =>
		occurredOn.value && occurredOn.value > todayYmd() ? 'Ngày phát hiện không được sau hôm nay.' : '',
	);

	const processingCount = computed(() => photos.value.filter(p => p.status === 'processing').length);
	const invalidCount = computed(() => photos.value.filter(p => p.status === 'invalid').length);

	/** Vì sao chưa gửi được, nói ngay cạnh nút thay vì để nút tắt không lời giải thích. */
	const blockReason = computed(() => {
		if (invalidCount.value) {
			return invalidCount.value === 1
				? 'Còn một tệp không gửi được. Bạn bỏ tệp đó ra rồi bấm Gửi báo cáo.'
				: `Còn ${invalidCount.value} tệp không gửi được. Bạn bỏ các tệp đó ra rồi bấm Gửi báo cáo.`;
		}
		if (processingCount.value) return 'Ảnh đang được thu nhỏ, bạn chờ một chút rồi bấm Gửi báo cáo.';
		if (!description.value.trim()) return 'Bạn nhập mô tả ở ô đầu tiên để gửi được báo cáo.';
		if (dateError.value) return 'Bạn chọn lại ngày phát hiện, không chọn ngày sau hôm nay.';
		return '';
	});

	const canSubmit = computed(() => !blockReason.value && !submitting.value);

	let seq = 0;

	/**
	 * Nhận ảnh mới chọn. Ô chọn file không tự kiểm (`:validate="false"`), nên mọi tệp đều vào
	 * danh sách rồi được kiểm và thu nhỏ từng cái. Vượt trần 10 ảnh thì GIỮ NGUYÊN danh sách cũ:
	 * cắt bớt im lặng thì người dùng tưởng đã gửi đủ ảnh.
	 */
	function onPhotosPicked(value: File | File[] | null) {
		const incoming = Array.isArray(value) ? value : value ? [value] : [];
		if (!incoming.length) return;
		const total = photos.value.length + incoming.length;
		if (total > MAX_PHOTOS) {
			photoError.value = `Mỗi báo cáo gửi tối đa ${MAX_PHOTOS} ảnh, bạn đang chọn ${total}. Bạn bỏ bớt ảnh rồi chọn lại.`;
			return;
		}
		photoError.value = null;
		for (const original of incoming) {
			const item: PhotoItem = {
				key: `p${++seq}`,
				name: original.name,
				originalSize: original.size,
				status: 'processing',
				file: null,
				compressed: false,
				error: null,
			};
			photos.value.push(item);
			void preparePhoto(original, MAX_BYTES).then(result => {
				const target = photos.value.find(p => p.key === item.key);
				if (!target) return;
				target.file = result.file;
				target.compressed = result.compressed;
				target.error = result.error;
				target.status = result.error ? 'invalid' : 'ready';
			});
		}
	}

	function removePhoto(key: string) {
		photos.value = photos.value.filter(p => p.key !== key);
		photoError.value = null;
	}

	useEscapeKey(
		() => emit('close'),
		() => !submitting.value,
	);

	async function submit() {
		if (!canSubmit.value) return;
		submitting.value = true;
		try {
			const incident = await service.reportIncident(props.assetId, {
				type: props.type,
				description: description.value.trim(),
				occurredOn: occurredOn.value || undefined,
				photos: photos.value.map(p => p.file).filter((f): f is File => !!f),
			});
			toast.success(
				isLoss.value
					? `Đã gửi báo mất ${props.assetLabel}. Tài sản tạm chuyển sang Chờ xác minh mất cho tới khi người quản lý tài sản xác minh.`
					: `Đã gửi báo hỏng ${props.assetLabel}. Người quản lý tài sản và quản lý trực tiếp của bạn đã nhận được thông báo.`,
			);
			emit('reported', incident);
		} catch (e) {
			// Mất mạng hay lỗi máy chủ thì hộp vẫn mở, chữ và ảnh còn nguyên để bấm gửi lại.
			toast.error(e instanceof Error ? e.message : 'Chưa gửi được báo cáo. Bạn thử lại sau ít phút.');
		} finally {
			submitting.value = false;
		}
	}

	const inputCls =
		'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
	const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300';
</script>

<template>
	<Teleport to="body">
		<div
			class="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-4"
			role="dialog"
			aria-modal="true"
			:aria-label="title"
		>
			<div class="my-8 w-full max-w-lg rounded-2xl bg-white shadow-xl dark:bg-gray-900">
				<div class="flex items-start justify-between gap-3 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
					<div class="min-w-0">
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ title }}</h2>
						<p class="mt-0.5 break-words text-xs text-gray-600 dark:text-gray-400">{{ assetLabel }}</p>
					</div>
					<button
						type="button"
						class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 sm:h-8 sm:w-8 dark:hover:bg-gray-800 dark:hover:text-gray-300"
						:aria-label="`Đóng hộp ${title.toLowerCase()}`"
						@click="emit('close')"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<form class="space-y-4 p-6" @submit.prevent="submit">
					<p class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
						<template v-if="isLoss">
							Gửi xong, tài sản chuyển sang Chờ xác minh mất và người quản lý tài sản sẽ xác minh trước khi
							ghi nhận mất.
						</template>
						<template v-else>
							Người quản lý tài sản và quản lý trực tiếp của bạn sẽ nhận được thông báo để xử lý.
						</template>
					</p>

					<div class="space-y-1">
						<label :class="labelCls">{{ descriptionLabel }} <span class="text-red-500">*</span></label>
						<textarea
							v-model="description"
							rows="3"
							:maxlength="MAX_DESCRIPTION"
							:class="`${inputCls} resize-none`"
							:placeholder="descriptionPlaceholder"
						/>
					</div>

					<div class="space-y-1">
						<label :class="labelCls">Ngày phát hiện</label>
						<UiDatePicker v-model="occurredOn" :max="todayYmd()" :error="dateError" />
						<!-- Câu lỗi do chính UiDatePicker hiện qua `:error`, ở đây chỉ còn câu gợi ý. -->
						<p v-if="!dateError" class="text-xs text-gray-600 dark:text-gray-400">
							Để trống thì tính là hôm nay. Không chọn được ngày trong tương lai.
						</p>
					</div>

					<div class="space-y-2">
						<label :class="labelCls">Ảnh kèm theo</label>
						<UiFileDropzone
							:model-value="[]"
							multiple
							:accept="ACCEPT"
							:validate="false"
							:error="photoError"
							:hint="`Ảnh JPG, PNG hoặc HEIC, tối đa ${MAX_PHOTOS} ảnh. Ảnh lớn được tự thu nhỏ trước khi gửi.`"
							@update:model-value="onPhotosPicked"
						/>

						<ul v-if="photos.length" class="space-y-2">
							<li
								v-for="photo in photos"
								:key="photo.key"
								class="flex items-start gap-3 rounded-xl border p-3"
								:class="
									photo.status === 'invalid'
										? 'border-rose-300 bg-rose-50 dark:border-rose-700 dark:bg-rose-900/20'
										: 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
								"
							>
								<div class="min-w-0 flex-1">
									<p class="truncate text-sm font-medium text-gray-800 dark:text-gray-100">{{ photo.name }}</p>
									<p v-if="photo.status === 'processing'" class="text-xs text-gray-600 dark:text-gray-400">
										Đang thu nhỏ ảnh {{ formatPhotoSize(photo.originalSize) }}…
									</p>
									<p v-else-if="photo.status === 'invalid'" class="text-sm text-rose-700 dark:text-rose-300">
										{{ photo.error }}
									</p>
									<p v-else-if="photo.compressed && photo.file" class="text-xs text-emerald-700 dark:text-emerald-400">
										Đã thu nhỏ từ {{ formatPhotoSize(photo.originalSize) }} còn {{ formatPhotoSize(photo.file.size) }}.
									</p>
									<p v-else class="text-xs text-gray-600 dark:text-gray-400">{{ formatPhotoSize(photo.originalSize) }}</p>
								</div>
								<button
									type="button"
									class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-rose-600 sm:h-8 sm:w-8 dark:hover:bg-gray-700"
									:aria-label="`Bỏ ảnh ${photo.name}`"
									@click="removePhoto(photo.key)"
								>
									<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							</li>
						</ul>
					</div>

					<p
						v-if="blockReason"
						class="rounded-lg px-3 py-2 text-sm"
						:class="
							invalidCount
								? 'bg-rose-50 text-rose-800 dark:bg-rose-900/20 dark:text-rose-300'
								: 'bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
						"
						role="status"
					>
						{{ blockReason }}
					</p>

					<div class="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end sm:gap-3">
						<CommonAppButton variant="secondary" type="button" class="min-h-11 sm:min-h-0" @click="emit('close')">
							Đóng
						</CommonAppButton>
						<CommonAppButton
							variant="primary"
							type="submit"
							class="min-h-11 sm:min-h-0"
							:disabled="!canSubmit"
							:loading="submitting"
						>
							Gửi báo cáo
						</CommonAppButton>
					</div>
				</form>
			</div>
		</div>
	</Teleport>
</template>
