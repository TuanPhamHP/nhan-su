<script setup lang="ts">
	/**
	 * Tiêu đề trang, kèm một dấu hỏi nhỏ mở ra câu giải thích.
	 *
	 * Vì sao không in thẳng câu mô tả dưới tiêu đề như trước: người dùng hằng ngày đã thuộc trang,
	 * đoạn mô tả chỉ chiếm chỗ và đẩy nội dung thật xuống dưới, nhất là trên điện thoại. Câu giải
	 * thích vẫn còn nguyên cho người mới, chỉ là nằm sau một cú rê chuột hoặc một cú chạm.
	 *
	 * Không dùng lại `ui/Tooltip.vue`: hộp của nó chỉ mở khi rê chuột (điện thoại không có chuột)
	 * và `white-space: nowrap` nên câu dài hai dòng sẽ tràn ngang màn hình. Phần nhìn thì giữ đúng
	 * kiểu của nó để cả web vẫn một giọng.
	 *
	 * Dùng:
	 * ```vue
	 * <UiPageHeader title="Văn phòng phẩm của phòng" description="Cả phòng cùng nhập một phiếu…">
	 *   <CommonAppButton variant="primary">Thêm</CommonAppButton>
	 * </UiPageHeader>
	 * ```
	 */
	const props = defineProps<{
		title: string;
		/** Câu giải thích; bỏ trống thì không có dấu hỏi nào cả. */
		description?: string;
	}>();

	const open = ref(false);
	const boxRef = ref<HTMLElement | null>(null);

	/**
	 * Loại thiết bị vừa bấm, để chuột và ngón tay đi hai đường khác nhau.
	 *
	 * Trên điện thoại một cú chạm sinh ra cả chuỗi `pointerdown → pointerup → mouseenter → click →
	 * mouseleave` trong vài milli giây. Nếu rê chuột cũng mở và rời chuột cũng đóng thì hộp vừa mở
	 * đã đóng ngay trong cùng cú chạm, đúng như ba người dùng UAT gặp. Vậy nên hover chỉ dành cho
	 * chuột thật, còn ngón tay thì bật tắt bằng cú bấm.
	 */
	const lastPointerType = ref('');

	function onPointerDown(event: PointerEvent) {
		lastPointerType.value = event.pointerType;
	}

	/** Rê chuột thì mở, nhưng chỉ khi đó là chuột thật. */
	function onPointerEnter(event: PointerEvent) {
		if (event.pointerType === 'mouse') open.value = true;
	}

	/** Rời chuột thì đóng; chuỗi sự kiện giả lập của cú chạm không được đóng hộp. */
	function onPointerLeave(event: PointerEvent) {
		if (event.pointerType === 'mouse') open.value = false;
	}

	/**
	 * Chạm hoặc bấm Enter thì bật tắt; bấm chuột thì giữ hộp đang mở sẵn do rê chuột.
	 *
	 * Bàn phím cũng vào đây vì nút sinh `click` khi bấm Enter hoặc dấu cách, và lúc đó không có
	 * `pointerdown` nào nên `lastPointerType` không phải là chuột.
	 */
	function onClick() {
		if (lastPointerType.value === 'mouse') {
			open.value = true;
			return;
		}
		open.value = !open.value;
	}

	/** Chạm ra ngoài thì đóng: trên điện thoại không có "rê chuột ra chỗ khác". */
	function onDocumentPointerDown(event: Event) {
		if (boxRef.value && !boxRef.value.contains(event.target as Node)) open.value = false;
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') open.value = false;
	}

	onMounted(() => {
		document.addEventListener('pointerdown', onDocumentPointerDown);
		document.addEventListener('keydown', onKeydown);
	});

	onUnmounted(() => {
		document.removeEventListener('pointerdown', onDocumentPointerDown);
		document.removeEventListener('keydown', onKeydown);
	});

	const hasDescription = computed(() => !!props.description?.trim());
</script>

<template>
	<div class="flex flex-wrap items-start justify-between gap-3">
		<div ref="boxRef" class="relative flex items-center gap-1.5">
			<h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ title }}</h1>

			<button
				v-if="hasDescription"
				type="button"
				class="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
				:aria-label="`Trang này dùng để làm gì: ${title}`"
				:aria-expanded="open"
				@pointerdown="onPointerDown"
				@pointerenter="onPointerEnter"
				@pointerleave="onPointerLeave"
				@click="onClick"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
					/>
				</svg>
			</button>

			<!--
				Hộp giải thích nằm DƯỚI tiêu đề và ở lớp trên cùng, nhưng không chặn chuột: người dùng
				vẫn bấm được nút ngay dưới nó khi hộp đang mở.
			-->
			<Transition
				enter-active-class="transition ease-out duration-100"
				enter-from-class="opacity-0 -translate-y-1"
				enter-to-class="opacity-100 translate-y-0"
				leave-active-class="transition ease-in duration-75"
				leave-from-class="opacity-100"
				leave-to-class="opacity-0"
			>
				<p
					v-if="open && hasDescription"
					role="tooltip"
					class="absolute top-full left-0 z-50 mt-2 max-w-sm rounded-lg bg-gray-800 px-3 py-2 text-sm leading-relaxed font-medium text-white shadow-lg"
				>
					{{ description }}
				</p>
			</Transition>
		</div>

		<div v-if="$slots.default" class="flex flex-wrap items-center gap-2"><slot /></div>
	</div>
</template>
