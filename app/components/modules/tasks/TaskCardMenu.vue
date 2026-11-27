<script setup lang="ts">
	import type { TaskDetail, TaskListItem, TaskStatus } from '~/types/tasks.types';
	import { BOARD_STATUSES, STATUS_LABELS, primaryActions } from '~/utils/tasks.utils';

	/**
	 * Menu ba chấm của một việc, cũng mở bằng chuột phải. Đây là cách làm thay cho kéo thả
	 * (WCAG 2.5.7): mọi chuyển cột, đổi thứ tự, đổi hạn đều có ở đây.
	 *
	 * Cột không chuyển tới được vẫn hiện, mờ, kèm câu lý do máy chủ trả trong `columnRules`, để người
	 * dùng biết vì sao và phải nhờ ai (T-04: người thực hiện thấy vì sao không có Nghiệm thu).
	 */
	const props = defineProps<{
		task: TaskListItem;
		/** Bảng việc cho đổi thứ tự trong cột. */
		reorder?: boolean;
		/** Nút nhỏ (thẻ bảng việc) hay vừa (dòng danh sách). */
		compact?: boolean;
		/**
		 * Số nút thao tác chính đang bày cạnh menu (dòng Việc của tôi 1, đầu khung chi tiết 2). Dòng chuyển
		 * trạng thái trùng các nút đó ("Chuyển sang Chờ nghiệm thu" khi đã có Báo xong) không hiện lại.
		 */
		primaryShown?: number;
		/** Menu nằm trong khung chi tiết của chính việc này: bỏ dòng "Mở việc". */
		inDetail?: boolean;
	}>();

	const emit = defineEmits<{
		open: [];
		status: [status: TaskStatus];
		moveTop: [];
		moveBottom: [];
		changeDue: [];
		reassign: [];
		/** Đã gửi phiếu xin dời hạn từ menu (menu tự mở hộp và gọi API): nơi gọi thay bản mới nếu cần. */
		dueRequested: [task: TaskDetail];
	}>();

	const actions = useTaskActions();
	async function requestDue() {
		const result = await actions.requestDue(props.task);
		if (result.ok) emit('dueRequested', result.task);
	}

	const toast = useToast();
	const open = ref(false);
	const pos = ref({ x: 0, y: 0 });
	const triggerRef = ref<HTMLButtonElement | null>(null);
	const menuRef = ref<HTMLElement | null>(null);

	interface MenuEntry {
		key: string;
		label: string;
		disabled?: boolean;
		reason?: string | null;
		danger?: boolean;
		run?: () => void;
	}

	const shownActions = computed(() => (props.primaryShown ? primaryActions(props.task.allowedActions, props.primaryShown) : []));

	const statusEntries = computed<MenuEntry[]>(() =>
		BOARD_STATUSES.filter(s => s !== props.task.status)
			.filter(s => {
				const action = props.task.columnRules[s]?.action;
				return !(props.task.columnRules[s]?.allowed && action && shownActions.value.includes(action));
			})
			.map(s => {
			const rule = props.task.columnRules[s];
			const label = s === 'CANCELLED' ? 'Huỷ việc' : `Chuyển sang ${STATUS_LABELS[s]}`;
			if (rule?.allowed) return { key: `s-${s}`, label, danger: s === 'CANCELLED', run: () => emit('status', s) };
			return { key: `s-${s}`, label, disabled: true, reason: rule?.reason ?? 'Không chuyển được từ trạng thái hiện tại.' };
		}),
	);

	const otherEntries = computed<MenuEntry[]>(() => {
		const list: MenuEntry[] = [];
		if (props.reorder) {
			list.push({ key: 'top', label: 'Đưa lên đầu cột', run: () => emit('moveTop') });
			list.push({ key: 'bottom', label: 'Đưa xuống cuối cột', run: () => emit('moveBottom') });
		}
		if (props.task.permissions.reassign) list.push({ key: 'reassign', label: 'Đổi người thực hiện', run: () => emit('reassign') });
		if (props.task.permissions.changeDue) list.push({ key: 'due', label: props.task.dueDate ? 'Đổi hạn' : 'Đặt hạn', run: () => emit('changeDue') });
		else if (props.task.permissions.requestDue) list.push({ key: 'request-due', label: 'Xin dời hạn', run: requestDue });
		return list;
	});

	async function copyLink() {
		const url = `${window.location.origin}/cong-viec/${props.task.code}`;
		try {
			await navigator.clipboard.writeText(url);
			toast.success('Đã sao chép đường dẫn');
		} catch {
			toast.info(url);
		}
	}

	function place(x: number, y: number) {
		const width = 288;
		const maxX = window.innerWidth - width - 8;
		pos.value = { x: Math.max(8, Math.min(x, maxX)), y: Math.max(8, y) };
		open.value = true;
		nextTick(() => {
			const el = menuRef.value;
			if (el) {
				const rect = el.getBoundingClientRect();
				if (rect.bottom > window.innerHeight - 8) pos.value.y = Math.max(8, window.innerHeight - rect.height - 8);
				el.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')?.focus();
			}
		});
	}

	function toggle() {
		if (open.value) return close();
		const rect = triggerRef.value?.getBoundingClientRect();
		if (rect) place(rect.right - 288, rect.bottom + 4);
	}

	/** Chuột phải trên thẻ: mở menu ngay tại chỗ chuột. */
	function openAt(x: number, y: number) {
		place(x, y);
	}

	function close(returnFocus = true) {
		open.value = false;
		if (returnFocus) triggerRef.value?.focus();
	}

	function pick(entry: MenuEntry) {
		if (entry.disabled || !entry.run) return;
		close();
		entry.run();
	}

	function onKeydown(e: KeyboardEvent) {
		const items = Array.from(menuRef.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
		const idx = items.indexOf(document.activeElement as HTMLElement);
		if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			close();
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			items[(idx + 1) % items.length]?.focus();
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			items[(idx - 1 + items.length) % items.length]?.focus();
		} else if (e.key === 'Tab') {
			close(false);
		}
	}

	function onDocPointer(e: PointerEvent) {
		if (!open.value) return;
		const t = e.target as Node;
		if (menuRef.value?.contains(t) || triggerRef.value?.contains(t)) return;
		close(false);
	}

	onMounted(() => document.addEventListener('pointerdown', onDocPointer));
	onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocPointer));

	/** Một chuỗi lớp cho mọi dòng menu, khỏi lặp ở từng nút. */
	const ITEM =
		'block w-full px-3 py-2 text-left text-gray-700 hover:bg-gray-50 focus:bg-gray-100 focus:outline-none dark:text-gray-200 dark:hover:bg-gray-800 dark:focus:bg-gray-800';

	defineExpose({ openAt });
