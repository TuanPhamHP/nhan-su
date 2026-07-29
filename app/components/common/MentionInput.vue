<script setup lang="ts">
	interface EmployeeOption {
		id: number;
		fullName: string;
		avatarUrl: string | null;
	}

	const props = withDefaults(
		defineProps<{
			modelValue: string;
			placeholder?: string;
			employees: EmployeeOption[];
		}>(),
		{ placeholder: '' },
	);

	const emit = defineEmits<{
		'update:modelValue': [value: string];
		submit: [value: string];
	}>();

	const inputEl = ref<HTMLDivElement | null>(null);
	const showSuggestions = ref(false);
	const suggestionQuery = ref('');
	const activeIndex = ref(0);
	// Vị trí ký tự '@' đang được gõ trong text node hiện tại — dùng để replace khi chọn mention
	const mentionAnchor = ref<{ node: Text; offset: number } | null>(null);

	const suggestions = computed(() => {
		const q = suggestionQuery.value.trim().toLowerCase();
		const base = props.employees;
		const filtered = q ? base.filter(e => e.fullName.toLowerCase().includes(q)) : base;
		return filtered.slice(0, 6);
	});

	function readRawContent(): string {
		if (!inputEl.value) return '';
		let out = '';
		const walk = (node: Node) => {
			if (node.nodeType === Node.TEXT_NODE) {
				out += node.textContent ?? '';
				return;
			}
			if (node.nodeType !== Node.ELEMENT_NODE) return;
			const el = node as HTMLElement;
			if (el.tagName === 'BR') {
				out += '\n';
				return;
			}
			if (el.classList.contains('mention-inline-badge')) {
				const id = el.dataset.mentionId;
				const name = el.dataset.mentionName;
				if (id && name) out += `@[${name}](${id})`;
				return;
			}
			if (el.tagName === 'DIV' || el.tagName === 'P') {
				if (out.length > 0 && !out.endsWith('\n')) out += '\n';
			}
			el.childNodes.forEach(walk);
		};
		inputEl.value.childNodes.forEach(walk);
		return out;
	}

	function emitContent() {
		emit('update:modelValue', readRawContent());
	}

	function clearMentionState() {
		showSuggestions.value = false;
		suggestionQuery.value = '';
		mentionAnchor.value = null;
		activeIndex.value = 0;
	}

	function detectMentionContext() {
		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0) {
			clearMentionState();
			return;
		}
		const range = selection.getRangeAt(0);
		const node = range.startContainer;
		if (node.nodeType !== Node.TEXT_NODE) {
			clearMentionState();
			return;
		}
		const text = node.textContent ?? '';
		const cursor = range.startOffset;
		// Tìm '@' gần nhất trước cursor, chỉ trong đoạn text hiện tại và không có whitespace ở giữa
		const before = text.slice(0, cursor);
		const atIdx = before.lastIndexOf('@');
		if (atIdx === -1) {
			clearMentionState();
			return;
		}
		const query = before.slice(atIdx + 1);
		if (/[\s\n]/.test(query)) {
			clearMentionState();
			return;
		}
		mentionAnchor.value = { node: node as Text, offset: atIdx };
		suggestionQuery.value = query;
		showSuggestions.value = true;
		activeIndex.value = 0;
	}

	function onInput() {
		detectMentionContext();
		emitContent();
	}

	function selectMention(emp: EmployeeOption) {
		const anchor = mentionAnchor.value;
		if (!anchor || !inputEl.value) return;

		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0) return;
		const range = selection.getRangeAt(0);

		const cursorOffset = range.startOffset;
		const textNode = anchor.node;

		// Split text node quanh khoảng '@query' để chèn badge vào giữa
		const beforeText = (textNode.textContent ?? '').slice(0, anchor.offset);
		const afterText = (textNode.textContent ?? '').slice(cursorOffset);

		const parent = textNode.parentNode;
		if (!parent) return;

		const beforeNode = document.createTextNode(beforeText);
		const badge = document.createElement('span');
		badge.className = 'mention-inline-badge';
		badge.contentEditable = 'false';
		badge.dataset.mentionId = String(emp.id);
		badge.dataset.mentionName = emp.fullName;
		badge.textContent = `@${emp.fullName}`;

		// Thêm một space sau badge để cursor không bị dính vào badge
		const spaceNode = document.createTextNode(' ' + afterText);

		parent.insertBefore(beforeNode, textNode);
		parent.insertBefore(badge, textNode);
		parent.insertBefore(spaceNode, textNode);
		parent.removeChild(textNode);

		// Đặt cursor sau space
		const newRange = document.createRange();
		newRange.setStart(spaceNode, 1);
		newRange.collapse(true);
		selection.removeAllRanges();
		selection.addRange(newRange);

		clearMentionState();
		emitContent();
		nextTick(() => inputEl.value?.focus());
	}

	function onKeydown(e: KeyboardEvent) {
		if (showSuggestions.value && suggestions.value.length > 0) {
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				activeIndex.value = (activeIndex.value + 1) % suggestions.value.length;
				return;
			}
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				activeIndex.value = (activeIndex.value - 1 + suggestions.value.length) % suggestions.value.length;
				return;
			}
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				const chosen = suggestions.value[activeIndex.value];
				if (chosen) selectMention(chosen);
				return;
			}
			if (e.key === 'Escape') {
				e.preventDefault();
				clearMentionState();
				return;
			}
		}

		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			emit('submit', readRawContent());
			return;
		}
	}

	function onPaste(e: ClipboardEvent) {
		e.preventDefault();
		const text = e.clipboardData?.getData('text/plain') ?? '';
		if (!text) return;
		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0) return;
		const range = selection.getRangeAt(0);
		range.deleteContents();
		const node = document.createTextNode(text);
		range.insertNode(node);
		range.setStartAfter(node);
		range.collapse(true);
		selection.removeAllRanges();
		selection.addRange(range);
		emitContent();
	}

	function reset() {
		if (inputEl.value) inputEl.value.innerHTML = '';
		clearMentionState();
	}

	defineExpose({ reset, focus: () => inputEl.value?.focus() });

	// Nếu parent reset modelValue về '' thì xóa nội dung DOM
	watch(
		() => props.modelValue,
		val => {
			if (val === '' && inputEl.value && inputEl.value.innerHTML !== '') {
				inputEl.value.innerHTML = '';
			}
		},
	);
