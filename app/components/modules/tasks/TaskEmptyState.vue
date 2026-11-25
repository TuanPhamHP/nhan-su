<script setup lang="ts">
	/**
	 * Ba kiểu rỗng (mục 9.2): chưa có việc (giọng khích lệ, nút làm việc đầu tiên), đã xong hết (giọng
	 * vui), lọc không ra (giọng trung tính, nút Xoá bộ lọc). Ngoài ra là khối lỗi kèm Thử lại.
	 */
	const props = defineProps<{
		kind: 'none' | 'done' | 'filtered' | 'error';
		title: string;
		description?: string;
		actionLabel?: string;
		/** Nút thứ hai, ví dụ "Tạo dự án mẫu" cạnh "Tạo dự án". */
		secondaryLabel?: string;
	}>();
	const emit = defineEmits<{ action: []; secondary: [] }>();

	const ICON: Record<typeof props.kind, string> = {
		none: 'heroicons:clipboard-document-list',
		done: 'heroicons:check-badge',
		filtered: 'heroicons:funnel',
		error: 'heroicons:exclamation-triangle',
	};
</script>

<template>
	<div
		class="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center"
		:class="kind === 'error' ? 'border-rose-200 bg-rose-50/50 dark:border-rose-800 dark:bg-rose-900/10' : 'border-gray-200 dark:border-gray-700'"
		:data-testid="`task-empty-${kind}`"
		:role="kind === 'error' ? 'alert' : undefined"
	>
		<Icon
			:name="ICON[kind]"
			class="h-10 w-10"
			:class="kind === 'done' ? 'text-emerald-500' : kind === 'error' ? 'text-rose-500' : 'text-gray-400'"
			aria-hidden="true"
		/>
		<h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ title }}</h3>
		<p v-if="description" class="max-w-md text-sm text-gray-600 dark:text-gray-400">{{ description }}</p>
		<div v-if="actionLabel || secondaryLabel" class="mt-1 flex flex-wrap justify-center gap-2">
			<CommonAppButton v-if="actionLabel" size="sm" :variant="kind === 'none' ? 'primary' : 'secondary'" @click="emit('action')">
				{{ actionLabel }}
			</CommonAppButton>
			<CommonAppButton v-if="secondaryLabel" size="sm" variant="outline" data-testid="task-empty-secondary" @click="emit('secondary')">
				{{ secondaryLabel }}
			</CommonAppButton>
		</div>
	</div>
</template>
