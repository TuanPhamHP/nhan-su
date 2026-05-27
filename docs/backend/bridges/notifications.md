# Bridge Docs — Notification Center (`/v1/notifications`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.

Notification Center lưu mọi sự kiện (chấm công, nghỉ phép, OT, vi phạm) vào DB và đẩy FCM song song.  
Khác với email notifications — đây là **in-app + push**, không phải email.

---

## Endpoints

| Method | Path | Ai được gọi | Ghi chú |
| --- | --- | --- | --- |
| GET | `/v1/notifications` | Mọi user đã đăng nhập | Danh sách của tôi, hỗ trợ lọc theo `category` |
| GET | `/v1/notifications/unread-count` | Mọi user đã đăng nhập | Số chưa đọc theo từng category (dùng cho badge) |
| PATCH | `/v1/notifications/read-all` | Mọi user đã đăng nhập | Đánh dấu tất cả đã đọc; truyền `?category=` để giới hạn |
| PATCH | `/v1/notifications/:id/read` | Mọi user đã đăng nhập | Đánh dấu một thông báo đã đọc |
| DELETE | `/v1/notifications` | Mọi user đã đăng nhập | Xóa tất cả; truyền `?category=` để xóa một category |
| POST | `/v1/notifications/test` | `ADMIN` | Gửi test notification tới nhiều platform (email/in-app/FCM) |
| POST | `/v1/notifications/test-fcm` | `ADMIN` | Gửi FCM test tới tất cả device của một nhân viên |
| GET | `/v1/notifications/test-email` | `ADMIN` | Gửi email test để kiểm tra pipeline Gmail SMTP |

> **Lưu ý thứ tự route:** `/notifications/unread-count`, `/notifications/read-all`, `/notifications/test*` được khai báo **trước** `/notifications/:id/read` trong controller.  
> Nếu `PATCH /notifications/read-all` trả 404, kiểm tra thứ tự route của router phía client.

Mỗi user chỉ đọc/ghi được thông báo của chính mình. Các endpoint `/test*` yêu cầu role `ADMIN`.

---

## TypeScript Types

```typescript
// types/notification.types.ts

export type NotificationCategory = 'EVENT' | 'ATTENDANCE' | 'LEAVE';

export type NotificationType =
	// Chấm công
	| 'CHECK_IN'
	| 'CHECK_OUT'
	| 'LATE'
	| 'ABSENT'
	| 'MISSING_CHECKOUT'
	// Nghỉ phép
	| 'LEAVE_CREATED'
	| 'LEAVE_APPROVED'
	| 'LEAVE_REJECTED'
	| 'LEAVE_CANCELLED'
	| 'LEAVE_AUTO_CANCELLED'
	// OT
	| 'OT_CREATED'
	| 'OT_APPROVED'
	| 'OT_REJECTED'
	| 'OT_CANCELLED'
	| 'OT_AUTO_CANCELLED'
	// Vi phạm
	| 'VIOLATION_CREATED'
	| 'VIOLATION_APPROVED'
	| 'VIOLATION_REJECTED'
	// Đăng ký WFH
	| 'ONLINE_WORK_CREATED'
	| 'ONLINE_WORK_APPROVED'
	| 'ONLINE_WORK_REJECTED'
	| 'ONLINE_WORK_CANCELLED'
	| 'ONLINE_WORK_COMPLETED'
	// Bù công
	| 'MAKEUP_CREATED'
	| 'MAKEUP_APPROVED'
	| 'MAKEUP_REJECTED'
	// Admin test
	| 'TEST';

export type NotificationActionType = 'NAVIGATE_ONLY' | 'APPROVE_REJECT';

export interface NotificationResponse {
	id: number;
	title: string;
	body: string;
	category: NotificationCategory;
	type: NotificationType;
	refId: number | null; // ID của entity liên quan — null nếu không có navigation
	refType: string | null; // 'leave_request' | 'overtime_request' | 'violation_request' | 'online_work_request' | 'makeup_request' | null
	actionType: NotificationActionType | null; // 'APPROVE_REJECT' = người duyệt; 'NAVIGATE_ONLY' = đọc thôi
	targetUrl: string | null; // URL deep link tương đối, ví dụ "/leave/55"
	actionPayload: Record<string, unknown> | null; // data phụ cho action (nếu cần)
	isRead: boolean;
	createdAt: string; // ISO 8601
}

export interface UnreadCountResponse {
	total: number; // tổng tất cả category
	event: number; // category EVENT
	attendance: number; // category ATTENDANCE
	leave: number; // category LEAVE
}

export interface QueryNotificationsParams {
	page?: number; // default 1
	limit?: number; // default 20, max 100
	category?: NotificationCategory;
}
```

