<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import type { Gender } from '~/types/auth.types';
	import type { Employee } from '~/types/employee.types';
	import { useAuthService } from '~/services';
	import { formatDate } from '~/utils/date';

	definePageMeta({ title: 'Hồ sơ cá nhân' });

	const toast = useToast();
	const { updateProfile, uploadAvatar, uploadingAvatar } = useProfile();
	const authStore = useAuthStore();

	const router = useRouter();
	// ─── Load profile ─────────────────────────────────────────────────────────────

	const profile = ref<Employee | null>(null);
	const pageLoading = ref(true);

	onMounted(async () => {
		try {
			const { me } = useAuthService();
			profile.value = await me();
			resetFormFromProfile();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Không tải được hồ sơ');
		} finally {
			pageLoading.value = false;
		}
	});

	// ─── Form ────────────────────────────────────────────────────────────────────

	const schema = toTypedSchema(
		z.object({
			fullName: z.string().min(2, 'Tối thiểu 2 ký tự').max(100, 'Tối đa 100 ký tự'),
			email: z.string().email('Email không hợp lệ'),
			phone: z
				.string()
				.regex(/^[0-9]{9,11}$/, 'Số điện thoại không hợp lệ (9-11 chữ số)')
				.or(z.literal(''))
				.optional(),
			dateOfBirth: z.string().optional(),
			gender: z.enum(['Nam', 'Nữ', 'Khác']).or(z.literal('')).optional(),
			address: z.string().optional(),
		}),
	);

	const { handleSubmit, defineField, errors, isSubmitting, resetForm } = useForm({ validationSchema: schema });

	const [fullName, fullNameAttrs] = defineField('fullName');
	const [email, emailAttrs] = defineField('email');
	const [phone, phoneAttrs] = defineField('phone');
	const [dateOfBirth, dateOfBirthAttrs] = defineField('dateOfBirth');
	const [gender] = defineField('gender');
	const [address, addressAttrs] = defineField('address');

	function resetFormFromProfile() {
		const p = profile.value;
		if (!p) return;
		resetForm({
			values: {
				fullName: p.fullName,
				email: p.email,
				phone: p.phone ?? '',
				dateOfBirth: p.dateOfBirth ?? '',
				gender: (p.gender as Gender | '') ?? '',
				address: p.address ?? '',
			},
		});
	}

	const isEditing = ref(false);

	function startEditing() {
		resetFormFromProfile();
		isEditing.value = true;
	}

	function cancelEditing() {
		resetFormFromProfile();
		isEditing.value = false;
	}

	const onSubmit = handleSubmit(async values => {
		const updated = await updateProfile({
			fullName: values.fullName,
			email: values.email,
			phone: values.phone || undefined,
			dateOfBirth: values.dateOfBirth || undefined,
			gender: (values.gender as Gender) || undefined,
			address: values.address || undefined,
		});
		profile.value = { ...profile.value!, ...updated };
		isEditing.value = false;
	});

	// ─── Avatar upload ────────────────────────────────────────────────────────────

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
		if (profile.value) profile.value.avatarUrl = updated.avatarUrl;
		if (avatarInput.value) avatarInput.value.value = '';
	}

	// ─── Helpers ──────────────────────────────────────────────────────────────────

	const genderOptions: { value: string; label: string }[] = [
		{ value: '', label: '-- Không rõ --' },
		{ value: 'Nam', label: 'Nam' },
		{ value: 'Nữ', label: 'Nữ' },
		{ value: 'Khác', label: 'Khác' },
	];

	const currentAvatarUrl = computed(() => profile.value?.avatarUrl ?? authStore.user?.avatarUrl ?? null);
	const initials = computed(() => {
		const name = profile.value?.fullName ?? authStore.user?.fullName ?? '';
		return name.charAt(0).toUpperCase();
	});

	const inputCls =
		'block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm px-3 py-2.5 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50';
	const labelCls = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1';
	const valueCls = 'text-sm text-gray-900 dark:text-white';
</script>

