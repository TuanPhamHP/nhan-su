<script setup lang="ts">
	import { storeToRefs } from 'pinia';
	import EmployeePicker, { type PickablePerson } from '~/components/modules/general-request/EmployeePicker.vue';
	import { useAuthStore } from '~/stores/auth';
	import { useDirectoryStore } from '~/stores/directory';
	import { taskPickablePeople } from '~/utils/people-picker';
	import {
		ACTION_LABELS,
		actionNeedsReason,
		blockerWarningText,
		checklistLeft,
		needsBlockerWarning,
		needsChecklistWarning,
		shortDate,
		vnToday,
	} from '~/utils/tasks.utils';

	/**
	 * Hộp thoại của `useTaskActions`: lý do Trả lại, Mở lại, Huỷ; Nghiệm thu với điểm chất lượng tuỳ
	 * chọn; Đổi hạn có lý do bắt buộc; Đổi người thực hiện; hỏi lại khi Báo xong hay Đóng việc mà còn
	 * mục kiểm tra chưa tick. Gắn một lần ở mỗi trang công việc.
	 *
	 * Bấm Huỷ hay Esc thì trả `null`, nơi gọi để thẻ về chỗ cũ. Vùng `aria-live` cuối file đọc câu
	 * tiếng Việt sau mỗi lần chuyển cho trình đọc màn hình.
	 */
	const { dialog, liveMessage } = useTaskActions();
	const directoryStore = useDirectoryStore();
	const { employees, departments } = storeToRefs(directoryStore);

	const reason = ref('');
	const quality = ref<number | null>(null);
	const dueDate = ref<string | undefined>(undefined);
	const assignee = ref<number[]>([]);
	const reviewer = ref<number[]>([]);
	const touched = ref(false);
	const authStore = useAuthStore();
	const boxRef = ref<HTMLElement | null>(null);

	watch(dialog, req => {
		reason.value = '';
		quality.value = null;
		touched.value = false;
		dueDate.value = req?.kind === 'due' ? (req.presetDate ?? req.task.dueDate ?? undefined) : undefined;
		assignee.value = req?.kind === 'reassign' ? [req.task.assignee.id] : [];
		reviewer.value = req?.kind === 'reassign' ? [req.task.reviewer.id] : [];
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
		if (req.kind === 'due') return `${firstDue.value ? 'Đặt hạn' : 'Đổi hạn'} ${req.task.code}`;
		if (req.kind === 'reassign') return `Đổi người thực hiện ${req.task.code}`;
		if (req.kind === 'requestDue') return `Xin dời hạn ${req.task.code}`;
		if (req.kind === 'rejectDue') return `Không duyệt dời hạn ${req.task.code}`;
		return `${ACTION_LABELS[req.action]} ${req.task.code}`;
	});

	/** Việc chưa có hạn: hộp Đổi hạn thành Đặt hạn, lý do không bắt buộc (bridge mục 25). */
	const firstDue = computed(() => dialog.value?.kind === 'due' && !dialog.value.task.dueDate);

	/** Ô lý do có hiện không; `needsReason` thì bắt buộc. */
	const showReason = computed(() => {
		const req = dialog.value;
		if (!req) return false;
		if (req.kind === 'due' || req.kind === 'requestDue' || req.kind === 'reassign' || req.kind === 'rejectDue') return true;
		return req.kind === 'transition' && actionNeedsReason(req.action);
	});

	const needsReason = computed(() => {
		const req = dialog.value;
		if (!req) return false;
		if (req.kind === 'due') return !firstDue.value;
		if (req.kind === 'requestDue') return true;
		return req.kind === 'transition' && actionNeedsReason(req.action);
	});

	const reasonLabel = computed(() => {
		const req = dialog.value;
		if (req?.kind === 'due') return firstDue.value ? 'Lý do (không bắt buộc)' : 'Lý do đổi hạn';
		if (req?.kind === 'requestDue') return 'Lý do xin dời hạn';
		if (req?.kind === 'reassign') return 'Lý do (không bắt buộc)';
		if (req?.kind === 'rejectDue') return 'Ghi chú cho người xin (không bắt buộc)';
		if (req?.kind !== 'transition') return '';
		if (req.action === 'return') return 'Lý do trả lại';
		if (req.action === 'reopen') return 'Lý do mở lại';
		return 'Lý do huỷ';
	});

	const reasonHint = computed(() => {
		const req = dialog.value;
		if (req?.kind === 'transition' && req.action === 'return') return 'Người thực hiện đọc câu này để sửa, nên ghi rõ cần sửa chỗ nào.';
		if (req?.kind === 'transition' && req.action === 'cancel') return 'Việc con chưa xong cũng bị huỷ theo cùng lý do.';
		if (req?.kind === 'due') return firstDue.value ? 'Đặt hạn lần đầu không tính là đổi hạn.' : 'Hạn ban đầu vẫn được giữ để xem lại sau.';
		if (req?.kind === 'requestDue') return `${req.task.assigner.fullName} sẽ nhận phiếu và duyệt hoặc không duyệt.`;
		if (req?.kind === 'reassign') return 'Người đang làm sẽ nhận thông báo kèm lý do này.';
		return '';
	});

	/** Phiếu xin dời hạn và lý do đổi người tối đa 500 ký tự theo API; lý do trả lại, mở lại, huỷ 2000. */
	const reasonMax = computed(() => (dialog.value?.kind === 'transition' || dialog.value?.kind === 'due' ? 2000 : 500));

	/** Bắt đầu, báo xong, nghiệm thu khi việc còn phải chờ việc khác chưa xong: chỉ hỏi lại, không chặn. */
	const blockerWarning = computed(() => {
		const req = dialog.value;
		if (req?.kind !== 'transition') return '';
		const open = req.task.dependencies?.openBlockers ?? [];
		return needsBlockerWarning(req.action, open) ? blockerWarningText(open) : '';
	});

	/** Báo xong, Đóng việc khi còn mục chưa tick: câu hỏi lại, API không chặn. */
	const checklistWarning = computed(() => {
		const req = dialog.value;
		if (req?.kind !== 'transition' || !needsChecklistWarning(req.action, req.task.checklist)) return '';
		const { total } = req.task.checklist;
		const verb = req.action === 'self_close' ? 'Vẫn đóng việc?' : 'Vẫn báo xong?';
		return `Còn ${checklistLeft(req.task.checklist)}/${total} mục kiểm tra chưa xong. ${verb}`;
	});

	/** Nghiệm thu: chỉ nhắc, không chặn. */
	const acceptChecklistNote = computed(() => {
		const req = dialog.value;
		if (req?.kind !== 'transition' || req.action !== 'accept') return '';
		const left = checklistLeft(req.task.checklist);
		return left ? `Còn ${left} mục kiểm tra chưa tick.` : '';
	});

	const people = computed<PickablePerson[]>(() =>
		taskPickablePeople(employees.value, departments.value),
	);

	/** Chữ dưới năm sao của hộp Nghiệm thu, để người chấm biết mỗi mức nghĩa là gì. */
	const QUALITY_LABELS = ['Kém', 'Chưa đạt', 'Đạt', 'Tốt', 'Rất tốt'] as const;

	/**
	 * Đổi người làm mà người nghiệm thu vẫn là người bị đổi đi (việc tự làm tự nghiệm thu, hoặc người cũ
	 * được giao nghiệm thu) thì gợi ý chuyển người nghiệm thu sang chính người đang đổi.
	 */
	const reviewerIsLeaving = computed(() => {
		const req = dialog.value;
		return req?.kind === 'reassign' && reviewer.value[0] === req.task.assignee.id && assignee.value[0] !== req.task.assignee.id;
	});
	const meId = computed(() => authStore.user?.id ?? null);

	const reasonError = computed(() => (touched.value && needsReason.value && !reason.value.trim() ? `Nhập ${reasonLabel.value.toLowerCase()}` : ''));
	const dueError = computed(() => {
		const req = dialog.value;
		if ((req?.kind !== 'due' && req?.kind !== 'requestDue') || !touched.value) return '';
		if (!dueDate.value) return req.kind === 'requestDue' ? 'Chọn hạn đề xuất' : 'Chọn hạn mới';
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
			// Chỉ gửi người nghiệm thu khi đổi thật, để không ghi thêm một dòng lịch sử thừa.
			reviewerId: req.kind === 'reassign' && reviewer.value[0] && reviewer.value[0] !== req.task.reviewer.id ? reviewer.value[0] : undefined,
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
		if (req.kind === 'due') return firstDue.value ? 'Đặt hạn' : 'Đổi hạn';
		if (req.kind === 'reassign') return 'Lưu';
		if (req.kind === 'requestDue') return 'Gửi xin dời hạn';
		if (req.kind === 'rejectDue') return 'Không duyệt';
		return ACTION_LABELS[req.action];
	});

	const confirmVariant = computed(() => {
		const req = dialog.value;
		if (req?.kind === 'rejectDue') return 'danger';
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
					<p
						v-if="checklistWarning"
						class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200"
						data-testid="task-dialog-checklist"
					>
						{{ checklistWarning }}
					</p>
					<p
						v-if="blockerWarning"
						class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200"
						data-testid="task-dialog-blocker"
					>
						{{ blockerWarning }}
					</p>

					<!-- Nghiệm thu: điểm chất lượng tuỳ chọn, năm nút như phiếu KPI. -->
					<div v-if="dialog.kind === 'transition' && dialog.action === 'accept'" class="space-y-2">
						<p
							v-if="acceptChecklistNote"
							class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200"
							data-testid="task-dialog-checklist"
						>
							{{ acceptChecklistNote }}
						</p>
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
								:aria-label="`${n} sao, ${QUALITY_LABELS[n - 1]}`"
								:data-autofocus="n === 1 ? '' : undefined"
								class="flex w-14 flex-col items-center gap-0.5 rounded-lg p-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500"
								:class="quality != null && n <= quality ? 'text-amber-500' : 'text-gray-300 hover:text-amber-400 dark:text-gray-600'"
								@click="quality = quality === n ? null : n"
							>
								<Icon name="heroicons:star-solid" class="h-7 w-7" />
								<span
									class="text-[11px] leading-tight"
									:class="quality === n ? 'font-semibold text-amber-700 dark:text-amber-300' : 'text-gray-500 dark:text-gray-400'"
									data-testid="task-quality-label"
								>
									{{ n }} {{ QUALITY_LABELS[n - 1] }}
								</span>
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
						<UiDatePicker v-model="dueDate" :label="firstDue ? 'Hạn' : 'Hạn mới'" :error="dueError || undefined" warn-far-year />
					</div>

					<!-- Xin dời hạn (người thực hiện) -->
					<div v-if="dialog.kind === 'requestDue'" class="space-y-3" data-testid="task-dialog-request-due">
						<p class="text-sm text-gray-600 dark:text-gray-300">
							<template v-if="dialog.task.dueDate">Hạn hiện tại {{ shortDate(dialog.task.dueDate, today) }}</template>
							<template v-else>Việc này chưa có hạn</template>
						</p>
						<UiDatePicker v-model="dueDate" label="Hạn đề xuất *" :min="today" :error="dueError || undefined" warn-far-year />
					</div>

					<!-- Không duyệt phiếu xin dời hạn -->
					<p v-if="dialog.kind === 'rejectDue' && dialog.task.pendingDueRequest" class="text-sm text-gray-600 dark:text-gray-300">
						{{ dialog.task.pendingDueRequest.requestedBy.fullName }} xin dời hạn sang
						{{ shortDate(dialog.task.pendingDueRequest.proposedDueDate, today) }}. Hạn giữ nguyên nếu không duyệt.
					</p>

					<!-- Đổi người thực hiện -->
					<div v-if="dialog.kind === 'reassign'" class="space-y-3">
						<EmployeePicker v-model="assignee" :people="people" single label="Người thực hiện" />
						<div data-testid="task-dialog-reviewer">
							<EmployeePicker
								v-model="reviewer"
								:people="people"
								single
								label="Người nghiệm thu"
								hint="Giữ nguyên nếu không cần đổi."
							/>
							<div
								v-if="reviewerIsLeaving"
								class="mt-1.5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200"
								data-testid="task-dialog-reviewer-hint"
							>
								Người nghiệm thu đang là {{ dialog.task.assignee.fullName }}, người bị đổi khỏi việc này.
								<button
									v-if="meId && meId !== reviewer[0]"
									type="button"
									class="font-medium text-brand-700 underline dark:text-brand-300"
									data-testid="task-dialog-reviewer-me"
									@click="reviewer = [meId]"
								>
									Để tôi nghiệm thu
								</button>
							</div>
						</div>
					</div>

					<div v-if="showReason" class="space-y-1">
						<label for="task-dialog-reason" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
							{{ reasonLabel }} <span v-if="needsReason" class="text-red-500">*</span>
						</label>
						<textarea
							id="task-dialog-reason"
							v-model="reason"
							rows="3"
							:maxlength="reasonMax"
							data-testid="task-dialog-reason"
							class="w-full resize-none rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:text-gray-100"
							:class="reasonError ? 'border-rose-500' : 'border-gray-300 dark:border-gray-600'"
							:aria-invalid="!!reasonError"
						/>
						<p v-if="reasonError" class="text-xs text-rose-600 dark:text-rose-400">{{ reasonError }}</p>
						<p v-else-if="reasonHint" class="text-xs text-gray-500 dark:text-gray-400">{{ reasonHint }}</p>
					</div>
				</div>

				<div class="flex justify-end gap-3 border-t border-gray-200 px-5 py-3 dark:border-gray-700">
					<!-- Hộp chỉ hỏi lại thì con trỏ đứng ở Huỷ, Enter nhầm không gửi đi. -->
					<CommonAppButton variant="secondary" :data-autofocus="checklistWarning ? '' : undefined" @click="cancel">Huỷ</CommonAppButton>
					<CommonAppButton :variant="confirmVariant" data-testid="task-dialog-confirm" @click="confirm">
						{{ confirmLabel }}
					</CommonAppButton>
				</div>
			</div>
		</div>
		<div class="sr-only" aria-live="polite" role="status">{{ liveMessage }}</div>
	</Teleport>
</template>
