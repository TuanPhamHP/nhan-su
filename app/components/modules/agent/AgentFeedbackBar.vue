<script setup lang="ts">
	import type {
		AgentChatMessage,
		AgentFeedbackOption,
		AgentFeedbackRating,
	} from '~/types/agent.types';

	/**
	 * Thanh chấm điểm dưới một câu trả lời của trợ lý.
	 *
	 * Chỉ hiện khi SERVER mời (`message.feedbackPrompt`) hoặc khi lượt đó ĐÃ được chấm.
	 * FE không tự quyết định nhịp hỏi — xem `AgentFeedbackPrompt`.
	 */
	const props = defineProps<{ message: AgentChatMessage }>();

	const emit = defineEmits<{
		rate: [messageId: number, rating: AgentFeedbackRating, comment?: string];
	}>();

	const showComment = ref(false);
	const draft = ref('');

	const rated = computed(() => !!props.message.feedback);
	const saving = computed(() => props.message.feedbackState === 'saving');
	const failed = computed(() => props.message.feedbackState === 'failed');

	/**
	 * Danh sách nút. Nhãn tiếng Việt LUÔN đến từ server, không hardcode ở FE — nếu
	 * hardcode thì sửa chữ ở `vi-labels.ts` xong web vẫn hiện chữ cũ.
	 *
	 * Mở lại hội thoại cũ thì không có `feedbackPrompt` (server chỉ gửi kèm lúc mời), nên
	 * chỉ hiện đúng mức đã chấm dưới dạng một chip tĩnh.
	 */
	const options = computed<AgentFeedbackOption[]>(() => {
		const fromPrompt = props.message.feedbackPrompt?.options;
		if (fromPrompt?.length) return fromPrompt;
		const fb = props.message.feedback;
		return fb ? [{ value: fb.rating, label: fb.ratingLabel }] : [];
	});

	const canChange = computed(() => (props.message.feedbackPrompt?.options?.length ?? 0) > 0);

	const headline = computed(() => {
		if (rated.value) return 'Cảm ơn bạn đã đánh giá';
		return props.message.feedbackPrompt?.question ?? 'Câu trả lời này thế nào?';
	});

	const placeholder = computed(
		() => props.message.feedbackPrompt?.commentPlaceholder ?? 'Muốn nói thêm gì không?',
	);

	function pick(rating: AgentFeedbackRating): void {
		if (saving.value) return;
		// Bấm lại đúng mức đang chọn = không có gì mới để gửi.
		if (props.message.feedback?.rating === rating && !failed.value) return;
		if (!props.message.messageId) return;
		emit('rate', props.message.messageId, rating, props.message.feedback?.comment ?? undefined);
	}

	function openComment(): void {
		draft.value = props.message.feedback?.comment ?? '';
		showComment.value = true;
	}

	function sendComment(): void {
		const rating = props.message.feedback?.rating;
		if (!rating || !props.message.messageId) return;
		emit('rate', props.message.messageId, rating, draft.value.trim() || undefined);
		showComment.value = false;
	}
</script>

<template>
	<!-- `data-testid` là điểm neo cho tests/e2e/agent-feedback-shots.mjs — đừng đổi tên -->
	<div
		v-if="options.length"
		data-testid="agent-feedback-bar"
		class="flex flex-col gap-1.5 px-1 animate-fade-in"
	>
		<div class="flex flex-wrap items-center gap-1.5">
			<!--
				`w-full sm:w-auto`: ở khổ điện thoại, câu hỏi chiếm trọn một dòng để 4 nút
				xuống hàng thành khối đều nhau. Để chung hàng thì nút đầu bị kéo lên cạnh
				câu hỏi còn ba nút kia rơi xuống — nhìn như vỡ layout (đã chụp thấy trên iPhone 13).
			-->
			<span class="w-full text-[11px] text-gray-400 sm:w-auto dark:text-gray-500">
				{{ headline }}
			</span>

			<button
				v-for="o in options"
				:key="o.value"
				type="button"
				:disabled="saving || (rated && !canChange)"
				:aria-pressed="message.feedback?.rating === o.value"
				:class="[
					'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition disabled:cursor-default',
					message.feedback?.rating === o.value
						? 'border-transparent bg-[var(--color-accent)] text-white'
						: 'border-gray-200 text-gray-500 hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] dark:border-gray-600 dark:text-gray-300',
				]"
				@click="pick(o.value)"
			>
				{{ o.label }}
			</button>

			<Icon v-if="saving" name="heroicons:arrow-path" class="h-3 w-3 animate-spin text-gray-400" />
		</div>

		<p v-if="failed" class="text-[11px] text-red-500 dark:text-red-400">
			Không gửi được đánh giá. Bạn bấm lại giúp mình nhé.
		</p>

		<!-- Góp ý chữ: chỉ mời SAU khi đã chấm, để bước đầu chỉ mất một cú bấm -->
		<template v-if="rated">
			<p
				v-if="message.feedback?.comment && !showComment"
				class="text-[11px] italic text-gray-500 dark:text-gray-400"
			>
				“{{ message.feedback.comment }}”
			</p>

			<button
				v-if="!showComment"
				type="button"
				class="self-start text-[11px] text-gray-400 underline decoration-dotted transition hover:text-gray-600 dark:hover:text-gray-200"
				@click="openComment"
			>
				{{ message.feedback?.comment ? 'Sửa ghi chú' : 'Thêm ghi chú' }}
			</button>

			<form v-else class="flex flex-col gap-1.5" @submit.prevent="sendComment">
				<textarea
					v-model="draft"
					rows="2"
					maxlength="1000"
					:placeholder="placeholder"
					class="w-full max-w-sm rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 focus:border-[var(--color-accent)] focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
				/>
				<div class="flex items-center gap-2">
					<button
						type="submit"
						:disabled="saving"
						class="rounded-full bg-[var(--color-accent)] px-2.5 py-0.5 text-[11px] font-medium text-white transition disabled:opacity-60"
					>
						Gửi
					</button>
					<button
						type="button"
						class="text-[11px] text-gray-400 transition hover:text-gray-600 dark:hover:text-gray-200"
						@click="showComment = false"
					>
						Bỏ
					</button>
				</div>
			</form>
		</template>
	</div>
</template>
