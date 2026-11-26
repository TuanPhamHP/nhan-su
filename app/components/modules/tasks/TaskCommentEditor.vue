<script setup lang="ts">
	import { useEditor, EditorContent } from '@tiptap/vue-3';
	import StarterKit from '@tiptap/starter-kit';
	import Link from '@tiptap/extension-link';
	import Placeholder from '@tiptap/extension-placeholder';
	import Mention from '@tiptap/extension-mention';
	import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
	import { useTasksService } from '~/services/tasks.service';
	import type { MentionCandidate } from '~/types/tasks.types';
	import { mentionIdsFromHtml } from '~/utils/tasks.utils';

	/**
	 * Ô soạn bình luận: đậm, nghiêng, danh sách, đường dẫn, gõ @ để nhắc tên (mục 9.2).
	 *
	 * Gợi ý nhắc tên lấy từ `GET /tasks/:id/mentionable`: máy chủ tìm không dấu, tối đa 8 người, xếp
	 * người dính vào việc trước, và trả `canView` để ở đây cảnh báo người không xem được việc. Ctrl+Enter
	 * gửi. Dán hay kéo file vào ô thì báo ra ngoài (`files`) để khung bình luận tải lên đính kèm.
	 */
	const props = withDefaults(
		defineProps<{
			taskId: number;
			modelValue: string;
			placeholder?: string;
			disabled?: boolean;
			autofocus?: boolean;
		}>(),
		{ placeholder: 'Viết trao đổi, gõ @ để nhắc tên người', disabled: false, autofocus: false },
	);

	const emit = defineEmits<{
		'update:modelValue': [value: string];
		submit: [];
		files: [files: File[]];
		/** Người vừa được nhắc, để khung bình luận nhớ `canView`. */
		mentioned: [candidate: MentionCandidate];
	}>();

	const service = useTasksService();

	// ─── Hộp gợi ý nhắc tên ─────────────────────────────────────────────────
	const suggest = reactive({
		open: false,
		items: [] as MentionCandidate[],
		index: 0,
		loading: false,
		left: 0,
		top: 0,
		command: null as ((attrs: { id: string; label: string }) => void) | null,
	});

	function placeSuggest(rect: DOMRect | null | undefined) {
		if (!rect) return;
		const width = 288;
		suggest.left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
		// Ô soạn dính đáy khung, nên hộp gợi ý mở LÊN trên dòng đang gõ.
		suggest.top = rect.top;
	}

	function choose(i: number) {
		const item = suggest.items[i];
		if (!item || !suggest.command) return;
		emit('mentioned', item);
		suggest.command({ id: String(item.id), label: item.fullName });
	}

	let lastQuery = '';
	const editor = useEditor({
		content: props.modelValue,
		editable: !props.disabled,
		autofocus: props.autofocus ? 'end' : false,
		extensions: [
			StarterKit.configure({ heading: false, codeBlock: false, horizontalRule: false, blockquote: false }),
			Link.configure({ openOnClick: false, autolink: true }),
			Placeholder.configure({ placeholder: () => props.placeholder }),
			Mention.configure({
				HTMLAttributes: { class: 'task-mention' },
				renderText: ({ node }) => `@${node.attrs.label ?? node.attrs.id}`,
				renderHTML: ({ node, options }) => [
					'span',
					options.HTMLAttributes,
					`@${node.attrs.label ?? node.attrs.id}`,
				],
				suggestion: {
					char: '@',
					items: async ({ query }: { query: string }) => {
						lastQuery = query;
						suggest.loading = true;
						try {
							const list = await service.mentionable(props.taskId, query || undefined);
							// Gõ tiếp trong lúc chờ thì bỏ kết quả cũ.
							return query === lastQuery ? list.slice(0, 8) : [];
						} catch {
							return [];
						} finally {
							suggest.loading = false;
						}
					},
					render: () => ({
						onStart: (p: SuggestionProps<MentionCandidate>) => {
							suggest.open = true;
							suggest.items = p.items;
							suggest.index = 0;
							suggest.command = p.command as unknown as typeof suggest.command;
							placeSuggest(p.clientRect?.());
						},
						onUpdate: (p: SuggestionProps<MentionCandidate>) => {
							suggest.items = p.items;
							suggest.index = 0;
							suggest.command = p.command as unknown as typeof suggest.command;
							placeSuggest(p.clientRect?.());
						},
						onKeyDown: ({ event }: SuggestionKeyDownProps) => {
							if (!suggest.open) return false;
							if (event.key === 'ArrowDown') {
								suggest.index = (suggest.index + 1) % Math.max(1, suggest.items.length);
								return true;
							}
							if (event.key === 'ArrowUp') {
								suggest.index = (suggest.index - 1 + suggest.items.length) % Math.max(1, suggest.items.length);
								return true;
							}
							if (event.key === 'Enter' || event.key === 'Tab') {
								if (!suggest.items.length) return false;
								choose(suggest.index);
								return true;
							}
							if (event.key === 'Escape') {
								suggest.open = false;
								return true;
							}
							return false;
						},
						onExit: () => {
							suggest.open = false;
							suggest.items = [];
							suggest.command = null;
						},
					}),
				},
			}),
		],
		onUpdate: ({ editor: ed }) => emit('update:modelValue', ed.getHTML()),
		editorProps: {
			attributes: {
				class:
					'tt-prose min-h-[4.5rem] max-h-60 overflow-y-auto px-3 py-2 text-sm focus:outline-none [&_.task-mention]:rounded [&_.task-mention]:bg-brand-50 [&_.task-mention]:px-0.5 [&_.task-mention]:font-medium [&_.task-mention]:text-brand-700 dark:[&_.task-mention]:bg-brand-900/30 dark:[&_.task-mention]:text-brand-300',
				'aria-label': 'Nội dung bình luận',
				role: 'textbox',
				'aria-multiline': 'true',
			},
			handleKeyDown: (_view, event) => {
				if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
					if (suggest.open) return false;
					event.preventDefault();
					emit('submit');
					return true;
				}
				return false;
			},
			handlePaste: (_view, event) => {
				const files = Array.from(event.clipboardData?.files ?? []);
				if (!files.length) return false;
				event.preventDefault();
				emit('files', files);
				return true;
			},
			handleDrop: (_view, event) => {
				const files = Array.from((event as DragEvent).dataTransfer?.files ?? []);
				if (!files.length) return false;
				event.preventDefault();
				emit('files', files);
				return true;
			},
		},
	});

	watch(
		() => props.modelValue,
		v => {
			const ed = editor.value;
			if (ed && v !== ed.getHTML()) ed.commands.setContent(v || '', { emitUpdate: false });
		},
	);
	watch(
		() => props.disabled,
		v => editor.value?.setEditable(!v),
	);

	// `autofocus` của Tiptap chạy lúc tạo editor, trước khi ô được gắn vào trang, nên ô sửa bình luận
	// không nhận con trỏ. Đặt con trỏ sau khi gắn.
	onMounted(() => {
		if (props.autofocus) setTimeout(() => editor.value?.commands.focus('end'), 50);
	});

	onBeforeUnmount(() => editor.value?.destroy());

	function focus() {
		editor.value?.commands.focus('end');
	}

	function toggle(mark: 'bold' | 'italic' | 'bulletList') {
		const chain = editor.value?.chain().focus();
		if (!chain) return;
		if (mark === 'bold') chain.toggleBold().run();
		else if (mark === 'italic') chain.toggleItalic().run();
		else chain.toggleBulletList().run();
	}

	function addLink() {
		const ed = editor.value;
		if (!ed) return;
		const url = window.prompt('Dán đường dẫn');
		if (!url) return;
		const safe = /^https?:\/\//i.test(url) ? url : `https://${url}`;
		ed.chain().focus().extendMarkRange('link').setLink({ href: safe }).run();
	}

	function currentMentionIds(): number[] {
		return mentionIdsFromHtml(editor.value?.getHTML() ?? props.modelValue);
	}

	defineExpose({ focus, currentMentionIds });
