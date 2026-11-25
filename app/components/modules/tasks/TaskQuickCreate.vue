<script setup lang="ts">
	import { storeToRefs } from 'pinia';
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import EmployeePicker, { type PickablePerson } from '~/components/modules/general-request/EmployeePicker.vue';
	import { useAuthStore } from '~/stores/auth';
	import { useDirectoryStore } from '~/stores/directory';
	import { useTasksService } from '~/services/tasks.service';
	import type { TaskDetail } from '~/types/tasks.types';
	import { POINT_SCALE, quickDueOptions, shortDate, taskErrorInfo, vnToday } from '~/utils/tasks.utils';

	/**
	 * Dòng tạo nhanh ở cuối cột Chưa làm và cuối mỗi nhóm (mục 9.2): ô tiêu đề và ba nút Người, Hạn,
	 * Điểm. Người điền sẵn theo ngữ cảnh (người của nhóm đang đứng, không thì chính mình). Enter khi
	 * còn thiếu thì ô thiếu viền đỏ và con trỏ nhảy tới ô đó, vì giao việc bắt buộc đủ bốn ô (F-01).
	 */
	const props = withDefaults(
		defineProps<{
			projectId?: number | null;
			parentId?: number | null;
			defaultAssigneeId?: number | null;
			defaultDueDate?: string | null;
			placeholder?: string;
			disabled?: boolean;
			/** Lô 2: nhóm việc, đợt điền sẵn (dòng tạo nhanh cuối nhóm, cuối đợt). */
			groupId?: number | null;
			sprintId?: number | null;
		}>(),
		{
			placeholder: 'Thêm việc, gõ tiêu đề rồi Enter',
			projectId: null,
			parentId: null,
			defaultAssigneeId: null,
			defaultDueDate: null,
			groupId: null,
			sprintId: null,
		},
	);

	const emit = defineEmits<{ created: [task: TaskDetail] }>();

	const authStore = useAuthStore();
	const directoryStore = useDirectoryStore();
	const { employees } = storeToRefs(directoryStore);
	const service = useTasksService();
	const toast = useToast();
	const today = vnToday();

	const schema = toTypedSchema(
		z.object({
			title: z.string({ required_error: 'Nhập tiêu đề' }).trim().min(1, 'Nhập tiêu đề'),
			assigneeId: z.number({ required_error: 'Chọn người thực hiện', invalid_type_error: 'Chọn người thực hiện' }),
			dueDate: z.string({ required_error: 'Chọn hạn' }).min(1, 'Chọn hạn'),
			points: z.number({ required_error: 'Chọn điểm', invalid_type_error: 'Chọn điểm' }),
		}),
	);

	const { defineField, errors, handleSubmit, resetForm, setFieldValue } = useForm({
		validationSchema: schema,
		initialValues: {
			title: '',
			assigneeId: props.defaultAssigneeId ?? authStore.user?.id ?? undefined,
			dueDate: props.defaultDueDate ?? undefined,
			points: undefined,
		},
	});
	const [title] = defineField('title');
	const [assigneeId] = defineField('assigneeId');
	const [dueDate] = defineField('dueDate');
	const [points] = defineField('points');

	const pop = ref<'person' | 'due' | 'points' | null>(null);
	const saving = ref(false);
	const rootRef = ref<HTMLElement | null>(null);
	const titleRef = ref<HTMLInputElement | null>(null);
	const personBtn = ref<HTMLButtonElement | null>(null);
	const dueBtn = ref<HTMLButtonElement | null>(null);
	const pointsBtn = ref<HTMLButtonElement | null>(null);

	const people = computed<PickablePerson[]>(() =>
		employees.value.map(e => ({ id: e.id, fullName: e.fullName, hint: e.department?.name ?? e.employeeCode })),
	);
	const personModel = computed<number[]>({
		get: () => (assigneeId.value ? [assigneeId.value] : []),
		set: v => {
			assigneeId.value = v[0];
			if (v[0]) pop.value = null;
		},
	});
	const assigneeName = computed(() => {
		const id = assigneeId.value;
		if (!id) return 'Người';
		if (id === authStore.user?.id) return 'Tôi';
		return employees.value.find(e => e.id === id)?.fullName ?? 'Người';
	});

	const dueOptions = quickDueOptions(today);

	function togglePop(name: 'person' | 'due' | 'points') {
		pop.value = pop.value === name ? null : name;
		if (pop.value === 'person') directoryStore.load().catch(() => toast.error('Chưa tải được danh sách nhân viên.'));
	}

	function onDocPointer(e: PointerEvent) {
		if (pop.value && rootRef.value && !rootRef.value.contains(e.target as Node)) pop.value = null;
	}
	onMounted(() => document.addEventListener('pointerdown', onDocPointer));
	onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocPointer));

	const submit = handleSubmit(
		async values => {
			saving.value = true;
			try {
				const created = await service.create({
					title: values.title.trim(),
					assigneeId: values.assigneeId,
					dueDate: values.dueDate,
					points: values.points,
					projectId: props.parentId ? undefined : (props.projectId ?? undefined),
					parentId: props.parentId ?? undefined,
					groupId: !props.parentId && props.projectId && props.groupId ? props.groupId : undefined,
					sprintId: !props.parentId && props.projectId && props.sprintId ? props.sprintId : undefined,
				});
				toast.success(`Đã tạo ${created.code}`);
				resetForm({
					values: {
						title: '',
						assigneeId: assigneeId.value,
						dueDate: dueDate.value,
						points: undefined,
					},
				});
				emit('created', created);
				nextTick(() => titleRef.value?.focus());
			} catch (err) {
				toast.error(taskErrorInfo(err).message);
			} finally {
				saving.value = false;
			}
		},
		({ errors: errs }) => {
			// Nhảy tới ô thiếu đầu tiên theo thứ tự trên dòng.
			if (errs.title) titleRef.value?.focus();
			else if (errs.assigneeId) personBtn.value?.focus();
			else if (errs.dueDate) dueBtn.value?.focus();
			else if (errs.points) pointsBtn.value?.focus();
		},
	);

	function pickPoints(p: number) {
		setFieldValue('points', p);
		pop.value = null;
	}

	function pickDue(v: string | undefined) {
		dueDate.value = v;
		if (v) pop.value = null;
	}

	const btnBase =
		'inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500';
	function btnClass(err?: string) {
		return err
			? `${btnBase} border-rose-500 text-rose-600 dark:text-rose-400`
			: `${btnBase} border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800`;
	}
