<script setup lang="ts">
	import { storeToRefs } from 'pinia';
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import EmployeePicker, { type PickablePerson } from '~/components/modules/general-request/EmployeePicker.vue';
	import TaskChecklistInput from '~/components/modules/tasks/TaskChecklistInput.vue';
	import { useAuthStore } from '~/stores/auth';
	import { useDirectoryStore } from '~/stores/directory';
	import { useTasksService } from '~/services/tasks.service';
	import type { TaskDetail, TaskGroup, TaskPriority, TaskProject, TaskSprint } from '~/types/tasks.types';
	import { POINT_SCALE, PRIORITY_LABELS, quickDueOptions, taskErrorInfo, vnToday } from '~/utils/tasks.utils';

	/**
	 * Cửa sổ giao việc đầy đủ (F-01): bắt buộc tiêu đề, người thực hiện, hạn, điểm; còn lại tuỳ chọn.
	 * Dự án chỉ liệt kê dự án đang chạy mà người tạo là Quản lý hoặc Thành viên, vì Người xem không
	 * tạo được việc trong dự án.
	 */
	const props = withDefaults(defineProps<{ projectId?: number | null; groupId?: number | null; sprintId?: number | null }>(), {
		projectId: null,
		groupId: null,
		sprintId: null,
	});
	const emit = defineEmits<{ close: []; created: [task: TaskDetail] }>();

	const authStore = useAuthStore();
	const directoryStore = useDirectoryStore();
	const { employees } = storeToRefs(directoryStore);
	const service = useTasksService();
	const toast = useToast();
	const today = vnToday();
	const dueOptions = quickDueOptions(today);

	const projects = ref<TaskProject[]>([]);
	onMounted(async () => {
		directoryStore.load().catch(() => toast.error('Chưa tải được danh sách nhân viên.'));
		try {
			const res = await service.listProjects({ status: 'ACTIVE', limit: 100 });
			projects.value = res.data.filter(p => p.myRole === 'MANAGER' || p.myRole === 'MEMBER');
		} catch {
			projects.value = [];
		}
	});

	const schema = toTypedSchema(
		z
			.object({
				title: z.string({ required_error: 'Nhập tiêu đề' }).trim().min(1, 'Nhập tiêu đề').max(500, 'Tiêu đề tối đa 500 ký tự'),
				assigneeIds: z.array(z.number()).min(1, 'Chọn người thực hiện'),
				reviewerIds: z.array(z.number()),
				// Hạn và điểm không bắt buộc: không hạn thì không bao giờ quá hạn, chưa có điểm thì tính 0.
				dueDate: z.string().optional(),
				startDate: z.string().optional(),
				points: z.number().optional(),
				priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
				projectId: z.string(),
				description: z.string(),
				watcherIds: z.array(z.number()),
				checklist: z.array(z.string()),
				groupId: z.string(),
				sprintId: z.string(),
			})
			.refine(v => !v.startDate || !v.dueDate || v.startDate <= v.dueDate, {
				message: 'Ngày bắt đầu không được sau hạn',
				path: ['startDate'],
			})
			.refine(v => !v.reviewerIds[0] || v.assigneeIds[0] === authStore.user?.id || v.reviewerIds[0] !== v.assigneeIds[0], {
				message: 'Người thực hiện không tự nghiệm thu việc người khác giao, bạn chọn người khác',
				path: ['reviewerIds'],
			}),
	);

	const { defineField, errors, handleSubmit, isSubmitting } = useForm({
		validationSchema: schema,
		initialValues: {
			title: '',
			assigneeIds: authStore.user?.id ? [authStore.user.id] : [],
			reviewerIds: [],
			dueDate: undefined,
			startDate: undefined,
			points: undefined,
			priority: 'NORMAL' as TaskPriority,
			projectId: props.projectId ? String(props.projectId) : '',
			description: '',
			watcherIds: [],
			checklist: [] as string[],
			groupId: props.groupId ? String(props.groupId) : '',
			sprintId: props.sprintId ? String(props.sprintId) : '',
		},
	});
	const [title] = defineField('title');
	const [assigneeIds] = defineField('assigneeIds');
	const [reviewerIds] = defineField('reviewerIds');
	const [dueDate] = defineField('dueDate');
	const [startDate] = defineField('startDate');
	const [points] = defineField('points');
	const [priority] = defineField('priority');
	const [projectId] = defineField('projectId');
	const [description] = defineField('description');
	const [watcherIds] = defineField('watcherIds');
	const [checklist] = defineField('checklist');
	const [groupId] = defineField('groupId');
	const [sprintId] = defineField('sprintId');

	// Lô 2: nhóm việc, đợt của dự án đang chọn. Nhóm đã cất không chọn được (máy chủ cũng chặn).
	const groups = ref<TaskGroup[]>([]);
	const sprints = ref<TaskSprint[]>([]);
	const useSprints = ref(false);
	let projectSeq = 0;
	watch(
		() => projectId.value,
		async pid => {
			const my = ++projectSeq;
			groups.value = [];
			sprints.value = [];
			useSprints.value = false;
			if (!pid) {
				groupId.value = '';
				sprintId.value = '';
				return;
			}
			try {
				const id = Number(pid);
				const [g, p] = await Promise.all([service.listGroups(id), service.getProject(id)]);
				if (my !== projectSeq) return;
				groups.value = g.filter(x => !x.archived);
				useSprints.value = p.useSprints;
				sprints.value = p.useSprints ? (await service.listSprints(id)).filter(x => x.status !== 'CLOSED') : [];
				if (groupId.value && !groups.value.some(x => String(x.id) === groupId.value)) groupId.value = '';
				if (sprintId.value && !sprints.value.some(x => String(x.id) === sprintId.value)) sprintId.value = '';
			} catch {
				groups.value = [];
			}
		},
		{ immediate: true },
	);
	const groupOptions = computed(() => [{ value: '', label: 'Chưa có nhóm' }, ...groups.value.map(g => ({ value: String(g.id), label: g.name }))]);
	const sprintOptions = computed(() => [
		{ value: '', label: 'Việc chờ xếp' },
		...sprints.value.map(x => ({ value: String(x.id), label: `${x.name} (${x.statusLabel.toLowerCase()})` })),
	]);

	const people = computed<PickablePerson[]>(() =>
		employees.value.map(e => ({ id: e.id, fullName: e.fullName, hint: e.department?.name ?? e.employeeCode })),
	);

	const projectOptions = computed(() => [
		{ value: '', label: 'Việc lẻ (không thuộc dự án)' },
		...projects.value.map(p => ({ value: String(p.id), label: `${p.code} · ${p.name}` })),
	]);

	const onSubmit = handleSubmit(async v => {
		try {
			const created = await service.create({
				title: v.title.trim(),
				assigneeId: v.assigneeIds[0]!,
				reviewerId: v.reviewerIds[0],
				dueDate: v.dueDate || undefined,
				startDate: v.startDate || undefined,
				points: v.points,
				priority: v.priority,
				projectId: v.projectId ? Number(v.projectId) : undefined,
				description: v.description && v.description !== '<p></p>' ? v.description : undefined,
				watcherIds: v.watcherIds.length ? v.watcherIds : undefined,
				checklist: v.checklist.length ? v.checklist : undefined,
				groupId: v.projectId && v.groupId ? Number(v.groupId) : undefined,
				sprintId: v.projectId && v.sprintId ? Number(v.sprintId) : undefined,
			});
			toast.success(`Đã giao việc ${created.code}`);
			emit('created', created);
		} catch (err) {
			toast.error(taskErrorInfo(err).message);
		}
	});

	/** Chữ gõ dở trong ô danh sách kiểm tra thành mục trước khi gửi; quá dài thì không gửi. */
	const checklistInput = ref<InstanceType<typeof TaskChecklistInput> | null>(null);
	async function submit() {
		if (checklistInput.value && !checklistInput.value.commitDraft()) return;
		await nextTick();
		await onSubmit();
	}

	useEscapeKey(() => emit('close'), () => !isSubmitting.value);
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-0 sm:p-4" @click.self="emit('close')">
			<form
				class="my-0 w-full max-w-2xl rounded-none bg-white shadow-xl sm:my-8 sm:rounded-2xl dark:bg-gray-900"
				role="dialog"
				aria-modal="true"
				aria-label="Tạo việc"
				data-testid="task-create-modal"
				@submit.prevent="submit"
			>
				<div class="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">Tạo việc</h2>
					<button type="button" class="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Đóng" @click="emit('close')">
						<Icon name="heroicons:x-mark" class="h-5 w-5" />
					</button>
				</div>

				<div class="space-y-4 px-5 py-4">
					<div>
						<label for="task-title" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Tiêu đề <span class="text-red-500">*</span></label>
						<input
							id="task-title"
							v-model="title"
							type="text"
							maxlength="500"
							class="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:text-gray-100"
							:class="errors.title ? 'border-rose-500' : 'border-gray-300 dark:border-gray-600'"
						/>
						<p v-if="errors.title" class="mt-1 text-xs text-rose-600">{{ errors.title }}</p>
					</div>

					<div class="grid gap-4 sm:grid-cols-2">
						<div>
							<EmployeePicker v-model="assigneeIds" :people="people" single label="Người thực hiện *" :error="errors.assigneeIds" />
						</div>
						<div>
							<EmployeePicker
								v-model="reviewerIds"
								:people="people"
								single
								label="Người nghiệm thu"
								hint="Bỏ trống thì bạn là người nghiệm thu"
								:error="errors.reviewerIds"
							/>
						</div>
					</div>

					<div class="grid gap-4 sm:grid-cols-2">
						<div>
							<UiDatePicker v-model="dueDate" label="Hạn" :error="errors.dueDate" />
							<div class="mt-1.5 flex flex-wrap gap-1.5">
								<button
									v-for="o in dueOptions"
									:key="o.label"
									type="button"
									class="rounded-md border px-2 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
									:class="dueDate === o.value ? 'border-brand-500 text-brand-700 dark:text-brand-300' : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'"
									@click="dueDate = o.value"
								>
									{{ o.label }}
								</button>
							</div>
							<p class="mt-1 text-xs text-gray-500">Bỏ trống thì việc không có hạn và không bị tính quá hạn.</p>
						</div>
						<UiDatePicker v-model="startDate" label="Ngày bắt đầu" :error="errors.startDate" />
					</div>

					<div class="grid gap-4 sm:grid-cols-2">
						<div>
							<span class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Điểm khối lượng
							</span>
							<div class="mt-1 flex gap-1.5" role="radiogroup" aria-label="Điểm khối lượng, bấm lại để bỏ">
								<button
									v-for="p in POINT_SCALE"
									:key="p"
									type="button"
									role="radio"
									:aria-checked="points === p"
									class="h-9 w-10 rounded-md border text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
									:class="points === p ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : errors.points ? 'border-rose-500 text-gray-700 dark:text-gray-300' : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300'"
									@click="points = points === p ? undefined : p"
								>
									{{ p }}
								</button>
							</div>
							<p v-if="errors.points" class="mt-1 text-xs text-rose-600">{{ errors.points }}</p>
							<p v-else class="mt-1 text-xs text-gray-500">
								Việc càng nặng điểm càng cao: 1 rất nhẹ, 8 rất nặng. Bỏ trống thì tính 0 điểm, bấm lại số đang chọn để bỏ.
							</p>
						</div>
						<UiSelect
							:model-value="priority"
							label="Ưu tiên"
							:options="Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label }))"
							@update:model-value="v => (priority = (v as TaskPriority) ?? 'NORMAL')"
						/>
					</div>

					<UiSelect
						:model-value="projectId"
						label="Dự án"
						:options="projectOptions"
						searchable
						@update:model-value="v => (projectId = v == null ? '' : String(v))"
					/>

					<div v-if="groups.length || useSprints" class="grid gap-4 sm:grid-cols-2">
						<UiSelect
							v-if="groups.length"
							:model-value="groupId"
							label="Nhóm việc"
							:options="groupOptions"
							data-testid="task-create-group"
							@update:model-value="v => (groupId = v == null ? '' : String(v))"
						/>
						<UiSelect
							v-if="useSprints"
							:model-value="sprintId"
							label="Đợt"
							:options="sprintOptions"
							hint="Bỏ trống thì việc nằm ở Việc chờ xếp"
							data-testid="task-create-sprint"
							@update:model-value="v => (sprintId = v == null ? '' : String(v))"
						/>
					</div>

					<div>
						<span class="block text-sm font-medium text-gray-700 dark:text-gray-300">Mô tả</span>
						<div class="mt-1">
							<CommonTiptapEditor v-model="description" placeholder="Việc cần làm, kết quả mong đợi" />
						</div>
					</div>

					<EmployeePicker v-model="watcherIds" :people="people" label="Người theo dõi" />

					<TaskChecklistInput id="task-checklist" ref="checklistInput" v-model="checklist" />
				</div>

				<div class="flex justify-end gap-3 border-t border-gray-200 px-5 py-4 dark:border-gray-700">
					<CommonAppButton variant="secondary" :disabled="isSubmitting" @click="emit('close')">Huỷ</CommonAppButton>
					<CommonAppButton type="submit" :loading="isSubmitting" data-testid="task-create-submit">Giao việc</CommonAppButton>
				</div>
			</form>
		</div>
	</Teleport>
</template>
