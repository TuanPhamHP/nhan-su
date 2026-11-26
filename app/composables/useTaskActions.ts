import { useTasksService } from '~/services/tasks.service';
import type {
	MoveTaskBody,
	TaskAction,
	TaskConflictSnapshot,
	TaskDetail,
	TaskListItem,
	TaskStatus,
} from '~/types/tasks.types';
import {
	ACTION_LABELS,
	ACTION_TARGET,
	STATUS_LABELS,
	actionNeedsDialog,
	needsBlockerWarning,
	needsChecklistWarning,
	taskErrorInfo,
} from '~/utils/tasks.utils';

/**
 * Một chỗ chạy mọi thao tác ghi lên việc: nút trên dòng, nút đầu khung chi tiết, menu ba chấm,
 * kéo thẻ, sửa trên ô. Nhờ vậy hộp nhập lý do, câu báo lỗi, xử lý lệch phiên bản chỉ viết một lần.
 *
 * Hộp thoại do `TaskActionDialogHost` vẽ (gắn một lần ở mỗi trang công việc); ở đây chỉ giữ
 * yêu cầu đang chờ và trả kết quả bằng Promise, nên nơi gọi viết thẳng `await`.
 */

export type TaskDialogRequest =
	| { kind: 'transition'; task: TaskListItem; action: TaskAction; resolve: (v: TaskDialogResult | null) => void }
	| { kind: 'due'; task: TaskListItem; presetDate?: string; resolve: (v: TaskDialogResult | null) => void }
	| { kind: 'reassign'; task: TaskListItem; resolve: (v: TaskDialogResult | null) => void }
	/** Người thực hiện xin dời hạn: hạn đề xuất, lý do bắt buộc. */
	| { kind: 'requestDue'; task: TaskListItem; resolve: (v: TaskDialogResult | null) => void }
	/** Người duyệt không duyệt phiếu xin dời hạn: ghi chú tuỳ chọn. */
	| { kind: 'rejectDue'; task: TaskDetail; resolve: (v: TaskDialogResult | null) => void };

export interface TaskDialogResult {
	reason?: string;
	qualityScore?: number;
	dueDate?: string;
	assigneeId?: number;
	/** Hộp Đổi người thực hiện: có khi người dùng đổi luôn người nghiệm thu. */
	reviewerId?: number;
}

export type TaskActionResult =
	| { ok: true; task: TaskDetail }
	| { ok: false; cancelled: boolean; conflict: TaskConflictSnapshot | null; message: string | null };

const dialog = ref<TaskDialogRequest | null>(null);
const busy = ref(false);
/**
 * Việc vừa đổi do một thao tác không đi qua nơi gọi (bấm Hoàn tác trong toast sau Báo xong). Trang và khung
 * chi tiết theo dõi để thay dòng ngay, không đợi tải lại.
 */
const externalChange = ref<TaskDetail | null>(null);
/** Giữ nút Hoàn tác trong khoảng này sau Báo xong (bridge mục 23). */
const UNDO_MS = 10_000;
/** Câu cho trình đọc màn hình sau mỗi lần chuyển (vùng `aria-live` ở `TaskActionDialogHost`). */
const liveMessage = ref('');

function openDialog<K extends TaskDialogRequest['kind']>(
	request: Omit<Extract<TaskDialogRequest, { kind: K }>, 'resolve'>,
): Promise<TaskDialogResult | null> {
	return new Promise(resolve => {
		dialog.value?.resolve(null);
		dialog.value = { ...request, resolve } as TaskDialogRequest;
	});
}

