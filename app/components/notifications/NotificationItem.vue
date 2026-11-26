<script setup lang="ts">
	import type { NotificationResponse } from '~/types/notification.types';
	import { resolveNotificationRoute } from '~/utils/notification-route';
	import { isTaskDueRequestAction, notificationBodyText, notificationIcon } from '~/utils/notification-display';
	import { formatTimeAgo } from '~/utils/date';

	const props = defineProps<{ notification: NotificationResponse }>();
	const emit = defineEmits<{
		read: [id: number];
		actioned: [id: number];
		'close-panel': [];
	}>();

	const { markRead, quickApprove, quickReject } = useNotifications();
	const { user } = useAuth();
	const uiStore = useUiStore();
	const router = useRouter();
	const toast = useToast();
	const generalRequestStore = useGeneralRequestStore();

	/**
	 * Nút duyệt nhanh, từ chối nhanh ngay trong chuông thông báo.
	 *
	 * Mở cho phiếu đề xuất (lô 4a): máy chủ gắn `approveEndpoint`, `rejectEndpoint` vào
	 * `actionPayload` của loại `GENERAL_REQUEST_PENDING` gửi cho người đang giữ lượt, và từ chối
	 * đi kèm lý do bắt buộc nên ô lý do ở đây là đủ. Từ 27/11/2026 mở thêm cho phiếu xin dời hạn
	 * (`TASK_DUE_REQUESTED`, `actionPayload.refType: 'task_due_request'`): người giao chỉ cần đọc
	 * hai cái hạn và lý do có sẵn trong thân thông báo, ghi chú khi không duyệt là tuỳ chọn.
	 * Các loại đơn khác vẫn chỉ có nút "Xem": đơn nghỉ, OT, công tác cần xem ngày và số giờ trước
	 * khi quyết định, nên duyệt một nhát từ chuông là sai chỗ.
	 */
	const isDueRequest = computed(() => isTaskDueRequestAction(props.notification));
	// Máy chủ đánh dấu đã đọc tin xin dời hạn khi phiếu đã được quyết hoặc bị huỷ (bridge mục 25.4), nên tin đã
	// đọc không còn nút: bấm lại chỉ nhận lỗi "phiếu đã xử lý". Muốn quyết tiếp thì mở việc.
	const canQuickAct = computed(
		() =>
			props.notification.actionType === 'APPROVE_REJECT' &&
			(props.notification.refType === 'general_request' || (isDueRequest.value && !props.notification.isRead)) &&
			!!props.notification.actionPayload?.approveEndpoint &&
			!!props.notification.actionPayload?.rejectEndpoint,
	);

	/**
	 * Biểu tượng cạnh thông báo: icon của giao diện theo loại rồi theo `category` (`notificationIcon`).
	 * Không emoji: mỗi hệ điều hành vẽ một kiểu, không đổi màu theo chế độ tối, và trình đọc màn hình
	 * đọc thành "mặt đồng hồ ba giờ", nên từ 19/11/2026 cả máy chủ lẫn giao diện bỏ hết.
	 */
	const categoryIcon = computed(() => notificationIcon(props.notification));
	const bodyText = computed(() => notificationBodyText(props.notification.body));
	/** Không duyệt phiếu xin dời hạn thì ghi chú không bắt buộc; từ chối phiếu đề xuất thì bắt buộc lý do. */
	const rejectNoteRequired = computed(() => !isDueRequest.value);

	const showRejectInput = ref(false);
	const rejectNote = ref('');
	const isLoading = ref(false);
	const isActioned = ref(false);
	const actionedMessage = ref('');

	const handleClick = async () => {
		if (!props.notification.isRead) {
			try {
				await markRead(props.notification.id);
				emit('read', props.notification.id);
			} catch {
				// non-critical
			}
		}
		if (!showRejectInput.value) {
			handleNavigate();
		}
	};

	const handleNavigate = () => {
		if (!user.value) return;
		// Respect "view as" preview — nếu management user đang xem giao diện nhân viên,
		// notification click sẽ điều hướng sang page của giao diện đó.
		const effectiveRole = uiStore.previewRole ?? user.value.role;
		const route = resolveNotificationRoute(
			props.notification.refType,
			props.notification.refId,
			effectiveRole,
			props.notification.type,
		);
		if (route) {
			router.push(route);
			emit('close-panel');
			return;
		}
		// Loại thông báo chưa có nhánh trong bảng định tuyến vẫn mở được nếu máy chủ đã dựng sẵn
		// địa chỉ. Chỉ nhận đường dẫn tương đối trong app, để một `targetUrl` lạ không đẩy người
		// dùng ra ngoài.
		const target = props.notification.targetUrl;
		if (target && target.startsWith('/') && !target.startsWith('//')) {
			router.push(target);
			emit('close-panel');
		}
	};

	const handleQuickApprove = async () => {
		isLoading.value = true;
		try {
			await quickApprove(props.notification);
			isActioned.value = true;
			actionedMessage.value = isDueRequest.value ? 'Đã duyệt, hạn mới đã được áp dụng' : 'Đã duyệt thành công';
			// Trang phiếu đề xuất đang mở ở phía sau cũng phải đổi theo cú bấm này.
			if (!isDueRequest.value) generalRequestStore.triggerRefresh(props.notification.refId ?? undefined);
			emit('actioned', props.notification.id);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Không thể duyệt. Vui lòng thử lại.');
		} finally {
			isLoading.value = false;
		}
	};

	const handleQuickReject = async () => {
		if (rejectNoteRequired.value && !rejectNote.value.trim()) return;
		isLoading.value = true;
		try {
			await quickReject(props.notification, rejectNote.value);
			isActioned.value = true;
			actionedMessage.value = isDueRequest.value ? 'Đã không duyệt, hạn giữ nguyên' : 'Đã từ chối';
			showRejectInput.value = false;
			if (!isDueRequest.value) generalRequestStore.triggerRefresh(props.notification.refId ?? undefined);
			emit('actioned', props.notification.id);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Không thể từ chối. Vui lòng thử lại.');
		} finally {
			isLoading.value = false;
		}
	};
