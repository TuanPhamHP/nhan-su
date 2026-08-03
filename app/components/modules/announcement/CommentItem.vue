<script setup lang="ts">
	import MentionInput from '~/components/common/MentionInput.vue';
	import type { AnnouncementComment, AnnouncementReply } from '~/types/announcement.types';
	import { formatTimeAgo } from '~/utils/date';
	import { parseMentionContent } from '~/utils/mention.utils';

	defineOptions({ name: 'CommentItem' });

	interface EmployeeOption {
		id: number;
		fullName: string;
		avatarUrl: string | null;
	}

	const props = defineProps<{
		comment: AnnouncementComment | AnnouncementReply;
		currentUserId: number;
		currentUserRole: string;
		employees: EmployeeOption[];
		depth: 0 | 1;
		onReply: (content: string, parentId: number) => Promise<void>;
	}>();

	const emit = defineEmits<{
		deleted: [commentId: number];
	}>();

	const showReplyInput = ref(false);
	const showReplies = ref(false);
	const replyContent = ref('');
	const isSubmitting = ref(false);
	const replyInputRef = ref<InstanceType<typeof MentionInput> | null>(null);

	const parsedContent = computed(() => parseMentionContent(props.comment.content));

	const canDelete = computed(
		() => props.comment.author.id === props.currentUserId || ['HR', 'ADMIN'].includes(props.currentUserRole),
	);

	const isTopLevel = computed(() => props.depth === 0);

	function isFullComment(c: AnnouncementComment | AnnouncementReply): c is AnnouncementComment {
		return 'replies' in c;
	}

	const replyList = computed(() => (isFullComment(props.comment) ? (props.comment.replies ?? []) : []));
	const replyCount = computed(() => replyList.value.length);

	async function submitReply() {
		if (!replyContent.value.trim() || isSubmitting.value) return;
		isSubmitting.value = true;
		try {
			await props.onReply(replyContent.value.trim(), props.comment.id);
			replyContent.value = '';
			replyInputRef.value?.reset();
			showReplyInput.value = false;
			showReplies.value = true;
		} catch {
			// Parent đã toast lỗi — giữ nguyên input để user thử lại
		} finally {
			isSubmitting.value = false;
		}
	}

	function toggleReply() {
		showReplyInput.value = !showReplyInput.value;
		if (showReplyInput.value) {
			nextTick(() => replyInputRef.value?.focus());
		}
	}

	function handleDelete() {
		if (!confirm('Xóa bình luận này?')) return;
		emit('deleted', props.comment.id);
	}
</script>

<template>
	<div :class="['comment-item flex gap-2', depth === 1 ? 'ml-8 mt-2' : 'mt-3']">
		<CommonAppAvatar :src="comment.author.avatarUrl" :name="comment.author.fullName" size="sm" />

		<div class="flex-1 min-w-0">
			<div class="bg-gray-50 dark:bg-gray-800/60 rounded-2xl px-3 py-2 inline-block max-w-full">
				<p class="text-xs font-semibold text-gray-800 dark:text-gray-100 mb-0.5">
					{{ comment.author.fullName }}
					<span v-if="comment.author.positionName" class="text-gray-400 dark:text-gray-500 font-normal ml-1">
						· {{ comment.author.positionName }}
					</span>
				</p>

				<p v-if="comment.isDeleted" class="text-sm text-gray-400 italic">[Bình luận đã bị xóa]</p>
				<div
					v-else
					class="text-sm text-gray-700 dark:text-gray-200 comment-content whitespace-pre-wrap break-words"
					v-html="parsedContent"
				/>
			</div>

			<div class="flex items-center gap-3 mt-1 ml-1">
				<span class="text-xs text-gray-400 dark:text-gray-500">
					{{ formatTimeAgo(comment.createdAt) }}
				</span>

				<button
					v-if="isTopLevel && !comment.isDeleted"
					type="button"
					class="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
					@click="toggleReply"
				>
					Trả lời
				</button>

				<button
					v-if="canDelete && !comment.isDeleted"
					type="button"
					class="text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-red-500"
					@click="handleDelete"
				>
					Xóa
				</button>
			</div>

			<div v-if="showReplyInput && isTopLevel" class="mt-2">
				<MentionInput
					ref="replyInputRef"
					v-model="replyContent"
					:employees="employees"
					:placeholder="`Trả lời ${comment.author.fullName}... (@ để tag)`"
					class="w-full"
					@submit="submitReply"
				>
					<template #trailing>
						<button
							type="button"
							class="p-1.5 rounded-full flex items-center justify-center transition-all duration-200 focus:outline-none"
							:class="
								replyContent.trim() && !isSubmitting
									? 'text-[#0866FF] hover:text-[#0054D1] dark:text-blue-400 dark:hover:text-blue-300 hover:scale-110 active:scale-95 cursor-pointer'
									: 'text-gray-300 dark:text-gray-600 cursor-not-allowed opacity-60'
							"
							:disabled="!replyContent.trim() || isSubmitting"
							title="Gửi trả lời"
							@click="submitReply"
						>
							<svg v-if="isSubmitting" class="animate-spin w-5 h-5 text-[#0866FF] dark:text-blue-400" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
							</svg>
							<svg v-else class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
								<path d="M3.4 20.4l17.45-7.48a1 1 0 000-1.84L3.4 3.6a.993.993 0 00-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z" />
							</svg>
						</button>
					</template>
				</MentionInput>
				<div class="flex justify-end mt-1">
					<button
						type="button"
						class="text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 px-2 py-0.5"
						@click="
							showReplyInput = false;
							replyContent = '';
						"
					>
						Huỷ
					</button>
				</div>
			</div>

			<button
				v-if="isTopLevel && replyCount > 0"
				type="button"
				class="mt-1 ml-1 inline-flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-blue-400 hover:underline"
				@click="showReplies = !showReplies"
			>
				<svg
					class="w-3.5 h-3.5 transition-transform"
					:class="{ 'rotate-180': showReplies }"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
				</svg>
				{{ showReplies ? `Ẩn ${replyCount} phản hồi` : `Xem ${replyCount} phản hồi` }}
			</button>

			<div v-if="isTopLevel && showReplies && replyCount > 0" class="mt-1">
				<CommentItem
					v-for="reply in replyList"
					:key="reply.id"
					:comment="reply"
					:current-user-id="currentUserId"
					:current-user-role="currentUserRole"
					:employees="employees"
					:depth="1"
					:on-reply="onReply"
					@deleted="emit('deleted', $event)"
				/>
			</div>
		</div>
	</div>
</template>

<style scoped>
	.comment-content :deep(.mention-badge) {
		display: inline-block;
		background: #dbeafe;
		color: #1d4ed8;
		border-radius: 4px;
		padding: 0 4px;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s;
	}
	.comment-content :deep(.mention-badge:hover) {
		background: #bfdbfe;
	}
	.comment-content :deep(.comment-link) {
		color: #2563eb;
		text-decoration: underline;
		word-break: break-all;
	}
	.comment-content :deep(.comment-link:hover) {
		color: #1d4ed8;
	}
</style>
