# FE Agent Prompt — Update form Test FCM với 3 field mới

## Context

BE đã mở rộng endpoint `POST /v1/notifications/test-fcm` để admin có thể test FCM với đầy đủ payload navigation (category, refType, id) — giống payload thực tế khi BE gửi notification production. Hiện tại form trên FE chỉ có 4 field (Employee ID, Type, Title, Body), thiếu 3 field navigation → mobile test luôn nhận `refType=''` và `id=''` → không verify được flow tap-notification-to-navigate.

Cần update form để admin test đầy đủ payload trước khi production go-live.

## Endpoint

`POST /v1/notifications/test-fcm` — Admin only, đã có ApiBearerAuth.

## Request DTO (TypeScript)

```typescript
export interface TestFcmDto {
  // Đã có
  employeeId: number;        // required, integer >= 1
  title: string;             // required, min 1 char
  body: string;              // required, min 1 char

  // Đã có nhưng cần đổi sang dropdown enum
  type?: NotificationType;   // optional, default 'TEST', NotificationType enum

  // ─── NEW — cần thêm 3 field ───
  category?: NotificationCategory;  // optional, default 'EVENT', enum
  refType?: string;                 // optional, default '', free text
  id?: string;                      // optional, default '', free text (entity ID dạng string)
}
```

## Enums

```typescript
export enum NotificationCategory {
  EVENT = 'EVENT',
  ATTENDANCE = 'ATTENDANCE',
  LEAVE = 'LEAVE',
  REQUEST = 'REQUEST',
}

export enum NotificationType {
  CHECK_IN = 'CHECK_IN',
  CHECK_OUT = 'CHECK_OUT',
  LATE = 'LATE',
  ABSENT = 'ABSENT',
  MISSING_CHECKOUT = 'MISSING_CHECKOUT',
  CHECKIN_REMINDER = 'CHECKIN_REMINDER',
  CHECKOUT_REMINDER = 'CHECKOUT_REMINDER',
  LEAVE_CREATED = 'LEAVE_CREATED',
  LEAVE_APPROVED = 'LEAVE_APPROVED',
  LEAVE_REJECTED = 'LEAVE_REJECTED',
  LEAVE_CANCELLED = 'LEAVE_CANCELLED',
  LEAVE_AUTO_CANCELLED = 'LEAVE_AUTO_CANCELLED',
  OT_CREATED = 'OT_CREATED',
  OT_APPROVED = 'OT_APPROVED',
  OT_REJECTED = 'OT_REJECTED',
  OT_CANCELLED = 'OT_CANCELLED',
  OT_AUTO_CANCELLED = 'OT_AUTO_CANCELLED',
  VIOLATION_CREATED = 'VIOLATION_CREATED',
  VIOLATION_APPROVED = 'VIOLATION_APPROVED',
  VIOLATION_REJECTED = 'VIOLATION_REJECTED',
  ONLINE_WORK_CREATED = 'ONLINE_WORK_CREATED',
  ONLINE_WORK_APPROVED = 'ONLINE_WORK_APPROVED',
  ONLINE_WORK_REJECTED = 'ONLINE_WORK_REJECTED',
  ONLINE_WORK_CANCELLED = 'ONLINE_WORK_CANCELLED',
  ONLINE_WORK_COMPLETED = 'ONLINE_WORK_COMPLETED',
  MAKEUP_CREATED = 'MAKEUP_CREATED',
  MAKEUP_APPROVED = 'MAKEUP_APPROVED',
  MAKEUP_REJECTED = 'MAKEUP_REJECTED',
  CONTRACT_EXPIRY_WARNING = 'CONTRACT_EXPIRY_WARNING',
  BUSINESS_TRIP_PENDING = 'BUSINESS_TRIP_PENDING',
  BUSINESS_TRIP_APPROVED = 'BUSINESS_TRIP_APPROVED',
  BUSINESS_TRIP_REJECTED = 'BUSINESS_TRIP_REJECTED',
  GENERAL_REQUEST_PENDING = 'GENERAL_REQUEST_PENDING',
  GENERAL_REQUEST_APPROVED = 'GENERAL_REQUEST_APPROVED',
  GENERAL_REQUEST_REJECTED = 'GENERAL_REQUEST_REJECTED',
  GENERAL_REQUEST_CANCELLED = 'GENERAL_REQUEST_CANCELLED',
  TEST = 'TEST',
}
```

## Layout form đề xuất

Bố cục dạng grid 2 cột (tận dụng không gian), tham khảo form hiện tại:

