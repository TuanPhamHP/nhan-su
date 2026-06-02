# Bridge Docs — Dashboard (`/v1/dashboard`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.

---

## Endpoints

| Method | Path | Ai được gọi | Ghi chú |
|--------|------|-------------|---------|
| GET | `/v1/dashboard` | Mọi user đã đăng nhập | Tự động trả đúng loại dựa theo role |

> Một endpoint duy nhất — server đọc role từ JWT và trả về 3 kiểu response khác nhau.  
> **Không truyền query params.** Toàn bộ số liệu được tính theo `ngày hôm nay` (server time) và identity người gọi.

---

## Role Routing

| Role | Response type | Phạm vi dữ liệu |
|------|---------------|-----------------|
| `ADMIN`, `HR`, `CHIEF` | `CompanyDashboardResponse` | Toàn công ty |
| `MANAGER` | `DepartmentDashboardResponse` | Phòng ban mà user đang quản lý |
| `EMPLOYEE` | `MyDashboardResponse` | Chỉ cá nhân |

> **`MANAGER` chưa được gán phòng ban** (chưa là `managerId` của bất kỳ phòng ban nào) → **400 Bad Request**.

---

## TypeScript Types

```typescript
// types/dashboard.types.ts

// ─── Shared ──────────────────────────────────────────────────────────────────

export type ActivityType = 'leave' | 'overtime' | 'violation' | 'online_work' | 'makeup';

export interface ActivityItem {
  id: number;
  type: ActivityType;
  typeLabel: string;      // "Nghỉ phép (Phép năm)" | "Tăng ca" | "Vi phạm chuyên cần" | "Làm việc online" | "Bổ sung chấm công"
  action: string;         // "Vừa tạo" | "Chờ duyệt" | "Đã duyệt" | "Đã từ chối" | "Đã huỷ"
  employeeName: string;
  employeeCode: string;
  status: string;         // giá trị raw từ enum (PENDING, APPROVED, PENDING_L1, ...)
  statusLabel: string;    // text hiển thị (xem bảng Status Labels)
  createdAt: string;      // ISO 8601
  targetUrl: string;      // path để navigate khi click, ví dụ "/leave-requests/5"
}

// ─── HR / ADMIN / CHIEF ───────────────────────────────────────────────────────

export interface CompanyStats {
  totalEmployees: number;       // tổng nhân viên ACTIVE
  checkedInToday: number;       // đã có checkInAt hôm nay
  checkedInRate: number;        // % = checkedInToday / totalEmployees * 100, đã làm tròn
  pendingLeave: number;         // đơn nghỉ phép PENDING
  pendingOT: number;            // đơn tăng ca PENDING
  pendingViolation: number;     // đơn vi phạm PENDING
  pendingOnlineWork: number;    // đơn online work PENDING_L1 + L2 + L3
  totalDepartments: number;     // phòng ban đang isActive = true
  lateToday: number;            // bản ghi chấm công LATE hôm nay
  absentToday: number;          // bản ghi chấm công ABSENT hôm nay
}

export interface CompanyDashboardResponse {
  stats: CompanyStats;
  recentActivity: ActivityItem[];   // 10 hoạt động gần nhất (mọi loại, toàn công ty)
  generatedAt: string;              // ISO 8601 — thời điểm server tạo response
}

// ─── MANAGER ─────────────────────────────────────────────────────────────────

export interface DepartmentStats extends CompanyStats {
  departmentName: string;       // tên phòng ban
  totalMembersInDept: number;   // số nhân viên ACTIVE trong phòng ban
  // checkedInRate ở đây = checkedInToday / totalMembersInDept * 100
  // totalDepartments luôn = 1 (chỉ phòng ban của mình)
}

export interface DepartmentDashboardResponse {
  stats: DepartmentStats;
  recentActivity: ActivityItem[];   // 10 hoạt động gần nhất trong phòng ban
  generatedAt: string;
}

// ─── EMPLOYEE ────────────────────────────────────────────────────────────────

export interface LeaveBalance {
  totalDays: number;        // hạn mức phép năm (ANNUAL) trong năm hiện tại
  usedDays: number;         // số ngày đã dùng
  remainingDays: number;    // = totalDays - usedDays
}

export interface MyStats {
  isCheckedInToday: boolean;        // đã check-in hôm nay chưa
  isCheckedOutToday: boolean;       // đã check-out hôm nay chưa
  leaveBalance: LeaveBalance | null; // null nếu chưa được khởi tạo leave balance năm nay
  pendingLeaveRequests: number;     // đơn nghỉ phép của mình đang PENDING
  lateCountThisMonth: number;       // số lần đi muộn trong tháng hiện tại
  absentCountThisMonth: number;     // số lần vắng trong tháng hiện tại
  pendingOT: number;                // đơn tăng ca của mình đang PENDING
}

export interface MyDashboardResponse {
  stats: MyStats;
  recentActivity: ActivityItem[];   // 10 hoạt động gần nhất liên quan đến mình
  generatedAt: string;
}

// ─── Union (khi chưa biết role) ───────────────────────────────────────────────

export type DashboardResponse =
  | CompanyDashboardResponse
  | DepartmentDashboardResponse
  | MyDashboardResponse;
```

