<script setup lang="ts">
	import TaskActionDialogHost from '~/components/modules/tasks/TaskActionDialogHost.vue';
	import TaskDetailPanel from '~/components/modules/tasks/TaskDetailPanel.vue';
	import TaskEmptyState from '~/components/modules/tasks/TaskEmptyState.vue';
	import TaskRecurrenceDetail from '~/components/modules/tasks/TaskRecurrenceDetail.vue';
	import TaskRecurrenceFormModal from '~/components/modules/tasks/TaskRecurrenceFormModal.vue';
	import { useTasksService } from '~/services/tasks.service';
	import { tasksRecurrenceTour } from '~/tours/tasks';
	import type { TaskRecurrence } from '~/types/tasks.types';
	import { recurrenceText, shortDate, taskErrorInfo, vnToday } from '~/utils/tasks.utils';

	/**
	 * UI-07 Việc định kỳ (F-11): quy tắc mình đặt, mình làm, mình nghiệm thu, và quy tắc của dự án mình
	 * làm quản lý (ADMIN, Giám đốc thấy hết). Tạo, sửa, dừng, chạy lại; lý do hệ thống tự dừng
	 * (`pausedReason`). Mở thẳng `?id=` (từ khung chi tiết việc) thì hiện khung của quy tắc đó.
	 */
	useHead({ title: 'Việc định kỳ' });

	const route = useRoute();
	const router = useRouter();
	const toast = useToast();
	const service = useTasksService();
	const { canUse, canWrite } = useModuleAccess();
	const readOnly = computed(() => !canWrite('TASKS'));
	const panel = useTaskPanel();
	panel.bindPage();
	const today = vnToday();

	type Filter = 'active' | 'paused' | 'all';
	const filter = computed<Filter>(() => {
		const f = String(route.query.status ?? 'active');
		return f === 'paused' || f === 'all' ? f : 'active';
	});
	function setFilter(f: Filter) {
		router.replace({ query: { ...route.query, status: f === 'active' ? undefined : f } });
	}

	const items = ref<TaskRecurrence[]>([]);
	const total = ref(0);
	const page = ref(1);
	const loading = ref(true);
	const loadingMore = ref(false);
	const loadError = ref('');

	async function load(more = false) {
		if (more) loadingMore.value = true;
		else loading.value = true;
		loadError.value = '';
		try {
			const next = more ? page.value + 1 : 1;
			const res = await service.listRecurrences({
				isActive: filter.value === 'all' ? undefined : filter.value === 'active',
				page: next,
				limit: 50,
			});
			items.value = more ? [...items.value, ...res.data] : res.data;
			total.value = res.meta.total;
			page.value = next;
		} catch (err) {
			loadError.value = taskErrorInfo(err, 'Chưa tải được việc định kỳ.').message;
		} finally {
			loading.value = false;
			loadingMore.value = false;
		}
	}
	watch(filter, () => load());

	// ─── Khung chi tiết theo `?id=` ─────────────────────────────────────────
	const selected = ref<TaskRecurrence | null>(null);
	async function openById(id: number) {
		const found = items.value.find(r => r.id === id);
		if (found) {
			selected.value = found;
			return;
		}
		try {
			selected.value = await service.getRecurrence(id);
		} catch (err) {
			toast.error(taskErrorInfo(err, 'Không mở được việc định kỳ này.').message);
			setSelectedQuery(null);
		}
	}
	function setSelectedQuery(id: number | null) {
		router.replace({ query: { ...route.query, id: id ? String(id) : undefined } });
	}
	function select(r: TaskRecurrence) {
		selected.value = r;
		setSelectedQuery(r.id);
	}
	function closeDetail() {
		selected.value = null;
		setSelectedQuery(null);
	}

	onMounted(async () => {
		if (!canUse('TASKS')) {
			loading.value = false;
			return;
		}
		await load();
		const id = Number(route.query.id);
		if (id) openById(id);
	});

	// ─── Tạo, sửa, dừng, chạy lại ───────────────────────────────────────────
	const showForm = ref(false);
	const editing = ref<TaskRecurrence | null>(null);
	function openCreate() {
		editing.value = null;
		showForm.value = true;
	}
	function openEdit(r: TaskRecurrence) {
		editing.value = r;
		showForm.value = true;
	}
	function replace(r: TaskRecurrence) {
		const i = items.value.findIndex(x => x.id === r.id);
		if (i >= 0) items.value.splice(i, 1, r);
		else items.value = [r, ...items.value];
		if (selected.value?.id === r.id) selected.value = r;
	}
	function onSaved(r: TaskRecurrence) {
		showForm.value = false;
		editing.value = null;
		replace(r);
		// Mở khung chi tiết để người đặt thấy ngay năm hạn sắp tới máy chủ vừa tính.
		select(r);
	}

	const busyId = ref<number | null>(null);
	async function pauseOrResume(r: TaskRecurrence) {
		busyId.value = r.id;
		try {
			const next = r.isActive ? await service.pauseRecurrence(r.id) : await service.resumeRecurrence(r.id);
			toast.success(r.isActive ? `Đã dừng ${r.title}` : `Đã chạy lại ${r.title}`);
			replace(next);
		} catch (err) {
			toast.error(taskErrorInfo(err).message);
		} finally {
			busyId.value = null;
		}
	}

	function openTask(code: string) {
		closeDetail();
		panel.open(code);
	}

	usePageTour(
		'tasks-recurrences',
		() => tasksRecurrenceTour({ canCreate: () => !readOnly.value, hasRows: () => items.value.length > 0 }),
		() => canUse('TASKS') && !loading.value && !loadError.value,
	);
</script>

