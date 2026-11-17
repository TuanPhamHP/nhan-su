<script setup lang="ts">
	import RequestStatusBadge from '~/components/modules/general-request/RequestStatusBadge.vue';
	// `app/services/` không được Nuxt auto-import.
	import { useGeneralRequestService } from '~/services/general-request.service';
	import { dueText, requestCodeText } from '~/utils/general-request.utils';
	import { formatDate, formatDateTime } from '~/utils/date';
	import type { PendingRequest } from '~/types/general-request.types';

	/**
	 * Tab "Phiếu đề xuất" của hộp thư phê duyệt (UI-04, lô 4a).
	 *
	 * Tách thành component riêng vì trang `management/approval/index.vue` đã hơn một nghìn sáu
	 * trăm dòng; thêm một tab nữa vào thẳng trang đó thì không ai đọc nổi.
	 *
	 * Danh sách là `/pending-for-me`: phiếu đang chờ ĐÚNG người này duyệt ở bước hiện tại, kể cả
	 * lượt nhận theo uỷ quyền. Không lọc theo quyền `general-request:approve` nữa, vì từ lô 4a
	 * mọi vai trò đều có thể được giao duyệt một bước. Quyết định thì mở phiếu, vì người duyệt
	 * cần đọc nội dung và nhìn chuỗi duyệt trước khi bấm, còn nút "Đồng ý" một nhát chỉ nằm ở
	 * thông báo cho người đã biết rõ phiếu.
	 */
	const emit = defineEmits<{
		/** Số phiếu chờ vừa đọc được, để trang cha đối chiếu với badge. */
		loaded: [count: number];
	}>();

	const toast = useToast();
	const router = useRouter();
	const service = useGeneralRequestService();

	const items = ref<PendingRequest[]>([]);
	const loading = ref(true);

	async function load() {
		loading.value = true;
		try {
			items.value = await service.findPendingForMe();
			emit('loaded', items.value.length);
		} catch (e) {
			items.value = [];
			toast.error(e instanceof Error ? e.message : 'Chưa tải được phiếu đề xuất chờ bạn duyệt.');
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);
	defineExpose({ reload: load });

	function open(id: number) {
		router.push(`/general-requests/${id}`);
	}
</script>

<template>
	<div class="space-y-3">
		<div v-if="loading" class="space-y-2">
			<div v-for="i in 3" :key="i" class="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
		</div>

		<div
			v-else-if="!items.length"
			class="rounded-xl border border-gray-200 bg-white py-16 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
		>
			Không có phiếu đề xuất nào chờ bạn duyệt.
		</div>

		<template v-else>
			<!-- Điện thoại -->
			<ul class="space-y-2 sm:hidden">
				<li
					v-for="req in items"
					:key="req.id"
					class="rounded-xl border bg-white p-4 dark:bg-gray-900"
					:class="req.overdue ? 'border-rose-300 dark:border-rose-900/60' : 'border-gray-200 dark:border-gray-700'"
					@click="open(req.id)"
				>
					<div class="flex items-start justify-between gap-2">
						<div class="min-w-0">
							<p class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ requestCodeText(req.code) }}</p>
							<p class="mt-0.5 truncate text-sm font-medium text-gray-900 dark:text-white">{{ req.title }}</p>
							<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
								{{ req.employee.fullName }} · {{ req.template.name }}
							</p>
						</div>
						<RequestStatusBadge :status="req.status" :status-label="req.statusLabel" />
					</div>
					<p
						v-if="dueText(req.dueAt, req.overdue)"
						class="mt-1.5 text-xs"
						:class="req.overdue ? 'text-rose-600 dark:text-rose-400' : 'text-gray-500 dark:text-gray-400'"
					>
						{{ dueText(req.dueAt, req.overdue) }}
					</p>
					<p v-if="req.onBehalfOf" class="mt-0.5 text-xs text-sky-700 dark:text-sky-300">
						Bạn duyệt thay {{ req.onBehalfOf.fullName }}
					</p>
				</li>
			</ul>

			<!-- Máy tính -->
			<div
				class="hidden overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 sm:block"
			>
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
								<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Số hiệu</th>
								<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Phiếu</th>
								<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Người gửi</th>
								<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Bước của tôi</th>
								<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Hạn xử lý</th>
								<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Thao tác</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
							<tr
								v-for="req in items"
								:key="req.id"
								class="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
								:class="req.overdue ? 'bg-rose-50/60 dark:bg-rose-900/10' : ''"
								@click="open(req.id)"
							>
								<td class="whitespace-nowrap px-4 py-3 font-medium text-gray-700 dark:text-gray-200">
									{{ requestCodeText(req.code) }}
									<p v-if="req.submittedAt" class="text-xs font-normal text-gray-400">
										Gửi ngày {{ formatDate(req.submittedAt) }}
									</p>
								</td>
								<td class="px-4 py-3">
									<p class="font-medium text-gray-900 dark:text-white">{{ req.title }}</p>
									<p class="mt-0.5 text-xs text-gray-400">{{ req.template.name }}</p>
								</td>
								<td class="px-4 py-3 text-gray-600 dark:text-gray-300">
									{{ req.employee.fullName }}
									<p class="text-xs text-gray-400">{{ req.employee.employeeCode }}</p>
								</td>
								<td class="px-4 py-3 text-gray-600 dark:text-gray-300">
									{{ req.currentStep?.name ?? '—' }}
									<p v-if="req.onBehalfOf" class="text-xs text-sky-700 dark:text-sky-300">
										Bạn duyệt thay {{ req.onBehalfOf.fullName }}
									</p>
								</td>
								<!-- Cột đã mang tên "Hạn xử lý" nên ô chỉ cần mốc thời gian, không nhắc lại tên cột. -->
								<td class="whitespace-nowrap px-4 py-3">
									<template v-if="req.dueAt">
										<span
											class="text-xs"
											:class="req.overdue ? 'font-medium text-rose-600 dark:text-rose-400' : 'text-gray-500 dark:text-gray-400'"
										>
											{{ formatDateTime(req.dueAt) }}
										</span>
										<p v-if="req.overdue" class="text-xs font-medium text-rose-600 dark:text-rose-400">Đã quá hạn</p>
									</template>
									<span v-else class="text-xs text-gray-400">Không có hạn</span>
								</td>
								<td class="px-4 py-3 text-right" @click.stop>
									<CommonAppButton size="sm" class="whitespace-nowrap" @click="open(req.id)">
										Mở phiếu để duyệt
									</CommonAppButton>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</template>
	</div>
</template>
