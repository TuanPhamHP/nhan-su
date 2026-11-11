<script setup lang="ts">
	import RecruitChip from './RecruitChip.vue';
	import { APPROVAL_STEP_CLASS } from '~/utils/recruitment.utils';
	import { formatDateTime } from '~/utils/date';

	/**
	 * Luồng duyệt của yêu cầu tuyển dụng hoặc của offer.
	 *
	 * Hai kiểu bước khác nhau vài trường (`approverLabel` chỉ có ở offer, `approverRole` của
	 * yêu cầu là mọi vai trò hệ thống), nên props nhận dạng chung nhất rồi tự dựng tên người
	 * duyệt: có người cụ thể thì hiện tên, bước giao theo vai trò thì hiện tên vai trò.
	 *
	 * Gửi lại sau khi bị từ chối tạo một VÒNG mới (`round` tăng 1), các bước của vòng cũ vẫn
	 * nằm trong mảng — nên phải nhóm theo vòng, nếu không người xem thấy hai bước "Chờ duyệt"
	 * cùng lúc mà không hiểu vì sao.
	 */
	interface TimelineStep {
		id: number;
		round: number;
		level: number;
		basisLabel: string;
		approver: { id: number; fullName: string } | null;
		approverRoleLabel?: string | null;
		approverLabel?: string;
		status: 'WAITING' | 'PENDING' | 'APPROVED' | 'REJECTED';
		statusLabel: string;
		decidedBy: { id: number; fullName: string } | null;
		decidedAt: string | null;
		note: string | null;
	}

	const props = defineProps<{
		steps: TimelineStep[];
		/** Vòng gửi duyệt hiện tại, để gắn nhãn "vòng đang chạy". */
		currentRound?: number;
	}>();

	/** Nhóm theo vòng, vòng mới nhất lên đầu. */
	const rounds = computed(() => {
		const map = new Map<number, TimelineStep[]>();
		for (const step of props.steps) {
			const list = map.get(step.round) ?? [];
			list.push(step);
			map.set(step.round, list);
		}
		return [...map.entries()]
			.map(([round, steps]) => ({
				round,
				steps: [...steps].sort((a, b) => a.level - b.level),
			}))
			.sort((a, b) => b.round - a.round);
	});

	function approverName(step: TimelineStep): string {
		if (step.approver) return step.approver.fullName;
		if (step.approverLabel) return step.approverLabel;
		if (step.approverRoleLabel) return `Bất kỳ ai có vai trò ${step.approverRoleLabel}`;
		return 'Chưa xác định';
	}
</script>

<template>
	<div v-if="rounds.length" class="space-y-5">
		<div v-for="group in rounds" :key="group.round" class="space-y-3">
			<div v-if="rounds.length > 1" class="flex items-center gap-2">
				<p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
					Lần gửi thứ {{ group.round }}
				</p>
				<span
					v-if="currentRound === group.round"
					class="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700 dark:bg-brand-900/20 dark:text-brand-300"
				>
					Vòng đang chạy
				</span>
			</div>

			<ol class="space-y-3">
				<li
					v-for="step in group.steps"
					:key="step.id"
					class="rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700"
				>
					<div class="flex flex-wrap items-start justify-between gap-2">
						<div class="min-w-0">
							<p class="text-sm font-medium text-gray-900 dark:text-white">
								Bước {{ step.level }} · {{ approverName(step) }}
							</p>
							<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ step.basisLabel }}</p>
						</div>
						<RecruitChip :label="step.statusLabel" :tone="APPROVAL_STEP_CLASS[step.status]" />
					</div>

					<p v-if="step.decidedBy" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
						{{ step.decidedBy.fullName }} đã quyết lúc {{ formatDateTime(step.decidedAt) }}
					</p>
					<p
						v-if="step.note"
						class="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:bg-gray-800/60 dark:text-gray-300"
					>
						{{ step.note }}
					</p>
				</li>
			</ol>
		</div>
	</div>

	<p v-else class="text-sm text-gray-500 dark:text-gray-400">Chưa gửi duyệt nên chưa có bước nào.</p>
</template>
