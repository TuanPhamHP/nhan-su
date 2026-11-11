<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import RecruitChip from '~/components/modules/recruitment/RecruitChip.vue';
	import { recruitErrorMessage, EMAIL_STATUS_CLASS } from '~/utils/recruitment.utils';
	import { formatDateTime } from '~/utils/date';
	import type {
		RecruitmentApplicationBrief,
		RecruitmentEmailLog,
		RecruitmentTemplate,
	} from '~/types/recruitment.types';

	/**
	 * Lịch sử email gửi ứng viên, kèm form soạn nhanh.
	 *
	 * Email đi qua hàng đợi nên mới gửi xong trạng thái vẫn là "Chờ gửi": panel tải lại danh
	 * sách sau khi gửi thay vì báo "Đã gửi", để người dùng thấy đúng thứ đang xảy ra. Email
	 * đang hẹn giờ huỷ được; email đã gửi thì không thu hồi được.
	 */
	const props = defineProps<{
		candidateId: number;
		applications: RecruitmentApplicationBrief[];
		canManage: boolean;
		hasEmail: boolean;
	}>();

	const toast = useToast();
	const service = useRecruitmentService();

	const logs = ref<RecruitmentEmailLog[]>([]);
	const loading = ref(true);
	const error = ref<string | null>(null);
	const cancelling = ref<number | null>(null);

	const showCompose = ref(false);
	const templates = ref<RecruitmentTemplate[]>([]);
	const templateId = ref<number | undefined>(undefined);
	const subject = ref('');
	const emailBody = ref('');
	const applicationId = ref<number | undefined>(undefined);
	const sendAt = ref('');
	const sending = ref(false);
	const composeError = ref<string | null>(null);

	async function load() {
		loading.value = true;
		error.value = null;
		try {
			logs.value = await service.candidateEmails(props.candidateId);
		} catch (e) {
			logs.value = [];
			error.value = recruitErrorMessage(e, 'Không tải được lịch sử email');
		} finally {
			loading.value = false;
		}
	}

	onMounted(async () => {
		await load();
		if (props.canManage) {
			try {
				const list = await service.findTemplates('EMAIL');
				templates.value = list.filter(t => t.isActive);
			} catch {
				// Không có mẫu thì vẫn soạn tay được.
			}
		}
	});

	watch(() => props.candidateId, load);

	const templateOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Soạn tay' },
		...templates.value.map(t => ({
			value: t.id as number | undefined,
			label: `${t.name} (${t.purposeLabel})`,
		})),
	]);

	const applicationOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Không gắn hồ sơ nào' },
		...props.applications.map(a => ({
			value: a.id as number | undefined,
			label: `${a.job.title} — ${a.stage.name}`,
		})),
	]);

	async function send() {
		if (templateId.value == null && (!subject.value.trim() || !emailBody.value.trim())) {
			composeError.value = 'Chọn một mẫu, hoặc nhập cả tiêu đề lẫn nội dung';
			return;
		}
		sending.value = true;
		composeError.value = null;
		try {
			await service.sendCandidateEmail(props.candidateId, {
				templateId: templateId.value,
				subject: templateId.value == null ? subject.value.trim() : undefined,
				body: templateId.value == null ? emailBody.value.trim() : undefined,
				applicationId: applicationId.value,
				sendAt: sendAt.value ? new Date(sendAt.value).toISOString() : undefined,
			});
			showCompose.value = false;
			subject.value = '';
			emailBody.value = '';
			sendAt.value = '';
			await load();
			toast.success('Đã đưa email vào hàng gửi');
		} catch (e) {
			composeError.value = recruitErrorMessage(e, 'Gửi email thất bại');
		} finally {
			sending.value = false;
		}
	}

	async function cancelEmail(id: number) {
		if (cancelling.value !== null) return;
		cancelling.value = id;
		try {
			await service.cancelEmail(id);
			toast.success('Đã huỷ email đang chờ');
			await load();
		} catch (e) {
			toast.error(recruitErrorMessage(e, 'Huỷ email thất bại'));
			await load();
		} finally {
			cancelling.value = null;
		}
	}
</script>

