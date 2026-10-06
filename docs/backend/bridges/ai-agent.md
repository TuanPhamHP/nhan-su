# Bridge Docs — Trợ lý AI (`/v1/agent`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.
>
> Doc này mô tả **đúng hành vi hiện tại của server**, đọc trực tiếp từ `src/modules/ai-agent/nestjs/`.
> Thiết kế module & lý do kiến trúc: [`../ai-agent/README.md`](../ai-agent/README.md) · Danh mục tool: [`../ai-agent/tools.md`](../ai-agent/tools.md)

---

## Ba điều phải biết trước khi viết dòng code đầu tiên

1. **Module có thể bị TẮT.** `AGENT_ENABLED=false` → `AiAgentModule.forRoot()` không đăng ký
   controller nào, mọi route `/v1/agent/*` trả **404**. Client phải coi đây là *trạng thái bình
   thường* → ẩn UI trợ lý, **không** hiện toast đỏ.
2. **Endpoint stream là `POST`, không phải `GET`.** `EventSource` của browser **không dùng được**
   (chỉ GET, không gắn được header `Authorization`). Phải dùng `fetch` + `ReadableStream`, hoặc
   `http.Client().send()` trên Flutter.
3. **Trên endpoint stream, lỗi nghiệp vụ KHÔNG về dưới dạng HTTP status.** Header đã flush trước
   khi generator chạy → hết quota / hội thoại không tồn tại đều tới dưới dạng `event: error` với
   **HTTP 200**. Xem [§ Lỗi trên endpoint stream](#lỗi-trên-endpoint-stream--điểm-dễ-sai-nhất).

---

## Endpoints

| Method | Path | Ai được gọi | Ghi chú |
|--------|------|-------------|---------|
| POST | `/v1/agent/chat/stream` | Mọi user đã đăng nhập | Hỏi trợ lý, nhận SSE — **đường dùng chính cho UI chat** |
| POST | `/v1/agent/chat` | Mọi user đã đăng nhập | Trả một JSON. **Không trả form** — chỉ dùng cho read-only / health check |
| POST | `/v1/agent/actions/:id/confirm` | Chủ của form | **Nơi duy nhất** thực thi thao tác ghi |
| POST | `/v1/agent/actions/:id/cancel` | Chủ của form | Huỷ form đang chờ |
| GET | `/v1/agent/conversations` | Mọi user | Hội thoại của chính mình (phân trang, `ARCHIVED` bị ẩn) |
| GET | `/v1/agent/conversations/:id/messages` | Chủ hội thoại | Toàn bộ message, **không phân trang** |
| GET | `/v1/agent/conversations/:id/pending-actions` | Chủ hội thoại | Form còn hiệu lực — dựng lại sau khi reload |
| PATCH | `/v1/agent/conversations/:id` | Chủ hội thoại | Đổi tên |
| DELETE | `/v1/agent/conversations/:id` | Chủ hội thoại | Lưu trữ (soft delete → `ARCHIVED`) |
| POST | `/v1/agent/messages/:id/feedback` | Chủ hội thoại | Chấm điểm một câu trả lời (gọi lại = sửa điểm cũ) |
| GET | `/v1/agent/analytics/overview` | `ADMIN`, `HR`, `DIRECTOR` | Token/chi phí/chủ đề toàn hệ thống |
| GET | `/v1/agent/analytics/feedback` | `ADMIN`, `HR`, `DIRECTOR` | Bảng đánh giá: điểm theo chủ đề, theo tier, góp ý chữ |
| GET | `/v1/agent/analytics/me` | Mọi user | Token/chi phí của chính mình |

Trợ lý chỉ đọc được dữ liệu mà **chính người gọi** có quyền xem: mọi truy vấn bị giới hạn bởi
`actor` lấy từ JWT, **không bao giờ** từ tham số client gửi lên.

> ⚠️ Luồng `text/event-stream` được ghi thẳng qua `@Res()` nên **bỏ qua `ResponseInterceptor`**.
> Đừng đi tìm `{ success, data }` trong payload của SSE event.

---

## POST /v1/agent/chat/stream — đường dùng chính

### Request

```jsonc
{
  "message": "Tôi còn mấy ngày phép",   // bắt buộc, 1–2000 ký tự
  "conversationId": 12                  // tuỳ chọn; bỏ trống = mở hội thoại mới
}
```

Response headers server đặt sẵn:

```http
Content-Type: text/event-stream; charset=utf-8
Cache-Control: no-cache, no-transform
Connection: keep-alive
X-Accel-Buffering: no
```

### Sáu loại event

Khung SSE chuẩn: `event: <tên>\ndata: <json>\n\n`.

**Quy tắc quan trọng về shape:** mọi event **trừ `done`** đều mang thêm `type` (trùng tên event)
và `conversationId`. Riêng `done` mang **đúng** `ChatResponse` — **không có** `type`. Vì vậy parser
phải switch theo **tên event** ở dòng `event:`, **không** theo field `type`.

#### `status` — tiến độ, để vẽ trạng thái "đang…"

```jsonc
{ "type": "status", "stage": "routing", "conversationId": 12 }
{ "type": "status", "stage": "playbook", "playbookId": "leave-balance", "tier": "RULE", "conversationId": 12 }
{ "type": "status", "stage": "tool", "tool": "leave_getMyBalance", "conversationId": 12 }
```

| Field | Ghi chú |
|---|---|
| `stage` | `routing` \| `playbook` \| `tool` |
| `playbookId` | `null` = router không khớp chủ đề nào → câu trả lời sẽ là fallback |
| `tier` | `RULE` \| `EMBEDDING` \| `LLM` \| `FALLBACK` — tier nào đã quyết định |
| `tool` | Tên tool đang chạy, dùng để hiện "Đang tra quỹ phép…" |

`stage: "tool"` có thể xuất hiện **nhiều lần** trong một lượt.

#### `delta` — từng mảnh câu trả lời

```jsonc
{ "type": "delta", "text": "Bạn còn ", "conversationId": 12 }
```

Nối `text` theo thứ tự nhận được. **Không** tự thêm khoảng trắng hay newline.

#### `form` — cần người dùng xác nhận

```jsonc
{ "type": "form", "pendingActionId": 17, "form": { /* AgentForm */ }, "conversationId": 12 }
```

#### `chart` — biểu đồ do SERVER dựng

```jsonc
{
  "type": "chart",
  "tool": "report_getAttendance",
  "chart": {
    "type": "bar",
    "title": "Đi muộn và vắng theo nhân viên",
    "labels": ["Lương Chánh Sơn", "Ngô Gia Tự", "Đỗ Hồng Hạnh"],
    "series": [
      { "name": "Đi muộn", "data": [0, 0, 2] },
      { "name": "Vắng",    "data": [21, 21, 2] }
    ],
    "unit": "ngày",
    "source": "4 người có phát sinh"
  },
  "conversationId": 12
}
```

**Số liệu KHÔNG do LLM sinh ra.** Tool đọc tự dựng `chart` từ đúng dữ liệu nó vừa truy vấn,
rồi đi ra bằng event riêng — model không đọc, không sửa, không làm tròn, và cũng không tốn
token cho nó. Đây là cùng một nguyên tắc với form xác nhận: *LLM chỉ quyết CÁI GÌ, server
quyết BAO NHIÊU.*

| Field | Ghi chú |
|---|---|
| `tool` | Tool nào sinh ra biểu đồ này — dùng để gắn nhãn hoặc debug |
| `chart.type` | `bar` \| `line` \| `donut` |
| `chart.labels` | Nhãn trục hoành (hoặc nhãn từng lát với `donut`) |
| `chart.series` | Mỗi phần tử là một chuỗi; `data` khớp 1-1 **theo chỉ số** với `labels` |
| `chart.unit` | Đơn vị hiện sau con số trong tooltip: `ngày`, `giờ`, `%` |
| `chart.source` | Một dòng nói số liệu lấy từ đâu, ví dụ *"12 người nhiều nhất trong 30 người có phát sinh"* |

Một lượt có thể phát **nhiều** `chart` (model gọi nhiều tool). Không có `chart` là bình thường:
tool trả `null` khi không có gì đáng vẽ — mảng rỗng, toàn số 0, hoặc các phần không cộng đúng tổng.

**Quy tắc render — đừng bỏ qua:**

- Vẽ **đúng** những gì server gửi. Không cộng, không làm tròn, không suy thêm số nào. FE tự
  tính là con số trên hình khác con số trong câu trả lời, mà người xem không biết bên nào đúng.
- `labels` dài (tên người Việt 3–4 chữ) thì rút gọn **chỉ ở phần hiển thị trục**, giữ nguyên
  `labels` gốc cho tooltip. Web đang lấy hai chữ cuối: `Lê Thị Hằng Phương` → `Hằng Phương`.
- Khung biểu đồ phải `width: 100%` và `min-width: 0`. Để nó co theo nội dung thì canvas giữ
  kích thước lần vẽ trước → vòng lặp tự nuôi, tràn mép phải trên điện thoại.

#### `table` — bảng chi tiết do SERVER dựng

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
      { "date": "03/09/2026 (T5)", "status": "Đi muộn", "checkIn": "08:17", "checkOut": "17:35", "issue": "Muộn 17 phút" },
      { "date": "11/09/2026 (T6)", "status": "Có mặt",  "checkIn": "08:05", "checkOut": "—",     "issue": "Thiếu giờ ra" }
    ],
    "source": "7 ngày có phát sinh"
  },
  "conversationId": 12
}
```

**Cùng một bất biến với `chart`: LLM KHÔNG viết ô nào.** Tool tự dựng bảng từ dữ liệu nó
vừa truy vấn, đi kênh riêng, không tốn token. Model được dặn rõ là KHÔNG tự gõ bảng
markdown — chép tay là sai, mà bảng sai thì người đọc vẫn tin vì nó trông rất thật.

| Field | Ghi chú |
|---|---|
| `tool` | Tool nào sinh ra bảng này |
| `table.columns[].key` | Khớp với khoá trong mỗi phần tử `rows` |
| `table.columns[].align` | `text` (mặc định) hoặc `number` — canh phải khi render |
| `table.rows` | Mảng object; **mọi giá trị là chuỗi ĐÃ FORMAT sẵn** (`'08:17'`, `'17 phút'`, `'—'`) |
| `table.source` | Một dòng nói số liệu lấy từ đâu |

**Quy tắc render:**

- Ô trống được server gửi là `'—'`, không phải chuỗi rỗng hay `null`. Đừng tự thay bằng
  chữ khác — cùng một ý mà hai màn hình hiện hai kiểu là người dùng tưởng dữ liệu khác nhau.
- Không tự sắp xếp lại, không tự cộng dòng tổng. Thứ tự dòng là thứ tự server đã chốt.
- Không có `table` là bình thường: tool trả 0 dòng thì KHÔNG phát event, và model sẽ nói
  thẳng bằng lời là không có ngày nào.
- Bảng có thể dài (~30 dòng/tháng) — cuộn ngang trên mobile, đừng cắt bớt dòng.

Một lượt có thể phát **nhiều** `table`, và `table` đi song song với `chart` (một tool có
thể có cả hai).

**Bảng cũng được LƯU cùng tin nhắn**, như `chart`. Mở lại hội thoại cũ qua
`GET /v1/agent/conversations/:id/messages` thì mỗi tin nhắn có thể kèm:

```jsonc
{ "id": 7, "role": "assistant", "text": "…", "charts": [ /* … */ ], "tables": [ /* … */ ] }
```

Hai khoá này **vắng mặt** khi lượt đó không có gì đính kèm — không phải mảng rỗng. Client
kiểm `message.tables?.length` chứ đừng kiểm `'tables' in message`.

#### `done` — kết thúc, kèm số liệu

```jsonc
{
  "conversationId": 12,
  "messageId": 89,                    // id tin nhắn trả lời — cần để chấm điểm
  "answer": "Bạn còn 8 ngày phép năm.",
  "playbookId": "leave-balance",
  "routerTier": "RULE",
  "toolsCalled": ["leave_getMyBalance"],
  "usage": { "promptTokens": 1820, "completionTokens": 143, "cachedPromptTokens": 0, "costUsd": 0.00021 },
  "feedbackPrompt": null              // thường là null — xem mục "Đánh giá câu trả lời"
}
```

`answer` là **toàn văn** — dùng để tự kiểm tra chuỗi `delta` đã ghép đúng, hoặc bỏ qua nếu đã
render theo delta. `usage.costUsd` có thể `null` khi provider không báo giá.

`messageId` là `null` trong trường hợp hiếm: server không lưu được tin nhắn (lỗi ghi DB). Lúc đó
không có gì để chấm điểm — ẩn phần đánh giá đi, đừng gửi `feedback` với id đoán.

> ⚠️ `done` giờ được phát **sau khi** server đã lưu tin nhắn trả lời (trước đây lưu sau).
> Đổi lại event cuối chậm thêm một lần ghi DB (vài ms) để `messageId` đi cùng nó — không thì
> client phải gọi thêm một vòng API chỉ để biết id. Thứ tự event **không đổi**.

#### `error` — luồng chết giữa đường

```jsonc
{ "message": "Đã dùng hết hạn mức token trong ngày" }
```

Chỉ có `message` — **không** `code`, **không** `type`.

### Thứ tự event được bảo đảm

```
status(routing)
  → status(playbook)
  → [status(tool) → [chart]?]*   ← 0..n lần; chart đi NGAY SAU tool sinh ra nó
  → [form]?                      ← 0..1 lần, chỉ khi model gọi tool ghi
  → delta*                       ← 0..n lần
  → done                         ← đúng 1 lần, luôn là event cuối