---

## Category Mapping

| Category | Các type thuộc về |
| --- | --- |
| `EVENT` | `OT_CREATED`, `OT_APPROVED`, `OT_REJECTED`, `OT_CANCELLED`, `OT_AUTO_CANCELLED`, `VIOLATION_CREATED`, `VIOLATION_APPROVED`, `VIOLATION_REJECTED`, `ONLINE_WORK_CREATED`, `ONLINE_WORK_APPROVED`, `ONLINE_WORK_REJECTED`, `ONLINE_WORK_CANCELLED`, `ONLINE_WORK_COMPLETED`, `MAKEUP_CREATED`, `MAKEUP_APPROVED`, `MAKEUP_REJECTED` |
| `ATTENDANCE` | `CHECK_IN`, `CHECK_OUT`, `LATE`, `ABSENT`, `MISSING_CHECKOUT` |
| `LEAVE` | `LEAVE_CREATED`, `LEAVE_APPROVED`, `LEAVE_REJECTED`, `LEAVE_CANCELLED`, `LEAVE_AUTO_CANCELLED` |

---

## Navigation — targetUrl + refType + refId

Ưu tiên dùng `targetUrl` nếu có (backend đã build sẵn path). Fallback về `refType + refId` nếu cần.

| `actionType`       | Ý nghĩa                                     | Hiển thị trên UI        |
| ------------------ | ------------------------------------------- | ----------------------- |
| `'APPROVE_REJECT'` | Người nhận cần duyệt/từ chối — tiền tố `📋` | Hiện nút "Xem và duyệt" |
| `'NAVIGATE_ONLY'`  | Chỉ đọc/theo dõi — tiền tố `✅❌🔄⚠️⏰📌`   | Chỉ điều hướng          |
| `null`             | Không điều hướng (ATTENDANCE informational) | Không có nút/link       |

| `refType`             | Route fallback        | Các type sử dụng           |
| --------------------- | --------------------- | -------------------------- |
| `leave_request`       | `/leave/:refId`       | `LEAVE_*`                  |
| `overtime_request`    | `/overtime/:refId`    | `OT_*`                     |
| `violation_request`   | `/violation/:refId`   | `VIOLATION_*`              |
| `online_work_request` | `/online-work/:refId` | `ONLINE_WORK_*`            |
| `makeup_request`      | `/makeup/:refId`      | `MAKEUP_*`                 |
| `null`                | _(không navigate)_    | `ATTENDANCE` types, `TEST` |

```typescript
function navigateFromNotification(notification: NotificationResponse, router: Router) {
	// Ưu tiên targetUrl nếu backend đã build sẵn
	if (notification.targetUrl) {
		router.push(notification.targetUrl);
		return;
	}

	const { refType, refId } = notification;
	if (!refType || refId === null) return;

	const routes: Record<string, string> = {
		leave_request: `/leave/${refId}`,
		overtime_request: `/overtime/${refId}`,
		violation_request: `/violation/${refId}`,
		online_work_request: `/online-work/${refId}`,
		makeup_request: `/makeup/${refId}`,
	};

	const route = routes[refType];
	if (route) router.push(route);
}
```

---

## GET /v1/notifications — Danh sách thông báo

**Query params:** `?page=1&limit=20&category=LEAVE`

**Response:** envelope bọc `data` array + `meta` mở rộng (có thêm `unreadCount`)

