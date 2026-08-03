<script setup lang="ts">
	import { useEditor, EditorContent } from '@tiptap/vue-3';
	import StarterKit from '@tiptap/starter-kit';
	import Underline from '@tiptap/extension-underline';
	import Link from '@tiptap/extension-link';
	import TextAlign from '@tiptap/extension-text-align';
	import { TextStyle } from '@tiptap/extension-text-style';
	import Color from '@tiptap/extension-color';
	import Highlight from '@tiptap/extension-highlight';
	import Placeholder from '@tiptap/extension-placeholder';
	import Image from '@tiptap/extension-image';
	import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu';

	const props = withDefaults(
		defineProps<{
			modelValue: string;
			placeholder?: string;
			readonly?: boolean;
			// Callback upload ảnh — parent tự xử lý API call, trả về URL của ảnh sau upload.
			// Khi prop này có mặt, toolbar sẽ hiện nút chèn ảnh + hỗ trợ paste ảnh.
			onImageUpload?: (file: File) => Promise<string>;
		}>(),
		{ placeholder: 'Nhập nội dung...', readonly: false, onImageUpload: undefined },
	);

	const emit = defineEmits<{
		'update:modelValue': [value: string];
	}>();

	const toast = useToast();

	const showLinkPopover = ref(false);
	const linkUrl = ref('');
	const imageInputRef = ref<HTMLInputElement | null>(null);
	const isUploadingImage = ref(false);
	const imageBubbleMenuRef = ref<HTMLDivElement | null>(null);

	type ImageAlign = 'left' | 'center' | 'right';
	type ImageWidth = '25%' | '50%' | '75%' | '100%';
	const IMAGE_WIDTHS: ImageWidth[] = ['25%', '50%', '75%', '100%'];
	const IMAGE_ALIGNS: ImageAlign[] = ['left', 'center', 'right'];

	// Image extension mở rộng thêm 2 attr: `width` (HTML attr) và `align` (class `img-align-*`).
	// DOMPurify mặc định giữ nguyên cả 2 → render đúng ở view mode qua v-html.
	const CustomImage = Image.extend({
		addAttributes() {
			return {
				...this.parent?.(),
				width: {
					default: null,
					parseHTML: el => el.getAttribute('width'),
					renderHTML: attrs => (attrs.width ? { width: attrs.width } : {}),
				},
				align: {
					default: 'center',
					parseHTML: el => {
						const cls = el.getAttribute('class') ?? '';
						if (cls.includes('img-align-left')) return 'left';
						if (cls.includes('img-align-right')) return 'right';
						return 'center';
					},
					renderHTML: attrs => (attrs.align ? { class: `img-align-${attrs.align}` } : {}),
				},
			};
		},
	});

	// Limit khớp với backend: ảnh JPG/PNG/GIF/WebP, 5MB.
	const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
	const IMAGE_MAX_SIZE = 5 * 1024 * 1024;

	function validateImage(file: File): string | null {
		if (!IMAGE_MIMES.includes(file.type)) return 'Chỉ hỗ trợ ảnh JPG, PNG, GIF, WebP';
		if (file.size > IMAGE_MAX_SIZE) return 'Ảnh không được vượt quá 5MB';
		return null;
	}

	async function uploadAndInsertImage(file: File) {
		if (!props.onImageUpload || !editor.value) return;
		const err = validateImage(file);
		if (err) {
			toast.error(err);
			return;
		}
		isUploadingImage.value = true;
		try {
			const url = await props.onImageUpload(file);
			editor.value.chain().focus().setImage({ src: url, alt: file.name }).run();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Tải ảnh lên thất bại');
		} finally {
			isUploadingImage.value = false;
		}
	}

	function onImageChosen(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) uploadAndInsertImage(file);
		input.value = '';
	}

	const editor = useEditor({
		content: props.modelValue,
		editable: !props.readonly,
		extensions: [
			StarterKit.configure({
				// @ts-expect-error — key có thể không tồn tại theo version, an toàn khi disable
				underline: false,
			}),
			Underline,
			Link.configure({ openOnClick: false, autolink: true }),
			TextAlign.configure({ types: ['heading', 'paragraph'] }),
			TextStyle,
			Color,
			Highlight,
			Placeholder.configure({ placeholder: () => props.placeholder }),
			CustomImage.configure({ inline: false, HTMLAttributes: { class: 'tt-image' } }),
		],
		onUpdate: ({ editor }) => {
			emit('update:modelValue', editor.getHTML());
		},
		editorProps: {
			attributes: {
				class: 'tt-prose',
			},
			handlePaste: (_view, event) => {
				if (!props.onImageUpload) return false;
				const items = event.clipboardData?.items;
				if (!items) return false;
				for (const item of items) {
					if (item.kind === 'file' && item.type.startsWith('image/')) {
						const file = item.getAsFile();
						if (file) {
							event.preventDefault();
							uploadAndInsertImage(file);
							return true;
						}
					}
				}
				return false;
			},
		},
	});

	watch(
		() => props.modelValue,
		val => {
			if (editor.value && editor.value.getHTML() !== val) {
				editor.value.commands.setContent(val, { emitUpdate: false });
			}
		},
	);

	watch(
		() => props.readonly,
		val => {
			editor.value?.setEditable(!val);
		},
	);

	onMounted(() => {
		if (!editor.value || !imageBubbleMenuRef.value) return;
		editor.value.registerPlugin(
			BubbleMenuPlugin({
				pluginKey: 'imageBubbleMenu',
				editor: editor.value,
				element: imageBubbleMenuRef.value,
				shouldShow: ({ editor }) => editor.isActive('image'),
				options: { placement: 'top', offset: 8 },
			}),
		);
	});

	onBeforeUnmount(() => {
		// editor.destroy() tự cleanup plugin đã register.
		editor.value?.destroy();
	});

	const currentImageAttrs = computed(() => editor.value?.getAttributes('image') ?? {});

	function setImageWidth(w: ImageWidth) {
		editor.value?.chain().focus().updateAttributes('image', { width: w }).run();
	}

	function setImageAlign(a: ImageAlign) {
		editor.value?.chain().focus().updateAttributes('image', { align: a }).run();
	}

	function deleteImage() {
		editor.value?.chain().focus().deleteSelection().run();
	}

	function openLinkPopover() {
		if (!editor.value) return;
		const previousUrl = editor.value.getAttributes('link').href as string | undefined;
		linkUrl.value = previousUrl ?? '';
		showLinkPopover.value = true;
	}

	function applyLink() {
		if (!editor.value) return;
		const url = linkUrl.value.trim();
		if (!url) {
			editor.value.chain().focus().extendMarkRange('link').unsetLink().run();
		} else {
			editor.value.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
		}
		showLinkPopover.value = false;
		linkUrl.value = '';
	}

	function clearFormatting() {
		editor.value?.chain().focus().unsetAllMarks().clearNodes().run();
	}
