# Bridge Docs — Ca làm việc & Lịch ca (`/v1/work-shifts`, `/v1/shift-schedules`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.  
> Xem [attendance-overview.md](./attendance-overview.md) để hiểu big picture.

---

## Endpoints

### Nhóm 1 — WorkShift (khuôn ca cố định)

> ⚠️ **Chưa implement:** Các endpoint `/v1/work-shifts` chưa tồn tại trong hệ thống hiện tại.  
> WorkShift hiện được tạo qua Prisma seed hoặc trực tiếp qua DB. CRUD endpoint sẽ bổ sung ở sprint sau.

| Method | Path | Ai được gọi | Trạng thái |
|--------|------|-------------|-----------|
| GET | `/v1/work-shifts` | Mọi authenticated | ⚠️ Chưa implement |
| POST | `/v1/work-shifts` | `ADMIN`, `HR` | ⚠️ Chưa implement |
| PATCH | `/v1/work-shifts/:id` | `ADMIN`, `HR` | ⚠️ Chưa implement |
| DELETE | `/v1/work-shifts/:id` | `ADMIN`, `HR` | ⚠️ Chưa implement |

### Nhóm 2 — ShiftSchedule (gán ca theo ngày)

| Method | Path | Ai được gọi | Ghi chú |
|--------|------|-------------|---------|
| GET | `/v1/shift-schedules/me` | `EMPLOYEE` | Lịch ca của tôi (mặc định: tuần hiện tại) |
| GET | `/v1/shift-schedules` | `ADMIN`, `HR` | Lịch ca toàn công ty |
| POST | `/v1/shift-schedules` | `ADMIN`, `HR` | Gán ca 1 ngày cho 1 nhân viên |
| POST | `/v1/shift-schedules/bulk` | `ADMIN`, `HR` | Gán ca hàng loạt (tối đa 100 mục) |
| PATCH | `/v1/shift-schedules/employees/:employeeId/default-shift` | `ADMIN`, `HR` | Gán ca mặc định hàng ngày |
| DELETE | `/v1/shift-schedules/:employeeId/:date` | `ADMIN`, `HR` | Xóa lịch ca theo ngày |

> **Lưu ý thứ tự route:** `/shift-schedules/me` được khai báo **trước** `/shift-schedules` trong controller.

---

## TypeScript Types

```typescript
// types/shift.types.ts

// Shape của object "shift" lồng trong ShiftScheduleResponse
export interface WorkShiftSummary {
  id: number;
  name: string;
  checkInTime: string;    // "HH:mm" — giờ bắt đầu, UTC, ví dụ "08:00"
  checkOutTime: string;   // "HH:mm" — giờ kết thúc, UTC, ví dụ "17:00"
  workDays: number[];     // ISO weekday: 1=Thứ 2, 2=Thứ 3, ..., 7=Chủ nhật
}

// Response từ GET /shift-schedules và GET /shift-schedules/me
export interface ShiftScheduleResponse {
  id: number;
  date: string;   // "YYYY-MM-DD"
  employee: {
    id: number;
    fullName: string;
    employeeCode: string;
  };
  shift: WorkShiftSummary;
}

// POST /shift-schedules request
export interface AssignShiftDto {
  employeeId: number;
  shiftId: number;
  date: string;           // "YYYY-MM-DD"
}

// POST /shift-schedules/bulk request
export interface BulkAssignShiftDto {
  assignments: AssignShiftDto[];   // tối đa 100 phần tử
}

// PATCH /shift-schedules/employees/:id/default-shift request
export interface SetDefaultShiftDto {
  shiftId: number;
}

// Query params cho GET / và GET /me
export interface QueryShiftScheduleParams {
  employeeId?: number;
  departmentId?: number;
  startDate?: string;     // "YYYY-MM-DD" — mặc định đầu tuần hiện tại
  endDate?: string;       // "YYYY-MM-DD" — mặc định cuối tuần hiện tại
}
```

> **Quan trọng về `checkInTime`/`checkOutTime`:**  
> Server lưu dạng `TIME WITHOUT TIME ZONE` trong PostgreSQL (`@db.Time`), trả về string `"HH:mm"` đã format theo UTC.  
> Dùng trực tiếp để hiển thị — không cần parse thêm.

