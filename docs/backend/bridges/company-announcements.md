# Bridge Docs — Thông báo công ty (`/v1/company-announcements`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.

Module cho phép **HR/ADMIN** broadcast thông báo tới nhiều nhân viên cùng lúc, kèm file đính kèm và link. Mỗi lần tạo sinh ra:

- 1 record `CompanyAnnouncement` (nội dung + snapshot người nhận)
- N record `AnnouncementRecipient` (một cho mỗi người nhận, kèm trạng thái `isRead`)
- N in-app notifications (category `ANNOUNCEMENT`, type `COMPANY_ANNOUNCEMENT`)
- FCM push tới tất cả device tokens của recipients
- N email HTML (BullMQ queue)

---

## Endpoints

| Method | Path | Ai được gọi | Ghi chú |
| --- | --- | --- | --- |
| POST | `/v1/company-announcements` | `HR`, `ADMIN` | Tạo + broadcast — `multipart/form-data` với `attachments[]` |
| GET | `/v1/company-announcements` | `HR`, `ADMIN` | Danh sách đã gửi (phân trang) — **tinh gọn: chỉ id/title/type/status/thời gian/người tạo** |
| GET | `/v1/company-announcements/types` | Mọi user đã đăng nhập | Metadata: danh sách loại thông báo (`value` + `label`) cho dropdown |
| GET | `/v1/company-announcements/my` | Mọi user đã đăng nhập | Danh sách thông báo dành cho tôi (phân trang, filter `isRead`) — **tinh gọn, không kèm body/attachments** |
| GET | `/v1/company-announcements/my/:id` | Recipient | **MỚI:** Chi tiết một thông báo dành cho employee (kèm body + attachments đã presigned) |
| GET | `/v1/company-announcements/:id/mentionable-employees` | Mọi user đã đăng nhập | Danh sách nhân viên có thể @mention khi comment: recipients ACTIVE ∪ creator ∪ HR ACTIVE |
| GET | `/v1/company-announcements/:id` | `HR`, `ADMIN` | Chi tiết + full recipients (kèm avatar & trạng thái đọc) |
| GET | `/v1/company-announcements/:id/read-status` | `HR`, `ADMIN` | Thống kê đọc/chưa đọc (dashboard) |
| DELETE | `/v1/company-announcements/:id` | `HR`, `ADMIN` | Xoá thông báo — cascade xoá `AnnouncementRecipient` |
| PATCH | `/v1/company-announcements/:id/recall` | `HR`, `ADMIN` | Thu hồi — ẩn khỏi mọi query của employee, giữ nguyên trong DB |
| PATCH | `/v1/company-announcements/:id/read` | Recipient (any authenticated user) | Employee đánh dấu đã đọc |
| POST | `/v1/company-announcements/:id/react` | Recipient hoặc `HR`/`ADMIN` | React / bỏ react bằng emoji key |
| GET | `/v1/company-announcements/:id/reactions` | Mọi user đã đăng nhập | Danh sách reactions + reaction của tôi |
| GET | `/v1/company-announcements/:id/comments` | Mọi user đã đăng nhập | Danh sách comments (top-level + replies nested) |
| POST | `/v1/company-announcements/:id/comments` | Mọi user đã đăng nhập | Thêm comment hoặc reply — hỗ trợ @mention |
| DELETE | `/v1/company-announcements/comments/:commentId` | Owner hoặc `HR`/`ADMIN` | Soft-delete comment |

> **Thứ tự route:** `/my`, `/my/:id`, `/types` và `/:id/mentionable-employees` được khai báo **trước** `/:id` để tránh bị parse thành id. FE không cần lo, chỉ dùng path đúng.

> ⚠️ **BREAKING (2026-07):** payload của `GET /` (HR list) và `GET /my` (employee list) đã **bỏ** các field `body`, `attachments`, `links`, `recipientCount`, `recalledBy`. Thêm field mới `status: 'ACTIVE' | 'RECALLED'` + `createdAt`. Nếu cần các field trên → gọi `GET /:id` (HR/ADMIN) hoặc endpoint mới `GET /my/:id` (recipient).

---

## Presigned URLs — Attachment & avatar đã được sign

Bucket lưu trữ là **private**. Toàn bộ URL trong response được BE sign trước khi trả về, FE **không cần** sign lại.

| Field | Kiểu | Được sign | Xuất hiện ở |
| --- | --- | --- | --- |
| `attachments[].url` | `string` | ✅ presigned, dùng trực tiếp trong `<a href download>` | `GET /:id`, `GET /my/:id` |
| `recipients[].avatarUrl` | `string \| null` | ✅ presigned nếu có, `null` nếu nhân viên chưa upload avatar | `GET /:id`, `GET /:id/read-status` |
| `comments[].author.avatarUrl` | `string \| null` | ✅ presigned nếu có | `GET /:id/comments` |
| `comments[].replies[].author.avatarUrl` | `string \| null` | ✅ presigned nếu có | `GET /:id/comments` |

- TTL 3600s (1 giờ). Sau đó gọi lại API để lấy URL mới.
- Nếu sign lỗi (file bị xoá, key sai), field về `null` hoặc bị filter khỏi mảng attachments.

`links[].url` (link ngoài) **không sign** — dùng nguyên URL do HR nhập.

> **Danh sách (list) không còn attachments/links.** Presign chỉ xảy ra ở các endpoint detail (`GET /:id`, `GET /my/:id`) và response của `POST /` sẽ **không** kèm attachments — HR cần preview thì gọi GET detail ngay sau khi tạo.

---

## TypeScript Types

