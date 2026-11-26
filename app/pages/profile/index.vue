<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import type { Employee } from '~/types/employee.types';
	import type { MyProfile, MyProfileChange, ProfileChangeSection } from '~/types/hr-profile.types';
	import { useAuthService } from '~/services';
	import { useMeProfileService } from '~/services/me-profile.service';
	import { formatDate } from '~/utils/date';
	import { deleteCookie } from '~/utils/cookie';
	import ThemeSelector from '~/components/modules/theme/ThemeSelector.vue';
	import ProfileSocialInsurance from '~/components/modules/profile/ProfileSocialInsurance.vue';
	import ProfileIdentity from '~/components/modules/profile/ProfileIdentity.vue';
	import ProfileFaceCard from '~/components/modules/profile/ProfileFaceCard.vue';
	import ProfileBasicCard from '~/components/modules/profile/ProfileBasicCard.vue';
	import ProfileContactCard from '~/components/modules/profile/ProfileContactCard.vue';
	import ProfilePrivateCard from '~/components/modules/profile/ProfilePrivateCard.vue';
	import ProfileEmergencyContacts from '~/components/modules/profile/ProfileEmergencyContacts.vue';
	import ProfileWorkExperiences from '~/components/modules/profile/ProfileWorkExperiences.vue';
	import ProfileMyRequests from '~/components/modules/profile/ProfileMyRequests.vue';
	import ProfilePendingDocuments from '~/components/modules/profile/ProfilePendingDocuments.vue';
	import ProfileApprovalDelegations from '~/components/modules/profile/ProfileApprovalDelegations.vue';
	import EmployeeDocuments from '~/components/modules/employee/EmployeeDocuments.vue';

	definePageMeta({ title: 'Hồ sơ cá nhân' });

	const toast = useToast();
	const route = useRoute();
	const router = useRouter();
	const { uploadAvatar, uploadingAvatar } = useProfile();
	const authStore = useAuthStore();
	const metaDataStore = useMetaDataStore();
	const { canUse } = useModuleAccess();
	const meService = useMeProfileService();

	// ─── Tải hồ sơ ───────────────────────────────────────────────────────────────

	/** Hồ sơ cơ bản, dùng cho thẻ đầu trang và khối thông tin công việc. */
	const employee = ref<Employee | null>(null);
	/** Hồ sơ mở rộng của chính mình: liên hệ, quốc tịch, hôn nhân, trình độ (lô 3a). */
	const profile = ref<MyProfile | null>(null);
	const pageLoading = ref(true);

	const requests = ref<MyProfileChange[]>([]);
	const requestsLoading = ref(true);
	/** Khối giấy tờ chờ tự tải dữ liệu, nhưng gửi hoặc huỷ yêu cầu xong thì phải đọc lại. */
	const pendingDocuments = ref<{ reload: () => void } | null>(null);

	async function loadRequests() {
		requestsLoading.value = true;
		try {
			requests.value = await meService.findChangeRequests();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa tải được danh sách yêu cầu thay đổi.');
		} finally {
			requestsLoading.value = false;
		}
		pendingDocuments.value?.reload();
	}

	onMounted(async () => {
		const { me } = useAuthService();
		try {
			const [emp, myProfile] = await Promise.all([me(), meService.findProfile()]);
			employee.value = emp;
			profile.value = myProfile;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Không tải được hồ sơ');
		} finally {
			pageLoading.value = false;
		}
		loadRequests();
	});

	// ─── Tab ─────────────────────────────────────────────────────────────────────

	const validTabs = ['profile', 'requests', 'delegations', 'settings'] as const;
	type TabId = (typeof validTabs)[number];

	const tabs: { key: TabId; label: string }[] = [
		{ key: 'profile', label: 'Hồ sơ' },
		{ key: 'requests', label: 'Yêu cầu của tôi' },
		// Lô 4a: uỷ quyền duyệt phiếu đề xuất. Đứng riêng một tab vì đây là việc của người duyệt,
		// không phải thông tin hồ sơ, và người dùng tìm nó theo việc "tôi đi công tác tuần sau".
		{ key: 'delegations', label: 'Uỷ quyền duyệt' },
		{ key: 'settings', label: 'Giao diện và mật khẩu' },
	];

	function initialTab(): TabId {
		const requested = route.query.tab as TabId;
		return validTabs.includes(requested) ? requested : 'profile';
	}
	const activeTab = ref<TabId>(initialTab());

	/**
	 * Yêu cầu cần mở sẵn, lấy từ `?id=` khi người dùng bấm vào thông báo N-02.
	 *
	 * Xoá `id` khỏi địa chỉ ngay: tải lại trang sau đó không mở lại dòng cũ nữa.
	 */
	const highlightRequestId = ref<number | null>(null);
	onMounted(() => {
		const raw = route.query.id;
		if (!raw) return;
		const id = Number(raw);
		if (!id || Number.isNaN(id)) return;
		highlightRequestId.value = id;
		router.replace({ query: { ...route.query, id: undefined } });
	});

	watch(activeTab, tab => {
		router.replace({ query: { ...route.query, tab } });
	});

	const pendingRequests = computed(() => requests.value.filter(r => r.status === 'PENDING'));

	function pendingOf(section: ProfileChangeSection): MyProfileChange | null {
		return pendingRequests.value.find(r => r.section === section) ?? null;
	}

	const pendingRelatives = computed(() => pendingRequests.value.filter(r => r.section === 'RELATIVE'));
	const pendingExperiences = computed(() => pendingRequests.value.filter(r => r.section === 'EXPERIENCE'));
	const pendingCount = computed(() => pendingRequests.value.length);

	// ─── Ảnh đại diện ────────────────────────────────────────────────────────────

	const avatarInput = ref<HTMLInputElement | null>(null);

	function triggerAvatarPicker() {
		avatarInput.value?.click();
	}

	async function handleAvatarChange(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;

		if (!['image/jpeg', 'image/png'].includes(file.type)) {
			toast.error('Chỉ chấp nhận ảnh JPG hoặc PNG');
			return;
		}
		if (file.size > 2 * 1024 * 1024) {
			toast.error('Ảnh không được vượt quá 2MB');
			return;
		}

		const updated = await uploadAvatar(file);
		if (employee.value) employee.value.avatarUrl = updated.avatarUrl;
		if (avatarInput.value) avatarInput.value.value = '';
	}

	const currentAvatarUrl = computed(() => employee.value?.avatarUrl ?? authStore.user?.avatarUrl ?? null);

	// ─── Đổi mật khẩu ────────────────────────────────────────────────────────────

	const pwSchema = toTypedSchema(
		z
			.object({
				currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
				newPassword: z.string().min(6, 'Mật khẩu mới tối thiểu 6 ký tự'),
				confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu mới'),
			})
			.refine(data => data.newPassword === data.confirmPassword, {
				message: 'Mật khẩu xác nhận không khớp',
				path: ['confirmPassword'],
			}),
	);

	const {
		handleSubmit: handlePwSubmit,
		defineField: definePwField,
		errors: pwErrors,
		isSubmitting: pwSubmitting,
	} = useForm({ validationSchema: pwSchema });

	const [currentPassword, currentPasswordAttrs] = definePwField('currentPassword');
	const [newPassword, newPasswordAttrs] = definePwField('newPassword');
	const [confirmPassword, confirmPasswordAttrs] = definePwField('confirmPassword');

	const showCurrentPw = ref(false);
	const showNewPw = ref(false);
	const showConfirmPw = ref(false);

	const onChangePassword = handlePwSubmit(async values => {
		const { changePassword } = useAuthService();
		await changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword });
		toast.success('Đổi mật khẩu thành công. Vui lòng đăng nhập lại.');
		deleteCookie('access_token');
		deleteCookie('refresh_token');
		authStore.$patch({ user: null, token: null, permissions: [] });
		await navigateTo('/login');
	});

	const inputCls =
		'block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm px-3 py-2.5 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50';
	const labelCls = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1';
	const valueCls = 'text-sm text-gray-900 dark:text-white';