```

- `form` **luôn** đi trước `delta` + `done` của cùng lượt. Nhận `form` rồi thì vẫn còn `done` phía
  sau — **đừng đóng luồng sớm**.
- `chart` cũng đi **trước** `delta`. Gom lại rồi render dưới phần chữ; đừng chen vào giữa luồng
  chữ đang stream.
- Khi có `form`, server tự sinh một `delta` mặc định nếu model không nói gì:
  *"Mình đã chuẩn bị sẵn thông tin bên dưới. Bạn kiểm tra rồi xác nhận giúp nhé."*
- `error` **thay thế** `done`. Sau `error` luồng đóng ngay.
- **Hội thoại mới:** `conversationId` chỉ biết được từ event đầu tiên. Lưu lại ngay (mọi event
  non-`done` đều có) để lượt hỏi kế tiếp gửi kèm.

### Lỗi trên endpoint stream — điểm dễ sai nhất

Server `flushHeaders()` **trước** khi generator chạy. Từ mốc đó không đổi được HTTP status nữa.

| Xảy ra ở | Ví dụ | Client nhận được |
|---|---|---|
| **Trước** handler (guard, ValidationPipe) | Token sai/hết hạn · `message` rỗng hoặc > 2000 ký tự | **HTTP JSON thật**: `401` / `400` + envelope `{ success: false, ... }` |
| **Trong** generator | Hết hạn mức token · trợ lý bị tắt cho tài khoản · `conversationId` không tồn tại · provider LLM lỗi | **HTTP 200** + `event: error` với `{ "message": "..." }` |

> Swagger của endpoint này khai `403` cho trường hợp hết hạn mức. Đó là **mô tả ý nghĩa**, không
> phải status thực tế trên đường stream. Muốn status thật, gọi `POST /v1/agent/chat`.

Ba message lỗi nghiệp vụ hiện có (nguyên văn):

- `Trợ lý AI đang bị tắt cho tài khoản này`
- `Đã dùng hết hạn mức token trong ngày`
- `Đã dùng hết hạn mức chi phí trong ngày`

### Hạ tầng client phải tự lo

| Vấn đề | Thực tế | Việc của client |
|---|---|---|
| **Không có heartbeat** | Server không gửi comment `:` giữ nhịp. Tier `LLM` + tool chậm có thể im lặng vài giây | Timeout theo **khoảng lặng giữa hai event** (khuyến nghị 60s, khớp `AGENT_LLM_TIMEOUT_MS`), không phải timeout tổng |
| **Client ngắt giữa chừng** | Server phát hiện qua `res.writableEnded`, **vẫn lưu** phần đã sinh với `stopReason: ABANDONED` | `AbortController` (web) / `client.close()` (Dart). Mở lại hội thoại sẽ thấy câu trả lời dở — hiển thị bình thường, không coi là lỗi |
| **Proxy đệm luồng** | Server đã gửi `X-Accel-Buffering: no` | Nếu vẫn thấy cả luồng về một cục → kiểm tra proxy/CDN phía client (ngrok, Cloudflare) |
| **Ngrok (dev)** | — | Giữ `NGROK_HEADERS` như các request khác |
| **Không resume được** | Không có `id:` / `Last-Event-ID` | Lỗi giữa luồng → hỏi lại từ đầu. **Đừng auto-retry**: mỗi lần hỏi là một lần tốn token |

---

## POST /v1/agent/chat — bản không stream

Cùng request body. Trả **201** + envelope:

```jsonc
{
  "success": true,
  "data": {
    "conversationId": 12,
    "answer": "Bạn còn 8 ngày phép năm.",
    "playbookId": "leave-balance",
    "routerTier": "RULE",
    "toolsCalled": ["leave_getMyBalance"],
    "usage": { "promptTokens": 1820, "completionTokens": 143, "cachedPromptTokens": 0, "costUsd": 0.00021 }
  }
}
```

| Status | Khi nào |
|---|---|
| `201` | Thành công |
| `400` | `message` rỗng / quá 2000 ký tự |
| `401` | Token sai hoặc hết hạn |
| `403` | Hết hạn mức token/chi phí, hoặc trợ lý bị tắt cho tài khoản |
| `404` | `conversationId` không tồn tại (hoặc không thuộc người gọi) |

> ⚠️ **Hạn chế thật:** endpoint này **không trả về form**. Nếu model gọi tool ghi, bản ghi
> `AgentPendingAction` vẫn được tạo nhưng response chỉ có `answer` bằng lời — không có
> `pendingActionId` lẫn `form`. Muốn lấy phải gọi thêm `GET /agent/conversations/:id/pending-actions`.
>
> → **UI chat phải dùng `/chat/stream`.** Dùng `/chat` chỉ cho read-only, health check, integration test.

---

## Form-in-chat — luồng human-in-the-loop

### Nguyên tắc bất biến (đừng tìm cách đi đường tắt)

1. **LLM không bao giờ ghi dữ liệu.** Model gọi tool ghi → engine chỉ *dựng form* rồi dừng lượt.
2. **Chỉ `POST /agent/actions/:id/confirm` thực thi ghi.** Không có đường nào khác.
3. **Dữ liệu thực thi là payload client gửi lên** — giá trị người dùng đã soát trong form,
   **không** phải `draftPayload` mà model đoán.
4. **Không có mức "tự chạy không hỏi".** Mọi tool ghi đều có `confirmLevel`.

### Shape `AgentForm`

```jsonc
{
  "title": "Xác nhận đơn nghỉ phép",
  "confirmLevel": "L1_CREATE",          // "L1_CREATE" | "L2_DECIDE"
  "fields": [
    { "name": "_employee", "label": "Người xin nghỉ", "type": "readonly", "required": false,
      "value": "Nguyễn Văn A", "source": "system" },
    { "name": "leaveTypeId", "label": "Loại phép", "type": "select", "required": true,
      "value": 1, "source": "system",
      "options": [ { "value": 1, "label": "Phép năm" }, { "value": 4, "label": "Nghỉ không lương" } ],
      "helpText": "Đang để mặc định — danh sách chỉ gồm loại phép bạn được xin." },
    { "name": "startDate", "label": "Từ ngày",  "type": "date",     "required": true, "value": "2026-09-25", "source": "llm" },
    { "name": "endDate",   "label": "Đến ngày", "type": "date",     "required": true, "value": "2026-09-25", "source": "llm" },
    { "name": "reason",    "label": "Lý do",    "type": "textarea", "required": true, "value": "Việc gia đình", "source": "llm",
      "helpText": "Nghỉ từ 3 ngày trở lên nên ghi lý do chi tiết." }
  ],
  "context": [
    { "label": "Số ngày nghỉ",     "value": "2 ngày" },
    { "label": "Quỹ phép còn lại", "value": "8 ngày" }
  ],
  "warnings": ["Số ngày xin nghỉ (3) vượt quá quỹ phép còn lại (1 ngày)."],
  "submitLabel": "Gửi đơn",
  "successMessage": "Đã gửi đơn nghỉ phép. Đơn đang chờ quản lý duyệt."
}
```

### ⛔ `source` và `type` là HAI chuyện khác nhau — render sai là sai nghiệp vụ

| Field | Nghĩa | Client phải làm gì |
|---|---|---|
| `source` | **Nguồn** của giá trị | `"llm"` = model đoán từ câu nói → **BẮT BUỘC đánh dấu trực quan** (badge "AI đoán", viền màu…) để người dùng biết chỗ nào cần soát. `"system"` = server điền từ DB/mặc định |
| `type` | **Quyền sửa** + kiểu widget | Chỉ `"readonly"` là khoá. Mọi type khác đều cho sửa |

Một field `source: "system"` **vẫn sửa được**. Ví dụ "Loại phép" mặc định là *Phép năm* khi model
không nói gì — người dùng đổi thoải mái. **Đừng disable field chỉ vì `source: "system"`.**

`type` khả dụng: `text` · `textarea` · `number` · `date` · `select` · `readonly`.
`options` chỉ xuất hiện khi `type: "select"`.

### Quy tắc render khác

- **`context` là dữ liệu do SERVER đọc từ DB**, không phải lời văn của model → render như panel số
  liệu tin cậy. Với `L2_DECIDE` đây là nội dung thật của đơn đang được duyệt.
- **`warnings` phải hiện nổi bật** và **không được chặn submit**. Server cố tình cho phép gửi kèm
  cảnh báo (ví dụ vượt quỹ phép) — quyết định là của người dùng, không phải của client.
- `successMessage` là câu hiện sau khi commit xong. Server **cũng tự lưu** nó thành message `SYSTEM`
  trong hội thoại → client **không cần** tự chèn; nó sẽ có ở lần load messages kế tiếp.
- `_employee` (prefix `_`) là field trang trí readonly. **Không cần** gửi lại khi confirm.

### Form sống 15 phút — và reload trang là mất

Form đẩy qua SSE nên **refresh trang là mất khỏi UI**, trong khi bản ghi phía server vẫn `PENDING`
tới **15 phút** (`FORM_TTL_MS`).

→ Khi mở lại một hội thoại, **luôn** gọi `GET /v1/agent/conversations/:id/pending-actions`:

```jsonc
{
  "success": true,
  "data": [
    {
      "id": 17,                        // ← chính là pendingActionId
      "toolName": "leave_createRequest",
      "form": { /* AgentForm như trên */ },
      "expiresAt": "2026-09-24T09:31:00.000Z"
    }
  ]
}
```

> 🔁 **Lưu ý tên field:** event SSE gọi là `pendingActionId`, endpoint này gọi là `id`. Cùng một giá
> trị — chuẩn hoá về một tên trong model của client.

Dùng `expiresAt` để đếm ngược / tự ẩn form. Mảng rỗng = không có gì đang chờ.

### POST /v1/agent/actions/:id/confirm

```jsonc
{
  "payload": {
    "leaveTypeId": 1,
    "startDate": "2026-09-25",
    "endDate": "2026-09-25",
    "reason": "Việc gia đình"
  }
}
```

**Quy tắc dựng `payload`:** lấy `name` → giá trị hiện tại của mọi field người dùng thấy, bỏ field
`readonly`/trang trí. Gửi **giá trị sau khi người dùng đã sửa**, không phải `value` gốc.

Với `leave_createRequest` (tool ghi duy nhất hiện có), server đọc đúng các key sau:

| Key | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `leaveTypeId` | `number ≥ 1` | ✅ | Thiếu → 400 `Thiếu loại phép` |
| `startDate` | `YYYY-MM-DD` | ✅ | Thiếu → 400 `Thiếu ngày bắt đầu` |
| `endDate` | `YYYY-MM-DD` | ➖ | Bỏ trống → server lấy `= startDate` |
| `reason` | `string` không rỗng | ✅ | Thiếu → 400 `Thiếu lý do nghỉ` |
| `halfDayPeriod` | `"MORNING"` \| `"AFTERNOON"` | ➖ | Chỉ gửi khi form có field này |

Key ngoài danh sách bị bỏ qua. Server tự đóng dấu nhận diện AI vào `reason` trước khi ghi
(`withAiProvenance`) — client **không** cần thêm gì.

Response **201**:

```jsonc
{
  "success": true,
  "data": {
    "pendingActionId": 17,
    "toolName": "leave_createRequest",
    "result": { /* nguyên văn object Service nghiệp vụ trả về — ở đây là đơn nghỉ vừa tạo */ },
    "message": "Đã gửi đơn nghỉ phép. Đơn đang chờ quản lý duyệt."
  }
}
```

`result` là **kiểu mở** (`unknown`). **Đừng bind chặt vào shape của nó** — hiện `message` cho người
dùng, cần chi tiết đơn thì gọi [leave-requests.md](./leave-requests.md) như bình thường.

### Các trạng thái lỗi của confirm

| HTTP | `error.code` | `error.message` (nguyên văn) | Ý nghĩa & việc của client |
|---|---|---|---|
| `404` | `NOT_FOUND` | `Không tìm thấy thao tác cần xác nhận` | ID sai, hoặc form của người khác → ẩn form |
| `409` | `CONFLICT` | `Thao tác này đã được thực hiện rồi` | Đã commit. **Không** hiện lỗi đỏ — hiện "đã gửi rồi" và ẩn form |
| `409` | `CONFLICT` | `Thao tác này không còn hiệu lực` | Đã cancel/expire/superseded → ẩn form |
| `409` | `CONFLICT` | `Form đã hết hạn. Bạn hỏi lại giúp mình nhé.` | Quá 15 phút → ẩn form, mời hỏi lại |
| `409` | `CONFLICT` | `Dữ liệu đã thay đổi kể từ lúc form được tạo. Bạn hỏi lại để mình dựng form mới nhé.` | Dữ liệu gốc đổi giữa lúc dựng form và lúc bấm (đơn bị người khác duyệt, quỹ phép đổi) → ẩn form, mời hỏi lại |
| `409` | `CONFLICT` | `Thao tác này đang được xử lý` | Hai request đồng thời, chỉ một cái thắng → **không retry** |
| `400` | `BAD_REQUEST` | `Thao tác không còn được hỗ trợ` | Tool bị bỏ khỏi registry sau khi form được tạo |
| `400` | `BAD_REQUEST` | *(message từ Service nghiệp vụ)* | Payload thiếu field, hoặc `LeaveService` từ chối (trùng đơn, hết quỹ…) → **hiện nguyên văn message**, giữ form để người dùng sửa |

**Idempotency:** server chiếm quyền thực thi (`settlePendingAction → CONFIRMED`) **trước khi** gọi
commit → bấm hai lần chỉ chạy một lần. Client vẫn nên disable nút sau cú bấm đầu.

**Khi commit fail (400):** bản ghi **giữ nguyên `CONFIRMED`** kèm lý do lỗi — server không mở lại
cho lần bấm thứ hai vì không biết Service đã ghi tới đâu. Nghĩa là **cùng một `pendingActionId`
không confirm lại được**. Phải mời người dùng hỏi lại để dựng form mới; **đừng cho bấm lại nút cũ**.

### POST /v1/agent/actions/:id/cancel

```jsonc
{ "success": true, "data": { "cancelled": true } }
```

`cancelled: false` = bản ghi đã ở trạng thái khác (đã confirm/expire) → coi như form không còn hiệu
lực, ẩn đi. `404` nếu không tìm thấy.

---

## GET /v1/agent/conversations — Danh sách hội thoại

`page ≥ 1` (mặc định 1) · `limit` 1–**50** (mặc định 20). Mới nhất trước. `ARCHIVED` **không** hiện.

```jsonc
{
  "success": true,
  "data": [
    {
      "id": 12,
      "title": "Quỹ phép tháng 9",                  // null nếu chưa đặt được tên
      "lastMessageAt": "2026-09-24T09:16:00.000Z",  // null nếu chưa có message
      "createdAt": "2026-09-24T09:10:00.000Z",
      "messageCount": 4
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 37, "totalPages": 2 }
}
```

> 💡 **Tiêu đề tự đổi sau lượt đầu.** Mở hội thoại mới → server đặt tiêu đề tạm = câu hỏi cắt 120 ký
> tự, rồi **sau khi trả lời xong** mới nhờ model đặt tên gọn hơn (fire-and-forget). Muốn thấy tên đẹp
> thì refresh danh sách sau `done`, hoặc chấp nhận tên tạm tới lần load kế tiếp.

---

## GET /v1/agent/conversations/:id/messages

Trả **toàn bộ** message, cũ → mới, **không phân trang**.

```jsonc
{
  "success": true,
  "data": [
    { "id": 88, "role": "user",      "text": "Tôi còn mấy ngày phép?", "createdAt": "2026-09-24T09:10:00.000Z" },
    { "id": 89, "role": "assistant", "text": "Bạn còn 8 ngày phép năm.", "createdAt": "2026-09-24T09:10:04.000Z" },
    { "id": 92, "role": "system",    "text": "Đã gửi đơn nghỉ phép. Đơn đang chờ quản lý duyệt.", "createdAt": "2026-09-24T09:15:00.000Z" },
    {
      "id": 95, "role": "assistant", "text": "Báo cáo chuyên cần tháng 8/2026…",
      "charts": [ { "type": "bar", "title": "Đi muộn và vắng theo nhân viên", "labels": ["…"], "series": [] } ],
      "feedback": {
        "messageId": 95, "rating": "GREAT", "ratingLabel": "Rất hay", "comment": null,
        "createdAt": "2026-09-24T09:21:00.000Z", "updatedAt": "2026-09-24T09:21:00.000Z"
      },
      "createdAt": "2026-09-24T09:20:00.000Z"
    }
  ]
}
```

**`feedback` chỉ xuất hiện khi CHÍNH NGƯỜI GỌI đã chấm câu trả lời đó** — không bao giờ là điểm của
người khác, và tin nhắn chưa chấm thì không có trường này. Xem mục "Đánh giá câu trả lời".

**`charts` chỉ xuất hiện khi lượt đó CÓ biểu đồ** — tin nhắn cũ và mọi lượt không vẽ đều
không có trường này, nên client cũ không vỡ. Biểu đồ được lưu ngay trong nội dung tin nhắn,
vì vậy mở lại hội thoại vẫn còn hình; nếu chỉ dựa vào SSE thì reload trang là mất sạch.
Shape của mỗi phần tử giống hệt `chart` trong event `chart`.

| `role` | Render |
|---|---|
| `user` | Bong bóng người dùng |
| `assistant` | Bong bóng trợ lý |
| `system` | Dòng thông báo giữa luồng — đây là kết quả của một lần confirm thành công |

`role` đã hạ về **chữ thường** (DB lưu `USER`/`ASSISTANT`/`SYSTEM`). `text` đã được rút từ cấu trúc
khối nội bộ — client **không** cần biết cấu trúc đó.

Message có thể là câu trả lời dở nếu người dùng đã ngắt luồng giữa chừng. `404` nếu hội thoại không
tồn tại hoặc không thuộc người gọi.

---

## PATCH /v1/agent/conversations/:id — Đổi tên

```jsonc
// request
{ "title": "Quỹ phép tháng 9" }          // 1–200 ký tự
// response
{ "success": true, "data": { "renamed": true } }
```

---

## DELETE /v1/agent/conversations/:id — Lưu trữ

Soft delete → `ARCHIVED`. **Không xoá dữ liệu.**

```jsonc
{ "success": true, "data": { "archived": true } }
```

`404` nếu không tồn tại hoặc **đã** lưu trữ → client nên xoá khỏi danh sách ngay (optimistic) và coi
`404` là "vốn đã archived rồi".

---

## Đánh giá câu trả lời — "thi thoảng hỏi ý kiến"

Người dùng chấm điểm **từng câu trả lời**, không chấm cả hội thoại: một hội thoại có lượt tốt lượt
tệ, chấm cả cụm thì không ai biết phải sửa chỗ nào.

### Ai quyết định khi nào hiện — SERVER, không phải client

Event `done` (và response của `POST /chat`) có trường `feedbackPrompt`:

```jsonc
"feedbackPrompt": {
  "messageId": 89,
  "question": "Câu trả lời này có giúp được bạn không?",
  "options": [                                  // thứ tự = thứ tự hiển thị, tệ → tốt
    { "value": "BAD",     "label": "Tệ" },
    { "value": "AVERAGE", "label": "Trung bình" },
    { "value": "USEFUL",  "label": "Hữu dụng với tôi" },
    { "value": "GREAT",   "label": "Rất hay" }
  ],
  "commentPlaceholder": "Muốn nói thêm gì không? (không bắt buộc)"
}
```

- **`null` (phần lớn các lượt) → không hiện gì.** Đây là trạng thái bình thường.
- Có giá trị → hiện thanh đánh giá dưới câu trả lời đó.

**Đừng tự đặt nhịp hỏi ở client, và đừng hỏi mọi lượt.** Nhịp do server tính để web và mobile hỏi
giống nhau — không thì số liệu hai nền tảng không so được với nhau. Luật hiện tại (đổi được bằng
biến môi trường, client không cần biết): hỏi ở câu trả lời **thứ 2, 7, 12…** của mỗi hội thoại, cộng
thêm **mọi lượt agent không giúp được gì** (fallback / lỗi tool / lỗi model); chấm một lần rồi thì
**im 12 giờ**, kể cả ở hội thoại khác.

**Đừng hardcode 4 nhãn tiếng Việt ở client.** Chúng nằm ở một chỗ duy nhất trên server
(`src/common/constants/vi-labels.ts`) và đi kèm trong `options` — hardcode thì sửa chữ ở server xong
app vẫn hiện chữ cũ. Mã (`BAD`/`AVERAGE`/`USEFUL`/`GREAT`) mới là thứ ổn định để so sánh.

### Hai hệ quả của luật nhịp mà client hay tưởng là bug

**Bỏ qua lời mời KHÔNG kích hoạt quãng nghỉ 12 giờ.** Quãng nghỉ đếm từ lần người dùng thật sự
**chấm**, không phải từ lần server **hỏi**. Nên người bỏ qua thanh đánh giá ở câu trả lời thứ 2 vẫn
gặp lại nó ở câu thứ 7 trong cùng hội thoại. Đây là chủ ý: người bỏ qua thường là người đang dở
việc, không phải người từ chối trả lời.

**Đừng tự chặn lần mời thứ hai ở client.** Làm vậy là lặng lẽ sửa luật nhịp của server, và số liệu
web với mobile hết so được với nhau — đúng thứ mà việc đặt quyết định ở server sinh ra để tránh.

Phân biệt cho rõ: **cùng một câu trả lời** thì không bao giờ bị mời hai lần — server chặn sẵn bằng
`alreadyRated`. Thứ lặp lại là lời mời ở **một câu trả lời khác**.

**`feedbackPrompt` luôn `null` có thể là cấu hình, không phải hỏng.** Server tắt được hẳn việc mời
chấm bằng `AGENT_FEEDBACK_ENABLED=false`. Khi đó **không lượt nào** có `feedbackPrompt`, nhưng
`POST /v1/agent/messages/:id/feedback` vẫn sống và vẫn ghi bình thường. Hai hệ quả cho client:

- Đừng coi "mãi không thấy thanh đánh giá" là lỗi phía mình rồi dựng nhịp hỏi riêng để bù.
- Nếu app có đường cho người dùng chủ động chấm (ví dụ nút `⋯` trên mỗi câu trả lời) thì nó vẫn
  chạy được khi tính năng mời đã tắt. **Mời chấm** và **nhận điểm** là hai thứ tách rời.

### POST /v1/agent/messages/:id/feedback

`:id` là `messageId` — lấy từ `done.messageId`, `feedbackPrompt.messageId`, hoặc `id` trong danh sách
tin nhắn.

```jsonc
// request
{ "rating": "USEFUL", "comment": "Đúng số nhưng thiếu ngày hết hạn phép" }   // comment không bắt buộc, ≤ 1000 ký tự

// response 201
{
  "success": true,
  "data": {
    "messageId": 89,
    "rating": "USEFUL",
    "ratingLabel": "Hữu dụng với tôi",
    "comment": "Đúng số nhưng thiếu ngày hết hạn phép",
    "createdAt": "2026-09-29T09:16:00.000Z",
    "updatedAt": "2026-09-29T09:16:00.000Z"
  }
}
```

| Tình huống | Kết quả |
|---|---|
| Gọi lại cho cùng `messageId` | **Sửa** điểm cũ (upsert theo `messageId` + người gọi) — không sinh bản ghi thứ hai, không cần DELETE trước |
| Gửi `rating` mới, **không** gửi `comment` | Góp ý cũ bị **xoá** (về `null`). Muốn giữ thì gửi lại `comment` cũ kèm theo |
| `comment` là chuỗi rỗng / chỉ có khoảng trắng | Lưu thành `null` — đây là cách xoá góp ý |
| `:id` là tin nhắn của người dùng, không phải câu trả lời | **404** |
| `:id` thuộc hội thoại của người khác | **404** (cố ý không phải 403 — 403 là hé ra id đó có thật) |
| `rating` không thuộc 4 mức | **400** |

### Hiện lại điểm đã chấm khi mở hội thoại cũ

`GET /v1/agent/conversations/:id/messages` gắn thêm `feedback` vào những câu trả lời mà **chính người
gọi** đã chấm (xem mục endpoint đó). Không nạp lại thì người dùng quay về tưởng mình chưa đánh giá,
hoặc tưởng góp ý đã bị bỏ đi.

Lưu ý: bản ghi cũ **không** kèm `feedbackPrompt` (server chỉ gửi prompt lúc mời). Khuyến nghị render:
đã chấm + không có prompt → hiện một chip tĩnh đúng mức đã chọn, không mời chấm lại.

### Ba việc KHÔNG nên làm

- **Hiện thanh đánh giá ở mọi câu trả lời** vì "cho chắc" — người dùng sẽ bỏ qua toàn bộ, và số liệu
  còn tệ hơn là không có.
- **Chặn luồng chat để chờ chấm điểm.** Đây là việc làm thêm cho hệ thống, không phải một bước của
  nghiệp vụ.
- **Toast "đã gửi đánh giá" sau mỗi cú bấm.** Đổi ngay chính thanh đó sang trạng thái đã chấm là đủ;
  toast làm to chuyện một cú bấm nhỏ.

---

## Analytics — dashboard token & chủ đề

| Endpoint | Quyền | Phạm vi dữ liệu |
|---|---|---|
| `GET /v1/agent/analytics/overview` | `ADMIN` `HR` `DIRECTOR` | Toàn hệ thống; `employeeId` trong query **có** tác dụng lọc |
| `GET /v1/agent/analytics/me` | Mọi role | Chỉ người gọi; `employeeId` trong query **bị bỏ qua hoàn toàn** |

Query params (dùng chung):

| Param | Kiểu | Mặc định | Ghi chú |
|---|---|---|---|
| `from` | ISO 8601 (`2026-09-01`) | 30 ngày gần nhất | |
| `to` | ISO 8601 | hôm nay | Khoảng tối đa **366 ngày**/truy vấn |
| `employeeId` | `number ≥ 1` | — | Chỉ có tác dụng ở `/overview` |
| `topLimit` | `number` 1–50 | 10 | Số dòng của `topics` / `topUsers` |

Response (cùng shape cho cả hai endpoint):

```jsonc
{
  "success": true,
  "data": {
    "summary": {
      "from": "2026-08-25", "to": "2026-09-24",
      "conversations": 58, "messages": 214, "requests": 196, "activeUsers": 23,
      "promptTokens": 384210, "completionTokens": 41230, "totalTokens": 425440,
      "cachedPromptTokens": 0,
      "cacheHitRate": 0,              // % token nạp từ cache của provider
      "costUsd": 0.094,
      "costPerRequestUsd": 0.00048    // để ước tính ngân sách
    },
    "daily":     [ { "bucket": "2026-09-23", "promptTokens": 12430, "completionTokens": 2180, "cachedPromptTokens": 0, "costUsd": 0.0031, "requests": 42 } ],
    "byModel":   [ { "bucket": "deepseek/deepseek-v4-flash", "promptTokens": 380000, "completionTokens": 40000, "cachedPromptTokens": 0, "costUsd": 0.09, "requests": 190 } ],
    "byPurpose": [ { "bucket": "CHAT", "promptTokens": 380000, "completionTokens": 40000, "cachedPromptTokens": 0, "costUsd": 0.09, "requests": 190 } ],
    "topics": [
      { "playbookId": "leave-balance", "runs": 128, "share": 31.2, "successRate": 96.1,
        "fallback": 2, "toolError": 0, "modelError": 1,
        "byTier": { "RULE": 80, "EMBEDDING": 30, "LLM": 16, "FALLBACK": 2 } }
    ],
    "topUsers": [ { "employeeId": 14, "fullName": "Lê Thị Thùy Linh", "requests": 87, "totalTokens": 152400, "costUsd": 0.042 } ],
    "feedback": {
      "total": 42,                    // số lượt người dùng đã chấm điểm
      "byRating": { "BAD": 3, "AVERAGE": 9, "USEFUL": 21, "GREAT": 9 },
      "satisfactionRate": 71.4,       // % USEFUL + GREAT
      "negativeRate": 7.1,            // % BAD
      "score": 2.86,                  // trung bình thang 1–4; 0 = CHƯA AI CHẤM, không phải "toàn tệ"
      "withComment": 11,
      "responseRate": 19.5            // % câu trả lời được chấm — thấp là bình thường
    }
  }
}
```

`summary` có thêm `answers` (riêng số câu trả lời của trợ lý, `messages` vẫn là tổng mọi vai) —
đây là nền để tính `responseRate`.

`UsagePoint` dùng chung cho `daily` / `byModel` / `byPurpose` — chỉ khác nghĩa của `bucket` (ngày ·
tên model · mục đích). `share` và `successRate` là **phần trăm** đã làm tròn 1 chữ số thập phân,
**không** phải tỉ lệ 0–1.

`403` nếu role không đủ cho `/overview`. `400` nếu khoảng thời gian không hợp lệ.

### GET /v1/agent/analytics/feedback — bảng đánh giá chi tiết

Cùng query params như trên; `topLimit` ở đây là **số góp ý chữ** trả về.

```jsonc
{
  "success": true,
  "data": {
    "from": "2026-08-30", "to": "2026-09-29",
    "summary": { /* giống khối `feedback` của overview */ },
    "byPlaybook": [
      { "bucket": "leave-balance", "total": 18,
        "byRating": { "BAD": 1, "AVERAGE": 3, "USEFUL": 10, "GREAT": 4 },
        "satisfactionRate": 77.8, "score": 3.06 }
    ],
    "byTier": [ { "bucket": "RULE", "total": 25, "byRating": { }, "satisfactionRate": 80, "score": 3.1 } ],
    "comments": [
      { "id": 7, "rating": "BAD", "ratingLabel": "Tệ",
        "comment": "Số ngày phép không khớp bảng của kế toán",
        "playbookId": "leave-balance", "routerTier": "RULE",
        "employeeId": 14, "fullName": "Lê Thị Thùy Linh",
        "createdAt": "2026-09-28T10:02:00.000Z" }
    ]
  }
}
```

`bucket` là `playbookId` (hoặc tier). Lượt không tra được playbook lúc chấm gom vào bucket
`KHÔNG_RÕ` — giữ lại để tổng các nhóm khớp tổng chung, đừng lọc bỏ.

> **Ranh giới quyền riêng tư — đọc kỹ trước khi dựng UI:** endpoint này **KHÔNG** trả nội dung câu
> hỏi / câu trả lời của lượt bị chấm, và sẽ không bao giờ trả. Hội thoại của một người chỉ chính họ
> đọc được (`/conversations/:id/messages` lọc theo chủ sở hữu) — mở đường cho HR đọc nội dung chat
> qua cửa báo cáo là phá đúng ranh giới đó. Thứ duy nhất đọc được là `comment` do người dùng **tự
> gõ và tự gửi**. Đừng dựng UI kiểu "xem lại đoạn chat bị chấm tệ" rồi chờ BE bổ sung field.

Nhóm có ít lượt chấm (dưới ~5) thì `satisfactionRate` gần như vô nghĩa — nên đánh dấu "ít mẫu"
trên UI thay vì tô đỏ một chủ đề chỉ vì đúng một người bấm "Tệ".

---

## Playbook & tool — để hiển thị cho đúng

`playbookId` (trong event `status`/`done`, và `topics` của analytics) là một trong:

| `playbookId` | Chủ đề | Quyền |
|---|---|---|
| `leave-balance` | Quỹ phép của tôi | mọi role |
| `leave-request` | Xin nghỉ phép (**có tool ghi**) | mọi role |
| `leave-team-overview` | Nghỉ phép của nhóm | `MANAGER` `HR` `ADMIN` |
| `attendance-my-summary` | Chấm công của tôi | mọi role |
| `attendance-explain` | Giải thích bản ghi chấm công | mọi role |
| `attendance-team-summary` | Chấm công của nhóm | `MANAGER` `HR` `ADMIN` |
| `overtime-request` | Xin tăng ca (**có tool ghi**) | mọi role |
| `makeup-request` | Xin bù công (**có tool ghi**) | mọi role |
| `violation-explain` | Phiếu giải trình chuyên cần (**có tool ghi**) | mọi role |
| `online-work-request` | Đăng ký làm việc online (**có tool ghi**) | mọi role |
| `business-trip-request` | Đăng ký đi công tác (**có tool ghi**) | mọi role |
| `approval-queue` | Hàng chờ duyệt đơn (**có tool ghi**, `L2_DECIDE`) | `MANAGER` `HR` `ADMIN` `DIRECTOR` `CHIEF` |
| `hr-directory` | Danh bạ, phòng ban | mọi role |
| `hr-org-overview` | Dashboard tổ chức | `MANAGER` `HR` `ADMIN` `DIRECTOR` |
| `company-info` | Nghỉ lễ, thông báo, hợp đồng, ca làm | mọi role |
| `capabilities` | "Trợ lý làm được gì?" — trả lời về chính năng lực hệ thống, không gọi tool | mọi role |
| `unsupported` | Việc có trên web nhưng trợ lý không làm trong chat (lương, BHXH, đổi mật khẩu, CCCD, **báo cáo/chi phí công tác**) | mọi role |
| `fallback` | Không khớp chủ đề nào | mọi role |

> ⚠️ `unsupported` **không còn** bao gồm việc ĐĂNG KÝ đi công tác — việc đó chuyển sang
> `business-trip-request` ngày 29/09/2026. Client nào đang hiện chữ "vào /business-trips/create"
> theo `playbookId=unsupported` thì bỏ đi, nếu không người dùng bị chỉ sai đường.

Tên tool trong `toolsCalled` và `status.tool` dùng **dấu gạch dưới**: `leave_getMyBalance`,
`attendance_getMyStats`, `report_getLeave`, `leave_createRequest`… ([`../ai-agent/tools.md`](../ai-agent/tools.md)
có bảng đầy đủ; lưu ý bảng đó viết tên theo dấu chấm ở một số dòng — **trên đường dây là gạch dưới**).
Muốn hiện "Đang tra quỹ phép…" thì map tên tool → nhãn tiếng Việt ở phía client, hoặc bỏ qua và chỉ
hiện "Đang tra dữ liệu…".

### Tool ghi — 7 cái, tất cả đều qua form xác nhận

| Tool | Mức | Việc |
|---|---|---|
| `leave_createRequest` | `L1_CREATE` | Đơn nghỉ phép (gồm cả đi muộn / về sớm tính theo phút) |
| `overtime_createRequest` | `L1_CREATE` | Đơn tăng ca |
| `makeup_createRequest` | `L1_CREATE` | Đơn bù công |
| `violation_createExplanation` | `L1_CREATE` | Phiếu giải trình chuyên cần |
| `onlineWork_createRequest` | `L1_CREATE` | Đơn làm việc online |
| `businessTrip_createRequest` | `L1_CREATE` | Đơn đi công tác — form dài hơn các đơn khác: bắt buộc có ít nhất một chặng di chuyển và người duyệt |
| `approval_decide` | `L2_DECIDE` | Duyệt / từ chối một đơn đang chờ chính người hỏi — phủ đủ **6 loại đơn**, gồm cả đơn công tác |

Render form **tổng quát theo `AgentForm`**, đừng hardcode riêng cho từng loại đơn.

### Tool có biểu đồ — 3 cái

| Tool | Loại biểu đồ | Nội dung |
|---|---|---|
| `attendance_getMyStats` | `donut` | Đúng giờ / đi muộn / chưa làm trong tháng |
| `report_getAttendance` | `bar` | Đi muộn và vắng theo từng nhân viên |
| `report_getOvertime` | `bar` | Giờ tăng ca đã duyệt theo từng nhân viên |

Danh sách này **không cố định** — tool mới có thể khai thêm `buildChart`. Client đừng hardcode
theo tên tool: cứ nhận event `chart` thì vẽ. Ngược lại, có tool trong bảng mà lượt đó **không**
ra biểu đồ cũng là bình thường (dữ liệu rỗng hoặc toàn số 0 thì server cố ý không vẽ).

Người dùng xin *"vẽ thành biểu đồ"* ở lượt sau → model **gọi lại đúng tool đó**, và biểu đồ ra
lần nữa. Client không cần làm gì thêm.

---

## TypeScript Types

```typescript
// types/ai-agent.types.ts

export type RouterTier = 'RULE' | 'EMBEDDING' | 'LLM' | 'FALLBACK';
export type ConfirmLevel = 'L1_CREATE' | 'L2_DECIDE';
export type AgentFieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'readonly';
/** NGUỒN của giá trị, KHÔNG phải quyền sửa. Xem mục "source và type là HAI chuyện khác nhau". */
export type AgentFieldSource = 'llm' | 'system';
export type AgentMessageRole = 'user' | 'assistant' | 'system';

// ─── Chat ───

export interface ChatDto {
  message: string;            // 1–2000 ký tự
  conversationId?: number;    // bỏ trống = mở hội thoại mới
}

export interface ChatUsage {
  promptTokens: number;
  completionTokens: number;
  cachedPromptTokens: number;
  costUsd: number | null;     // null nếu provider không báo giá
}

export interface ChatResponse {
  conversationId: number;
  messageId: number | null;   // null = server không lưu được tin nhắn → không chấm điểm được
  answer: string;             // toàn văn câu trả lời
  playbookId: string | null;  // null = router không khớp chủ đề nào
  routerTier: RouterTier;
  toolsCalled: string[];      // tên tool dùng dấu gạch dưới: leave_getMyBalance
  usage: ChatUsage;
  feedbackPrompt: FeedbackPrompt | null;   // thường null — server quyết định khi nào mời chấm
}

// ─── Đánh giá câu trả lời ───

export type FeedbackRating = 'BAD' | 'AVERAGE' | 'USEFUL' | 'GREAT';

export interface FeedbackOption {
  value: FeedbackRating;
  /** Nhãn tiếng Việt do SERVER gửi. Đừng hardcode ở client. */
  label: string;
}

export interface FeedbackPrompt {
  messageId: number;
  question: string;
  options: FeedbackOption[];  // thứ tự = thứ tự hiển thị, tệ → tốt
  commentPlaceholder: string;
}

export interface SubmitFeedbackDto {
  rating: FeedbackRating;
  comment?: string;           // ≤ 1000 ký tự; bỏ trống = XOÁ góp ý cũ
}

export interface Feedback {
  messageId: number;
  rating: FeedbackRating;
  ratingLabel: string;
  comment: string | null;
  createdAt: string;
  updatedAt: string;          // khác createdAt khi người dùng đổi điểm / thêm góp ý sau
}

// ─── SSE events ───
// Lưu ý: mọi event TRỪ `done` mang thêm `type` + `conversationId`.
// `done` mang đúng ChatResponse, KHÔNG có `type`.
// → switch theo TÊN EVENT ở dòng `event:`, không theo field `type`.

export type AgentStatusEvent =
  | { type: 'status'; stage: 'routing'; conversationId: number }
  | { type: 'status'; stage: 'playbook'; playbookId: string | null; tier: RouterTier; conversationId: number }
  | { type: 'status'; stage: 'tool'; tool: string; conversationId: number };

export interface AgentDeltaEvent { type: 'delta'; text: string; conversationId: number }
export interface AgentFormEvent { type: 'form'; pendingActionId: number; form: AgentForm; conversationId: number }
export interface AgentChartEvent { type: 'chart'; tool: string; chart: AgentChart; conversationId: number }
export interface AgentErrorEvent { message: string }   // KHÔNG có code, KHÔNG có type

export type AgentSseEvent =
  | { event: 'status'; data: AgentStatusEvent }
  | { event: 'delta';  data: AgentDeltaEvent }
  | { event: 'form';   data: AgentFormEvent }
  | { event: 'chart';  data: AgentChartEvent }
  | { event: 'done';   data: ChatResponse }
  | { event: 'error';  data: AgentErrorEvent };

// ─── Biểu đồ ───
// Số liệu do SERVER dựng từ dữ liệu thật, KHÔNG phải do LLM sinh. Client vẽ y nguyên:
// không cộng, không làm tròn, không suy thêm số nào.

export type AgentChartType = 'bar' | 'line' | 'donut';

export interface AgentChartSeries {
  name: string;
  data: number[];             // khớp 1-1 THEO CHỈ SỐ với AgentChart.labels
}

export interface AgentChart {
  type: AgentChartType;
  title: string;
  labels: string[];
  series: AgentChartSeries[];
  unit?: string;              // hiện sau con số trong tooltip: "ngày", "giờ", "%"
  source?: string;            // "12 người nhiều nhất trong 30 người có phát sinh"
}

// ─── Form xác nhận ───

export interface AgentFormOption {
  value: string | number;
  label: string;
}

export interface AgentFormField {
  name: string;
  label: string;
  /** Quyền sửa nằm ở ĐÂY: chỉ 'readonly' là khoá. */
  type: AgentFieldType;
  required: boolean;
  value: string | number | null;
  /** 'llm' = model đoán → PHẢI đánh dấu trực quan. Không liên quan tới quyền sửa. */
  source: AgentFieldSource;
  options?: AgentFormOption[];   // chỉ có khi type === 'select'
  helpText?: string;
}

export interface AgentFormPanel {
  label: string;
  value: string;
}

export interface AgentForm {
  title: string;
  confirmLevel: ConfirmLevel;
  fields: AgentFormField[];
  /** Dữ liệu gốc do SERVER đọc từ DB — không phải lời văn của model. */
  context: AgentFormPanel[];
  /** Hiện nổi bật nhưng KHÔNG chặn submit. */
  warnings: string[];
  submitLabel: string;
  /** Server tự lưu thành message SYSTEM — client không cần tự chèn. */
  successMessage?: string;
}

/** GET /agent/conversations/:id/pending-actions — `id` ở đây = `pendingActionId` của SSE event. */
export interface PendingAction {
  id: number;
  toolName: string;
  form: AgentForm;
  expiresAt: string;          // ISO 8601 — TTL 15 phút
}

export interface ConfirmActionDto {
  /** name → giá trị người dùng đã soát. Bỏ field readonly/trang trí (`_employee`). */
  payload: Record<string, unknown>;
}

export interface ConfirmActionResponse {
  pendingActionId: number;
  toolName: string;
  /** Kiểu mở — ĐỪNG bind chặt vào shape. */
  result: unknown;
  message: string;
}

/** Payload hợp lệ cho `leave_createRequest` — tool ghi duy nhất hiện có. */
export interface LeaveCreateRequestPayload {
  leaveTypeId: number;
  startDate: string;                                // "YYYY-MM-DD"
  endDate?: string;                                 // bỏ trống → server lấy = startDate
  reason: string;
  halfDayPeriod?: 'MORNING' | 'AFTERNOON';
}

// ─── Hội thoại ───

export interface ConversationSummary {
  id: number;
  title: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  messageCount: number;
}

export interface ConversationMessage {
  id: number;
  role: AgentMessageRole;     // đã hạ về chữ thường
  text: string;
  /** Chỉ có khi lượt đó CÓ biểu đồ. Tin nhắn cũ không có trường này. */
  charts?: AgentChart[];
  /** Chỉ có khi CHÍNH NGƯỜI GỌI đã chấm câu trả lời này. Không bao giờ là điểm của người khác. */
  feedback?: Feedback | null;
  createdAt: string;
}

// ─── Analytics ───

export interface AnalyticsQueryParams {
  from?: string;              // ISO 8601
  to?: string;                // ISO 8601 — khoảng tối đa 366 ngày
  employeeId?: number;        // chỉ có tác dụng ở /overview
  topLimit?: number;          // 1–50, default 10
}

export interface UsagePoint {
  bucket: string;             // ngày | tên model | mục đích
  promptTokens: number;
  completionTokens: number;
  cachedPromptTokens: number;
  costUsd: number;
  requests: number;
}

export interface AnalyticsTopic {
  playbookId: string;
  runs: number;
  share: number;              // % đã làm tròn 1 số thập phân
  successRate: number;        // %
  fallback: number;
  toolError: number;
  modelError: number;
  byTier: Record<RouterTier, number>;
}

export interface AnalyticsTopUser {
  employeeId: number;
  fullName: string;
  requests: number;
  totalTokens: number;
  costUsd: number;
}

export interface AnalyticsSummary {
  from: string;
  to: string;
  conversations: number;
  messages: number;
  requests: number;
  activeUsers: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedPromptTokens: number;
  cacheHitRate: number;       // %
  costUsd: number;
  costPerRequestUsd: number;
}

export interface FeedbackSummary {
  total: number;
  byRating: Record<FeedbackRating, number>;
  satisfactionRate: number;   // % USEFUL + GREAT
  negativeRate: number;       // % BAD
  score: number;              // trung bình 1–4; 0 = CHƯA AI CHẤM
  withComment: number;
  responseRate: number;       // % câu trả lời được chấm
}

export interface FeedbackGroup {
  bucket: string;             // playbookId | tier router | 'KHÔNG_RÕ'
  total: number;
  byRating: Record<FeedbackRating, number>;
  satisfactionRate: number;
  score: number;
}

/** KHÔNG có nội dung câu hỏi/câu trả lời — chỉ góp ý người dùng tự gõ. */
export interface FeedbackComment {
  id: number;
  rating: FeedbackRating;
  ratingLabel: string;
  comment: string;
  playbookId: string | null;
  routerTier: RouterTier | null;
  employeeId: number;
  fullName: string;
  createdAt: string;
}

export interface FeedbackAnalytics {
  from: string;
  to: string;
  summary: FeedbackSummary;
  byPlaybook: FeedbackGroup[];
  byTier: FeedbackGroup[];
  comments: FeedbackComment[];
}

export interface AnalyticsOverview {
  summary: AnalyticsSummary;   // có thêm `answers`: riêng số câu trả lời của trợ lý
  daily: UsagePoint[];
  byModel: UsagePoint[];
  byPurpose: UsagePoint[];
  topics: AnalyticsTopic[];
  topUsers: AnalyticsTopUser[];
  feedback: FeedbackSummary;
}
```

---

## Composable — useAiAgent

Các endpoint JSON dùng `useFetch()` như mọi module khác. **SSE thì không** — nó phải dùng `fetch`
thẳng vì `useFetch()` unwrap envelope, còn luồng event-stream không có envelope.

```typescript
// composables/useAiAgent.ts
import type {
  ChatDto, ChatResponse, ConversationSummary, ConversationMessage,
  PendingAction, ConfirmActionResponse, AnalyticsOverview, AnalyticsQueryParams,
  AgentSseEvent, Feedback, SubmitFeedbackDto,
} from '~/types/ai-agent.types';

export function useAiAgent() {
  const { get, list, post, patch, del } = useFetch();
  const config = useRuntimeConfig();

  // ─── JSON endpoints ───

  /** Hội thoại của tôi (ARCHIVED bị ẩn). limit tối đa 50. */
  const fetchConversations = (params?: { page?: number; limit?: number }) =>
    list<ConversationSummary>('/v1/agent/conversations', { params });

  /** Toàn bộ message — KHÔNG phân trang. */
  const fetchMessages = (id: number) =>
    get<ConversationMessage[]>(`/v1/agent/conversations/${id}/messages`);

  /**
   * Form còn hiệu lực. GỌI MỖI KHI MỞ LẠI HỘI THOẠI — form đẩy qua SSE nên reload là mất,
   * nhưng bản ghi phía server vẫn PENDING tới 15 phút.
   */
  const fetchPendingActions = (id: number) =>
    get<PendingAction[]>(`/v1/agent/conversations/${id}/pending-actions`);

  const renameConversation = (id: number, title: string) =>
    patch<{ renamed: boolean }>(`/v1/agent/conversations/${id}`, { title });

  /** Soft delete → ARCHIVED. 404 nghĩa là vốn đã archived. */
  const archiveConversation = (id: number) =>
    del(`/v1/agent/conversations/${id}`);

  /**
   * Chấm điểm một câu trả lời. Gọi lại cho cùng messageId = SỬA điểm cũ.
   * Bỏ `comment` thì góp ý cũ bị xoá — muốn giữ thì gửi lại.
   */
  const submitFeedback = (messageId: number, body: SubmitFeedbackDto) =>
    post<Feedback>(`/v1/agent/messages/${messageId}/feedback`, body);

  /**
   * Xác nhận & thực thi. `payload` = name → giá trị người dùng đã soát.
   * 409 = form hết hạn / đã chạy / dữ liệu đã đổi → ẩn form, mời hỏi lại.
   * 400 = Service từ chối → hiện nguyên văn message, GIỮ form để sửa, nhưng
   *       KHÔNG cho bấm lại cùng pendingActionId (server đã chốt CONFIRMED).
   */
  const confirmAction = (id: number, payload: Record<string, unknown>) =>
    post<ConfirmActionResponse>(`/v1/agent/actions/${id}/confirm`, { payload });

  const cancelAction = (id: number) =>
    post<{ cancelled: boolean }>(`/v1/agent/actions/${id}/cancel`);

  /** ADMIN/HR/DIRECTOR — toàn hệ thống. */
  const fetchAnalyticsOverview = (params?: AnalyticsQueryParams) =>
    get<AnalyticsOverview>('/v1/agent/analytics/overview', { params });

  /** Mọi role — chỉ dữ liệu của chính mình; employeeId bị bỏ qua. */
  const fetchMyAnalytics = (params?: AnalyticsQueryParams) =>
    get<AnalyticsOverview>('/v1/agent/analytics/me', { params });

  /** Bản không stream — KHÔNG trả form. Chỉ dùng cho read-only / health check. */
  const chatOnce = (dto: ChatDto) => post<ChatResponse>('/v1/agent/chat', dto);

  // ─── SSE ───

  /**
   * Luồng SSE. Dùng fetch thẳng: event-stream không có envelope `{ success, data }`.
   * Lỗi guard/validation về dưới dạng JSON thật → phải check `res.ok` TRƯỚC khi đọc stream.
   * Lỗi nghiệp vụ (quota, hội thoại không tồn tại) về dưới dạng `event: error` với HTTP 200.
   */
  async function* streamChat(
    dto: ChatDto,
    signal?: AbortSignal,
  ): AsyncGenerator<AgentSseEvent> {
    const res = await fetch(`${config.public.apiBase}/v1/agent/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${useAuthStore().accessToken}`,
        ...NGROK_HEADERS,
      },
      body: JSON.stringify(dto),
      signal,
    });

    if (!res.ok) {
      // 404 = module bị tắt (AGENT_ENABLED=false) → ẩn UI, đừng báo lỗi đỏ
      const err = await res.json().catch(() => null);
      throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      let sep: number;
      while ((sep = buf.indexOf('\n\n')) !== -1) {   // mỗi event kết thúc bằng một dòng trống
        const raw = buf.slice(0, sep);
        buf = buf.slice(sep + 2);

        let name = 'message';
        const dataLines: string[] = [];
        for (const line of raw.split('\n')) {
          if (line.startsWith('event: ')) name = line.slice(7).trim();
          else if (line.startsWith('data: ')) dataLines.push(line.slice(6));
        }
        if (!dataLines.length) continue;             // bỏ qua comment giữ nhịp nếu sau này có

        yield { event: name, data: JSON.parse(dataLines.join('\n')) } as AgentSseEvent;
      }
    }
  }

  return {
    streamChat, chatOnce,
    fetchConversations, fetchMessages, fetchPendingActions,
    renameConversation, archiveConversation,
    confirmAction, cancelAction, submitFeedback,
    fetchAnalyticsOverview, fetchMyAnalytics,
  };
}
```

Vòng tiêu thụ:

```typescript
const ac = new AbortController();
let answer = '';
let conversationId: number | undefined = currentId.value;