<template>
	<div class="space-y-4">
		<div v-if="canManage" class="flex flex-wrap items-center justify-between gap-2">
			<p v-if="!hasEmail" class="text-sm text-amber-600 dark:text-amber-400">
				Ứng viên chưa có email nên không gửi được thư.
			</p>
			<p v-else class="text-sm text-gray-500 dark:text-gray-400">
				Email đi qua hàng đợi nên trạng thái đổi sau vài giây đến vài phút.
			</p>
			<CommonAppButton variant="outline" size="sm" :disabled="!hasEmail" @click="showCompose = true">
				Soạn email
			</CommonAppButton>
		</div>

		<div v-if="loading" class="space-y-2">
			<div v-for="i in 3" :key="i" class="h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
		</div>

		<p v-else-if="error" class="text-sm text-rose-600 dark:text-rose-400">{{ error }}</p>

		<p v-else-if="!logs.length" class="text-sm text-gray-500 dark:text-gray-400">
			Chưa gửi email nào cho ứng viên này.
		</p>

		<ul v-else class="space-y-2">
			<li
				v-for="log in logs"
				:key="log.id"
				class="rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700"
			>
				<div class="flex flex-wrap items-start justify-between gap-2">
					<div class="min-w-0">
						<p class="truncate text-sm font-medium text-gray-900 dark:text-white">
							{{ log.subject ?? log.purposeLabel }}
						</p>
						<p class="text-xs text-gray-500 dark:text-gray-400">
							{{ log.purposeLabel }}
							<template v-if="log.toEmail"> · tới {{ log.toEmail }}</template>
							<template v-if="log.channelLabel"> · qua {{ log.channelLabel }}</template>
							<template v-if="log.sentBy"> · {{ log.sentBy.fullName }} gửi</template>
							<template v-else> · hệ thống gửi</template>
						</p>
					</div>
					<RecruitChip :label="log.statusLabel" :tone="EMAIL_STATUS_CLASS[log.status]" />
				</div>

				<p class="mt-1 text-xs text-gray-400">
					<template v-if="log.sentAt">Gửi lúc {{ formatDateTime(log.sentAt) }}</template>
					<template v-else-if="log.scheduledAt">Hẹn gửi lúc {{ formatDateTime(log.scheduledAt) }}</template>
					<template v-else>Tạo lúc {{ formatDateTime(log.createdAt) }}</template>
					<template v-if="log.attachments.length"> · kèm {{ log.attachments.join(', ') }}</template>
				</p>

				<p v-if="log.error" class="mt-1 text-xs text-rose-600 dark:text-rose-400">{{ log.error }}</p>

				<div v-if="canManage && log.status === 'PENDING'" class="mt-2">
					<button
						type="button"
						class="text-xs text-rose-600 hover:underline disabled:opacity-50 dark:text-rose-400"
						:disabled="cancelling === log.id"
						@click="cancelEmail(log.id)"
					>
						Huỷ gửi
					</button>
				</div>
			</li>
		</ul>

		<Teleport to="body">
			<div
				v-if="showCompose"
				class="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/50 p-4"
			>
				<div class="my-8 w-full max-w-xl rounded-2xl bg-white shadow-xl dark:bg-gray-900">
					<div class="flex items-start justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">Soạn email cho ứng viên</h2>
						<button
							type="button"
							class="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
							aria-label="Đóng"
							@click="showCompose = false"
						>
							<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>

					<form class="max-h-[65vh] space-y-4 overflow-y-auto p-6" @submit.prevent="send">
						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Mẫu email</label>
							<UiSelect v-model="templateId" :options="templateOptions" />
						</div>

						<template v-if="templateId == null">
							<div class="space-y-1">
								<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
									Tiêu đề <span class="text-red-500">*</span>
								</label>
								<input
									v-model="subject"
									type="text"
									maxlength="300"
									class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
								/>
							</div>
							<div class="space-y-1">
								<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
									Nội dung <span class="text-red-500">*</span>
								</label>
								<textarea
									v-model="emailBody"
									rows="6"
									class="w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
								/>
								<p class="text-xs text-gray-500 dark:text-gray-400">
									Dùng được ba biến: {ten_ung_vien}, {vi_tri}, {ten_cong_ty}. Nội dung là HTML và mọi
									giá trị thay vào đều được làm sạch.
								</p>
							</div>
						</template>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Gắn với hồ sơ
							</label>
							<UiSelect v-model="applicationId" :options="applicationOptions" />
							<p class="text-xs text-gray-500 dark:text-gray-400">
								Có hồ sơ thì biến {vi_tri} được điền tên tin tuyển dụng.
							</p>
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Hẹn giờ gửi</label>
							<UiDateTimePickerV2 v-model="sendAt" />
							<p class="text-xs text-gray-500 dark:text-gray-400">Để trống thì gửi ngay.</p>
						</div>

						<p
							v-if="composeError"
							class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300"
						>
							{{ composeError }}
						</p>

						<div class="flex justify-end gap-3 pt-1">
							<CommonAppButton variant="secondary" type="button" @click="showCompose = false">
								Huỷ
							</CommonAppButton>
							<CommonAppButton variant="primary" type="submit" :loading="sending">Gửi</CommonAppButton>
						</div>
					</form>
				</div>
			</div>
		</Teleport>
	</div>
</template>
