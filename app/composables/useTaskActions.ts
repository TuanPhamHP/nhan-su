import { useTasksService } from '~/services/tasks.service';
import type {
	MoveTaskBody,
	TaskAction,
	TaskConflictSnapshot,
	TaskDetail,
	TaskListItem,
	TaskStatus,
} from '~/types/tasks.types';
import { ACTION_LABELS, ACTION_TARGET, STATUS_LABELS, actionNeedsDialog, taskErrorInfo } from '~/utils/tasks.utils';

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
	| { kind: 'reassign'; task: TaskListItem; resolve: (v: TaskDialogResult | null) => void };

export interface TaskDialogResult {
	reason?: string;
	qualityScore?: number;
	dueDate?: string;
	assigneeId?: number;
}

export type TaskActionResult =
	| { ok: true; task: TaskDetail }
	| { ok: false; cancelled: boolean; conflict: TaskConflictSnapshot | null; message: string | null };

const dialog = ref<TaskDialogRequest | null>(null);
const busy = ref(false);
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

	/** Chuyển trạng thái bằng nút hoặc menu. Thao tác cần lý do hay điểm thì mở hộp trước. */
	async function runAction(task: TaskListItem, action: TaskAction): Promise<TaskActionResult> {
		let extra: TaskDialogResult = {};
		if (actionNeedsDialog(action)) {
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
			toast.success(`${ACTION_LABELS[action]}: ${task.code}`);
			return done(updated, `Đã chuyển ${task.title} sang ${updated.statusLabel}.`);
		} catch (err) {
			return { ok: false, cancelled: false, ...reportError(err) };
		} finally {
			busy.value = false;
		}
	}

	/**
	 * Kéo thẻ sang cột khác hoặc đổi thứ tự. Cột cần lý do (Trả lại, Mở lại, Huỷ) hay cột Hoàn thành
	 * của người nghiệm thu thì mở hộp tại chỗ; bấm Huỷ trong hộp thì trả về `cancelled` để thẻ về chỗ cũ.
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
			if (rule.action && actionNeedsDialog(rule.action)) {
				const answer = await openDialog<'transition'>({ kind: 'transition', task, action: rule.action });
				if (!answer) return { ok: false, cancelled: true, conflict: null, message: null };
				Object.assign(extra, answer);
			}
		}
		busy.value = true;
		try {
			const updated = await service.move(task.id, { ...body, version: task.version, ...extra });
			const where = toStatus && toStatus !== task.status ? `sang ${updated.statusLabel}` : 'trong cột';
			return done(updated, `Đã chuyển ${task.title} ${where}.`);
		} catch (err) {
			return { ok: false, cancelled: false, ...reportError(err) };
		} finally {
			busy.value = false;
		}
	}

	/** Đổi hạn: luôn qua hộp có ô lý do bắt buộc (F-04). */
	async function changeDue(task: TaskListItem, presetDate?: string): Promise<TaskActionResult> {
		const answer = await openDialog<'due'>({ kind: 'due', task, presetDate });
		if (!answer?.dueDate || !answer.reason) return { ok: false, cancelled: true, conflict: null, message: null };
		busy.value = true;
		try {
			const updated = await service.changeDue(task.id, {
				dueDate: answer.dueDate,
				reason: answer.reason,
				version: task.version,
			});
			toast.success(`Đã đổi hạn ${task.code}`);
			return done(updated, `Đã đổi hạn ${task.title}.`);
		} catch (err) {
			return { ok: false, cancelled: false, ...reportError(err) };
		} finally {
			busy.value = false;
		}
	}

	/** Đổi người thực hiện bằng hộp chọn người (từ menu ba chấm). */
	async function reassign(task: TaskListItem): Promise<TaskActionResult> {
		const answer = await openDialog<'reassign'>({ kind: 'reassign', task });
		if (!answer?.assigneeId) return { ok: false, cancelled: true, conflict: null, message: null };
		return updateFields(task, { assigneeId: answer.assigneeId });
	}

	/** Sửa trên ô (ưu tiên, người thực hiện, tiêu đề...): gửi kèm `version` đang hiện. */
	async function updateFields(
		task: TaskListItem,
		fields: {
			title?: string;
			description?: string;
			priority?: TaskListItem['priority'];
			points?: number;
			startDate?: string;
			assigneeId?: number;
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

	return { dialog, busy, liveMessage, runAction, moveTask, changeDue, reassign, updateFields, reportError, announce };
}

/** Trạng thái đích của một thao tác, để menu ghi "Chuyển sang …". */
export function actionTargetLabel(action: TaskAction): string {
	return STATUS_LABELS[ACTION_TARGET[action] as TaskStatus];
}
