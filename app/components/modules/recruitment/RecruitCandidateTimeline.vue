<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import { recruitErrorMessage } from '~/utils/recruitment.utils';
	import { formatDateTime } from '~/utils/date';
	import type { RecruitmentTimelineEvent } from '~/types/recruitment.types';

	/**
	 * Lịch sử sự kiện của một ứng viên.
	 *
	 * `payload` là dữ liệu kỹ thuật BE ghi lại (`fromStageId`, `offerId`, `emailLogId`...);
	 * đổ thẳng ra màn hình thì người đọc không hiểu, nên ở đây chỉ dịch sang câu tiếng Việt
	 * cho những loại sự kiện nói được điều gì có ích, còn lại chỉ hiện nhãn và thời điểm.
	 */
	const props = defineProps<{ candidateId: number }>();

	const service = useRecruitmentService();

	const events = ref<RecruitmentTimelineEvent[]>([]);
	const loading = ref(true);
	const error = ref<string | null>(null);

	async function load() {
		loading.value = true;
		error.value = null;
		try {
			events.value = await service.candidateTimeline(props.candidateId);
		} catch (e) {
			events.value = [];
			error.value = recruitErrorMessage(e, 'Không tải được lịch sử ứng viên');
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);
	watch(() => props.candidateId, load);

	defineExpose({ reload: load });

	function text(payload: Record<string, unknown> | null, key: string): string | null {
		const v = payload?.[key];
		return typeof v === 'string' && v ? v : null;
	}

	/** Một dòng mô tả thêm, hoặc `null` khi sự kiện không có gì đáng nói. */
	function describe(e: RecruitmentTimelineEvent): string | null {
		const p = e.payload;
		switch (e.type) {
			case 'APPLIED':
			case 'REAPPLIED': {
				const job = text(p, 'jobTitle');
				const stage = text(p, 'stage');
				if (job && stage) return `${job}, vào vòng ${stage}`;
				return job ?? stage;
			}
			case 'STAGE_CHANGED': {
				const from = text(p, 'from');
				const to = text(p, 'to');
				return from && to ? `Từ ${from} sang ${to}` : to;
			}
			case 'REOPENED':
				return text(p, 'stage') ? `Trở lại vòng ${text(p, 'stage')}` : null;
			case 'BLACKLISTED':
				return text(p, 'reason') ? `Lý do: ${text(p, 'reason')}` : null;
			case 'UNBLACKLISTED':
				return text(p, 'note') ? `Ghi chú: ${text(p, 'note')}` : null;
			case 'MINIMIZED':
			case 'ANONYMIZED':
				return text(p, 'reason') ? `Lý do: ${text(p, 'reason')}` : null;
			case 'CONSENT_RECORDED': {
				const kind = text(p, 'kind');
				return kind === 'TALENT_POOL' ? 'Đồng ý lưu vào kho tiềm năng' : 'Đồng ý xử lý dữ liệu';
			}
			default:
				return null;
		}
	}
</script>

<template>
	<div>
		<div v-if="loading" class="space-y-2">
			<div v-for="i in 4" :key="i" class="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
		</div>

		<p v-else-if="error" class="text-sm text-rose-600 dark:text-rose-400">{{ error }}</p>

		<p v-else-if="!events.length" class="text-sm text-gray-500 dark:text-gray-400">
			Chưa có sự kiện nào được ghi lại cho ứng viên này.
		</p>

		<ol v-else class="space-y-3">
			<li v-for="event in events" :key="event.id" class="flex gap-3">
				<div class="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-brand-500" />
				<div class="min-w-0 flex-1 border-b border-gray-100 pb-3 dark:border-gray-800">
					<div class="flex flex-wrap items-center justify-between gap-2">
						<p class="text-sm font-medium text-gray-900 dark:text-white">
							{{ event.typeLabel }}
							<span
								v-if="event.hrOnly"
								class="ml-1 rounded bg-rose-50 px-1.5 py-0.5 text-xs font-normal text-rose-600 dark:bg-rose-900/20 dark:text-rose-300"
							>
								chỉ nhân sự thấy
							</span>
						</p>
						<p class="text-xs text-gray-400">{{ formatDateTime(event.createdAt) }}</p>
					</div>
					<p v-if="describe(event)" class="mt-0.5 text-sm text-gray-600 dark:text-gray-300">
						{{ describe(event) }}
					</p>
					<p class="mt-0.5 text-xs text-gray-400">
						{{ event.actor ? event.actor.fullName : 'Ứng viên hoặc hệ thống' }}
					</p>
				</div>
			</li>
		</ol>
	</div>
</template>