> **`workDays` convention:** ISO weekday — `1 = Thứ 2`, `7 = Chủ nhật`.  
> Ví dụ: `[1,2,3,4,5]` = Thứ 2 đến Thứ 6.

---

## Hiểu về luồng ca làm việc

```
WorkShift (khuôn ca — HR tạo, cố định)
    │
    ├──► Employee.defaultShiftId
    │         Ca áp dụng mọi ngày nếu không có override cụ thể
    │
    └──► EmployeeShiftSchedule (override ca cho 1 ngày cụ thể)
              │
              ▼
         Server resolve khi employee check-in:
         1. Có EmployeeShiftSchedule cho ngày hôm nay? → dùng ca đó
         2. Không có? → dùng Employee.defaultShiftId
         3. Không có cả hai? → NO_SHIFT_TODAY (check-in thất bại)
              │
              ▼ (nếu tìm được ca)
         EffectiveShiftOverride
              Hệ thống tự tạo khi HR duyệt đơn nghỉ nửa ngày
              Thu hẹp cửa sổ giờ làm việc (sáng hoặc chiều)
              Frontend chỉ đọc — không tạo trực tiếp
              │
              ▼
         AttendanceRecord
              isHalfDay: true  → có EffectiveShiftOverride
              isHalfDay: false → ca bình thường
```

**Frontend cần làm:**
- Gọi `GET /shift-schedules/me` để hiển thị lịch ca tuần này
- HR gọi `POST /shift-schedules` hoặc `POST /shift-schedules/bulk` để gán ca
- HR gọi `PATCH .../default-shift` để gán ca mặc định cho nhân viên mới
- `EffectiveShiftOverride` — **không thao tác trực tiếp** — đọc qua `isHalfDay`/`effectiveStart`/`effectiveEnd` trong `AttendanceRecord`

---

## GET /v1/shift-schedules/me — Lịch ca của tôi

**Query params:** `?startDate=2026-05-12&endDate=2026-05-18`  
Mặc định nếu không truyền: từ đầu đến cuối tuần hiện tại.

**Response:** `ApiSuccess<ShiftScheduleResponse[]>`

```json
{
  "success": true,
  "data": [
    {
      "id": 5,
      "date": "2026-05-12",
      "employee": {
        "id": 4,
        "fullName": "Nguyễn Văn An",
        "employeeCode": "EMP004"
      },
      "shift": {
        "id": 1,
        "name": "Ca sáng",
        "checkInTime": "08:00",
        "checkOutTime": "17:00",
        "workDays": [1, 2, 3, 4, 5]
      }
    },
    {
      "id": 6,
      "date": "2026-05-13",
      "employee": {
        "id": 4,
        "fullName": "Nguyễn Văn An",
        "employeeCode": "EMP004"
      },
      "shift": {
        "id": 1,
        "name": "Ca sáng",
        "checkInTime": "08:00",
        "checkOutTime": "17:00",
        "workDays": [1, 2, 3, 4, 5]
      }
    }
  ]
}
```

> Response không có `meta` phân trang — trả toàn bộ lịch ca trong khoảng ngày.

---

## GET /v1/shift-schedules — Lịch ca toàn công ty

Chỉ `ADMIN` và `HR` được gọi.

**Query params:** `?startDate=2026-05-12&endDate=2026-05-18&employeeId=4&departmentId=1`

**Response:** `ApiSuccess<ShiftScheduleResponse[]>` — shape giống `/me`

---

## POST /v1/shift-schedules — Gán ca 1 ngày

Nếu nhân viên đã có lịch ca cho ngày đó → **upsert** (ghi đè, không báo lỗi).

**Request body:**
```json
{
  "employeeId": 4,
  "shiftId": 1,
  "date": "2026-05-20"
}
```

**Response 201:** `ApiSuccess<ShiftScheduleResponse>`

```json
{
  "success": true,
  "data": {
    "id": 10,
    "date": "2026-05-20",
    "employee": {
      "id": 4,
      "fullName": "Nguyễn Văn An",
      "employeeCode": "EMP004"
    },
    "shift": {
      "id": 1,
      "name": "Ca sáng",
      "checkInTime": "08:00",
      "checkOutTime": "17:00",
      "workDays": [1, 2, 3, 4, 5]
    }
  }
}
```