</script>

<template>
	<div
		:class="[
			'p-3 border-b cursor-pointer transition-colors',
			'hover:bg-gray-50 dark:hover:bg-gray-700/50',
			!notification.isRead
				? 'bg-blue-50 dark:bg-blue-900/10 border-l-4 border-l-green-500'
				: 'bg-white dark:bg-gray-800',
		]"
		@click="handleClick"
	>
		<div class="flex items-start gap-3">
			<!-- Icon theo category; `aria-hidden` vì tiêu đề thông báo đã nói rõ đây là việc gì. -->
			<div class="mt-0.5 flex-shrink-0">
				<Icon :name="categoryIcon.icon" :class="['w-5 h-5', categoryIcon.cls]" aria-hidden="true" />
				<span class="sr-only">{{ categoryIcon.label }}</span>
			</div>

			<div class="flex-1 min-w-0">
				<!-- Header -->
				<div class="flex justify-between items-start">
					<p class="text-sm font-medium text-gray-900 dark:text-gray-100 leading-snug">
						{{ notification.title }}
					</p>
					<div class="flex items-center gap-1 flex-shrink-0 ml-2">
						<span class="text-xs text-gray-400 whitespace-nowrap">
							{{ formatTimeAgo(notification.createdAt) }}
						</span>
						<div v-if="!notification.isRead" class="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
					</div>
				</div>

				<!-- Body -->
				<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
					{{ bodyText }}
				</p>

				<!-- Quick actions (chỉ hiện APPROVE_REJECT) -->
				<div
					v-if="notification.actionType === 'APPROVE_REJECT' && !isActioned && !showRejectInput"
					class="flex gap-2 mt-2"
					data-testid="notif-quick-actions"
					@click.stop
				>
					<button
						v-if="canQuickAct"
						:disabled="isLoading"
						class="flex-1 py-1 px-2 text-xs font-medium rounded bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-1"
						data-testid="notif-approve"
						@click="handleQuickApprove"
					>
						<Icon name="heroicons:check" class="w-3.5 h-3.5" aria-hidden="true" />
						Duyệt
					</button>

					<button
						v-if="canQuickAct"
						:disabled="isLoading"
						class="flex-1 py-1 px-2 text-xs font-medium rounded bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-1"
						data-testid="notif-reject"
						@click="showRejectInput = true"
					>
						<Icon name="heroicons:x-mark" class="w-3.5 h-3.5" aria-hidden="true" />
						{{ isDueRequest ? 'Không duyệt' : 'Từ chối' }}
					</button>

					<button
						class="py-1 px-2 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
						@click="handleNavigate"
					>
						Xem
					</button>
				</div>

				<!-- Reject note input -->
				<div v-if="showRejectInput" class="mt-2" @click.stop>
					<textarea
						v-model="rejectNote"
						:placeholder="isDueRequest ? 'Ghi chú cho người xin (không bắt buộc)' : 'Lý do từ chối...'"
						:aria-label="isDueRequest ? 'Ghi chú khi không duyệt' : 'Lý do từ chối'"
						rows="2"
						maxlength="500"
						class="w-full text-xs p-2 border border-gray-300 dark:border-gray-600 rounded resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-red-400"
						data-testid="notif-reject-note"
					/>
					<div class="flex gap-2 mt-1">
						<button
							:disabled="(rejectNoteRequired && !rejectNote.trim()) || isLoading"
							class="flex-1 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
							data-testid="notif-reject-confirm"
							@click="handleQuickReject"
						>
							{{ isDueRequest ? 'Xác nhận không duyệt' : 'Xác nhận từ chối' }}
						</button>
						<button
							class="px-2 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
							@click="showRejectInput = false"
						>
							Huỷ
						</button>
					</div>
				</div>

				<!-- Success state sau khi action -->
				<div
					v-if="isActioned"
					class="mt-1 text-xs text-green-600 dark:text-green-400 font-medium inline-flex items-center gap-1"
				>
					<Icon name="heroicons:check-circle" class="w-4 h-4" aria-hidden="true" />
					{{ actionedMessage }}
				</div>
			</div>
		</div>
	</div>
</template>