---

### Status Labels cho `ActivityItem`

| `status` (raw) | `statusLabel` |
|----------------|---------------|
| `PENDING` | Chờ duyệt |
| `PENDING_L1` | Chờ duyệt L1 |
| `PENDING_L2` | Chờ duyệt L2 |
| `PENDING_L3` | Chờ duyệt L3 |
| `APPROVED` | Đã duyệt |
| `REJECTED` | Đã từ chối |
| `CANCELLED` | Đã huỷ |
| `AUTO_CANCELLED` | Tự huỷ |
| `COMPLETED` | Hoàn thành |

### Action Labels cho `ActivityItem`

| `status` (raw) | `action` |
|----------------|----------|
| `PENDING`, `PENDING_L1` | Vừa tạo |
| `PENDING_L2`, `PENDING_L3` | Chờ duyệt |
| `APPROVED`, `COMPLETED` | Đã duyệt |
| `REJECTED` | Đã từ chối |
| `CANCELLED`, `AUTO_CANCELLED` | Đã huỷ |

---

## Recent Activity

`recentActivity` là mảng tối đa 10 phần tử, **đã sắp xếp theo `createdAt` giảm dần** (mới nhất đứng đầu).

Mỗi item bao gồm 5 loại:

| `type` | `typeLabel` | `targetUrl` |
|--------|-------------|-------------|
| `leave` | `Nghỉ phép (<tên loại phép>)` | `/leave-requests/:id` |
| `overtime` | `Tăng ca` | `/overtime-requests/:id` |
| `violation` | `Vi phạm chuyên cần` | `/violation-requests/:id` |
| `online_work` | `Làm việc online` | `/online-work-requests/:id` |
| `makeup` | `Bổ sung chấm công` | `/makeup-attendance/:id` |

> `targetUrl` là **relative path** (không có domain). Dùng để navigate bằng router:
> ```ts
> router.push(item.targetUrl)
> ```

### `recentActivity` theo role

| Role | Phạm vi activity |
|------|------------------|
| `ADMIN`, `HR`, `CHIEF` | Toàn bộ công ty — 10 bản ghi mới nhất qua 5 loại |
| `MANAGER` | Chỉ nhân viên thuộc phòng ban mình quản lý |
| `EMPLOYEE` | Đơn của mình + đơn đang chờ mình duyệt (nếu là manager/approver) |

---

## Response Examples

### HR / ADMIN / CHIEF

```json
{
  "success": true,
  "data": {
    "stats": {
      "totalEmployees": 48,
      "checkedInToday": 36,
      "checkedInRate": 75,
      "pendingLeave": 3,
      "pendingOT": 5,
      "pendingViolation": 2,
      "pendingOnlineWork": 4,
      "totalDepartments": 6,
      "lateToday": 4,
      "absentToday": 8
    },
    "recentActivity": [
      {
        "id": 42,
        "type": "leave",
        "typeLabel": "Nghỉ phép (Phép năm)",
        "action": "Vừa tạo",
        "employeeName": "Nguyễn Văn A",
        "employeeCode": "EMP012",
        "status": "PENDING",
        "statusLabel": "Chờ duyệt",
        "createdAt": "2026-05-26T03:12:00.000Z",
        "targetUrl": "/leave-requests/42"
      },
      {
        "id": 18,
        "type": "overtime",
        "typeLabel": "Tăng ca",
        "action": "Đã duyệt",
        "employeeName": "Trần Thị B",
        "employeeCode": "EMP005",
        "status": "APPROVED",
        "statusLabel": "Đã duyệt",
        "createdAt": "2026-05-26T02:45:00.000Z",
        "targetUrl": "/overtime-requests/18"
      }
    ],
    "generatedAt": "2026-05-26T06:00:00.000Z"
  }
}
```

