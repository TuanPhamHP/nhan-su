<script setup lang="ts">
	import FaceRegisterModal from '~/components/modules/attendance/FaceRegisterModal.vue';
	import type { MyFaceStatusResponseDto } from '~/types/attendance.types';
	import { formatDate } from '~/utils/date';

	/**
	 * Thẻ "Khuôn mặt chấm công" ở hồ sơ của tôi.
	 *
	 * Không có đường tự xoá hay tự đăng ký lại: muốn thay khuôn mặt thì nhờ phòng nhân sự xoá cái
	 * cũ, để người cầm máy đã đăng nhập không thay được mặt mình vào tài khoản người khác.
	 */
	const toast = useToast();
	const imageViewer = useImageViewerStore();
	const { loading, getMine } = useAttendanceFace();

	const status = ref<MyFaceStatusResponseDto | null>(null);
	const showRegister = ref(false);

	async function load() {
		try {
			status.value = await getMine();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Không tải được khuôn mặt chấm công');
		}
	}

	async function onRegistered(next: MyFaceStatusResponseDto | null) {
		showRegister.value = false;
		if (next) status.value = next;
		else await load();
	}

	onMounted(load);
</script>

<template>
	<div
		class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900"
		data-testid="profile-face-card"
	>
		<h3 class="mb-4 text-sm font-semibold text-gray-900 dark:text-white">Khuôn mặt chấm công</h3>

		<p v-if="loading && !status" class="text-sm text-gray-400">Đang tải...</p>

		<div v-else-if="status?.registered" class="flex items-start gap-4">
			<img
				v-if="status.photoUrl"
				:src="status.photoUrl"
				alt="Ảnh khuôn mặt đã đăng ký"
				class="h-24 w-20 flex-shrink-0 cursor-pointer rounded-lg border border-gray-200 object-cover dark:border-gray-700"
				@click="imageViewer.open([status.photoUrl], 0)"
			/>
			<div class="min-w-0 text-sm">
				<p class="text-gray-900 dark:text-white">Đã đăng ký ngày {{ formatDate(status.registeredAt) }}</p>
				<p class="mt-1 text-gray-500 dark:text-gray-400">Muốn đăng ký lại, bạn nhờ phòng nhân sự xoá khuôn mặt cũ.</p>
			</div>
		</div>

		<div v-else-if="status" class="space-y-3">
			<p class="text-sm text-gray-500 dark:text-gray-400">
				<template v-if="status.enabled">
					Bạn chưa đăng ký khuôn mặt. Công ty đang bật chấm công bằng khuôn mặt nên bạn cần đăng ký trước lần chấm
					công tới.
				</template>
				<template v-else>
					Bạn chưa đăng ký khuôn mặt. Công ty chưa bật chấm công bằng khuôn mặt nên việc này chưa bắt buộc.
				</template>
			</p>
			<CommonAppButton variant="primary" @click="showRegister = true">Đăng ký khuôn mặt</CommonAppButton>
		</div>
	</div>

	<FaceRegisterModal v-if="showRegister" @registered="onRegistered" @close="showRegister = false" />
</template>
