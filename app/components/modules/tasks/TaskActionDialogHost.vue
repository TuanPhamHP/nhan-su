<script setup lang="ts">
	import { storeToRefs } from 'pinia';
	import EmployeePicker, { type PickablePerson } from '~/components/modules/general-request/EmployeePicker.vue';
	import { useDirectoryStore } from '~/stores/directory';
	import { ACTION_LABELS, actionNeedsReason, shortDate, vnToday } from '~/utils/tasks.utils';

	/**
	 * Hộp thoại của `useTaskActions`: lý do Trả lại, Mở lại, Huỷ; Nghiệm thu với điểm chất lượng tuỳ
	 * chọn; Đổi hạn có lý do bắt buộc; Đổi người thực hiện. Gắn một lần ở mỗi trang công việc.
	 *
	 * Bấm Huỷ hay Esc thì trả `null`, nơi gọi để thẻ về chỗ cũ. Vùng `aria-live` cuối file đọc câu
	 * tiếng Việt sau mỗi lần chuyển cho trình đọc màn hình.
	 */
	const { dialog, liveMessage } = useTaskActions();
	const directoryStore = useDirectoryStore();
	const { employees } = storeToRefs(directoryStore);

	const reason = ref('');
	const quality = ref<number | null>(null);
	const dueDate = ref<string | undefined>(undefined);
	const assignee = ref<number[]>([]);
	const touched = ref(false);
	const boxRef = ref<HTMLElement | null>(null);

	watch(dialog, req => {
		reason.value = '';
		quality.value = null;
		touched.value = false;
		dueDate.value = req?.kind === 'due' ? (req.presetDate ?? req.task.dueDate ?? undefined) : undefined;
		assignee.value = req?.kind === 'reassign' ? [req.task.assignee.id] : [];
		if (req?.kind === 'reassign') directoryStore.load().catch(() => {});
		if (req) {
			nextTick(() => {
				const first = boxRef.value?.querySelector<HTMLElement>('textarea, input, button[data-autofocus]');
				first?.focus();
			});
		}
	});

	const title = computed(() => {
		const req = dialog.value;
		if (!req) return '';
		if (req.kind === 'due') return `Đổi hạn ${req.task.code}`;
		if (req.kind === 'reassign') return `Đổi người thực hiện ${req.task.code}`;
		return `${ACTION_LABELS[req.action]} ${req.task.code}`;
	});

	const needsReason = computed(() => {
		const req = dialog.value;
		if (!req) return false;
		if (req.kind === 'due') return true;
		return req.kind === 'transition' && actionNeedsReason(req.action);
	});

	const reasonLabel = computed(() => {
		const req = dialog.value;
		if (req?.kind === 'due') return 'Lý do đổi hạn';
		if (req?.kind !== 'transition') return '';
		if (req.action === 'return') return 'Lý do trả lại';
		if (req.action === 'reopen') return 'Lý do mở lại';
		return 'Lý do huỷ';
	});

	const reasonHint = computed(() => {
		const req = dialog.value;
		if (req?.kind === 'transition' && req.action === 'return') return 'Người thực hiện đọc câu này để sửa, nên ghi rõ cần sửa chỗ nào.';
		if (req?.kind === 'transition' && req.action === 'cancel') return 'Việc con chưa xong cũng bị huỷ theo cùng lý do.';
		if (req?.kind === 'due') return 'Hạn ban đầu vẫn được giữ để xem lại sau.';
		return '';
	});

	const people = computed<PickablePerson[]>(() =>
		employees.value.map(e => ({ id: e.id, fullName: e.fullName, hint: e.department?.name ?? e.employeeCode })),
	);

	const reasonError = computed(() => (touched.value && needsReason.value && !reason.value.trim() ? `Nhập ${reasonLabel.value.toLowerCase()}` : ''));
	const dueError = computed(() => {
		const req = dialog.value;
		if (req?.kind !== 'due' || !touched.value) return '';
		if (!dueDate.value) return 'Chọn hạn mới';
		if (dueDate.value === req.task.dueDate) return 'Hạn mới đang trùng hạn hiện tại';
		return '';
	});

	function cancel() {
		const req = dialog.value;
		dialog.value = null;
		req?.resolve(null);
	}

	function confirm() {
		const req = dialog.value;
		if (!req) return;
		touched.value = true;
		if (reasonError.value || dueError.value) return;
		if (req.kind === 'reassign' && !assignee.value[0]) return;
		dialog.value = null;
		req.resolve({
			reason: reason.value.trim() || undefined,
			qualityScore: quality.value ?? undefined,
			dueDate: dueDate.value,
			assigneeId: assignee.value[0],
		});
	}

	useEscapeKey(cancel, () => !!dialog.value);

	/** Giữ Tab trong hộp: tới nút cuối thì quay về ô đầu và ngược lại. */
	function trapTab(e: KeyboardEvent) {
		if (e.key !== 'Tab' || !boxRef.value) return;
		const items = Array.from(
			boxRef.value.querySelectorAll<HTMLElement>('button:not([disabled]), textarea, input, [tabindex="0"]'),
		);
		if (!items.length) return;
		const first = items[0]!;
		const last = items[items.length - 1]!;
		if (e.shiftKey && document.activeElement === first) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && document.activeElement === last) {
			e.preventDefault();
			first.focus();
		}
	}

	const confirmLabel = computed(() => {
		const req = dialog.value;
		if (!req) return 'Xác nhận';
		if (req.kind === 'due') return 'Đổi hạn';
		if (req.kind === 'reassign') return 'Lưu';
		return ACTION_LABELS[req.action];
	});

	const confirmVariant = computed(() => {
		const req = dialog.value;
		return req?.kind === 'transition' && (req.action === 'cancel' || req.action === 'return') ? 'danger' : 'primary';
	});

	const today = vnToday();