<template>
	<div class="space-y-4 pb-24">
		<UiPageHeader
			title="Việc định kỳ"
			description="Việc lặp lại đều đặn như nộp báo cáo tháng, họp đầu tuần. Đặt một lần, mỗi kỳ hệ thống tự giao việc cho người làm và báo cho họ."
			tour="tasks-recurrences"
		>
			<CommonAppButton v-if="!readOnly" data-tour="task-recurrence-create" data-testid="recurrence-create" @click="openCreate">
				<Icon name="heroicons:plus" class="mr-1 h-4 w-4" />Đặt việc định kỳ
			</CommonAppButton>
		</UiPageHeader>
		<CommonAppModuleNotice module="TASKS" />

		<div class="flex rounded-lg bg-gray-100 p-0.5 text-sm sm:inline-flex dark:bg-gray-800" role="tablist" aria-label="Trạng thái">
			<button
				v-for="t in ([{ key: 'active', label: 'Đang chạy' }, { key: 'paused', label: 'Đã dừng' }, { key: 'all', label: 'Tất cả' }] as const)"
				:key="t.key"
				type="button"
				role="tab"
				:aria-selected="filter === t.key"
				class="flex-1 whitespace-nowrap rounded-md px-3 py-1.5 font-medium focus:outline-none sm:flex-none focus:ring-2 focus:ring-brand-500"
				:class="filter === t.key ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'"
				@click="setFilter(t.key)"
			>
				{{ t.label }}
			</button>
		</div>

		<div v-if="loading" class="space-y-2" aria-busy="true">
			<div v-for="i in 4" :key="i" class="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
		</div>
		<TaskEmptyState v-else-if="loadError" kind="error" title="Chưa tải được việc định kỳ" :description="loadError" action-label="Thử lại" @action="load()" />
		<TaskEmptyState
			v-else-if="!items.length && filter !== 'active'"
			kind="filtered"
			:title="filter === 'paused' ? 'Không có việc định kỳ nào đang dừng' : 'Chưa có việc định kỳ nào'"
			description="Bạn xem thẻ Đang chạy."
			action-label="Xem đang chạy"
			@action="setFilter('active')"
		/>
		<TaskEmptyState
			v-else-if="!items.length"
			kind="none"
			title="Chưa có việc định kỳ nào"
			description="Việc lặp lại mỗi tuần, mỗi tháng thì đặt một lần ở đây, khỏi phải nhớ giao lại."
			:action-label="readOnly ? undefined : 'Đặt việc định kỳ đầu tiên'"
			@action="openCreate"
		/>
		<ul v-else class="space-y-2" data-testid="recurrence-list">
			<li
				v-for="r in items"
				:key="r.id"
				class="rounded-xl border bg-white dark:bg-gray-900"
				:class="r.isActive ? 'border-gray-200 dark:border-gray-700' : 'border-dashed border-gray-300 dark:border-gray-600'"
				data-tour="task-recurrence-row"
				:data-testid="`recurrence-${r.id}`"
			>
				<div class="flex flex-wrap items-center gap-3 px-4 py-3">
					<button type="button" class="min-w-0 flex-1 text-left focus:outline-none focus:ring-2 focus:ring-brand-500" @click="select(r)">
						<p class="flex flex-wrap items-center gap-2">
							<span class="font-medium text-gray-900 dark:text-gray-100">{{ r.title }}</span>
							<span
								class="rounded-full px-2 py-0.5 text-xs"
								:class="r.isActive ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'"
							>
								{{ r.isActive ? 'Đang chạy' : 'Đã dừng' }}
							</span>
							<span v-if="r.project" class="text-xs text-gray-500">{{ r.project.code }}</span>
						</p>
						<p class="mt-0.5 text-sm text-teal-700 dark:text-teal-300">{{ recurrenceText(r) }}</p>
						<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
							{{ r.assignee.fullName }}<span v-if="r.assignee.inactive" class="text-rose-600"> (đã nghỉ)</span>
							· {{ r.points }} điểm
							<template v-if="r.isActive && r.nextDueDate"> · hạn tới {{ shortDate(r.nextDueDate, today) }}, hiện từ {{ shortDate(r.nextAppearDate, today) }}</template>
							· đã giao {{ r.taskCount }} lần
						</p>
						<p v-if="!r.isActive && r.pausedReason" class="mt-0.5 text-xs text-amber-700 dark:text-amber-400" data-testid="recurrence-paused-reason">
							Hệ thống tự dừng: {{ r.pausedReason }}
						</p>
					</button>
					<div v-if="r.canManage && !readOnly" class="flex items-center gap-2">
						<CommonAppButton size="sm" variant="outline" @click="openEdit(r)">Sửa</CommonAppButton>
						<CommonAppButton
							size="sm"
							:variant="r.isActive ? 'danger_outline' : 'primary'"
							:loading="busyId === r.id"
							:data-testid="`recurrence-toggle-${r.id}`"
							@click="pauseOrResume(r)"
						>
							{{ r.isActive ? 'Dừng' : 'Chạy lại' }}
						</CommonAppButton>
					</div>
				</div>
			</li>
		</ul>
		<div v-if="items.length < total && !loading" class="text-center">
			<CommonAppButton variant="secondary" size="sm" :loading="loadingMore" @click="load(true)">Tải thêm</CommonAppButton>
		</div>

		<TaskRecurrenceDetail
			v-if="selected"
			:recurrence="selected"
			:read-only="readOnly"
			:busy="busyId === selected.id"
			@close="closeDetail"
			@edit="openEdit(selected!)"
			@pause="pauseOrResume(selected!)"
			@resume="pauseOrResume(selected!)"
			@open-task="openTask"
		/>
		<TaskRecurrenceFormModal v-if="showForm" :recurrence="editing" @close="showForm = false" @saved="onSaved" />
		<TaskDetailPanel />
		<TaskActionDialogHost />
	</div>
</template>
