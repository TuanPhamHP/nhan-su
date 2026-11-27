<script setup lang="ts">
	import TaskEmptyState from '~/components/modules/tasks/TaskEmptyState.vue';
	import TaskStatusBadge from '~/components/modules/tasks/TaskStatusBadge.vue';
	import { useTasksService } from '~/services/tasks.service';
	import type { TaskListItem, TaskListQuery, TaskStatus, TaskTimeline } from '~/types/tasks.types';
	import {
		DAY_WIDTH,
		SCALE_LABELS,
		timelineAddDays,
		diffDays,
		dragDays,
		shiftAnchor,
		tasksByDue,
		timelineBar,
		timelineProgress,
		timelineSections,
		timelineTicks,
		timelineWindow,
		type TimelineScale,
	} from '~/utils/task-timeline';
	import { DUE_TONE_CLASS, TASK_HINTS, dueTone, shortDate, taskDueText, taskErrorInfo, vnToday } from '~/utils/tasks.utils';

	/**
	 * Biểu đồ tiến độ kiểu Gantt (mục 9.2), tự vẽ theo cách màn đặt phòng họp, không thêm thư viện.
	 *
	 * Bên trái là bảng Việc, Người làm, Hạn; bên phải mỗi việc một thanh. Thanh đi từ ngày bắt đầu (không có
	 * thì từ ngày tạo việc) tới hạn (không có hạn thì tới hôm nay, đuôi mờ dần); màu theo trạng thái, phần đậm
	 * là phần đã xong theo mục kiểm tra và việc phụ; tên việc ghi ngay sau thanh. Vạch mảnh ở hạn ban đầu
	 * khi đã đổi hạn, vạch Hôm nay, thang Ngày, Tuần, Tháng, gom theo nhóm việc.
	 *
	 * Kéo đầu phải thanh hay kéo cả thanh thì mở hộp Đổi hạn có lý do với hạn mới điền sẵn; tay cầm chỉ
	 * hiện khi máy chủ cho `permissions.changeDue`. Kéo chấm tròn ở cuối thanh A thả lên thanh B để nối
	 * "B chờ A"; đường nối đỏ khi việc trước trễ. Màn hẹp thay biểu đồ bằng danh sách theo hạn.
	 */
	const props = withDefaults(
		defineProps<{
			/** Bộ lọc đang dùng (phần cố định của trang cộng thanh lọc). */
			query: TaskListQuery;
			taskGroups?: Array<{ id: number; name: string }>;
			readOnly?: boolean;
			/** Được nối phụ thuộc bằng kéo chấm (thành viên dự án; máy chủ vẫn kiểm từng lần). */
			canLink?: boolean;
			activeCode?: string | null;
		}>(),
		{ taskGroups: () => [], readOnly: false, canLink: false, activeCode: null },
	);
	const emit = defineEmits<{ open: [task: TaskListItem]; changed: [] }>();

	const service = useTasksService();
	const actions = useTaskActions();
	const toast = useToast();
	const today = vnToday();

	/**
	 * Thang, kỳ đang xem và cách gom nằm trên đường dẫn để tải lại hay gửi cho đồng nghiệp vẫn đúng màn:
	 * `scale` (bỏ khi là Ngày), `date` là ngày neo (bỏ khi là hôm nay), `byGroup=0` khi tắt Theo nhóm việc.
	 * Đường dẫn không có `scale` thì dùng thang nhớ trong trình duyệt như trước.
	 */
	const route = useRoute();
	const router = useRouter();
	const SCALE_KEY = 'tasks-timeline-scale';
	const SCALES: TimelineScale[] = ['day', 'week', 'month'];
	const savedScale = ref<TimelineScale>('day');
	/** Mỗi lần ghi kèm luôn thang đang thấy, kể cả thang lấy từ bản nhớ. */
	function setQuery(patch: Record<string, string | undefined>) {
		router.replace({ query: { ...route.query, scale: scale.value === 'day' ? undefined : scale.value, ...patch } });
	}
	const scale = computed<TimelineScale>(() => {
		const v = String(route.query.scale ?? '') as TimelineScale;
		return SCALES.includes(v) ? v : savedScale.value;
	});
	const anchor = computed<string>({
		get: () => {
			const v = String(route.query.date ?? '');
			return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : today;
		},
		set: v => setQuery({ date: v === today ? undefined : v }),
	});
	const byGroup = computed<boolean>({
		get: () => route.query.byGroup !== '0',
		set: v => setQuery({ byGroup: v ? undefined : '0' }),
	});
	const data = ref<TaskTimeline | null>(null);
	const loading = ref(true);
	const loadError = ref('');
	const narrow = ref(false);

	const range = computed(() => timelineWindow(scale.value, anchor.value));
	const dw = computed(() => DAY_WIDTH[scale.value]);
	const totalDays = computed(() => diffDays(range.value.to, range.value.from) + 1);
	const trackWidth = computed(() => totalDays.value * dw.value);
	const ticks = computed(() => timelineTicks(range.value.from, range.value.to, scale.value));
	const todayLeft = computed(() => {
		const i = diffDays(today, range.value.from);
		return i >= 0 && i < totalDays.value ? i * dw.value + dw.value / 2 : null;
	});

	let seq = 0;
	async function load(silent = false) {
		const my = ++seq;
		if (!silent) loading.value = true;
		loadError.value = '';
		try {
			const res = await service.timeline({ ...props.query, ...range.value });
			if (my === seq) data.value = res;
		} catch (err) {
			if (my === seq && !silent) loadError.value = taskErrorInfo(err, 'Chưa tải được biểu đồ tiến độ.').message;
		} finally {
			if (my === seq) loading.value = false;
		}
	}

	let mql: MediaQueryList | null = null;
	function onMql() {
		narrow.value = !!mql?.matches;
	}
	onMounted(() => {
		try {
			const saved = localStorage.getItem(SCALE_KEY) as TimelineScale | null;
			if (saved && SCALES.includes(saved)) savedScale.value = saved;
		} catch {
			// bộ nhớ bị chặn
		}
		// Thang nhớ khác Ngày mà đường dẫn chưa có: ghi lên để đường dẫn gửi đi đúng màn đang thấy. Chờ một
		// nhịp để thanh lọc ghi đường dẫn xong trước, hai lần ghi chồng nhau thì lần sau đè mất lần trước.
		scaleTimer = setTimeout(() => {
			if (route.query.scale === undefined && savedScale.value !== 'day') setQuery({});
		}, 0);
		mql = window.matchMedia('(max-width: 639px)');
		onMql();
		mql.addEventListener('change', onMql);
		load();
	});
	let scaleTimer: ReturnType<typeof setTimeout> | null = null;
	onBeforeUnmount(() => {
		mql?.removeEventListener('change', onMql);
		if (scaleTimer) clearTimeout(scaleTimer);
	});
	watch(
		() => [JSON.stringify(props.query), scale.value, anchor.value],
		() => load(),
	);
	function setScale(s: TimelineScale) {
		savedScale.value = s;
		setQuery({ scale: s === 'day' ? undefined : s });
		try {
			localStorage.setItem(SCALE_KEY, s);
		} catch {
			// bỏ qua
		}
	}

	// ─── Bố cục dòng ─────────────────────────────────────────────────────────
	const ROW_H = 40;
	const SECTION_H = 28;
	const HEAD_H = 48;

	/** Việc nằm hẳn ngoài khoảng đang xem thì không có dòng. */
	const shownTasks = computed<TaskListItem[]>(() => (data.value?.tasks ?? []).filter(t => !bar(t).hidden));
	const hasGroups = computed(() => shownTasks.value.some(t => t.group));
	const sections = computed(() => timelineSections(shownTasks.value, byGroup.value && hasGroups.value, props.taskGroups));

	interface RowLayout {
		task: TaskListItem;
		/** Toạ độ dọc của tâm dòng tính từ đầu thân biểu đồ. */
		cy: number;
	}
	const rowLayout = computed(() => {
		const map = new Map<number, RowLayout>();
		let y = 0;
		for (const sec of sections.value) {
			if (sec.label) y += SECTION_H;
			for (const t of sec.tasks) {
				map.set(t.id, { task: t, cy: y + ROW_H / 2 });
				y += ROW_H;
			}
		}
		return { map, height: y };
	});

	function bar(t: TaskListItem) {
		return timelineBar(t, range.value.from, range.value.to, dw.value, today);
	}

	/** Thanh: nền nhạt cả quãng, phần đã xong tô đậm cùng tông, cùng bảng màu với nhãn trạng thái. */
	const STATUS_BAR: Record<TaskStatus, { track: string; fill: string }> = {
		TODO: { track: 'bg-slate-200 dark:bg-slate-700', fill: 'bg-slate-400' },
		IN_PROGRESS: { track: 'bg-blue-200 dark:bg-blue-900/70', fill: 'bg-blue-500' },
		IN_REVIEW: { track: 'bg-violet-200 dark:bg-violet-900/70', fill: 'bg-violet-500' },
		DONE: { track: 'bg-emerald-200 dark:bg-emerald-900/70', fill: 'bg-emerald-500' },
		CANCELLED: { track: 'bg-gray-200 dark:bg-gray-700', fill: 'bg-gray-300 dark:bg-gray-600' },
	};

	function barTitle(t: TaskListItem): string {
		const b = bar(t);
		const from = b.impliedStart ? `tạo ngày ${shortDate(b.start, today)}` : `từ ${shortDate(b.start, today)}`;
		const to = b.openEnd ? 'chưa có hạn' : `hạn ${shortDate(b.end, today)}`;
		const pct = Math.round(timelineProgress(t) * 100);
		return `${t.code} ${t.title}: ${from}, ${to}, ${t.statusLabel}${pct && t.status !== 'DONE' ? `, xong ${pct}%` : ''}`;
	}

	/** Tên việc ghi ngay sau thanh (chừa chỗ cho chấm nối khi có). */
	function labelLeft(t: TaskListItem): number {
		const b = bar(t);
		return b.left + b.width + (props.canLink && !props.readOnly ? 22 : 8);
	}

	// ─── Đường nối phụ thuộc ─────────────────────────────────────────────────
	const linkPaths = computed(() => {
		const out: Array<{ key: string; d: string; late: boolean; label: string }> = [];
		const { map } = rowLayout.value;
		for (const l of data.value?.links ?? []) {
			const a = map.get(l.blockerId);
			const b = map.get(l.blockedId);
			if (!a || !b) continue;
			const ba = bar(a.task);
			const bb = bar(b.task);
			const x1 = ba.left + ba.width;
			const x2 = bb.left;
			const y1 = a.cy;
			const y2 = b.cy;
			let d: string;
			if (x2 - x1 >= 24) {
				// Việc sau bắt đầu sau khi việc trước hết hạn: một đường cong mềm.
				const bend = Math.max(12, (x2 - x1) / 2);
				d = `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2 - 2} ${y2}`;
			} else {
				// Việc sau bắt đầu trước khi việc trước xong (đang chồng nhau, thường là đường đỏ): đi vòng
				// qua mép dòng để không cắt ngang thanh.
				const ym = y2 > y1 ? y2 - ROW_H / 2 : y2 + ROW_H / 2;
				d = `M ${x1} ${y1} h 10 V ${ym} H ${x2 - 10} V ${y2} H ${x2 - 2}`;
			}
			out.push({
				key: `${l.blockerId}-${l.blockedId}`,
				d,
				late: l.late,
				label: `${b.task.code} chờ ${a.task.code}${l.late ? ', việc trước đang trễ' : ''}`,
			});
		}
		return out;
	});

	// ─── Kéo thanh để đổi hạn ───────────────────────────────────────────────
	interface DueDrag {
		task: TaskListItem;
		kind: 'move' | 'resize';
		startX: number;
		dx: number;
		moved: boolean;
	}
	const drag = ref<DueDrag | null>(null);

	/** Kéo thanh đổi hạn: chỉ việc đã có hạn (việc chưa có hạn thì đặt hạn trong khung chi tiết). */
	function canChangeDue(t: TaskListItem): boolean {
		return !props.readOnly && !!t.dueDate && t.permissions.changeDue && t.status !== 'DONE' && t.status !== 'CANCELLED';
	}

	function onBarDown(e: PointerEvent, t: TaskListItem, kind: 'move' | 'resize') {
		if (e.button !== 0) return;
		if (!canChangeDue(t)) return;
		e.stopPropagation();
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		drag.value = { task: t, kind, startX: e.clientX, dx: 0, moved: false };
	}
	function onBarMove(e: PointerEvent) {
		const d = drag.value;
		if (!d) return;
		d.dx = e.clientX - d.startX;
		if (Math.abs(d.dx) > 4) d.moved = true;
	}
	const dragDaysNow = computed(() => (drag.value ? dragDays(drag.value.dx, dw.value) : 0));
	const dragPreview = computed(() => {
		const d = drag.value;
		if (!d || !d.moved || !d.task.dueDate) return null;
		let due = timelineAddDays(d.task.dueDate, dragDaysNow.value);
		if (d.kind === 'resize' && d.task.startDate && due < d.task.startDate) due = d.task.startDate;
		return { id: d.task.id, due };
	});
	async function onBarUp(t: TaskListItem) {
		const d = drag.value;
		drag.value = null;
		if (!d) return;
		if (!d.moved) {
			emit('open', t);
			return;
		}
		const days = dragDays(d.dx, dw.value);
		if (!days || !t.dueDate) return;
		let due = timelineAddDays(t.dueDate, days);
		if (d.kind === 'resize' && t.startDate && due < t.startDate) due = t.startDate;
		const result = await actions.changeDue(t, due);
		if (result.ok) {
			emit('changed');
			load(true);
		} else if (result.conflict) load(true);
	}

	/** Độ lệch đang kéo của một thanh, để thanh đi theo chuột trước khi thả. */
	function barStyle(t: TaskListItem) {
		const b = bar(t);
		const d = drag.value;
		let left = b.left;
		let width = b.width;
		if (d && d.task.id === t.id && d.moved) {
			const px = dragDaysNow.value * dw.value;
			if (d.kind === 'move') left += px;
			else width = Math.max(dw.value, width + px);
		}
		return { left: `${left}px`, width: `${width}px` };
	}

	// ─── Kéo chấm để nối phụ thuộc ──────────────────────────────────────────
	const bodyRef = ref<HTMLElement | null>(null);
	const linking = ref<{ from: TaskListItem; x1: number; y1: number; x2: number; y2: number; overId: number | null } | null>(null);

	function localPoint(e: PointerEvent): { x: number; y: number } {
		const rect = bodyRef.value?.getBoundingClientRect();
		return { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) };
	}
	function onLinkDown(e: PointerEvent, t: TaskListItem) {
		if (e.button !== 0) return;
		e.stopPropagation();
		e.preventDefault();
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		const b = bar(t);
		const cy = rowLayout.value.map.get(t.id)?.cy ?? 0;
		const p = localPoint(e);
		linking.value = { from: t, x1: b.left + b.width, y1: cy, x2: p.x, y2: p.y, overId: null };
	}
	function targetIdAt(e: PointerEvent): number | null {
		const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-timeline-task]');
		return el ? Number(el.dataset.timelineTask) : null;
	}
	function onLinkMove(e: PointerEvent) {
		const l = linking.value;
		if (!l) return;
		const p = localPoint(e);
		l.x2 = p.x;
		l.y2 = p.y;
		const id = targetIdAt(e);
		l.overId = id && id !== l.from.id ? id : null;
	}
	async function onLinkUp(e: PointerEvent) {
		const l = linking.value;
		linking.value = null;
		if (!l) return;
		const id = targetIdAt(e);
		if (!id || id === l.from.id) return;
		const target = rowLayout.value.map.get(id)?.task;
		try {
			await service.addDependency(id, l.from.id);
			toast.success(`${target?.code ?? 'Việc'} chờ ${l.from.code}`);
			actions.announce(`Đã nối: ${target?.title ?? ''} chờ ${l.from.title}.`);
			emit('changed');
			load(true);
		} catch (err) {
			toast.error(taskErrorInfo(err).message);
		}
	}

	function rangeText() {
		return `${shortDate(range.value.from, today)} tới ${shortDate(range.value.to, today)}`;
	}

	defineExpose({ reload: () => load(true) });
