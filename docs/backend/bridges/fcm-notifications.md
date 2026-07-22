# Bridge: FCM Push Notifications + In-App Notification

Tài liệu này mô tả toàn bộ flow push notification qua Firebase Cloud Messaging (FCM) và REST API để web/mobile tích hợp.

---

## Kiến trúc tổng quan

```
User check-in/check-out
  → AttendanceService emits event (attendance.checkin / attendance.checkout)
  → NotificationListener (async):
      ├─ Lưu Notification record vào DB
      ├─ Enqueue job vào BullMQ "fcm" queue
      └─ Gửi email nếu đi muộn (checkin.late)
  → FcmProcessor (worker):
      ├─ Lấy DeviceToken[] của employee từ DB
      ├─ Gọi Firebase Admin → sendToDevices()
      └─ Xoá token stale tự động
```

**Quan trọng:** FCM chỉ là tín hiệu đánh thức — client luôn phải fetch `/v1/notifications` hoặc `/v1/notifications/unread-count` để lấy dữ liệu thật. Không tin 100% vào FCM delivery.

---

## 1. Đăng ký Device Token

Sau khi user đăng nhập thành công, client lấy FCM token từ Firebase SDK rồi gọi:

```
POST /v1/device-tokens
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "token": "dKKjt5...<FCM registration token>",
  "platform": "WEB"          // WEB | ANDROID | IOS
}
```

**Response 201:**
```json
{ "success": true, "data": { "message": "Device token registered" } }
```

### Khi nào gọi?
- Sau `signIn` thành công
- Sau khi Firebase SDK refresh token (listener `onTokenRefresh`)
- App foreground lại sau thời gian dài

---

## 2. Huỷ đăng ký Device Token

Gọi khi user logout hoặc uninstall:

```
DELETE /v1/device-tokens?token=<FCM_TOKEN>
Authorization: Bearer <access_token>
```

**Response 200:**
```json
{ "success": true, "data": { "message": "Device token unregistered" } }
```

---

## 3. Nhận FCM Message (client-side)

Server gửi **cả `notification` field VÀ `data` field**:

- **`notification`** (OS-level): khi app **background/killed**, hệ điều hành tự render notification trên status bar/lock screen. User tap → mở app.
- **`data`**: dùng để client (mobile/web) parse và quyết định:
  - Khi **foreground**: render in-app banner thủ công (OS không hiện noti khi app đang mở)
  - Khi user **tap notification**: dùng `category` / `refType` / `id` để navigate đến màn hình tương ứng
  - Gọi API `PATCH /v1/notifications/:notificationId/read` để mark as read (dùng `notificationId`, không phải `id`)

### Shape FCM message:

```json
{
  "notification": {
    "title": "Chấm công vào thành công",
    "body": "Bạn đã check-in lúc 08:32"
  },
  "data": {
    "category": "ATTENDANCE",
    "type": "CHECK_IN",
    "refType": "attendance_record",
    "refId": "123",
    "notificationId": "42",
    "title": "Chấm công vào thành công",
    "body": "Bạn đã check-in lúc 08:32"
  }
}
```

### Field semantics trong `data`:

| Field | Kiểu | Ý nghĩa |
|---|---|---|
| `category` | `NotificationCategory` enum | `EVENT` / `ATTENDANCE` / `LEAVE` / `REQUEST` — mobile route đến tab tương ứng |
| `type` | `NotificationType` enum | event chi tiết, vd. `LEAVE_APPROVED`, `CHECK_IN`, `TEST` |
| `refType` | string | tên entity, vd. `leave_request`, `attendance_record`. `''` nếu không có |
| `refId` | string | **ID entity gốc** để mobile navigate (vd. mở màn hình LeaveDetail/123). `''` nếu không có |
| `notificationId` | string | **ID record Notification** trong DB để mark read. `'0'` nếu là test (không có DB record) |
| `title`, `body` | string | bản sao của `notification.title/body` — foreground in-app banner dùng |

