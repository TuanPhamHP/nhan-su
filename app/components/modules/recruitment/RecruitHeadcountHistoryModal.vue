<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import { recruitErrorMessage } from '~/utils/recruitment.utils';
	import { formatDateTime } from '~/utils/date';
	import type { HeadcountChange, HeadcountRow } from '~/types/recruitment.types';

	/** Lịch sử thay đổi của một dòng định biên: đề xuất, gửi, chốt, trả lại, sửa. */
	const props = defineProps<{ row: HeadcountRow }>();

	const emit = defineEmits<{ close: [] }>();

	const service = useRecruitmentService();

	const changes = ref<HeadcountChange[]>([]);
	const loading = ref(true);
	const error = ref<string | null>(null);

	onMounted(async () => {
		try {
			changes.value = await service.headcountChanges(props.row.id);
		} catch (e) {
			error.value = recruitErrorMessage(e, 'Không tải được lịch sử');
		} finally {
			loading.value = false;
		}
	});

	/**
	 * "4 → 5", hoặc chỉ một số khi chỉ có một đầu.
	 *
	 * Riêng lần rút đề xuất thì hai con số KHÔNG phải một mũi tên: backend ghi `fromQuantity`
	 * là số đã chốt còn lại và `toQuantity` là số đề xuất vừa bị bỏ, nên vẽ mũi tên sẽ đọc
	 * thành "định biên tăng từ 3 lên 5", đúng ngược với việc vừa xảy ra.
	 */
	function quantityText(change: HeadcountChange): string {
		const { fromQuantity: from, toQuantity: to } = change;
		if (change.type === 'WITHDRAWN') {
			if (to != null && from != null) return `bỏ đề xuất ${to}, giữ số đã chốt ${from}`;
			if (to != null) return `bỏ đề xuất ${to}`;
		}
		if (from != null && to != null) return `${from} → ${to}`;
		if (to != null) return String(to);
		if (from != null) return String(from);
		return '—';
	}
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/50 p-4">
			<div class="my-8 w-full max-w-lg rounded-2xl bg-white shadow-xl dark:bg-gray-900">
				<div class="flex items-start justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
					<div>
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">Lịch sử định biên</h2>
						<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
							{{ row.position.name }} · {{ row.department.name }} · năm {{ row.year }}
						</p>
					</div>
					<button
						type="button"
						class="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
						aria-label="Đóng"
						@click="emit('close')"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<div class="max-h-[60vh] overflow-y-auto p-6">
					<div v-if="loading" class="space-y-2">
						<div v-for="i in 3" :key="i" class="h-14 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
					</div>

					<p v-else-if="error" class="text-sm text-rose-600 dark:text-rose-400">{{ error }}</p>

					<p v-else-if="!changes.length" class="text-sm text-gray-500 dark:text-gray-400">
						Dòng này chưa có thay đổi nào được ghi lại.
					</p>

					<ol v-else class="space-y-3">
						<li
							v-for="change in changes"
							:key="change.id"
							class="rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700"
						>
							<div class="flex flex-wrap items-center justify-between gap-2">
								<p class="text-sm font-medium text-gray-900 dark:text-white">
									{{ change.typeLabel }} · {{ quantityText(change) }}
								</p>
								<p class="text-xs text-gray-500 dark:text-gray-400">
									{{ formatDateTime(change.createdAt) }}
								</p>
							</div>
							<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
								{{ change.actor ? change.actor.fullName : 'Hệ thống' }}
							</p>
							<p
								v-if="change.note"
								class="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:bg-gray-800/60 dark:text-gray-300"
							>
								{{ change.note }}
							</p>
						</li>
					</ol>
				</div>
			</div>
		</div>
	</Teleport>
</template>
