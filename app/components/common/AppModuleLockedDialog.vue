<script setup lang="ts">
	import { storeToRefs } from 'pinia';
	import { hotlineTelHref, lockHint, lockMessage } from '~/utils/app-launcher';
	import { useAuthStore } from '~/stores/auth';
	import type { ModuleStateReason } from '~/types/entitlement.types';

	/**
	 * Hộp thoại khi người dùng bấm vào một phân hệ công ty chưa dùng được.
	 *
	 * Lưới chọn phân hệ và sidebar trang chủ đều mở hộp thoại này, nên câu chữ chỉ có một chỗ sửa.
	 */
	const props = defineProps<{
		/** Tên phân hệ, ví dụ "Tuyển dụng". */
		label: string;
		/** Một câu mô tả phân hệ, lấy từ cấu hình lưới. */
		description: string;
		reason: ModuleStateReason;
	}>();

	const emit = defineEmits<{ close: [] }>();

	const { user } = useAuth();
	// Hotline về cùng response với `modules`, nên lấy thẳng từ store thay vì hỏi API lần nữa.
	const { businessHotline } = storeToRefs(useAuthStore());
	const uiStore = useUiStore();

	const message = computed(() => lockMessage(props.label, props.reason));
	/**
	 * Quản trị viên là người đi đăng ký thêm phân hệ, người khác thì hỏi quản trị viên công ty mình.
	 *
	 * Xét vai trò HIỆU LỰC chứ không phải `user.role`, cùng luật với dòng báo hết hạn cho admin:
	 * quản trị viên đang bật "xem giao diện nhân viên" phải đọc đúng thứ nhân viên đọc, nếu không
	 * họ kiểm tra giao diện nhân viên mà vẫn thấy số hotline thì bản xem thử nói dối.
	 */
	const hint = computed(() => {
		const effectiveRole = uiStore.previewRole ?? user.value?.role;
		return lockHint(effectiveRole === 'ADMIN', businessHotline.value);
	});

	function onKeydown(e: KeyboardEvent): void {
		if (e.key !== 'Escape') return;
		// Hộp thoại này mở bên trên lưới chọn phân hệ, mà lưới cũng đóng bằng Esc. Bắt ở pha
		// capture rồi chặn lại để một lần Esc chỉ đóng một lớp, không đóng luôn cả lưới.
		e.stopPropagation();
		emit('close');
	}

	onMounted(() => {
		document.addEventListener('keydown', onKeydown, true);
	});

	onUnmounted(() => {
		document.removeEventListener('keydown', onKeydown, true);
	});
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-[60] flex items-center justify-center px-4" data-testid="module-locked-dialog">
			<div class="absolute inset-0 bg-black/40" @click="emit('close')" />

			<div
				role="dialog"
				aria-modal="true"
				:aria-label="`Phân hệ ${label} chưa dùng được`"
				class="relative w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800"
			>
				<div class="flex items-start gap-3">
					<div
						class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700"
					>
						<svg
							class="h-5 w-5 text-gray-500 dark:text-gray-300"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
							/>
						</svg>
					</div>
					<div class="min-w-0">
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ label }}</h2>
						<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ description }}</p>
					</div>
				</div>

				<p class="mt-4 text-sm text-gray-700 dark:text-gray-200">{{ message }}</p>
				<!--
					Số hotline là liên kết `tel:` để trên điện thoại bấm một cái là gọi. Ba mảnh câu
					nằm sát nhau trong một dòng nguồn, không xuống dòng: Vue render mỗi lần xuống dòng
					thành một khoảng trắng, thành ra "hotline 0888888888 ." thừa chỗ trước dấu chấm.
				-->
				<p class="mt-2 text-sm text-gray-600 dark:text-gray-300" data-testid="module-locked-hint">
					<span>{{ hint.before }}</span><a
						v-if="hint.phone"
						:href="hotlineTelHref(hint.phone)"
						class="font-medium text-brand-600 underline underline-offset-2 hover:text-brand-700 dark:text-brand-400"
						data-testid="module-locked-hotline"
					>{{ hint.phone }}</a><span v-if="hint.after">{{ hint.after }}</span>
				</p>

				<div class="mt-6 flex justify-end">
					<CommonAppButton variant="outline" data-testid="module-locked-close" @click="emit('close')">
						Đóng
					</CommonAppButton>
				</div>
			</div>
		</div>
	</Teleport>
</template>