```typescript
// types/company-announcement.types.ts

export type AnnouncementType = 'ATTENDANCE_REPORT' | 'PROFILE_UPDATE' | 'DOCUMENT_SUBMIT' | 'GENERAL';

// ── Metadata (dropdown / picker) ──

export interface AnnouncementTypeOption {
	value: AnnouncementType;
	label: string; // nhãn tiếng Việt do BE cung cấp
}

export interface AnnouncementAttachment {
	name: string; // originalname từ browser
	url: string; // presigned R2 URL
}

export interface AnnouncementLink {
	label: string;
	url: string;
}

export interface AnnouncementCreator {
	id: number;
	fullName: string;
}

// ── Response cho list (HR/ADMIN) — tinh gọn ──

export type AnnouncementStatus = 'ACTIVE' | 'RECALLED';

export interface CompanyAnnouncementSummary {
	id: number;
	title: string;
	announcementType: AnnouncementType;
	status: AnnouncementStatus; // 'ACTIVE' | 'RECALLED' — derived từ recalledAt
	sentAt: string; // ISO 8601 — thời điểm broadcast
	createdAt: string; // ISO 8601 — record createdAt (thường trùng sentAt)
	createdBy: AnnouncementCreator;
	recalledAt: string | null; // ISO 8601 nếu đã bị thu hồi. Chi tiết ai thu hồi → gọi GET /:id
}

// ── Response chi tiết (HR/ADMIN) ──

export interface AnnouncementRecipientStatus {
	employeeId: number;
	fullName: string;
	avatarUrl: string | null; // presigned
	isRead: boolean;
	readAt: string | null; // ISO 8601
}

export interface CompanyAnnouncementResponse {
	id: number;
	title: string;
	body: string; // HTML content — render qua v-html hoặc dangerouslySetInnerHTML
	announcementType: AnnouncementType;
	attachments: AnnouncementAttachment[];
	links: AnnouncementLink[];
	sentAt: string; // ISO 8601
	createdBy: AnnouncementCreator;
	recalledAt: string | null; // ISO 8601 nếu đã bị thu hồi
	recalledBy: AnnouncementCreator | null;
	recipients: AnnouncementRecipientStatus[]; // toàn bộ người nhận + trạng thái
}

// ── Read-status endpoint ──

export interface ReadStatusResponse {
	total: number; // tổng số recipient
	readCount: number; // số người đã đọc
	unreadCount: number; // total - readCount
	recipients: AnnouncementRecipientStatus[];
}

// ── Response cho employee — list (tinh gọn) ──

export interface MyAnnouncementItem {
	id: number; // = announcement.id (KHÔNG phải recipient.id)
	title: string;
	announcementType: AnnouncementType;
	sentAt: string; // ISO 8601
	createdAt: string; // ISO 8601 — record createdAt
	createdBy: AnnouncementCreator;
	isRead: boolean; // trạng thái đọc của TÔI với thông báo này
	readAt: string | null; // ISO 8601 khi tôi đọc
	// KHÔNG còn body/attachments/links — gọi GET /my/:id để lấy chi tiết
}

// ── Response cho employee — detail (đầy đủ) ──

export interface MyAnnouncementDetail {
	id: number;
	title: string;
	body: string; // HTML — render qua v-html hoặc dangerouslySetInnerHTML
	announcementType: AnnouncementType;
	attachments: AnnouncementAttachment[]; // presigned URL
	links: AnnouncementLink[];
	sentAt: string; // ISO 8601
	createdAt: string; // ISO 8601
	createdBy: AnnouncementCreator;
	isRead: boolean;
	readAt: string | null;
}

// ── Mention picker (comment) ──

export interface AvailableRecipient {
	id: number;
	fullName: string;
	departmentId: number | null;
	avatarUrl: string | null; // presigned (TTL 3600s), null nếu chưa upload
}

// ── Reactions ──

export type ReactionEmoji = 'heart' | 'thumbsup' | 'laugh' | 'wow';

export interface ReactionSummary {
	heart: number;
	thumbsup: number;
	laugh: number;
	wow: number;
}

export interface ReactionEmployee {
	id: number;
	fullName: string;
	avatarUrl: string | null; // presigned
}

export interface ReactionDetail {
	emoji: ReactionEmoji;
	employees: ReactionEmployee[];
}

export interface ReactionResponse {
	summary: ReactionSummary;
	details: ReactionDetail[]; // luôn có 4 phần tử theo thứ tự heart/thumbsup/laugh/wow
	myReaction: ReactionEmoji | null; // emoji key hiện tại của tôi; null nếu chưa react
}

export interface ReactAnnouncementDto {
	emoji: ReactionEmoji;
}

export interface ReactActionResponse {
	action: 'added' | 'changed' | 'removed';
	emoji: ReactionEmoji;
}

// ── Request DTOs ──

export interface CreateAnnouncementDto {
	title: string; // min 3 ký tự
	body: string; // min 10 ký tự — HTML content
	announcementType: AnnouncementType;
	recipientIds?: number[]; // bỏ trống / rỗng = tất cả nhân viên ACTIVE
	links?: AnnouncementLink[]; // tối đa 10 link
	// attachments[] gửi qua multipart, KHÔNG nằm trong JSON body
}

export interface QueryAnnouncementParams {
	page?: number; // default 1
	limit?: number; // default 20, max 50
	isRead?: boolean; // chỉ áp dụng cho endpoint /my
	search?: string; // tìm theo tiêu đề hoặc nội dung (case-insensitive substring) — chỉ list HR
	created_at_from?: string; // "YYYY-MM-DD" hoặc ISO — lọc theo createdAt ≥ đầu ngày này. Chỉ list HR.
	created_at_to?: string; // "YYYY-MM-DD" hoặc ISO — lọc theo createdAt ≤ hết ngày này (inclusive). Chỉ list HR.
}
```

> **Lưu ý về `id` trong `MyAnnouncementItem`:** BE trả về `announcement.id` (không phải `AnnouncementRecipient.id`) để FE gọi `PATCH /:id/read` và `GET /:id` khớp cùng 1 ID.

> **`recipientIds` chỉ tồn tại trong request body — response KHÔNG có field này.** Nếu HR cần danh sách người nhận, đọc `recipients[]` trong detail (`.map(r => r.employeeId)`).

---

## Announcement Types — Render guide

| Value               | Icon | Label FE gợi ý           | Ý nghĩa nghiệp vụ                                   |
| ------------------- | ---- | ------------------------ | --------------------------------------------------- |
| `ATTENDANCE_REPORT` | 📊   | "Xem báo cáo công tháng" | Báo cáo chấm công định kỳ — HR gửi kèm Excel/PDF    |
| `PROFILE_UPDATE`    | 👤   | "Cập nhật thông tin"     | Nhắc nhân viên cập nhật hồ sơ cá nhân               |
| `DOCUMENT_SUBMIT`   | 📄   | "Nộp hồ sơ"              | Yêu cầu nộp hợp đồng / BHXH / giấy tờ               |
| `GENERAL`           | 📢   | (không có action)        | Thông báo chung — không có luồng nghiệp vụ đặc biệt |

FE dùng icon + action label để render banner/card trong list. `body` là HTML tự do, không có ràng buộc theo `announcementType`.

---

## GET /v1/company-announcements/types — Metadata loại thông báo

Trả về đầy đủ enum `announcementType` kèm `label` tiếng Việt do BE nắm giữ. Dùng để FE render dropdown khi HR tạo thông báo mới, tránh phải hard-code list trên FE.

