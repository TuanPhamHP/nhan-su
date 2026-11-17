<script setup lang="ts">
	import { useMeProfileService } from '~/services/me-profile.service';
	import ProfileChangeRequestModal, {
		type ChangeRequestField,
	} from '~/components/modules/profile/ProfileChangeRequestModal.vue';
	import ProfilePendingRequestNotice from '~/components/modules/profile/ProfilePendingRequestNotice.vue';
	import type { MyPrivateProfile, MyProfileChange, ProfileChangeSection } from '~/types/hr-profile.types';

	/**
	 * Khối ngân hàng và mã số thuế của chính mình (UI-04, lô 3a).
	 *
	 * Mặc định không gọi API: phải nhập lại mật khẩu đăng nhập mới xem được, giống khối thông
	 * tin định danh. Mở khoá chỉ sống trong phiên xem này, rời trang hoặc tải lại là phải nhập
	 * lại. Sửa thì gửi đề nghị cho phòng nhân sự, vì số tài khoản là nơi tiền lương chạy vào.
	 */
	const props = defineProps<{
		pendingBank: MyProfileChange | null;
		pendingTax: MyProfileChange | null;
	}>();

	const emit = defineEmits<{
		created: [];
		cancelled: [];
	}>();

	const toast = useToast();
	const service = useMeProfileService();

	const profile = ref<MyPrivateProfile | null>(null);
	const unlocked = ref(false);
	const showPasswordModal = ref(false);
	const password = ref('');
	const unlocking = ref(false);
	const modalError = ref<string | null>(null);
	/** Lỗi phải nói ở thẻ, không nói trong hộp thoại: tài khoản bị khoá, thử quá nhiều lần. */
	const cardError = ref<string | null>(null);

	const requestSection = ref<ProfileChangeSection | null>(null);
	const submitting = ref(false);

	function openPasswordModal() {
		password.value = '';
		modalError.value = null;
		cardError.value = null;
		showPasswordModal.value = true;
	}

	function closePasswordModal() {
		showPasswordModal.value = false;
		password.value = '';
		modalError.value = null;
	}

	async function submitPassword() {
		if (!password.value) {
			// Chặn ngay ở đây: gửi mật khẩu rỗng cũng tính một lần sai trong bộ đếm khoá của BE.
			modalError.value = 'Bạn nhập mật khẩu đăng nhập của mình.';
			return;
		}
		unlocking.value = true;
		try {
			profile.value = await service.viewPrivateProfile(password.value);
			unlocked.value = true;
			closePasswordModal();
		} catch (e) {
			const err = e as Error & { status?: number };
			const message = err.message || 'Chưa xem được thông tin ngân hàng và thuế.';
			if (err.status === 403 || err.status === 429) {
				closePasswordModal();
				cardError.value = message;
			} else {
				// Sai mật khẩu: giữ hộp thoại, câu của BE có kèm số lần thử còn lại.
				modalError.value = message;
			}
		} finally {
			unlocking.value = false;
			password.value = '';
		}
	}

	const bankFields = computed<ChangeRequestField[]>(() => [
		{ key: 'bankName', label: 'Ngân hàng', value: profile.value?.bankName ?? '' },
		{ key: 'bankBranch', label: 'Chi nhánh', value: profile.value?.bankBranch ?? '' },
		{
			key: 'bankAccountNumber',
			label: 'Số tài khoản',
			value: profile.value?.bankAccountNumber ?? '',
			hint: 'Bạn gõ có dấu cách cũng được, hệ thống tự bỏ dấu cách.',
		},
		{ key: 'bankAccountHolder', label: 'Chủ tài khoản', value: profile.value?.bankAccountHolder ?? '' },
	]);

	const taxFields = computed<ChangeRequestField[]>(() => [
		{
			key: 'taxCode',
			label: 'Mã số thuế riêng',
			value: profile.value?.taxCode ?? '',
			hint: 'Để trống nghĩa là mã số thuế của bạn chính là số căn cước.',
		},
	]);

	const requestFields = computed(() => (requestSection.value === 'TAX' ? taxFields.value : bankFields.value));

	async function onSubmit(payload: { after: Record<string, unknown>; documentIds: number[] }) {
		const section = requestSection.value;
		if (!section) return;
		submitting.value = true;
		try {
			const result = await service.createChangeRequest({
				section,
				after: payload.after,
				documentIds: payload.documentIds.length ? payload.documentIds : undefined,
			});
			requestSection.value = null;
			toast.success(
				result.supersededIds.length
					? 'Đã gửi đề nghị mới và huỷ đề nghị đang chờ trước đó, phòng nhân sự sẽ xem và duyệt.'
					: 'Đã gửi đề nghị thay đổi, chờ phòng nhân sự duyệt.',
			);
			emit('created');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa gửi được đề nghị. Bạn thử lại sau ít phút.');
		} finally {
			submitting.value = false;
		}
	}

	const taxCodeSourceNote = computed(() =>
		profile.value?.effectiveTaxCodeSource === 'CITIZEN_ID' ? 'lấy từ CCCD' : null,
	);

	const labelCls = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1';
	const valueCls = 'text-sm text-gray-900 dark:text-white';