</script>

<template>
	<div class="tiptap-editor">
		<div
			v-if="!readonly"
			class="border border-b-0 border-gray-200 dark:border-gray-700 rounded-t-lg bg-gray-50 dark:bg-gray-800/50 px-2 py-1.5 flex flex-wrap items-center gap-0.5 relative"
		>
			<!-- Text marks -->
			<button
				type="button"
				class="tt-btn"
				:class="{ 'tt-btn-active': editor?.isActive('bold') }"
				title="Đậm (Ctrl+B)"
				@click="editor?.chain().focus().toggleBold().run()"
			>
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" /><path d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" /></svg>
			</button>
			<button
				type="button"
				class="tt-btn"
				:class="{ 'tt-btn-active': editor?.isActive('italic') }"
				title="Nghiêng (Ctrl+I)"
				@click="editor?.chain().focus().toggleItalic().run()"
			>
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="4" x2="10" y2="4" /><line x1="14" y1="20" x2="5" y2="20" /><line x1="15" y1="4" x2="9" y2="20" /></svg>
			</button>
			<button
				type="button"
				class="tt-btn"
				:class="{ 'tt-btn-active': editor?.isActive('underline') }"
				title="Gạch chân (Ctrl+U)"
				@click="editor?.chain().focus().toggleUnderline().run()"
			>
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v7a6 6 0 006 6 6 6 0 006-6V3" /><line x1="4" y1="21" x2="20" y2="21" /></svg>
			</button>
			<button
				type="button"
				class="tt-btn"
				:class="{ 'tt-btn-active': editor?.isActive('strike') }"
				title="Gạch ngang"
				@click="editor?.chain().focus().toggleStrike().run()"
			>
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4H9a3 3 0 00-2.83 4" /><path d="M14 12a4 4 0 010 8H6" /><line x1="4" y1="12" x2="20" y2="12" /></svg>
			</button>

			<div class="tt-divider" />

			<!-- Headings -->
			<button
				type="button"
				class="tt-btn tt-btn-text"
				:class="{ 'tt-btn-active': editor?.isActive('heading', { level: 1 }) }"
				title="Tiêu đề 1"
				@click="editor?.chain().focus().toggleHeading({ level: 1 }).run()"
			>
				H1
			</button>
			<button
				type="button"
				class="tt-btn tt-btn-text"
				:class="{ 'tt-btn-active': editor?.isActive('heading', { level: 2 }) }"
				title="Tiêu đề 2"
				@click="editor?.chain().focus().toggleHeading({ level: 2 }).run()"
			>
				H2
			</button>
			<button
				type="button"
				class="tt-btn tt-btn-text"
				:class="{ 'tt-btn-active': editor?.isActive('heading', { level: 3 }) }"
				title="Tiêu đề 3"
				@click="editor?.chain().focus().toggleHeading({ level: 3 }).run()"
			>
				H3
			</button>
			<button
				type="button"
				class="tt-btn tt-btn-text"
				:class="{ 'tt-btn-active': editor?.isActive('paragraph') }"
				title="Đoạn văn"
				@click="editor?.chain().focus().setParagraph().run()"
			>
				¶
			</button>

			<div class="tt-divider" />

			<!-- Alignment -->
			<button
				type="button"
				class="tt-btn"
				:class="{ 'tt-btn-active': editor?.isActive({ textAlign: 'left' }) }"
				title="Căn trái"
				@click="editor?.chain().focus().setTextAlign('left').run()"
			>
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="14" y2="12" /><line x1="4" y1="18" x2="18" y2="18" /></svg>
			</button>
			<button
				type="button"
				class="tt-btn"
				:class="{ 'tt-btn-active': editor?.isActive({ textAlign: 'center' }) }"
				title="Căn giữa"
				@click="editor?.chain().focus().setTextAlign('center').run()"
			>
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="5" y1="18" x2="19" y2="18" /></svg>
			</button>
			<button
				type="button"
				class="tt-btn"
				:class="{ 'tt-btn-active': editor?.isActive({ textAlign: 'right' }) }"
				title="Căn phải"
				@click="editor?.chain().focus().setTextAlign('right').run()"
			>
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6" /><line x1="10" y1="12" x2="20" y2="12" /><line x1="6" y1="18" x2="20" y2="18" /></svg>
			</button>

			<div class="tt-divider" />

			<!-- Lists -->
			<button
				type="button"
				class="tt-btn"
				:class="{ 'tt-btn-active': editor?.isActive('bulletList') }"
				title="Danh sách chấm"
				@click="editor?.chain().focus().toggleBulletList().run()"
			>
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="9" y1="6" x2="20" y2="6" /><line x1="9" y1="12" x2="20" y2="12" /><line x1="9" y1="18" x2="20" y2="18" /><circle cx="4.5" cy="6" r="1" fill="currentColor" /><circle cx="4.5" cy="12" r="1" fill="currentColor" /><circle cx="4.5" cy="18" r="1" fill="currentColor" /></svg>
			</button>
			<button
				type="button"
				class="tt-btn"
				:class="{ 'tt-btn-active': editor?.isActive('orderedList') }"
				title="Danh sách số"
				@click="editor?.chain().focus().toggleOrderedList().run()"
			>
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="6" x2="20" y2="6" /><line x1="10" y1="12" x2="20" y2="12" /><line x1="10" y1="18" x2="20" y2="18" /><path d="M4 6h1V3" stroke-width="1.5" /><path d="M4 14v-1h2v-1a1 1 0 00-2 0" stroke-width="1.5" /><path d="M4 18h2m-2 3h2a1 1 0 000-2H4" stroke-width="1.5" /></svg>
			</button>
			<button
				type="button"
				class="tt-btn"
				:class="{ 'tt-btn-active': editor?.isActive('blockquote') }"
				title="Trích dẫn"
				@click="editor?.chain().focus().toggleBlockquote().run()"
			>
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.7-2-2-2H4c-1.3 0-2 .75-2 2v6c0 1.25.7 2 2 2h3M15 21c3 0 7-1 7-8V5c0-1.25-.75-2-2-2h-4c-1.3 0-2 .75-2 2v6c0 1.25.7 2 2 2h3" /></svg>
			</button>

			<div class="tt-divider" />

			<!-- Link + Image + clear -->
			<button
				type="button"
				class="tt-btn"
				:class="{ 'tt-btn-active': editor?.isActive('link') }"
				title="Chèn liên kết"
				@click="openLinkPopover"
			>
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></svg>
			</button>
			<template v-if="onImageUpload">
				<input
					ref="imageInputRef"
					type="file"
					accept="image/jpeg,image/png,image/gif,image/webp"
					class="hidden"
					@change="onImageChosen"
				/>
				<button
					type="button"
					class="tt-btn"
					:disabled="isUploadingImage"
					:title="isUploadingImage ? 'Đang tải ảnh...' : 'Chèn ảnh (tối đa 5MB)'"
					@click="imageInputRef?.click()"
				>
					<svg
						v-if="isUploadingImage"
						class="w-4 h-4 animate-spin"
						viewBox="0 0 24 24"
						fill="none"
					>
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" />
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
					</svg>
					<svg
						v-else
						class="w-4 h-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<rect x="3" y="3" width="18" height="18" rx="2" />
						<circle cx="8.5" cy="8.5" r="1.5" />
						<path d="M21 15l-5-5L5 21" />
					</svg>
				</button>
			</template>
			<button
				type="button"
				class="tt-btn"
				title="Xoá định dạng"
				@click="clearFormatting"
			>
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h16v3" /><line x1="5" y1="20" x2="11" y2="20" /><line x1="10" y1="4" x2="15" y2="20" /><line x1="15" y1="15" x2="21" y2="21" /><line x1="21" y1="15" x2="15" y2="21" /></svg>
			</button>

			<!-- Link popover -->
			<div
				v-if="showLinkPopover"
				class="absolute top-full left-0 mt-1 z-10 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 flex items-center gap-1"
			>
				<input
					v-model="linkUrl"
					type="url"
					placeholder="https://..."
					class="w-64 px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
					@keyup.enter="applyLink"
				/>
				<button
					type="button"
					class="px-2 py-1 text-xs rounded bg-brand-600 text-white hover:bg-brand-700"
					@click="applyLink"
				>
					OK
				</button>
				<button
					type="button"
					class="px-2 py-1 text-xs rounded text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
					@click="showLinkPopover = false"
				>
					Huỷ
				</button>
			</div>
		</div>

		<EditorContent
			:editor="editor"
			class="tiptap-content"
			:class="readonly ? 'tiptap-content-readonly' : ''"
		/>

		<!-- Bubble menu — chỉ hiện khi image node được chọn (BubbleMenuPlugin toggle visibility) -->
		<div ref="imageBubbleMenuRef" class="tt-image-bubble">
			<div class="tt-bubble-group">
				<button
					v-for="w in IMAGE_WIDTHS"
					:key="w"
					type="button"
					class="tt-btn tt-btn-text"
					:class="{ 'tt-btn-active': currentImageAttrs.width === w }"
					:title="`Kích thước ${w}`"
					@click="setImageWidth(w)"
				>
					{{ w }}
				</button>
			</div>
			<div class="tt-divider" />
			<div class="tt-bubble-group">
				<button
					v-for="a in IMAGE_ALIGNS"
					:key="a"
					type="button"
					class="tt-btn"
					:class="{ 'tt-btn-active': (currentImageAttrs.align ?? 'center') === a }"
					:title="a === 'left' ? 'Căn trái' : a === 'center' ? 'Căn giữa' : 'Căn phải'"
					@click="setImageAlign(a)"
				>
					<svg
						v-if="a === 'left'"
						class="w-4 h-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<line x1="4" y1="6" x2="20" y2="6" />
						<line x1="4" y1="12" x2="14" y2="12" />
						<line x1="4" y1="18" x2="18" y2="18" />
					</svg>
					<svg
						v-else-if="a === 'center'"
						class="w-4 h-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<line x1="4" y1="6" x2="20" y2="6" />
						<line x1="7" y1="12" x2="17" y2="12" />
						<line x1="5" y1="18" x2="19" y2="18" />
					</svg>
					<svg
						v-else
						class="w-4 h-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<line x1="4" y1="6" x2="20" y2="6" />
						<line x1="10" y1="12" x2="20" y2="12" />
						<line x1="6" y1="18" x2="20" y2="18" />
					</svg>
				</button>
			</div>
			<div class="tt-divider" />
			<button
				type="button"
				class="tt-btn tt-btn-danger"
				title="Xoá ảnh"
				@click="deleteImage"
			>
				<svg
					class="w-4 h-4"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M3 6h18" />
					<path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
					<path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
				</svg>
			</button>
		</div>
	</div>
