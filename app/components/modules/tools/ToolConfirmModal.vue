<script setup lang="ts">
withDefaults(
	defineProps<{
		title: string;
		/** Dòng nhắc lại số ngày / số bản ghi sẽ đổi. */
		message: string;
		confirmLabel?: string;
		loading?: boolean;
	}>(),
	{ confirmLabel: 'Áp dụng', loading: false },
);

const emit = defineEmits<{ confirm: []; close: [] }>();
</script>

<template>
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
		<div class="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md">
			<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ title }}</h2>
			</div>

			<div class="px-6 py-5 space-y-3">
				<div class="flex gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20">
					<svg
						class="w-5 h-5 flex-shrink-0 text-amber-600 dark:text-amber-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
						/>
					</svg>
					<p class="text-sm text-amber-800 dark:text-amber-200">{{ message }}</p>
				</div>
				<p class="text-sm text-gray-500 dark:text-gray-400">
					Thao tác này ghi thẳng vào cơ sở dữ liệu. Bạn chắc chắn muốn tiếp tục?
				</p>
			</div>

			<div class="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
				<CommonAppButton variant="ghost" :disabled="loading" @click="emit('close')">Huỷ</CommonAppButton>
				<CommonAppButton variant="danger" :loading="loading" @click="emit('confirm')">
					{{ confirmLabel }}
				</CommonAppButton>
			</div>
		</div>
	</div>
</template>