for await (const ev of streamChat({ message, conversationId }, ac.signal)) {
  switch (ev.event) {
    case 'status':
      conversationId ??= ev.data.conversationId;   // hội thoại mới: lấy id từ event đầu tiên
      stage.value = ev.data;                        // "Đang tra quỹ phép…"
      break;
    case 'delta':
      answer += ev.data.text;                       // KHÔNG tự thêm space/newline
      break;
    case 'form':
      pendingForm.value = { id: ev.data.pendingActionId, form: ev.data.form };
      break;                                        // vẫn còn `done` phía sau — đừng break vòng
    case 'chart':
      charts.value.push(ev.data.chart);             // gom lại, render DƯỚI phần chữ
      break;                                        // một lượt có thể có nhiều biểu đồ
    case 'done':
      conversationId = ev.data.conversationId;
      usage.value = ev.data.usage;
      break;
    case 'error':
      toast.error(ev.data.message);                 // KHÔNG auto-retry: mỗi lần hỏi là tốn token
      break;
  }
}
```

---

## Flutter — SSE client

```dart
Stream<({String event, Map<String, dynamic> data})> streamChat({
  required String message,
  int? conversationId,
  required String token,
}) async* {
  final client = http.Client();
  final req = http.Request('POST', Uri.parse('$api/v1/agent/chat/stream'))
    ..headers.addAll({
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
      'Accept': 'text/event-stream',
    })
    ..body = jsonEncode({
      'message': message,
      if (conversationId != null) 'conversationId': conversationId,
    });

  final res = await client.send(req);

  // Lỗi guard/validation về dưới dạng JSON thật — xử lý TRƯỚC khi đọc stream
  if (res.statusCode >= 400) {
    final body = await res.stream.bytesToString();
    client.close();
    throw Exception(jsonDecode(body)['error']?['message'] ?? 'HTTP ${res.statusCode}');
  }

  var buf = '';
  try {
    await for (final chunk in res.stream.transform(utf8.decoder)) {
      buf += chunk;
      var sep = buf.indexOf('\n\n');
      while (sep != -1) {
        final raw = buf.substring(0, sep);
        buf = buf.substring(sep + 2);

        var name = 'message';
        final dataLines = <String>[];
        for (final line in raw.split('\n')) {
          if (line.startsWith('event: ')) name = line.substring(7).trim();
          else if (line.startsWith('data: ')) dataLines.add(line.substring(6));
        }
        if (dataLines.isNotEmpty) {
          yield (
            event: name,
            data: jsonDecode(dataLines.join('\n')) as Map<String, dynamic>,
          );
        }
        sep = buf.indexOf('\n\n');
      }
    }
  } finally {
    client.close();   // huỷ giữa luồng: server vẫn lưu phần đã sinh
  }
}
```

---

## Error codes — một hạn chế phải biết

`HttpExceptionFilter` map **HTTP status → code chung**. Module AI Agent **chưa** khai error code
riêng theo nghiệp vụ, nên client nhận được: `BAD_REQUEST` (400) · `UNAUTHORIZED` (401) ·
`FORBIDDEN` (403) · `NOT_FOUND` (404) · `CONFLICT` (409) · `INTERNAL_SERVER_ERROR` (500).

> ⚠️ **Hệ quả:** sáu tình huống 409 khác nhau của confirm đều mang `code: "CONFLICT"`.
> **Không switch logic theo `code`** cho module này. Hai cách đúng hôm nay:
>
> 1. **Ưu tiên:** hiện `error.message` nguyên văn — các message đều đã viết bằng tiếng Việt hướng
>    người dùng cuối, dùng trực tiếp được.
> 2. Cần rẽ nhánh logic (ẩn form vs. giữ form) → so khớp message theo bảng ở mục confirm, và **bọc
>    trong một hàm duy nhất** để sau này BE thêm code thì chỉ sửa một chỗ.
>
> Nếu client cần rẽ nhánh chắc chắn, yêu cầu BE bổ sung code (`AGENT_FORM_EXPIRED`,
> `AGENT_FORM_SUPERSEDED`, `AGENT_ACTION_ALREADY_DONE`, `AGENT_QUOTA_EXCEEDED`, `AGENT_DISABLED`) —
> đây là thay đổi **thêm field**, không phá hợp đồng hiện tại.

---

## Edge cases

| Tình huống | Kết quả |
|---|---|
| `AGENT_ENABLED=false` | **404** trên mọi route `/v1/agent/*` → ẩn UI trợ lý, **không** báo lỗi |
| Hết hạn mức token/chi phí, gọi `/chat/stream` | **HTTP 200** + `event: error`, không phải 403 |
| Hết hạn mức token/chi phí, gọi `/chat` | **403** JSON thật |
| `message` rỗng hoặc > 2000 ký tự | **400** JSON thật (ValidationPipe chạy trước handler, cả trên endpoint stream) |
| `conversationId` của người khác | **404** — mọi truy vấn bị giới hạn bởi actor từ JWT |
| Router không khớp chủ đề | `playbookId: null`, `routerTier: "FALLBACK"`, trả câu mời diễn đạt lại — **không** phải lỗi |
| Model gọi tool ghi qua `/chat` (không stream) | Bản ghi PENDING được tạo nhưng response **không** có form → phải gọi `pending-actions` |
| Người dùng ngắt luồng giữa chừng | Server vẫn lưu phần đã sinh (`stopReason: ABANDONED`) → mở lại hội thoại thấy câu trả lời dở, hiển thị bình thường |
| Nhận `form` rồi break vòng lặp luôn | **Sai** — mất event `done` (và `usage`). `form` luôn đi trước `delta` + `done` |
| Parser switch theo field `type` | **Sai** — `done` không có `type`. Switch theo tên event ở dòng `event:` |
| Disable field vì `source: "system"` | **Sai** — quyền sửa nằm ở `type`, chỉ `readonly` là khoá |
| Chặn submit vì `warnings` không rỗng | **Sai** — server cố tình cho phép gửi kèm cảnh báo, quyết định là của người dùng |
| Reload trang khi đang có form | Form mất khỏi UI, bản ghi vẫn PENDING 15 phút → gọi `pending-actions` để dựng lại |
| Confirm sau 15 phút | **409** `Form đã hết hạn...` → ẩn form, mời hỏi lại |
| Dữ liệu gốc đổi giữa lúc dựng form và lúc bấm | **409** `Dữ liệu đã thay đổi...` (contextHash mismatch) → ẩn form, mời hỏi lại |
| Bấm confirm hai lần | Chỉ chạy một lần (server chốt CONFIRMED trước khi commit); lần hai nhận **409** |
| Commit fail rồi bấm lại cùng `pendingActionId` | **409** — bản ghi giữ CONFIRMED. Phải hỏi lại để dựng form mới |
| Gửi `_employee` trong `payload` confirm | Bị bỏ qua — không lỗi, nhưng không cần gửi |
| `EMPLOYEE` gọi `/agent/analytics/overview` | **403** → dùng `/agent/analytics/me` |
| Truyền `employeeId` vào `/agent/analytics/me` | Bị **bỏ qua hoàn toàn** — luôn trả dữ liệu của chính người gọi |
| Khoảng `from`–`to` > 366 ngày | **400** |
| Im lặng > 60s giữa hai event | Không có heartbeat → client tự abort |

---

## Việc BE còn nợ (đừng chờ, nhưng biết để khỏi tự dựng sai)

| Hạng mục | Trạng thái | Ảnh hưởng client |
|---|---|---|
| Error code riêng cho agent | **Chưa có** | Phải so khớp message — xem mục Error codes |
| `POST /chat` không trả form | **Theo thiết kế hiện tại** | UI chat buộc dùng `/chat/stream` |
| Heartbeat/keep-alive trên SSE | **Chưa có** | Client tự đặt timeout theo khoảng lặng |
| Resume stream (`Last-Event-ID`) | **Chưa có** | Mất kết nối = hỏi lại từ đầu |
| Endpoint gợi ý câu hỏi (suggested prompts) | **Chưa có** | Client tự hardcode danh sách gợi ý theo role |
| Endpoint đọc quota còn lại | **Chưa có** | Chỉ biết đã hết khi bị từ chối. Cần hiện trước thì phải yêu cầu BE thêm |
| Xem lại đoạn chat của lượt bị chấm tệ | **Không có, và là CHỦ Ý** | Hội thoại chỉ chủ hội thoại đọc được. Báo cáo chỉ có `comment` người dùng tự gõ — đừng dựng UI chờ field này |
| Xoá / rút lại đánh giá đã gửi | **Chưa có** | Đổi sang mức khác thì được (gọi lại endpoint); không có đường về trạng thái "chưa chấm" |
| Câu trả lời rỗng ở lượt không gọi tool | **Đã vá 30/09/2026** | Model thỉnh thoảng trả về text rỗng. Server nay **tự gọi lại một lần** (client không thấy gì khác ngoài việc `done` tới chậm hơn ~1 lượt model). Vẫn rỗng sau lần hai thì trả câu *"Mình chưa trả lời được câu này…"* và ghi `MODEL_ERROR`. Client **đừng** coi câu đó là lỗi mạng và **đừng tự retry** — server đã thử rồi |
| Tag `AI Agent` chưa `addTag` trong `main.ts` | Nhỏ | Nhóm endpoint trong Swagger UI thiếu mô tả; shape không ảnh hưởng |
| Biểu đồ cho các tool đọc còn lại | **Mới có 3/24 tool** | Đừng hardcode theo tên tool; cứ nhận event `chart` thì vẽ |
| Xuất biểu đồ ra ảnh / CSV | **Chưa có** | Muốn cho người dùng tải về thì client tự render từ `AgentChart` |

---

## Sinh type từ OpenAPI

```bash
curl {API_HOST}/api/docs-json -o openapi.json     # hoặc dùng docs/openapi.json đã commit
npx openapi-typescript openapi.json -o types/api.d.ts
```

**Hai thứ OpenAPI KHÔNG mô tả được — phải viết tay theo doc này:**

1. **Luồng SSE** của `POST /agent/chat/stream`. Swagger chỉ khai `200 text/event-stream`; tên event
   và shape từng event nằm ở mục "Sáu loại event".
2. **`ConfirmActionDto.payload`** là `Record<string, unknown>` (`type: Object`) — không có schema.
   Key hợp lệ suy ra từ `form.fields[].name` tại runtime; danh sách cho `leave_createRequest` ở mục confirm.
