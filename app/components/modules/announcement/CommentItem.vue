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
		() =>
			props.comment.author.id === props.currentUserId ||
			['HR', 'ADMIN'].includes(props.currentUserRole),
	);

	const isTopLevel = computed(() => props.depth === 0);

	function isFullComment(c: AnnouncementComment | AnnouncementReply): c is AnnouncementComment {
		return 'replies' in c;
	}

	const replyList = computed(() =>
		isFullComment(props.comment) ? props.comment.replies ?? [] : [],
	);
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

	function initials(name: string): string {
		return name
			.split(/\s+/)
			.filter(Boolean)
			.slice(-2)
			.map(w => w.charAt(0).toUpperCase())
			.join('');
	}
</script>

<template>
	<div :class="['comment-item flex gap-2', depth === 1 ? 'ml-8 mt-2' : 'mt-3']">
		<div class="flex-shrink-0">
			<div
				class="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex items-center justify-center text-sm font-medium"
			>
				<img
					v-if="comment.author.avatarUrl"
					:src="comment.author.avatarUrl"
					:alt="comment.author.fullName"
					class="w-full h-full object-cover"
				/>
				<span v-else class="text-gray-600 dark:text-gray-300 text-xs">
					{{ initials(comment.author.fullName) }}
				</span>
			</div>
		</div>

		<div class="flex-1 min-w-0">
			<div class="bg-gray-50 dark:bg-gray-800/60 rounded-2xl px-3 py-2 inline-block max-w-full">
				<p class="text-xs font-semibold text-gray-800 dark:text-gray-100 mb-0.5">
					{{ comment.author.fullName }}
					<span
						v-if="comment.author.positionName"
						class="text-gray-400 dark:text-gray-500 font-normal ml-1"
					>
						· {{ comment.author.positionName }}
					</span>
				</p>

				<p v-if="comment.isDeleted" class="text-sm text-gray-400 italic">
					[Bình luận đã bị xóa]
				</p>
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

			<div v-if="showReplyInput && isTopLevel" class="mt-2 flex gap-2 items-start">
				<MentionInput
					ref="replyInputRef"
					v-model="replyContent"
					:employees="employees"
					:placeholder="`Trả lời ${comment.author.fullName}...`"
					class="flex-1"
					@submit="submitReply"
				/>
				<button
					type="button"
					class="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-xl disabled:opacity-40 hover:bg-blue-600 transition-colors flex-shrink-0"
					:disabled="!replyContent.trim() || isSubmitting"
					@click="submitReply"
				>
					Gửi
				</button>
				<button
					type="button"
					class="px-3 py-1.5 text-gray-400 dark:text-gray-500 text-sm hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
					@click="
						showReplyInput = false;
						replyContent = '';
					"
				>
					Huỷ
				</button>
			</div>

			<button
				v-if="isTopLevel && replyCount > 0"
				type="button"
				class="mt-1 ml-1 inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
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