</script>

<template>
	<form
		ref="rootRef"
		data-no-drag
		data-testid="task-quick-create"
		class="relative rounded-lg border border-dashed border-gray-300 bg-white/60 p-2 dark:border-gray-700 dark:bg-gray-900/40"
		@submit.prevent="submit"
	>
		<input
			ref="titleRef"
			v-model="title"
			type="text"
			maxlength="500"
			:disabled="disabled || saving"
			:placeholder="placeholder"
			:aria-invalid="!!errors.title"
			aria-label="Tiêu đề việc mới"
			class="w-full rounded-md border bg-white px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:text-gray-100"
			:class="errors.title ? 'border-rose-500' : 'border-gray-200 dark:border-gray-700'"
		/>
		<div class="mt-1.5 flex flex-wrap items-center gap-1.5">
			<button ref="personBtn" type="button" :class="btnClass(errors.assigneeId)" :aria-expanded="pop === 'person'" @click="togglePop('person')">
				<Icon name="heroicons:user" class="h-3.5 w-3.5" aria-hidden="true" />
				<span class="max-w-[8rem] truncate">{{ assigneeName }}</span>
			</button>
			<button ref="dueBtn" type="button" :class="btnClass(errors.dueDate)" :aria-expanded="pop === 'due'" @click="togglePop('due')">
				<Icon name="heroicons:calendar" class="h-3.5 w-3.5" aria-hidden="true" />
				{{ dueDate ? shortDate(dueDate, today) : 'Hạn' }}
			</button>
			<button ref="pointsBtn" type="button" :class="btnClass(errors.points)" :aria-expanded="pop === 'points'" @click="togglePop('points')">
				{{ points ? `${points} điểm` : 'Điểm' }}
			</button>
			<CommonAppButton type="submit" size="sm" :loading="saving" :disabled="disabled" class="ml-auto">Thêm</CommonAppButton>
		</div>

		<div
			v-if="pop"
			class="absolute left-0 right-0 top-full z-30 mt-1 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-900"
		>
			<EmployeePicker v-if="pop === 'person'" v-model="personModel" :people="people" single label="Người thực hiện" />
			<div v-else-if="pop === 'due'" class="space-y-2">
				<div class="flex flex-wrap gap-1.5">
					<button
						v-for="o in dueOptions"
						:key="o.label"
						type="button"
						class="rounded-md border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:hover:bg-gray-800"
						:class="dueDate === o.value ? 'border-brand-500 text-brand-700 dark:text-brand-300' : 'text-gray-700 dark:text-gray-300'"
						@click="pickDue(o.value)"
					>
						{{ o.label }}
					</button>
				</div>
				<UiDatePicker :model-value="dueDate" label="Chọn ngày" @update:model-value="pickDue" />
			</div>
			<div v-else class="space-y-1.5">
				<p class="text-xs text-gray-500 dark:text-gray-400">Điểm khối lượng: việc càng nặng điểm càng cao.</p>
				<div class="flex gap-1.5">
					<button
						v-for="p in POINT_SCALE"
						:key="p"
						type="button"
						class="h-9 w-9 rounded-md border text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
						:class="points === p ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'"
						@click="pickPoints(p)"
					>
						{{ p }}
					</button>
				</div>
			</div>
		</div>
		<p v-if="Object.keys(errors).length" class="mt-1 text-xs text-rose-600 dark:text-rose-400">
			{{ Object.values(errors).filter(Boolean).join(', ') }}
		</p>
	</form>
</template>