</script>

<template>
	<Teleport to="body">
		<div
			v-if="dialog"
			class="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
			data-testid="task-dialog"
			@click.self="cancel"
		>
			<div
				ref="boxRef"
				role="dialog"
				aria-modal="true"
				:aria-label="title"
				class="w-full max-w-md rounded-t-2xl bg-white shadow-xl sm:rounded-2xl dark:bg-gray-900"
				@keydown="trapTab"
				@keydown.ctrl.enter.prevent="confirm"
			>
				<div class="flex items-start justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
					<div class="min-w-0">
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ title }}</h2>
						<p class="mt-0.5 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{{ dialog.task.title }}</p>
					</div>
					<button
						type="button"
						class="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:hover:bg-gray-800"
						aria-label="Đóng"
						@click="cancel"
					>
						<Icon name="heroicons:x-mark" class="h-5 w-5" />
					</button>
				</div>

				<div class="space-y-4 px-5 py-4">
					<!-- Nghiệm thu: điểm chất lượng tuỳ chọn, năm nút như phiếu KPI. -->
					<div v-if="dialog.kind === 'transition' && dialog.action === 'accept'" class="space-y-2">
						<p class="text-sm text-gray-700 dark:text-gray-300">
							Chấm chất lượng nếu muốn, không chấm vẫn nghiệm thu được.
						</p>
						<div class="flex gap-1" role="radiogroup" aria-label="Điểm chất lượng">
							<button
								v-for="n in 5"
								:key="n"
								type="button"
								role="radio"
								:aria-checked="quality === n"
								:aria-label="`${n} sao`"
								:data-autofocus="n === 1 ? '' : undefined"
								class="rounded-lg p-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500"
								:class="quality != null && n <= quality ? 'text-amber-500' : 'text-gray-300 hover:text-amber-400 dark:text-gray-600'"
								@click="quality = quality === n ? null : n"
							>
								<Icon name="heroicons:star-solid" class="h-7 w-7" />
							</button>
						</div>
					</div>

					<!-- Đổi hạn -->
					<div v-if="dialog.kind === 'due'" class="space-y-3">
						<p class="text-sm text-gray-600 dark:text-gray-300">
							<template v-if="dialog.task.dueDate">Hạn hiện tại {{ shortDate(dialog.task.dueDate, today) }}</template>
							<template v-else>Việc này chưa có hạn</template>
							<template v-if="dialog.task.dueChangeCount > 0 && dialog.task.originalDueDate">
								, hạn ban đầu {{ shortDate(dialog.task.originalDueDate, today) }}, đã đổi
								{{ dialog.task.dueChangeCount }} lần
							</template>
						</p>
						<UiDatePicker v-model="dueDate" label="Hạn mới" :error="dueError || undefined" />
					</div>

					<!-- Đổi người thực hiện -->
					<div v-if="dialog.kind === 'reassign'">
						<EmployeePicker v-model="assignee" :people="people" single label="Người thực hiện" />
					</div>

					<div v-if="needsReason" class="space-y-1">
						<label for="task-dialog-reason" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
							{{ reasonLabel }} <span class="text-red-500">*</span>
						</label>
						<textarea
							id="task-dialog-reason"
							v-model="reason"
							rows="3"
							maxlength="2000"
							class="w-full resize-none rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:text-gray-100"
							:class="reasonError ? 'border-rose-500' : 'border-gray-300 dark:border-gray-600'"
							:aria-invalid="!!reasonError"
						/>
						<p v-if="reasonError" class="text-xs text-rose-600 dark:text-rose-400">{{ reasonError }}</p>
						<p v-else-if="reasonHint" class="text-xs text-gray-500 dark:text-gray-400">{{ reasonHint }}</p>
					</div>
				</div>

				<div class="flex justify-end gap-3 border-t border-gray-200 px-5 py-3 dark:border-gray-700">
					<CommonAppButton variant="secondary" @click="cancel">Huỷ</CommonAppButton>
					<CommonAppButton :variant="confirmVariant" data-testid="task-dialog-confirm" @click="confirm">
						{{ confirmLabel }}
					</CommonAppButton>
				</div>
			</div>
		</div>
		<div class="sr-only" aria-live="polite" role="status">{{ liveMessage }}</div>
	</Teleport>
</template>