**404** nếu nhân viên hoặc ca không tồn tại:
```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Nhân viên hoặc ca làm việc không tồn tại" } }
```

---

## POST /v1/shift-schedules/bulk — Gán ca hàng loạt

Tối đa 100 mục trong một request. Gán cho nhiều nhân viên và/hoặc nhiều ngày.

**Request body:**
```json
{
  "assignments": [
    { "employeeId": 4, "shiftId": 1, "date": "2026-05-19" },
    { "employeeId": 4, "shiftId": 1, "date": "2026-05-20" },
    { "employeeId": 5, "shiftId": 2, "date": "2026-05-19" }
  ]
}
```

**Response 201: No Content** (void — không trả data)

**400** nếu vượt quá 100 mục:
```json
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "assignments must contain no more than 100 elements" } }
```

---

## PATCH /v1/shift-schedules/employees/:employeeId/default-shift — Gán ca mặc định

Gán ca mặc định cho nhân viên. Ca này được áp dụng cho mọi ngày không có lịch ca cụ thể.

**Ví dụ:** `PATCH /v1/shift-schedules/employees/4/default-shift`

**Request body:**
```json
{ "shiftId": 1 }
```

**Response 200: No Content** (void)

**404** nếu nhân viên hoặc ca không tồn tại:
```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Nhân viên không tồn tại" } }
```

---

## DELETE /v1/shift-schedules/:employeeId/:date — Xóa lịch ca theo ngày

Xóa override ca của một ngày cụ thể. Sau khi xóa, hệ thống fallback về `defaultShiftId` của nhân viên.

**Ví dụ:** `DELETE /v1/shift-schedules/4/2026-05-20`

**Response: 204 No Content**

**404** nếu không tìm thấy lịch ca:
```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Lịch ca không tồn tại" } }
```

---

## Composable — useShiftSchedules

```typescript
// composables/useShiftSchedules.ts
import type {
  ShiftScheduleResponse,
  AssignShiftDto,
  BulkAssignShiftDto,
  SetDefaultShiftDto,
  QueryShiftScheduleParams,
} from '~/types/shift.types';

export function useShiftSchedules() {
  const { get, post, patch, del } = useFetch();

  const fetchMySchedule = (params?: QueryShiftScheduleParams) =>
    get<ShiftScheduleResponse[]>('/v1/shift-schedules/me', { params });

  const fetchSchedules = (params?: QueryShiftScheduleParams) =>
    get<ShiftScheduleResponse[]>('/v1/shift-schedules', { params });

  const assignShift = (dto: AssignShiftDto) =>
    post<ShiftScheduleResponse>('/v1/shift-schedules', dto);

  const bulkAssign = (dto: BulkAssignShiftDto) =>
    post<void>('/v1/shift-schedules/bulk', dto);

  const setDefaultShift = (employeeId: number, dto: SetDefaultShiftDto) =>
    patch<void>(`/v1/shift-schedules/employees/${employeeId}/default-shift`, dto);

  const removeShift = (employeeId: number, date: string) =>
    del(`/v1/shift-schedules/${employeeId}/${date}`);

  return {
    fetchMySchedule,
    fetchSchedules,
    assignShift,
    bulkAssign,
    setDefaultShift,
    removeShift,
  };
}
```

---

## Edge cases

| Tình huống | Kết quả |
|-----------|---------|
| `EMPLOYEE` gọi `GET /shift-schedules` | 403 Forbidden |
| Gán ca cho ngày đã có lịch ca | Upsert — ghi đè, không báo lỗi |
| `bulk` với > 100 mục | 400 Bad Request |
| `date` truyền sai format (không phải `YYYY-MM-DD`) | 400 Bad Request |
| Xóa lịch ca ngày đó → nhân viên còn `defaultShiftId` | Hệ thống dùng `defaultShift` khi check-in |
| Xóa lịch ca ngày đó → nhân viên không có `defaultShiftId` | `NO_SHIFT_TODAY` khi check-in |
| `PATCH default-shift` với `shiftId` không tồn tại | 404 Not Found |
| `workDays: [1,2,3,4,5]` | Thứ 2 đến Thứ 6 |
| `workDays: [7]` | Chủ nhật |
| Không truyền `startDate`/`endDate` cho `/me` | Server mặc định tuần hiện tại (Thứ 2 → Chủ nhật) |