- **Ai được gọi:** bất kỳ authenticated user (không giới hạn role).
- **Query params:** không có.
- **Response:** `ApiSuccess<AnnouncementTypeOption[]>` — thứ tự cố định `ATTENDANCE_REPORT → PROFILE_UPDATE → DOCUMENT_SUBMIT → GENERAL`.

```json
{
	"success": true,
	"data": [
		{ "value": "ATTENDANCE_REPORT", "label": "Báo cáo chấm công" },
		{ "value": "PROFILE_UPDATE", "label": "Cập nhật thông tin" },
		{ "value": "DOCUMENT_SUBMIT", "label": "Nộp hồ sơ" },
		{ "value": "GENERAL", "label": "Thông báo chung" }
	]
}
```

FE gợi ý cache 1 lần cho cả session (list này gần như không đổi). Icon vẫn thuộc FE — map từ `value` theo bảng "Render guide" ở trên.

---

## POST /v1/company-announcements — Tạo & broadcast

**Content-Type:** `multipart/form-data`.

**Fields** (form-data):

| Key | Type | Bắt buộc | Ghi chú |
| --- | --- | --- | --- |
| `title` | string | ✅ | Min 3 ký tự |
| `body` | string | ✅ | Min 10 ký tự, HTML |
| `announcementType` | string | ✅ | 1 trong 4 giá trị enum |
| `recipientIds` | string (JSON) | ❌ | JSON string dạng `"[1,2,3]"`. Bỏ trống / mảng rỗng = tất cả nhân viên `ACTIVE` |
| `links` | string (JSON) | ❌ | JSON string dạng `'[{"label":"Xem","url":"https://..."}]'`. Max 10 phần tử |
| `attachments` | File[] | ❌ | Tối đa **5 file**, 20 MB/file. Mime: JPG/PNG/PDF/DOCX/XLSX |

Vì `multipart/form-data` không natively hỗ trợ array-of-object, `recipientIds` và `links` phải gửi dưới dạng **chuỗi JSON**. BE tự parse trong DTO. Nếu FE gửi mảng thuần (framework tự lo), BE cũng chấp nhận.

**Ví dụ FE (nuxt):**

```typescript
const form = new FormData();
form.append('title', 'Báo cáo chấm công tháng 07/2026');
form.append('body', '<p>Kính gửi toàn thể nhân viên,</p><p>Đính kèm báo cáo...</p>');
form.append('announcementType', 'ATTENDANCE_REPORT');
form.append('recipientIds', JSON.stringify([5, 8, 12])); // bỏ dòng này = gửi cho tất cả
form.append(
	'links',
	JSON.stringify([{ label: 'Xem trên intranet', url: 'https://intranet.company.com/reports/2026-07' }]),
);
files.forEach(f => form.append('attachments', f));

await $fetch('/v1/company-announcements', { method: 'POST', body: form });
```

**Response 201:** `ApiSuccess<CompanyAnnouncementSummary>` — payload tinh gọn (không kèm attachments/links). Nếu HR cần preview file/link vừa upload, gọi `GET /:id` ngay sau đó.

```json
{
	"success": true,
	"data": {
		"id": 12,
		"title": "Báo cáo chấm công tháng 07/2026",
		"announcementType": "ATTENDANCE_REPORT",
		"status": "ACTIVE",
		"sentAt": "2026-07-23T05:30:00.000Z",
		"createdAt": "2026-07-23T05:30:00.000Z",
		"createdBy": { "id": 3, "fullName": "Nguyễn Thị HR" },
		"recalledAt": null
	}
}
```

**Side effects (chạy đồng thời qua `Promise.allSettled`):**

1. **In-app notifications** cho mỗi recipient (`category: ANNOUNCEMENT`, `type: COMPANY_ANNOUNCEMENT`, `targetUrl: /announcements/{id}`, `body`: strip HTML rồi cắt 200 ký tự)
2. **FCM push** cho tất cả device tokens của recipients (body cắt 100 ký tự)
3. **Email HTML** với template `company-announcement` (BullMQ queue, non-blocking)

Failure ở bất kỳ kênh nào cũng không rollback DB — được log và bỏ qua.

**Errors:**

- `400`: Thiếu field bắt buộc / `announcementType` không hợp lệ / vi phạm file (mime, size, số lượng > 5) / `recipientIds` không phải array of int
- `403`: Không phải HR/ADMIN
- `404`: Không có nhân viên hợp lệ (khi `recipientIds` toàn ID không tồn tại hoặc không `ACTIVE`)

---

## GET /v1/company-announcements — Danh sách đã gửi (HR/ADMIN)

**Query params:** `?page=1&limit=20&search=cập nhật&created_at_from=2026-07-01&created_at_to=2026-07-31`

Filter behaviour:

- `search`: substring match case-insensitive trên **title HOẶC body** (ILIKE `%search%`).
- `created_at_from` / `created_at_to`: khoảng ngày `createdAt`. Nếu gửi `YYYY-MM-DD`, `to` được coi là **hết ngày** (server convert `lt(nextDay)` để inclusive). Có thể gửi độc lập 1 trong 2.
- Bỏ trống = không filter, trả full list phân trang.

**Response:** `ApiPaginated<CompanyAnnouncementSummary>` — payload tinh gọn.

```json
{
	"success": true,
	"data": [
		{
			"id": 12,
			"title": "Báo cáo chấm công tháng 07/2026",
			"announcementType": "ATTENDANCE_REPORT",
			"status": "ACTIVE",
			"sentAt": "2026-07-23T05:30:00.000Z",
			"createdAt": "2026-07-23T05:30:00.000Z",
			"createdBy": { "id": 3, "fullName": "Nguyễn Thị HR" },
			"recalledAt": null
		},
		{
			"id": 11,
			"title": "Thông báo cập nhật hồ sơ",
			"announcementType": "PROFILE_UPDATE",
			"status": "RECALLED",
			"sentAt": "2026-07-20T05:30:00.000Z",
			"createdAt": "2026-07-20T05:30:00.000Z",
			"createdBy": { "id": 3, "fullName": "Nguyễn Thị HR" },
			"recalledAt": "2026-07-21T04:00:00.000Z"
		}
	],
	"meta": { "page": 1, "limit": 20, "total": 30, "totalPages": 2 }
}
```

`body`, `attachments`, `links`, `recipientCount`, `recalledBy` **không** trả trong list — gọi `GET /:id` để lấy chi tiết đầy đủ + danh sách người nhận.