### Foreground vs background flow:

```
Background/killed → OS render notification.title/body → user tap
                     → app mở → RemoteMessage chứa cả `data` → dùng category/refType/id navigate

Foreground (app đang mở) → OS KHÔNG hiện noti → SDK fire onMessage()
                     → app dùng data.title/body để show in-app banner
                     → fetch /v1/notifications/unread-count cập nhật badge
```

### Các giá trị `type` thường gặp:
| type | category | refType | Trigger |
|------|----------|---------|---------|
| `CHECK_IN` | `ATTENDANCE` | `attendance_record` | Employee check-in thành công |
| `CHECK_OUT` | `ATTENDANCE` | `attendance_record` | Employee check-out thành công |
| `LATE` | `ATTENDANCE` | `attendance_record` | Đi muộn |
| `LEAVE_APPROVED` | `LEAVE` | `leave_request` | Đơn phép được duyệt |
| `LEAVE_REJECTED` | `LEAVE` | `leave_request` | Đơn phép bị từ chối |
| `GENERAL_REQUEST_PENDING`  | `REQUEST` | `general_request` | Đơn văn bản được nộp |
| `GENERAL_REQUEST_APPROVED` | `REQUEST` | `general_request` | Đơn văn bản duyệt xong |
| `GENERAL_REQUEST_REJECTED` | `REQUEST` | `general_request` | Đơn văn bản bị từ chối |
| `TEST` | `EVENT` | `''` | Gọi từ admin qua `/v1/notifications/test-fcm` |

Xem full enum: `prisma/schema.prisma → enum NotificationType`.

### Web (Nuxt / Vue) — Firebase JS SDK:
```javascript
import { getMessaging, onMessage } from 'firebase/messaging'

const messaging = getMessaging()

// Foreground: app đang mở → OS không hiện noti, mình tự render từ data
onMessage(messaging, (payload) => {
  const { category, type, refType, id, notificationId, title, body } = payload.data

  notificationStore.fetchUnreadCount()
  showToast({ title, body, onClick: () => navigate({ category, refType, id }) })
})
```

**firebase-messaging-sw.js** (background — không cần tự render notification vì server đã gửi field `notification`, OS xử lý sẵn):
```javascript
importScripts('https://www.gstatic.com/firebasejs/10.x.x/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.x.x/firebase-messaging-compat.js')

firebase.initializeApp({ /* config */ })
firebase.messaging()
// Không cần onBackgroundMessage handler vì server gửi sẵn notification field
```

### Mobile (Flutter):
```dart
// Foreground: OS không hiện noti → app tự render
FirebaseMessaging.onMessage.listen((RemoteMessage message) {
  final data = message.data;
  _showInAppBanner(data['title'], data['body']);
  ref.read(notificationProvider.notifier).fetchUnreadCount();
});

// Khi user tap notification (cả background/killed)
FirebaseMessaging.onMessageOpenedApp.listen((message) {
  _navigateFromPayload(message.data);
});

// Cold start: app được mở từ trạng thái killed do tap notification
FirebaseMessaging.instance.getInitialMessage().then((message) {
  if (message != null) _navigateFromPayload(message.data);
});

void _navigateFromPayload(Map<String, dynamic> data) {
  final category = data['category'];   // "ATTENDANCE" / "LEAVE" / "REQUEST" / "EVENT"
  final refType  = data['refType'];    // "leave_request" / "attendance_record" / ...
  final refId    = data['refId'];      // "123" — entity ID để navigate
  final notificationId = data['notificationId'];  // mark as read sau khi navigate

  switch (refType) {
    case 'leave_request':       Navigator.pushNamed(context, '/leave/$refId'); break;
    case 'attendance_record':   Navigator.pushNamed(context, '/attendance/$refId'); break;
    case 'general_request':     Navigator.pushNamed(context, '/general-requests/$refId'); break;
    default:                    Navigator.pushNamed(context, '/notifications'); break;
  }

  if (notificationId != '0') {
    api.markNotificationRead(int.parse(notificationId));
  }
}
```

