<script setup lang="ts">
	import MentionInput from '~/components/common/MentionInput.vue';
	import CommentItem from '~/components/modules/announcement/CommentItem.vue';
	import { useAuth } from '~/composables/useAuth';
	import { useCompanyAnnouncements } from '~/composables/useCompanyAnnouncements';
	import type { AnnouncementComment } from '~/types/announcement.types';

	interface EmployeeOption {
		id: number;
		fullName: string;
		avatarUrl: string | null;
	}

	const props = defineProps<{
		announcementId: number;
	}>();

	const { user } = useAuth();
	const { getComments, addComment, deleteComment, getMentionableEmployees } = useCompanyAnnouncements();
	const toast = useToast();

	const PAGE_SIZE = 10;

	const comments = ref<AnnouncementComment[]>([]);
	const mentionablePool = ref<EmployeeOption[]>([]);
	const isLoading = ref(true);
	const isSubmitting = ref(false);
	const newComment = ref('');
	const newCommentInputRef = ref<InstanceType<typeof MentionInput> | null>(null);
	const visibleCount = ref(PAGE_SIZE);

	// Nguồn chính: pool từ BE (recipients ACTIVE ∪ creator ∪ HR ACTIVE).
	// Bổ sung: authors của comment/reply đã hiển thị, phòng khi role/status của họ thay đổi
	// sau lúc comment mà FE vẫn cần hiển thị avatar/name để tag lại.
	const employees = computed<EmployeeOption[]>(() => {
		const map = new Map<number, EmployeeOption>();
		for (const e of mentionablePool.value) map.set(e.id, e);
		for (const c of comments.value) {
			if (!map.has(c.author.id)) {
				map.set(c.author.id, {
					id: c.author.id,
					fullName: c.author.fullName,
					avatarUrl: c.author.avatarUrl,
				});
			}
			for (const r of c.replies ?? []) {
				if (!map.has(r.author.id)) {
					map.set(r.author.id, {
						id: r.author.id,
						fullName: r.author.fullName,
						avatarUrl: r.author.avatarUrl,
					});
				}
			}
		}
		// Không cho tag chính mình
		if (user.value?.id) map.delete(user.value.id);
		return Array.from(map.values());
	});

	const currentUserId = computed(() => user.value?.id ?? 0);
	const currentUserRole = computed(() => user.value?.role ?? '');
	const currentUserInitial = computed(() =>
		user.value?.fullName ? user.value.fullName.charAt(0).toUpperCase() : '?',
	);

	const sortedComments = computed(() =>
		[...comments.value].sort(
			(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		),
	);
	const visibleComments = computed(() => sortedComments.value.slice(0, visibleCount.value));
	const hasMore = computed(() => sortedComments.value.length > visibleCount.value);

	function loadMore() {
		visibleCount.value = Math.min(visibleCount.value + PAGE_SIZE, sortedComments.value.length);
	}

	async function loadComments() {
		isLoading.value = true;
		try {
			comments.value = await getComments(props.announcementId);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Không tải được bình luận');
		} finally {
			isLoading.value = false;
		}
	}

	async function loadMentionablePool() {
		try {
			const list = await getMentionableEmployees(props.announcementId);
			mentionablePool.value = list.map(e => ({
				id: e.id,
				fullName: e.fullName,
				avatarUrl: e.avatarUrl,
			}));
		} catch {
			// Không toast — mention picker vẫn hoạt động với authors từ comments đã load
			mentionablePool.value = [];
		}
	}

	async function submitComment() {
		const content = newComment.value.trim();
		if (!content || isSubmitting.value) return;
		isSubmitting.value = true;
		try {
			const created = await addComment(props.announcementId, content);
			comments.value.push(created);
			// Bảo đảm bình luận vừa gửi luôn hiển thị trong danh sách đang show
			if (visibleCount.value < PAGE_SIZE) visibleCount.value = PAGE_SIZE;
			newComment.value = '';
			newCommentInputRef.value?.reset();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Không gửi được bình luận');
		} finally {
			isSubmitting.value = false;
		}
	}

	async function handleReply(content: string, parentId: number) {
		try {
			const created = await addComment(props.announcementId, content, parentId);
			const parent = comments.value.find(c => c.id === parentId);
			if (parent) {
				parent.replies = [...(parent.replies ?? []), created];
				parent.replyCount = parent.replies.length;
			}
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Không gửi được trả lời');
			throw e;
		}
	}

	async function handleDeleted(commentId: number) {
		try {
			await deleteComment(commentId);
			await loadComments();
			toast.success('Đã xóa bình luận');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Không xóa được bình luận');
		}
	}

	onMounted(() => {
		loadComments();
		loadMentionablePool();
	});
</script>

<template>
	<div class="announcement-comments">
		<h4 class="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-3">
			Bình luận ({{ comments.length }})
		</h4>

		<div class="space-y-1">
			<div v-if="isLoading" class="py-4 flex justify-center">
				<svg class="animate-spin w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
				</svg>
			</div>

			<template v-else>
				<CommentItem
					v-for="comment in visibleComments"
					:key="comment.id"
					:comment="comment"
					:current-user-id="currentUserId"
					:current-user-role="currentUserRole"
					:employees="employees"
					:depth="0"
					:on-reply="handleReply"
					@deleted="handleDeleted"
				/>
				<div
					v-if="!comments.length"
					class="text-sm text-gray-400 dark:text-gray-500 text-center py-4"
				>
					Chưa có bình luận nào. Hãy là người đầu tiên!
				</div>
				<div v-if="hasMore" class="pt-3">
					<button
						type="button"
						class="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
						@click="loadMore"
					>
						Xem thêm bình luận
					</button>
				</div>
			</template>
		</div>

		<div class="flex gap-2 mt-4 items-start">
			<div
				class="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0 flex items-center justify-center text-sm font-medium text-gray-600 dark:text-gray-300 overflow-hidden"
			>
				<img
					v-if="user?.avatarUrl"
					:src="user.avatarUrl"
					:alt="user.fullName"
					class="w-full h-full object-cover"
				/>
				<span v-else>{{ currentUserInitial }}</span>
			</div>
			<div class="flex-1">
				<MentionInput
					ref="newCommentInputRef"
					v-model="newComment"
					:employees="employees"
					placeholder="Viết bình luận... (@ để tag người)"
					class="w-full"
					@submit="submitComment"
				/>
				<div class="flex justify-end mt-1.5">
					<button
						type="button"
						class="px-4 py-1.5 bg-blue-500 text-white text-sm rounded-xl disabled:opacity-40 hover:bg-blue-600 transition-colors"
						:disabled="!newComment.trim() || isSubmitting"
						@click="submitComment"
					>
						{{ isSubmitting ? 'Đang gửi...' : 'Bình luận' }}
					</button>
				</div>
			</div>
		</div>
	</div>
</template>
