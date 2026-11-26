<script setup lang="ts">
	import { storeToRefs } from 'pinia';
	import EmployeePicker, { type PickablePerson } from '~/components/modules/general-request/EmployeePicker.vue';
	import RecruitConfirmModal from '~/components/modules/recruitment/RecruitConfirmModal.vue';
	import { useAuthStore } from '~/stores/auth';
	import { useDirectoryStore } from '~/stores/directory';
	import { taskPickablePeople } from '~/utils/people-picker';
	import { useTasksService } from '~/services/tasks.service';
	import type { TaskProjectDetail, TaskProjectMember, TaskProjectRole } from '~/types/tasks.types';
	import { taskErrorInfo } from '~/utils/tasks.utils';

	/**
	 * Thẻ Thành viên của dự án (UI-04). Quản lý dự án (và ADMIN, máy chủ trả `canManage`) thêm người,
	 * đổi vai, gỡ người; thành viên tự rời được. Dự án luôn còn ít nhất một quản lý: máy chủ chặn bằng
	 * 409 kèm câu, ở đây hiện bằng toast.
	 */
	const props = defineProps<{ project: TaskProjectDetail; readOnly: boolean }>();
	const emit = defineEmits<{ changed: [] }>();

	const service = useTasksService();
	const toast = useToast();
	const authStore = useAuthStore();
	const directoryStore = useDirectoryStore();
	const { employees, departments } = storeToRefs(directoryStore);

	const ROLES: Array<{ value: TaskProjectRole; label: string; hint: string }> = [
		{ value: 'MANAGER', label: 'Quản lý dự án', hint: 'Thêm người, đổi vai, đóng dự án, sửa mọi việc' },
		{ value: 'MEMBER', label: 'Thành viên', hint: 'Tạo việc, kéo thẻ, bình luận' },
		{ value: 'VIEWER', label: 'Người xem', hint: 'Chỉ xem, không tạo việc, không bình luận' },
	];

	const canManage = computed(() => props.project.canManage && !props.readOnly);
	const adding = ref(false);
	const pick = ref<number[]>([]);
	const role = ref<TaskProjectRole>('MEMBER');
	const saving = ref(false);

	const people = computed<PickablePerson[]>(() =>
		taskPickablePeople(
			employees.value.filter(e => !props.project.members.some(m => m.employee.id === e.id)),
			departments.value,
		),
	);

	function openAdd() {
		adding.value = true;
		directoryStore.load().catch(() => toast.error('Chưa tải được danh sách nhân viên.'));
	}

	/**
	 * Thêm nhiều người một lượt, cùng một vai. API nhận từng người nên gọi lần lượt; người nào lỗi thì giữ
	 * lại trong ô chọn kèm câu lỗi, người đã thêm được thì bỏ khỏi ô.
	 */
	async function add() {
		if (!pick.value.length) return;
		saving.value = true;
		const added: string[] = [];
		const failed: number[] = [];
		try {
			for (const id of pick.value) {
				try {
					const m = await service.addProjectMember(props.project.id, id, role.value);
					added.push(m.employee.fullName);
				} catch (err) {
					failed.push(id);
					const name = employees.value.find(e => e.id === id)?.fullName ?? 'Một người';
					toast.error(`${name}: ${taskErrorInfo(err).message}`);
				}
			}
			if (added.length) toast.success(`Đã thêm ${added.join(', ')} vào dự án`);
			pick.value = failed;
			if (!failed.length) adding.value = false;
			if (added.length) emit('changed');
		} finally {
			saving.value = false;
		}
	}

	async function changeRole(m: TaskProjectMember, value: string) {
		const next = value as TaskProjectRole;
		if (next === m.role) return;
		try {
			await service.updateProjectMember(props.project.id, m.employee.id, next);
			toast.success(`Đã đổi vai của ${m.employee.fullName}`);
			emit('changed');
		} catch (err) {
			toast.error(taskErrorInfo(err).message);
			emit('changed');
		}
	}

	const removing = ref<TaskProjectMember | null>(null);
	async function confirmRemove() {
		const m = removing.value;
		removing.value = null;
		if (!m) return;
		try {
			await service.removeProjectMember(props.project.id, m.employee.id);
			toast.success(m.employee.id === authStore.user?.id ? 'Bạn đã rời dự án' : `Đã gỡ ${m.employee.fullName} khỏi dự án`);
			emit('changed');
		} catch (err) {
			toast.error(taskErrorInfo(err).message);
		}
	}
