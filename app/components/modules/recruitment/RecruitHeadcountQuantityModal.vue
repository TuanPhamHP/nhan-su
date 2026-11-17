<script setup lang="ts">
	import { formatRecruitNumber } from '~/utils/recruitment.utils';
	import type { HeadcountRow } from '~/types/recruitment.types';

	/**
	 * Nhập số định biên cho một dòng — dùng cho cả hai đường ghi.
	 *
	 * `mode: 'proposal'` gọi `PATCH /:id/proposal` (người phụ trách tuyển dụng đề xuất, số
	 * đã chốt giữ nguyên hiệu lực tới khi người có quyền chốt đồng ý), `mode: 'confirmed'`
	 * gọi `PATCH /:id/confirmed` (người có quyền chốt sửa thẳng số đang áp dụng). Hai đường
	 * này KHÔNG thay nhau được, nên hộp thoại nói rõ đang sửa số nào.
	 */
	const props = defineProps<{
		row: HeadcountRow;
		mode: 'proposal' | 'confirmed';
		submit: (quantity: number, note?: string) => Promise<void>;
	}>();

	const emit = defineEmits<{ done: []; close: [] }>();

	const isProposal = computed(() => props.mode === 'proposal');

	const quantity = ref<number>(
		isProposal.value
			? (props.row.proposedQuantity ?? props.row.confirmedQuantity ?? 0)
			: (props.row.confirmedQuantity ?? 0),
	);
	const note = ref(isProposal.value ? (props.row.proposalNote ?? '') : '');
	const submitting = ref(false);
	const error = ref<string | null>(null);

	/** Còn trống nếu lưu số này: số mới − đang có − đang tuyển. Có thể âm. */
	const nextAvailable = computed(() => {
		const q = Number(quantity.value);
		if (!Number.isFinite(q)) return null;
		return q - props.row.current - props.row.recruiting;
	});

	async function save() {
		const q = Number(quantity.value);
		if (!Number.isInteger(q) || q < 0 || q > 10000) {
			error.value = 'Số định biên phải là số nguyên từ 0 đến 10.000';
			return;
		}
		submitting.value = true;
		error.value = null;
		try {
			await props.submit(q, note.value.trim() || undefined);
			emit('done');
		} catch (e) {
			error.value = e instanceof Error ? e.message : 'Lưu định biên thất bại';
		} finally {
			submitting.value = false;
		}
	}
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/50 p-4">
			<div class="my-8 w-full max-w-md rounded-2xl bg-white shadow-xl dark:bg-gray-900">
				<div class="flex items-start justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
					<div>
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">
							{{ isProposal ? 'Đề xuất định biên' : 'Sửa số định biên đã chốt' }}
						</h2>
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

				<form class="space-y-4 p-6" @submit.prevent="save">
					<p class="text-sm text-gray-600 dark:text-gray-300">
						<template v-if="isProposal">
							Số đã chốt hiện tại là
							{{ row.confirmedQuantity == null ? 'chưa có' : formatRecruitNumber(row.confirmedQuantity) }}
							và vẫn giữ hiệu lực cho tới khi đề xuất này được chốt.
						</template>
						<template v-else>
							Sửa ở đây đổi ngay số đang áp dụng, nên mọi yêu cầu tuyển gửi sau đó được kiểm theo
							số mới.
						</template>
					</p>

					<div class="grid grid-cols-3 gap-3">
						<div class="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/60">
							<p class="text-xs text-gray-500 dark:text-gray-400">Đang có</p>
							<p class="text-lg font-semibold tabular-nums text-gray-900 dark:text-white">
								{{ row.current }}
							</p>
						</div>
						<div class="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/60">
							<p class="text-xs text-gray-500 dark:text-gray-400">Đang tuyển</p>
							<p class="text-lg font-semibold tabular-nums text-gray-900 dark:text-white">
								{{ row.recruiting }}
							</p>
						</div>
						<div class="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/60">
							<p class="text-xs text-gray-500 dark:text-gray-400">Còn trống nếu lưu</p>
							<p
								class="text-lg font-semibold tabular-nums"
								:class="
									(nextAvailable ?? 0) < 0
										? 'text-rose-600 dark:text-rose-400'
										: 'text-gray-900 dark:text-white'
								"
							>
								{{ nextAvailable ?? '—' }}
							</p>
						</div>
					</div>

					<div class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
							{{ isProposal ? 'Số đề xuất' : 'Số đã chốt' }} <span class="text-red-500">*</span>
						</label>
						<input
							v-model.number="quantity"
							type="number"
							min="0"
							max="10000"
							step="1"
							class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
						/>
						<p v-if="(nextAvailable ?? 0) < 0" class="text-xs text-amber-600 dark:text-amber-400">
							Số này thấp hơn số người đang dùng, dòng sẽ bị đánh dấu vượt định biên.
						</p>
					</div>

					<div class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Ghi chú</label>
						<textarea
							v-model="note"
							rows="2"
							:placeholder="isProposal ? 'Vì sao cần số này...' : 'Ghi chú lưu vào lịch sử...'"
							class="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
						/>
					</div>

					<p v-if="error" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
						{{ error }}
					</p>

					<div class="flex justify-end gap-3 pt-1">
						<CommonAppButton variant="secondary" type="button" @click="emit('close')">Huỷ</CommonAppButton>
						<CommonAppButton variant="primary" type="submit" :loading="submitting">Lưu</CommonAppButton>
					</div>
				</form>
			</div>
		</div>
	</Teleport>
</template>
