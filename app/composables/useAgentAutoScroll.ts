import type { Ref } from 'vue';
import type { AgentChatMessage } from '~/types/agent.types';

/**
 * Cuộn khung tin nhắn của trợ lý theo câu trả lời đang chảy về.
 *
 * Dùng chung cho trang Trợ lý và cửa sổ chat nhanh: hai khung có cùng luồng stream, cùng thẻ
 * form, biểu đồ và bảng đến sau chữ, nên luật "lúc nào thì tự kéo xuống đáy" phải giống nhau.
 * Gắn `scroller` vào phần tử cuộn bằng `ref="scroller"` và `onScroll` vào sự kiện `scroll`.
 */
export function useAgentAutoScroll(messages: Ref<AgentChatMessage[]>) {
	const scroller = ref<HTMLElement | null>(null);
	/** Bật khi chính người dùng vừa hành động → luôn kéo xuống đáy dù đang đọc ở trên. */
	const forceScroll = ref(false);

	/**
	 * Đang ở sát đáy hay không — quyết định có hiện nút "xuống cuối".
	 *
	 * Ngưỡng RỘNG HƠN `nearBottom()` (240 vs 120): dùng chung một ngưỡng thì nút nhấp nháy
	 * ở đúng vùng ranh giới, cuộn nhẹ một chút là nó hiện rồi lại biến mất.
	 */
	const atBottom = ref(true);

	/** Đo TRƯỚC khi DOM cập nhật — sau khi thêm nội dung thì không còn ở đáy nữa. */
	function nearBottom(): boolean {
		const el = scroller.value;
		if (!el) return true;
		return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
	}

	// Cuộn theo cả tin nhắn mới lẫn từng mảnh stream — nhưng chỉ khi người dùng đang
	// ở sát đáy. Đang đọc lại đoạn trên mà bị kéo xuống theo từng mảnh stream thì rất khó chịu.
	watch(
		// Kèm cả trạng thái form: nó hiện ra sau khi chữ đã chảy xong, không theo dõi thì
		// khung cao thêm cả trăm px mà không tự cuộn, người dùng không thấy nút xác nhận.
		// Cùng lý do với biểu đồ và BẢNG: cả hai đến bằng event riêng SAU khi chữ đã chảy
		// xong, và một bảng 30 dòng cao hơn cả màn hình — không theo dõi số lượng của
		// chúng thì người dùng đọc xong câu trả lời mà không biết dưới còn bảng.
		() =>
			messages.value
				.map((m) => `${m.text}|${m.pending?.state ?? ''}|${m.charts?.length ?? 0}|${m.tables?.length ?? 0}`)
				.join(''),
		async () => {
			const stick = forceScroll.value || nearBottom();
			await nextTick();
			if (!stick) return;
			forceScroll.value = false;
			if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight;
		},
	);

	function onScroll(): void {
		const el = scroller.value;
		if (!el) return;
		atBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 240;
	}

	const showScrollDown = computed(() => !atBottom.value && messages.value.length > 0);

	function scrollToBottom(smooth = true): void {
		const el = scroller.value;
		if (!el) return;
		el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
		atBottom.value = true;
	}

	/**
	 * Chạm vào ô nhập là kéo thẳng xuống tin mới nhất.
	 *
	 * Trên điện thoại, bàn phím bật lên ăn mất nửa màn hình; đang đọc lại đoạn cũ mà gõ
	 * tiếp thì câu trả lời mới chảy ra ngoài tầm nhìn. `false` = không cuộn mượt: lúc này
	 * viewport đang co lại vì bàn phím, animation mượt sẽ chạy đua với nó và dừng sai chỗ.
	 */
	function onComposerFocus(): void {
		void nextTick(() => scrollToBottom(false));
	}

	return { scroller, forceScroll, onScroll, showScrollDown, scrollToBottom, onComposerFocus };
}
