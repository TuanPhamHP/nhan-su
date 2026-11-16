<script setup lang="ts">
	import { formatMonth } from '~/utils/hr-profile.utils';
	import type { WorkExperience } from '~/types/hr-profile.types';

	/**
	 * Bảng kinh nghiệm trước khi vào công ty.
	 *
	 * Thuần hiển thị, dùng chung cho trang chi tiết nhân viên (phòng nhân sự sửa trực tiếp) và
	 * trang cá nhân (nhân viên chỉ xem, muốn đổi thì gửi yêu cầu), nên mọi thao tác đều phát ra
	 * ngoài cho nơi gọi tự quyết.
	 */
	const props = withDefaults(
		defineProps<{
			items: WorkExperience[];
			loading?: boolean;
			/** Nhãn của nút thêm; đặt rỗng thì không hiện nút nào. */
			addLabel?: string;
			/** Nhãn của hai nút trên mỗi dòng; đặt rỗng thì dòng không có thao tác. */
			editLabel?: string;
			removeLabel?: string;
			emptyText?: string;
		}>(),
		{
			loading: false,
			addLabel: '',
			editLabel: '',
			removeLabel: '',
			emptyText: 'Chưa ghi nhận kinh nghiệm nào trước khi vào công ty.',
		},
	);

	const emit = defineEmits<{
		add: [];
		edit: [item: WorkExperience];
		remove: [item: WorkExperience];
	}>();

	function periodText(item: WorkExperience): string {
		if (!item.fromMonth && !item.toMonth) return '—';
		const from = item.fromMonth ? formatMonth(item.fromMonth) : '—';
		return item.toMonth ? `${from} → ${formatMonth(item.toMonth)}` : `${from} → nay`;
	}

	const hasRowActions = computed(() => !!props.editLabel || !!props.removeLabel);
</script>

<template>
	<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
		<div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-3">
			<h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Kinh nghiệm làm việc</h3>
			<CommonAppButton v-if="addLabel" size="sm" variant="outline" @click="emit('add')">
				{{ addLabel }}
			</CommonAppButton>
		</div>

		<div v-if="loading" class="p-6 space-y-3">
			<div v-for="i in 2" :key="i" class="h-12 w-full bg-gray-50 dark:bg-gray-800 rounded-lg animate-pulse" />
		</div>

		<p v-else-if="!items.length" class="px-6 py-6 text-sm text-gray-500 dark:text-gray-400">{{ emptyText }}</p>

		<div v-else class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
						<th class="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
							Công ty
						</th>
						<th class="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
							Chức danh
						</th>
						<th class="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
							Thời gian
						</th>
						<th class="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
							Lý do rời đi
						</th>
						<th
							v-if="hasRowActions"
							class="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
						>
							Thao tác
						</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
					<tr v-for="item in items" :key="item.id" class="hover:bg-gray-50 dark:hover:bg-gray-800/50">
						<td class="px-4 py-3">
							<p class="font-medium text-gray-900 dark:text-white">{{ item.companyName }}</p>
							<p v-if="item.source === 'RECRUITMENT'" class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
								{{ item.sourceLabel }}
							</p>
							<p v-if="item.description" class="text-xs text-gray-500 dark:text-gray-400 mt-1 whitespace-pre-line">
								{{ item.description }}
							</p>
						</td>
						<td class="px-4 py-3 text-gray-700 dark:text-gray-300">{{ item.title ?? '—' }}</td>
						<td class="px-4 py-3 whitespace-nowrap text-gray-700 dark:text-gray-300">{{ periodText(item) }}</td>
						<td class="px-4 py-3 text-gray-600 dark:text-gray-400">{{ item.leaveReason ?? '—' }}</td>
						<td v-if="hasRowActions" class="px-4 py-3">
							<div class="flex items-center justify-end gap-1.5">
								<button
									v-if="editLabel"
									type="button"
									class="px-2.5 py-1 rounded-md text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
									@click="emit('edit', item)"
								>
									{{ editLabel }}
								</button>
								<button
									v-if="removeLabel"
									type="button"
									class="px-2.5 py-1 rounded-md text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
									@click="emit('remove', item)"
								>
									{{ removeLabel }}
								</button>
							</div>
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>
</template>
