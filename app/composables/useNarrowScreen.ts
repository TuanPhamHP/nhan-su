/**
 * Màn hẹp (dưới mốc `sm` của Tailwind, 640px) hay không, theo dõi khi xoay máy hoặc đổi cỡ cửa sổ.
 *
 * Trước khi gắn vào trang (và khi render phía máy chủ) giá trị là `null`: nơi dùng vẽ cả hai dạng và để
 * lớp `sm:hidden` / `hidden sm:block` quyết định, khỏi nháy; gắn xong thì chỉ vẽ một dạng, để danh sách
 * dài không phải tạo hai lần menu và ô tạo nhanh cho mỗi dòng.
 */
export function useNarrowScreen() {
	const narrow = ref<boolean | null>(null);
	let mq: MediaQueryList | null = null;
	const update = () => {
		narrow.value = !!mq?.matches;
	};
	onMounted(() => {
		mq = window.matchMedia('(max-width: 639.98px)');
		update();
		mq.addEventListener('change', update);
	});
	onBeforeUnmount(() => mq?.removeEventListener('change', update));
	return narrow;
}