</script>

<template>
	<div class="mention-input-wrapper relative">
		<div
			ref="inputEl"
			contenteditable="true"
			:data-placeholder="placeholder"
			:class="[
				'mention-input min-h-[40px] max-h-[120px] overflow-y-auto px-3 py-2 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300',
				$slots.trailing ? 'pr-28' : '',
			]"
			@input="onInput"
			@keydown="onKeydown"
			@paste="onPaste"
		/>

		<div v-if="$slots.trailing" class="absolute bottom-1.5 right-1.5 z-10">
			<slot name="trailing" />
		</div>

		<Transition name="fade">
			<div
				v-if="showSuggestions && suggestions.length"
				class="absolute bottom-full mb-1 left-0 right-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto"
			>
				<button
					v-for="(emp, i) in suggestions"
					:key="emp.id"
					type="button"
					:class="[
						'w-full flex items-center gap-2 px-3 py-2 text-left text-sm',
						activeIndex === i
							? 'bg-blue-50 dark:bg-blue-900/20'
							: 'hover:bg-gray-50 dark:hover:bg-gray-800',
					]"
					@mousedown.prevent="selectMention(emp)"
					@mouseenter="activeIndex = i"
				>
					<div
						class="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-300 overflow-hidden"
					>
						<img v-if="emp.avatarUrl" :src="emp.avatarUrl" class="w-full h-full object-cover" />
						<span v-else>{{ emp.fullName.charAt(0).toUpperCase() }}</span>
					</div>
					<span class="font-medium text-gray-800 dark:text-gray-100 truncate">{{ emp.fullName }}</span>
				</button>
			</div>
		</Transition>
	</div>
</template>

<style scoped>
	.mention-input:empty::before {
		content: attr(data-placeholder);
		color: #9ca3af;
		pointer-events: none;
	}
	.mention-input :deep(.mention-inline-badge) {
		display: inline-block;
		background: #dbeafe;
		color: #1d4ed8;
		border-radius: 4px;
		padding: 0 4px;
		font-weight: 500;
		white-space: nowrap;
		user-select: none;
	}
	.fade-enter-active,
	.fade-leave-active {
		transition: opacity 0.12s ease;
	}
	.fade-enter-from,
	.fade-leave-to {
		opacity: 0;
	}
</style>
