<script setup lang="ts">
	import TaskDetailView from '~/components/modules/tasks/TaskDetailView.vue';
	import type { TaskDetail } from '~/types/tasks.types';

	/**
	 * Khung chi tiết trượt từ phải, rộng khoảng 640 điểm ảnh (UI-02). Không phủ nền tối: danh sách
	 * bên trái vẫn bấm được và dòng đang mở được tô. Màn hẹp hơn 1.024 điểm ảnh thì khung chiếm toàn
	 * màn hình. Esc đóng khung (trừ khi đang mở hộp thoại hay menu), nút Quay lại cũng đóng. Việc đang
	 * mở đọc từ `?task=` trên đường dẫn (`useTaskPanel`).
	 */
	const emit = defineEmits<{ changed: [task: TaskDetail] }>();
	const panel = useTaskPanel();
	const { dialog } = useTaskActions();
	const panelRef = ref<HTMLElement | null>(null);
	let lastFocus: HTMLElement | null = null;

	watch(
		() => panel.code.value,
		(code, prev) => {
			if (code && !prev) {
				lastFocus = document.activeElement as HTMLElement | null;
				nextTick(() => panelRef.value?.focus());
			}
			if (!code && prev) {
				lastFocus?.focus?.();
				lastFocus = null;
			}
		},
	);

	function onKey(e: KeyboardEvent) {
		if (e.key !== 'Escape' || !panel.code.value || dialog.value || e.defaultPrevented) return;
		// Menu ba chấm, hộp gợi ý nhắc tên tự đóng bằng Esc; chỉ đóng khung khi không còn lớp nào mở.
		if (document.querySelector('[role="menu"], [data-testid="mention-suggest"]')) return;
		const target = e.target as HTMLElement | null;
		if (target?.closest('.ProseMirror') && target.closest('[data-testid="task-comment-box"]')) {
			(target as HTMLElement).blur();
			return;
		}
		// Khung việc nằm trên cùng (việc định kỳ có thêm khung quy tắc bên dưới): Esc chỉ đóng khung này.
		e.preventDefault();
		panel.close();
	}
	onMounted(() => window.addEventListener('keydown', onKey));
	onBeforeUnmount(() => window.removeEventListener('keydown', onKey));

	/** Sang trang đầy đủ là một bước mới: Quay lại từ đó về đúng danh sách kèm khung. */
	function openFull() {
		const code = panel.code.value;
		if (code) navigateTo(`/cong-viec/${encodeURIComponent(code)}`);
	}
</script>

<template>
	<Teleport to="body">
		<Transition
			enter-active-class="transition duration-200 ease-out"
			enter-from-class="translate-x-full"
			enter-to-class="translate-x-0"
			leave-active-class="transition duration-150 ease-in"
			leave-from-class="translate-x-0"
			leave-to-class="translate-x-full"
		>
			<aside
				v-if="panel.code.value"
				ref="panelRef"
				tabindex="-1"
				role="dialog"
				:aria-label="`Chi tiết việc ${panel.code.value}`"
				data-testid="task-panel"
				class="fixed inset-y-0 right-0 z-[56] flex w-full flex-col bg-white shadow-2xl outline-none lg:w-[640px] lg:border-l lg:border-gray-200 dark:bg-gray-900 dark:lg:border-gray-700"
			>
				<TaskDetailView
					:key="panel.code.value"
					:code="panel.code.value"
					mode="panel"
					@changed="t => emit('changed', t)"
					@open-task="c => panel.open(c)"
				>
					<template #header-tools>
						<button
							type="button"
							class="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:hover:bg-gray-800"
							aria-label="Mở trang đầy đủ"
							title="Mở trang đầy đủ"
							@click="openFull"
						>
							<Icon name="heroicons:arrows-pointing-out" class="h-4 w-4" />
						</button>
						<button
							type="button"
							class="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:hover:bg-gray-800"
							aria-label="Đóng khung chi tiết"
							data-testid="task-panel-close"
							@click="panel.close()"
						>
							<Icon name="heroicons:x-mark" class="h-5 w-5" />
						</button>
					</template>
				</TaskDetailView>
			</aside>
		</Transition>
	</Teleport>
</template>
