<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import { useRecruitmentPublicService } from '~/services/recruitment-public.service';
	import { recruitErrorCode, recruitErrorMessage } from '~/utils/recruitment.utils';

	const props = defineProps<{
		companyCode: string;
		slug: string;
		/** `terms.version` của chi tiết tin, phải gửi lại đúng số này. */
		termsVersion: number;
		termsText: string;
	}>();

	const emit = defineEmits<{
		/** Nộp xong — trang cha chuyển sang màn cảm ơn. */
		submitted: [];
		/** Tin không còn nhận hồ sơ (404), trang cha đổi sang màn đã đóng. */
		closed: [message: string];
		/** Điều khoản vừa đổi (409): trang cha tải lại chi tiết tin, dữ liệu đã nhập giữ nguyên. */
		'terms-changed': [];
	}>();

	const service = useRecruitmentPublicService();
	const toast = useToast();

	/**
	 * Chống spam không dùng captcha (bridge doc mục "Quy ước chung"):
	 *
	 * - `website` là ô ẩn bằng CSS. Cố ý KHÔNG dùng `type="hidden"`: bot điền mọi input nhìn
	 *   thấy trong DOM, còn `type="hidden"` thì nhiều bot bỏ qua, nên bẫy mất tác dụng.
	 * - `formStartedAt` là lúc form hiện ra. Gửi sau chưa đủ 3 giây bị BE coi là tự động.
	 *
	 * Hai trường hợp trên BE vẫn trả 201 "Đã nhận hồ sơ" nhưng KHÔNG lưu gì, nên FE không
	 * phân biệt được. Vì vậy nếu người dùng bấm gửi quá sớm (tự điền bằng trình quản lý mật
	 * khẩu chẳng hạn) thì chờ cho đủ 3 giây rồi mới gửi, thay vì để hồ sơ của họ bị bỏ im lặng.
	 */
	const MIN_FILL_MS = 3000;
	const formStartedAt = ref(Date.now());

	const honeypot = ref('');
	const cv = ref<File | null>(null);
	/** Lỗi CV do BE trả (sai loại, quá dung lượng) — hiện ngay dưới vùng kéo thả. */
	const cvServerError = ref<string | null>(null);

	const schema = toTypedSchema(
		z.object({
			fullName: z
				.string()
				.trim()
				.min(2, 'Họ tên phải có ít nhất 2 ký tự')
				.max(150, 'Họ tên tối đa 150 ký tự'),
			email: z
				.string()
				.trim()
				.min(1, 'Vui lòng nhập email')
				.email('Email không hợp lệ')
				.max(200, 'Email tối đa 200 ký tự'),
			phone: z.string().trim().max(30, 'Số điện thoại tối đa 30 ký tự').optional(),
			consentProcessing: z
				.boolean()
				.refine(v => v === true, 'Bạn cần đồng ý để công ty xử lý dữ liệu trong hồ sơ'),
			consentTalentPool: z.boolean().optional(),
		}),
	);

	const { handleSubmit, defineField, errors, isSubmitting, resetField } = useForm({
		validationSchema: schema,
		initialValues: { fullName: '', email: '', phone: '', consentProcessing: false, consentTalentPool: false },
	});

	const [fullName, fullNameAttrs] = defineField('fullName');
	const [email, emailAttrs] = defineField('email');
	const [phone, phoneAttrs] = defineField('phone');
	const [consentProcessing] = defineField('consentProcessing');
	const [consentTalentPool] = defineField('consentTalentPool');

	const termsOpen = ref(false);

	/**
	 * Điều khoản vừa đổi thì ứng viên phải đọc và tích lại — không thể coi lần tích trước là
	 * đồng ý với nội dung mới. Giữ nguyên họ tên, email, điện thoại và CV đã chọn.
	 */
	function requireConsentAgain(): void {
		resetField('consentProcessing', { value: false });
		termsOpen.value = true;
	}

	defineExpose({ requireConsentAgain });

	const onSubmit = handleSubmit(async values => {
		cvServerError.value = null;
		if (!cv.value) {
			cvServerError.value = 'Vui lòng chọn file CV';
			return;
		}

		const waited = Date.now() - formStartedAt.value;
		if (waited < MIN_FILL_MS) {
			await new Promise(resolve => setTimeout(resolve, MIN_FILL_MS - waited));
		}

		try {
			await service.apply(props.companyCode, props.slug, {
				fullName: values.fullName,
				email: values.email,
				phone: values.phone || undefined,
				consentProcessing: true,
				consentTalentPool: values.consentTalentPool === true,
				termsVersion: props.termsVersion,
				website: honeypot.value,
				formStartedAt: formStartedAt.value,
				cv: cv.value,
			});
			emit('submitted');
		} catch (e) {
			const code = recruitErrorCode(e);
			const message = recruitErrorMessage(e, 'Không gửi được hồ sơ, vui lòng thử lại');

			if (code === 'RECRUIT_FILE_REQUIRED' || code === 'RECRUIT_FILE_TOO_LARGE' || code === 'RECRUIT_FILE_TYPE_INVALID') {
				cvServerError.value = message;
				return;
			}
			if (code === 'RECRUIT_CAREERS_CLOSED' || code === 'RECRUIT_JOB_NOT_OPEN') {
				emit('closed', message);
				return;
			}
			if (code === 'RECRUIT_TERMS_CHANGED') {
				// Tải lại điều khoản mới ở trang cha, rồi yêu cầu tích lại.
				emit('terms-changed');
				toast.warning(message);
				return;
			}
			if (code === 'RECRUIT_CONSENT_REQUIRED') {
				requireConsentAgain();
				toast.error(message);
				return;
			}
			// File trên 20 MB bị chặn trước service và trả 413 không có mã riêng.
			toast.error(message);
		}
	});
