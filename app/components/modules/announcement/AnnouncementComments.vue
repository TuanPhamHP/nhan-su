<script setup lang="ts">
	import MentionInput from '~/components/common/MentionInput.vue';
	import CommentItem from '~/components/modules/announcement/CommentItem.vue';
	import { useAnnouncementRealtime } from '~/composables/useAnnouncementRealtime';
	import { useAuth } from '~/composables/useAuth';
	import { useCompanyAnnouncements } from '~/composables/useCompanyAnnouncements';
	import type { AnnouncementComment, AnnouncementReply } from '~/types/announcement.types';

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
	const { subscribe: subscribeRealtime } = useAnnouncementRealtime();
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

	const sortedComments = computed(() =>
		[...comments.value].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
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
			// Dedupe: socket broadcast có thể đến trước khi HTTP response về (server emit rồi mới trả).
			if (!comments.value.some(c => c.id === created.id)) {
				comments.value.push(created);
			}
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
				const replies = parent.replies ?? [];
				// Dedupe: cùng lý do như submitComment — socket event có thể tới trước response.
				if (!replies.some(r => r.id === created.id)) {
					parent.replies = [...replies, created];
					parent.replyCount = parent.replies.length;
				}
			}
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Không gửi được trả lời');
			throw e;
		}
	}

	async function handleDeleted(commentId: number) {
		try {
			await deleteComment(commentId);
			removeCommentLocally(commentId);
			toast.success('Đã xóa bình luận');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Không xóa được bình luận');
		}
	}

	function removeCommentLocally(commentId: number) {
		comments.value = comments.value
			.filter(c => c.id !== commentId)
			.map(c => {
				const filtered = (c.replies ?? []).filter(r => r.id !== commentId);
				if (filtered.length === (c.replies?.length ?? 0)) return c;
				return { ...c, replies: filtered, replyCount: filtered.length };
			});
	}

	// ── Realtime ──────────────────────────────────────────────────────────────
	// Server broadcast:
	//   - `comment.added`: comment mới (root hoặc reply — phân biệt qua parentId)
	//   - `comment.deleted`: comment/reply bị xoá
	// Dedupe theo `id` để tránh double-append khi optimistic UI đã push local record.
	let unsubscribeRealtime: (() => void) | null = null;

	function handleRemoteCommentAdded(c: AnnouncementComment) {
		if (c.parentId === null) {
			if (comments.value.some(x => x.id === c.id)) return;
			comments.value = [...comments.value, c];
			return;
		}
		const parent = comments.value.find(x => x.id === c.parentId);
		if (!parent) return;
		const replies = parent.replies ?? [];
		if (replies.some(r => r.id === c.id)) return;
		// `c` có shape AnnouncementComment nhưng khi parentId !== null thì logic hiển thị
		// giống hệt AnnouncementReply (không có replies lồng bên trong).
		const reply: AnnouncementReply = {
			id: c.id,
			announcementId: c.announcementId,
			parentId: c.parentId,
			author: c.author,
			content: c.content,
			mentionIds: c.mentionIds,
			isDeleted: c.isDeleted,
			createdAt: c.createdAt,
			updatedAt: c.updatedAt,
		};
		parent.replies = [...replies, reply];
		parent.replyCount = parent.replies.length;
	}

	onMounted(() => {
		loadComments();
		loadMentionablePool();
		unsubscribeRealtime = subscribeRealtime(props.announcementId, {
			onCommentAdded: handleRemoteCommentAdded,
			onCommentDeleted: ({ commentId }) => removeCommentLocally(commentId),
		});
	});

	onBeforeUnmount(() => {
		unsubscribeRealtime?.();
		unsubscribeRealtime = null;
	});
</script>

<template>
	<div class="announcement-comments">
		<h4 class="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-3">Bình luận ({{ comments.length }})</h4>

		<div class="flex gap-2 mt-4 items-start">
			<CommonAppAvatar :src="user?.avatarUrl" :name="user?.fullName" size="sm" />
			<div class="flex-1">
				<MentionInput
					ref="newCommentInputRef"
					v-model="newComment"
					:employees="employees"
					placeholder="Viết bình luận... (@ để tag người)"
					class="w-full"
					@submit="submitComment"
				>
					<template #trailing>
						<button
							type="button"
							class="p-1.5 rounded-full flex items-center justify-center transition-all duration-200 focus:outline-none"
							:class="
								newComment.trim() && !isSubmitting
									? 'text-[#0866FF] hover:text-[#0054D1] dark:text-blue-400 dark:hover:text-blue-300 hover:scale-110 active:scale-95 cursor-pointer'
									: 'text-gray-300 dark:text-gray-600 cursor-not-allowed opacity-60'
							"
							:disabled="!newComment.trim() || isSubmitting"
							title="Gửi bình luận"
							@click="submitComment"
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
			</div>
		</div>
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
				<div v-if="!comments.length" class="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
					Chưa có bình luận nào. Hãy là người đầu tiên!
				</div>
				<div v-if="hasMore" class="pt-3">
					<button
						type="button"
						class="text-sm font-medium text-gray-600 dark:text-white hover:underline"
						@click="loadMore"
					>
						Xem thêm bình luận
					</button>
				</div>
			</template>
		</div>
	</div>
</template>