</script>

<template>
	<div class="mx-auto max-w-3xl space-y-6">
		<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Hồ sơ cá nhân</h1>

		<!-- Đang tải -->
		<div
			v-if="pageLoading"
			class="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900"
		>
			<div class="flex items-center gap-5">
				<div class="h-20 w-20 flex-shrink-0 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
				<div class="space-y-2">
					<div class="h-5 w-44 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
					<div class="h-4 w-28 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
				</div>
			</div>
			<div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
				<div v-for="i in 6" :key="i" class="space-y-1.5">
					<div class="h-3 w-20 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
					<div class="h-4 w-36 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
				</div>
			</div>
		</div>

		<template v-else-if="employee">
			<!-- Ảnh đại diện và tên -->
			<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
				<div class="flex flex-col gap-5 sm:flex-row sm:items-center">
					<div class="group relative flex-shrink-0">
						<CommonAppAvatar :src="currentAvatarUrl" :name="employee.fullName" size="2xl" ring />
						<button
							type="button"
							class="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
							:class="{ 'cursor-wait opacity-100': uploadingAvatar }"
							:disabled="uploadingAvatar"
							@click="triggerAvatarPicker"
						>
							<svg
								v-if="!uploadingAvatar"
								class="h-5 w-5 text-white"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
								/>
								<path stroke-linecap="round" stroke-linejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
							</svg>
							<svg v-else class="h-5 w-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
							</svg>
						</button>
						<input
							ref="avatarInput"
							type="file"
							accept="image/jpeg,image/png"
							class="hidden"
							@change="handleAvatarChange"
						/>
					</div>

					<div class="min-w-0">
						<h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ employee.fullName }}</h2>
						<p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
							{{ employee.email }}
							<span class="mx-1.5">·</span>
							<span
								class="inline-block rounded border border-brand-600 bg-brand-100 px-1 text-xs font-bold text-brand-600"
							>
								{{ employee.employeeCode }}
							</span>
						</p>
						<p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
							Bạn đưa chuột vào ảnh để đổi ảnh đại diện, nhận ảnh JPG hoặc PNG tối đa 2MB.
						</p>
					</div>
				</div>
			</div>

			<!-- Hàng tab -->
			<div class="border-b border-gray-200 dark:border-gray-700">
				<nav class="-mb-px flex gap-1 overflow-x-auto whitespace-nowrap">
					<button
						v-for="tab in tabs"
						:key="tab.key"
						type="button"
						class="border-b-2 px-4 py-2.5 text-sm font-medium transition-colors"
						:class="
							activeTab === tab.key
								? 'border-brand-500 text-brand-600 dark:text-brand-400'
								: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-200'
						"
						@click="activeTab = tab.key"
					>
						{{ tab.label }}
						<span
							v-if="tab.key === 'requests' && pendingCount > 0"
							class="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
						>
							{{ pendingCount }}
						</span>
					</button>
				</nav>
			</div>

			<!-- Tab: Hồ sơ -->
			<template v-if="activeTab === 'profile'">
				<ProfileBasicCard
					:employee="employee"
					:pending="pendingOf('BASIC')"
					@created="loadRequests"
					@cancelled="loadRequests"
				/>

				<ProfileContactCard v-if="profile" :profile="profile" @updated="profile = $event" />

				<ProfilePrivateCard
					:pending-bank="pendingOf('BANK')"
					:pending-tax="pendingOf('TAX')"
					@created="loadRequests"
					@cancelled="loadRequests"
				/>

				<ProfileEmergencyContacts
					:pending-relative-requests="pendingRelatives"
					@created="loadRequests"
					@cancelled="loadRequests"
				/>

				<!-- Chỉ hiện khi còn giấy tờ đã tải mà chưa gửi kèm yêu cầu nào. -->
				<ProfilePendingDocuments ref="pendingDocuments" />

				<!-- Chỉ đọc, có cửa mật khẩu. Không nhận employeeId: server lấy từ JWT. -->
				<ProfileIdentity />

				<!-- Khuôn mặt dùng để so khi chấm công; đăng ký lại phải nhờ phòng nhân sự xoá cái cũ. -->
				<ProfileFaceCard />

				<ProfileWorkExperiences
					:pending-requests="pendingExperiences"
					@created="loadRequests"
					@cancelled="loadRequests"
				/>

				<!-- Giấy tờ của chính mình: chỉ xem và tải về, phòng nhân sự mới tải lên được. -->
				<EmployeeDocuments :employee-id="employee.id" self readonly />

				<!-- Cùng mô hình: chỉ đọc, cửa mật khẩu riêng, server lấy employeeId từ JWT. -->
				<ProfileSocialInsurance v-if="canUse('CONTRACT_INSURANCE')" />

				<!-- Thông tin công việc, chỉ đọc -->
				<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
					<h3 class="mb-5 text-sm font-semibold text-gray-900 dark:text-white">Thông tin công việc</h3>
					<div class="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
						<div>
							<p :class="labelCls">Mã nhân viên</p>
							<p
								class="inline-block rounded border border-brand-600 bg-brand-100 px-1 text-xs font-bold text-brand-600"
							>
								{{ employee.employeeCode }}
							</p>
						</div>
						<div>
							<p :class="labelCls">Vai trò</p>
							<p :class="valueCls">{{ metaDataStore.labelForRole(employee.role) }}</p>
						</div>
						<div>
							<p :class="labelCls">Phòng ban</p>
							<p :class="valueCls">{{ employee.department?.name ?? '—' }}</p>
						</div>
						<div>
							<p :class="labelCls">Chức vụ</p>
							<p :class="valueCls">{{ employee.position?.name ?? '—' }}</p>
						</div>
						<div>
							<p :class="labelCls">Ngày vào làm</p>
							<p :class="valueCls">{{ formatDate(employee.joinDate) }}</p>
						</div>
						<div>
							<p :class="labelCls">Quản lý trực tiếp</p>
							<p :class="valueCls">{{ employee.manager?.fullName ?? '—' }}</p>
						</div>
					</div>
				</div>
			</template>

			<!-- Tab: Yêu cầu của tôi -->
			<ProfileMyRequests
				v-else-if="activeTab === 'requests'"
				:requests="requests"
				:loading="requestsLoading"
				:highlight-id="highlightRequestId"
				@cancelled="loadRequests"
			/>

			<!-- Tab: Uỷ quyền duyệt (lô 4a) -->
			<ProfileApprovalDelegations v-else-if="activeTab === 'delegations'" />

			<!-- Tab: Giao diện và mật khẩu -->
			<template v-else>
				<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
					<h3 class="mb-1 text-sm font-semibold text-gray-900 dark:text-white">Giao diện</h3>
					<p class="mb-5 text-xs text-gray-500 dark:text-gray-400">
						Chọn màu chủ đề cho header và sidebar, rồi bấm Lưu để áp dụng.
					</p>
					<ThemeSelector />
				</div>

				<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
					<h3 class="mb-1 text-sm font-semibold text-gray-900 dark:text-white">Đổi mật khẩu</h3>
					<p class="mb-5 text-xs text-gray-500 dark:text-gray-400">
						Sau khi đổi thành công, bạn sẽ được đăng xuất khỏi tất cả thiết bị.
					</p>

					<form class="max-w-sm space-y-4" @submit.prevent="onChangePassword">
						<div>
							<label :class="labelCls">Mật khẩu hiện tại <span class="text-red-500">*</span></label>
							<div class="relative">
								<input
									v-model="currentPassword"
									v-bind="currentPasswordAttrs"
									:type="showCurrentPw ? 'text' : 'password'"
									:class="[inputCls, 'pr-10']"
									placeholder="••••••••"
									autocomplete="current-password"
								/>
								<button
									type="button"
									class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
									@click="showCurrentPw = !showCurrentPw"
								>
									<svg v-if="showCurrentPw" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
									</svg>
									<svg v-else class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
										<path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
									</svg>
								</button>
							</div>
							<p v-if="pwErrors.currentPassword" class="mt-1 text-xs text-red-500">{{ pwErrors.currentPassword }}</p>
						</div>

						<div>
							<label :class="labelCls">Mật khẩu mới <span class="text-red-500">*</span></label>
							<div class="relative">
								<input
									v-model="newPassword"
									v-bind="newPasswordAttrs"
									:type="showNewPw ? 'text' : 'password'"
									:class="[inputCls, 'pr-10']"
									placeholder="Tối thiểu 6 ký tự"
									autocomplete="new-password"
								/>
								<button
									type="button"
									class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
									@click="showNewPw = !showNewPw"
								>
									<svg v-if="showNewPw" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
									</svg>
									<svg v-else class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
										<path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
									</svg>
								</button>
							</div>
							<p v-if="pwErrors.newPassword" class="mt-1 text-xs text-red-500">{{ pwErrors.newPassword }}</p>
						</div>

						<div>
							<label :class="labelCls">Xác nhận mật khẩu mới <span class="text-red-500">*</span></label>
							<div class="relative">
								<input
									v-model="confirmPassword"
									v-bind="confirmPasswordAttrs"
									:type="showConfirmPw ? 'text' : 'password'"
									:class="[inputCls, 'pr-10']"
									placeholder="Nhập lại mật khẩu mới"
									autocomplete="new-password"
								/>
								<button
									type="button"
									class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
									@click="showConfirmPw = !showConfirmPw"
								>
									<svg v-if="showConfirmPw" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
									</svg>
									<svg v-else class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
										<path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
									</svg>
								</button>
							</div>
							<p v-if="pwErrors.confirmPassword" class="mt-1 text-xs text-red-500">{{ pwErrors.confirmPassword }}</p>
						</div>

						<div class="pt-1">
							<CommonAppButton type="submit" variant="primary" :disabled="pwSubmitting">
								{{ pwSubmitting ? 'Đang xử lý...' : 'Đổi mật khẩu' }}
							</CommonAppButton>
						</div>
					</form>
				</div>
			</template>
		</template>
	</div>
</template>
