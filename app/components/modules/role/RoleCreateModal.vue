<script setup lang="ts">
import { useForm } from 'vee-validate';

const emit = defineEmits<{
	close: [];
	created: [roleId: number];
}>();

const toast = useToast();
const { createRole } = useRole();

const { handleSubmit, defineField, errors, isSubmitting } = useForm<{
	name: string;
	description: string;
}>({
	validationSchema: {
		name: (v: string) => (v && v.trim().length > 0) || 'Vui lòng nhập tên vai trò',
		description: () => true,
	},
});

const [name, nameAttrs] = defineField('name');
const [description, descriptionAttrs] = defineField('description');

const onSubmit = handleSubmit(async values => {
	try {
		const created = await createRole({
			name: values.name.trim(),
			description: values.description?.trim() || undefined,
		});
		toast.success(`Đã tạo vai trò "${created.name}"`);
		emit('created', created.id);
	} catch (e) {
		toast.error(e instanceof Error ? e.message : 'Lỗi tạo vai trò');
	}
});
</script>

<template>
	<Teleport to="body">
		<Transition
			enter-active-class="transition ease-out duration-150"
			enter-from-class="opacity-0"
			enter-to-class="opacity-100"
			leave-active-class="transition ease-in duration-100"
			leave-from-class="opacity-100"
			leave-to-class="opacity-0"
		>
			<div
				class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
				@click.self="emit('close')"
			>
				<div
					class="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-md w-full mx-4 shadow-xl border border-gray-200 dark:border-gray-700"
				>
					<div class="flex items-center justify-between mb-5">
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">Tạo vai trò mới</h2>
						<button
							class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
							@click="emit('close')"
						>
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>

					<form class="space-y-4" @submit.prevent="onSubmit">
						<CommonAppInput
							v-model="name"
							v-bind="nameAttrs"
							label="Tên vai trò"
							placeholder="VD: Trưởng phòng kỹ thuật"
							required
							:error="errors.name"
						/>

						<div class="flex flex-col gap-1">
							<label class="text-sm font-medium text-gray-700 dark:text-gray-300">Mô tả</label>
							<textarea
								v-model="description"
								v-bind="descriptionAttrs"
								rows="3"
								placeholder="Mô tả ngắn về vai trò này..."
								class="block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-500 dark:focus:border-brand-400 resize-none transition-colors"
							/>
						</div>

						<div class="flex justify-end gap-3 pt-1">
							<CommonAppButton variant="outline" type="button" @click="emit('close')">Hủy</CommonAppButton>
							<CommonAppButton type="submit" :loading="isSubmitting">Tạo vai trò</CommonAppButton>
						</div>
					</form>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>
