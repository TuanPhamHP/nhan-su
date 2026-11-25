<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import { useTasksService } from '~/services/tasks.service';
	import type { TaskSprint } from '~/types/tasks.types';
	import { timelineAddDays } from '~/utils/task-timeline';
	import { taskErrorInfo, vnToday } from '~/utils/tasks.utils';

	/** Tạo, sửa một đợt: tên, mục tiêu, ngày bắt đầu và kết thúc. Đợt đã đóng không sửa được. */
	const props = withDefaults(defineProps<{ projectId: number; sprint?: TaskSprint | null; suggestedName?: string; suggestedStart?: string }>(), {
		sprint: null,
		suggestedName: '',
		suggestedStart: '',
	});
	const emit = defineEmits<{ close: []; saved: [sprint: TaskSprint] }>();

	const service = useTasksService();
	const toast = useToast();
	const start0 = props.sprint?.startDate ?? (props.suggestedStart || vnToday());

	const schema = toTypedSchema(
		z
			.object({
				name: z.string({ required_error: 'Nhập tên đợt' }).trim().min(1, 'Nhập tên đợt').max(100, 'Tên tối đa 100 ký tự'),
				goal: z.string().max(500, 'Mục tiêu tối đa 500 ký tự'),
				startDate: z.string({ required_error: 'Chọn ngày bắt đầu' }).min(1, 'Chọn ngày bắt đầu'),
				endDate: z.string({ required_error: 'Chọn ngày kết thúc' }).min(1, 'Chọn ngày kết thúc'),
			})
			.refine(v => v.startDate <= v.endDate, { message: 'Ngày kết thúc không được trước ngày bắt đầu', path: ['endDate'] }),
	);
	const { defineField, errors, handleSubmit, isSubmitting } = useForm({
		validationSchema: schema,
		initialValues: {
			name: props.sprint?.name ?? props.suggestedName,
			goal: props.sprint?.goal ?? '',
			startDate: start0,
			endDate: props.sprint?.endDate ?? timelineAddDays(start0, 13),
		},
	});
	const [name] = defineField('name');
	const [goal] = defineField('goal');
	const [startDate] = defineField('startDate');
	const [endDate] = defineField('endDate');

	const onSubmit = handleSubmit(async v => {
		const body = { name: v.name.trim(), goal: v.goal.trim() || undefined, startDate: v.startDate, endDate: v.endDate };
		try {
			const saved = props.sprint
				? await service.updateSprint(props.projectId, props.sprint.id, body)
				: await service.createSprint(props.projectId, body);
			toast.success(props.sprint ? `Đã lưu ${saved.name}` : `Đã tạo ${saved.name}`);
			emit('saved', saved);
		} catch (err) {
			toast.error(taskErrorInfo(err).message);
		}
	});
	useEscapeKey(() => emit('close'), () => !isSubmitting.value);
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" @click.self="emit('close')">
			<form
				class="w-full max-w-md rounded-t-2xl bg-white shadow-xl sm:rounded-2xl dark:bg-gray-900"
				role="dialog"
				aria-modal="true"
				:aria-label="sprint ? 'Sửa đợt' : 'Tạo đợt'"
				data-testid="sprint-form"
				@submit.prevent="onSubmit"
			>
				<div class="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ sprint ? `Sửa ${sprint.name}` : 'Tạo đợt' }}</h2>
					<button type="button" class="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Đóng" @click="emit('close')">
						<Icon name="heroicons:x-mark" class="h-5 w-5" />
					</button>
				</div>
				<div class="space-y-4 px-5 py-4">
					<div>
						<label for="sprint-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Tên đợt <span class="text-red-500">*</span></label>
						<input
							id="sprint-name"
							v-model="name"
							type="text"
							maxlength="100"
							placeholder="Ví dụ Đợt 3"
							class="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:text-gray-100"
							:class="errors.name ? 'border-rose-500' : 'border-gray-300 dark:border-gray-600'"
						/>
						<p v-if="errors.name" class="mt-1 text-xs text-rose-600">{{ errors.name }}</p>
					</div>
					<div>
						<label for="sprint-goal" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Mục tiêu</label>
						<textarea
							id="sprint-goal"
							v-model="goal"
							rows="2"
							maxlength="500"
							placeholder="Đợt này xong được gì"
							class="mt-1 w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
						/>
					</div>
					<div class="grid gap-4 sm:grid-cols-2">
						<UiDatePicker v-model="startDate" label="Bắt đầu *" :error="errors.startDate" />
						<UiDatePicker v-model="endDate" label="Kết thúc *" :error="errors.endDate" />
					</div>
				</div>
				<div class="flex justify-end gap-3 border-t border-gray-200 px-5 py-3 dark:border-gray-700">
					<CommonAppButton variant="secondary" :disabled="isSubmitting" @click="emit('close')">Huỷ</CommonAppButton>
					<CommonAppButton type="submit" :loading="isSubmitting" data-testid="sprint-form-submit">{{ sprint ? 'Lưu' : 'Tạo đợt' }}</CommonAppButton>
				</div>
			</form>
		</div>
	</Teleport>
</template>
