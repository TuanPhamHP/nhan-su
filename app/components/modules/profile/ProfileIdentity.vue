<script setup lang="ts">
	import { formatDate } from '~/utils/date';
	import { differenceInDays, parseISO } from 'date-fns';

	const { ownIdentity, ownIdentityUnlocking, viewOwnIdentity } = useEmployeeIdentity();

	const metaDataStore = useMetaDataStore();
	// Nhãn loại hộ chiếu lấy từ GET /v1/meta-data/passport-types — không hiện mã ORDINARY.
	metaDataStore.load().catch(() => {
		/* không critical: labelForPassportType sẽ fallback về mã */
	});

	const imageViewer = useImageViewerStore();

	/** Đã mở khoá trong phiên xem này chưa. Cố ý chỉ sống trong state component: rời trang
	 *  hoặc F5 là mất, lần sau phải nhập mật khẩu lại. */
	const unlocked = ref(false);
	const showModal = ref(false);
	const password = ref('');
	const modalError = ref<string | null>(null);
	/** Lỗi hiện ở chỗ card (tài khoản bị khoá, quá nhiều request) — modal đã đóng. */
	const cardError = ref<string | null>(null);

	const citizenId = computed(() => ownIdentity.value?.citizenId ?? null);
	const passport = computed(() => ownIdentity.value?.passport ?? null);

	function openModal(): void {
		password.value = '';
		modalError.value = null;
		cardError.value = null;
		showModal.value = true;
	}

	function closeModal(): void {
		showModal.value = false;
		password.value = '';
		modalError.value = null;
	}

	async function submitPassword(): Promise<void> {
		const pw = password.value;
		if (!pw) {
			// Chặn ngay ở client — không đốt một lần thử trong bộ đếm khoá tài khoản của BE.
			modalError.value = 'Vui lòng nhập mật khẩu';
			return;
		}
		modalError.value = null;

		try {
			await viewOwnIdentity(pw);
			unlocked.value = true;
			closeModal();
		} catch (e) {
			const err = e as Error & { status?: number; data?: { error?: { code?: string } } };
			const status = err.status;
			const message = err.message || 'Không xem được thông tin định danh';

			if (status === 403) {
				// Khoá tài khoản: không cho thử tiếp, đóng modal và nói rõ ở card.
				closeModal();
				cardError.value = message;
			} else if (status === 429) {
				closeModal();
				cardError.value = message || 'Bạn thử quá nhiều lần. Vui lòng chờ ít phút rồi thử lại.';
			} else {
				// 400 (sai mật khẩu / thiếu mật khẩu) → giữ modal, cho nhập lại. Message của
				// API có kèm số lần thử còn lại nên hiện nguyên văn.
				// Ca 401 duy nhất là AUTH_SESSION_INVALID: auth.fetch.ts đã tự đăng xuất.
				modalError.value = message;
			}
		} finally {
			// Không giữ mật khẩu sống lâu hơn request.
			password.value = '';
		}
	}

	function text(v: string | null | undefined): string {
		return v && v.trim() ? v : '—';
	}

	function day(v: string | null | undefined): string {
		return v ? formatDate(v) : '—';
	}

	const passportTypeLabel = computed(() =>
		passport.value ? metaDataStore.labelForPassportType(passport.value.passportType) : '—',
	);

	const passportExpiryState = computed<'expired' | 'soon' | 'ok'>(() => {
		const exp = passport.value?.expiryDate;
		if (!exp) return 'ok';
		try {
			const days = differenceInDays(parseISO(exp), new Date());
			if (days < 0) return 'expired';
			if (days < 180) return 'soon';
			return 'ok';
		} catch {
			return 'ok';
		}
	});

	const citizenIdPhotos = computed(() => [
		{ label: 'Mặt trước', url: citizenId.value?.frontPhotoUrl ?? null },
		{ label: 'Mặt sau', url: citizenId.value?.backPhotoUrl ?? null },
	]);

	const passportPhotos = computed(() => [
		{ label: 'Mặt trước', url: passport.value?.photoFrontUrl ?? null },
		{ label: 'Mặt sau', url: passport.value?.photoBackUrl ?? null },
	]);

	/** URL ảnh đã được BE presign — mở trực tiếp, không sign thêm gì ở FE. */
	function openPhoto(photos: { url: string | null }[], index: number): void {
		const urls = photos.map(p => p.url).filter((u): u is string => !!u);
		if (!urls.length) return;
		const target = photos[index]?.url;
		const idx = target ? urls.indexOf(target) : 0;
		imageViewer.open(urls, idx < 0 ? 0 : idx);
	}

	const labelCls = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1';
	const valueCls = 'text-sm text-gray-900 dark:text-white break-words';
	const sectionTitleCls = 'text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500';
