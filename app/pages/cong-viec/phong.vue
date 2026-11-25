<script setup lang="ts">
	import TaskActionDialogHost from '~/components/modules/tasks/TaskActionDialogHost.vue';
	import TaskEmptyState from '~/components/modules/tasks/TaskEmptyState.vue';
	import TaskWorkspace from '~/components/modules/tasks/TaskWorkspace.vue';
	import { useDirectoryStore } from '~/stores/directory';
	import type { TaskListQuery } from '~/types/tasks.types';

	/**
	 * UI-05 Việc của phòng (`view=department`): việc của người đang thuộc phòng mình làm trưởng,
	 * Danh sách và Bảng việc dùng chung thanh lọc.
	 *
	 * Ai được xem phòng nào lấy từ `GET /v1/tasks/scope`: trưởng phòng chọn trong `managedDepartments`,
	 * ADMIN và Giám đốc (`seesAllTasks`) chọn mọi phòng. Phạm vi rỗng thì trang nói rõ "dành cho
	 * trưởng phòng" và không gọi API danh sách (máy chủ sẽ trả 403).
	 */
	useHead({ title: 'Việc của phòng' });

	const directoryStore = useDirectoryStore();
	const route = useRoute();
	const router = useRouter();
	const { canUse, canWrite } = useModuleAccess();
	const readOnly = computed(() => !canWrite('TASKS'));
	const taskScope = useTaskScope();
	const { scope, failed } = taskScope;

	const checking = ref(true);
	async function check() {
		checking.value = true;
		await taskScope.load(true);
		if (scope.value?.seesAllTasks) await directoryStore.load().catch(() => {});
		checking.value = false;
	}
	onMounted(() => {
		if (canUse('TASKS')) check();
		else checking.value = false;
	});

	const deptOptions = computed(() => {
		const s = scope.value;
		if (!s) return [];
		const list = s.seesAllTasks ? directoryStore.departments.map(d => ({ id: d.id, name: d.name })) : s.managedDepartments;
		return list.map(d => ({ value: String(d.id), label: d.name }));
	});
	const allowed = computed(() => taskScope.hasDepartmentView.value);
	const selectedDept = computed<number | null>(() => {
		const raw = Number(route.query.dept ?? 0);
		if (raw && deptOptions.value.some(o => o.value === String(raw))) return raw;
		const first = deptOptions.value[0];
		return first ? Number(first.value) : null;
	});
	function setDept(v: string | number | undefined) {
		router.replace({ query: { ...route.query, dept: v ? String(v) : undefined } });
	}

	const base = computed<TaskListQuery>(() => ({ view: 'department', departmentId: selectedDept.value ?? undefined }));
	const deptName = computed(() => deptOptions.value.find(o => o.value === String(selectedDept.value))?.label ?? '');
</script>

<template>
	<div class="space-y-4 pb-24">
		<UiPageHeader
			title="Việc của phòng"
			description="Việc của mọi người đang thuộc phòng bạn làm trưởng phòng, kể cả việc trong dự án bạn không tham gia."
		>
			<UiSelect
				v-if="allowed && deptOptions.length > 1"
				class="w-56"
				:model-value="selectedDept ? String(selectedDept) : ''"
				:options="deptOptions"
				searchable
				@update:model-value="setDept"
			/>
		</UiPageHeader>
		<CommonAppModuleNotice module="TASKS" />

		<div v-if="checking" class="space-y-2" aria-busy="true">
			<div v-for="i in 5" :key="i" class="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
		</div>
		<TaskEmptyState
			v-else-if="failed"
			kind="error"
			title="Chưa tải được phạm vi của bạn"
			description="Bạn kiểm tra mạng rồi thử lại."
			action-label="Thử lại"
			@action="check"
		/>
		<TaskEmptyState
			v-else-if="!allowed"
			kind="filtered"
			title="Trang này dành cho trưởng phòng"
			description="Bạn chưa làm trưởng phòng nào nên không có việc của phòng để xem. Việc của bạn nằm ở Việc của tôi."
			action-label="Về Việc của tôi"
			data-testid="dept-not-manager"
			@action="router.push('/cong-viec')"
		/>
		<template v-else-if="selectedDept">
			<p class="text-sm text-gray-600 dark:text-gray-300">Phòng {{ deptName }}</p>
			<TaskWorkspace
				:key="String(selectedDept)"
				:base="base"
				:storage-key="`tasks-filters:dept:${selectedDept}`"
				:reorder="false"
				show-project
				:read-only="readOnly"
				empty-title="Phòng chưa có việc nào"
				empty-description="Khi người trong phòng được giao việc, việc sẽ hiện ở đây."
			/>
		</template>
		<TaskActionDialogHost />
	</div>
</template>