</script>

<template>
	<div class="relative">
		<div class="flex items-center gap-0.5 border-b border-gray-100 px-1.5 py-1 dark:border-gray-800">
			<button type="button" class="rounded p-1.5 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:hover:bg-gray-800" aria-label="In đậm" @click="toggle('bold')">
				<Icon name="heroicons:bold" class="h-4 w-4" />
			</button>
			<button type="button" class="rounded p-1.5 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:hover:bg-gray-800" aria-label="In nghiêng" @click="toggle('italic')">
				<Icon name="heroicons:italic" class="h-4 w-4" />
			</button>
			<button type="button" class="rounded p-1.5 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:hover:bg-gray-800" aria-label="Danh sách gạch đầu dòng" @click="toggle('bulletList')">
				<Icon name="heroicons:list-bullet" class="h-4 w-4" />
			</button>
			<button type="button" class="rounded p-1.5 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:hover:bg-gray-800" aria-label="Chèn đường dẫn" @click="addLink">
				<Icon name="heroicons:link" class="h-4 w-4" />
			</button>
			<slot name="toolbar" />
		</div>
		<EditorContent :editor="editor" class="text-gray-900 dark:text-gray-100" />

		<Teleport to="body">
			<div
				v-if="suggest.open"
				role="listbox"
				aria-label="Gợi ý người để nhắc tên"
				data-testid="mention-suggest"
				class="fixed z-[80] w-72 -translate-y-full overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl dark:border-gray-700 dark:bg-gray-900"
				:style="{ left: `${suggest.left}px`, top: `${suggest.top - 6}px` }"
			>
				<p v-if="suggest.loading && !suggest.items.length" class="px-3 py-2 text-xs text-gray-500">Đang tìm…</p>
				<p v-else-if="!suggest.items.length" class="px-3 py-2 text-xs text-gray-500">Không tìm thấy ai</p>
				<button
					v-for="(c, i) in suggest.items"
					:key="c.id"
					type="button"
					role="option"
					:aria-selected="i === suggest.index"
					class="flex w-full items-center gap-2 px-3 py-1.5 text-left"
					:class="i === suggest.index ? 'bg-brand-50 dark:bg-brand-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800'"
					@mousedown.prevent="choose(i)"
				>
					<CommonAppAvatar :src="c.avatarUrl" :name="c.fullName" size="sm" />
					<span class="min-w-0 flex-1">
						<span class="block truncate text-sm font-medium text-gray-900 dark:text-gray-100">{{ c.fullName }}</span>
						<span class="block truncate text-xs text-gray-500 dark:text-gray-400">
							{{ c.departmentName ?? 'Chưa có phòng' }}<template v-if="!c.canView"> · không xem được việc này</template>
						</span>
					</span>
				</button>
			</div>
		</Teleport>
	</div>
</template>