</template>

<style scoped>
	.tt-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		padding: 0;
		font-size: 0.75rem;
		line-height: 1;
		border-radius: 0.375rem;
		color: #4b5563;
		background-color: transparent;
		border: 1px solid transparent;
		transition: background-color 0.15s, color 0.15s;
		cursor: pointer;
	}
	.tt-btn:hover {
		background-color: #e5e7eb;
		color: #111827;
	}
	.tt-btn-text {
		width: auto;
		min-width: 30px;
		padding: 0 0.5rem;
		font-weight: 600;
		font-size: 0.75rem;
	}
	.tt-btn-active {
		background-color: #1e40af;
		color: #ffffff;
	}
	.tt-btn-active:hover {
		background-color: #1e3a8a;
		color: #ffffff;
	}
	.tt-divider {
		width: 1px;
		height: 20px;
		background-color: #d1d5db;
		margin: 0 4px;
	}
	:global(.dark) .tt-btn {
		color: #d1d5db;
	}
	:global(.dark) .tt-btn:hover {
		background-color: #374151;
		color: #f9fafb;
	}
	:global(.dark) .tt-divider {
		background-color: #4b5563;
	}

	.tiptap-content :deep(.ProseMirror) {
		min-height: 200px;
		padding: 12px;
		outline: none;
		border: 1px solid #e2e8f0;
		border-radius: 0 0 6px 6px;
		background-color: #ffffff;
	}
	:global(.dark) .tiptap-content :deep(.ProseMirror) {
		background-color: #1f2937;
		border-color: #374151;
		color: #f3f4f6;
	}
	.tiptap-content-readonly :deep(.ProseMirror) {
		border-radius: 6px;
	}
	.tiptap-content :deep(h1) {
		font-size: 1.5rem;
		font-weight: 700;
		margin: 0.75rem 0 0.5rem;
	}
	.tiptap-content :deep(h2) {
		font-size: 1.25rem;
		font-weight: 600;
		margin: 0.625rem 0 0.5rem;
	}
	.tiptap-content :deep(h3) {
		font-size: 1.125rem;
		font-weight: 600;
		margin: 0.5rem 0 0.375rem;
	}
	.tiptap-content :deep(p) {
		margin: 0.375rem 0;
		line-height: 1.6;
	}
	.tiptap-content :deep(ul) {
		list-style: disc;
		padding-left: 1.5rem;
		margin: 0.5rem 0;
	}
	.tiptap-content :deep(ol) {
		list-style: decimal;
		padding-left: 1.5rem;
		margin: 0.5rem 0;
	}
	.tiptap-content :deep(blockquote) {
		border-left: 3px solid #e2e8f0;
		padding-left: 1rem;
		color: #64748b;
		margin: 0.5rem 0;
	}
	.tiptap-content :deep(a) {
		color: #1e40af;
		text-decoration: underline;
	}
	.tiptap-content :deep(img.tt-image),
	.tiptap-content :deep(img) {
		max-width: 100%;
		height: auto;
		border-radius: 0.5rem;
		margin: 0.5rem 0;
		display: block;
	}
	.tiptap-content :deep(img.img-align-left) {
		margin-left: 0;
		margin-right: auto;
	}
	.tiptap-content :deep(img.img-align-center) {
		margin-left: auto;
		margin-right: auto;
	}
	.tiptap-content :deep(img.img-align-right) {
		margin-left: auto;
		margin-right: 0;
	}
	/* Highlight image node được chọn — báo hiệu bubble menu đang apply cho ảnh này */
	.tiptap-content :deep(img.ProseMirror-selectednode) {
		outline: 2px solid #1e40af;
		outline-offset: 2px;
	}
	.tt-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.tt-btn-danger {
		color: #dc2626;
	}
	.tt-btn-danger:hover {
		background-color: #fee2e2;
		color: #b91c1c;
	}
	:global(.dark) .tt-btn-danger:hover {
		background-color: rgba(153, 27, 27, 0.3);
	}

	/* Bubble menu — plugin tự toggle visibility, ta chỉ style container */
	.tt-image-bubble {
		display: flex;
		align-items: center;
		gap: 0;
		padding: 4px;
		background-color: #ffffff;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
		z-index: 50;
	}
	.tt-bubble-group {
		display: flex;
		align-items: center;
		gap: 2px;
	}
	:global(.dark) .tt-image-bubble {
		background-color: #1f2937;
		border-color: #374151;
	}
	.tiptap-content :deep(.ProseMirror p.is-editor-empty:first-child::before) {
		content: attr(data-placeholder);
		float: left;
		color: #94a3b8;
		pointer-events: none;
		height: 0;
	}
</style>