<template>
	<div class="max-w-3xl mx-auto space-y-6">
		<!-- Page title + actions -->
		<div class="flex items-center justify-between">
			<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Hồ sơ cá nhân</h1>
			<CommonAppButton v-if="profile && !isEditing" variant="primary" @click="startEditing">
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
					/>
				</svg>
				Chỉnh sửa
			</CommonAppButton>
		</div>

		<!-- Loading skeleton -->
		<div
			v-if="pageLoading"
			class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 space-y-6"
		>
			<div class="flex items-center gap-5">
				<div class="w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse flex-shrink-0" />
				<div class="space-y-2">
					<div class="h-5 w-44 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
					<div class="h-4 w-28 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
				</div>
			</div>
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
				<div v-for="i in 6" :key="i" class="space-y-1.5">
					<div class="h-3 w-20 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
					<div class="h-4 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
				</div>
			</div>
		</div>

		<template v-else-if="profile">
			<!-- Avatar + identity card -->
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
				<div class="flex flex-col sm:flex-row sm:items-center gap-5">
					<!-- Avatar -->
					<div class="relative flex-shrink-0 group">
						<div
							class="w-20 h-20 rounded-full overflow-hidden bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center ring-2 ring-gray-200 dark:ring-gray-700"
						>
							<img
								v-if="currentAvatarUrl"
								:src="currentAvatarUrl"
								:alt="profile.fullName"
								class="w-full h-full object-cover"
							/>
							<span v-else class="text-3xl font-bold text-brand-600 dark:text-brand-400">
								{{ initials }}
							</span>
						</div>
						<!-- Upload overlay -->
						<button
							type="button"
							class="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
							:class="{ 'opacity-100 cursor-wait': uploadingAvatar }"
							:disabled="uploadingAvatar"
							@click="triggerAvatarPicker"
						>
							<svg
								v-if="!uploadingAvatar"
								class="w-5 h-5 text-white"
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
							<svg v-else class="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
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

					<!-- Name + meta -->
					<div class="min-w-0">
						<h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ profile.fullName }}</h2>
						<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
							{{ profile.email }}
							<span class="mx-1.5">·</span>
							<span
								class="text-xs inline-block text-brand-600 px-1 border rounded border-brand-600 bg-brand-100 font-bold"
								>{{ profile.employeeCode }}</span
							>
						</p>
						<p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
							Hover vào ảnh để thay đổi ảnh đại diện (JPG/PNG, tối đa 2MB)
						</p>
					</div>
				</div>
			</div>

			<!-- Info / Edit form card -->
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
				<h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-5">Thông tin cá nhân</h3>

				<!-- View mode -->
				<div v-if="!isEditing" class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
					<div>
						<p :class="labelCls">Họ và tên</p>
						<p :class="valueCls">{{ profile.fullName }}</p>
					</div>
					<div>
						<p :class="labelCls">Email</p>
						<p :class="valueCls">{{ profile.email }}</p>
					</div>
					<div>
						<p :class="labelCls">Số điện thoại</p>
						<p :class="valueCls">{{ profile.phone ?? '—' }}</p>
					</div>
					<div>
						<p :class="labelCls">Ngày sinh</p>
						<p :class="valueCls">{{ profile.dateOfBirth ? formatDate(profile.dateOfBirth) : '—' }}</p>
					</div>
					<div>
						<p :class="labelCls">Giới tính</p>
						<p :class="valueCls">{{ profile.gender ?? '—' }}</p>
					</div>
					<div>
						<p :class="labelCls">Địa chỉ</p>
						<p :class="valueCls">{{ profile.address ?? '—' }}</p>
					</div>
				</div>

				<!-- Edit mode -->
				<form v-else class="space-y-5" @submit.prevent="onSubmit">
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
						<div>
							<label :class="labelCls">Họ và tên <span class="text-red-500">*</span></label>
							<input v-model="fullName" v-bind="fullNameAttrs" :class="inputCls" placeholder="Nguyễn Văn A" />
							<p v-if="errors.fullName" class="mt-1 text-xs text-red-500">{{ errors.fullName }}</p>
						</div>
						<div>
							<label :class="labelCls">Email <span class="text-red-500">*</span></label>
							<input
								v-model="email"
								v-bind="emailAttrs"
								type="email"
								:class="inputCls"
								placeholder="email@company.com"
							/>
							<p v-if="errors.email" class="mt-1 text-xs text-red-500">{{ errors.email }}</p>
						</div>
						<div>
							<label :class="labelCls">Số điện thoại</label>
							<input v-model="phone" v-bind="phoneAttrs" :class="inputCls" placeholder="0901234567" />
							<p v-if="errors.phone" class="mt-1 text-xs text-red-500">{{ errors.phone }}</p>
						</div>
						<div>
							<label :class="labelCls">Ngày sinh</label>
							<input v-model="dateOfBirth" v-bind="dateOfBirthAttrs" type="date" :class="inputCls" />
							<p v-if="errors.dateOfBirth" class="mt-1 text-xs text-red-500">{{ errors.dateOfBirth }}</p>
						</div>
						<div>
							<label :class="labelCls">Giới tính</label>
							<select v-model="gender" :class="inputCls">
								<option v-for="opt in genderOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
							</select>
						</div>
						<div class="sm:col-span-2">
							<label :class="labelCls">Địa chỉ</label>
							<input
								v-model="address"
								v-bind="addressAttrs"
								:class="inputCls"
								placeholder="123 Lê Lợi, Quận 1, TP.HCM"
							/>
						</div>
					</div>

					<div class="flex items-center justify-end gap-3 pt-2">
						<CommonAppButton type="button" variant="outline" :disabled="isSubmitting" @click="cancelEditing">
							Hủy
						</CommonAppButton>
						<CommonAppButton type="submit" variant="primary" :disabled="isSubmitting">
							{{ isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi' }}
						</CommonAppButton>
					</div>
				</form>
			</div>

			<!-- Read-only work info card -->
			<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
				<h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-5">Thông tin công việc</h3>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
					<div>
						<p :class="labelCls">Mã nhân viên</p>
						<p
							class="text-sm text-xs inline-block text-brand-600 px-1 border rounded border-brand-600 bg-brand-100 font-bold"
						>
							{{ profile.employeeCode }}
						</p>
					</div>
					<div>
						<p :class="labelCls">Vai trò</p>
						<p :class="valueCls">{{ profile.role }}</p>
					</div>
					<div>
						<p :class="labelCls">Phòng ban</p>
						<p
							:class="[valueCls, 'cursor-pointer hover:underline hover:text-blue-500']"
							@click="router.push(`/departments/${profile.department?.id}`)"
						>
							{{ profile.department?.name ?? '—' }}
						</p>
					</div>
					<div>
						<p :class="labelCls">Chức vụ</p>
						<p :class="valueCls">{{ profile.position?.name ?? '—' }}</p>
					</div>
					<div>
						<p :class="labelCls">Ngày vào làm</p>
						<p :class="valueCls">{{ formatDate(profile.joinDate) }}</p>
					</div>
					<div>
						<p :class="labelCls">Trạng thái</p>
						<p :class="valueCls">{{ profile.status }}</p>
					</div>
				</div>
			</div>
		</template>
	</div>
</template>