```json
{
	"success": true,
	"data": [
		{
			"id": 101,
			"title": "Đơn nghỉ phép được duyệt ✅",
			"body": "Đơn Nghỉ phép năm ngày 03/06/2026 đã được duyệt",
			"category": "LEAVE",
			"type": "LEAVE_APPROVED",
			"refId": 55,
			"refType": "leave_request",
			"isRead": false,
			"createdAt": "2026-06-03T04:12:00.000Z"
		},
		{
			"id": 98,
			"title": "Check-in thành công!",
			"body": "Bạn đã check-in lúc 08:27 tại Văn phòng",
			"category": "ATTENDANCE",
			"type": "CHECK_IN",
			"refId": null,
			"refType": null,
			"isRead": true,
			"createdAt": "2026-06-03T01:27:00.000Z"
		}
	],
	"meta": {
		"page": 1,
		"limit": 20,
		"total": 42,
		"totalPages": 3,
		"unreadCount": 7
	}
}
```

> **Lưu ý `meta.unreadCount`:** luôn là tổng toàn bộ thông báo chưa đọc của user, **không** bị ảnh hưởng bởi `?category=`. Dùng giá trị này để cập nhật badge bell icon khi đang xem list.

---

## GET /v1/notifications/unread-count — Badge count

```json
{
	"success": true,
	"data": {
		"total": 7,
		"event": 2,
		"attendance": 3,
		"leave": 2
	}
}
```

**Gọi khi nào:**

- Mở app (sau khi đăng nhập thành công)
- Mở notification center
- Sau khi `PATCH /:id/read` hoặc `PATCH /read-all`
- Khi nhận FCM push (để sync badge)

---

## PATCH /v1/notifications/read-all

- Không có body.
- Không có `?category=` → đánh dấu tất cả đã đọc.
- Có `?category=LEAVE` → chỉ đánh dấu category LEAVE đã đọc.
- **Response: 204 No Content** (không có body).

## PATCH /v1/notifications/:id/read

- Chỉ đánh dấu notification của chính mình. Notification của người khác bị silently ignored (không 403).
- **Response: 204 No Content**.

## DELETE /v1/notifications

- Không có `?category=` → xóa tất cả của mình.
- Có `?category=ATTENDANCE` → chỉ xóa ATTENDANCE.
- **Response: 204 No Content**.

---

## Composable — useNotifications

```typescript
// composables/useNotifications.ts
import type {
	NotificationResponse,
	UnreadCountResponse,
	QueryNotificationsParams,
	NotificationCategory,
} from '~/types/notification.types';

export function useNotifications() {
	const { get, patch, del } = useFetch();

	const fetchNotifications = (params?: QueryNotificationsParams) =>
		get<{
			data: NotificationResponse[];
			meta: { page: number; limit: number; total: number; totalPages: number; unreadCount: number };
		}>('/v1/notifications', { params });

	const fetchUnreadCount = () => get<UnreadCountResponse>('/v1/notifications/unread-count');

	const markAsRead = (id: number) => patch<void>(`/v1/notifications/${id}/read`);

	const markAllAsRead = (category?: NotificationCategory) =>
		patch<void>('/v1/notifications/read-all', undefined, { params: category ? { category } : {} });

	const deleteAll = (category?: NotificationCategory) =>
		del<void>('/v1/notifications', { params: category ? { category } : {} });

	return {
		fetchNotifications,
		fetchUnreadCount,
		markAsRead,
		markAllAsRead,
		deleteAll,
	};
}
```

---

## FCM Push Payload

Khi tạo notification, server đồng thời gửi FCM data message đến tất cả device token của employee. Payload FCM nhận được (tất cả là `string`):

```typescript
interface FcmNotificationPayload {
	type: string; // NotificationType, ví dụ "LEAVE_APPROVED"
	notificationId: string; // ID trong DB, dùng để mark read
	title: string;
	body: string;
	refId: string; // "" nếu không có
	refType: string; // "" nếu không có
}
```

Khi nhận FCM:

1. Hiển thị local notification từ `title` + `body`.
2. Gọi `GET /notifications/unread-count` để cập nhật badge.
3. Khi user tap → parse `refType` + `refId` để navigate (xem bảng Navigation ở trên).

---

---

## Admin — Test Endpoints (`ADMIN` only)

Ba endpoint dùng để kiểm tra pipeline notification. **Không gọi từ UI production** — chỉ dùng trong Swagger hoặc Postman.

