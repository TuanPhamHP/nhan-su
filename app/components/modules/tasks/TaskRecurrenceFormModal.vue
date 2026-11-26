<script setup lang="ts">
	import { storeToRefs } from 'pinia';
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import EmployeePicker, { type PickablePerson } from '~/components/modules/general-request/EmployeePicker.vue';
	import { useAuthStore } from '~/stores/auth';
	import { useDirectoryStore } from '~/stores/directory';
	import { useTasksService } from '~/services/tasks.service';
	import type { TaskPriority, TaskProject, TaskRecurrence, TaskRecurrenceFrequency } from '~/types/tasks.types';
	import {
		FREQUENCY_LABELS,
		POINT_SCALE,
		PRIORITY_LABELS,
		TASK_HINTS,
		WEEKDAY_LABELS,
		WEEKDAY_SHORT,
		recurrenceText,
		taskErrorInfo,
		vnToday,
	} from '~/utils/tasks.utils';

	/**
	 * Tạo, sửa việc định kỳ (UI-07, F-11). Tần suất tuần, tháng, quý, năm; thứ trong tuần; ngày trong
	 * tháng (ngày 31 ở tháng ngắn lấy ngày cuối tháng); số ngày báo trước. Năm hạn sắp tới do máy chủ
	 * tính và trả về sau khi lưu, trang hiện ngay ở khung chi tiết. Sửa chỉ có hiệu lực từ lần sinh sau,
	 * không đổi dự án.
	 */
	const props = withDefaults(defineProps<{ recurrence?: TaskRecurrence | null }>(), { recurrence: null });
	const emit = defineEmits<{ close: []; saved: [r: TaskRecurrence] }>();

	const authStore = useAuthStore();
	const directoryStore = useDirectoryStore();
	const { employees } = storeToRefs(directoryStore);
	const service = useTasksService();
	const toast = useToast();
	const today = vnToday();
	const editing = computed(() => !!props.recurrence);

	const projects = ref<TaskProject[]>([]);
	onMounted(async () => {
		directoryStore.load().catch(() => toast.error('Chưa tải được danh sách nhân viên.'));
		if (editing.value) return;
		try {
			const res = await service.listProjects({ status: 'ACTIVE', limit: 100 });
			projects.value = res.data.filter(p => p.myRole === 'MANAGER' || p.myRole === 'MEMBER');
		} catch {
			projects.value = [];
		}
	});

	const r = props.recurrence;
	const schema = toTypedSchema(
		z
			.object({
				title: z.string({ required_error: 'Nhập tiêu đề' }).trim().min(1, 'Nhập tiêu đề').max(500, 'Tiêu đề tối đa 500 ký tự'),
				assigneeIds: z.array(z.number()).min(1, 'Chọn người thực hiện'),
				reviewerIds: z.array(z.number()),
				points: z.number({ required_error: 'Chọn điểm khối lượng', invalid_type_error: 'Chọn điểm khối lượng' }),
				priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
				projectId: z.string(),
				frequency: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']),
				interval: z.number({ invalid_type_error: 'Nhập số từ 1 đến 12' }).int('Nhập số nguyên').min(1, 'Ít nhất 1').max(12, 'Nhiều nhất 12'),
				weekdays: z.array(z.number()),
				dayOfMonth: z.number().int().min(1).max(31),
				monthOfPeriod: z.number().int().min(1).max(12),
				leadDays: z.number({ invalid_type_error: 'Nhập số từ 0 đến 60' }).int('Nhập số nguyên').min(0, 'Ít nhất 0').max(60, 'Nhiều nhất 60 ngày'),
				startDate: z.string({ required_error: 'Chọn ngày bắt đầu' }).min(1, 'Chọn ngày bắt đầu'),
				endDate: z.string().optional(),
				checklistText: z.string(),
			})
			.refine(v => v.frequency !== 'WEEKLY' || v.weekdays.length > 0, { message: 'Chọn ít nhất một thứ trong tuần', path: ['weekdays'] })
			.refine(v => v.frequency !== 'QUARTERLY' || v.monthOfPeriod <= 3, { message: 'Tháng thứ mấy trong quý chỉ từ 1 đến 3', path: ['monthOfPeriod'] })
			.refine(v => !v.endDate || v.endDate >= v.startDate, { message: 'Ngày kết thúc không được trước ngày bắt đầu', path: ['endDate'] })
			.refine(v => !v.reviewerIds[0] || v.assigneeIds[0] === authStore.user?.id || v.reviewerIds[0] !== v.assigneeIds[0], {
				message: 'Người thực hiện không tự nghiệm thu việc người khác giao, bạn chọn người khác',
				path: ['reviewerIds'],
			}),
	);

	const { defineField, errors, handleSubmit, isSubmitting } = useForm({
		validationSchema: schema,
		initialValues: {
			title: r?.title ?? '',
			assigneeIds: r ? [r.assignee.id] : authStore.user?.id ? [authStore.user.id] : [],
			reviewerIds: r && r.reviewer.id !== r.assigner.id ? [r.reviewer.id] : [],
			points: r?.points,
			priority: (r?.priority ?? 'NORMAL') as TaskPriority,
			projectId: r?.project ? String(r.project.id) : '',
			frequency: (r?.frequency ?? 'MONTHLY') as TaskRecurrenceFrequency,
			interval: r?.interval ?? 1,
			weekdays: r?.weekdays ?? [1],
			dayOfMonth: r?.dayOfMonth ?? 1,
			monthOfPeriod: r?.monthOfPeriod ?? 1,
			leadDays: r?.leadDays ?? 3,
			startDate: r?.startDate ?? today,
			endDate: r?.endDate ?? undefined,
			checklistText: (r?.checklist ?? []).join('\n'),
		},
	});
	const [title] = defineField('title');
	const [assigneeIds] = defineField('assigneeIds');
	const [reviewerIds] = defineField('reviewerIds');
	const [points] = defineField('points');
	const [priority] = defineField('priority');
	const [projectId] = defineField('projectId');
	const [frequency] = defineField('frequency');
	const [interval] = defineField('interval');
	const [weekdays] = defineField('weekdays');
	const [dayOfMonth] = defineField('dayOfMonth');
	const [monthOfPeriod] = defineField('monthOfPeriod');
	const [leadDays] = defineField('leadDays');
	const [startDate] = defineField('startDate');
	const [endDate] = defineField('endDate');
	const [checklistText] = defineField('checklistText');

	const people = computed<PickablePerson[]>(() =>
		employees.value.map(e => ({ id: e.id, fullName: e.fullName, hint: e.department?.name ?? e.employeeCode })),
	);
	const projectOptions = computed(() => [
		{ value: '', label: 'Việc lẻ (không thuộc dự án)' },
		...projects.value.map(p => ({ value: String(p.id), label: `${p.code} · ${p.name}` })),
	]);
	const frequencyOptions = Object.entries(FREQUENCY_LABELS).map(([value, label]) => ({ value, label }));
	const dayOptions = Array.from({ length: 31 }, (_, i) => ({ value: i + 1, label: `Ngày ${i + 1}` }));
	const monthOptions = computed(() =>
		frequency.value === 'QUARTERLY'
			? [1, 2, 3].map(m => ({ value: m, label: `Tháng thứ ${m} của quý` }))
			: Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `Tháng ${i + 1}` })),
	);
	watch(frequency, f => {
		if (f === 'QUARTERLY' && (monthOfPeriod.value ?? 1) > 3) monthOfPeriod.value = 1;
	});
	const periodWord = computed(() => ({ WEEKLY: 'tuần', MONTHLY: 'tháng', QUARTERLY: 'quý', YEARLY: 'năm' })[frequency.value ?? 'MONTHLY']);

	function toggleWeekday(d: number) {
		const list = weekdays.value ?? [];
		weekdays.value = list.includes(d) ? list.filter(x => x !== d) : [...list, d].sort((a, b) => a - b);
	}

	const summary = computed(() =>
		recurrenceText({
			frequency: frequency.value ?? 'MONTHLY',
			interval: Number(interval.value) || 1,
			weekdays: weekdays.value,
			dayOfMonth: dayOfMonth.value,
			monthOfPeriod: monthOfPeriod.value,
		}),
	);

	const onSubmit = handleSubmit(async v => {
		const checklist = v.checklistText
			.split('\n')
			.map(s => s.trim())
			.filter(Boolean);
		const rule = {
			frequency: v.frequency,
			interval: v.interval,
			weekdays: v.frequency === 'WEEKLY' ? v.weekdays : undefined,
			dayOfMonth: v.frequency === 'WEEKLY' ? undefined : v.dayOfMonth,
			monthOfPeriod: v.frequency === 'QUARTERLY' || v.frequency === 'YEARLY' ? v.monthOfPeriod : undefined,
		};
		try {
			let saved: TaskRecurrence;
			if (props.recurrence) {
				saved = await service.updateRecurrence(props.recurrence.id, {
					title: v.title.trim(),
					assigneeId: v.assigneeIds[0]!,
					reviewerId: v.reviewerIds[0],
					points: v.points,
					priority: v.priority,
					...rule,
					leadDays: v.leadDays,
					startDate: v.startDate,
					endDate: v.endDate || null,
					checklist,
				});
				toast.success('Đã lưu việc định kỳ. Thay đổi có hiệu lực từ lần sau.');
			} else {
				saved = await service.createRecurrence({
					title: v.title.trim(),
					assigneeId: v.assigneeIds[0]!,
					reviewerId: v.reviewerIds[0],
					points: v.points,
					priority: v.priority,
					projectId: v.projectId ? Number(v.projectId) : undefined,
					...rule,
					leadDays: v.leadDays,
					startDate: v.startDate,
					endDate: v.endDate || undefined,
					checklist: checklist.length ? checklist : undefined,
				});
				toast.success('Đã đặt việc định kỳ');
			}
			emit('saved', saved);
		} catch (err) {
			toast.error(taskErrorInfo(err).message);
		}
	});
	useEscapeKey(() => emit('close'), () => !isSubmitting.value);

	const LABEL = 'block text-sm font-medium text-gray-700 dark:text-gray-300';
	const NUM =
		'mt-1 w-24 rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:text-gray-100';
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-0 sm:p-4" @click.self="emit('close')">
			<form
				class="my-0 w-full max-w-2xl rounded-none bg-white shadow-xl sm:my-8 sm:rounded-2xl dark:bg-gray-900"
				role="dialog"
				aria-modal="true"
				:aria-label="editing ? 'Sửa việc định kỳ' : 'Đặt việc định kỳ'"
				data-testid="recurrence-form"
				@submit.prevent="onSubmit"
			>
				<div class="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ editing ? 'Sửa việc định kỳ' : 'Đặt việc định kỳ' }}</h2>
					<button type="button" class="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Đóng" @click="emit('close')">
						<Icon name="heroicons:x-mark" class="h-5 w-5" />
					</button>
				</div>

				<div class="space-y-4 px-5 py-4">
					<p v-if="editing" class="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
						Sửa chỉ áp dụng từ lần giao sau. Việc đã giao giữ nguyên.
					</p>
					<div>
						<label for="rec-title" :class="LABEL">Tiêu đề <span class="text-red-500">*</span></label>
						<input
							id="rec-title"
							v-model="title"
							type="text"
							maxlength="500"
							placeholder="Ví dụ Nộp báo cáo thuế tháng"
							class="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:text-gray-100"
							:class="errors.title ? 'border-rose-500' : 'border-gray-300 dark:border-gray-600'"
						/>
						<p v-if="errors.title" class="mt-1 text-xs text-rose-600">{{ errors.title }}</p>
					</div>

					<div class="grid gap-4 sm:grid-cols-2">
						<EmployeePicker v-model="assigneeIds" :people="people" single label="Người thực hiện *" :error="errors.assigneeIds" />
						<EmployeePicker
							v-model="reviewerIds"
							:people="people"
							single
							label="Người nghiệm thu"
							hint="Bỏ trống thì bạn là người nghiệm thu"
							:error="errors.reviewerIds"
						/>
					</div>

					<!-- Lịch lặp -->
					<fieldset class="space-y-3 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
						<legend class="px-1 text-sm font-semibold text-gray-900 dark:text-white">Lặp lại</legend>
						<div class="grid gap-4 sm:grid-cols-2">
							<UiSelect
								:model-value="frequency"
								label="Tần suất *"
								:options="frequencyOptions"
								data-testid="rec-frequency"
								@update:model-value="v => (frequency = (v as TaskRecurrenceFrequency) ?? 'MONTHLY')"
							/>
							<div>
								<label for="rec-interval" :class="LABEL">Mỗi bao nhiêu {{ periodWord }}</label>
								<div class="flex items-center gap-2">
									<input
										id="rec-interval"
										v-model.number="interval"
										type="number"
										min="1"
										max="12"
										:class="[NUM, errors.interval ? 'border-rose-500' : 'border-gray-300 dark:border-gray-600']"
									/>
									<span class="mt-1 text-sm text-gray-600 dark:text-gray-300">{{ periodWord }} một lần</span>
								</div>
								<p v-if="errors.interval" class="mt-1 text-xs text-rose-600">{{ errors.interval }}</p>
							</div>
						</div>

						<div v-if="frequency === 'WEEKLY'">
							<span :class="LABEL">Vào thứ <span class="text-red-500">*</span></span>
							<div class="mt-1 flex flex-wrap gap-1.5" role="group" aria-label="Thứ trong tuần">
								<button
									v-for="d in [1, 2, 3, 4, 5, 6, 7]"
									:key="d"
									type="button"
									:aria-pressed="weekdays?.includes(d)"
									:aria-label="WEEKDAY_LABELS[d]"
									class="h-9 w-11 rounded-md border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
									:class="weekdays?.includes(d) ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300'"
									:data-testid="`rec-weekday-${d}`"
									@click="toggleWeekday(d)"
								>
									{{ WEEKDAY_SHORT[d] }}
								</button>
							</div>
							<p v-if="errors.weekdays" class="mt-1 text-xs text-rose-600">{{ errors.weekdays }}</p>
						</div>
						<div v-else class="grid gap-4 sm:grid-cols-2">
							<UiSelect
								v-if="frequency !== 'MONTHLY'"
								:model-value="monthOfPeriod"
								:label="frequency === 'QUARTERLY' ? 'Tháng thứ mấy trong quý' : 'Tháng'"
								:options="monthOptions"
								:error="errors.monthOfPeriod"
								@update:model-value="v => (monthOfPeriod = Number(v) || 1)"
							/>
							<div>
								<UiSelect
									:model-value="dayOfMonth"
									label="Ngày trong tháng *"
									:options="dayOptions"
									searchable
									data-testid="rec-day"
									@update:model-value="v => (dayOfMonth = Number(v) || 1)"
								/>
								<p v-if="(dayOfMonth ?? 0) >= 29" class="mt-1 text-xs text-amber-700 dark:text-amber-400">
									Tháng nào không có ngày {{ dayOfMonth }} thì lấy ngày cuối tháng, ví dụ 28 hoặc 29/2.
								</p>
							</div>
						</div>

						<div class="grid gap-4 sm:grid-cols-2">
							<div>
								<label for="rec-lead" :class="LABEL">Hiện việc trước hạn</label>
								<div class="flex items-center gap-2">
									<input
										id="rec-lead"
										v-model.number="leadDays"
										type="number"
										min="0"
										max="60"
										:class="[NUM, errors.leadDays ? 'border-rose-500' : 'border-gray-300 dark:border-gray-600']"
									/>
									<span class="mt-1 text-sm text-gray-600 dark:text-gray-300">ngày</span>
								</div>
								<p v-if="errors.leadDays" class="mt-1 text-xs text-rose-600">{{ errors.leadDays }}</p>
								<p v-else class="mt-1 text-xs text-gray-500">Người làm thấy việc từ ngày đó, kịp chuẩn bị.</p>
							</div>
						</div>
						<div class="grid gap-4 sm:grid-cols-2">
							<UiDatePicker v-model="startDate" label="Bắt đầu từ *" :error="errors.startDate" />
							<UiDatePicker v-model="endDate" label="Kết thúc" :error="errors.endDate" />
						</div>
						<p class="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800 dark:bg-teal-900/20 dark:text-teal-200" data-testid="rec-summary">
							{{ summary }}<template v-if="leadDays">, hiện trước {{ leadDays }} ngày</template>.
							<span class="block text-xs text-teal-700 dark:text-teal-300">Lưu xong bạn sẽ thấy năm hạn sắp tới.</span>
						</p>
					</fieldset>

					<div class="grid gap-4 sm:grid-cols-2">
						<div>
							<span :class="LABEL" :title="TASK_HINTS.points">Điểm khối lượng <span class="text-red-500">*</span></span>
							<div class="mt-1 flex gap-1.5" role="radiogroup" aria-label="Điểm khối lượng">
								<button
									v-for="p in POINT_SCALE"
									:key="p"
									type="button"
									role="radio"
									:aria-checked="points === p"
									class="h-9 w-10 rounded-md border text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
									:class="points === p ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : errors.points ? 'border-rose-500 text-gray-700 dark:text-gray-300' : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300'"
									@click="points = p"
								>
									{{ p }}
								</button>
							</div>
							<p v-if="errors.points" class="mt-1 text-xs text-rose-600">{{ errors.points }}</p>
						</div>
						<UiSelect
							:model-value="priority"
							label="Ưu tiên"
							:options="Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label }))"
							@update:model-value="v => (priority = (v as TaskPriority) ?? 'NORMAL')"
						/>
					</div>

					<UiSelect
						v-if="!editing"
						:model-value="projectId"
						label="Dự án"
						:options="projectOptions"
						searchable
						@update:model-value="v => (projectId = v == null ? '' : String(v))"
					/>
					<p v-else-if="recurrence?.project" class="text-sm text-gray-600 dark:text-gray-300">Dự án {{ recurrence.project.name }} (không đổi được)</p>

					<div>
						<label for="rec-checklist" :class="LABEL">Danh sách kiểm tra mỗi lần</label>
						<textarea
							id="rec-checklist"
							v-model="checklistText"
							rows="3"
							placeholder="Mỗi dòng một mục"
							class="mt-1 w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
						/>
					</div>
				</div>

				<div class="flex justify-end gap-3 border-t border-gray-200 px-5 py-4 dark:border-gray-700">
					<CommonAppButton variant="secondary" :disabled="isSubmitting" @click="emit('close')">Huỷ</CommonAppButton>
					<CommonAppButton type="submit" :loading="isSubmitting" data-testid="recurrence-submit">{{ editing ? 'Lưu' : 'Đặt việc định kỳ' }}</CommonAppButton>
				</div>
			</form>
		</div>
	</Teleport>
</template>
