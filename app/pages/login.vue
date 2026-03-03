<template>
	<div>
		<h1 class="text-bold text-2xl">Hello</h1>
		<!-- Genertate login form -->
		<div class="w-[550px] mx-auto">
			<form class="mt-4" @submit="handleSubmitForm">
				<div class="mb-4">
					<label for="login" class="block text-sm font-medium text-gray-700">Login</label>
					<input
						v-model="loginValue"
						type="text"
						id="login"
						class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
						placeholder="Enter your login"
					/>
				</div>
				<div class="mb-4">
					<label for="password" class="block text-sm font-medium text-gray-700">Password</label>
					<input
						v-model="password"
						type="password"
						id="password"
						class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
						placeholder="Enter your password"
					/>
				</div>
				<button type="submit" class="w-full bg-blue-500 text-white font-bold py-2 rounded hover:bg-blue-600">
					Login
				</button>
			</form>
		</div>
	</div>
</template>
<script setup lang="ts">
	import { useAuthStore } from '~/stores/auth';

	const loginValue = ref('');
	const password = ref('');
	const authStore = useAuthStore();

	const handleSubmitForm = async (e: Event) => {
		e.preventDefault();
		await authStore.login({ login: loginValue.value, password: password.value });
		await navigateTo('/');
	};
</script>