export function useTaskActions() {
	const service = useTasksService();
	const toast = useToast();

	function announce(text: string) {
		liveMessage.value = '';
		nextTick(() => {
			liveMessage.value = text;
		});
	}

	/** Hiện lỗi bằng toast; lệch phiên bản và trạng thái đã đổi là cảnh báo, không phải lỗi. */
	function reportError(err: unknown): { conflict: TaskConflictSnapshot | null; message: string } {
		const info = taskErrorInfo(err);
		if (info.code === 'TASK_VERSION_CONFLICT' || info.code === 'TASK_STATUS_INVALID') {
			toast.warning(info.message);
		} else {
			toast.error(info.message);
		}
		return { conflict: info.task, message: info.message };
	}

	function done(task: TaskDetail, text: string): TaskActionResult {
		announce(text);
		if (task.warning) toast.warning(task.warning);
		return { ok: true, task };
	}

	/**
	 * Thao tác có phải mở hộp trước khi gửi không: cần lý do hay điểm; báo xong, tự đóng việc mà còn mục
	 * kiểm tra chưa tick; bắt đầu, báo xong, nghiệm thu khi việc còn phải chờ việc khác chưa xong (hộp hỏi
	 * lại, API không chặn).
	 */
	function dialogFirst(task: TaskListItem, action: TaskAction): boolean {
		return (
			actionNeedsDialog(action) ||
			needsChecklistWarning(action, task.checklist) ||
			needsBlockerWarning(action, task.dependencies?.openBlockers)
		);
	}

	/** Bấm Hoàn tác trong toast sau Báo xong: rút lại bằng `version` mới nhất. */
	async function undoSubmit(updated: TaskDetail) {
		try {
			const back = await service.transition(updated.id, { action: 'withdraw', version: updated.version });
			toast.success(`Đã rút lại báo xong ${updated.code}`);
			externalChange.value = back;
			announce(`Đã rút lại báo xong ${updated.title}, việc về Đang làm.`);
		} catch (err) {
			reportError(err);
		}
	}

	/** Câu báo sau thao tác; Báo xong có nút Hoàn tác khi máy chủ còn cho rút lại. */
	function successToast(action: TaskAction, task: TaskListItem, updated: TaskDetail) {
		if (action === 'submit' && updated.allowedActions.includes('withdraw')) {
			toast.success(`${ACTION_LABELS[action]}: ${task.code}`, {
				duration: UNDO_MS,
				action: { label: 'Hoàn tác', run: () => undoSubmit(updated) },
			});
			return;
		}
		toast.success(`${ACTION_LABELS[action]}: ${task.code}`);
	}

	/** Chuyển trạng thái bằng nút hoặc menu. Thao tác cần lý do hay điểm thì mở hộp trước. */
	async function runAction(task: TaskListItem, action: TaskAction): Promise<TaskActionResult> {
		let extra: TaskDialogResult = {};
		if (dialogFirst(task, action)) {
			const answer = await openDialog<'transition'>({ kind: 'transition', task, action });
			if (!answer) return { ok: false, cancelled: true, conflict: null, message: null };
			extra = answer;
		}
		busy.value = true;
		try {
			const updated = await service.transition(task.id, {
				action,
				version: task.version,
				reason: extra.reason,
				qualityScore: extra.qualityScore,
			});
			successToast(action, task, updated);
			return done(updated, `Đã chuyển ${task.title} sang ${updated.statusLabel}.`);
		} catch (err) {
			return { ok: false, cancelled: false, ...reportError(err) };
		} finally {
			busy.value = false;
		}
	}

	/**
	 * Kéo thẻ sang cột khác hoặc đổi thứ tự. Cột cần lý do (Trả lại, Mở lại, Huỷ), cột Hoàn thành của
	 * người nghiệm thu, hay cột báo xong khi còn mục kiểm tra chưa tick thì mở hộp tại chỗ; bấm Huỷ trong
	 * hộp thì trả về `cancelled` để thẻ về chỗ cũ.
	 */
	async function moveTask(
		task: TaskListItem,
		body: Omit<MoveTaskBody, 'version' | 'reason' | 'qualityScore'>,
	): Promise<TaskActionResult> {
		const toStatus = body.status;
		const extra: TaskDialogResult = {};
		if (toStatus && toStatus !== task.status) {
			const rule = task.columnRules[toStatus];
			if (!rule || !rule.allowed) {
				const message = rule?.reason ?? `Không chuyển được việc này sang ${STATUS_LABELS[toStatus]}.`;
				toast.warning(message);
				announce(message);
				return { ok: false, cancelled: false, conflict: null, message };
			}
			if (rule.action && dialogFirst(task, rule.action)) {
				const answer = await openDialog<'transition'>({ kind: 'transition', task, action: rule.action });
				if (!answer) return { ok: false, cancelled: true, conflict: null, message: null };
				Object.assign(extra, answer);
			}
		}
		busy.value = true;
		try {
			const updated = await service.move(task.id, { ...body, version: task.version, ...extra });
			// Thả lại đúng cột cũ là đổi thứ tự, không phải chuyển trạng thái: nói rõ để người kéo trên điện
			// thoại biết thẻ chưa sang cột khác.
			const text =
				toStatus && toStatus !== task.status
					? `Đã chuyển ${task.title} sang ${updated.statusLabel}.`
					: `Đã đổi thứ tự ${task.title}, việc vẫn ở cột ${updated.statusLabel}.`;
			return done(updated, text);
		} catch (err) {
			return { ok: false, cancelled: false, ...reportError(err) };
		} finally {
			busy.value = false;
		}
	}

	/**
	 * Đổi hạn qua hộp có ô lý do (F-04). Việc chưa có hạn là đặt hạn lần đầu: lý do không bắt buộc, không tính
	 * là đổi hạn (bridge mục 25).
	 */
	async function changeDue(task: TaskListItem, presetDate?: string): Promise<TaskActionResult> {
		const answer = await openDialog<'due'>({ kind: 'due', task, presetDate });
		const firstDue = !task.dueDate;
		if (!answer?.dueDate || (!firstDue && !answer.reason)) return { ok: false, cancelled: true, conflict: null, message: null };
		busy.value = true;
		try {
			const updated = await service.changeDue(task.id, {
				dueDate: answer.dueDate,
				reason: answer.reason || undefined,
				version: task.version,
			});
			toast.success(firstDue ? `Đã đặt hạn ${task.code}` : `Đã đổi hạn ${task.code}`);
			return done(updated, firstDue ? `Đã đặt hạn ${task.title}.` : `Đã đổi hạn ${task.title}.`);
		} catch (err) {
			return { ok: false, cancelled: false, ...reportError(err) };
		} finally {
			busy.value = false;
		}
	}

	/**
	 * Đổi người thực hiện bằng hộp chọn người (từ menu ba chấm), kèm người nghiệm thu nếu đổi luôn. Nơi gọi
	 * thay dòng bằng `task` trả về ngay, không đợi tải lại.
	 */
	async function reassign(task: TaskListItem): Promise<TaskActionResult> {
		const answer = await openDialog<'reassign'>({ kind: 'reassign', task });
		if (!answer?.assigneeId) return { ok: false, cancelled: true, conflict: null, message: null };
		if (answer.assigneeId === task.assignee.id && !answer.reviewerId) return { ok: false, cancelled: true, conflict: null, message: null };
		const changingAssignee = answer.assigneeId !== task.assignee.id;
		const result = await updateFields(task, {
			assigneeId: changingAssignee ? answer.assigneeId : undefined,
			// Lý do chỉ đi kèm khi đổi người làm (bridge mục 30): ghi lịch sử và gửi người bị đổi đi.
			reason: changingAssignee ? answer.reason : undefined,
			reviewerId: answer.reviewerId,
		});
		if (result.ok) {
			toast.success(
				answer.assigneeId !== task.assignee.id
					? `Đã chuyển ${task.code} cho ${result.task.assignee.fullName}`
					: `Đã đổi người nghiệm thu ${task.code} thành ${result.task.reviewer.fullName}`,
			);
		}
		return result;
	}

	/** Sửa trên ô (ưu tiên, người thực hiện, tiêu đề...): gửi kèm `version` đang hiện. */
	async function updateFields(
		task: TaskListItem,
		fields: {
			title?: string;
			description?: string;
			priority?: TaskListItem['priority'];
			points?: number | null;
			startDate?: string;
			assigneeId?: number;
			reason?: string;
			reviewerId?: number;
			groupId?: number | null;
			sprintId?: number | null;
		},
	): Promise<TaskActionResult> {
		busy.value = true;
		try {
			const updated = await service.update(task.id, { version: task.version, ...fields });
			return done(updated, `Đã lưu ${task.title}.`);
		} catch (err) {
			return { ok: false, cancelled: false, ...reportError(err) };
		} finally {
			busy.value = false;
		}
	}

	// ─── Phiếu xin dời hạn (bridge mục 25) ──────────────────────────────────

	/** Chạy một lệnh ghi lên phiếu xin dời hạn, báo bằng toast và câu đọc màn hình. Lỗi hiện thẳng `message` máy chủ. */
	async function dueRequestCall(call: () => Promise<TaskDetail>, success: string, live: string): Promise<TaskActionResult> {
		busy.value = true;
		try {
			const updated = await call();
			toast.success(success);
			return done(updated, live);
		} catch (err) {
			return { ok: false, cancelled: false, ...reportError(err) };
		} finally {
			busy.value = false;
		}
	}

	/** Người thực hiện xin dời hạn: hộp có Hạn đề xuất và Lý do bắt buộc. */
	async function requestDue(task: TaskListItem): Promise<TaskActionResult> {
		const answer = await openDialog<'requestDue'>({ kind: 'requestDue', task });
		if (!answer?.dueDate || !answer.reason) return { ok: false, cancelled: true, conflict: null, message: null };
		const { dueDate, reason } = answer;
		return dueRequestCall(
			() => service.requestDue(task.id, { dueDate, reason }),
			`Đã gửi xin dời hạn ${task.code}`,
			`Đã gửi xin dời hạn ${task.title}, chờ người giao duyệt.`,
		);
	}

	async function approveDueRequest(task: TaskDetail): Promise<TaskActionResult> {
		const req = task.pendingDueRequest;
		if (!req) return { ok: false, cancelled: true, conflict: null, message: null };
		return dueRequestCall(
			() => service.approveDueRequest(task.id, req.id),
			`Đã duyệt dời hạn ${task.code}`,
			`Đã duyệt dời hạn ${task.title}.`,
		);
	}

	/** Không duyệt: hộp ghi chú tuỳ chọn, ghi chú gửi kèm thông báo cho người xin. */
	async function rejectDueRequest(task: TaskDetail): Promise<TaskActionResult> {
		const req = task.pendingDueRequest;
		if (!req) return { ok: false, cancelled: true, conflict: null, message: null };
		const answer = await openDialog<'rejectDue'>({ kind: 'rejectDue', task });
		if (!answer) return { ok: false, cancelled: true, conflict: null, message: null };
		return dueRequestCall(
			() => service.rejectDueRequest(task.id, req.id, answer.reason),
			`Đã không duyệt dời hạn ${task.code}`,
			`Đã không duyệt dời hạn ${task.title}.`,
		);
	}

	async function cancelDueRequest(task: TaskDetail): Promise<TaskActionResult> {
		const req = task.pendingDueRequest;
		if (!req) return { ok: false, cancelled: true, conflict: null, message: null };
		return dueRequestCall(
			() => service.cancelDueRequest(task.id, req.id),
			`Đã huỷ phiếu xin dời hạn ${task.code}`,
			`Đã huỷ phiếu xin dời hạn ${task.title}.`,
		);
	}

	return {
		dialog,
		busy,
		liveMessage,
		externalChange,
		runAction,
		moveTask,
		changeDue,
		reassign,
		updateFields,
		requestDue,
		approveDueRequest,
		rejectDueRequest,
		cancelDueRequest,
		reportError,
		announce,
	};
}

/** Trạng thái đích của một thao tác, để menu ghi "Chuyển sang …". */
export function actionTargetLabel(action: TaskAction): string {
	return STATUS_LABELS[ACTION_TARGET[action] as TaskStatus];
}
