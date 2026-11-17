<script setup lang="ts">
	/**
	 * Khung cho trang dành cho NGƯỜI NGOÀI công ty: trang tuyển dụng và trang phản hồi offer.
	 *
	 * Vì sao không dùng `auth`: layout đó là khung của trang đăng nhập, sau này thêm logo hay
	 * câu quảng cáo vào đó thì nó lọt sang trang tuyển dụng. Và không dùng `default`: người
	 * quản lý đang đăng nhập mở link tin tuyển dụng vẫn phải thấy đúng trang ứng viên thấy,
	 * không phải sidebar quản trị (xem nhánh sớm trong `role-layout.global.ts`).
	 */
</script>

<template>
	<div class="min-h-screen bg-gray-50 dark:bg-gray-950">
		<slot />
		<ClientOnly><CommonAppToastContainer /></ClientOnly>
	</div>
</template>
