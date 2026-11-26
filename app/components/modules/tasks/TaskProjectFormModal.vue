<script setup lang="ts">
	import { storeToRefs } from 'pinia';
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import { useDirectoryStore } from '~/stores/directory';
	import { useTasksService } from '~/services/tasks.service';
	import type { TaskProject, TaskProjectDetail } from '~/types/tasks.types';
	import { projectCodeError, taskErrorInfo } from '~/utils/tasks.utils';

	/**
	 * Tạo hoặc sửa dự án. Ai cũng tạo được dự án (Q-20), người tạo thành Quản lý dự án. Mã dự án là
	 * tiền tố số hiệu việc (`HQ-12`) nên không sửa được sau khi tạo.
	 */
	const props = withDefaults(defineProps<{ project?: TaskProject | null }>(), { project: null });
	const emit = defineEmits<{ close: []; saved: [project: TaskProjectDetail] }>();

	const directoryStore = useDirectoryStore();
	const { departments } = storeToRefs(directoryStore);
	const service = useTasksService();
	const toast = useToast();
	const isEdit = computed(() => !!props.project);

	onMounted(() => directoryStore.load().catch(() => {}));

	const schema = toTypedSchema(
		z
			.object({
				code: z.string(),
				name: z.string({ required_error: 'Nhập tên dự án' }).trim().min(1, 'Nhập tên dự án').max(200, 'Tên tối đa 200 ký tự'),
				description: z.string(),
				departmentId: z.string(),
			})
			.superRefine((v, ctx) => {
				if (isEdit.value) return;
				const err = projectCodeError(v.code);
				if (err) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['code'], message: err });
			}),
	);

	const { defineField, errors, handleSubmit, isSubmitting } = useForm({
		validationSchema: schema,
		initialValues: {
			code: props.project?.code ?? '',
			name: props.project?.name ?? '',
			description: props.project?.description ?? '',
			departmentId: props.project?.department ? String(props.project.department.id) : '',
		},
	});
	const [code] = defineField('code');
	const [name] = defineField('name');
	const [description] = defineField('description');
	const [departmentId] = defineField('departmentId');

	const deptOptions = computed(() => [
		{ value: '', label: 'Không gắn phòng' },
		...departments.value.map(d => ({ value: String(d.id), label: d.name })),
	]);

	const onSubmit = handleSubmit(async v => {
		try {
			const saved = isEdit.value && props.project
				? await service.updateProject(props.project.id, {
						name: v.name.trim(),
						description: v.description.trim(),
						departmentId: v.departmentId ? Number(v.departmentId) : null,
					})
				: await service.createProject({
						code: v.code.trim().toUpperCase(),
						name: v.name.trim(),
						description: v.description.trim() || undefined,
						departmentId: v.departmentId ? Number(v.departmentId) : undefined,
					});
			toast.success(isEdit.value ? 'Đã lưu dự án' : `Đã tạo dự án ${saved.code}`);
			emit('saved', saved);
		} catch (err) {
			toast.error(taskErrorInfo(err).message);
		}
	});

	useEscapeKey(() => emit('close'), () => !isSubmitting.value);
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-0 sm:p-4" @click.self="emit('close')">
			<form
				class="w-full max-w-lg bg-white shadow-xl sm:my-8 sm:rounded-2xl dark:bg-gray-900"
				role="dialog"
				aria-modal="true"
				:aria-label="isEdit ? 'Sửa dự án' : 'Tạo dự án'"
				data-testid="project-form"
				@submit.prevent="onSubmit"
			>
				<div class="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ isEdit ? 'Sửa dự án' : 'Tạo dự án' }}</h2>
					<button type="button" class="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Đóng" @click="emit('close')">
						<Icon name="heroicons:x-mark" class="h-5 w-5" />
					</button>
				</div>
				<div class="space-y-4 px-5 py-4">
					<div>
						<label for="project-code" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Mã dự án <span v-if="!isEdit" class="text-red-500">*</span></label>
						<input
							id="project-code"
							v-model="code"
							:disabled="isEdit"
							maxlength="6"
							placeholder="VD: HQ"
							class="mt-1 w-32 rounded-lg border bg-white px-3 py-2 text-sm uppercase text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-100 dark:bg-gray-800 dark:text-gray-100 dark:disabled:bg-gray-700"
							:class="errors.code ? 'border-rose-500' : 'border-gray-300 dark:border-gray-600'"
						/>
						<p v-if="errors.code" class="mt-1 text-xs text-rose-600">{{ errors.code }}</p>
						<p v-else class="mt-1 text-xs text-gray-500">Đứng đầu số hiệu mọi việc trong dự án, ví dụ HQ-12. Không đổi được sau khi tạo.</p>
					</div>
					<div>
						<label for="project-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Tên dự án <span class="text-red-500">*</span></label>
						<input
							id="project-name"
							v-model="name"
							maxlength="200"
							class="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:text-gray-100"
							:class="errors.name ? 'border-rose-500' : 'border-gray-300 dark:border-gray-600'"
						/>
						<p v-if="errors.name" class="mt-1 text-xs text-rose-600">{{ errors.name }}</p>
					</div>
					<UiSelect :model-value="departmentId" label="Phòng chủ quản" :options="deptOptions" searchable @update:model-value="v => (departmentId = v == null ? '' : String(v))" />
					<div>
						<label for="project-desc" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Mô tả</label>
						<textarea
							id="project-desc"
							v-model="description"
							rows="3"
							class="mt-1 w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
						/>
					</div>
				</div>
				<div class="flex justify-end gap-3 border-t border-gray-200 px-5 py-4 dark:border-gray-700">
					<CommonAppButton variant="secondary" :disabled="isSubmitting" @click="emit('close')">Huỷ</CommonAppButton>
					<CommonAppButton type="submit" :loading="isSubmitting" data-testid="project-form-submit">{{ isEdit ? 'Lưu' : 'Tạo dự án' }}</CommonAppButton>
				</div>
			</form>
		</div>
	</Teleport>
</template>
