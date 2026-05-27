# Bridge Docs — Kiểm tra Notification Pipeline (`/v1/notifications`)

> Dành riêng cho **ADMIN**. Không hiển thị UI production — dùng Swagger hoặc Postman để test.  
> Xem [notifications.md](./notifications.md) cho các endpoint notification thông thường (in-app, unread-count, mark-read).

---

## Mục đích

Ba endpoint này cho phép admin kiểm tra từng lớp notification pipeline một cách độc lập:

| Platform | Endpoint | Ghi chú |
|----------|----------|---------|
| Tất cả cùng lúc | `POST /v1/notifications/test` | Gửi tới một hoặc nhiều platform trong một lần gọi |
| Chỉ FCM | `POST /v1/notifications/test-fcm` | Gửi raw FCM đến tất cả device token của nhân viên |
| Chỉ Email | `GET /v1/notifications/test-email` | Đưa email test vào queue |

---

## Endpoints

| Method | Path | Roles | Body / Query |
|--------|------|-------|-------------|
| POST | `/v1/notifications/test` | `ADMIN` | JSON body |
| POST | `/v1/notifications/test-fcm` | `ADMIN` | JSON body |
| GET | `/v1/notifications/test-email` | `ADMIN` | Query param `?to=` |

---

## TypeScript Types

```typescript
// types/notification-testing.types.ts

export type NotificationPlatform = 'email' | 'in-app' | 'fcm';

// POST /v1/notifications/test
export interface TestNotificationDto {
  employeeId: number;              // Nhân viên nhận in-app + FCM
  title: string;                   // Tiêu đề (tối thiểu 1 ký tự)
  body: string;                    // Nội dung (tối thiểu 1 ký tự)
  platforms: NotificationPlatform[]; // Tối thiểu 1 platform
  emailTo?: string;                // Bắt buộc khi platforms chứa 'email'
}

export interface PlatformResult {
  sent: boolean;
  detail?: FcmTestResult;  // chỉ có khi platform = 'fcm' và sent = true
  error?: string;          // chỉ có khi sent = false
}

export interface TestNotificationResult {
  platforms: {
    'in-app'?: PlatformResult;
    email?: PlatformResult;
    fcm?: PlatformResult;
  };
}

// POST /v1/notifications/test-fcm
export interface TestFcmDto {
  employeeId: number;
  title: string;
  body: string;
  type?: string;  // mặc định: 'test.manual'
}

export interface FcmTestResult {
  sent: number;           // số device nhận được
  invalidRemoved: number; // số token stale đã xóa khỏi DB
  tokens: string[];       // danh sách token đã gửi thành công
}
```

---

## POST /v1/notifications/test — Gửi tới nhiều platform

Endpoint duy nhất để test toàn bộ pipeline trong một lần gọi. Mỗi platform chạy song song, lỗi một platform không ảnh hưởng các platform khác.

### Gửi cả 3 platform

**Request:**
```json
{
  "employeeId": 1,
  "title": "🧪 Test Notification",
  "body": "Kiểm tra pipeline — in-app, email, và FCM.",
  "platforms": ["in-app", "email", "fcm"],
  "emailTo": "admin@company.com"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "platforms": {
      "in-app": { "sent": true },
      "email":  { "sent": true },
      "fcm":    {
        "sent": true,
        "detail": {
          "sent": 2,
          "invalidRemoved": 0,
          "tokens": ["dGVzdC10b2tlbi0x...", "dGVzdC10b2tlbi0y..."]
        }
      }
    }
  }
}
```

### Gửi chỉ in-app

```json
{
  "employeeId": 1,
  "title": "Test In-App",
  "body": "Kiểm tra notification trong ứng dụng.",
  "platforms": ["in-app"]
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "platforms": {
      "in-app": { "sent": true }
    }
  }
}
```

> `in-app` tự động gửi FCM kèm qua `NotificationCenterService.create()`. Đây là behavior production thực tế — không phải bug.

### Gửi chỉ email

```json
{
  "employeeId": 1,
  "title": "Test Email Subject",
  "body": "Nội dung email kiểm tra.",
  "platforms": ["email"],
  "emailTo": "dev@company.com"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "platforms": {
      "email": { "sent": true }
    }
  }
}
```

### Gửi chỉ FCM (standalone)

```json
{
  "employeeId": 1,
  "title": "Test FCM",
  "body": "Kiểm tra push notification.",
  "platforms": ["fcm"]
}
```

**Response 200 — nhân viên có 1 device:**
```json
{
  "success": true,
  "data": {
    "platforms": {
      "fcm": {
        "sent": true,
        "detail": {
          "sent": 1,
          "invalidRemoved": 0,
          "tokens": ["dGVzdC10b2tlbi0x..."]
        }
      }
    }
  }
}
```

**Response 200 — nhân viên không có device token:**
```json
{
  "success": true,
  "data": {
    "platforms": {
      "fcm": {
        "sent": true,
        "detail": {
          "sent": 0,
          "invalidRemoved": 0,
          "tokens": []
        }
      }
    }
  }
}
```

> `sent: true` ở đây có nghĩa là request thành công xử lý — không phải FCM thực sự được gửi. Xem `detail.sent` để biết số device thực sự nhận được.

### Khi một platform thất bại

Nếu một platform lỗi, các platform khác vẫn tiếp tục. Lỗi được ghi trong `error`, không throw ra HTTP 5xx.

