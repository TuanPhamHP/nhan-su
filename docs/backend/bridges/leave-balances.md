# Bridge Docs — Số ngày phép (`/v1/leave-balances`)

> Balance chỉ được tạo và điều chỉnh bởi HR/Admin trực tiếp qua database.  
> Hiện API chỉ cho phép employee đọc balance của bản thân.

---

## Endpoints

| Method | Path | Ai được gọi | Ghi chú |
|--------|------|-------------|---------|
| GET | `/v1/leave-balances/me` | `EMPLOYEE` | Số ngày phép còn lại của bản thân (năm hiện tại) |

---

## TypeScript Types

```typescript
// types/leave.types.ts

export interface LeaveBalanceTypeRef {
  id: number;
  name: string;
  code: string;  // 'ANNUAL' | 'HALF_DAY' | 'LATE' | 'EARLY' | ...
}

export interface LeaveBalance {
  id: number;
  leaveType: LeaveBalanceTypeRef;
  year: number;           // năm dương lịch, ví dụ 2026
  totalDays: number;      // tổng ngày phép được cấp trong năm
  usedDays: number;       // số ngày đã dùng (đã approve)
  remainingDays: number;  // computed = totalDays - usedDays (backend tính sẵn)
}
```

---

## GET /v1/leave-balances/me — Số ngày phép của tôi

Trả balance của tất cả loại phép có `daysPerYear != null` cho user hiện tại, trong năm hiện tại.

> Loại phép không giới hạn (`daysPerYear = null`) như HALF_DAY, LATE, EARLY **không có record** trong bảng `leave_balances` và sẽ không xuất hiện ở đây.

**Response:** `ApiSuccess<LeaveBalance[]>`

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "leaveType": { "id": 1, "name": "Nghỉ cả ngày", "code": "ANNUAL" },
      "year": 2026,
      "totalDays": 12,
      "usedDays": 3,
      "remainingDays": 9
    }
  ]
}
```

Response là mảng thẳng (không có `meta` phân trang).

---

## Khi nào balance thay đổi?

| Sự kiện | Thay đổi |
|---|---|
| HR approve đơn `ANNUAL` | `usedDays` tăng theo `totalDays` của đơn |
| Employee tạo đơn (PENDING) | Balance **chưa thay đổi** — chỉ bị trừ khi approve |
| Employee thu hồi đơn PENDING | Balance không đổi (chưa trừ) |

> Không có hoàn trả balance khi thu hồi hoặc reject vì balance chỉ bị trừ tại thời điểm approve.

---

## Hiển thị trên UI

```typescript
// Ví dụ hiển thị thanh progress
const percentage = computed(() =>
  balance.totalDays > 0
    ? Math.round((balance.usedDays / balance.totalDays) * 100)
    : 0,
);
// remainingDays luôn >= 0 (backend validate trước khi create đơn)
```

---

## Composable — useLeaveBalances

```typescript
// composables/useLeaveBalances.ts
import type { LeaveBalance } from '~/types/leave.types';

export function useLeaveBalances() {
  const { get } = useFetch();

  /** EMPLOYEE: lấy số ngày phép còn lại của bản thân */
  const fetchMyBalance = () =>
    get<LeaveBalance[]>('/v1/leave-balances/me');

  return { fetchMyBalance };
}
```

---

## Edge cases

| Tình huống | Kết quả |
|---|---|
| Employee chưa có record balance (HR chưa tạo) | Mảng rỗng `[]` |
| Tạo đơn ANNUAL khi balance record không tồn tại | 400 `LEAVE_INSUFFICIENT_BALANCE` |
| `remainingDays` bằng 0 | Vẫn trả về trong response; tạo đơn mới → 400 |
| HALF_DAY / LATE / EARLY | Không có record balance → không hiển thị ở đây |
