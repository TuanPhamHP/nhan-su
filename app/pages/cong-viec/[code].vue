<script setup lang="ts">
	import TaskActionDialogHost from '~/components/modules/tasks/TaskActionDialogHost.vue';
	import TaskDetailView from '~/components/modules/tasks/TaskDetailView.vue';
	import type { TaskDetail } from '~/types/tasks.types';

	/**
	 * UI-02 mở trực tiếp: trang đầy đủ của một việc (`/cong-viec/HQ-12`). Từ danh sách thì việc mở ở
	 * khung trượt (`TaskDetailPanel`); dán đường dẫn, tải lại trang hay bấm thông báo thì vào đây.
	 *
	 * Nhận cả id số (thông báo trên di động, `refId`): tải xong thì đổi đường dẫn sang số hiệu.
	 */
	const route = useRoute();
	const router = useRouter();
	const code = computed(() => String(route.params.code ?? ''));
	useHead({ title: () => `Việc ${code.value}` });

	function onLoaded(t: TaskDetail) {
		if (t.code.toUpperCase() !== code.value.toUpperCase()) router.replace({ path: `/cong-viec/${t.code}`, query: route.query });
	}

	function openTask(c: string) {
		router.push(`/cong-viec/${c}`);
	}
</script>

<template>
	<div class="pb-24">
		<div class="mb-3 flex items-center gap-2 text-sm">
			<NuxtLink to="/cong-viec" class="inline-flex items-center gap-1 text-gray-600 hover:text-brand-600 dark:text-gray-300">
				<Icon name="heroicons:arrow-left" class="h-4 w-4" />Việc của tôi
			</NuxtLink>
		</div>
		<CommonAppModuleNotice module="TASKS" class="mb-3" />
		<div class="flex min-h-[70vh] flex-col overflow-hidden lg:min-h-0 rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 lg:h-[calc(100vh-14rem)]">
			<TaskDetailView :key="code" :code="code" mode="page" @loaded="onLoaded" @open-task="openTask" />
		</div>
		<TaskActionDialogHost />
	</div>
</template>
