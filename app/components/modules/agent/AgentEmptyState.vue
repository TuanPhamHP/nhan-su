<script setup lang="ts">
	import agentAvatar from '~/assets/icons/ONGO_AI_BOT.png';
	import type { AgentSuggestion } from '~/types/agent.types';

	withDefaults(
		defineProps<{
			suggestions: AgentSuggestion[];
			/**
			 * Khung hẹp như cửa sổ chat nhanh: giữ cỡ nhỏ và xếp gợi ý một cột ở mọi màn hình.
			 * Không có cờ này thì từ `sm:` ba thẻ gợi ý chia ba cột trong khung rộng 400px, mỗi
			 * thẻ chỉ còn chừng một trăm pixel và câu hỏi gãy thành bốn, năm dòng.
			 */
			compact?: boolean;
		}>(),
		{ compact: false },
	);

	const emit = defineEmits<{ pick: [label: string] }>();
</script>

<template>
	<!--
		Mọi kích thước đều nhỏ trên mobile rồi mới nở ra từ `sm:`. Bản cũ dùng một cỡ cho
		mọi màn: trên điện thoại icon 64px + tiêu đề 20px + 3 thẻ gợi ý xếp dọc chiếm gần
		trọn màn hình, đẩy ô nhập xuống sát mép dưới.
	-->
	<div class="flex h-full flex-col items-center justify-center gap-4 px-3 py-6 text-center sm:gap-6 sm:px-4 sm:py-10">
		<!-- Không để vầng sáng accent phía sau: mascot tông cam, quầng xanh lá/xanh dương
		     theo theme sẽ chỏi màu. Ảnh đứng một mình đã đủ nặng ký ở cỡ này. -->
		<img
			:src="agentAvatar"
			alt=""
			draggable="false"
			:class="['h-14 w-14 object-contain select-none', compact ? '' : 'sm:h-20 sm:w-20']"
		/>

		<div class="space-y-1">
			<h3 :class="['text-base font-semibold text-gray-900 dark:text-gray-50', compact ? '' : 'sm:text-xl']">
				Hỏi gì cũng được về nhân sự
			</h3>
			<p :class="['text-xs text-gray-500 dark:text-gray-400', compact ? '' : 'sm:text-sm']">
				Trợ lý chỉ xem được dữ liệu mà bạn có quyền xem.
			</p>
		</div>

		<!--
			Ba gợi ý thì ba cột; bốn gợi ý (công ty dùng phân hệ Công việc và KPI) thì hai cột, để
			không còn một thẻ lẻ loi ở hàng dưới.
		-->
		<div
			:class="[
				'grid w-full gap-2',
				compact ? '' : 'max-w-3xl sm:gap-3',
				compact ? '' : suggestions.length % 3 === 0 ? 'sm:grid-cols-3' : 'sm:grid-cols-2',
			]"
		>
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
