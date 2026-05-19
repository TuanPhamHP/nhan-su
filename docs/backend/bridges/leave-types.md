# Bridge Docs — Loại phép (`/v1/leave-types`)

> Đọc [leave-requests.md](./leave-requests.md) để biết cách `leaveType.code` ảnh hưởng đến form tạo đơn.

---

## Endpoints

| Method | Path | Ai được gọi | Ghi chú |
|--------|------|-------------|---------|
| GET | `/v1/leave-types` | Mọi user đã đăng nhập | Chỉ trả loại đang `isActive = true` |

> Hiện chưa có endpoints create/update/delete leave types qua API. Quản lý trực tiếp qua database hoặc seed script.

---

## TypeScript Types

```typescript
// types/leave.types.ts

export type LeaveTypeCode = 'ANNUAL' | 'HALF_DAY' | 'LATE' | 'EARLY' | string;

export interface LeaveType {
  id: number;
  name: string;
  code: LeaveTypeCode;
  daysPerYear: number | null;  // null = loại phép không giới hạn số ngày (HALF_DAY, LATE, EARLY)
  isPaid: boolean;
  isActive: boolean;
}
```

---

## GET /v1/leave-types — Danh sách loại phép

Trả tất cả loại phép đang active, sắp xếp theo tên A–Z.

**Response:** `ApiSuccess<LeaveType[]>`

```json
{
  "success": true,
  "data": [
    {
      "id": 3,
      "name": "Đi muộn",
      "code": "LATE",
      "daysPerYear": null,
      "isPaid": true,
      "isActive": true
    },
    {
      "id": 1,
      "name": "Nghỉ cả ngày",
      "code": "ANNUAL",
      "daysPerYear": 12,
      "isPaid": true,
      "isActive": true
    },
    {
      "id": 2,
      "name": "Nghỉ nửa ngày",
      "code": "HALF_DAY",
      "daysPerYear": null,
      "isPaid": true,
      "isActive": true
    },
    {
      "id": 4,
      "name": "Về sớm",
      "code": "EARLY",
      "daysPerYear": null,
      "isPaid": true,
      "isActive": true
    }
  ]
}
```

> Response là mảng thẳng (không có `meta` phân trang) vì đây là danh sách static ít thay đổi.

---

## Ý nghĩa từng field

| Field | Mô tả |
|---|---|
| `code` | Định danh kỹ thuật — dùng để switch form phía frontend |
| `daysPerYear` | Số ngày phép tối đa mỗi năm; `null` = không giới hạn, không kiểm tra balance |
| `isPaid` | `true` = nghỉ có hưởng lương (hiển thị badge) |
| `isActive` | `false` = ẩn khỏi danh sách (không trả về qua API) |

---

## Dùng `code` để render form

```typescript
// Trong component tạo đơn
const selectedType = ref<LeaveType | null>(null);

const showHalfDayPicker = computed(() => selectedType.value?.code === 'HALF_DAY');
const showLateInput     = computed(() => selectedType.value?.code === 'LATE');
const showEarlyInput    = computed(() => selectedType.value?.code === 'EARLY');
const showDateRange     = computed(() => selectedType.value?.code === 'ANNUAL');
```

---

## Composable — useLeaveTypes

```typescript
// composables/useLeaveTypes.ts
import type { LeaveType } from '~/types/leave.types';

export function useLeaveTypes() {
  const { get } = useFetch();

  /** Lấy danh sách loại phép đang active */
  const fetchLeaveTypes = () =>
    get<LeaveType[]>('/v1/leave-types');

  return { fetchLeaveTypes };
}
```

---

## Seed data mặc định

Sau khi chạy `npx prisma db seed`, hệ thống có sẵn 4 loại phép:

| `code` | `name` | `daysPerYear` | Ghi chú |
|---|---|---|---|
| `ANNUAL` | Nghỉ cả ngày | `12` | Trừ ngày phép, kiểm tra balance |
| `HALF_DAY` | Nghỉ nửa ngày | `null` | Trừ 0.5 ngày, không giới hạn |
| `LATE` | Đi muộn | `null` | Không trừ ngày phép |
| `EARLY` | Về sớm | `null` | Không trừ ngày phép |
