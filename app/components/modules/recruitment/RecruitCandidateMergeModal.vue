<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import { recruitErrorMessage } from '~/utils/recruitment.utils';
	import type { RecruitmentCandidateDetail } from '~/types/recruitment.types';

	/**
	 * Gộp hai hồ sơ của cùng một người.
	 *
	 * Bản được GIỮ là bản **tạo sau**, không phải bản đang mở, nên `data.id` trả về có thể
	 * khác id trên đường dẫn — nơi gọi phải điều hướng theo id trong kết quả. Hai hồ sơ cùng
	 * đang xét ở một tin thì không gộp được: đóng một hồ sơ rồi gộp lại.
	 */
	const props = defineProps<{ candidate: RecruitmentCandidateDetail }>();

	const emit = defineEmits<{ merged: [keptId: number]; close: [] }>();

	const service = useRecruitmentService();

	const sourceId = ref<number | undefined>(props.candidate.duplicates[0]?.id);
	const submitting = ref(false);
	const error = ref<string | null>(null);

	const options = computed(() =>
		props.candidate.duplicates.map(d => ({
			value: d.id as number | undefined,
			label: d.isBlacklisted ? `${d.fullName} (đang bị đánh dấu không tái tuyển)` : d.fullName,
		})),
	);

	async function merge() {
		if (sourceId.value == null) {
			error.value = 'Chọn hồ sơ cần gộp';
			return;
		}
		submitting.value = true;
		error.value = null;
		try {
			const kept = await service.mergeCandidates(props.candidate.id, sourceId.value);
			emit('merged', kept.id);
		} catch (e) {
			error.value = recruitErrorMessage(e, 'Gộp hồ sơ thất bại');
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
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">Gộp hồ sơ trùng</h2>
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

				<form class="space-y-4 p-6" @submit.prevent="merge">
					<p class="text-sm text-gray-600 dark:text-gray-300">
						Gộp <strong>{{ candidate.fullName }}</strong> với một hồ sơ trùng. Hệ thống giữ lại hồ sơ
						được tạo sau và dồn toàn bộ lần ứng tuyển, file, bình luận và lịch sử của hồ sơ kia sang.
					</p>

					<div class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
							Hồ sơ trùng <span class="text-red-500">*</span>
						</label>
						<UiSelect v-model="sourceId" :options="options" />
					</div>

					<ul class="space-y-1 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">
						<li>Trường nào hồ sơ giữ lại còn trống thì lấy của hồ sơ kia; họ tên luôn giữ của hồ sơ chính.</li>
						<li>Một trong hai nằm trong kho tiềm năng thì hồ sơ giữ lại cũng nằm trong kho.</li>
						<li>Một trong hai bị đánh dấu không tái tuyển thì hồ sơ giữ lại mang dấu đó.</li>
						<li>Hồ sơ còn lại biến mất khỏi mọi danh sách và không mở lại được.</li>
					</ul>

					<p v-if="error" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
						{{ error }}
					</p>

					<div class="flex justify-end gap-3 pt-1">
						<CommonAppButton variant="secondary" type="button" @click="emit('close')">Huỷ</CommonAppButton>
						<CommonAppButton variant="primary" type="submit" :loading="submitting">Gộp</CommonAppButton>
					</div>
				</form>
			</div>
		</div>
	</Teleport>
</template>
