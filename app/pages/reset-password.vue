<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import { useAuthService } from '~/services';

	definePageMeta({ layout: 'auth' });

	const route = useRoute();
	const toast = useToast();

	const token = computed(() => (route.query.token as string) ?? '');

	const invalidToken = computed(() => !token.value || token.value.length !== 64);

	const schema = toTypedSchema(
		z
			.object({
				newPassword: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
				confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu'),
			})
			.refine(data => data.newPassword === data.confirmPassword, {
				message: 'Mật khẩu xác nhận không khớp',
				path: ['confirmPassword'],
			}),
	);

	const { handleSubmit, defineField, errors, isSubmitting } = useForm({ validationSchema: schema });
	const [newPassword, newPasswordAttrs] = defineField('newPassword');
	const [confirmPassword, confirmPasswordAttrs] = defineField('confirmPassword');

	const showNewPw = ref(false);
	const showConfirmPw = ref(false);

	const errorMessage = ref('');

	const onSubmit = handleSubmit(async values => {
		errorMessage.value = '';
		const { resetPassword } = useAuthService();
		try {
			await resetPassword({ token: token.value, newPassword: values.newPassword });
			toast.success('Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.');
			await navigateTo('/login');
		} catch (e) {
			const msg = e instanceof Error ? e.message : '';
			if (msg.includes('AUTH_RESET_TOKEN_EXPIRED')) {
				errorMessage.value = 'Link đặt lại mật khẩu đã hết hạn (1 giờ). Vui lòng yêu cầu link mới.';
			} else if (msg.includes('AUTH_INVALID_RESET_TOKEN')) {
				errorMessage.value = 'Link đặt lại mật khẩu không hợp lệ hoặc đã được sử dụng.';
			} else {
				errorMessage.value = msg || 'Đã có lỗi xảy ra. Vui lòng thử lại.';
			}
		}
	});
</script>

