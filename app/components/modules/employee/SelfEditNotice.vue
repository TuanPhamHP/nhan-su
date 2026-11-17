<script setup lang="ts">
	/**
	 * Dòng nhắc thay cho nút sửa, khi người dùng đang xem hồ sơ của chính mình.
	 *
	 * Backend chặn tự sửa hồ sơ mở rộng, thân nhân và kinh nghiệm của mình qua đường quản trị
	 * (403 `PROFILE_SELF_EDIT_FORBIDDEN`, trừ ADMIN). Nút sửa đã bị ẩn, nên phải nói rõ đi đâu
	 * để sửa, không thì người dùng tưởng mình mất quyền.
	 */
	withDefaults(defineProps<{ text?: string }>(), {
		text: 'Đây là hồ sơ của chính bạn nên phần này chỉ xem.',
	});
</script>

<template>
	<p class="text-xs text-gray-500 dark:text-gray-400">
		{{ text }}
		Bạn sửa ở
		<NuxtLink to="/profile" class="font-medium text-brand-600 hover:underline dark:text-brand-400">
			trang cá nhân
		</NuxtLink>
		, những thông tin cần duyệt sẽ được gửi cho người khác xem.
	</p>
</template>
