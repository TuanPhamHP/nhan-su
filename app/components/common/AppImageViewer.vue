<script setup lang="ts">
const store = useImageViewerStore();
const { listImagesUrls, currentImageIndex, isOpen, currentImageUrl, canPrev, canNext } =
	storeToRefs(store);

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const SCALE_STEP = 0.25;

const scale = ref(1);
const translate = reactive({ x: 0, y: 0 });
const isDragging = ref(false);
const dragStart = { x: 0, y: 0, tx: 0, ty: 0 };
const imageLoading = ref(false);

const thumbRefs = ref<Array<HTMLElement | null>>([]);

const canZoomIn = computed(() => scale.value < MAX_SCALE);
const canZoomOut = computed(() => scale.value > MIN_SCALE);
const isZoomed = computed(() => scale.value > MIN_SCALE);

const imageStyle = computed(() => ({
	transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale.value})`,
	cursor: isZoomed.value ? (isDragging.value ? 'grabbing' : 'grab') : 'zoom-in',
}));

function resetTransform() {
	scale.value = 1;
	translate.x = 0;
	translate.y = 0;
}

function zoomIn() {
	scale.value = Math.min(MAX_SCALE, scale.value + SCALE_STEP);
	if (scale.value === MIN_SCALE) {
		translate.x = 0;
		translate.y = 0;
	}
}

function zoomOut() {
	scale.value = Math.max(MIN_SCALE, scale.value - SCALE_STEP);
	if (scale.value === MIN_SCALE) {
		translate.x = 0;
		translate.y = 0;
	}
}

function onWheel(e: WheelEvent) {
	e.preventDefault();
	const delta = e.deltaY < 0 ? SCALE_STEP : -SCALE_STEP;
	const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale.value + delta));
	scale.value = next;
	if (next === MIN_SCALE) {
		translate.x = 0;
		translate.y = 0;
	}
}

function onImageClick() {
	if (!isZoomed.value) {
		scale.value = 2;
	}
}

function onImageDoubleClick() {
	if (isZoomed.value) resetTransform();
	else scale.value = 2;
}

function onDragStart(e: PointerEvent) {
	if (!isZoomed.value) return;
	isDragging.value = true;
	dragStart.x = e.clientX;
	dragStart.y = e.clientY;
	dragStart.tx = translate.x;
	dragStart.ty = translate.y;
	(e.target as HTMLElement).setPointerCapture(e.pointerId);
}

function onDragMove(e: PointerEvent) {
	if (!isDragging.value) return;
	translate.x = dragStart.tx + (e.clientX - dragStart.x);
	translate.y = dragStart.ty + (e.clientY - dragStart.y);
}

function onDragEnd(e: PointerEvent) {
	if (!isDragging.value) return;
	isDragging.value = false;
	(e.target as HTMLElement).releasePointerCapture(e.pointerId);
}

function goPrev() {
	store.prev();
}

function goNext() {
	store.next();
}

function selectIndex(i: number) {
	store.setIndex(i);
}

function close() {
	store.close();
}

function onKeyDown(e: KeyboardEvent) {
	if (!isOpen.value) return;
	switch (e.key) {
		case 'Escape':
			close();
			break;
		case 'ArrowLeft':
			goPrev();
			break;
		case 'ArrowRight':
			goNext();
			break;
		case '+':
		case '=':
			zoomIn();
			break;
		case '-':
		case '_':
			zoomOut();
			break;
		case '0':
			resetTransform();
			break;
	}
}

function onBackdropClick(e: MouseEvent) {
	if (e.target === e.currentTarget) close();
}

function scrollThumbIntoView() {
	nextTick(() => {
		const el = thumbRefs.value[currentImageIndex.value];
		el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
	});
}

watch(currentImageIndex, () => {
	resetTransform();
	imageLoading.value = true;
	scrollThumbIntoView();
});

watch(isOpen, open => {
	if (open) {
		resetTransform();
		imageLoading.value = true;
		document.body.style.overflow = 'hidden';
		scrollThumbIntoView();
	} else {
		document.body.style.overflow = '';
	}
});

onMounted(() => {
	window.addEventListener('keydown', onKeyDown);
});

onBeforeUnmount(() => {
	window.removeEventListener('keydown', onKeyDown);
	document.body.style.overflow = '';
});
</script>

<template>
	<Teleport to="body">
		<Transition
			enter-active-class="transition-opacity duration-200"
			enter-from-class="opacity-0"
			enter-to-class="opacity-100"
			leave-active-class="transition-opacity duration-150"
			leave-from-class="opacity-100"
			leave-to-class="opacity-0"
		>
			<div
				v-if="isOpen"
				class="fixed inset-0 z-[9998] flex bg-black/95 select-none"
				@click="onBackdropClick"
			>
				<!-- Main viewer area -->
				<div class="flex-1 relative flex items-center justify-center overflow-hidden">
					<!-- Close button -->
					<button
						type="button"
						class="absolute top-4 left-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
						title="Đóng (Esc)"
						@click="close"
					>
						<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>

					<!-- Counter -->
					<div
						v-if="listImagesUrls.length > 1"
						class="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-full bg-white/10 text-white text-sm"
					>
						{{ currentImageIndex + 1 }} / {{ listImagesUrls.length }}
					</div>

					<!-- Zoom controls -->
					<div
						class="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 px-2 py-1.5 rounded-full bg-white/10 backdrop-blur-sm text-white"
					>
						<button
							type="button"
							:disabled="!canZoomOut"
							class="p-1.5 rounded-full hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
							title="Thu nhỏ (-)"
							@click="zoomOut"
						>
							<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M20 12H4" />
							</svg>
						</button>
						<span class="min-w-[3.5rem] text-center text-xs font-medium tabular-nums">
							{{ Math.round(scale * 100) }}%
						</span>
						<button
							type="button"
							:disabled="!canZoomIn"
							class="p-1.5 rounded-full hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
							title="Phóng to (+)"
							@click="zoomIn"
						>
							<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
							</svg>
						</button>
						<div class="w-px h-5 bg-white/20 mx-1" />
						<button
							type="button"
							:disabled="!isZoomed"
							class="p-1.5 rounded-full hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
							title="Đặt lại (0)"
							@click="resetTransform"
						>
							<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M4 4v6h6M20 20v-6h-6M4 20l6-6M20 4l-6 6" />
							</svg>
						</button>
					</div>

					<!-- Prev / Next -->
					<button
						v-if="listImagesUrls.length > 1"
						type="button"
						:disabled="!canPrev"
						class="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
						title="Ảnh trước (←)"
						@click="goPrev"
					>
						<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
						</svg>
					</button>
					<button
						v-if="listImagesUrls.length > 1"
						type="button"
						:disabled="!canNext"
						class="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
						title="Ảnh sau (→)"
						@click="goNext"
					>
						<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
						</svg>
					</button>

					<!-- Image -->
					<div
						v-if="imageLoading"
						class="absolute inset-0 flex items-center justify-center pointer-events-none"
					>
						<div class="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
					</div>
					<img
						v-if="currentImageUrl"
						:src="currentImageUrl"
						:alt="`Ảnh ${currentImageIndex + 1}`"
						draggable="false"
						class="max-w-full max-h-full object-contain transition-transform duration-100 will-change-transform"
						:style="imageStyle"
						@load="imageLoading = false"
						@error="imageLoading = false"
						@wheel="onWheel"
						@click.stop="onImageClick"
						@dblclick.stop="onImageDoubleClick"
						@pointerdown="onDragStart"
						@pointermove="onDragMove"
						@pointerup="onDragEnd"
						@pointercancel="onDragEnd"
					/>
				</div>

				<!-- Thumbnails sidebar -->
				<div
					v-if="listImagesUrls.length > 1"
					class="w-24 sm:w-28 flex-shrink-0 overflow-y-auto p-2 space-y-2 border-l border-white/10 bg-black/40"
					@click.stop
				>
					<button
						v-for="(url, i) in listImagesUrls"
						:ref="el => { thumbRefs[i] = el as HTMLElement | null; }"
						:key="i"
						type="button"
						class="block w-full aspect-square rounded-md overflow-hidden border-2 transition-colors"
						:class="i === currentImageIndex ? 'border-brand-500' : 'border-transparent hover:border-white/40'"
						@click="selectIndex(i)"
					>
						<img
							:src="url"
							:alt="`Thumb ${i + 1}`"
							draggable="false"
							class="w-full h-full object-cover"
						/>
					</button>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>