</script>

<template>
	<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
		<h3 class="text-sm font-semibold text-gray-900 dark:text-white">Tài khoản ngân hàng và mã số thuế</h3>

		<!-- Chưa mở khoá -->
		<template v-if="!unlocked">
			<p class="mt-1 mb-4 text-sm text-gray-500 dark:text-gray-400">
				Số tài khoản và mã số thuế là thông tin riêng. Bạn nhập lại mật khẩu đăng nhập để xem.
			</p>
			<p v-if="cardError" class="mb-4 text-sm text-red-600 dark:text-red-400">{{ cardError }}</p>
			<CommonAppButton type="button" variant="primary" @click="openPasswordModal">
				Xem thông tin ngân hàng
			</CommonAppButton>

			<!-- Đề nghị đang chờ vẫn hiện khi chưa mở khoá: chỉ có nhãn trường, không có số -->
			<ProfilePendingRequestNotice
				v-if="pendingBank"
				class="mt-4"
				:request="pendingBank"
				@cancelled="emit('cancelled')"
			/>
			<ProfilePendingRequestNotice
				v-if="pendingTax"
				class="mt-4"
				:request="pendingTax"
				@cancelled="emit('cancelled')"
			/>
		</template>

		<!-- Đã mở khoá -->
		<template v-else>
			<div class="mt-5 space-y-6">
				<section>
					<div class="flex flex-wrap items-center justify-between gap-3">
						<h4 class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
							Tài khoản ngân hàng
						</h4>
						<CommonAppButton size="sm" variant="outline" @click="requestSection = 'BANK'">
							Đề nghị thay đổi
						</CommonAppButton>
					</div>
					<div class="mt-3 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
						<div>
							<p :class="labelCls">Ngân hàng</p>
							<p :class="valueCls">{{ profile?.bankName ?? '—' }}</p>
						</div>
						<div>
							<p :class="labelCls">Chi nhánh</p>
							<p :class="valueCls">{{ profile?.bankBranch ?? '—' }}</p>
						</div>
						<div>
							<p :class="labelCls">Số tài khoản</p>
							<p :class="[valueCls, 'font-mono tabular-nums']">{{ profile?.bankAccountNumber ?? '—' }}</p>
						</div>
						<div>
							<p :class="labelCls">Chủ tài khoản</p>
							<p :class="valueCls">{{ profile?.bankAccountHolder ?? '—' }}</p>
						</div>
					</div>
					<ProfilePendingRequestNotice
						v-if="pendingBank"
						class="mt-4"
						:request="pendingBank"
						@cancelled="emit('cancelled')"
					/>
				</section>

				<section>
					<div class="flex flex-wrap items-center justify-between gap-3">
						<h4 class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
							Mã số thuế
						</h4>
						<CommonAppButton size="sm" variant="outline" @click="requestSection = 'TAX'">
							Đề nghị thay đổi
						</CommonAppButton>
					</div>
					<div class="mt-3">
						<p :class="labelCls">Mã số thuế đang dùng</p>
						<p :class="[valueCls, 'font-mono tabular-nums']">
							{{ profile?.effectiveTaxCode ?? '—' }}
							<span v-if="taxCodeSourceNote" class="font-sans text-xs text-gray-500 dark:text-gray-400">
								({{ taxCodeSourceNote }})
							</span>
						</p>
					</div>
					<ProfilePendingRequestNotice
						v-if="pendingTax"
						class="mt-4"
						:request="pendingTax"
						@cancelled="emit('cancelled')"
					/>
				</section>
			</div>
		</template>

		<!-- Cửa mật khẩu -->
		<Teleport to="body">
			<div
				v-if="showPasswordModal"
				class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
				@click.self="closePasswordModal"
			>
				<div class="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900">
					<h4 class="text-base font-semibold text-gray-900 dark:text-white">Xác nhận mật khẩu</h4>
					<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
						Nhập mật khẩu đăng nhập của bạn để xem số tài khoản và mã số thuế.
					</p>
					<form class="mt-4 space-y-3" @submit.prevent="submitPassword">
						<div>
							<label for="private-profile-password" :class="labelCls">Mật khẩu</label>
							<input
								id="private-profile-password"
								v-model="password"
								type="password"
								autocomplete="current-password"
								:disabled="unlocking"
								class="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
								placeholder="Mật khẩu đăng nhập"
							/>
							<p v-if="modalError" class="mt-1.5 text-xs text-red-500">{{ modalError }}</p>
						</div>
						<div class="flex justify-end gap-2 pt-1">
							<CommonAppButton type="button" variant="secondary" :disabled="unlocking" @click="closePasswordModal">
								Hủy
							</CommonAppButton>
							<CommonAppButton type="submit" variant="primary" :loading="unlocking">Xác nhận</CommonAppButton>
						</div>
					</form>
				</div>
			</div>
		</Teleport>

		<ProfileChangeRequestModal
			v-if="requestSection"
			:section="requestSection"
			:fields="requestFields"
			allow-documents
			:submitting="submitting"
			@submit="onSubmit"
			@close="requestSection = null"
		/>
	</div>
</template>
