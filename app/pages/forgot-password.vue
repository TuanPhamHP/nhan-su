<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import { useAuthService } from '~/services';

	definePageMeta({ layout: 'auth' });

	const toast = useToast();

	const schema = toTypedSchema(
		z.object({
			email: z.string().email('Email không hợp lệ'),
		}),
	);

	const { handleSubmit, defineField, errors, isSubmitting } = useForm({ validationSchema: schema });
	const [email, emailAttrs] = defineField('email');

	const submitted = ref(false);

	const onSubmit = handleSubmit(async values => {
		const { forgotPassword } = useAuthService();
		await forgotPassword({ email: values.email });
		submitted.value = true;
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
				<!-- Success state -->
				<template v-if="submitted">
					<div class="text-center">
						<div
							class="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4"
						>
							<svg class="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
							</svg>
						</div>
						<h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Kiểm tra email của bạn</h1>
						<p class="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
							Nếu email tồn tại trong hệ thống, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu trong vài phút tới.
						</p>
						<p class="text-xs text-gray-400 dark:text-gray-500 mb-6">
							Không nhận được email? Hãy liên hệ quản trị viên hệ thống.
						</p>
						<NuxtLink
							to="/login"
							class="text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline"
						>
							Quay lại đăng nhập
						</NuxtLink>
					</div>
				</template>

				<!-- Form state -->
				<template v-else>
					<div class="mb-8">
						<h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-1">Quên mật khẩu?</h1>
						<p class="text-sm text-gray-500 dark:text-gray-400">
							Nhập email tài khoản và chúng tôi sẽ gửi link đặt lại mật khẩu.
						</p>
					</div>

					<form class="space-y-5" @submit.prevent="onSubmit">
						<div class="flex flex-col gap-1">
							<label for="email" class="text-sm font-medium text-gray-700 dark:text-gray-300">
								Email <span class="text-red-500">*</span>
							</label>
							<input
								id="email"
								v-model="email"
								v-bind="emailAttrs"
								type="email"
								placeholder="email@company.com"
								autocomplete="email"
								:class="[
									'block w-full rounded-lg border px-3 py-2.5 text-sm transition-colors',
									'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
									'placeholder:text-gray-400 dark:placeholder:text-gray-500',
									'focus:outline-none focus:ring-2 focus:ring-offset-0',
									errors.email
										? 'border-red-400 focus:border-red-400 focus:ring-red-200 dark:border-red-500'
										: 'border-gray-300 focus:border-brand-500 focus:ring-brand-200 dark:border-gray-600 dark:focus:border-brand-400 dark:focus:ring-brand-900',
								]"
							/>
							<p v-if="errors.email" class="text-xs text-red-500 dark:text-red-400">{{ errors.email }}</p>
						</div>

						<CommonAppButton type="submit" :loading="isSubmitting" full-width size="lg">
							{{ isSubmitting ? 'Đang gửi...' : 'Gửi link đặt lại mật khẩu' }}
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
