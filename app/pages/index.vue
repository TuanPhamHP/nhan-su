<template>
	<div>
		<h1 class="text-bold text-2xl">Hello</h1>
	</div>
</template>
<script setup lang="ts">
	import { useAuthService } from '~/services';
	const login = ref('');
	const password = ref('');
	const authService = useAuthService();

	const handleSubmitForm = (e: any) => {
		e.preventDefault();
		const body = {
			login: login.value,
			password: password.value,
		};
		authService
			.login(body)
			.then(res => {
				console.log(res);
			})
			.catch(err => {
				console.error(err);
			});
	};
</script>