</script>

<template>
	<button
		ref="triggerRef"
		type="button"
		data-no-drag
		data-testid="task-menu-button"
		class="flex shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
		:class="compact ? 'h-7 w-7' : 'h-8 w-8'"
		:aria-label="`Thao tác với việc ${task.code}`"
		aria-haspopup="menu"
		:aria-expanded="open"
		@click.stop="toggle"
	>
		<Icon name="heroicons:ellipsis-horizontal" class="h-5 w-5" />
	</button>

	<Teleport to="body">
		<div
			v-if="open"
			ref="menuRef"
			role="menu"
			data-testid="task-menu"
			:aria-label="`Thao tác với việc ${task.code}`"
			class="fixed z-[65] max-h-[80vh] w-72 overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 text-sm shadow-xl dark:border-gray-700 dark:bg-gray-900"
			:style="{ left: `${pos.x}px`, top: `${pos.y}px` }"
			@keydown="onKeydown"
		>
			<button v-if="!inDetail" type="button" role="menuitem" :class="ITEM" @click="pick({ key: 'open', label: '', run: () => emit('open') })">
				Mở việc
			</button>
			<button type="button" role="menuitem" :class="ITEM" @click="pick({ key: 'copy', label: '', run: copyLink })">
				Sao chép đường dẫn
			</button>
			<div class="my-1 border-t border-gray-100 dark:border-gray-800" />
			<button
				v-for="entry in statusEntries"
				:key="entry.key"
				type="button"
				role="menuitem"
				:aria-disabled="entry.disabled ? 'true' : undefined"
				:class="[
					ITEM,
					entry.disabled ? 'cursor-not-allowed opacity-60' : '',
					entry.danger ? 'text-rose-600 dark:text-rose-400' : '',
				]"
				@click="pick(entry)"
			>
				<span class="block">{{ entry.label }}</span>
				<span v-if="entry.reason" class="mt-0.5 block text-xs font-normal leading-snug text-gray-500 dark:text-gray-400">
					{{ entry.reason }}
				</span>
			</button>
			<template v-if="otherEntries.length">
				<div class="my-1 border-t border-gray-100 dark:border-gray-800" />
				<button
					v-for="entry in otherEntries"
					:key="entry.key"
					type="button"
					role="menuitem"
					:class="ITEM"
					@click="pick(entry)"
				>
					{{ entry.label }}
				</button>
			</template>
		</div>
	</Teleport>
</template>