```
┌──────────────────────────────────────────────────────────────┐
│ Test Notification Pipeline > /v1/notifications/test-fcm     │
├──────────────────────────────────────────────────────────────┤
│  Employee ID *        │  Type             [dropdown enum]    │
│  [ 9               ]  │  [ TEST              ▼ ]             │
│                                                              │
│  Title *                                                     │
│  [ ✅ Phiếu giải trình được chấp thuận                    ]  │
│                                                              │
│  Body *                                                      │
│  [ Phiếu Đi muộn ngày 22/06/2026 đã được duyệt          ]  │
│                                                              │
│  ┌─── Navigation payload (optional) ──────────────────────┐  │
│  │  Category          [dropdown enum]                     │  │
│  │  [ EVENT              ▼ ]                              │  │
│  │                                                        │  │
│  │  refType                       │  id (entity ID)       │  │
│  │  [ violation_request        ]  │  [ 42              ]  │  │
│  │                                                        │  │
│  │  💡 Mobile dùng để navigate khi user tap notification │  │
│  │     Để rỗng nếu chỉ test display, không cần navigate. │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  [ Gửi FCM ]                                                 │
└──────────────────────────────────────────────────────────────┘
```

## Yêu cầu UX cụ thể

### 1. Type field — đổi từ free text sang dropdown enum

Hiện tại Type là text input → đổi thành **dropdown** load enum `NotificationType` (38 values). Show full enum value (vd. `LEAVE_APPROVED`). Default = `TEST`.

### 2. Category field — dropdown enum, mới thêm

- Dropdown 4 options: `EVENT`, `ATTENDANCE`, `LEAVE`, `REQUEST`
- Default: `EVENT`
- Helper text: "Tab nào trên mobile sẽ hiển thị notification (vd. LEAVE → tab nghỉ phép)"

### 3. refType field — text input, mới thêm

- Text input, optional, default empty
- Placeholder: `violation_request, leave_request, attendance_record, ...`
- Helper text: "Tên entity. Để rỗng nếu test attendance reminder/late."

### 4. id field — text input, mới thêm

- Text input, optional, default empty
- Placeholder: `42` (string số)
- Helper text: "ID entity để mobile mở detail screen. Để rỗng nếu không cần navigate."

### 5. Validation

Không bắt buộc validate cứng (BE đã default empty). Nhưng có thể warn UX nếu **chỉ điền 1 trong 2** (refType có id rỗng hoặc ngược lại) — vì navigate cần cả 2 mới có ý nghĩa:

> ⚠️ Nên điền cả `refType` và `id` cùng lúc, hoặc bỏ trống cả 2.

### 6. Preset templates (nice-to-have)

Thêm dropdown nhỏ "Preset" để admin chọn template có sẵn, auto-fill 5 field navigation:

| Preset | type | category | refType | id (placeholder) |
|---|---|---|---|---|
| Test Leave Approved | LEAVE_APPROVED | LEAVE | leave_request | 1 |
| Test OT Approved | OT_APPROVED | EVENT | overtime_request | 1 |
| Test Violation Approved | VIOLATION_APPROVED | EVENT | violation_request | 1 |
| Test Check-in Reminder | CHECKIN_REMINDER | ATTENDANCE | (empty) | (empty) |
| Custom (manual) | — | — | — | — |

Khi chọn preset → auto-fill các field, admin chỉ cần điền Employee ID + sửa id nếu cần.

## Sample request body sau update

```json
POST /v1/notifications/test-fcm
{
  "employeeId": 9,
  "title": "✅ Phiếu giải trình được chấp thuận",
  "body": "Phiếu Đi muộn ngày 22/06/2026 đã được duyệt",
  "type": "VIOLATION_APPROVED",
  "category": "EVENT",
  "refType": "violation_request",
  "id": "42"
}
```

## Sample response (không đổi)

```json
{
  "success": true,
  "data": {
    "sent": 1,
    "invalidRemoved": 0,
    "tokens": ["ci9HOps..."]
  }
}
```

## Mobile sẽ nhận FCM với payload

```json
{
  "notification": {
    "title": "✅ Phiếu giải trình được chấp thuận",
    "body": "Phiếu Đi muộn ngày 22/06/2026 đã được duyệt"
  },
  "data": {
    "category": "EVENT",
    "type": "VIOLATION_APPROVED",
    "refType": "violation_request",
    "id": "42",
    "notificationId": "0",
    "title": "✅ Phiếu giải trình được chấp thuận",
    "body": "Phiếu Đi muộn ngày 22/06/2026 đã được duyệt"
  }
}
```

Mobile dev verify nhận được đúng `category/type/refType/id` để confirm navigation logic.

## Checklist trước khi merge FE PR

- [ ] Field `Type` đổi từ text input sang dropdown load `NotificationType` enum (38 options)
- [ ] Thêm field `Category` dropdown load `NotificationCategory` enum (4 options), default `EVENT`
- [ ] Thêm field `refType` text input optional
- [ ] Thêm field `id` text input optional
- [ ] Helper text giải thích từng field
- [ ] (Nice-to-have) Preset dropdown auto-fill template
- [ ] Form submit gửi đủ 7 field trong JSON body
- [ ] Field optional không gửi nếu user để rỗng (hoặc gửi empty string — cả 2 đều OK với BE)

## Tham khảo

- Bridge docs full FCM payload + flow: [docs/bridges/fcm-notifications.md](./fcm-notifications.md)
- JSON mapping type → screen mobile dùng: [docs/bridges/fcm-notification-routing.json](./fcm-notification-routing.json)
- Swagger live: `https://hrs-main.sonthanh.net.vn/api/docs#/notifications/NotificationsController_testFcm`
