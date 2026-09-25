<script setup lang="ts">
	import type { AgentSuggestion } from '~/types/agent.types';

	defineProps<{ suggestions: AgentSuggestion[] }>();

	const emit = defineEmits<{ pick: [label: string] }>();
</script>

<template>
	<!--
		Mọi kích thước đều nhỏ trên mobile rồi mới nở ra từ `sm:`. Bản cũ dùng một cỡ cho
		mọi màn: trên điện thoại icon 64px + tiêu đề 20px + 3 thẻ gợi ý xếp dọc chiếm gần
		trọn màn hình, đẩy ô nhập xuống sát mép dưới.
	-->
	<div class="flex h-full flex-col items-center justify-center gap-4 px-3 py-6 text-center sm:gap-6 sm:px-4 sm:py-10">
		<div class="relative">
			<span
				class="absolute inset-0 rounded-3xl bg-[var(--color-accent)] opacity-20 blur-xl"
				aria-hidden="true"
			/>
			<div
				class="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-accent)] text-white shadow-lg sm:h-16 sm:w-16 sm:rounded-3xl"
			>
				<Icon name="heroicons:sparkles" class="h-6 w-6 sm:h-8 sm:w-8" />
			</div>
		</div>

		<div class="space-y-1">
			<h3 class="text-base font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
				Hỏi gì cũng được về nhân sự
			</h3>
			<p class="text-xs text-gray-500 sm:text-sm dark:text-gray-400">
				Trợ lý chỉ xem được dữ liệu mà bạn có quyền xem.
			</p>
		</div>

		<div class="grid w-full max-w-3xl gap-2 sm:grid-cols-3 sm:gap-3">
			<button
				v-for="s in suggestions"
				:key="s.label"
				type="button"
				class="group flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white p-2.5 text-left transition hover:-translate-y-0.5 hover:border-[var(--color-accent)] hover:shadow-md sm:items-start sm:gap-3 sm:rounded-2xl sm:p-3.5 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-[var(--color-accent)]"
				@click="emit('pick', s.label)"
			>
				<span
					class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition group-hover:bg-[var(--color-accent)] group-hover:text-white sm:h-8 sm:w-8 sm:rounded-xl dark:bg-gray-700 dark:text-gray-300"
				>
					<Icon :name="s.icon" class="h-3.5 w-3.5 sm:h-4 sm:w-4" />
				</span>
				<span class="text-[13px] leading-snug font-medium text-gray-700 sm:text-sm dark:text-gray-200">
					{{ s.label }}
				</span>
			</button>
		</div>
	</div>
</template>