<template>
	<div class="min-h-screen flex dark:bg-gray-950">
		<!-- Left panel -->
		<div
			class="hidden lg:flex lg:w-1/2 flex-col justify-between bg-brand-700 dark:bg-brand-900 p-12 relative overflow-hidden"
		>
			<div class="absolute inset-0 overflow-hidden">
				<div class="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-brand-600/40 dark:bg-brand-800/40" />
				<div class="absolute -bottom-32 -right-16 w-80 h-80 rounded-full bg-brand-800/40 dark:bg-brand-950/40" />
			</div>
			<div class="relative z-10">
				<div class="flex items-center gap-3 mb-2">
					<div class="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
						<svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
							/>
						</svg>
					</div>
					<span class="text-xl font-bold text-white">8Hours - Solution</span>
				</div>
				<p class="text-brand-200 text-sm">Hệ thống quản lý nhân sự nội bộ</p>
			</div>
			<div class="relative z-10">
				<p class="text-brand-300 text-xs">© 2025 HR System. All rights reserved.</p>
			</div>
		</div>

		<!-- Right panel -->
		<div class="flex-1 flex flex-col justify-center items-center px-6 py-12 bg-white dark:bg-gray-900">
			<div class="w-full max-w-sm">
				<!-- Invalid / missing token -->
				<template v-if="invalidToken">
					<div class="text-center">
						<div
							class="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4"
						>
							<svg class="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
							</svg>
						</div>
						<h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Link không hợp lệ</h1>
						<p class="text-sm text-gray-500 dark:text-gray-400 mb-6">
							Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.
						</p>
						<NuxtLink
							to="/forgot-password"
							class="inline-block px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors mb-4"
						>
							Yêu cầu link mới
						</NuxtLink>
						<div>
							<NuxtLink
								to="/login"
								class="text-sm text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
							>
								← Quay lại đăng nhập
							</NuxtLink>
						</div>
					</div>
				</template>

				<!-- Form -->
				<template v-else>
					<div class="mb-8">
						<h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-1">Đặt lại mật khẩu</h1>
						<p class="text-sm text-gray-500 dark:text-gray-400">Nhập mật khẩu mới cho tài khoản của bạn.</p>
					</div>

					<!-- API error banner -->
					<div
						v-if="errorMessage"
						class="mb-5 flex items-start gap-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3"
					>
						<svg class="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
						</svg>
						<p class="text-sm text-red-700 dark:text-red-300">{{ errorMessage }}</p>
					</div>

					<form class="space-y-5" @submit.prevent="onSubmit">
						<!-- New password -->
						<div class="flex flex-col gap-1">
							<label for="newPassword" class="text-sm font-medium text-gray-700 dark:text-gray-300">
								Mật khẩu mới <span class="text-red-500">*</span>
							</label>
							<div class="relative">
								<input
									id="newPassword"
									v-model="newPassword"
									v-bind="newPasswordAttrs"
									:type="showNewPw ? 'text' : 'password'"
									placeholder="Tối thiểu 6 ký tự"
									autocomplete="new-password"
									:class="[
										'block w-full rounded-lg border px-3 py-2.5 pr-10 text-sm transition-colors',
										'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
										'placeholder:text-gray-400 dark:placeholder:text-gray-500',
										'focus:outline-none focus:ring-2 focus:ring-offset-0',
										errors.newPassword
											? 'border-red-400 focus:border-red-400 focus:ring-red-200 dark:border-red-500'
											: 'border-gray-300 focus:border-brand-500 focus:ring-brand-200 dark:border-gray-600 dark:focus:border-brand-400 dark:focus:ring-brand-900',
									]"
								/>
								<button
									type="button"
									class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
									@click="showNewPw = !showNewPw"
								>
									<svg v-if="showNewPw" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
									</svg>
									<svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
										<path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
									</svg>
								</button>
							</div>
							<p v-if="errors.newPassword" class="text-xs text-red-500 dark:text-red-400">{{ errors.newPassword }}</p>
						</div>

						<!-- Confirm password -->
						<div class="flex flex-col gap-1">
							<label for="confirmPassword" class="text-sm font-medium text-gray-700 dark:text-gray-300">
								Xác nhận mật khẩu mới <span class="text-red-500">*</span>
							</label>
							<div class="relative">
								<input
									id="confirmPassword"
									v-model="confirmPassword"
									v-bind="confirmPasswordAttrs"
									:type="showConfirmPw ? 'text' : 'password'"
									placeholder="Nhập lại mật khẩu mới"
									autocomplete="new-password"
									:class="[
										'block w-full rounded-lg border px-3 py-2.5 pr-10 text-sm transition-colors',
										'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
										'placeholder:text-gray-400 dark:placeholder:text-gray-500',
										'focus:outline-none focus:ring-2 focus:ring-offset-0',
										errors.confirmPassword
											? 'border-red-400 focus:border-red-400 focus:ring-red-200 dark:border-red-500'
											: 'border-gray-300 focus:border-brand-500 focus:ring-brand-200 dark:border-gray-600 dark:focus:border-brand-400 dark:focus:ring-brand-900',
									]"
								/>
								<button
									type="button"
									class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
									@click="showConfirmPw = !showConfirmPw"
								>
									<svg v-if="showConfirmPw" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
									</svg>
									<svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
										<path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
									</svg>
								</button>
							</div>
							<p v-if="errors.confirmPassword" class="text-xs text-red-500 dark:text-red-400">{{ errors.confirmPassword }}</p>
						</div>

						<CommonAppButton type="submit" :loading="isSubmitting" full-width size="lg">
							{{ isSubmitting ? 'Đang xử lý...' : 'Đặt lại mật khẩu' }}
						</CommonAppButton>

						<div class="text-center">
							<NuxtLink
								to="/login"
								class="text-sm text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
							>
								← Quay lại đăng nhập
							</NuxtLink>
						</div>
					</form>
				</template>
			</div>
		</div>
	</div>
</template>
