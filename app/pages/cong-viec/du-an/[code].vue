<script setup lang="ts">
	import RecruitConfirmModal from '~/components/modules/recruitment/RecruitConfirmModal.vue';
	import TaskActionDialogHost from '~/components/modules/tasks/TaskActionDialogHost.vue';
	import TaskCreateModal from '~/components/modules/tasks/TaskCreateModal.vue';
	import TaskEmptyState from '~/components/modules/tasks/TaskEmptyState.vue';
	import TaskProjectFormModal from '~/components/modules/tasks/TaskProjectFormModal.vue';
	import TaskProjectMembers from '~/components/modules/tasks/TaskProjectMembers.vue';
	import TaskWorkspace from '~/components/modules/tasks/TaskWorkspace.vue';
	import { useAuthStore } from '~/stores/auth';
	import { useTasksService } from '~/services/tasks.service';
	import { tasksBoardTour } from '~/tours/tasks';
	import type { TaskDetail, TaskProjectDetail } from '~/types/tasks.types';
	import { taskErrorInfo } from '~/utils/tasks.utils';

	/**
	 * UI-04 Một dự án: Danh sách và Bảng việc dùng chung thanh lọc (Tiến độ, Lịch là lô 2, hiện mờ),
	 * thẻ Thành viên. Đường dẫn mang MÃ dự án (`/cong-viec/du-an/HQ`) như thiết kế; `GET /task-projects/:id`
	 * nhận cả mã, còn các route con của dự án chỉ nhận id số nên trang dùng `project.id` cho chúng.
	 */
	const route = useRoute();
	const router = useRouter();
	const authStore = useAuthStore();
	const service = useTasksService();
	const toast = useToast();
	const { canUse, canWrite } = useModuleAccess();
	const readOnly = computed(() => !canWrite('TASKS'));
	const codeParam = computed(() => String(route.params.code ?? ''));
	useHead({ title: () => `Dự án ${codeParam.value}` });

	const project = ref<TaskProjectDetail | null>(null);
	const loading = ref(true);
	const loadError = ref('');
	const notFound = ref(false);

	async function load(silent = false) {
		if (!silent) loading.value = true;
		loadError.value = '';
		notFound.value = false;
		try {
			// Lần đầu mở theo mã trên đường dẫn (máy chủ nhận cả mã lẫn id); tải lại sau thao tác thì dùng id.
			project.value = await service.getProject(project.value?.id ?? codeParam.value);
		} catch (err) {
			const info = taskErrorInfo(err, 'Chưa tải được dự án.');
			if (info.code === 'TASK_PROJECT_NOT_FOUND' || info.status === 404) notFound.value = true;
			else loadError.value = info.message;
		} finally {
			loading.value = false;
		}
	}
	onMounted(() => {
		if (canUse('TASKS')) load();
		else loading.value = false;
	});

	const tab = computed<'tasks' | 'members'>(() => (route.query.tab === 'members' ? 'members' : 'tasks'));
	function setTab(t: 'tasks' | 'members') {
		router.replace({ query: { ...route.query, tab: t === 'tasks' ? undefined : t } });
	}

	const isAdmin = computed(() => authStore.user?.role === 'ADMIN');
	const canCreateTask = computed(
		() => !readOnly.value && project.value?.status === 'ACTIVE' && (project.value.myRole === 'MANAGER' || project.value.myRole === 'MEMBER' || isAdmin.value),
	);
	const canReorder = computed(() => project.value?.myRole === 'MANAGER' || project.value?.myRole === 'MEMBER' || isAdmin.value);

	const workspaceRef = ref<InstanceType<typeof TaskWorkspace> | null>(null);
	const showCreate = ref(false);
	function onCreated(t: TaskDetail) {
		showCreate.value = false;
		workspaceRef.value?.reload();
		useTaskPanel().open(t.code);
	}

	const showEdit = ref(false);
	function onSaved(p: TaskProjectDetail) {
		showEdit.value = false;
		project.value = p;
	}

	const confirmClose = ref(false);
	const busy = ref(false);
	async function closeOrReopen() {
		const p = project.value;
		if (!p) return;
		busy.value = true;
		try {
			project.value = p.status === 'ACTIVE' ? await service.closeProject(p.id) : await service.reopenProject(p.id);
			toast.success(p.status === 'ACTIVE' ? 'Đã đóng dự án' : 'Đã mở lại dự án');
		} catch (err) {
			toast.error(taskErrorInfo(err).message);
		} finally {
			busy.value = false;
			confirmClose.value = false;
		}
	}

	const counts = computed(() => project.value?.taskCounts);

	usePageTour('tasks-board', tasksBoardTour, () => canUse('TASKS') && !!project.value && route.query.mode === 'board');
</script>

