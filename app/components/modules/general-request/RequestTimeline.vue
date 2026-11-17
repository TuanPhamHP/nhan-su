<script setup lang="ts">
	import { formatDateTime } from '~/utils/date';
	import { onBehalfText, roundHeading, timelineByRound } from '~/utils/general-request.utils';
	import type { TimelineEntry } from '~/types/general-request.types';

	/**
	 * Nhật ký duyệt, chia theo vòng.
	 *
	 * Phiếu bị trả lại rồi nộp lại thì sang vòng mới và `steps` chỉ còn vòng hiện tại, nên vòng
	 * cũ chỉ còn thấy được ở đây. Nhóm theo vòng để người đọc không lẫn hai lần duyệt với nhau.
	 *
	 * `actor` rỗng là việc do hệ thống làm: tự duyệt bước trùng người, bỏ bước vì điều kiện
	 * không khớp, chuyển lượt khi người duyệt nghỉ việc.
	 */
	const props = defineProps<{
		timeline: TimelineEntry[];
		/** Vòng hiện tại của phiếu, để đặt tiêu đề nhóm. */
		round: number;
	}>();

	const groups = computed(() => timelineByRound(props.timeline));

	const ACTION_TONE: Record<string, string> = {
		APPROVE: 'bg-green-500',
		AUTO_APPROVE: 'bg-green-400',
		REJECT: 'bg-rose-500',
		RETURN: 'bg-amber-500',
		CANCEL: 'bg-gray-400',
		TRANSFER: 'bg-sky-500',
		REASSIGN: 'bg-sky-500',
		DELEGATE: 'bg-sky-400',
		OVERRIDE: 'bg-purple-500',
		SKIP: 'bg-gray-300 dark:bg-gray-600',
		SUBMIT: 'bg-brand-500',
		RESUBMIT: 'bg-brand-500',
	};
</script>

<template>
	<div class="space-y-5">
		<p v-if="!timeline.length" class="text-sm text-gray-500 dark:text-gray-400">
			Chưa có hoạt động nào trên phiếu này.
		</p>

		<section v-for="group in groups" :key="group.round" class="space-y-2">
			<h3
				v-if="roundHeading(group.round, round)"
				class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
			>
				{{ roundHeading(group.round, round) }}
			</h3>
			<ol class="space-y-2.5">
				<li v-for="entry in group.entries" :key="entry.id" class="flex items-start gap-2.5">
					<span
						class="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full"
						:class="ACTION_TONE[entry.action] ?? 'bg-gray-300 dark:bg-gray-600'"
					/>
					<div class="min-w-0 flex-1">
						<p class="text-sm text-gray-800 dark:text-gray-100">
							<span class="font-medium">{{ entry.actor?.fullName ?? 'Hệ thống' }}</span>
							· {{ entry.actionLabel }}
							<span v-if="entry.stepOrder" class="text-gray-500 dark:text-gray-400">· bước {{ entry.stepOrder }}</span>
						</p>
						<p v-if="onBehalfText(entry.actor, entry.onBehalfOf)" class="text-xs text-gray-500 dark:text-gray-400">
							{{ onBehalfText(entry.actor, entry.onBehalfOf) }}
						</p>
						<p v-if="entry.detail" class="text-xs text-gray-600 dark:text-gray-300">{{ entry.detail }}</p>
						<p v-if="entry.note" class="mt-0.5 text-xs italic text-gray-600 dark:text-gray-300">{{ entry.note }}</p>
						<p class="mt-0.5 text-xs text-gray-400">{{ formatDateTime(entry.createdAt) }}</p>
					</div>
				</li>
			</ol>
		</section>
	</div>
</template>
