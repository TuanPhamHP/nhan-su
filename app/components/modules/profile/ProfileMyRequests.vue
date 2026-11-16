<script setup lang="ts">
	import { formatDateTime } from '~/utils/date';
	import { useMeProfileService } from '~/services/me-profile.service';
	import { PROFILE_CHANGE_STATUS_CLASS, type MyProfileChange } from '~/types/hr-profile.types';

	/**
	 * Tab "Yêu cầu của tôi" trên trang cá nhân (UI-04, lô 3a).
	 *
	 * Danh sách yêu cầu của chính mình, mỗi dòng mở ra xem được giá trị cũ và giá trị đề nghị.
	 * Thông báo N-02 dẫn tới `?tab=requests&id=…`, nên yêu cầu được chỉ tên sẽ mở sẵn.
	 */
	const props = defineProps<{
		requests: MyProfileChange[];
		loading: boolean;
		/** Id yêu cầu cần mở sẵn, lấy từ địa chỉ khi người dùng bấm vào thông báo. */
		highlightId: number | null;
	}>();

	const emit = defineEmits<{
		cancelled: [];
	}>();

	const toast = useToast();
	const service = useMeProfileService();

	const expandedId = ref<number | null>(null);
	const cancellingId = ref<number | null>(null);

	watch(
		() => props.highlightId,
		id => {
			if (id) expandedId.value = id;
		},
		{ immediate: true },
	);

	function toggle(id: number) {
		expandedId.value = expandedId.value === id ? null : id;
	}

	async function cancel(req: MyProfileChange) {
		cancellingId.value = req.id;
		try {
			await service.cancelChangeRequest(req.id);
			toast.success('Đã thu hồi yêu cầu.');
			emit('cancelled');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa thu hồi được yêu cầu này.');
		} finally {
			cancellingId.value = null;
		}
	}
</script>

<template>
	<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
		<div class="border-b border-gray-100 px-6 py-4 dark:border-gray-700">
			<h3 class="text-sm font-semibold text-gray-900 dark:text-white">Yêu cầu thay đổi thông tin của tôi</h3>
			<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
				Hệ thống giữ 100 yêu cầu gần nhất. Yêu cầu đang chờ thì bạn còn thu hồi được.
			</p>
		</div>

		<div v-if="loading" class="space-y-3 p-6">
			<div v-for="i in 3" :key="i" class="h-14 w-full animate-pulse rounded-lg bg-gray-50 dark:bg-gray-800" />
		</div>

		<p v-else-if="!requests.length" class="px-6 py-8 text-sm text-gray-500 dark:text-gray-400">
			Bạn chưa gửi yêu cầu thay đổi thông tin nào.
		</p>

		<ul v-else class="divide-y divide-gray-100 dark:divide-gray-800">
			<li
				v-for="req in requests"
				:key="req.id"
				:class="req.id === highlightId ? 'bg-brand-50/60 dark:bg-brand-900/10' : ''"
			>
				<button
					type="button"
					class="flex w-full flex-wrap items-start justify-between gap-3 px-6 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50"
					@click="toggle(req.id)"
				>
					<div class="min-w-0">
						<p class="text-sm font-medium text-gray-900 dark:text-white">
							{{ req.sectionLabel }} · {{ req.actionLabel }}
						</p>
						<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
							Gửi lúc {{ formatDateTime(req.createdAt) }} · yêu cầu số {{ req.id }}
							<template v-if="req.documentCount"> · {{ req.documentCount }} giấy tờ kèm theo</template>
						</p>
					</div>
					<span
						class="inline-flex flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
						:class="PROFILE_CHANGE_STATUS_CLASS[req.status]"
					>
						{{ req.statusLabel }}
					</span>
				</button>

				<div v-if="expandedId === req.id" class="space-y-3 border-t border-gray-100 px-6 py-4 dark:border-gray-800">
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead>
								<tr class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
									<th class="py-1.5 pr-4 text-left font-medium">Thông tin</th>
									<th class="py-1.5 pr-4 text-left font-medium">Giá trị cũ</th>
									<th class="py-1.5 text-left font-medium">Giá trị đề nghị</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
								<tr v-if="!req.fields.length">
									<td colspan="3" class="py-3 text-gray-500 dark:text-gray-400">
										Yêu cầu này không có dòng thông tin nào.
									</td>
								</tr>
								<tr v-for="field in req.fields" :key="field.key">
									<td class="py-2 pr-4 text-gray-600 dark:text-gray-400">{{ field.label }}</td>
									<td class="py-2 pr-4 text-gray-600 dark:text-gray-400">{{ field.before ?? '—' }}</td>
									<td class="py-2 font-medium text-gray-900 dark:text-white">{{ field.after ?? '—' }}</td>
								</tr>
							</tbody>
						</table>
					</div>

					<p v-if="req.decisionNote" class="text-sm text-gray-600 dark:text-gray-300">
						Phản hồi của phòng nhân sự: {{ req.decisionNote }}
					</p>
					<p v-if="req.cancelReason" class="text-sm text-gray-600 dark:text-gray-300">{{ req.cancelReason }}</p>
					<p v-if="req.decidedAt" class="text-xs text-gray-500 dark:text-gray-400">
						{{ req.statusLabel }}
						<template v-if="req.decidedBy"> bởi {{ req.decidedBy.name }}</template>
						lúc {{ formatDateTime(req.decidedAt) }}
					</p>

					<div v-if="req.status === 'PENDING'" class="flex justify-end">
						<CommonAppButton
							size="sm"
							variant="danger_outline"
							:loading="cancellingId === req.id"
							@click="cancel(req)"
						>
							Thu hồi yêu cầu
						</CommonAppButton>
					</div>
				</div>
			</li>
		</ul>
	</div>
</template>
