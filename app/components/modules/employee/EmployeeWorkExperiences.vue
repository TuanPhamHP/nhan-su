<script setup lang="ts">
	import { useEmployeeProfileService } from '~/services/employee-profile.service';
	import WorkExperienceList from '~/components/modules/employee/WorkExperienceList.vue';
	import WorkExperienceFormModal from '~/components/modules/employee/WorkExperienceFormModal.vue';
	import type { CreateWorkExperienceDto, WorkExperience } from '~/types/hr-profile.types';

	/** Kinh nghiệm làm việc của một nhân viên, phòng nhân sự sửa trực tiếp vào hồ sơ. */
	const props = withDefaults(
		defineProps<{
			employeeId: number;
			canUpdate: boolean;
			/** Hồ sơ của chính người đang đăng nhập: backend chặn tự sửa kinh nghiệm. */
			selfEditBlocked?: boolean;
		}>(),
		{ selfEditBlocked: false },
	);

	const toast = useToast();
	const service = useEmployeeProfileService();

	const items = ref<WorkExperience[]>([]);
	const loading = ref(true);
	const submitting = ref(false);
	const showForm = ref(false);
	const formTarget = ref<WorkExperience | null>(null);
	const removeTarget = ref<WorkExperience | null>(null);

	async function load() {
		loading.value = true;
		try {
			items.value = await service.findWorkExperiences(props.employeeId);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa tải được kinh nghiệm làm việc.');
		} finally {
			loading.value = false;
		}
	}

	function openCreate() {
		formTarget.value = null;
		showForm.value = true;
	}

	function openEdit(item: WorkExperience) {
		formTarget.value = item;
		showForm.value = true;
	}

	async function onSubmit(payload: CreateWorkExperienceDto) {
		submitting.value = true;
		try {
			if (formTarget.value) {
				const updated = await service.updateWorkExperience(props.employeeId, formTarget.value.id, payload);
				const idx = items.value.findIndex(i => i.id === updated.id);
				if (idx !== -1) items.value.splice(idx, 1, updated);
				toast.success('Đã lưu mốc kinh nghiệm.');
			} else {
				const created = await service.createWorkExperience(props.employeeId, payload);
				items.value = [created, ...items.value];
				toast.success('Đã thêm mốc kinh nghiệm.');
			}
			showForm.value = false;
		} catch (e) {
			// Giữ form mở để người dùng sửa lại đúng chỗ BE báo lỗi.
			toast.error(e instanceof Error ? e.message : 'Chưa lưu được. Bạn thử lại sau ít phút.');
		} finally {
			submitting.value = false;
		}
	}

	async function confirmRemove() {
		const target = removeTarget.value;
		if (!target) return;
		submitting.value = true;
		try {
			await service.removeWorkExperience(props.employeeId, target.id);
			items.value = items.value.filter(i => i.id !== target.id);
			toast.success('Đã xoá mốc kinh nghiệm.');
			removeTarget.value = null;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa xoá được. Bạn thử lại sau ít phút.');
		} finally {
			submitting.value = false;
		}
	}

	onMounted(load);
</script>

<template>
	<div>
		<WorkExperienceList
			:items="items"
			:loading="loading"
			:self-edit-blocked="selfEditBlocked"
			:add-label="canUpdate ? 'Thêm kinh nghiệm' : ''"
			:edit-label="canUpdate ? 'Sửa' : ''"
			:remove-label="canUpdate ? 'Xoá' : ''"
			@add="openCreate"
			@edit="openEdit"
			@remove="removeTarget = $event"
		/>

		<WorkExperienceFormModal
			v-if="showForm"
			:target="formTarget"
			:submitting="submitting"
			@submit="onSubmit"
			@close="showForm = false"
		/>

		<Teleport to="body">
			<div
				v-if="removeTarget"
				class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
				@click.self="removeTarget = null"
			>
				<div
					class="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900"
				>
					<h3 class="font-semibold text-gray-900 dark:text-white">Xoá mốc kinh nghiệm</h3>
					<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
						Hệ thống sẽ xoá mốc làm việc tại {{ removeTarget.companyName }} khỏi hồ sơ nhân viên này.
					</p>
					<div class="mt-6 flex justify-end gap-3">
						<CommonAppButton variant="outline" @click="removeTarget = null">Giữ lại</CommonAppButton>
						<CommonAppButton variant="danger" :loading="submitting" @click="confirmRemove">Xoá</CommonAppButton>
					</div>
				</div>
			</div>
		</Teleport>
	</div>
</template>
