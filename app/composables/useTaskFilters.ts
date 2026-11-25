import type { TaskDueFilter, TaskListQuery } from '~/types/tasks.types';

/**
 * Bộ lọc, cách nhóm và chế độ xem của một màn công việc, nằm trên đường dẫn (mục 9.2): dán đường dẫn
 * cho đồng nghiệp là họ thấy đúng màn đó trong phạm vi quyền của họ. Lần cuối được nhớ trong trình
 * duyệt theo `storageKey` (mỗi dự án một khoá); vào lại mà đường dẫn trống thì dùng lần cuối. Nút Về
 * mặc định xoá cả hai.
 */
export interface TaskFilterState {
	mode: 'list' | 'board';
	q: string;
	status: string;
	due: '' | TaskDueFilter;
	priority: string;
	assignee: string;
	group: 'status' | 'assignee' | 'due' | 'none';
	cancelled: boolean;
}

const DEFAULTS: TaskFilterState = {
	mode: 'list',
	q: '',
	status: '',
	due: '',
	priority: '',
	assignee: '',
	group: 'status',
	cancelled: false,
};

const KEYS = Object.keys(DEFAULTS) as Array<keyof TaskFilterState>;

function fromQuery(query: Record<string, unknown>, base: TaskFilterState): TaskFilterState {
	const s = { ...base };
	for (const key of KEYS) {
		const raw = query[key];
		if (raw === undefined) continue;
		const v = Array.isArray(raw) ? String(raw[0] ?? '') : String(raw);
		if (key === 'cancelled') s.cancelled = v === '1';
		else (s as Record<string, unknown>)[key] = v;
	}
	if (s.mode !== 'list' && s.mode !== 'board') s.mode = base.mode;
	return s;
}

function toQuery(s: TaskFilterState, defaults: TaskFilterState): Record<string, string> {
	const q: Record<string, string> = {};
	for (const key of KEYS) {
		const v = s[key];
		if (v === defaults[key]) continue;
		q[key] = key === 'cancelled' ? (v ? '1' : '0') : String(v);
	}
	return q;
}

export function useTaskFilters(storageKey: () => string, overrides: Partial<TaskFilterState> = {}) {
	const route = useRoute();
	const router = useRouter();
	const defaults: TaskFilterState = { ...DEFAULTS, ...overrides };
	const state = reactive<TaskFilterState>({ ...defaults });

	function hasQuery(): boolean {
		return KEYS.some(k => route.query[k] !== undefined);
	}

	function init() {
		let base = { ...defaults };
		if (!hasQuery()) {
			try {
				const saved = localStorage.getItem(storageKey());
				if (saved) base = { ...base, ...(JSON.parse(saved) as Partial<TaskFilterState>) };
			} catch {
				// bỏ qua bản lưu hỏng
			}
		}
		Object.assign(state, fromQuery(route.query as Record<string, unknown>, base));
		sync();
	}

	function sync() {
		const query = { ...route.query, ...toQuery(state, defaults) };
		for (const k of KEYS) if (state[k] === defaults[k]) delete query[k];
		router.replace({ query });
		try {
			localStorage.setItem(storageKey(), JSON.stringify(state));
		} catch {
			// bộ nhớ bị chặn
		}
	}

	function reset() {
		Object.assign(state, defaults);
		try {
			localStorage.removeItem(storageKey());
		} catch {
			// bỏ qua
		}
		sync();
	}

	const isFiltered = computed(() => !!(state.q || state.status || state.due || state.priority || state.assignee));
	const isDefault = computed(() => KEYS.every(k => state[k] === defaults[k]));

	/** Phần bộ lọc gửi lên API (không gồm chế độ xem, cách nhóm). */
	const apiQuery = computed<TaskListQuery>(() => ({
		q: state.q.trim() || undefined,
		status: state.status || undefined,
		due: state.due || undefined,
		priority: state.priority || undefined,
		assigneeIds: state.assignee || undefined,
	}));

	watch(
		() => ({ ...state }),
		() => sync(),
		{ deep: true },
	);

	return { state, init, reset, isFiltered, isDefault, apiQuery, defaults };
}
