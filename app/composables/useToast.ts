export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
	id: string;
	type: ToastType;
	message: string;
}

const toasts = ref<Toast[]>([]);

export function useToast() {
	function remove(id: string) {
		toasts.value = toasts.value.filter(t => t.id !== id);
	}

	function add(type: ToastType, message: string, duration = 3000) {
		const id = `${Date.now()}-${Math.random()}`;
		toasts.value.push({ id, type, message });
		if (duration > 0) {
			setTimeout(() => remove(id), duration);
		}
	}

	return {
		toasts: readonly(toasts),
		success: (msg: string) => add('success', msg),
		error: (msg: string) => add('error', msg),
		info: (msg: string) => add('info', msg),
		warning: (msg: string) => add('warning', msg),
		remove,
	};
}