**Sort:** mặc định `sentAt DESC` (mới nhất trước). Không hỗ trợ tuỳ chọn sort.

**Filter:** giữ nguyên như trước (`search`, `created_at_from`, `created_at_to`, `page`, `limit`).

---

## GET /v1/company-announcements/:id — Chi tiết + read status (HR/ADMIN)

**Response 200:** `ApiSuccess<CompanyAnnouncementResponse>`

```json
{
	"success": true,
	"data": {
		"id": 12,
		"title": "Báo cáo chấm công tháng 07/2026",
		"body": "<p>Kính gửi toàn thể nhân viên,</p><p>Đính kèm báo cáo tháng 07...</p>",
		"announcementType": "ATTENDANCE_REPORT",
		"attachments": [
			{
				"name": "bao-cao-cham-cong-thang-07.xlsx",
				"url": "https://hr-documents.s3.example.com/announcements/12/attachments/abc.xlsx?X-Amz-Signature=..."
			}
		],
		"links": [{ "label": "Xem trên intranet", "url": "https://intranet.company.com/reports/2026-07" }],
		"sentAt": "2026-07-23T05:30:00.000Z",
		"createdBy": { "id": 3, "fullName": "Nguyễn Thị HR" },
		"recipients": [
			{
				"employeeId": 5,
				"fullName": "Nguyễn Văn A",
				"avatarUrl": "https://hr-documents.s3.example.com/avatars/5/xyz.jpg?X-Amz-Signature=...",
				"isRead": true,
				"readAt": "2026-07-23T06:15:00.000Z"
			},
			{
				"employeeId": 8,
				"fullName": "Trần Thị B",
				"avatarUrl": null,
				"isRead": false,
				"readAt": null
			}
		]
	}
}
```

**Errors:** `403` không phải HR/ADMIN, `404` không tồn tại.

---

## GET /v1/company-announcements/:id/read-status — Thống kê đọc (HR/ADMIN)

Endpoint tối ưu cho dashboard "ai đã/chưa đọc" — trả về `total`/`readCount`/`unreadCount` + full recipients (giống field `recipients` của `GET /:id`).

**Response 200:** `ApiSuccess<ReadStatusResponse>`

```json
{
	"success": true,
	"data": {
		"total": 45,
		"readCount": 30,
		"unreadCount": 15,
		"recipients": [
			{
				"employeeId": 5,
				"fullName": "Nguyễn Văn A",
				"avatarUrl": "https://.../xyz.jpg?X-Amz-Signature=...",
				"isRead": true,
				"readAt": "2026-07-23T06:15:00.000Z"
			}
		]
	}
}
```

FE lọc `recipients.filter(r => !r.isRead)` để hiện danh sách "chưa đọc".

**Errors:** `403` / `404`.

---

## DELETE /v1/company-announcements/:id — Xoá (HR/ADMIN)

Không cần body. Cascade xoá `AnnouncementRecipient` (constraint FK `onDelete: Cascade`). In-app notifications đã tạo **không bị xoá** — chúng ở bảng `notifications` riêng, tồn tại độc lập.

**Response:** `204 No Content`. **Errors:** `403` / `404`.

---

## PATCH /v1/company-announcements/:id/recall — Thu hồi (HR/ADMIN)

Đánh dấu thông báo là "đã thu hồi" — **không xoá** khỏi DB. Sau khi thu hồi:

- Employee KHÔNG còn thấy trong `GET /my`, `PATCH /:id/read` trả 404, `GET /:id` (nếu employee được cho quyền tương lai) sẽ 404.
- HR/ADMIN vẫn thấy trong list `GET /` và detail `GET /:id`, với 2 field `recalledAt` + `recalledBy` được populate để hiển thị badge "Đã thu hồi".
- In-app notification (bảng `notifications`) KHÔNG bị xoá — nếu employee đã đọc / tap notification cũ, FE sẽ nhận 404 từ endpoint chi tiết → nên hiển thị message "Thông báo này đã bị thu hồi".
- KHÔNG gửi notification cho recipient (thu hồi là silent theo yêu cầu HR).

Không cần body.

**Response 200:** `ApiSuccess<CompanyAnnouncementSummary>` với `recalledAt` non-null và `status: "RECALLED"`. Muốn biết ai thu hồi → gọi `GET /:id` (payload chi tiết vẫn giữ `recalledBy`).

```json
{
	"success": true,
	"data": {
		"id": 12,
		"title": "...",
		"announcementType": "ATTENDANCE_REPORT",
		"status": "RECALLED",
		"sentAt": "2026-07-23T05:30:00.000Z",
		"createdAt": "2026-07-23T05:30:00.000Z",
		"createdBy": { "id": 3, "fullName": "..." },
		"recalledAt": "2026-07-23T07:15:00.000Z"
	}
}
```

**Errors:**

- `400 BAD_REQUEST` — thông báo đã thu hồi trước đó (`"Thông báo đã được thu hồi trước đó"`).
- `403 FORBIDDEN` — không phải HR/ADMIN.
- `404 NOT_FOUND` — thông báo không tồn tại.

**FE việc cần làm:**

- Trên list HR: dùng `status === 'RECALLED'` (hoặc `recalledAt != null`) để hiển thị badge/label "Đã thu hồi" (VD gray + strikethrough hoặc badge màu vàng). Nút "Thu hồi" nên disable/ẩn.
- Trên detail HR (`GET /:id`): hiển thị banner "Thu hồi bởi {recalledBy.fullName} lúc {recalledAt}" — `recalledBy` chỉ tồn tại trong response chi tiết, KHÔNG có trong list nữa.
- Trên list employee (`GET /my`): không cần xử lý — server đã filter.
- Nếu FE có deep link đến announcement đã bị recall, xử lý 404 gracefully với message riêng "Thông báo này đã bị thu hồi".

---

## GET /v1/company-announcements/:id/mentionable-employees — Mention picker (any authenticated user)

Trả về pool nhân viên có thể @mention khi comment 1 announcement. Scope = **hợp** của:

- Recipients ACTIVE của announcement này (từ bảng `AnnouncementRecipient`)
- Người tạo announcement (`createdBy`) — nếu vẫn ACTIVE
- Tất cả HR ACTIVE (kể cả không phải recipient)

Dedupe theo `id`, sort theo `fullName`. Không phân trang.

**Response:** `ApiSuccess<AvailableRecipient[]>`

