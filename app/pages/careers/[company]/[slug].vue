<script setup lang="ts">
	import CareersApplyForm from '~/components/modules/recruitment/CareersApplyForm.vue';
	import { useRecruitmentPublicService } from '~/services/recruitment-public.service';
	import { recruitErrorCode, recruitErrorMessage } from '~/utils/recruitment.utils';
	import { formatDate } from '~/utils/date';
	import type { PublicJobDetail } from '~/types/recruitment-public.types';

	/** Chi tiết tin tuyển dụng công khai kèm form ứng tuyển (UI-13). */
	definePageMeta({ layout: 'public' });

	const route = useRoute();
	const service = useRecruitmentPublicService();

	const companyCode = computed(() => String(route.params.company ?? ''));
	const slug = computed(() => String(route.params.slug ?? ''));

	const data = ref<PublicJobDetail | null>(null);
	const loading = ref(true);
	/** Trang tuyển dụng đóng hẳn (mã công ty lạ, module tắt) — khác với "tin này không còn nhận hồ sơ". */
	const careersClosed = ref(false);
	const jobClosedMessage = ref('');
	const errorMessage = ref('');
	const done = ref(false);

	const formRef = ref<InstanceType<typeof CareersApplyForm> | null>(null);

	async function load() {
		loading.value = true;
		careersClosed.value = false;
		jobClosedMessage.value = '';
		errorMessage.value = '';
		try {
			data.value = await service.job(companyCode.value, slug.value);
		} catch (e) {
			data.value = null;
			const code = recruitErrorCode(e);
			if (code === 'RECRUIT_CAREERS_CLOSED') careersClosed.value = true;
			else if (code === 'RECRUIT_JOB_NOT_OPEN') {
				jobClosedMessage.value = recruitErrorMessage(e, 'Tin này không còn nhận hồ sơ');
			} else errorMessage.value = recruitErrorMessage(e, 'Không tải được tin tuyển dụng');
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);

	/**
	 * Điều khoản vừa đổi (409 `RECRUIT_TERMS_CHANGED`): tải lại chi tiết tin để có bản điều
	 * khoản mới, rồi bắt ứng viên tích đồng ý lại. Form giữ nguyên họ tên, email và CV đã chọn
	 * — bắt họ nhập lại từ đầu vì công ty sửa văn bản là vô lý.
	 */
	async function onTermsChanged() {
		await load();
		formRef.value?.requireConsentAgain();
	}

	function onJobClosed(message: string) {
		data.value = null;
		jobClosedMessage.value = message;
	}

	useHead(() => ({
		title: data.value ? data.value.job.title : 'Tin tuyển dụng',
		// Tin Nội bộ mở được bằng đúng đường dẫn nhưng không nên vào kết quả tìm kiếm;
		// BE đã trả `X-Robots-Tag: noindex`, thẻ này để trình thu thập đọc HTML cũng thấy.
		meta: data.value?.job.visibility === 'INTERNAL' ? [{ name: 'robots', content: 'noindex' }] : [],
	}));
</script>

<template>
	<div class="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
		<NuxtLink
			:to="`/careers/${companyCode}`"
			class="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400"
		>
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
			</svg>
			Tất cả vị trí đang tuyển
		</NuxtLink>

		<div v-if="loading" class="mt-6 space-y-4">
			<div class="h-8 w-2/3 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" />
			<div class="h-40 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
			<div class="h-64 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
		</div>

		<div
			v-else-if="careersClosed"
			class="mt-6 rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900"
		>
			<h1 class="text-lg font-semibold text-gray-900 dark:text-white">Không còn tuyển</h1>
			<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
				Trang tuyển dụng này hiện không mở.
			</p>
		</div>

		<div
			v-else-if="jobClosedMessage"
			class="mt-6 rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900"
		>
			<h1 class="text-lg font-semibold text-gray-900 dark:text-white">Tin này không còn nhận hồ sơ</h1>
			<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">{{ jobClosedMessage }}</p>
			<CommonAppButton class="mt-4" variant="outline" @click="$router.push(`/careers/${companyCode}`)">
				Xem các vị trí khác
			</CommonAppButton>
		</div>

		<div
			v-else-if="errorMessage"
			class="mt-6 rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900"
		>
			<p class="text-sm text-gray-600 dark:text-gray-400">{{ errorMessage }}</p>
			<CommonAppButton class="mt-4" variant="outline" @click="load">Thử lại</CommonAppButton>
		</div>

		<!-- Màn cảm ơn: thay hẳn form để ứng viên không bấm gửi lần hai. -->
		<div
			v-else-if="done"
			class="mt-6 rounded-xl border border-brand-200 bg-brand-50 p-8 text-center dark:border-brand-800 dark:bg-brand-900/20"
		>
			<div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-600">
				<svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
				</svg>
			</div>
			<h1 class="mt-4 text-lg font-semibold text-gray-900 dark:text-white">Đã nhận hồ sơ của bạn</h1>
			<p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
				Cảm ơn bạn đã ứng tuyển. Chúng tôi sẽ xem hồ sơ và liên hệ qua email nếu vị trí phù hợp.
			</p>
			<CommonAppButton class="mt-5" variant="outline" @click="$router.push(`/careers/${companyCode}`)">
				Xem các vị trí khác
			</CommonAppButton>
		</div>

		<template v-else-if="data">
			<article class="mt-6">
				<span
					v-if="data.job.visibility === 'INTERNAL'"
					class="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
				>
					{{ data.job.visibilityLabel }}
				</span>
				<h1 class="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl dark:text-white">
					{{ data.job.title }}
				</h1>
				<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ data.company.name }}</p>

				<dl class="mt-5 grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2 dark:border-gray-700 dark:bg-gray-900">
					<div>
						<dt class="text-xs text-gray-500 dark:text-gray-400">Phòng ban</dt>
						<dd class="text-sm font-medium text-gray-900 dark:text-white">{{ data.job.departmentName }}</dd>
					</div>
					<div>
						<dt class="text-xs text-gray-500 dark:text-gray-400">Vị trí</dt>
						<dd class="text-sm font-medium text-gray-900 dark:text-white">{{ data.job.positionName }}</dd>
					</div>
					<div>
						<dt class="text-xs text-gray-500 dark:text-gray-400">Nơi làm việc</dt>
						<dd class="text-sm font-medium text-gray-900 dark:text-white">
							{{ data.job.locations.length ? data.job.locations.join(', ') : '—' }}
						</dd>
					</div>
					<div>
						<dt class="text-xs text-gray-500 dark:text-gray-400">Loại hình</dt>
						<dd class="text-sm font-medium text-gray-900 dark:text-white">{{ data.job.employmentTypeLabel }}</dd>
					</div>
					<div>
						<dt class="text-xs text-gray-500 dark:text-gray-400">Mức lương</dt>
						<dd class="text-sm font-medium text-gray-900 dark:text-white">{{ data.job.salaryText ?? 'Thương lượng' }}</dd>
					</div>
					<div>
						<dt class="text-xs text-gray-500 dark:text-gray-400">Hạn nhận hồ sơ</dt>
						<dd class="text-sm font-medium text-gray-900 dark:text-white">
							{{ data.job.deadline ? formatDate(data.job.deadline) : 'Không giới hạn' }}
						</dd>
					</div>
				</dl>

				<section class="mt-6">
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">Mô tả công việc</h2>
					<p class="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-700 dark:text-gray-300">
						{{ data.job.description }}
					</p>
				</section>

				<section v-if="data.job.requirements" class="mt-6">
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">Yêu cầu</h2>
					<p class="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-700 dark:text-gray-300">
						{{ data.job.requirements }}
					</p>
				</section>

				<section v-if="data.job.benefits" class="mt-6">
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">Quyền lợi</h2>
					<p class="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-700 dark:text-gray-300">
						{{ data.job.benefits }}
					</p>
				</section>
			</article>

			<section class="mt-8 rounded-xl border border-gray-200 bg-white p-4 sm:p-6 dark:border-gray-700 dark:bg-gray-900">
				<CareersApplyForm
					ref="formRef"
					:company-code="companyCode"
					:slug="slug"
					:terms-version="data.terms.version"
					:terms-text="data.terms.text"
					@submitted="done = true"
					@closed="onJobClosed"
					@terms-changed="onTermsChanged"
				/>
			</section>
		</template>
	</div>
</template>
