export type ToastType = 'success' | 'error' | 'info' | 'warning';

/** Nút kèm toast, VD "Mở tài sản" ngay sau khi tạo. `to` là đường dẫn trong app. */
export interface ToastAction {
	label: string;
	to: string;
}

export interface Toast {
	id: string;
	type: ToastType;
	message: string;
	action?: ToastAction;
}

export interface ToastOptions {
	action?: ToastAction;
	/** Ghi đè thời gian hiện, tính bằng mili giây; `0` là ở lại tới khi người dùng đóng. */
	duration?: number;
}

/**
 * Thời gian hiện mặc định theo loại.
 *
 * Câu lỗi của BE thường dài hai câu, có cả bước làm tiếp, nên ba giây là không kịp đọc: toast
 * lỗi ở lại tám giây và vẫn có nút đóng. Toast thành công chỉ xác nhận việc vừa làm nên ba giây
 * là đủ; toast có nút bấm thì giữ lâu hơn để người dùng kịp bấm.
 */
const DURATION: Record<ToastType, number> = {
	success: 3000,
	info: 4000,
	warning: 6000,
	error: 8000,
};
const ACTION_MIN_DURATION = 8000;

const toasts = ref<Toast[]>([]);

export function useToast() {
	function remove(id: string) {
		toasts.value = toasts.value.filter(t => t.id !== id);
	}

	function add(type: ToastType, message: string, options: ToastOptions = {}) {
		const id = `${Date.now()}-${Math.random()}`;
		toasts.value.push({ id, type, message, action: options.action });
		const base = options.duration ?? DURATION[type];
		const duration = options.action && base > 0 ? Math.max(base, ACTION_MIN_DURATION) : base;
		if (duration > 0) {
			setTimeout(() => remove(id), duration);
		}
	}

	return {
		toasts: readonly(toasts),
		success: (msg: string, options?: ToastOptions) => add('success', msg, options),
		error: (msg: string, options?: ToastOptions) => add('error', msg, options),
		info: (msg: string, options?: ToastOptions) => add('info', msg, options),
		warning: (msg: string, options?: ToastOptions) => add('warning', msg, options),
		remove,
	};
}