```json
{
	"success": true,
	"data": [
		{ "id": 1, "fullName": "Admin System", "departmentId": null, "avatarUrl": null },
		{
			"id": 5,
			"fullName": "Nguyễn Văn A",
			"departmentId": 3,
			"avatarUrl": "https://.../avatars/5.jpg?X-Amz-Signature=..."
		},
		{ "id": 8, "fullName": "Trần Thị B", "departmentId": 2, "avatarUrl": null }
	]
}
```

- `avatarUrl` presigned (TTL 3600s), `null` nếu nhân viên chưa upload avatar hoặc sign lỗi.
- Endpoint cho **mọi authenticated user** — không giới hạn role. FE dùng để dựng dropdown khi user gõ `@` trong textarea comment.
- Không có filter theo query — client tự lọc theo tên đã gõ nếu cần.

**Errors:** `404` announcement không tồn tại.

> **BE tự silently filter mention ngoài scope này khi POST comment** — nếu user cố tag ID không nằm trong pool (VD paste raw text từ ngoài), notification vẫn không đi tới người đó và `mentionIds` snapshot sẽ bị strip khỏi ID không hợp lệ. FE **không cần** validate lại.

---

## GET /v1/company-announcements/my — Thông báo của tôi (list tinh gọn)

**Query params:**

- `page` (default 1), `limit` (default 20, max 50)
- `isRead=true` — chỉ hiện đã đọc
- `isRead=false` — chỉ hiện chưa đọc
- Bỏ `isRead` — hiện tất cả

**Response:** `ApiPaginated<MyAnnouncementItem>` — không kèm `body`, `attachments`, `links`.

```json
{
	"success": true,
	"data": [
		{
			"id": 12,
			"title": "Báo cáo chấm công tháng 07/2026",
			"announcementType": "ATTENDANCE_REPORT",
			"sentAt": "2026-07-23T05:30:00.000Z",
			"createdAt": "2026-07-23T05:30:00.000Z",
			"createdBy": { "id": 3, "fullName": "Nguyễn Thị HR" },
			"isRead": false,
			"readAt": null
		}
	],
	"meta": { "page": 1, "limit": 20, "total": 8, "totalPages": 1 }
}
```

Sort mặc định: `createdAt` của `AnnouncementRecipient` (thời điểm HR gửi cho tôi) — mới nhất trước.

FE cần render danh sách nhanh (card, thông báo trong bell icon…) → dùng endpoint này. Khi user click vào 1 item → điều hướng sang trang chi tiết gọi `GET /my/:id`.

---

## GET /v1/company-announcements/my/:id — Chi tiết thông báo của tôi

Full content dành cho recipient. Trả về HTML `body`, `attachments` đã presigned, `links` và trạng thái đọc của tôi.

**Response 200:** `ApiSuccess<MyAnnouncementDetail>`

```json
{
	"success": true,
	"data": {
		"id": 12,
		"title": "Báo cáo chấm công tháng 07/2026",
		"body": "<p>Kính gửi toàn thể nhân viên,</p><p>Đính kèm báo cáo tháng 07...</p>",
		"announcementType": "ATTENDANCE_REPORT",
		"attachments": [
			{
				"name": "bao-cao-cham-cong-thang-07.xlsx",
				"url": "https://hr-documents.s3.example.com/announcements/12/attachments/abc.xlsx?X-Amz-Signature=..."
			}
		],
		"links": [{ "label": "Xem trên intranet", "url": "https://intranet.company.com/reports/2026-07" }],
		"sentAt": "2026-07-23T05:30:00.000Z",
		"createdAt": "2026-07-23T05:30:00.000Z",
		"createdBy": { "id": 3, "fullName": "Nguyễn Thị HR" },
		"isRead": false,
		"readAt": null
	}
}
```

**Ai được gọi:** bất kỳ authenticated user. Server tự check user là recipient — nếu không phải hoặc thông báo đã bị thu hồi → **404** (không leak sự tồn tại).

**FE flow gợi ý:**

1. Vào trang list `/my` → chọn 1 item → điều hướng `/announcements/{id}`.
2. Trang chi tiết gọi `GET /my/:id` → render body + attachments + links.
3. Sau khi render xong, gọi song song `PATCH /:id/read` (idempotent, no-op nếu đã đọc) để bell icon cập nhật.
4. Nếu deep-link cũ dẫn về announcement đã bị recall → hiển thị message "Thông báo đã bị thu hồi".

**Errors:**

- `401` — chưa đăng nhập.
- `404` — thông báo không tồn tại / bạn không phải người nhận / đã bị thu hồi.

---

## PATCH /v1/company-announcements/:id/read — Đánh dấu đã đọc

Không cần body.

**Response:** `204 No Content`.

- Nếu tôi đã đọc rồi (`isRead = true`), request vẫn OK (no-op).
- Chỉ set `readAt = now` cho những record đang `isRead = false`.

**Errors:**

- `404`: Tôi không phải người nhận thông báo này (guard chống enumeration attack)

---

## Reactions — Emoji react cho announcement

Nhân viên có thể react một announcement bằng 1 trong 4 emoji key. Mỗi người chỉ có tối đa **1 reaction** trên 1 bài — bấm cùng emoji lần thứ 2 = toggle off (xoá), bấm emoji khác = đổi loại.

### Emoji map — FE tự render glyph

BE chỉ lưu **key string** (không lưu glyph unicode để tránh vấn đề encoding). FE map key → glyph:

| Key        | Glyph gợi ý |
| ---------- | ----------- |
| `heart`    | ❤️          |
| `thumbsup` | 👍          |
| `laugh`    | 😂          |
| `wow`      | 😮          |

### POST /v1/company-announcements/:id/react

**Body:**

```json
{ "emoji": "heart" }
```

**Response 200:** `ApiSuccess<ReactActionResponse>`

```json
{
	"success": true,
	"data": { "action": "added", "emoji": "heart" }
}
```

Semantic của `action`:

- `added` — trước đó user chưa react → tạo mới
- `changed` — đổi emoji khác với reaction cũ
- `removed` — bấm lại cùng emoji đang có → xoá (toggle off)

**Ai được phép gọi:** recipient của announcement, hoặc `HR`/`ADMIN`. Recipient được xác định qua bảng `AnnouncementRecipient` — kể cả với announcement đã recalled (server không chặn dựa trên `recalledAt` cho endpoint này).

**Errors:**

- `400` — `emoji` không thuộc `heart | thumbsup | laugh | wow`
- `403` — không phải recipient và không phải HR/ADMIN
- `404` — announcement không tồn tại

### GET /v1/company-announcements/:id/reactions

Không cần query params.

**Response 200:** `ApiSuccess<ReactionResponse>`