</script>

<template>
	<!--
		Card CHỈ ĐỌC, có cửa mật khẩu.

		Mặc định KHÔNG gọi API: CCCD và hộ chiếu là dữ liệu định danh nhạy cảm nên phải xác
		thực lại mật khẩu mỗi lần xem (POST /v1/employees/me/identity — thành công là 201,
		không phải 200). Kết quả cố ý không cache ra ngoài state của component: F5 là phải
		nhập lại, đó là điểm của cửa mật khẩu.

		Không dùng 3 route GET cũ (/citizen-id, /citizen-id/history, /passport) — chính chủ
		gọi id của mình cũng bị 403. Màn hình /management/employees/[id] vẫn dùng chúng bình
		thường vì HR có permission.
	-->
	<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
		<h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-5">Thông tin định danh</h3>

		<!-- ── Chưa mở khoá ── -->
		<template v-if="!unlocked">
			<p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
				CCCD và hộ chiếu là dữ liệu định danh nhạy cảm. Nhập lại mật khẩu để xem.
			</p>
			<p v-if="cardError" class="mb-4 text-sm text-red-600 dark:text-red-400">{{ cardError }}</p>
			<CommonAppButton type="button" variant="primary" @click="openModal">
				Xem thông tin định danh
			</CommonAppButton>
		</template>

		<!-- ── Đã mở khoá ── -->
		<template v-else>
			<div class="space-y-8">
				<!-- ── Khối CCCD ── -->
				<section>
					<h4 :class="[sectionTitleCls, 'mb-3']">Căn cước công dân</h4>

					<!-- null KHÔNG phải lỗi: chỉ là chưa có dữ liệu -->
					<p v-if="!citizenId" class="text-sm text-gray-500 dark:text-gray-400">
						Chưa có thông tin CCCD. Liên hệ bộ phận nhân sự nếu bạn cho rằng đây là thiếu sót.
					</p>

					<template v-else>
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
							<div>
								<p :class="labelCls">Số CCCD</p>
								<p :class="[valueCls, 'font-mono']">{{ citizenId.citizenIdNumber }}</p>
							</div>
							<div>
								<p :class="labelCls">Họ tên trên thẻ</p>
								<p :class="valueCls">{{ text(citizenId.fullNameOnCard) }}</p>
							</div>
							<div>
								<p :class="labelCls">Ngày cấp</p>
								<p :class="valueCls">{{ day(citizenId.issuedDate) }}</p>
							</div>
							<div>
								<p :class="labelCls">Nơi cấp</p>
								<p :class="valueCls">{{ text(citizenId.issuedPlace) }}</p>
							</div>
							<div>
								<p :class="labelCls">Quê quán</p>
								<p :class="valueCls">{{ text(citizenId.hometown) }}</p>
							</div>
							<div>
								<p :class="labelCls">Thường trú</p>
								<p :class="valueCls">{{ text(citizenId.permanentAddress) }}</p>
							</div>
							<div>
								<p :class="labelCls">Tạm trú</p>
								<p :class="valueCls">{{ text(citizenId.temporaryAddress) }}</p>
							</div>
							<div>
								<p :class="labelCls">Nơi ở hiện tại</p>
								<p :class="valueCls">{{ text(citizenId.currentAddress) }}</p>
							</div>
						</div>

						<div class="mt-5">
							<p :class="[labelCls, 'mb-2']">Ảnh CCCD</p>
							<div class="grid grid-cols-2 gap-4 max-w-md">
								<div v-for="(photo, idx) in citizenIdPhotos" :key="photo.label">
									<p class="text-xs text-gray-500 dark:text-gray-400 mb-1.5">{{ photo.label }}</p>
									<div
										class="aspect-[3/2] rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-center"
									>
										<img
											v-if="photo.url"
											:src="photo.url"
											class="w-full h-full object-contain cursor-pointer"
											:alt="`CCCD ${photo.label}`"
											@click="openPhoto(citizenIdPhotos, idx)"
										/>
										<span v-else class="text-xs text-gray-400 italic">Chưa có ảnh</span>
									</div>
								</div>
							</div>
						</div>
					</template>
				</section>

				<!-- ── Khối hộ chiếu ── -->
				<section class="border-t border-gray-100 dark:border-gray-800 pt-6">
					<h4 :class="[sectionTitleCls, 'mb-3']">Hộ chiếu</h4>

					<p v-if="!passport" class="text-sm text-gray-500 dark:text-gray-400">
						Bạn chưa có thông tin hộ chiếu trong hệ thống.
					</p>

					<template v-else>
						<p
							v-if="passportExpiryState === 'expired'"
							class="mb-4 rounded-lg border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 px-4 py-2.5 text-sm text-red-700 dark:text-red-300"
						>
							Hộ chiếu đã hết hạn ngày {{ day(passport.expiryDate) }}.
						</p>
						<p
							v-else-if="passportExpiryState === 'soon'"
							class="mb-4 rounded-lg border border-orange-200 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20 px-4 py-2.5 text-sm text-orange-700 dark:text-orange-300"
						>
							Hộ chiếu sắp hết hạn (còn dưới 6 tháng, hết hạn {{ day(passport.expiryDate) }}).
						</p>

						<div class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
							<div>
								<p :class="labelCls">Số hộ chiếu</p>
								<p :class="[valueCls, 'font-mono']">{{ passport.passportNumber }}</p>
							</div>
							<div>
								<p :class="labelCls">Họ tên trên hộ chiếu</p>
								<p :class="valueCls">{{ text(passport.fullNameOnPassport) }}</p>
							</div>
							<div>
								<p :class="labelCls">Loại hộ chiếu</p>
								<p :class="valueCls">{{ passportTypeLabel }}</p>
							</div>
							<div>
								<p :class="labelCls">Ngày cấp</p>
								<p :class="valueCls">{{ day(passport.issuedDate) }}</p>
							</div>
							<div>
								<p :class="labelCls">Ngày hết hạn</p>
								<p :class="valueCls">{{ day(passport.expiryDate) }}</p>
							</div>
						</div>

						<div class="mt-5">
							<p :class="[labelCls, 'mb-2']">Ảnh hộ chiếu</p>
							<div class="grid grid-cols-2 gap-4 max-w-md">
								<div v-for="(photo, idx) in passportPhotos" :key="photo.label">
									<p class="text-xs text-gray-500 dark:text-gray-400 mb-1.5">{{ photo.label }}</p>
									<div
										class="aspect-[3/4] rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-center"
									>
										<img
											v-if="photo.url"
											:src="photo.url"
											class="w-full h-full object-contain cursor-pointer"
											:alt="`Hộ chiếu ${photo.label}`"
											@click="openPhoto(passportPhotos, idx)"
										/>
										<span v-else class="text-xs text-gray-400 italic">Chưa có ảnh</span>
									</div>
								</div>
							</div>
						</div>
					</template>
				</section>
			</div>
		</template>
	</div>

	<!-- ── Modal nhập mật khẩu ── -->
	<Teleport to="body">
		<Transition
			enter-active-class="transition ease-out duration-150"
			enter-from-class="opacity-0"
			enter-to-class="opacity-100"
			leave-active-class="transition ease-in duration-100"
			leave-from-class="opacity-100"
			leave-to-class="opacity-0"
		>
			<div
				v-if="showModal"
				class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
				@click.self="closeModal"
			>
				<div class="w-full max-w-sm rounded-xl bg-white dark:bg-gray-900 shadow-xl p-6">
					<h4 class="text-base font-semibold text-gray-900 dark:text-white">Xác nhận mật khẩu</h4>
					<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
						Nhập mật khẩu đăng nhập của bạn để xem CCCD và hộ chiếu.
					</p>

					<form class="mt-4 space-y-3" @submit.prevent="submitPassword">
						<div>
							<label for="identity-password" :class="labelCls">Mật khẩu</label>
							<input
								id="identity-password"
								v-model="password"
								type="password"
								autocomplete="current-password"
								:disabled="ownIdentityUnlocking"
								class="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
								placeholder="Mật khẩu đăng nhập"
							/>
							<p v-if="modalError" class="mt-1.5 text-xs text-red-500">{{ modalError }}</p>
						</div>

						<div class="flex justify-end gap-2 pt-1">
							<CommonAppButton
								type="button"
								variant="secondary"
								:disabled="ownIdentityUnlocking"
								@click="closeModal"
							>
								Hủy
							</CommonAppButton>
							<CommonAppButton type="submit" variant="primary" :loading="ownIdentityUnlocking">
								Xác nhận
							</CommonAppButton>
						</div>
					</form>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>
