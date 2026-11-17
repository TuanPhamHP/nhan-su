<script setup lang="ts">
	import RecruitSettingsGeneral from '~/components/modules/recruitment/RecruitSettingsGeneral.vue';
	import RecruitSettingsCatalogs from '~/components/modules/recruitment/RecruitSettingsCatalogs.vue';
	import RecruitSettingsTemplates from '~/components/modules/recruitment/RecruitSettingsTemplates.vue';
	import RecruitSettingsPipelines from '~/components/modules/recruitment/RecruitSettingsPipelines.vue';
	import RecruitSettingsScorecards from '~/components/modules/recruitment/RecruitSettingsScorecards.vue';
	import RecruitSettingsSmtp from '~/components/modules/recruitment/RecruitSettingsSmtp.vue';

	definePageMeta({ title: 'Cài đặt tuyển dụng' });

	const { canWrite } = useModuleAccess();
	const { hasPermission, isAdmin } = usePermissions();

	const canManage = computed(() => canWrite('RECRUIT') && hasPermission('recruitment:manage'));

	/**
	 * Tab SMTP đi theo VAI TRÒ chứ không theo permission: route máy chủ thư chỉ nhận vai trò
	 * ADMIN, nên người phụ trách tuyển dụng vào đó vẫn nhận 403. Ẩn hẳn tab thay vì để họ bấm
	 * rồi gặp lỗi.
	 */
	type TabId = 'general' | 'catalogs' | 'templates' | 'pipelines' | 'scorecards' | 'smtp';

	const tabs = computed(() => {
		const list: { id: TabId; label: string }[] = [
			{ id: 'general', label: 'Chung' },
			{ id: 'catalogs', label: 'Danh mục' },
			{ id: 'templates', label: 'Mẫu email và thư mời' },
			{ id: 'pipelines', label: 'Quy trình mẫu' },
			{ id: 'scorecards', label: 'Mẫu đánh giá' },
		];
		if (isAdmin.value) list.push({ id: 'smtp', label: 'Máy chủ thư' });
		return list;
	});

	const tab = ref<TabId>('general');
</script>

<template>
	<div class="space-y-5">
		<div>
			<h1 class="text-xl font-bold text-gray-900 dark:text-white">Cài đặt tuyển dụng</h1>
			<p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
				Danh mục, mẫu email, quy trình và các quy tắc dùng chung của module
			</p>
		</div>

		<CommonAppModuleNotice module="RECRUIT" />

		<p
			v-if="!canManage"
			class="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300"
		>
			Bạn đang xem cài đặt ở chế độ chỉ đọc.
		</p>

		<div class="border-b border-gray-200 dark:border-gray-700">
			<nav class="-mb-px flex flex-wrap gap-1">
				<button
					v-for="t in tabs"
					:key="t.id"
					type="button"
					class="border-b-2 px-4 py-2.5 text-sm font-medium transition-colors"
					:class="
						tab === t.id
							? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
							: 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
					"
					@click="tab = t.id"
				>
					{{ t.label }}
				</button>
			</nav>
		</div>

		<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
			<RecruitSettingsGeneral v-if="tab === 'general'" :can-manage="canManage" />
			<RecruitSettingsCatalogs v-else-if="tab === 'catalogs'" :can-manage="canManage" />
			<RecruitSettingsTemplates v-else-if="tab === 'templates'" :can-manage="canManage" />
			<RecruitSettingsPipelines v-else-if="tab === 'pipelines'" :can-manage="canManage" />
			<RecruitSettingsScorecards v-else-if="tab === 'scorecards'" :can-manage="canManage" />
			<RecruitSettingsSmtp v-else-if="tab === 'smtp'" :can-manage="canWrite('RECRUIT')" />
		</div>
	</div>
</template>
