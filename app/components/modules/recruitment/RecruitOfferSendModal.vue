<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import { recruitErrorMessage } from '~/utils/recruitment.utils';
	import { formatDate } from '~/utils/date';
	import type { RecruitmentOffer, RecruitmentTemplate } from '~/types/recruitment.types';

	/**
	 * Gửi offer đã duyệt cho ứng viên.
	 *
	 * Lúc gửi, hệ thống sinh link phản hồi một lần dùng, lưu bản PDF thư mời rồi mới xếp email
	 * vào hàng gửi. Token của link chỉ nằm trong email và không bao giờ trả ra API, nên màn
	 * hình này không có chỗ nào xem hay sao chép link được.
	 */
	const props = defineProps<{ offer: RecruitmentOffer }>();

	const emit = defineEmits<{ sent: [offer: RecruitmentOffer]; close: [] }>();

	const service = useRecruitmentService();

	const responseDeadline = ref(props.offer.responseDeadline);
	const templateId = ref<number | undefined>(undefined);
	const templates = ref<RecruitmentTemplate[]>([]);
	const submitting = ref(false);
	const error = ref<string | null>(null);

	onMounted(async () => {
		try {
			const list = await service.findTemplates('EMAIL');
			templates.value = list.filter(t => t.isActive && t.purpose === 'OFFER');
			templateId.value = templates.value.find(t => t.isDefault)?.id;
		} catch {
			// Không tải được mẫu thì để trống, hệ thống tự dùng mẫu mặc định.
		}
	});

	const templateOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Mẫu mặc định của công ty' },
		...templates.value.map(t => ({ value: t.id as number | undefined, label: t.name })),
	]);

	const noTemplate = computed(() => templates.value.length === 0);
	const noEmail = computed(() => !props.offer.candidate.email);

	async function send() {
		submitting.value = true;
		error.value = null;
		try {
			const saved = await service.sendOffer(props.offer.id, {
				responseDeadline: responseDeadline.value || undefined,
				templateId: templateId.value,
			});
			emit('sent', saved);
		} catch (e) {
			error.value = recruitErrorMessage(e, 'Gửi offer thất bại');
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
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">Gửi offer cho ứng viên</h2>
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

				<form class="space-y-4 p-6" @submit.prevent="send">
					<p
						v-if="noEmail"
						class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300"
					>
						Ứng viên chưa có email nên không gửi được. Hãy bổ sung email ở hồ sơ ứng viên trước.
					</p>

					<p class="text-sm text-gray-600 dark:text-gray-300">
						Email gửi tới <strong>{{ offer.candidate.email ?? 'chưa có email' }}</strong>, kèm file thư
						mời và nút để ứng viên trả lời. Ngày bắt đầu làm việc là
						{{ formatDate(offer.startDate) }}.
					</p>

					<div class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Hạn phản hồi</label>
						<UiDatePicker v-model="responseDeadline" />
						<p class="text-xs text-gray-500 dark:text-gray-400">
							Phải từ hôm nay đến ngày bắt đầu làm việc. Offer hết hiệu lực lúc 23:59:59 của ngày này.
						</p>
					</div>

					<div class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Mẫu email</label>
						<UiSelect v-model="templateId" :options="templateOptions" />
						<p v-if="noTemplate" class="text-xs text-amber-600 dark:text-amber-400">
							Công ty chưa có mẫu email gửi offer nào đang dùng, nên hệ thống sẽ từ chối. Hãy tạo mẫu
							mục đích "Gửi offer" ở Cài đặt tuyển dụng.
						</p>
					</div>

					<p v-if="error" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
						{{ error }}
					</p>

					<div class="flex justify-end gap-3 pt-1">
						<CommonAppButton variant="secondary" type="button" @click="emit('close')">Huỷ</CommonAppButton>
						<CommonAppButton variant="primary" type="submit" :loading="submitting" :disabled="noEmail">
							Gửi offer
						</CommonAppButton>
					</div>
				</form>
			</div>
		</div>
	</Teleport>
</template>
