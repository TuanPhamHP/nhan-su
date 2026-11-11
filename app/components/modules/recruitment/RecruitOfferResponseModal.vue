<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import { recruitErrorMessage } from '~/utils/recruitment.utils';
	import type { RecruitmentOffer, RecruitmentReason } from '~/types/recruitment.types';

	/**
	 * Nhân sự ghi lại câu trả lời ứng viên đưa qua điện thoại hay email, thay cho việc họ bấm
	 * link trong thư. Ứng viên vừa trả lời qua link trước đó thì hệ thống từ chối ghi đè, nên
	 * hộp thoại giữ nguyên và câu lỗi nói rõ điều đó.
	 */
	const props = defineProps<{ offer: RecruitmentOffer }>();

	const emit = defineEmits<{ recorded: [offer: RecruitmentOffer]; close: [] }>();

	const service = useRecruitmentService();

	const decision = ref<'ACCEPT' | 'DECLINE'>('ACCEPT');
	const reasonId = ref<number | undefined>(undefined);
	const note = ref('');
	const reasons = ref<RecruitmentReason[]>([]);
	const submitting = ref(false);
	const error = ref<string | null>(null);

	onMounted(async () => {
		try {
			reasons.value = await service.findReasons({ kind: 'OFFER_DECLINE', activeOnly: true });
		} catch {
			// Danh mục rỗng thì chỉ ghi nhận đồng ý được; từ chối sẽ báo thiếu lý do.
		}
	});

	const decisionOptions = [
		{ value: 'ACCEPT', label: 'Ứng viên đồng ý' },
		{ value: 'DECLINE', label: 'Ứng viên từ chối' },
	];

	const reasonOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Chọn lý do từ chối...' },
		...reasons.value.map(r => ({ value: r.id as number | undefined, label: r.name })),
	]);

	async function save() {
		if (decision.value === 'DECLINE' && reasonId.value == null) {
			error.value = 'Ghi nhận từ chối phải chọn lý do';
			return;
		}
		submitting.value = true;
		error.value = null;
		try {
			const saved = await service.recordOfferResponse(props.offer.id, {
				decision: decision.value,
				reasonId: decision.value === 'DECLINE' ? reasonId.value : undefined,
				note: note.value.trim() || undefined,
			});
			emit('recorded', saved);
		} catch (e) {
			error.value = recruitErrorMessage(e, 'Ghi nhận phản hồi thất bại');
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
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">Ghi nhận phản hồi</h2>
						<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
							{{ offer.candidate.fullName }} · <span class="font-mono">{{ offer.code }}</span>
						</p>
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
					<div class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Câu trả lời</label>
						<UiSelect v-model="decision" :options="decisionOptions" />
					</div>

					<div v-if="decision === 'DECLINE'" class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
							Lý do từ chối <span class="text-red-500">*</span>
						</label>
						<UiSelect v-model="reasonId" :options="reasonOptions" />
						<p class="text-xs text-gray-500 dark:text-gray-400">
							Ghi nhận từ chối sẽ đóng hồ sơ ứng tuyển với lý do "Ứng viên từ chối offer".
						</p>
					</div>

					<p v-else class="text-xs text-gray-500 dark:text-gray-400">
						Ghi nhận đồng ý sẽ tính lại số người đã tuyển của yêu cầu; đủ số thì yêu cầu chuyển sang
						Đã đủ người.
					</p>

					<div class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Ghi chú</label>
						<textarea
							v-model="note"
							rows="2"
							placeholder="Ứng viên gọi điện trả lời ngày..."
							class="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
						/>
					</div>

					<p v-if="error" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
						{{ error }}
					</p>

					<div class="flex justify-end gap-3 pt-1">
						<CommonAppButton variant="secondary" type="button" @click="emit('close')">Huỷ</CommonAppButton>
						<CommonAppButton variant="primary" type="submit" :loading="submitting">Ghi nhận</CommonAppButton>
					</div>
				</form>
			</div>
		</div>
	</Teleport>
</template>
