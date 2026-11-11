<script setup lang="ts">
	import { useRecruitmentPublicService } from '~/services/recruitment-public.service';
	import { recruitErrorCode, recruitErrorMessage, formatRecruitMoney } from '~/utils/recruitment.utils';
	import { formatDate, formatDateTime } from '~/utils/date';
	import type { OfferLinkState, PublicOfferResponse } from '~/types/recruitment-public.types';

	/**
	 * Trang ứng viên phản hồi thư mời nhận việc (UI-14). Mở bằng link trong email:
	 * `/offer-response?token=...`.
	 */
	definePageMeta({ layout: 'public' });

	const route = useRoute();
	const service = useRecruitmentPublicService();
	const toast = useToast();

	const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''));

	const data = ref<PublicOfferResponse | null>(null);
	const loading = ref(true);
	const errorMessage = ref('');

	/** Bước xác nhận lần hai (BR-15) — BE bắt buộc `confirmed: true` nên không bỏ bước này được. */
	const confirmingAccept = ref(false);
	const decliningOpen = ref(false);
	const declineReasonId = ref<number | null>(null);
	const declineNote = ref('');
	const submitting = ref(false);

	/** Nội dung theo `state`, lấy nguyên từ bảng trong bridge doc mục "Luồng trạng thái". */
	const STATE_TEXT: Record<Exclude<OfferLinkState, 'ACTIVE'>, { title: string; body: string }> = {
		RESPONDED: {
			title: 'Bạn đã phản hồi thư mời này',
			body: 'Phản hồi của bạn đã được ghi nhận. Nếu cần thay đổi, bạn liên hệ lại bộ phận nhân sự của công ty.',
		},
		EXPIRED: {
			title: 'Thư mời đã hết hạn',
			body: 'Hạn phản hồi đã qua nên link này không còn nhận trả lời. Bạn liên hệ bộ phận nhân sự nếu vẫn muốn nhận việc.',
		},
		SUPERSEDED: {
			title: 'Thư mời đã được cập nhật',
			body: 'Công ty đã gửi một thư mời mới thay cho thư này. Bạn mở email mới nhất để xem và phản hồi.',
		},
		CANCELLED: {
			title: 'Thư mời đã bị huỷ',
			body: 'Công ty đã huỷ thư mời này. Bạn liên hệ bộ phận nhân sự để biết thêm.',
		},
		UNAVAILABLE: {
			title: 'Link không còn hiệu lực',
			body: 'Link này không dùng được nữa. Bạn kiểm tra lại email mới nhất hoặc liên hệ bộ phận nhân sự của công ty.',
		},
	};

	const stateText = computed(() =>
		data.value && data.value.state !== 'ACTIVE' ? STATE_TEXT[data.value.state] : null,
	);

	async function load() {
		loading.value = true;
		errorMessage.value = '';
		if (!token.value) {
			// Không có token thì không gọi API: BE sẽ trả UNAVAILABLE, nhưng gọi cũng vô ích.
			data.value = { state: 'UNAVAILABLE', companyName: null, offer: null, declineReasons: [] };
			loading.value = false;
			return;
		}
		try {
			data.value = await service.offerResponse(token.value);
		} catch (e) {
			// Route này luôn 200, kể cả link sai; vào đây là lỗi mạng hoặc server.
			data.value = null;
			errorMessage.value = recruitErrorMessage(e, 'Không tải được thông tin thư mời');
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);

	/**
	 * Gặp 409 thì trạng thái link đã đổi ở nơi khác. Trường `state` mà service gắn vào lỗi bị bộ
	 * lọc lỗi của API cắt mất, nên gọi lại GET để hiện đúng trạng thái mới thay vì đoán theo mã.
	 */
	async function handleConflict(message: string) {
		toast.warning(message);
		confirmingAccept.value = false;
		decliningOpen.value = false;
		await load();
	}

	async function accept() {
		submitting.value = true;
		try {
			data.value = await service.acceptOffer(token.value);
			confirmingAccept.value = false;
			toast.success('Đã ghi nhận bạn đồng ý nhận việc');
		} catch (e) {
			const message = recruitErrorMessage(e, 'Không gửi được phản hồi');
			if (String(recruitErrorCode(e) ?? '').startsWith('RECRUIT_OFFER_')) await handleConflict(message);
			else toast.error(message);
		} finally {
			submitting.value = false;
		}
	}

	async function decline() {
		if (!declineReasonId.value) {
			toast.error('Bạn chọn một lý do giúp công ty nhé');
			return;
		}
		submitting.value = true;
		try {
			data.value = await service.declineOffer(token.value, {
				reasonId: declineReasonId.value,
				note: declineNote.value.trim() || undefined,
			});
			decliningOpen.value = false;
			toast.success('Đã ghi nhận phản hồi của bạn');
		} catch (e) {
			const message = recruitErrorMessage(e, 'Không gửi được phản hồi');
			if (String(recruitErrorCode(e) ?? '').startsWith('RECRUIT_OFFER_')) await handleConflict(message);
			else toast.error(message);
		} finally {
			submitting.value = false;
		}
	}

	/**
	 * `pdfUrl` là presigned URL sống 10 phút. Người mở trang rồi để đó nửa tiếng mới bấm thì link
	 * đã hết hạn, nên gọi lại GET để lấy link mới ngay lúc bấm.
	 */
	async function openPdf() {
		const tab = window.open('', '_blank');
		try {
			const fresh = await service.offerResponse(token.value);
			data.value = fresh;
			const url = fresh.offer?.pdfUrl;
			if (!url) {
				tab?.close();
				toast.error('Thư mời chưa có bản PDF');
				return;
			}
			if (tab) tab.location.assign(url);
			else window.open(url, '_blank');
		} catch (e) {
			tab?.close();
			toast.error(recruitErrorMessage(e, 'Không mở được thư mời'));
		}
	}

	useHead({ title: 'Thư mời nhận việc' });
</script>

<template>
	<div class="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
		<div v-if="loading" class="space-y-4">
			<div class="h-8 w-1/2 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" />
			<div class="h-64 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
		</div>

		<div
			v-else-if="errorMessage"
			class="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900"
		>
			<p class="text-sm text-gray-600 dark:text-gray-400">{{ errorMessage }}</p>
			<CommonAppButton class="mt-4" variant="outline" @click="load">Thử lại</CommonAppButton>
		</div>

		<template v-else-if="data">
			<header class="mb-6">
				<p class="text-sm font-medium text-brand-600 dark:text-brand-400">Thư mời nhận việc</p>
				<h1 v-if="data.companyName" class="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
					{{ data.companyName }}
				</h1>
			</header>

			<!-- Link không còn ở ACTIVE: hiện lý do, và nếu đã phản hồi thì hiện cả lựa chọn đã chọn. -->
			<div
				v-if="stateText"
				class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900"
			>
				<h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ stateText.title }}</h2>
				<p class="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{{ stateText.body }}</p>

				<div
					v-if="data.state === 'RESPONDED' && data.offer"
					class="mt-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-800/50"
				>
					<p class="text-sm text-gray-700 dark:text-gray-300">
						Bạn đã chọn:
						<span
							class="font-semibold"
							:class="data.offer.decision === 'ACCEPTED' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'"
						>
							{{ data.offer.decision === 'ACCEPTED' ? 'Đồng ý nhận việc' : 'Từ chối' }}
						</span>
					</p>
					<p v-if="data.offer.respondedAt" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
						Ghi nhận lúc {{ formatDateTime(data.offer.respondedAt) }}
						<span v-if="data.offer.respondedViaLabel"> · {{ data.offer.respondedViaLabel }}</span>
					</p>
				</div>
			</div>

			<!-- ACTIVE: tóm tắt, PDF, hai nút phản hồi. -->
			<template v-else-if="data.offer">
				<section class="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 dark:border-gray-700 dark:bg-gray-900">
					<p class="text-sm text-gray-600 dark:text-gray-400">
						Kính gửi <span class="font-semibold text-gray-900 dark:text-white">{{ data.offer.candidateName }}</span>,
						công ty mời bạn nhận việc với các điều kiện sau.
					</p>

					<dl class="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
						<div>
							<dt class="text-xs text-gray-500 dark:text-gray-400">Vị trí</dt>
							<dd class="text-sm font-medium text-gray-900 dark:text-white">{{ data.offer.positionName }}</dd>
						</div>
						<div>
							<dt class="text-xs text-gray-500 dark:text-gray-400">Phòng ban</dt>
							<dd class="text-sm font-medium text-gray-900 dark:text-white">{{ data.offer.departmentName }}</dd>
						</div>
						<div v-if="data.offer.level">
							<dt class="text-xs text-gray-500 dark:text-gray-400">Cấp bậc</dt>
							<dd class="text-sm font-medium text-gray-900 dark:text-white">{{ data.offer.level }}</dd>
						</div>
						<div>
							<dt class="text-xs text-gray-500 dark:text-gray-400">Loại hình</dt>
							<dd class="text-sm font-medium text-gray-900 dark:text-white">{{ data.offer.employmentTypeLabel }}</dd>
						</div>
						<div>
							<dt class="text-xs text-gray-500 dark:text-gray-400">Lương chính thức</dt>
							<dd class="text-sm font-semibold text-brand-700 dark:text-brand-400">
								{{ formatRecruitMoney(data.offer.baseSalary) }}
							</dd>
						</div>
						<div>
							<dt class="text-xs text-gray-500 dark:text-gray-400">Ngày bắt đầu làm việc</dt>
							<dd class="text-sm font-medium text-gray-900 dark:text-white">{{ formatDate(data.offer.startDate) }}</dd>
						</div>
						<div v-if="data.offer.probationDays">
							<dt class="text-xs text-gray-500 dark:text-gray-400">Thử việc</dt>
							<!--
								Dấu phẩy phải dính liền chữ "ngày", nên hai phần nằm cùng một dòng nguồn:
								xuống dòng ở đây là Vue render ra khoảng trắng, thành "60 ngày , đến …".
							-->
							<dd class="text-sm font-medium text-gray-900 dark:text-white">
								<span>{{ data.offer.probationDays }} ngày</span><span
									v-if="data.offer.probationEndDate"
									class="font-normal text-gray-500 dark:text-gray-400"
								>, đến {{ formatDate(data.offer.probationEndDate) }}</span>
							</dd>
						</div>
						<div v-if="data.offer.probationSalary != null">
							<dt class="text-xs text-gray-500 dark:text-gray-400">Lương thử việc</dt>
							<dd class="text-sm font-medium text-gray-900 dark:text-white">
								{{ formatRecruitMoney(data.offer.probationSalary) }}
							</dd>
						</div>
						<div v-if="data.offer.allowances" class="sm:col-span-2">
							<dt class="text-xs text-gray-500 dark:text-gray-400">Phụ cấp</dt>
							<dd class="whitespace-pre-line text-sm font-medium text-gray-900 dark:text-white">
								{{ data.offer.allowances }}
							</dd>
						</div>
					</dl>

					<p class="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
						Bạn phản hồi trước hết ngày {{ formatDate(data.offer.responseDeadline) }}.
					</p>

					<CommonAppButton v-if="data.offer.pdfUrl" class="mt-4" variant="outline" @click="openPdf">
						Xem thư mời bản PDF
					</CommonAppButton>
				</section>

				<!-- Hộp xác nhận lần hai cho Đồng ý. -->
				<section
					v-if="confirmingAccept"
					class="mt-5 rounded-xl border border-brand-300 bg-brand-50 p-4 sm:p-6 dark:border-brand-700 dark:bg-brand-900/20"
				>
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">Bạn chắc chắn đồng ý nhận việc?</h2>
					<p class="mt-1.5 text-sm text-gray-700 dark:text-gray-300">
						Sau khi gửi, công ty sẽ chuẩn bị hồ sơ nhân viên cho bạn và link này không nhận trả lời thêm.
					</p>
					<div class="mt-4 flex flex-col gap-2 sm:flex-row">
						<CommonAppButton :loading="submitting" @click="accept">Vâng, tôi đồng ý</CommonAppButton>
						<CommonAppButton variant="outline" :disabled="submitting" @click="confirmingAccept = false">
							Để tôi xem lại
						</CommonAppButton>
					</div>
				</section>

				<!-- Hộp chọn lý do cho Từ chối. -->
				<section
					v-else-if="decliningOpen"
					class="mt-5 rounded-xl border border-gray-200 bg-white p-4 sm:p-6 dark:border-gray-700 dark:bg-gray-900"
				>
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">Bạn chưa nhận việc lần này</h2>
					<p class="mt-1.5 text-sm text-gray-600 dark:text-gray-400">
						Bạn cho công ty biết lý do để lần sau mời đúng hơn nhé.
					</p>

					<fieldset class="mt-4 space-y-2">
						<legend class="sr-only">Lý do từ chối</legend>
						<label
							v-for="reason in data.declineReasons"
							:key="reason.id"
							class="flex cursor-pointer items-center gap-2.5 rounded-lg border border-gray-200 px-3 py-2.5 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
							:class="{ 'border-brand-500 bg-brand-50 dark:bg-brand-900/20': declineReasonId === reason.id }"
						>
							<input
								v-model="declineReasonId"
								type="radio"
								:value="reason.id"
								name="decline-reason"
								class="h-4 w-4 border-gray-300 text-brand-600 focus:ring-brand-500"
							/>
							<span class="text-sm text-gray-800 dark:text-gray-200">{{ reason.name }}</span>
						</label>
					</fieldset>

					<label class="mt-4 block">
						<span class="text-sm font-medium text-gray-700 dark:text-gray-300">Bạn muốn nhắn thêm điều gì?</span>
						<textarea
							v-model="declineNote"
							rows="3"
							maxlength="2000"
							class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
							placeholder="Không bắt buộc"
						/>
					</label>

					<div class="mt-4 flex flex-col gap-2 sm:flex-row">
						<CommonAppButton variant="danger" :loading="submitting" @click="decline">Gửi phản hồi</CommonAppButton>
						<CommonAppButton variant="outline" :disabled="submitting" @click="decliningOpen = false">
							Quay lại
						</CommonAppButton>
					</div>
				</section>

				<div v-else class="mt-5 flex flex-col gap-2 sm:flex-row">
					<CommonAppButton size="lg" @click="confirmingAccept = true">Đồng ý nhận việc</CommonAppButton>
					<CommonAppButton size="lg" variant="outline" @click="decliningOpen = true">
						Từ chối thư mời
					</CommonAppButton>
				</div>
			</template>
		</template>
	</div>
</template>