```json
{
	"success": true,
	"data": {
		"summary": { "heart": 3, "thumbsup": 5, "laugh": 1, "wow": 0 },
		"details": [
			{
				"emoji": "heart",
				"employees": [
					{ "id": 5, "fullName": "Nguyễn Văn A", "avatarUrl": "https://.../a.jpg?X-Amz-..." },
					{ "id": 8, "fullName": "Trần Thị B", "avatarUrl": null }
				]
			},
			{
				"emoji": "thumbsup",
				"employees": [
					/* ... */
				]
			},
			{
				"emoji": "laugh",
				"employees": [
					/* ... */
				]
			},
			{ "emoji": "wow", "employees": [] }
		],
		"myReaction": "heart"
	}
}
```

- `summary` luôn có đủ 4 key với giá trị 0 nếu không ai react.
- `details[]` luôn có đúng 4 phần tử theo thứ tự `heart → thumbsup → laugh → wow`.
- `employees[]` sort theo `createdAt` reaction (ai react trước ở đầu).
- `avatarUrl` presigned (TTL 3600s) hoặc `null`.
- `myReaction` = emoji key của user đang gọi API, hoặc `null` nếu chưa react.

**Errors:**

- `404` — announcement không tồn tại.

### FE việc cần làm

- Render 4 button emoji dưới mỗi announcement với count từ `summary`.
- Highlight (border, background) button khớp `myReaction`.
- Optimistic update: khi user bấm, cập nhật `summary` + `myReaction` tại chỗ dựa trên `action` trả về:
  - `added` → `summary[emoji]++`, `myReaction = emoji`
  - `changed` → `summary[old]--`, `summary[new]++`, `myReaction = new`
  - `removed` → `summary[emoji]--`, `myReaction = null`
- Popover "Ai đã react": gọi `GET /:id/reactions`, lọc `details.find(d => d.emoji === X).employees`.

---

## Composable — useCompanyAnnouncements

```typescript
// composables/useCompanyAnnouncements.ts
import type {
	CompanyAnnouncementSummary,
	CompanyAnnouncementResponse,
	MyAnnouncementItem,
	MyAnnouncementDetail,
	ReadStatusResponse,
	AvailableRecipient,
	AnnouncementTypeOption,
	CreateAnnouncementDto,
	QueryAnnouncementParams,
	ReactionEmoji,
	ReactionResponse,
	ReactActionResponse,
} from '~/types/company-announcement.types';

export function useCompanyAnnouncements() {
	const { get, list, post, patch, delete: del } = useFetch();

	// ── HR / ADMIN ──

	const fetchAll = (params?: QueryAnnouncementParams) =>
		list<CompanyAnnouncementSummary>('/v1/company-announcements', { params });

	const fetchById = (id: number) => get<CompanyAnnouncementResponse>(`/v1/company-announcements/${id}`);

	const getReadStatus = (id: number) => get<ReadStatusResponse>(`/v1/company-announcements/${id}/read-status`);

	const create = (dto: CreateAnnouncementDto, files: File[]) => {
		const form = new FormData();
		form.append('title', dto.title);
		form.append('body', dto.body);
		form.append('announcementType', dto.announcementType);
		if (dto.recipientIds?.length) {
			form.append('recipientIds', JSON.stringify(dto.recipientIds));
		}
		if (dto.links?.length) {
			form.append('links', JSON.stringify(dto.links));
		}
		files.forEach(f => form.append('attachments', f));
		return post<CompanyAnnouncementSummary>('/v1/company-announcements', form);
	};

	const deleteAnnouncement = (id: number) => del<void>(`/v1/company-announcements/${id}`);

	const getMentionableEmployees = (announcementId: number) =>
		get<AvailableRecipient[]>(`/v1/company-announcements/${announcementId}/mentionable-employees`);

	// ── Metadata ──

	const fetchTypes = () => get<AnnouncementTypeOption[]>('/v1/company-announcements/types');

	// ── Employee ──

	const fetchMyAnnouncements = (params?: QueryAnnouncementParams) =>
		list<MyAnnouncementItem>('/v1/company-announcements/my', { params });

	const fetchMyAnnouncementDetail = (id: number) => get<MyAnnouncementDetail>(`/v1/company-announcements/my/${id}`);

	const markAsRead = (id: number) => patch<void>(`/v1/company-announcements/${id}/read`, {});

	// ── Reactions ──

	const react = (id: number, emoji: ReactionEmoji) =>
		post<ReactActionResponse>(`/v1/company-announcements/${id}/react`, { emoji });

	const fetchReactions = (id: number) => get<ReactionResponse>(`/v1/company-announcements/${id}/reactions`);

	return {
		fetchAll,
		fetchById,
		getReadStatus,
		create,
		deleteAnnouncement,
		getMentionableEmployees,
		fetchTypes,
		fetchMyAnnouncements,
		fetchMyAnnouncementDetail,
		markAsRead,
		react,
		fetchReactions,
	};
}
```

---

## Notification Integration

Khi thông báo được tạo, ngoài record `CompanyAnnouncement` + `AnnouncementRecipient`, BE còn gửi 3 kênh notification:

**1. In-app notification** (`notifications` table — xem [notifications.md](./notifications.md)):

```json
{
	"category": "ANNOUNCEMENT",
	"type": "COMPANY_ANNOUNCEMENT",
	"refType": "company_announcement",
	"refId": 12,
	"actionType": "NAVIGATE_ONLY",
	"targetUrl": "/announcements/12",
	"title": "<title>",
	"body": "<HTML đã strip, cắt 200 ký tự>"
}
```

FE bell icon sẽ nhận notification này qua endpoint `GET /v1/notifications`. Khi user click, redirect tới `targetUrl`.

**2. FCM push** — data payload:

```json
{
	"category": "ANNOUNCEMENT",
	"type": "COMPANY_ANNOUNCEMENT",
	"refType": "company_announcement",
	"refId": "12",
	"notificationId": "0",
	"title": "<title>",
	"body": "<HTML đã strip, cắt 100 ký tự>"
}
```

Mobile app dùng `type === "COMPANY_ANNOUNCEMENT"` để navigate tới màn hình detail (xem [fcm-notifications.md](./fcm-notifications.md)).

**3. Email HTML** — template `company-announcement`, subject `[Thông báo] <title>`. Body giữ nguyên HTML gốc + block links/attachments được escape an toàn.

---

## Edge Cases

