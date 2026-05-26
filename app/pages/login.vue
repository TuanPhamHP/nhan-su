<script setup lang="ts">
	import { useForm } from 'vee-validate';

	definePageMeta({ layout: 'auth' });

	const { login } = useAuth();
	const toast = useToast();
	const { isDark, toggle: toggleDark } = useColorMode();

	const { handleSubmit, defineField, errors, isSubmitting } = useForm({
		validationSchema: {
			email: (v: string) => (v?.trim() ? true : 'Vui lòng nhập email hoặc mã nhân viên'),
			password: (v: string) => {
				if (!v) return 'Vui lòng nhập mật khẩu';
				if (v.length < 6) return 'Mật khẩu tối thiểu 6 ký tự';
				return true;
			},
		},
	});

	const [email, emailAttrs] = defineField('email');
	const [password, passwordAttrs] = defineField('password');

	const showPassword = ref(false);

	const defaultAccounts = [
		{ label: 'Admin', email: 'tuanp.fs.contact@gmail.com', role: 'ADMIN', password: 'admin@123' },
		{ label: 'HR', email: 'hanh.dh@sonthanh.net', role: 'HR', password: 'Hr@123456' },
		{ label: 'Phòng KT - Manager', email: 'tuan.pa@8hours.vn', role: 'MANAGER', password: 'Abcd@1234' },
		{ label: 'Phòng KT - Employee', email: 'oanh.nt@8hours.vn', role: 'EMPLOYEE', password: 'Abcd@1234' },
	];

	function fillAccount(account: { email: string; password: string }) {
		email.value = account.email;
		password.value = account.password;
	}

	const onSubmit = handleSubmit(async values => {
		try {
			await login({ email: values.email, password: values.password });
			toast.success('Đăng nhập thành công! Chào mừng trở lại.');
			await navigateTo('/');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Tài khoản hoặc mật khẩu không đúng');
		}
	});

	const quotes = [
		{ text: 'Mỗi ngày là một cơ hội mới để trở nên tốt hơn.', author: 'Khuyết danh' },
		{
			text: 'Thành công không phải là chìa khóa của hạnh phúc. Hạnh phúc mới là chìa khóa của thành công.',
			author: 'Albert Schweitzer',
		},
		{
			text: 'Điều duy nhất ngăn bạn thực hiện ước mơ của mình là nỗi sợ rằng bạn sẽ thất bại.',
			author: 'Paulo Coelho',
		},
		{ text: 'Hành trình ngàn dặm bắt đầu từ một bước chân.', author: 'Lão Tử' },
		{ text: 'Không có thang máy dẫn đến thành công — bạn phải đi cầu thang.', author: 'Zig Ziglar' },
	];

	const todayQuote = computed(() => {
		const day = new Date().getDay();
		return quotes[day % quotes.length];
	});
</script>

