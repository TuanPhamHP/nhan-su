# FE Agent Prompt — ADMIN xem lại hội thoại ở `/agent-usage`

## Context

Trang `/agent-usage` cho biết ai đang dùng trợ lý, tốn bao nhiêu và hỏi chủ đề gì, nhưng không cho
biết người dùng đang phàn nàn cụ thể điều gì. Nhiều người phàn nàn ngay trong chat mà không bấm chấm
điểm, nên phải đọc được hội thoại mới biết cần cải thiện chỗ nào.

Chủ dự án đã chốt các ràng buộc sau:

- **Chỉ `ADMIN`.** `HR` và `DIRECTOR` vẫn vào được trang này nhưng không thấy phần mới.
- Xem được mọi hội thoại, trừ hội thoại người dùng đã xoá.
- Mỗi lần mở một hội thoại, BE ghi một dòng nhật ký hệ thống.
- Chưa thêm thông báo cho nhân viên trong khung chat, chủ dự án quyết sau khi test local.

Doc đầy đủ: [`ai-agent.md`](./ai-agent.md), mục **"Xem lại hội thoại của nhân viên — chỉ ADMIN"**.

---

## Thay đổi API

| Endpoint | Thay đổi |
|---|---|
| `GET /v1/agent/analytics/conversations` | Mới, chỉ `ADMIN`, có phân trang |
| `GET /v1/agent/analytics/conversations/:id/messages` | Mới, chỉ `ADMIN`, ghi log mỗi lần gọi |
| `GET /v1/agent/analytics/feedback` | Mỗi phần tử `comments[]` thêm `conversationId`, `messageId` (có thể `null`) |

Không có endpoint nào bị đổi hình dạng theo kiểu phá client cũ.

## Type TypeScript cần khai

Đặt trong `app/types/agent-analytics.types.ts`. `AgentChart` và `AgentTable` dùng lại kiểu đã có ở
`app/types/agent.types.ts`.

```ts
export interface AgentReviewConversation {
	id: number;
	title: string | null;
	employeeId: number;
	fullName: string;
	employeeCode: string | null;
	department: string | null;
	lastMessageAt: string | null;
	createdAt: string;
	messageCount: number;
	badRatings: number;
	averageRatings: number;
	comments: number;
	fallbacks: number;
	errors: number;
}

export interface AgentReviewFeedback {
	messageId: number;
	rating: string;
	ratingLabel: string;
	comment: string | null;
	playbookId: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface AgentReviewMessage {
	id: number;
	role: 'user' | 'assistant' | 'system';
	text: string;
	charts?: AgentChart[];
	tables?: AgentTable[];
	feedback: AgentReviewFeedback | null;
	createdAt: string;
}

export interface AgentConversationTranscript {
	conversation: AgentReviewConversation;
	messages: AgentReviewMessage[];
}
```

`AgentFeedbackComment` thêm `conversationId: number | null` và `messageId: number | null`.

---

## Màn hình cần sửa

| File | Việc |
|---|---|
| `app/pages/agent-usage.vue` | Tính `canReview = role === 'ADMIN'`, truyền xuống, giữ state hội thoại đang mở |
| `app/components/modules/agent/AgentUserDetailModal.vue` | Thêm mục "Hội thoại" khi `canReview`: danh sách trong khoảng đang lọc, badge vấn đề, công tắc "Chỉ hội thoại có vấn đề", phân trang |
| `app/components/modules/agent/AgentFeedbackPanel.vue` | Mỗi góp ý có nút "Xem hội thoại" khi `canReview` và `conversationId` khác `null` |
| `app/components/modules/agent/AgentConversationTranscript.vue` | **Mới.** Khung đọc một hội thoại, chỉ đọc |
| `app/services/agent-analytics.service.ts`, `app/composables/useAgentAnalytics.ts`, `app/types/agent-analytics.types.ts` | Hai lời gọi mới và type |

Yêu cầu cho khung đọc:

- Đầu khung có tên người dùng, tiêu đề, và một dòng nhỏ: "Mỗi lần mở hội thoại đều được ghi vào
  nhật ký hệ thống."
- Câu trả lời đi qua `DOMPurify.sanitize(renderAgentMarkdown(text))` như `AgentMessageBubble.vue`,
  dùng lại `AgentChartBlock` và `AgentTableBlock`. Không dùng nguyên `AgentMessageBubble`, vì nó có
  nút chấm điểm và form xác nhận.
- Dưới câu trả lời đã chấm, hiện nhãn điểm, chủ đề (`PLAYBOOK_LABELS`) và góp ý.
- Mở từ một góp ý thì cuộn tới đúng `messageId` và làm nổi câu đó.
- Chỉ gọi `/messages` khi người dùng bấm mở, không tải trước, không tự tải lại.

---

## Scenario cần test

1. `ADMIN` mở một người, thấy danh sách hội thoại trong khoảng đang lọc.
2. Mở hội thoại: markdown, bảng, biểu đồ và dòng hệ thống hiện đúng, không có nút chấm, không có form.
3. Badge điểm thấp, góp ý, fallback, lỗi đúng số. Công tắc lọc đổi danh sách và về trang 1.
4. Từ góp ý bấm "Xem hội thoại" thì mở đúng hội thoại và cuộn tới đúng câu.
5. Góp ý có `conversationId: null` không có nút.
6. `HR` và `DIRECTOR` thấy số liệu như cũ, không thấy danh sách hay nút, và không có request nào tới
   hai endpoint mới. `MANAGER`, `CHIEF`, `EMPLOYEE` ở chế độ "của tôi" như cũ.
7. Đang tải, danh sách rỗng, phân trang.
8. 403 và 404 từ BE hiện thông báo, không trắng trang.
9. Khung đọc dùng được ở bề ngang điện thoại.
