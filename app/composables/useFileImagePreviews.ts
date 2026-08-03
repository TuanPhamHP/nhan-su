import type { Ref } from 'vue';

// Quản lý object URL cho ảnh preview từ File[] — tự revoke khi file bị bỏ hoặc component unmount.
export function useFileImagePreviews(filesRef: Ref<File[]>) {
	const urlMap = new Map<File, string>();

	function isImage(f: File): boolean {
		return f.type.startsWith('image/');
	}

	function getUrl(f: File): string {
		if (!isImage(f)) return '';
		let u = urlMap.get(f);
		if (!u) {
			u = URL.createObjectURL(f);
			urlMap.set(f, u);
		}
		return u;
	}

	watch(
		filesRef,
		current => {
			const set = new Set(current);
			for (const [f, u] of urlMap) {
				if (!set.has(f)) {
					URL.revokeObjectURL(u);
					urlMap.delete(f);
				}
			}
		},
		{ deep: false },
	);

	onBeforeUnmount(() => {
		for (const u of urlMap.values()) URL.revokeObjectURL(u);
		urlMap.clear();
	});

	return { getUrl, isImage };
}
