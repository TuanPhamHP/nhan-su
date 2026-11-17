<script setup lang="ts">
	import { companyInitial } from '~/utils/company-branding';

	/**
	 * Logo công ty cỡ nhỏ, dùng cạnh tên công ty ở header và ở bước chọn công ty khi đăng nhập.
	 *
	 * Công ty chưa có logo, hoặc logo tải không được, thì vẽ chữ cái đầu của tên — hoặc thứ nơi gọi
	 * đặt vào slot, như biểu tượng toà nhà vốn có ở header. Ảnh tải không được là chuyện bình
	 * thường chứ không phải lỗi: URL trong phiên có thể trỏ tới ảnh người vận hành vừa gỡ, lúc đó
	 * server trả 404.
	 */
	const props = withDefaults(
		defineProps<{
			name: string;
			logoUrl?: string | null;
			/** `sm` cho header, `md` cho danh sách công ty ở trang đăng nhập. */
			size?: 'sm' | 'md';
		}>(),
		{ logoUrl: null, size: 'sm' },
	);

	/**
	 * URL vừa tải lỗi. Giữ chính URL thay vì một cờ đúng/sai: người vận hành đổi ảnh thì `?v=`
	 * tăng, URL mới khác URL cũ nên component tự thử lại mà không cần ai gọi.
	 */
	const failed = ref<string | null>(null);

	const src = computed(() => {
		const url = props.logoUrl?.trim();
		return url && url !== failed.value ? url : null;
	});

	const box = computed(() => (props.size === 'md' ? 'w-10 h-10 rounded-lg text-base' : 'w-6 h-6 rounded text-xs'));
</script>

<template>
	<img
		v-if="src"
		:src="src"
		:alt="`Logo ${name}`"
		:class="['flex-shrink-0 object-contain', box]"
		data-testid="company-logo"
		@error="failed = src"
	/>
	<slot v-else>
		<span
			:class="[
				'flex flex-shrink-0 items-center justify-center bg-brand-100 font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300',
				box,
			]"
			data-testid="company-initial"
			aria-hidden="true"
		>
			{{ companyInitial(name) }}
		</span>
	</slot>
</template>