<template>
	<div class="min-h-screen flex dark:bg-gray-950">
		<!-- Left panel — brand -->
		<div
			class="hidden lg:flex lg:w-1/2 flex-col justify-between bg-brand-700 dark:bg-brand-900 p-12 relative overflow-hidden"
		>
			<!-- Background decoration -->
			<div class="absolute inset-0 overflow-hidden">
				<div class="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-brand-600/40 dark:bg-brand-800/40" />
				<div class="absolute -bottom-32 -right-16 w-80 h-80 rounded-full bg-brand-800/40 dark:bg-brand-950/40" />
				<div
					class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-brand-600/20"
				/>
			</div>

			<!-- Logo & Title -->
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
					<span class="text-xl font-bold text-white">HR System</span>
				</div>
				<p class="text-brand-200 text-sm">Hệ thống quản lý nhân sự nội bộ</p>
			</div>

			<!-- Daily Quote -->
			<div class="relative z-10">
				<blockquote class="text-white">
					<div class="text-4xl text-brand-300 font-serif leading-none mb-3">"</div>
					<p class="text-lg font-medium leading-relaxed mb-4">{{ todayQuote.text }}</p>
					<footer class="text-brand-300 text-sm">— {{ todayQuote.author }}</footer>
				</blockquote>
			</div>

			<!-- Footer -->
			<div class="relative z-10">
				<p class="text-brand-300 text-xs">© 2025 HR System. All rights reserved.</p>
			</div>
		</div>

		<!-- Right panel — form -->
		<div class="flex-1 flex flex-col justify-center items-center px-6 py-12 bg-white dark:bg-gray-900">
			<!-- Dark mode toggle -->
			<div class="absolute top-4 right-4">
				<button
					class="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-400 transition-colors"
					:title="isDark ? 'Light mode' : 'Dark mode'"
					@click="toggleDark"
				>
					<svg v-if="isDark" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
						/>
					</svg>
					<svg v-else class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
						/>
					</svg>
				</button>
			</div>

			<div class="w-full max-w-sm">
				<!-- Mobile logo -->
				<div class="lg:hidden flex items-center gap-2 mb-8">
					<div class="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
						<svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
							/>
						</svg>
					</div>
					<span class="text-lg font-bold text-gray-900 dark:text-white">HR System</span>
				</div>

				<!-- Heading -->
				<div class="mb-8">
					<h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-1">Chào mừng trở lại</h1>
					<p class="text-sm text-gray-500 dark:text-gray-400">Đăng nhập để tiếp tục quản lý hệ thống</p>
				</div>

				<!-- Form -->
				<form class="space-y-5" @submit.prevent="onSubmit">
					<!-- Email -->
					<div class="flex flex-col gap-1">
						<label for="email" class="text-sm font-medium text-gray-700 dark:text-gray-300">
							Email hoặc mã nhân viên <span class="text-red-500">*</span>
						</label>
						<input
							id="email"
							v-model="email"
							v-bind="emailAttrs"
							type="text"
							placeholder="admin@company.com hoặc EMP001"
							autocomplete="username"
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

					<!-- Password -->
					<div class="flex flex-col gap-1">
						<label for="password" class="text-sm font-medium text-gray-700 dark:text-gray-300">
							Mật khẩu <span class="text-red-500">*</span>
						</label>
						<div class="relative">
							<input
								id="password"
								v-model="password"
								v-bind="passwordAttrs"
								:type="showPassword ? 'text' : 'password'"
								placeholder="••••••••"
								autocomplete="current-password"
								:class="[
									'block w-full rounded-lg border px-3 py-2.5 pr-10 text-sm transition-colors',
									'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
									'placeholder:text-gray-400 dark:placeholder:text-gray-500',
									'focus:outline-none focus:ring-2 focus:ring-offset-0',
									errors.password
										? 'border-red-400 focus:border-red-400 focus:ring-red-200 dark:border-red-500'
										: 'border-gray-300 focus:border-brand-500 focus:ring-brand-200 dark:border-gray-600 dark:focus:border-brand-400 dark:focus:ring-brand-900',
								]"
							/>
							<button
								type="button"
								class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
								@click="showPassword = !showPassword"
							>
								<svg
									v-if="showPassword"
									class="w-4 h-4"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
									/>
								</svg>
								<svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
									/>
								</svg>
							</button>
						</div>
						<p v-if="errors.password" class="text-xs text-red-500 dark:text-red-400">{{ errors.password }}</p>
					</div>
					<!-- <button
						class="p-2 w-full text-center bg-gray-700 text-white rounded-lg hover:bg-gray-900 dark:hover:bg-gray-800 dark:text-gray-400 transition-colors"
						type="submit"
					>
						Đăng nhập
					</button> -->
					<!-- Default accounts -->
					<div
						class="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-3 bg-gray-50 dark:bg-gray-800/50"
					>
						<p class="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">Tài khoản login nhanh:</p>
						<div class="flex flex-wrap gap-2">
							<button
								v-for="acc in defaultAccounts"
								:key="acc.email"
								type="button"
								class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
								@click="fillAccount(acc)"
							>
								<span class="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
								{{ acc.label }}
								<span class="text-gray-400 dark:text-gray-500">·</span>
								{{ acc.email }}
							</button>
						</div>
					</div>

					<!-- Submit -->
					<CommonAppButton type="submit" :loading="isSubmitting" full-width size="lg">
						{{ isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập' }}
					</CommonAppButton>
				</form>
			</div>
		</div>
	</div>
</template>