<template>
	<div class="space-y-4 pb-24">
		<NuxtLink to="/cong-viec/du-an" class="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-brand-600 dark:text-gray-300">
			<Icon name="heroicons:arrow-left" class="h-4 w-4" />Dự án
		</NuxtLink>

		<div v-if="loading" class="space-y-3" aria-busy="true">
			<div class="h-8 w-1/2 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
			<div class="h-64 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
		</div>
		<TaskEmptyState
			v-else-if="notFound"
			kind="filtered"
			:title="`Không mở được dự án ${codeParam}`"
			description="Dự án không có, hoặc bạn không là thành viên. Bạn hỏi quản lý dự án để được thêm vào."
			action-label="Về danh sách dự án"
			@action="router.push('/cong-viec/du-an')"
		/>
		<TaskEmptyState v-else-if="loadError" kind="error" title="Chưa tải được dự án" :description="loadError" action-label="Thử lại" @action="load()" />

		<template v-else-if="project">
			<UiPageHeader
				:title="project.name"
				:description="project.description || `Dự án ${project.code}. Số hiệu mọi việc trong dự án bắt đầu bằng ${project.code}.`"
				:tour="route.query.mode === 'board' ? 'tasks-board' : undefined"
			>
				<CommonAppButton v-if="canCreateTask" data-testid="project-task-create" @click="showCreate = true">
					<Icon name="heroicons:plus" class="mr-1 h-4 w-4" />Tạo việc
				</CommonAppButton>
				<CommonAppButton v-if="project.canManage && !readOnly" variant="secondary" @click="showEdit = true">Sửa</CommonAppButton>
				<CommonAppButton
					v-if="project.canManage && !readOnly"
					:variant="project.status === 'ACTIVE' ? 'danger_outline' : 'outline'"
					:loading="busy"
					data-testid="project-close-toggle"
					@click="project.status === 'ACTIVE' ? (confirmClose = true) : closeOrReopen()"
				>
					{{ project.status === 'ACTIVE' ? 'Đóng dự án' : 'Mở lại dự án' }}
				</CommonAppButton>
			</UiPageHeader>
			<CommonAppModuleNotice module="TASKS" />

			<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600 dark:text-gray-300">
				<span class="rounded bg-brand-50 px-1.5 py-0.5 text-xs font-bold text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">{{ project.code }}</span>
				<span
					class="rounded-full px-2 py-0.5 text-xs"
					:class="project.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'"
					data-testid="project-status"
				>
					{{ project.statusLabel }}
				</span>
				<span v-if="project.myRoleLabel">Bạn là {{ project.myRoleLabel.toLowerCase() }}</span>
				<span v-if="project.department">{{ project.department.name }}</span>
				<span v-if="counts">{{ counts.TODO }} chưa làm · {{ counts.IN_PROGRESS }} đang làm · {{ counts.IN_REVIEW }} chờ nghiệm thu · {{ counts.DONE }} hoàn thành</span>
			</div>
			<p v-if="project.status === 'CLOSED'" class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300">
				Dự án đã đóng nên không thêm việc mới được. Việc đang có vẫn làm tiếp bình thường.
			</p>
			<p v-else-if="project.myRole === 'VIEWER'" class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300" data-testid="project-viewer-note">
				Bạn là người xem của dự án này nên chỉ xem được, không tạo việc hay bình luận.
			</p>

			<div class="flex gap-4 border-b border-gray-200 text-sm dark:border-gray-700" role="tablist">
				<button
					type="button"
					role="tab"
					:aria-selected="tab === 'tasks'"
					class="-mb-px border-b-2 px-1 pb-2 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
					:class="tab === 'tasks' ? 'border-brand-600 text-brand-700 dark:text-brand-300' : 'border-transparent text-gray-600 dark:text-gray-400'"
					@click="setTab('tasks')"
				>
					Việc
				</button>
				<button
					type="button"
					role="tab"
					:aria-selected="tab === 'members'"
					class="-mb-px border-b-2 px-1 pb-2 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
					:class="tab === 'members' ? 'border-brand-600 text-brand-700 dark:text-brand-300' : 'border-transparent text-gray-600 dark:text-gray-400'"
					data-testid="project-members-tab"
					@click="setTab('members')"
				>
					Thành viên ({{ project.members.length }})
				</button>
			</div>

			<TaskWorkspace
				v-if="tab === 'tasks'"
				ref="workspaceRef"
				:base="{ view: 'project', projectId: project.id }"
				:storage-key="`tasks-filters:project:${project.id}`"
				:reorder="canReorder"
				:quick-create="canCreateTask ? { projectId: project.id, defaultAssigneeId: authStore.user?.id ?? null } : null"
				:realtime-project-id="project.id"
				:read-only="readOnly"
				empty-title="Dự án chưa có việc nào"
				empty-description="Tạo việc đầu tiên và giao cho thành viên, kèm hạn và điểm."
				:empty-action="canCreateTask ? 'Tạo việc đầu tiên' : undefined"
				@empty-action="showCreate = true"
				@changed="load(true)"
			/>
			<TaskProjectMembers v-else :project="project" :read-only="readOnly" @changed="load(true)" />

			<TaskCreateModal v-if="showCreate" :project-id="project.id" @close="showCreate = false" @created="onCreated" />
			<TaskProjectFormModal v-if="showEdit" :project="project" @close="showEdit = false" @saved="onSaved" />
			<RecruitConfirmModal
				v-if="confirmClose"
				title="Đóng dự án"
				description="Dự án đóng thì không thêm việc mới được, việc đang có vẫn làm tiếp. Bạn mở lại được bất cứ lúc nào."
				confirm-label="Đóng dự án"
				:loading="busy"
				@confirm="closeOrReopen"
				@close="confirmClose = false"
			/>
		</template>
		<TaskActionDialogHost />
	</div>
</template>
