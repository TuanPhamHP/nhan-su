<script setup lang="ts">
	import MentionInput from '~/components/common/MentionInput.vue';
	import { useGeneralRequestService } from '~/services/general-request.service';
	import { splitMentionDraft } from '~/utils/recruitment-mention.utils';
	import { formatDateTime } from '~/utils/date';
	import type { RequestComment } from '~/types/general-request.types';

	/**
	 * Bình luận trên một phiếu đề xuất.
	 *
	 * Người nhắc tên chỉ lấy trong số người XEM ĐƯỢC phiếu (người gửi, người theo dõi, người
	 * duyệt ở mọi vòng) chứ không lấy cả danh bạ công ty: nhắc người ngoài danh sách đó thì máy
	 * chủ trả 400 `REQUEST_MENTION_NOT_VIEWER`, và nhân viên bình thường cũng không gọi được
	 * `/v1/employees` để dựng danh bạ.
	 *
	 * `splitMentionDraft` dùng chung với khu tuyển dụng: API ở đây cũng mang người được nhắc ở
	 * mảng `mentionIds` riêng, không dò dấu trong `body`.
	 */
	const props = defineProps<{
		requestId: number;
		canComment: boolean;
		/** Người được phép nhắc tên. */
		mentionable: Array<{ id: number; fullName: string; avatarUrl: string | null }>;
	}>();

	const emit = defineEmits<{ posted: [] }>();

	const toast = useToast();
	const service = useGeneralRequestService();

	const items = ref<RequestComment[]>([]);
	const loading = ref(true);
	const draft = ref('');
	const sending = ref(false);
	const inputRef = ref<InstanceType<typeof MentionInput> | null>(null);

	const nameById = computed(() => new Map(props.mentionable.map(p => [p.id, p.fullName])));

	function mentionNames(ids: number[]): string {
		return ids
			.map(id => nameById.value.get(id))
			.filter(Boolean)
			.join(', ');
	}

	async function load() {
		loading.value = true;
		try {
			items.value = await service.findComments(props.requestId);
		} catch (e) {
			items.value = [];
			toast.error(e instanceof Error ? e.message : 'Chưa tải được bình luận.');
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);
	defineExpose({ reload: load });

	async function send() {
		const { body, mentionIds } = splitMentionDraft(draft.value);
		if (!body) {
			toast.error('Bạn nhập nội dung bình luận trước đã.');
			return;
		}
		sending.value = true;
		try {
			const created = await service.addComment(props.requestId, {
				body,
				mentionIds: mentionIds.length ? mentionIds : undefined,
			});
			items.value = [...items.value, created];
			draft.value = '';
			inputRef.value?.reset();
			toast.success('Đã gửi bình luận.');
			emit('posted');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa gửi được bình luận.');
		} finally {
			sending.value = false;
		}
	}
</script>

<template>
	<section class="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
		<h2 class="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-white">
			Bình luận
			<span v-if="items.length" class="font-normal text-gray-500 dark:text-gray-400">({{ items.length }})</span>
		</h2>

		<div v-if="loading" class="space-y-3 p-4">
			<div v-for="i in 2" :key="i" class="h-14 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
		</div>

		<p v-else-if="!items.length" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
			Chưa có bình luận nào trên phiếu này.
		</p>

		<ul v-else class="divide-y divide-gray-100 dark:divide-gray-800">
			<li v-for="comment in items" :key="comment.id" class="px-4 py-3">
				<div class="flex flex-wrap items-center gap-2">
					<p class="text-sm font-medium text-gray-900 dark:text-white">{{ comment.author.fullName }}</p>
					<span class="text-xs text-gray-400">{{ formatDateTime(comment.createdAt) }}</span>
				</div>
				<p class="mt-1 whitespace-pre-line text-sm text-gray-700 dark:text-gray-300">{{ comment.body }}</p>
				<p v-if="mentionNames(comment.mentionIds)" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
					Đã nhắc {{ mentionNames(comment.mentionIds) }}
				</p>
			</li>
		</ul>

		<div v-if="canComment" class="space-y-2.5 border-t border-gray-200 p-4 dark:border-gray-700">
			<MentionInput
				ref="inputRef"
				v-model="draft"
				:employees="mentionable"
				placeholder="Viết bình luận, gõ @ để nhắc người liên quan"
				class="w-full"
				@submit="send"
			/>
			<CommonAppButton size="sm" :loading="sending" @click="send">Gửi bình luận</CommonAppButton>
		</div>
		<p v-else class="border-t border-gray-200 px-4 py-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
			Phiếu chưa gửi nên chưa bình luận được.
		</p>
	</section>
</template>
