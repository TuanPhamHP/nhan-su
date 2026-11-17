<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import { defaultRejectEmailAt, recruitErrorMessage } from '~/utils/recruitment.utils';
	import { formatDateTime } from '~/utils/date';
	import type {
		RecruitmentBulkResult,
		RecruitmentReason,
		RecruitmentRejectEmailMode,
		RecruitmentTemplate,
		RejectApplicationBody,
	} from '~/types/recruitment.types';

	/**
	 * Loại một hoặc nhiều hồ sơ.
	 *
	 * BE kiểm theo thứ tự hồ sơ → lý do → giờ hẹn → mẫu email, và **chỉ đổi trạng thái khi
	 * mọi thứ hợp lệ**, nên gặp lỗi thì hộp thoại giữ nguyên dữ liệu người dùng vừa nhập.
	 * Với loại hàng loạt, BE báo lỗi theo từng dòng; dòng lỗi giữ nguyên trạng thái nên
	 * hộp thoại hiện lại đúng những dòng hỏng thay vì báo "thất bại" chung chung.
	 */
	const props = defineProps<{
		/** Một hồ sơ, hoặc nhiều hồ sơ khi loại hàng loạt. */
		applicationIds: number[];
		/** Tên ứng viên để câu xác nhận đọc được; chỉ dùng khi loại một hồ sơ. */
		candidateName?: string;
	}>();

	const emit = defineEmits<{ done: []; close: [] }>();

	const service = useRecruitmentService();

	const reasons = ref<RecruitmentReason[]>([]);
	const templates = ref<RecruitmentTemplate[]>([]);
	const loadingLists = ref(true);

	const reasonId = ref<number | undefined>(undefined);
	const note = ref('');
	const emailMode = ref<RecruitmentRejectEmailMode>('SCHEDULED');
	const templateId = ref<number | undefined>(undefined);
	const sendAt = ref('');

	const submitting = ref(false);
	const error = ref<string | null>(null);
	const failedRows = ref<RecruitmentBulkResult[]>([]);

	const isBulk = computed(() => props.applicationIds.length > 1);

	onMounted(async () => {
		try {
			const [reasonList, templateList] = await Promise.all([
				service.findReasons({ kind: 'REJECTION', activeOnly: true }),
				service.findTemplates('EMAIL'),
			]);
			reasons.value = reasonList;
			templates.value = templateList.filter(t => t.isActive && t.purpose === 'REJECTION');
			templateId.value = templates.value.find(t => t.isDefault)?.id;
		} catch (e) {
			error.value = recruitErrorMessage(e, 'Không tải được danh mục lý do loại');
		} finally {
			loadingLists.value = false;
		}
	});

	const reasonOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Chọn lý do loại...' },
		...reasons.value.map(r => ({ value: r.id as number | undefined, label: r.name })),
	]);

	const templateOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Mẫu mặc định của hệ thống' },
		...templates.value.map(t => ({ value: t.id as number | undefined, label: t.name })),
	]);

	const emailModeOptions: { value: RecruitmentRejectEmailMode; label: string }[] = [
		{ value: 'SCHEDULED', label: 'Hẹn giờ gửi' },
		{ value: 'NOW', label: 'Gửi ngay' },
		{ value: 'NONE', label: 'Không gửi thư từ chối' },
	];

	/** Giờ BE sẽ chọn nếu người dùng không tự đặt — chỉ để hiển thị. */
	const suggestedAt = computed(() => formatDateTime(defaultRejectEmailAt().toISOString()));

	const noTemplate = computed(() => !loadingLists.value && templates.value.length === 0);

	/** Lý do có mã hệ thống `SPAM` thì BE không gửi email dù chọn gì. */
	const picksSpamReason = computed(
		() => reasons.value.find(r => r.id === reasonId.value)?.systemCode === 'SPAM',
	);

	function buildBody(): RejectApplicationBody {
		const email: RejectApplicationBody['email'] = { mode: emailMode.value };
		if (emailMode.value === 'SCHEDULED') {
			if (sendAt.value) email.sendAt = new Date(sendAt.value).toISOString();
			if (templateId.value != null) email.templateId = templateId.value;
		} else if (emailMode.value === 'NOW' && templateId.value != null) {
			email.templateId = templateId.value;
		}
		return {
			reasonId: reasonId.value as number,
			note: note.value.trim() || undefined,
			email,
		};
	}

	async function submit() {
		if (reasonId.value == null) {
			error.value = 'Chọn lý do loại hồ sơ';
			return;
		}
		submitting.value = true;
		error.value = null;
		failedRows.value = [];
		try {
			const body = buildBody();
			if (isBulk.value) {
				const results = await service.bulkRejectApplications(props.applicationIds, body);
				const failed = results.filter(r => !r.ok);
				if (failed.length) {
					// Dòng hỏng giữ nguyên trạng thái, nên nói rõ từng dòng thay vì đóng hộp thoại.
					failedRows.value = failed;
					error.value = `${failed.length}/${results.length} hồ sơ không loại được.`;
					return;
				}
			} else {
				await service.rejectApplication(props.applicationIds[0] as number, body);
			}
			emit('done');
		} catch (e) {
			error.value = recruitErrorMessage(e, 'Loại hồ sơ thất bại');
		} finally {
			submitting.value = false;
		}
	}
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/50 p-4">
			<div class="my-8 w-full max-w-lg rounded-2xl bg-white shadow-xl dark:bg-gray-900">
				<div class="flex items-start justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
					<div>
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">Loại hồ sơ</h2>
						<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
							<template v-if="isBulk">{{ applicationIds.length }} hồ sơ đang chọn</template>
							<template v-else>{{ candidateName ?? 'Một hồ sơ' }}</template>
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

				<form class="max-h-[70vh] space-y-4 overflow-y-auto p-6" @submit.prevent="submit">
					<div class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
							Lý do loại <span class="text-red-500">*</span>
						</label>
						<UiSelect v-model="reasonId" :options="reasonOptions" />
					</div>

					<div class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Ghi chú nội bộ</label>
						<textarea
							v-model="note"
							rows="2"
							placeholder="Ghi chú cho đồng nghiệp, ứng viên không đọc được..."
							class="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
						/>
					</div>

					<div class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Thư từ chối</label>
						<UiSelect v-model="emailMode" :options="emailModeOptions" />
					</div>

					<template v-if="emailMode !== 'NONE'">
						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Mẫu thư</label>
							<UiSelect v-model="templateId" :options="templateOptions" />
							<p v-if="noTemplate" class="text-xs text-amber-600 dark:text-amber-400">
								Công ty chưa có mẫu thư từ chối nào đang dùng, nên hồ sơ vẫn bị loại mà không có thư
								nào được gửi.
							</p>
						</div>

						<div v-if="emailMode === 'SCHEDULED'" class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Giờ gửi</label>
							<UiDateTimePickerV2 v-model="sendAt" />
							<p class="text-xs text-gray-500 dark:text-gray-400">
								Để trống thì hệ thống gửi lúc {{ suggestedAt }}, theo luật dời sang 08:00 ngày làm
								việc kế tiếp khi rơi vào cuối tuần hoặc ngoài giờ hành chính.
							</p>
						</div>

						<p
							v-if="picksSpamReason"
							class="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-gray-800/60 dark:text-gray-300"
						>
							Lý do này là mục hệ thống dành cho hồ sơ rác, nên hệ thống không gửi thư cho ứng viên dù
							chọn cách gửi nào.
						</p>
					</template>

					<p
						v-if="emailMode === 'SCHEDULED'"
						class="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-gray-800/60 dark:text-gray-300"
					>
						Thư hẹn giờ bị huỷ nếu hồ sơ được mở lại trước giờ gửi, nên ứng viên được mở lại sẽ không
						nhận thư từ chối.
					</p>

					<p v-if="error" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
						{{ error }}
					</p>

					<ul v-if="failedRows.length" class="space-y-1">
						<li
							v-for="row in failedRows"
							:key="row.id"
							class="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-900/20 dark:text-rose-300"
						>
							Hồ sơ #{{ row.id }}: {{ row.message ?? row.code }}
						</li>
					</ul>

					<div class="flex justify-end gap-3 pt-1">
						<CommonAppButton variant="secondary" type="button" @click="emit('close')">Huỷ</CommonAppButton>
						<CommonAppButton variant="danger" type="submit" :loading="submitting">Loại hồ sơ</CommonAppButton>
					</div>
				</form>
			</div>
		</div>
	</Teleport>
</template>
