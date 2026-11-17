<script setup lang="ts">
	import { useMeProfileService } from '~/services/me-profile.service';
	import WorkExperienceList from '~/components/modules/employee/WorkExperienceList.vue';
	import WorkExperienceFormModal from '~/components/modules/employee/WorkExperienceFormModal.vue';
	import ProfilePendingRequestNotice from '~/components/modules/profile/ProfilePendingRequestNotice.vue';
	import type { CreateWorkExperienceDto, MyProfileChange, WorkExperience } from '~/types/hr-profile.types';

	/**
	 * Kinh nghiệm làm việc trên trang cá nhân (UI-04, lô 3a).
	 *
	 * Nhân viên chỉ xem, mọi thay đổi đi qua đề nghị cho phòng nhân sự duyệt, vì phần này nằm
	 * trong hồ sơ nhân sự và dùng cho báo cáo lao động.
	 */
	const props = defineProps<{
		pendingRequests: MyProfileChange[];
	}>();

	const emit = defineEmits<{
		created: [];
		cancelled: [];
	}>();

	const toast = useToast();
	const service = useMeProfileService();

	const items = ref<WorkExperience[]>([]);
	const loading = ref(true);
	const submitting = ref(false);
	const showForm = ref(false);
	const formTarget = ref<WorkExperience | null>(null);
	const removeTarget = ref<WorkExperience | null>(null);

	async function load() {
		loading.value = true;
		try {
			items.value = await service.findWorkExperiences();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa tải được kinh nghiệm làm việc.');
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);

	function openCreate() {
		formTarget.value = null;
		showForm.value = true;
	}

	function openEdit(item: WorkExperience) {
		formTarget.value = item;
		showForm.value = true;
	}

	function successMessage(supersededCount: number): string {
		return supersededCount
			? 'Đã gửi đề nghị mới và huỷ đề nghị đang chờ trước đó, phòng nhân sự sẽ xem và duyệt.'
			: 'Đã gửi đề nghị thay đổi, chờ phòng nhân sự duyệt.';
	}

	async function onSubmit(payload: CreateWorkExperienceDto) {
		submitting.value = true;
		try {
			const target = formTarget.value;
			const result = await service.createChangeRequest({
				section: 'EXPERIENCE',
				action: target ? 'UPDATE' : 'CREATE',
				targetId: target?.id,
				after: payload as unknown as Record<string, unknown>,
			});
			showForm.value = false;
			toast.success(successMessage(result.supersededIds.length));
			emit('created');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa gửi được đề nghị. Bạn thử lại sau ít phút.');
		} finally {
			submitting.value = false;
		}
	}

	async function confirmRemove() {
		const target = removeTarget.value;
		if (!target) return;
		submitting.value = true;
		try {
			const result = await service.createChangeRequest({
				section: 'EXPERIENCE',
				action: 'DELETE',
				targetId: target.id,
				after: {},
			});
			removeTarget.value = null;
			toast.success(successMessage(result.supersededIds.length));
			emit('created');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa gửi được đề nghị. Bạn thử lại sau ít phút.');
		} finally {
			submitting.value = false;
		}
	}
</script>

<template>
	<div class="space-y-4">
		<WorkExperienceList
			:items="items"
			:loading="loading"
			add-label="Đề nghị thêm"
			edit-label="Đề nghị sửa"
			remove-label="Đề nghị xoá"
			empty-text="Hồ sơ của bạn chưa ghi kinh nghiệm nào trước khi vào công ty."
			@add="openCreate"
			@edit="openEdit"
			@remove="removeTarget = $event"
		/>

		<ProfilePendingRequestNotice
			v-for="req in pendingRequests"
			:key="req.id"
			:request="req"
			@cancelled="emit('cancelled')"
		/>

		<WorkExperienceFormModal
			v-if="showForm"
			:target="formTarget"
			:submitting="submitting"
			submit-label="Gửi đề nghị"
			note="Kinh nghiệm chỉ vào hồ sơ sau khi phòng nhân sự duyệt."
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
					<h3 class="font-semibold text-gray-900 dark:text-white">Đề nghị xoá kinh nghiệm</h3>
					<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
						Hệ thống gửi đề nghị xoá mốc làm việc tại {{ removeTarget.companyName }}. Hồ sơ chỉ đổi sau khi phòng
						nhân sự duyệt.
					</p>
					<div class="mt-6 flex justify-end gap-3">
						<CommonAppButton variant="outline" @click="removeTarget = null">Giữ lại</CommonAppButton>
						<CommonAppButton variant="danger" :loading="submitting" @click="confirmRemove">Gửi đề nghị</CommonAppButton>
					</div>
				</div>
			</div>
		</Teleport>
	</div>
</template>