### MANAGER

```json
{
  "success": true,
  "data": {
    "stats": {
      "totalEmployees": 10,
      "checkedInToday": 8,
      "checkedInRate": 80,
      "pendingLeave": 1,
      "pendingOT": 2,
      "pendingViolation": 0,
      "pendingOnlineWork": 1,
      "totalDepartments": 1,
      "lateToday": 1,
      "absentToday": 1,
      "departmentName": "Kỹ thuật",
      "totalMembersInDept": 10
    },
    "recentActivity": [ "..." ],
    "generatedAt": "2026-05-26T06:00:00.000Z"
  }
}
```

### EMPLOYEE

```json
{
  "success": true,
  "data": {
    "stats": {
      "isCheckedInToday": true,
      "isCheckedOutToday": false,
      "leaveBalance": {
        "totalDays": 12,
        "usedDays": 3,
        "remainingDays": 9
      },
      "pendingLeaveRequests": 1,
      "lateCountThisMonth": 2,
      "absentCountThisMonth": 0,
      "pendingOT": 0
    },
    "recentActivity": [
      {
        "id": 42,
        "type": "leave",
        "typeLabel": "Nghỉ phép (Phép năm)",
        "action": "Vừa tạo",
        "employeeName": "Nguyễn Văn A",
        "employeeCode": "EMP012",
        "status": "PENDING",
        "statusLabel": "Chờ duyệt",
        "createdAt": "2026-05-26T03:12:00.000Z",
        "targetUrl": "/leave-requests/42"
      }
    ],
    "generatedAt": "2026-05-26T06:00:00.000Z"
  }
}
```

---

## Composable — useDashboard

```typescript
// composables/useDashboard.ts
import type {
  DashboardResponse,
  CompanyDashboardResponse,
  DepartmentDashboardResponse,
  MyDashboardResponse,
} from '~/types/dashboard.types';

export function useDashboard() {
  const { get } = useApi();

  const fetchDashboard = () =>
    get<DashboardResponse>('/v1/dashboard');

  return { fetchDashboard };
}

// ─── Type guards (dùng khi cần xử lý riêng từng role) ─────────────────────────

export function isCompanyDashboard(
  data: DashboardResponse,
): data is CompanyDashboardResponse {
  return 'totalEmployees' in data.stats && !('departmentName' in data.stats);
}

export function isDepartmentDashboard(
  data: DashboardResponse,
): data is DepartmentDashboardResponse {
  return 'departmentName' in data.stats;
}

export function isMyDashboard(
  data: DashboardResponse,
): data is MyDashboardResponse {
  return 'isCheckedInToday' in data.stats;
}
```

**Cách dùng trong component:**

```typescript
// pages/dashboard.vue
const { fetchDashboard } = useDashboard();

const { data: dashboardData } = await fetchDashboard();

if (isMyDashboard(dashboardData)) {
  // TypeScript biết đây là MyDashboardResponse
  console.log(dashboardData.stats.isCheckedInToday);
} else if (isDepartmentDashboard(dashboardData)) {
  // TypeScript biết đây là DepartmentDashboardResponse
  console.log(dashboardData.stats.departmentName);
} else {
  // CompanyDashboardResponse
  console.log(dashboardData.stats.totalDepartments);
}
```

---

## Edge Cases

| Tình huống | Kết quả |
|-----------|---------|
| `MANAGER` chưa được gán làm `managerId` của bất kỳ phòng ban nào | **400** — `"Bạn không quản lý phòng ban nào"` |
| `EMPLOYEE` chưa có `LeaveBalance` năm nay (chưa được khởi tạo) | `leaveBalance: null` — không lỗi |
| Nhân viên chưa check-in hôm nay | `isCheckedInToday: false`, `isCheckedOutToday: false` |
| Nhân viên đã check-in nhưng chưa check-out | `isCheckedInToday: true`, `isCheckedOutToday: false` |
| Nhân viên có check-out nhưng không có check-in | `isCheckedInToday: false`, `isCheckedOutToday: true` — trạng thái "Thiếu check-in" |
| Không có hoạt động nào trong phòng ban / của mình | `recentActivity: []` — không lỗi |
| `checkedInRate` khi `totalEmployees = 0` | `0` (tránh chia cho 0) |
| Token hết hạn | **401** — dùng refresh token flow thông thường |
| Gọi lúc nửa đêm (server timezone UTC+7) | `generatedAt` phản ánh đúng giờ server; `lateToday`, `absentToday` reset về 0 khi qua ngày mới |
