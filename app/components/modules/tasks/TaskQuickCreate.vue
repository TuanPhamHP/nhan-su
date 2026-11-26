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
	 * Điểm. Chỉ tiêu đề là bắt buộc. Người điền sẵn theo ngữ cảnh (người của nhóm đang đứng, không thì
	 * chính mình); Hạn và Điểm để trống thì việc không có hạn (không bao giờ quá hạn) và chưa có điểm
	 * (tính 0 khi cộng khối lượng).
	 *
	 * Hộp chọn của ba nút được đưa ra `body` và đặt `fixed` theo dòng tạo nhanh, vì dòng này nằm trong
	 * cột có thanh cuộn riêng: đặt trong cột thì hộp bị cắt và phải cuộn cột mới thấy.
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
			assigneeId: z.number().optional(),
			dueDate: z.string().optional(),
			points: z.number().optional(),
		}),
	);

	const { defineField, errors, handleSubmit, resetForm, setFieldValue } = useForm({
		validationSchema: schema,
		initialValues: {
			title: '',
			assigneeId: props.defaultAssigneeId ?? undefined,
			dueDate: props.defaultDueDate ?? undefined,
			points: undefined,
		},
	});
	const [title] = defineField('title');
	const [assigneeId] = defineField('assigneeId');
	const [dueDate] = defineField('dueDate');
	const [points] = defineField('points');

	type PopName = 'person' | 'due' | 'points';
	const pop = ref<PopName | null>(null);
	const saving = ref(false);
	const rootRef = ref<HTMLElement | null>(null);
	const panelRef = ref<HTMLElement | null>(null);
	const titleRef = ref<HTMLInputElement | null>(null);
	const personBtn = ref<HTMLButtonElement | null>(null);
	const dueBtn = ref<HTMLButtonElement | null>(null);
	const pointsBtn = ref<HTMLButtonElement | null>(null);
	const panelStyle = ref<Record<string, string>>({});

	// Người dùng chưa chọn người thì giao cho chính mình.
	const effectiveAssigneeId = computed(() => assigneeId.value ?? authStore.user?.id);

	const people = computed<PickablePerson[]>(() =>
		employees.value.map(e => ({ id: e.id, fullName: e.fullName, hint: e.department?.name ?? e.employeeCode })),
	);
	const personModel = computed<number[]>({
		get: () => (effectiveAssigneeId.value ? [effectiveAssigneeId.value] : []),
		set: v => {
			assigneeId.value = v[0];
			if (v[0]) closePop();
		},
	});
	const assigneeName = computed(() => {
		const id = effectiveAssigneeId.value;
		if (!id) return 'Người';
		if (id === authStore.user?.id) return 'Tôi';
		return employees.value.find(e => e.id === id)?.fullName ?? 'Người';
	});
	const dueText = computed(() => (dueDate.value ? shortDate(dueDate.value, today) : 'Hạn'));
	const pointsText = computed(() => (points.value ? `${points.value} điểm` : 'Điểm'));

	const dueOptions = quickDueOptions(today);

	/** Chiều cao ước lượng của hộp chọn (hộp Hạn cao nhất), dùng để quyết định mở xuống hay mở lên. */
	const PANEL_H = 160;
	const PANEL_MIN_W = 288;

	function placePanel() {
		const rect = rootRef.value?.getBoundingClientRect();
		if (!rect) return;
		const width = Math.min(Math.max(rect.width, PANEL_MIN_W), window.innerWidth - 16);
		const left = Math.min(Math.max(rect.left, 8), window.innerWidth - width - 8);
		const style: Record<string, string> = { left: `${left}px`, width: `${width}px` };
		const panelH = panelRef.value?.offsetHeight || PANEL_H;
		if (window.innerHeight - rect.bottom < panelH + 8 && rect.top > panelH + 8) {
			style.bottom = `${window.innerHeight - rect.top + 4}px`;
		} else {
			style.top = `${rect.bottom + 4}px`;
		}
		panelStyle.value = style;
	}

	function triggerOf(name: PopName) {
		return { person: personBtn, due: dueBtn, points: pointsBtn }[name].value;
	}

	function closePop(refocus = false) {
		const was = pop.value;
		pop.value = null;
		if (refocus && was) triggerOf(was)?.focus();
	}

	function togglePop(name: PopName) {
		if (pop.value === name) {
			closePop();
			return;
		}
		pop.value = name;
		placePanel();
		// Đo lại sau khi hộp hiện ra để biết chiều cao thật.
		nextTick(placePanel);
		if (name === 'person') directoryStore.load().catch(() => toast.error('Chưa tải được danh sách nhân viên.'));
	}

	function onDocPointer(e: PointerEvent) {
		const target = e.target;
		if (!(target instanceof Element)) return;
		// Lịch của ô chọn ngày cũng được đưa ra `body`, bấm vào đó không tính là bấm ra ngoài.
		if (rootRef.value?.contains(target) || panelRef.value?.contains(target) || target.closest('[data-floating-panel]')) return;
		closePop();
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape' || e.defaultPrevented) return;
		e.preventDefault();
		closePop(true);
	}

	function unbind() {
		document.removeEventListener('pointerdown', onDocPointer);
		document.removeEventListener('keydown', onKeydown);
		window.removeEventListener('scroll', placePanel, true);
		window.removeEventListener('resize', placePanel);
	}

	watch(pop, open => {
		unbind();
		if (!open) return;
		document.addEventListener('pointerdown', onDocPointer);
		document.addEventListener('keydown', onKeydown);
		window.addEventListener('scroll', placePanel, true);
		window.addEventListener('resize', placePanel);
	});
	onBeforeUnmount(unbind);

	const submit = handleSubmit(
		async values => {
			const assignee = effectiveAssigneeId.value;
			if (!assignee) {
				personBtn.value?.focus();
				return;
			}
			saving.value = true;
			closePop();
			try {
				const created = await service.create({
					title: values.title.trim(),
					assigneeId: assignee,
					dueDate: dueDate.value || undefined,
					points: points.value,
					projectId: props.parentId ? undefined : (props.projectId ?? undefined),
					parentId: props.parentId ?? undefined,
					groupId: !props.parentId && props.projectId && props.groupId ? props.groupId : undefined,
					sprintId: !props.parentId && props.projectId && props.sprintId ? props.sprintId : undefined,
				});
				toast.success(`Đã tạo ${created.code}`);
				// Giữ người vừa chọn cho việc tiếp theo; hạn và điểm về như lúc đầu.
				resetForm({
					values: {
						title: '',
						assigneeId: assigneeId.value,
						dueDate: props.defaultDueDate ?? undefined,
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
		() => titleRef.value?.focus(),
	);

	/** Bấm lại đúng mức đang chọn thì bỏ điểm. */
	function pickPoints(p: number | undefined) {
		setFieldValue('points', p === points.value ? undefined : p);
		closePop(true);
	}

	function pickDue(v: string | undefined) {
		// Ô chọn ngày ghi lại ngày cũ khi mất focus (lúc bấm vào lịch của nó), nên chỉ đóng hộp khi ngày
		// thật sự đổi, không thì hộp đóng trước khi cú bấm vào lịch kịp tới.
		const changed = !!v && v !== dueDate.value;
		dueDate.value = v;
		if (changed) closePop(true);
	}

	function clearDue() {
		dueDate.value = undefined;
		closePop(true);
	}

	const btnBase =
		'inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500';
	function btnClass(name: PopName) {
		return pop.value === name
			? `${btnBase} border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300`
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
		<p v-if="errors.title" class="mt-1 text-xs text-rose-600 dark:text-rose-400">{{ errors.title }}.</p>
		<div class="mt-1.5 flex flex-wrap items-center gap-1.5">
			<button
				ref="personBtn"
				type="button"
				:class="btnClass('person')"
				:aria-expanded="pop === 'person'"
				:aria-label="`Người thực hiện: ${assigneeName}. Bấm để đổi`"
				@click="togglePop('person')"
			>
				<Icon name="heroicons:user" class="h-3.5 w-3.5" aria-hidden="true" />
				<span class="max-w-[8rem] truncate">{{ assigneeName }}</span>
			</button>
			<button
				ref="dueBtn"
				type="button"
				:class="btnClass('due')"
				:aria-expanded="pop === 'due'"
				:aria-label="dueDate ? `Hạn: ${dueText}. Bấm để đổi` : 'Hạn: chưa đặt, không bắt buộc. Bấm để chọn'"
				@click="togglePop('due')"
			>
				<Icon name="heroicons:calendar" class="h-3.5 w-3.5" aria-hidden="true" />
				{{ dueText }}
			</button>
			<button
				ref="pointsBtn"
				type="button"
				:class="btnClass('points')"
				:aria-expanded="pop === 'points'"
				:aria-label="points ? `Điểm: ${points}. Bấm để đổi` : 'Điểm: chưa chấm, không bắt buộc. Bấm để chọn'"
				@click="togglePop('points')"
			>
				{{ pointsText }}
			</button>
			<CommonAppButton type="submit" size="sm" :loading="saving" :disabled="disabled" class="ml-auto">Thêm</CommonAppButton>
		</div>

		<Teleport to="body">
			<div
				v-if="pop"
				ref="panelRef"
				data-no-drag
				data-testid="task-quick-create-panel"
				:style="panelStyle"
				class="fixed z-[80] max-h-[70vh] overflow-y-auto rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-900"
			>
				<EmployeePicker v-if="pop === 'person'" v-model="personModel" :people="people" single label="Người thực hiện" />
				<div v-else-if="pop === 'due'" class="space-y-2">
					<div class="flex flex-wrap gap-1.5">
						<button
							v-for="o in dueOptions"
							:key="o.label"
							type="button"
							class="rounded-md border px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
							:class="dueDate === o.value ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'"
							@click="pickDue(o.value)"
						>
							{{ o.label }}
						</button>
					</div>
					<UiDatePicker :model-value="dueDate" label="Chọn ngày khác" @update:model-value="pickDue" />
					<button
						v-if="dueDate"
						type="button"
						class="text-xs font-medium text-gray-500 underline-offset-2 hover:text-gray-700 hover:underline focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-gray-400 dark:hover:text-gray-200"
						@click="clearDue"
					>
						Bỏ hạn
					</button>
				</div>
				<div v-else class="space-y-1.5">
					<p class="text-xs text-gray-500 dark:text-gray-400">
						Điểm khối lượng: việc càng nặng, điểm càng cao. Chưa chấm thì tính 0 điểm.
					</p>
					<div class="flex flex-wrap gap-1.5">
						<button
							v-for="p in POINT_SCALE"
							:key="p"
							type="button"
							:aria-pressed="points === p"
							class="h-9 w-9 rounded-md border text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
							:class="points === p ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'"
							@click="pickPoints(p)"
						>
							{{ p }}
						</button>
						<button
							v-if="points"
							type="button"
							class="h-9 rounded-md px-2 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
							@click="pickPoints(undefined)"
						>
							Bỏ điểm
						</button>
					</div>
				</div>
			</div>
		</Teleport>
	</form>
</template>
