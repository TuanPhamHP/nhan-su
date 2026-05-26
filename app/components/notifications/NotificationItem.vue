<script setup lang="ts">
	import { format, parseISO } from 'date-fns';
	import type { NotificationResponse } from '~/types/notification.types';

	const props = defineProps<{ notification: NotificationResponse }>();
	const emit = defineEmits<{
		read: [id: number];
		actioned: [id: number];
		'close-panel': [];
	}>();

	const { markRead, quickApprove, quickReject } = useNotifications();
	const router = useRouter();
	const toast = useToast();

	const showRejectInput = ref(false);
	const rejectNote = ref('');
	const isLoading = ref(false);
	const isActioned = ref(false);
	const actionedMessage = ref('');

	function formatVNTime(iso: string): string {
		try {
			return format(parseISO(iso), 'HH:mm');
		} catch {
			return '';
		}
	}

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
		if (props.notification.targetUrl) {
			router.push(props.notification.targetUrl);
			emit('close-panel');
		}
	};

	const handleQuickApprove = async () => {
		isLoading.value = true;
		try {
			await quickApprove(props.notification);
			isActioned.value = true;
			actionedMessage.value = 'Đã duyệt thành công';
			emit('actioned', props.notification.id);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Không thể duyệt. Vui lòng thử lại.');
		} finally {
			isLoading.value = false;
		}
	};

	const handleQuickReject = async () => {
		if (!rejectNote.value.trim()) return;
		isLoading.value = true;
		try {
			await quickReject(props.notification, rejectNote.value);
			isActioned.value = true;
			actionedMessage.value = 'Đã từ chối';
			showRejectInput.value = false;
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
			<!-- Icon theo category -->
			<div class="mt-0.5 flex-shrink-0 text-base leading-none">
				<span v-if="notification.category === 'ATTENDANCE'">🕐</span>
				<span v-else-if="notification.category === 'LEAVE'">📅</span>
				<span v-else>🔔</span>
			</div>

			<div class="flex-1 min-w-0">
				<!-- Header -->
				<div class="flex justify-between items-start">
					<p class="text-sm font-medium text-gray-900 dark:text-gray-100 leading-snug">
						{{ notification.title }}
					</p>
					<div class="flex items-center gap-1 flex-shrink-0 ml-2">
						<span class="text-xs text-gray-400 whitespace-nowrap">
							{{ formatVNTime(notification.createdAt) }}
						</span>
						<div v-if="!notification.isRead" class="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
					</div>
				</div>

				<!-- Body -->
				<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
					{{ notification.body }}
				</p>

				<!-- Quick actions (chỉ hiện APPROVE_REJECT) -->
				<div v-if="notification.actionType === 'APPROVE_REJECT' && !isActioned" class="flex gap-2 mt-2" @click.stop>
					<button
						v-if="false"
						:disabled="isLoading"
						class="flex-1 py-1 px-2 text-xs font-medium rounded bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 disabled:opacity-50 transition-colors"
						@click="handleQuickApprove"
					>
						✓ Duyệt
					</button>

					<button
						v-if="false"
						:disabled="isLoading"
						class="flex-1 py-1 px-2 text-xs font-medium rounded bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-50 transition-colors"
						@click="showRejectInput = true"
					>
						✗ Từ chối
					</button>

					<button
						class="py-1 px-2 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
						@click="handleNavigate"
					>
						Xem →
					</button>
				</div>

				<!-- Reject note input -->
				<div v-if="showRejectInput" class="mt-2" @click.stop>
					<textarea
						v-model="rejectNote"
						placeholder="Lý do từ chối..."
						rows="2"
						class="w-full text-xs p-2 border border-gray-300 dark:border-gray-600 rounded resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-red-400"
					/>
					<div class="flex gap-2 mt-1">
						<button
							:disabled="!rejectNote.trim() || isLoading"
							class="flex-1 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
							@click="handleQuickReject"
						>
							Xác nhận từ chối
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
				<div v-if="isActioned" class="mt-1 text-xs text-green-600 dark:text-green-400 font-medium">
					✓ {{ actionedMessage }}
				</div>
			</div>
		</div>
	</div>
</template>