</script>

<template>
	<div class="space-y-2" data-testid="task-timeline">
		<!-- Thanh công cụ: lùi, tới, thang -->
		<div class="flex flex-wrap items-center gap-2 text-sm">
			<div class="flex items-center gap-1">
				<button
					type="button"
					class="rounded-md border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
					aria-label="Lùi lại"
					@click="anchor = shiftAnchor(scale, anchor, -1)"
				>
					<Icon name="heroicons:chevron-left" class="h-4 w-4" />
				</button>
				<button
					type="button"
					class="rounded-md border border-gray-200 px-2.5 py-1 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
					@click="anchor = today"
				>
					Hôm nay
				</button>
				<button
					type="button"
					class="rounded-md border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
					aria-label="Tới"
					@click="anchor = shiftAnchor(scale, anchor, 1)"
				>
					<Icon name="heroicons:chevron-right" class="h-4 w-4" />
				</button>
				<span class="ml-1 text-gray-600 dark:text-gray-300" data-testid="timeline-range">{{ rangeText() }}</span>
			</div>
			<div v-if="!narrow" class="ml-auto flex items-center gap-3">
				<label v-if="hasGroups" class="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
					<input v-model="byGroup" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
					Theo nhóm việc
				</label>
				<div class="flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800" role="radiogroup" aria-label="Thang thời gian">
					<button
						v-for="s in (['day', 'week', 'month'] as const)"
						:key="s"
						type="button"
						role="radio"
						:aria-checked="scale === s"
						class="rounded-md px-2.5 py-1 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
						:class="scale === s ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'"
						:data-testid="`timeline-scale-${s}`"
						@click="setScale(s)"
					>
						{{ SCALE_LABELS[s] }}
					</button>
				</div>
			</div>
		</div>

		<p v-if="data?.truncated" class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
			Khoảng này có hơn 500 việc nên chỉ vẽ 500 việc đầu. Bạn lọc hẹp hơn để xem đủ.
		</p>

		<div v-if="loading" class="h-72 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" aria-busy="true" />
		<TaskEmptyState v-else-if="loadError" kind="error" title="Chưa tải được biểu đồ tiến độ" :description="loadError" action-label="Thử lại" @action="load()" />
		<TaskEmptyState
			v-else-if="!shownTasks.length"
			kind="filtered"
			title="Không có việc nào trong khoảng này"
			description="Bạn lùi, tới, đổi thang thời gian hoặc bớt bộ lọc."
		/>

		<!-- Màn hẹp: danh sách theo hạn thay cho biểu đồ -->
		<div v-else-if="narrow" class="space-y-3" data-testid="timeline-narrow-list">
			<p class="text-xs text-gray-500 dark:text-gray-400">Màn hình hẹp nên việc xếp theo hạn. Xoay ngang hoặc mở trên máy tính để xem biểu đồ.</p>
			<section v-for="[day, list] in tasksByDue(shownTasks)" :key="day" class="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
				<h3 class="border-b border-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 dark:border-gray-800 dark:text-gray-200">
					Hạn {{ shortDate(day, today) }}
				</h3>
				<ul class="divide-y divide-gray-100 dark:divide-gray-800">
					<li v-for="t in list" :key="t.id">
						<button type="button" class="flex w-full items-center gap-2 px-3 py-2 text-left" @click="emit('open', t)">
							<span v-if="t.dependencies.late" class="h-2 w-2 shrink-0 rounded-full bg-rose-500" title="Phải chờ việc khác đang trễ hạn" />
							<span class="min-w-0 flex-1">
								<span class="block truncate text-sm text-gray-900 dark:text-gray-100">{{ t.title }}</span>
								<span class="text-xs text-gray-500">{{ t.code }} · {{ t.assignee.fullName }}<template v-if="t.startDate"> · từ {{ shortDate(t.startDate, today) }}</template></span>
							</span>
							<TaskStatusBadge :status="t.status" :label="t.statusLabel" />
						</button>
					</li>
				</ul>
			</section>
		</div>

		<!-- Biểu đồ -->
		<div v-else class="flex overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900" data-tour="task-timeline">
			<!-- Bảng bên trái: Việc, Người làm, Hạn; không cuộn ngang -->
			<div class="w-56 shrink-0 border-r border-gray-200 sm:w-[22rem] dark:border-gray-700">
				<div
					class="grid grid-cols-[minmax(0,1fr)_2rem] items-end gap-2 border-b border-gray-200 px-3 pb-1.5 text-xs font-medium text-gray-500 sm:grid-cols-[minmax(0,1fr)_2rem_5.5rem] dark:border-gray-700 dark:text-gray-400"
					:style="{ height: `${HEAD_H}px` }"
				>
					<span>Việc</span>
					<span class="text-center" title="Người thực hiện">Người</span>
					<span class="hidden sm:block">Hạn</span>
				</div>
				<template v-for="sec in sections" :key="sec.key">
					<div
						v-if="sec.label"
						class="flex items-center truncate bg-gray-50 px-3 text-xs font-semibold text-gray-700 dark:bg-gray-800/60 dark:text-gray-200"
						:style="{ height: `${SECTION_H}px` }"
					>
						{{ sec.label }} <span class="ml-1 font-normal text-gray-500">{{ sec.tasks.length }}</span>
					</div>
					<button
						v-for="t in sec.tasks"
						:key="t.id"
						type="button"
						class="grid w-full grid-cols-[minmax(0,1fr)_2rem] items-center gap-2 border-b border-gray-100 px-3 text-left text-xs hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500 sm:grid-cols-[minmax(0,1fr)_2rem_5.5rem] dark:border-gray-800/60 dark:hover:bg-gray-800/40"
						:class="activeCode === t.code ? 'bg-brand-50/70 dark:bg-brand-900/20' : ''"
						:style="{ height: `${ROW_H}px` }"
						:title="`${t.code} ${t.title}`"
						@click="emit('open', t)"
					>
						<span class="flex min-w-0 items-center gap-1.5">
							<span
								v-if="t.dependencies.late"
								class="h-2 w-2 shrink-0 rounded-full bg-rose-500"
								title="Đang chờ một việc bị trễ"
								data-testid="timeline-late-dot"
							/>
							<span class="shrink-0 font-medium text-gray-500">{{ t.code }}</span>
							<span class="truncate text-gray-800 dark:text-gray-200" :class="t.status === 'DONE' || t.status === 'CANCELLED' ? 'text-gray-400 line-through dark:text-gray-500' : ''">{{ t.title }}</span>
						</span>
						<CommonAppAvatar :src="t.assignee.avatarUrl" :name="t.assignee.fullName" size="xs" :title="t.assignee.fullName" class="justify-self-center" />
						<span class="hidden truncate sm:block" :class="DUE_TONE_CLASS[dueTone(t, today)]">{{ taskDueText(t, today) }}</span>
					</button>
				</template>
			</div>

			<!-- Trục thời gian: cuộn ngang -->
			<div class="min-w-0 flex-1 overflow-x-auto">
				<div class="relative" :style="{ width: `${trackWidth}px` }">
					<div class="relative border-b border-gray-200 text-[11px] text-gray-500 dark:border-gray-700 dark:text-gray-400" :style="{ height: `${HEAD_H}px` }">
						<div
							v-for="m in ticks.months"
							:key="m.left"
							class="absolute top-0 flex h-6 items-center truncate border-l border-gray-200 px-1.5 font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200"
							:style="{ left: `${m.left}px`, width: `${m.width}px` }"
						>
							{{ m.label }}
						</div>
						<div
							v-for="m in ticks.minor"
							:key="`n${m.left}`"
							class="absolute top-6 flex h-6 items-center justify-center border-l border-gray-100 dark:border-gray-800"
							:class="m.weekend ? 'text-gray-400 dark:text-gray-600' : ''"
							:style="{ left: `${m.left}px`, width: `${m.width}px` }"
						>
							{{ m.label }}
						</div>
						<span
							v-if="todayLeft != null"
							class="absolute bottom-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-t bg-orange-500 px-1 text-[10px] font-medium leading-4 text-white"
							:style="{ left: `${todayLeft}px` }"
						>
							Hôm nay
						</span>
					</div>

					<div
						ref="bodyRef"
						class="relative"
						:style="{ height: `${rowLayout.height}px` }"
						@pointermove="onLinkMove"
					>
						<!-- Nền cuối tuần (thang Ngày) -->
						<template v-if="scale === 'day'">
							<div
								v-for="m in ticks.minor.filter(x => x.weekend)"
								:key="`w${m.left}`"
								class="pointer-events-none absolute inset-y-0 bg-gray-50 dark:bg-gray-800/40"
								:style="{ left: `${m.left}px`, width: `${m.width}px` }"
							/>
						</template>
						<!-- Vạch Hôm nay -->
						<div
							v-if="todayLeft != null"
							class="pointer-events-none absolute inset-y-0 z-10 w-px bg-orange-500"
							:style="{ left: `${todayLeft}px` }"
							data-testid="timeline-today"
						/>

						<template v-for="sec in sections" :key="sec.key">
							<div v-if="sec.label" class="bg-gray-50/70 dark:bg-gray-800/40" :style="{ height: `${SECTION_H}px` }" />
							<div
								v-for="t in sec.tasks"
								:key="t.id"
								class="relative border-b border-gray-50 dark:border-gray-800/60"
								:class="linking?.overId === t.id ? 'bg-brand-50 dark:bg-brand-900/30' : ''"
								:style="{ height: `${ROW_H}px` }"
								:data-timeline-task="t.id"
							>
								<!-- Vạch hạn ban đầu -->
								<span
									v-if="bar(t).originalLeft != null"
									class="pointer-events-none absolute top-1.5 h-6 w-0.5 rounded bg-amber-500/80"
									:style="{ left: `${bar(t).originalLeft! - 1}px` }"
									:title="`Hạn ban đầu ${shortDate(t.originalDueDate, today)}`"
									data-testid="timeline-original-due"
								/>
								<!-- Thanh -->
								<div
									class="group absolute top-[11px] flex h-[18px] items-center"
									:class="canChangeDue(t) ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'"
									:style="barStyle(t)"
									:data-testid="`timeline-bar-${t.code}`"
									role="button"
									tabindex="0"
									:title="barTitle(t)"
									:aria-label="barTitle(t)"
									@pointerdown="e => onBarDown(e, t, 'move')"
									@pointermove="onBarMove"
									@pointerup="onBarUp(t)"
									@pointercancel="drag = null"
									@click.self="!canChangeDue(t) && emit('open', t)"
									@keydown.enter.prevent="emit('open', t)"
								>
									<span
										class="pointer-events-none relative block h-full w-full overflow-hidden"
										:class="[
											STATUS_BAR[t.status].track,
											t.overdue ? 'ring-2 ring-rose-500' : '',
											bar(t).clippedStart ? 'rounded-r-md' : bar(t).clippedEnd || bar(t).openEnd ? 'rounded-l-md' : 'rounded-md',
											bar(t).openEnd ? '[mask-image:linear-gradient(to_right,#000_55%,transparent)]' : '',
										]"
									>
										<span class="absolute inset-y-0 left-0" :class="STATUS_BAR[t.status].fill" :style="{ width: `${timelineProgress(t) * 100}%` }" />
									</span>
									<!-- Tay cầm kéo hạn -->
									<span
										v-if="canChangeDue(t) && !bar(t).clippedEnd"
										class="absolute -right-1 top-0 h-[18px] w-2.5 cursor-ew-resize rounded-sm bg-white/90 opacity-0 shadow ring-1 ring-gray-300 transition-opacity group-hover:opacity-100 dark:bg-gray-200"
										:data-testid="`timeline-handle-${t.code}`"
										title="Kéo để đổi hạn"
										@pointerdown="e => onBarDown(e, t, 'resize')"
									/>
									<!-- Chấm nối phụ thuộc: chỉ hiện khi rê chuột vào thanh -->
									<span
										v-if="canLink && !readOnly && t.status !== 'CANCELLED'"
										class="absolute -right-4 top-[3px] h-3 w-3 cursor-crosshair rounded-full border-2 border-brand-500 bg-white opacity-0 transition-opacity hover:opacity-100 focus:opacity-100 group-hover:opacity-100 dark:bg-gray-900"
										:data-testid="`timeline-link-${t.code}`"
										title="Kéo chấm này thả lên việc khác: việc đó sẽ chờ việc này"
										@pointerdown="e => onLinkDown(e, t)"
										@pointermove="onLinkMove"
										@pointerup="onLinkUp"
									/>
								</div>
								<!-- Tên việc ngay sau thanh -->
								<span
									class="pointer-events-none absolute top-0 flex h-full max-w-[18rem] items-center truncate whitespace-nowrap text-xs text-gray-700 dark:text-gray-300"
									:style="{ left: `${labelLeft(t)}px` }"
									aria-hidden="true"
								>
									<span class="truncate">{{ t.title }}</span>
									<span v-if="t.checklist.total + t.subtasks.total && t.status !== 'DONE'" class="ml-1 shrink-0 text-gray-400">
										{{ Math.round(timelineProgress(t) * 100) }}%
									</span>
								</span>
								<!-- Hạn mới khi đang kéo -->
								<span
									v-if="dragPreview?.id === t.id"
									class="pointer-events-none absolute -top-1 z-20 whitespace-nowrap rounded bg-gray-900 px-1.5 py-0.5 text-[11px] text-white"
									:style="{ left: `${bar(t).left + bar(t).width + dragDaysNow * dw + 8}px` }"
								>
									Hạn mới {{ shortDate(dragPreview.due, today) }}
								</span>
							</div>
						</template>

						<!-- Đường nối -->
						<svg class="pointer-events-none absolute inset-0 z-[5]" :width="trackWidth" :height="rowLayout.height" aria-hidden="true">
							<defs>
								<marker id="tl-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
									<path d="M0,0 L8,4 L0,8 z" fill="#9ca3af" />
								</marker>
								<marker id="tl-arrow-late" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
									<path d="M0,0 L8,4 L0,8 z" fill="#e11d48" />
								</marker>
							</defs>
							<path
								v-for="p in linkPaths"
								:key="p.key"
								:d="p.d"
								fill="none"
								:stroke="p.late ? '#e11d48' : '#9ca3af'"
								stroke-width="1.5"
								:marker-end="p.late ? 'url(#tl-arrow-late)' : 'url(#tl-arrow)'"
								:data-late="p.late ? '1' : '0'"
								data-testid="timeline-link"
							>
								<title>{{ p.label }}</title>
							</path>
							<line
								v-if="linking"
								:x1="linking.x1"
								:y1="linking.y1"
								:x2="linking.x2"
								:y2="linking.y2"
								stroke="#4f46e5"
								stroke-width="1.5"
								stroke-dasharray="4 3"
							/>
						</svg>
					</div>
				</div>
			</div>
		</div>

		<div v-if="shownTasks.length && !narrow" class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
			<span class="inline-flex items-center gap-1"><span class="h-2.5 w-4 rounded bg-slate-400" />Chưa làm</span>
			<span class="inline-flex items-center gap-1"><span class="h-2.5 w-4 rounded bg-blue-500" />Đang làm</span>
			<span class="inline-flex items-center gap-1"><span class="h-2.5 w-4 rounded bg-violet-500" />Chờ nghiệm thu</span>
			<span class="inline-flex items-center gap-1"><span class="h-2.5 w-4 rounded bg-emerald-500" />Hoàn thành</span>
			<span class="inline-flex items-center gap-1">
				<span class="flex h-2.5 w-6 overflow-hidden rounded bg-blue-200"><span class="w-1/2 bg-blue-500" /></span>Phần đậm là phần đã xong
			</span>
			<span class="inline-flex items-center gap-1">
				<span class="h-2.5 w-6 rounded-l bg-blue-300 [mask-image:linear-gradient(to_right,#000_40%,transparent)]" />Chưa có hạn
			</span>
			<span class="inline-flex items-center gap-1"><span class="h-3 w-0.5 rounded bg-amber-500" />Hạn ban đầu</span>
			<span class="inline-flex items-center gap-1"><span class="h-0.5 w-4 bg-rose-600" />Việc trước đang trễ</span>
			<span>Chưa có ngày bắt đầu thì thanh tính từ ngày tạo việc.</span>
			<span v-if="canLink && !readOnly" :title="TASK_HINTS.dependency">Rê chuột vào thanh, kéo chấm tròn ở cuối thả lên việc khác để nối.</span>
		</div>
	</div>
</template>