| Tình huống | Kết quả |
| --- | --- |
| `recipientIds` bỏ trống hoặc `[]` trong body | Broadcast tới **tất cả nhân viên ACTIVE** tại thời điểm gọi (snapshot) |
| `recipientIds` chứa ID không tồn tại / không ACTIVE | Các ID đó bị lọc bỏ; nếu sau lọc còn ≥ 1 người → OK, nếu rỗng → 404 |
| `recipientIds` có ID trùng | BE tự dedupe |
| Employee được thêm vào công ty **sau** khi HR gửi thông báo | Không nhận thông báo này (snapshot cứng tại `sentAt`) |
| Employee `INACTIVE` tại thời điểm gửi | Không nhận thông báo (bị lọc trước khi tạo `AnnouncementRecipient`) |
| Employee `INACTIVE` **sau** khi đã được thêm vào recipients | Vẫn còn trong `recipients[]` (không bị xoá tự động). FE có thể hiển thị badge "đã nghỉ" nếu cần |
| Employee gọi `GET /company-announcements` (list HR) | 403 Forbidden |
| Employee gọi `GET /:id` hoặc `/:id/read-status` | 403 Forbidden — dùng `GET /my` thay thế |
| Employee gọi `PATCH /:id/read` với thông báo không dành cho mình | 404 Not Found (không leak sự tồn tại) |
| Employee `markAsRead` 2 lần | 204 cả hai lần; `readAt` chỉ set lần đầu (không overwrite) |
| Attach > 5 file | 400 Bad Request (multer limit) |
| File > 20 MB hoặc mime không hỗ trợ | 400 Bad Request |
| `body` chứa `<script>` / XSS payload | BE **không** sanitize — HR nội bộ chịu trách nhiệm. FE nên dùng DOMPurify khi render `body` nếu lo ngại |
| DELETE announcement | Cascade xoá `AnnouncementRecipient`; in-app `notifications` gắn với `refId` vẫn còn (tự orphan, không có `targetUrl` khả dụng) |
| Presigned URL hết hạn (sau 1h) | FE gọi lại API để lấy URL mới; không có refresh endpoint riêng |
| Attachment upload thành công nhưng in-app/email/FCM fail | Announcement vẫn được tạo (errors chỉ log, không rollback). HR có thể xoá + tạo lại nếu cần |
| `isRead` sort trong list `/my` | Không dùng `isRead` để sort — mặc định luôn theo `createdAt desc`. Muốn "unread trước" thì filter 2 request riêng |
| `links` empty array | Không hiển thị block links trong email; trong response trả `[]` |
| `attachments` empty array | Không hiển thị block file trong email; trong response trả `[]` |
| Trạng thái `isRead` per-employee | Mỗi record `AnnouncementRecipient` tracking riêng — 1 người đọc không ảnh hưởng người khác |
| React với `emoji` ngoài 4 key hợp lệ | 400 Bad Request `"Emoji không hợp lệ..."` |
| User không phải recipient bấm react | 403 Forbidden. HR/ADMIN vẫn được react kể cả khi không phải recipient |
| React lần 2 cùng emoji đang có | Xoá reaction (toggle off), trả `{ action: 'removed' }` |
| React với emoji khác reaction cũ | Update tại chỗ (giữ nguyên `createdAt` của record) → `{ action: 'changed' }` |
| Xoá announcement | Cascade xoá `AnnouncementReaction` (constraint FK `onDelete: Cascade`) |
| Recall announcement | Không xoá reactions; endpoint `POST /:id/react` vẫn hoạt động nhưng FE thường ẩn UI sau khi recall |
| Gọi `GET /my/:id` với announcement đã bị recall | `404` — server ẩn hoàn toàn với recipient |
| Gọi `GET /my/:id` với id thuộc user khác | `404` (không phải 403) — tránh leak sự tồn tại |
| Cần biết `recipientCount` sau đổi API | Gọi `GET /:id/read-status` (đã có `total` field) |

---

## Comments — Bình luận & reply có @mention

Nhân viên (bất kỳ ai đăng nhập, không giới hạn recipient) có thể comment/reply trên announcement. Hỗ trợ **2 cấp**: comment gốc + 1 tầng reply. Reply-of-reply bị chặn (400).

Mỗi comment tạo record `AnnouncementComment` với snapshot `mentionIds` (integer array) để notify mà không JOIN lại content. Xóa là **soft-delete**: `isDeleted = true`, content bị thay bằng `"[Bình luận đã bị xóa]"`, `mentionIds` bị clear. Record vẫn còn để giữ context cho replies. Endpoint `GET /:id/comments` **lọc bỏ** mọi comment/reply đã soft-delete — FE không cần xử lý cờ.

### Mention syntax

Content raw dùng format: `@[fullName](employeeId)`

Ví dụ: `Chào @[Nguyễn Văn A](12) bạn xem thử nhé`

- FE parse trước khi render → replace bằng badge/pill click được (redirect tới profile).
- BE parse để extract `mentionIds` (dedupe, filter integer > 0), snapshot lưu ở `mentionIds` field.
- Chỉ các employee `ACTIVE` được tag mới nhận notification. Actor tự @ mình sẽ bị lọc.

### TypeScript Types

```typescript
// types/announcement-comment.types.ts

export interface CommentAuthor {
	id: number;
	fullName: string;
	avatarUrl: string | null; // presigned
	employeeCode: string;
	positionName: string | null;
}

export interface AnnouncementReply {
	id: number;
	announcementId: number;
	parentId: number; // luôn có value = ID của comment gốc
	author: CommentAuthor;
	content: string; // raw với `@[name](id)` syntax
	mentionIds: number[]; // snapshot employeeIds được tag
	isDeleted: boolean; // luôn false trong response (đã filter server-side)
	createdAt: string; // ISO 8601
	updatedAt: string; // ISO 8601
}

export interface AnnouncementComment {
	id: number;
	announcementId: number;
	parentId: number | null; // null = comment gốc
	author: CommentAuthor;
	content: string;
	mentionIds: number[];
	isDeleted: boolean;
	createdAt: string;
	updatedAt: string;
	replies: AnnouncementReply[]; // sort theo createdAt asc
	replyCount: number; // = replies.length (đã lọc isDeleted)
}

export interface CreateCommentDto {
	content: string; // 1–2000 ký tự, dùng mention syntax
	parentId?: number; // ID comment gốc nếu là reply
}
```

### GET /v1/company-announcements/:id/comments — Danh sách comments

Không có phân trang. Trả toàn bộ comments của một announcement (theo thứ tự tạo).

**Response 200:** `ApiSuccess<AnnouncementComment[]>`