</script>

<template>
	<form class="space-y-4" novalidate @submit.prevent="onSubmit">
		<h2 class="text-base font-semibold text-gray-900 dark:text-white">Ứng tuyển vị trí này</h2>

		<CommonAppInput
			v-model="fullName"
			v-bind="fullNameAttrs"
			label="Họ và tên"
			placeholder="Nguyễn Văn A"
			required
			:error="errors.fullName"
		/>

		<CommonAppInput
			v-model="email"
			v-bind="emailAttrs"
			label="Email"
			type="email"
			placeholder="email@vidu.com"
			required
			:error="errors.email"
		/>

		<CommonAppInput
			v-model="phone"
			v-bind="phoneAttrs"
			label="Số điện thoại"
			placeholder="0912345678"
			hint="Không bắt buộc, nhưng giúp chúng tôi liên hệ nhanh hơn."
			:error="errors.phone"
		/>

		<div>
			<p class="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
				CV <span class="ml-0.5 text-red-500">*</span>
			</p>
			<UiFileDropzone
				v-model="cv"
				accept=".pdf,.docx"
				:max-size-mb="5"
				hint="Kéo thả hoặc chọn file CV, định dạng PDF hoặc DOCX, tối đa 5 MB."
				:error="cvServerError"
			/>
		</div>

		<!--
			Ô bẫy bot. Ẩn bằng CSS và `aria-hidden` để trình đọc màn hình không đọc tới, nhưng
			vẫn là input thật trong DOM nên bot tự điền sẽ sa vào.
		-->
		<div class="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
			<label for="apply-website">Website</label>
			<input id="apply-website" v-model="honeypot" type="text" tabindex="-1" autocomplete="off" />
		</div>

		<div class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
			<label class="flex cursor-pointer items-start gap-2.5">
				<input
					v-model="consentProcessing"
					type="checkbox"
					class="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700"
				/>
				<span class="text-sm text-gray-700 dark:text-gray-300">
					Tôi đồng ý để công ty thu thập và xử lý dữ liệu cá nhân trong hồ sơ cho mục đích tuyển dụng.
					<span class="text-red-500">*</span>
				</span>
			</label>
			<p v-if="errors.consentProcessing" class="mt-1 pl-6 text-sm text-red-500">
				{{ errors.consentProcessing }}
			</p>

			<button
				type="button"
				class="mt-2 pl-6 text-sm font-medium text-brand-600 underline hover:text-brand-700 dark:text-brand-400"
				@click="termsOpen = !termsOpen"
			>
				{{ termsOpen ? 'Thu gọn điều khoản' : 'Đọc điều khoản xử lý dữ liệu' }}
			</button>
			<p
				v-if="termsOpen"
				class="mt-2 whitespace-pre-line rounded-lg bg-white p-3 text-sm leading-relaxed text-gray-600 dark:bg-gray-900 dark:text-gray-300"
			>
				{{ termsText }}
			</p>

			<label class="mt-3 flex cursor-pointer items-start gap-2.5 border-t border-gray-200 pt-3 dark:border-gray-700">
				<input
					v-model="consentTalentPool"
					type="checkbox"
					class="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-700"
				/>
				<span class="text-sm text-gray-700 dark:text-gray-300">
					Nếu lần này chưa phù hợp, công ty có thể lưu hồ sơ của tôi để liên hệ cho vị trí khác.
				</span>
			</label>
		</div>

		<CommonAppButton type="submit" size="lg" full-width :loading="isSubmitting">
			{{ isSubmitting ? 'Đang gửi hồ sơ…' : 'Gửi hồ sơ' }}
		</CommonAppButton>
	</form>
</template>
