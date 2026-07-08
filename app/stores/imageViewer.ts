export const useImageViewerStore = defineStore('imageViewer', () => {
	const listImagesUrls = ref<string[]>([]);
	const currentImageIndex = ref(0);
	const isOpen = ref(false);

	const currentImageUrl = computed<string | null>(() => {
		if (!isOpen.value) return null;
		return listImagesUrls.value[currentImageIndex.value] ?? null;
	});

	const canPrev = computed(() => isOpen.value && currentImageIndex.value > 0);
	const canNext = computed(
		() => isOpen.value && currentImageIndex.value < listImagesUrls.value.length - 1,
	);

	function open(urls: string[], index = 0) {
		if (!urls.length) return;
		const clamped = Math.max(0, Math.min(index, urls.length - 1));
		listImagesUrls.value = urls;
		currentImageIndex.value = clamped;
		isOpen.value = true;
	}

	function close() {
		isOpen.value = false;
		listImagesUrls.value = [];
		currentImageIndex.value = 0;
	}

	function setIndex(index: number) {
		if (index < 0 || index >= listImagesUrls.value.length) return;
		currentImageIndex.value = index;
	}

	function next() {
		if (canNext.value) currentImageIndex.value += 1;
	}

	function prev() {
		if (canPrev.value) currentImageIndex.value -= 1;
	}

	return {
		listImagesUrls,
		currentImageIndex,
		isOpen,
		currentImageUrl,
		canPrev,
		canNext,
		open,
		close,
		setIndex,
		next,
		prev,
	};
});