```json
{
	"success": true,
	"data": [
		{
			"id": 10,
			"announcementId": 12,
			"parentId": null,
			"author": {
				"id": 5,
				"fullName": "Nguyễn Văn A",
				"avatarUrl": "https://.../a.jpg?X-Amz-Signature=...",
				"employeeCode": "EMP005",
				"positionName": "Nhân viên"
			},
			"content": "Chào @[Trần Thị B](8) bạn xem thử báo cáo nhé",
			"mentionIds": [8],
			"isDeleted": false,
			"createdAt": "2026-07-23T05:30:00.000Z",
			"updatedAt": "2026-07-23T05:30:00.000Z",
			"replies": [
				{
					"id": 11,
					"announcementId": 12,
					"parentId": 10,
					"author": {
						"id": 8,
						"fullName": "Trần Thị B",
						"avatarUrl": null,
						"employeeCode": "EMP008",
						"positionName": "Trưởng phòng"
					},
					"content": "Cảm ơn @[Nguyễn Văn A](5) mình đã đọc",
					"mentionIds": [5],
					"isDeleted": false,
					"createdAt": "2026-07-23T05:35:00.000Z",
					"updatedAt": "2026-07-23T05:35:00.000Z"
				}
			],
			"replyCount": 1
		}
	]
}
```

**Errors:** `404` announcement không tồn tại.

### POST /v1/company-announcements/:id/comments — Thêm comment / reply

**Body:**

```json
{
	"content": "Chào @[Nguyễn Văn A](12) bạn xem thử nhé",
	"parentId": 10
}
```

- `content` bắt buộc, 1–2000 ký tự.
- `parentId` optional. Bỏ trống = comment gốc. Có value = reply — phải trỏ tới comment gốc (parentId của comment cha phải null).

**Response 201:** `ApiSuccess<AnnouncementComment>` (record vừa tạo, `replies = []`, `replyCount = 0`).

**Side effects:**

- In-app notification cho từng employee được @mention (`category: ANNOUNCEMENT`, `type: ANNOUNCEMENT_COMMENT_MENTION`, `targetUrl: /announcements?open_id={announcementId}`).
- FCM push cho device tokens của các employee được @mention.
- Actor tự tag chính mình → bị lọc (không nhận notification).
- Employee `INACTIVE` được tag → bị lọc.
- Không có email cho mention (chỉ in-app + FCM).

Failure ở kênh nào cũng chỉ log, không rollback.

**Errors:**

- `400` — content không hợp lệ / reply-of-reply (`parentId` trỏ tới reply thay vì comment gốc) / comment cha đã xóa / comment cha khác announcement.
- `404` — announcement không tồn tại / comment cha không tồn tại.

### DELETE /v1/company-announcements/comments/:commentId — Xóa comment

Soft-delete. Chỉ owner hoặc `HR`/`ADMIN` được phép. Không cần body.

**Response:** `204 No Content`.

- Cascade: khi xóa comment gốc bằng `HR/ADMIN` qua endpoint này = soft-delete duy nhất comment đó (replies không bị xóa theo). Muốn xóa cả cây, FE gọi lần lượt.
- Hard-delete chỉ xảy ra khi announcement bị `DELETE /:id` — Prisma cascade `onDelete: Cascade` sẽ xóa mọi comment + reply.

**Errors:**

- `400` — comment đã bị xóa trước đó.
- `403` — không phải owner và không phải HR/ADMIN.
- `404` — comment không tồn tại.

### Composable — bổ sung vào `useCompanyAnnouncements`

```typescript
import type { AnnouncementComment, CreateCommentDto } from '~/types/announcement-comment.types';

// ...trong useCompanyAnnouncements()

const fetchComments = (announcementId: number) =>
	get<AnnouncementComment[]>(`/v1/company-announcements/${announcementId}/comments`);

const addComment = (announcementId: number, dto: CreateCommentDto) =>
	post<AnnouncementComment>(`/v1/company-announcements/${announcementId}/comments`, dto);

const deleteComment = (commentId: number) => del<void>(`/v1/company-announcements/comments/${commentId}`);
```

### FE việc cần làm

- Render nested UI 2 cấp: comment gốc + block replies nằm trong.
- Mention picker: khi user gõ `@`, gọi `GET /v1/company-announcements/:id/mentionable-employees` (mọi user gọi được, scope = recipients ACTIVE ∪ creator ∪ HR ACTIVE) → hiện dropdown employee → chèn `@[fullName](id)` vào textarea. BE tự silently filter ID ngoài scope khi POST comment nên FE không cần validate lại.
- Render mention: parse regex `@\[([^\]]+)\]\((\d+)\)` trong content, replace bằng `<span class="mention" data-id="...">@fullName</span>`.
- Soft-delete: comment `isDeleted=true` không xuất hiện trong response (server đã filter) — nếu FE optimistic delete, đơn giản remove khỏi state.
- Optimistic add: gọi API, khi 201 về thì append vào `replies[]` của comment cha (hoặc top-level nếu không có `parentId`).
- Nút "Xóa" chỉ hiện với owner (`comment.author.id === currentUser.id`) hoặc user có role `HR`/`ADMIN`.

### Edge Cases

| Tình huống | Kết quả |
| --- | --- |
| `parentId` trỏ tới reply (không phải comment gốc) | 400 `"Chỉ hỗ trợ 2 cấp comment"` |
| `parentId` trỏ tới comment gốc của **announcement khác** | 400 `"Comment cha không thuộc thông báo này"` |
| Comment cha đã soft-delete → reply | 400 `"Không thể reply comment đã xóa"` |
| Actor @mention chính mình | Bị lọc, không tự nhận notification |
| Actor @mention employee `INACTIVE` | Bị lọc, không nhận notification (và không lỗi) |
| Actor @mention ID không tồn tại | Bị lọc silently, `mentionIds` vẫn chứa ID đó (snapshot raw) |
| Actor @mention trùng 1 người 2 lần trong content | Notification chỉ gửi 1 lần (dedupe) |
| Xóa comment gốc | Replies vẫn còn, hiển thị bình thường. Chỉ record cha bị mask content |
| Xóa announcement (`DELETE /:id`) | Cascade Prisma xóa cả cây comments (hard-delete) |
| GET danh sách khi mọi comment đã bị xóa | Trả `[]` |
| User không đăng nhập | 401 (JwtAuthGuard) — endpoint không yêu cầu role đặc biệt |
| React notification `ANNOUNCEMENT_COMMENT_MENTION` khi user tap trên mobile | Mobile navigate tới màn announcement detail dùng `refId` từ FCM data |