</script>

<template>
	<section class="space-y-3" data-testid="project-members">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ project.members.length }} thành viên</h2>
			<CommonAppButton v-if="canManage && !adding" size="sm" data-testid="member-add-open" @click="openAdd">
				<Icon name="heroicons:user-plus" class="mr-1 h-4 w-4" />Thêm người
			</CommonAppButton>
		</div>

		<div v-if="adding" class="space-y-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
			<EmployeePicker v-model="pick" :people="people" label="Người cần thêm" hint="Chọn được nhiều người một lượt, mọi người nhận cùng một vai." />
			<fieldset>
				<legend class="text-sm font-medium text-gray-700 dark:text-gray-300">Vai trong dự án</legend>
				<div class="mt-1 grid gap-2 sm:grid-cols-3">
					<label
						v-for="r in ROLES"
						:key="r.value"
						class="flex cursor-pointer gap-2 rounded-lg border p-2 text-sm"
						:class="role === r.value ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-900/20' : 'border-gray-200 dark:border-gray-700'"
					>
						<input v-model="role" type="radio" :value="r.value" class="mt-0.5 text-brand-600 focus:ring-brand-500" />
						<span>
							<span class="block font-medium text-gray-900 dark:text-gray-100">{{ r.label }}</span>
							<span class="block text-xs text-gray-500 dark:text-gray-400">{{ r.hint }}</span>
						</span>
					</label>
				</div>
			</fieldset>
			<div class="flex justify-end gap-2">
				<CommonAppButton size="sm" variant="secondary" @click="adding = false">Huỷ</CommonAppButton>
				<CommonAppButton size="sm" :loading="saving" :disabled="!pick.length" data-testid="member-add-submit" @click="add">{{ pick.length > 1 ? `Thêm ${pick.length} người vào dự án` : 'Thêm vào dự án' }}</CommonAppButton>
			</div>
		</div>

		<ul class="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-700 dark:bg-gray-900">
			<li v-for="m in project.members" :key="m.employee.id" class="flex flex-wrap items-center gap-3 px-4 py-2.5" :data-member-id="m.employee.id">
				<CommonAppAvatar :src="m.employee.avatarUrl" :name="m.employee.fullName" size="sm" />
				<div class="min-w-0 flex-1">
					<p class="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
						{{ m.employee.fullName }}
						<span v-if="m.inactive" class="text-xs font-normal text-rose-600">đã nghỉ việc</span>
					</p>
					<p class="truncate text-xs text-gray-500 dark:text-gray-400">{{ m.departmentName ?? 'Chưa có phòng' }}</p>
				</div>
				<select
					v-if="canManage"
					:value="m.role"
					:aria-label="`Vai của ${m.employee.fullName}`"
					class="rounded-md border border-gray-200 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
					@change="e => changeRole(m, (e.target as HTMLSelectElement).value)"
				>
					<option v-for="r in ROLES" :key="r.value" :value="r.value">{{ r.label }}</option>
				</select>
				<span v-else class="text-sm text-gray-600 dark:text-gray-300">{{ m.roleLabel }}</span>
				<button
					v-if="!readOnly && (canManage || m.employee.id === authStore.user?.id)"
					type="button"
					class="rounded-md px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-500 dark:hover:bg-rose-900/20"
					@click="removing = m"
				>
					{{ m.employee.id === authStore.user?.id ? 'Rời dự án' : 'Gỡ' }}
				</button>
			</li>
		</ul>

		<RecruitConfirmModal
			v-if="removing"
			:title="removing.employee.id === authStore.user?.id ? 'Rời dự án' : 'Gỡ khỏi dự án'"
			:description="
				removing.employee.id === authStore.user?.id
					? 'Bạn sẽ không còn thấy các việc của dự án, trừ việc bạn đang làm hay đang theo dõi.'
					: `${removing.employee.fullName} sẽ không còn thấy các việc của dự án, trừ việc người đó đang làm hay đang theo dõi.`
			"
			:confirm-label="removing.employee.id === authStore.user?.id ? 'Rời dự án' : 'Gỡ'"
			@confirm="confirmRemove"
			@close="removing = null"
		/>
	</section>
</template>
