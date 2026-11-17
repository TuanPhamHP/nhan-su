<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import { recruitErrorMessage } from '~/utils/recruitment.utils';
	import { formatDateTime } from '~/utils/date';
	import type { RecruitmentSettings } from '~/types/recruitment.types';

	/**
	 * Cài đặt chung của module: email trả lời, thời hạn lưu dữ liệu, điều khoản đồng ý và
	 * lời giới thiệu trên trang tuyển dụng.
	 *
	 * Sửa nội dung điều khoản làm phiên bản tự tăng, và ứng viên đang mở form ứng tuyển với
	 * phiên bản cũ sẽ bị từ chối khi bấm nộp — nên màn hình nói trước điều đó.
	 */
	const props = defineProps<{ canManage: boolean }>();

	const toast = useToast();
	const service = useRecruitmentService();

	const settings = ref<RecruitmentSettings | null>(null);
	const loading = ref(true);
	const saving = ref(false);
	const error = ref<string | null>(null);

	const replyToEmail = ref('');
	const retentionDaysNoConsent = ref<number>(30);
	const retentionMonthsConsent = ref<number>(24);
	const consentTermsText = ref('');
	const careersIntro = ref('');

	function fill(data: RecruitmentSettings) {
		settings.value = data;
		replyToEmail.value = data.replyToEmail ?? '';
		retentionDaysNoConsent.value = data.retentionDaysNoConsent;
		retentionMonthsConsent.value = data.retentionMonthsConsent;
		consentTermsText.value = data.consentTermsText;
		careersIntro.value = data.careersIntro ?? '';
	}

	onMounted(async () => {
		try {
			fill(await service.settings());
		} catch (e) {
			error.value = recruitErrorMessage(e, 'Không tải được cài đặt tuyển dụng');
		} finally {
			loading.value = false;
		}
	});

	const termsChanged = computed(
		() => !!settings.value && consentTermsText.value.trim() !== settings.value.consentTermsText.trim(),
	);

	async function save() {
		if (consentTermsText.value.trim().length < 20) {
			error.value = 'Điều khoản xử lý dữ liệu phải dài ít nhất 20 ký tự';
			return;
		}
		saving.value = true;
		error.value = null;
		try {
			// Hai trường này xoá được bằng chuỗi rỗng, khác hẳn các route PATCH khác của module.
			fill(
				await service.updateSettings({
					replyToEmail: replyToEmail.value.trim() || null,
					retentionDaysNoConsent: Number(retentionDaysNoConsent.value),
					retentionMonthsConsent: Number(retentionMonthsConsent.value),
					consentTermsText: consentTermsText.value.trim(),
					careersIntro: careersIntro.value.trim() || null,
				}),
			);
			toast.success('Đã lưu cài đặt');
		} catch (e) {
			error.value = recruitErrorMessage(e, 'Lưu cài đặt thất bại');
		} finally {
			saving.value = false;
		}
	}
</script>

<template>
	<div class="space-y-4">
		<div v-if="loading" class="space-y-3">
			<div v-for="i in 3" :key="i" class="h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
		</div>

		<template v-else-if="settings">
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div class="space-y-1">
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
						Email nhận thư trả lời
					</label>
					<input
						v-model="replyToEmail"
						type="email"
						:disabled="!canManage"
						placeholder="tuyendung@congty.vn"
						class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
					/>
					<p class="text-xs text-gray-500 dark:text-gray-400">
						Ứng viên bấm trả lời email thì thư về địa chỉ này. Để trống thì dùng mặc định của hệ thống.
					</p>
				</div>

				<div class="space-y-1">
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
						Giữ dữ liệu khi không đồng ý lưu kho
					</label>
					<input
						v-model.number="retentionDaysNoConsent"
						type="number"
						min="1"
						max="3650"
						:disabled="!canManage"
						class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
					/>
					<p class="text-xs text-gray-500 dark:text-gray-400">Số ngày kể từ khi hồ sơ đóng lại.</p>
				</div>

				<div class="space-y-1">
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
						Giữ dữ liệu khi đã đồng ý lưu kho
					</label>
					<input
						v-model.number="retentionMonthsConsent"
						type="number"
						min="1"
						max="120"
						:disabled="!canManage"
						class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
					/>
					<p class="text-xs text-gray-500 dark:text-gray-400">Số tháng kể từ khi ứng viên đồng ý.</p>
				</div>

				<div class="space-y-1 sm:col-span-2">
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
						Giới thiệu trên trang tuyển dụng
					</label>
					<textarea
						v-model="careersIntro"
						rows="3"
						maxlength="5000"
						:disabled="!canManage"
						class="w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
					/>
				</div>

				<div class="space-y-1 sm:col-span-2">
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
						Điều khoản xử lý dữ liệu (phiên bản {{ settings.consentTermsVersion }})
					</label>
					<textarea
						v-model="consentTermsText"
						rows="8"
						maxlength="20000"
						:disabled="!canManage"
						class="w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
					/>
					<p
						v-if="termsChanged"
						class="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
					>
						Lưu nội dung mới sẽ tăng phiên bản điều khoản lên
						{{ settings.consentTermsVersion + 1 }}. Ứng viên đang mở form ứng tuyển với bản cũ sẽ được
						yêu cầu tải lại trang khi bấm nộp.
					</p>
					<p v-else class="text-xs text-gray-500 dark:text-gray-400">
						Đây là nội dung ứng viên phải tích đồng ý trước khi nộp hồ sơ.
					</p>
				</div>
			</div>

			<p v-if="error" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
				{{ error }}
			</p>

			<div class="flex items-center justify-between gap-3">
				<p class="text-xs text-gray-400">
					<template v-if="settings.updatedById">
						Sửa lần cuối {{ formatDateTime(settings.updatedAt) }}
					</template>
					<template v-else>Công ty đang dùng giá trị mặc định của hệ thống.</template>
				</p>
				<CommonAppButton v-if="canManage" variant="primary" :loading="saving" @click="save">
					Lưu cài đặt
				</CommonAppButton>
			</div>
		</template>
	</div>
</template>