```json
{
  "success": true,
  "data": {
    "platforms": {
      "in-app": { "sent": true },
      "email":  { "sent": false, "error": "Connection refused" },
      "fcm":    { "sent": true, "detail": { "sent": 1, "invalidRemoved": 0, "tokens": ["..."] } }
    }
  }
}
```

---

## POST /v1/notifications/test-fcm — Gửi FCM standalone

Dùng khi muốn test riêng FCM với `type` tùy chỉnh, không tạo in-app notification.

**Request:**
```json
{
  "employeeId": 1,
  "title": "Test FCM Push",
  "body": "Kiểm tra push notification tới mobile app.",
  "type": "test.manual"
}
```

`type` là chuỗi tự do — mobile app dùng để phân loại notification khi nhận FCM.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "sent": 2,
    "invalidRemoved": 1,
    "tokens": ["dGVzdC10b2tlbi0x..."]
  }
}
```

| Field | Ý nghĩa |
|-------|---------|
| `sent` | Số device token gửi thành công |
| `invalidRemoved` | Số token hết hạn / sai — đã xóa khỏi DB |
| `tokens` | Danh sách token đã gửi thành công (không bao gồm token bị xóa) |

---

## GET /v1/notifications/test-email — Gửi email standalone

Đưa email test vào queue, không chờ gửi thực tế.

**Query param:** `?to=dev@company.com`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "message": "Test email đã được queue tới dev@company.com"
  }
}
```

Email nhận được có template cố định:
```
Subject: [Test] HR System email test
Body:    HR System — Email Test ✅
         Email pipeline đang hoạt động bình thường.
         Gửi lúc: 27/05/2026 14:30:00
```

> Endpoint này dùng template `test` (nội dung cố định). Để test với `title`/`body` tùy chỉnh, dùng `POST /notifications/test` với `platforms: ['email']`.

---

## Hành vi của từng platform

### in-app

- Tạo bản ghi `Notification` trong DB với:
  - `category: EVENT`
  - `type: TEST`
  - `actionType: NAVIGATE_ONLY`
- Sau khi lưu DB, tự động gửi FCM kèm đến tất cả device token của `employeeId` (đây là behavior chuẩn production).
- Notification này xuất hiện trong `GET /v1/notifications` của nhân viên đó.

### email

- Đưa job vào BullMQ queue `email` với template `test-raw`.
- `EmailProcessor` nhận job, render HTML với `title` và `body` tùy chỉnh, gửi qua Gmail SMTP.
- Nếu SMTP lỗi → job retry tối đa 3 lần (exponential backoff 5s).
- `sent: true` chỉ có nghĩa là job đã vào queue thành công — không đảm bảo email đến inbox.

### fcm

- Lấy tất cả device token của `employeeId` từ bảng `device_tokens`.
- Gửi Firebase data message tới từng token song song.
- Token stale (Firebase báo `invalid-registration-token`) bị xóa khỏi DB ngay lập tức.
- Trả về `sent`, `invalidRemoved`, `tokens` để debug.

---

## Phân biệt `in-app` vs `fcm` trong `POST /test`

| | `in-app` | `fcm` |
|---|---|---|
| Lưu DB | ✅ Có | ❌ Không |
| Gửi FCM | ✅ Tự động (qua `create()`) | ✅ Có (standalone) |
| Xuất hiện trong `/v1/notifications` | ✅ Có | ❌ Không |
| Dùng khi | Test toàn bộ flow production | Test riêng FCM push mà không tạo record DB |

> **Chọn đồng thời `in-app` + `fcm`** → FCM được gửi 2 lần cho cùng nhân viên. Chỉ nên dùng khi muốn test cả hai path riêng biệt.

---

## Validation Errors

| Điều kiện | HTTP | Message |
|-----------|------|---------|
| `platforms` chứa `'email'` mà không có `emailTo` | 400 | `emailTo là bắt buộc khi platforms chứa 'email'` |
| `platforms` là mảng rỗng `[]` | 400 | Validation failed |
| `platforms` chứa giá trị không hợp lệ, ví dụ `['sms']` | 400 | Validation failed |
| `employeeId` không tồn tại | Không báo lỗi | `in-app` và `fcm` trả `sent: true` nhưng không có gì xảy ra trên DB / FCM |
| `emailTo` không phải email hợp lệ | 400 | Validation failed |
| User không phải `ADMIN` | 403 | Forbidden |

---

## Edge Cases

| Tình huống | Kết quả |
|-----------|---------|
| Nhân viên không có device token | `fcm.sent = 0`, `fcm.tokens = []`, `fcm.sent: true` (không lỗi) |
| Token FCM hết hạn | Gửi thất bại → xóa token → `invalidRemoved` tăng |
| SMTP server không phản hồi | `email.sent: false`, `email.error: "..."` — các platform khác không bị ảnh hưởng |
| `platforms: ['in-app']` | FCM vẫn được gửi kèm (behavior của `create()`) |
| `platforms: ['in-app', 'fcm']` | FCM gửi 2 lần — in-app trigger một lần, fcm standalone thêm một lần |
| `emailTo` hợp lệ nhưng email không tồn tại | SMTP gửi được, inbox bounce — ngoài tầm kiểm soát của server |
| `title`/`body` chứa ký tự đặc biệt HTML | Email renderer escape an toàn, FCM và in-app nhận nguyên bản |
| Gọi nhiều lần liên tiếp | Mỗi lần tạo bản ghi in-app mới — không idempotent |