---

## 4. REST API — In-App Notifications

Dùng để hiện badge, danh sách thông báo, đánh dấu đọc.

### 4.1 Danh sách thông báo

```
GET /v1/notifications?page=1&limit=20
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 42,
      "type": "attendance.checkin",
      "title": "Chấm công vào thành công",
      "body": "Bạn đã check-in lúc 08:32",
      "payload": { "attendanceId": 123, "lateMinutes": 0 },
      "readAt": null,
      "createdAt": "2025-05-15T01:32:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 }
}
```

### 4.2 Số thông báo chưa đọc (badge)

```
GET /v1/notifications/unread-count
Authorization: Bearer <access_token>
```

**Response:**
```json
{ "success": true, "data": { "unreadCount": 3 } }
```

Poll endpoint này mỗi 30–60s khi app active, hoặc gọi ngay sau khi nhận FCM.

### 4.3 Đánh dấu một thông báo đã đọc

```
PATCH /v1/notifications/:id/read
Authorization: Bearer <access_token>
```

### 4.4 Đánh dấu tất cả đã đọc

```
PATCH /v1/notifications/read-all
Authorization: Bearer <access_token>
```

---

## 5. Environment Variables cần thêm (.env)

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
```

Lấy tại: **Firebase Console → Project Settings → Service Accounts → Generate new private key**

> **Lưu ý `FIREBASE_PRIVATE_KEY`:** copy toàn bộ JSON key, lấy field `private_key`, paste vào .env với dấu `"..."`. Các ký tự xuống dòng giữ nguyên dạng `\n` (không phải newline thật). Server sẽ tự `.replace(/\\n/g, '\n')`.

---

## 6. Cấu trúc file mới

```
src/
├── modules/
│   ├── firebase/
│   │   ├── firebase.module.ts        ← @Global, khởi tạo firebase-admin
│   │   └── firebase.service.ts       ← sendToDevice(), sendToDevices()
│   ├── device-tokens/
│   │   ├── device-tokens.module.ts
│   │   ├── device-tokens.controller.ts   ← POST/DELETE /device-tokens
│   │   ├── device-tokens.service.ts
│   │   ├── device-tokens.repository.ts
│   │   └── dto/register-device-token.dto.ts
│   └── notifications/
│       ├── notification.events.ts        ← AttendanceCheckinEvent, AttendanceCheckoutEvent
│       ├── notification.listener.ts      ← @OnEvent handlers → NotificationCenterService
│       ├── notification.repository.ts    ← CRUD Notification table
│       ├── dto/query-notification.dto.ts
│       └── transformers/notification.transformer.ts
```

> **Note**: FCM gửi đồng bộ trong `NotificationCenterService.sendFcm()` (không qua BullMQ queue). Trước đây có `fcm.processor.ts` BullMQ worker nhưng là dead code đã xoá — không có producer nào enqueue.

---

## 7. Thêm event type mới

Để thêm push cho leave.approved, leave.rejected, v.v.:

1. **Thêm event class** vào `notification.events.ts`:
```typescript
export class LeaveApprovedEvent {
  static readonly EVENT = 'leave.approved';
  employeeId: number;
  leaveId: number;
  startDate: Date;
  endDate: Date;
  totalDays: number;
}
```

2. **Emit từ LeaveService** sau khi approve:
```typescript
const event = new LeaveApprovedEvent();
event.employeeId = leave.employeeId;
// ...fill fields
this.eventEmitter.emit(LeaveApprovedEvent.EVENT, event);
```

3. **Thêm handler** trong `NotificationListener`:
```typescript
@OnEvent(LeaveApprovedEvent.EVENT, { async: true })
async handleLeaveApproved(event: LeaveApprovedEvent) {
  // tương tự handleCheckin
}
```