### POST /v1/notifications/test — Unified test

Gửi cùng một notification tới nhiều platform trong một lần gọi. Kết quả trả về cho từng platform.

**Request body:**

```json
{
	"employeeId": 1,
	"title": "Test Notification",
	"body": "Đây là nội dung thông báo test từ admin.",
	"platforms": ["in-app", "email", "fcm"],
	"emailTo": "admin@company.com"
}
```

| Field        | Bắt buộc                       | Ghi chú                                                   |
| ------------ | ------------------------------ | --------------------------------------------------------- |
| `employeeId` | ✓                              | Nhân viên nhận in-app và FCM                              |
| `title`      | ✓                              | Tiêu đề                                                   |
| `body`       | ✓                              | Nội dung                                                  |
| `platforms`  | ✓                              | Mảng, tối thiểu 1 phần tử: `'email'`, `'in-app'`, `'fcm'` |
| `emailTo`    | Khi `platforms` chứa `'email'` | Địa chỉ email nhận                                        |

**Response 200:**

```json
{
	"success": true,
	"data": {
		"platforms": {
			"in-app": { "sent": true },
			"email": { "sent": true },
			"fcm": { "sent": true, "detail": { "sent": 2, "invalidRemoved": 0, "tokens": ["abc…"] } }
		}
	}
}
```

> **Lưu ý:** platform `'in-app'` tự động gửi kèm FCM qua `NotificationCenterService`. Nếu chọn cả `'in-app'` và `'fcm'` cùng lúc, FCM sẽ được gửi 2 lần.

### POST /v1/notifications/test-fcm — FCM standalone

```json
{
	"employeeId": 1,
	"title": "Test FCM",
	"body": "Kiểm tra FCM pipeline",
	"type": "test.manual"
}
```

**Response 200:** `{ sent: number, invalidRemoved: number, tokens: string[] }`

### GET /v1/notifications/test-email — Email standalone

`?to=dev@company.com`

**Response 200:** `{ message: string }` — email được đưa vào queue, không chờ send thực tế.

---

## Edge Cases

| Tình huống | Kết quả |
| --- | --- |
| `DELETE /notifications` không có `?category=` | Xóa **toàn bộ** thông báo của mình |
| `DELETE /notifications?category=ATTENDANCE` | Chỉ xóa ATTENDANCE, EVENT + LEAVE giữ nguyên |
| `PATCH /read-all?category=LEAVE` | Chỉ mark LEAVE đã đọc |
| Employee chưa đăng ký device token | Notification vẫn lưu DB, FCM bị skip — không có lỗi |
| FCM token hết hạn / invalid | Server tự xóa token khỏi DB sau khi Firebase báo lỗi |
| Notification > 90 ngày | Tự động xóa mỗi Chủ nhật 02:00 (cron `OvertimeCronService`) |
| `PATCH /:id/read` với id của người khác | 204 nhưng không có gì thay đổi (silently ignored) |
| `meta.unreadCount` khi lọc `?category=LEAVE` | Vẫn trả tổng toàn bộ unread (không phải chỉ LEAVE) — dùng cho bell badge |
| Type `ABSENT`, `LEAVE_AUTO_CANCELLED`, `OT_CANCELLED`, `VIOLATION_CREATED` | Có trong enum, chưa có factory — reserved cho tính năng tương lai |
| `actionType: 'APPROVE_REJECT'` | Notification dành cho người duyệt — hiện nút hành động rõ ràng trên UI |
| `actionType: 'NAVIGATE_ONLY'` | Notification thông tin — chỉ tap để xem, không cần nút duyệt |
| `targetUrl` có giá trị | Backend đã build sẵn deep link — dùng trực tiếp, không cần parse `refType`+`refId` |
| `type: 'TEST'` | Notification test từ admin — `category: EVENT`, không có `refId`/`refType` |
| `type: 'ONLINE_WORK_COMPLETED'` | Đơn WFH hoàn thành — kèm `refType: 'online_work_request'` để navigate |
| `POST /test` không truyền `emailTo` mà `platforms` chứa `'email'` | 400 `emailTo là bắt buộc khi platforms chứa 'email'` |
