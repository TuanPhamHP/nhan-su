# FE Agent Prompt — Block `table` cho trợ lý AI

## Context

Trợ lý đang trả lời được "tháng trước bạn đi muộn 7 lần" nhưng **không chỉ ra được những
ngày nào** — và còn tự nói "công cụ của tôi chỉ trả về số liệu tổng hợp". BE vừa bổ sung:

- Tool mới `attendance_listMyIrregularDays` — liệt kê từng ngày đi muộn / về sớm / vắng /
  thiếu chấm công của chính người hỏi.
- **Loại block SSE mới: `table`** — song song với `chart` đã có.

FE hiện chưa biết block này nên sẽ bỏ qua, người dùng không thấy bảng.

Doc đầy đủ: [`ai-agent.md`](./ai-agent.md) — mục **“`table` — bảng chi tiết do SERVER dựng”**.

---

## Thay đổi API

### Sự kiện SSE mới

```jsonc
{
  "type": "table",
  "tool": "attendance_listMyIrregularDays",
  "table": {
    "title": "Ngày cần lưu ý — tháng 9/2026",
    "columns": [
      { "key": "date",     "label": "Ngày" },
      { "key": "status",   "label": "Trạng thái" },
      { "key": "checkIn",  "label": "Giờ vào" },
      { "key": "checkOut", "label": "Giờ ra" },
      { "key": "issue",    "label": "Ghi nhận" }
    ],
    "rows": [
      { "date": "03/09/2026 (T5)", "status": "Đi muộn", "checkIn": "08:17", "checkOut": "17:35", "issue": "Muộn 17 phút" }
    ],
    "source": "7 ngày có phát sinh"
  },
  "conversationId": 12
}
```

### Types cần thêm

```typescript
export interface AgentTableColumn {
	key: string;
	label: string;
	/** 'number' canh phải. Mặc định 'text'. */
	align?: 'text' | 'number';
}

export interface AgentTable {
	title: string;
	columns: AgentTableColumn[];
	/** Mọi giá trị là chuỗi ĐÃ FORMAT sẵn — không phải number, không phải null. */
	rows: Record<string, string>[];
	source?: string;
}

// thêm vào union AgentStreamEvent:
| { type: 'table'; table: AgentTable; tool: string; conversationId?: number }
```

Bảng cũng được **lưu cùng tin nhắn** (giống `chart`), nên khi mở lại hội thoại cũ, block
`{ type: 'table', table }` nằm trong `message.content` — phải render được ở cả hai đường,
không chỉ lúc đang stream.

---

## Việc cần làm

| File | Việc |
|---|---|
| `app/types/agent.types.ts` | thêm `AgentTableColumn`, `AgentTable`, nhánh `table` vào `AgentStreamEvent` |
| `app/components/modules/agent/AgentTableBlock.vue` **(mới)** | component render bảng |
| `app/components/modules/agent/AgentMessageBubble.vue` | render `message.tables` giống chỗ đang render `message.charts` (dòng ~138) |
| nơi gom sự kiện SSE | gom `type: 'table'` vào `message.tables`, song song với `charts` |

Tham khảo `AgentChartBlock.vue` — làm đúng cùng một kiểu khung/khoảng cách để bảng và biểu
đồ nhìn như cùng một hệ.

---

## ⚠ Quy tắc render — đừng bỏ qua

- **Vẽ đúng những gì server gửi.** Không tự format lại số, không tự đổi `'—'` thành chữ
  khác, không tự thêm dòng tổng. Mọi ô đã là chuỗi hoàn chỉnh.
- **Không tự sắp xếp lại.** Thứ tự dòng là thứ tự server đã chốt (theo ngày tăng dần).
- **Không có `table` là bình thường** — tool trả 0 dòng thì BE không phát event, và trợ lý
  sẽ nói bằng lời là không có ngày nào. Đừng hiện khung bảng rỗng.
- **Bảng có thể dài ~30 dòng/tháng.** Cho cuộn, đừng cắt bớt dòng — cắt là người dùng
  tưởng mình chỉ đi muộn 5 hôm.
- Mobile: cho cuộn ngang, 5 cột không ép vừa màn hình hẹp được.
- `columns[].align === 'number'` → canh phải. Hiện chưa tool nào dùng, nhưng cứ theo.

---

## Scenario phải smoke

| # | Tình huống | Kỳ vọng |
|---|---|---|
| 1 | Hỏi "tháng trước tôi đi muộn những ngày nào" | Hiện bảng dưới câu trả lời |
| 2 | Tháng không có ngày bất thường | KHÔNG có khung bảng, chỉ có câu trả lời bằng lời |
| 3 | Mở lại hội thoại cũ có bảng | Bảng vẫn hiện (đọc từ `message.content`) |
| 4 | Bảng ~30 dòng | Cuộn được, không cắt dòng |
| 5 | Màn hình hẹp | Cuộn ngang, không vỡ layout |
| 6 | Lượt vừa có `chart` vừa có `table` | Cả hai cùng hiện, không đè nhau |

---

## Giới hạn

- **Không sửa repo BE.** Contract sai thì báo lại, đừng workaround ở FE.
- **Không tự tính toán gì từ `rows`** — không đếm lại, không cộng, không suy ra số liệu
  mới. Con số trên UI phải trùng con số trong câu trả lời của trợ lý.

## Báo lại

File đã sửa · bảng kết quả 6 scenario · chỗ nào thấy contract BE thiếu/sai.
