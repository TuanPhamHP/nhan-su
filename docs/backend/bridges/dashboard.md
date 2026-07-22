# Bridge Docs — Dashboard (`/v1/dashboard`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.

---

## Endpoints

| Method | Path                      | Ai được gọi               | Ghi chú                                  |
| ------ | ------------------------- | ------------------------- | ---------------------------------------- |
| GET    | `/v1/dashboard`           | Mọi user đã đăng nhập     | Tự động trả đúng loại dựa theo role      |
| GET    | `/v1/dashboard/new-hires` | HR, ADMIN, CHIEF, MANAGER | Danh sách nhân viên mới theo khoảng ngày |

> `GET /v1/dashboard` — một endpoint duy nhất, server đọc role từ JWT và trả về 3 kiểu response khác nhau.  
> **Không truyền query params.** Toàn bộ số liệu được tính theo `ngày hôm nay` (server time) và identity người gọi.

---

## Role Routing

| Role                   | Response type                 | Phạm vi dữ liệu                |
| ---------------------- | ----------------------------- | ------------------------------ |
| `ADMIN`, `HR`, `CHIEF` | `CompanyDashboardResponse`    | Toàn công ty                   |
| `MANAGER`              | `DepartmentDashboardResponse` | Phòng ban mà user đang quản lý |
| `EMPLOYEE`             | `MyDashboardResponse`         | Chỉ cá nhân                    |

> **`MANAGER` chưa được gán phòng ban** (chưa là `managerId` của bất kỳ phòng ban nào) → **400 Bad Request**.

---

## TypeScript Types

```typescript
// types/dashboard.types.ts

// ─── Shared ──────────────────────────────────────────────────────────────────

export type ActivityType =
  | 'leave'
  | 'overtime'
  | 'violation'
  | 'online_work'
  | 'makeup';

export interface ActivityItem {
  targetId: number;
  type: ActivityType;
  typeLabel: string; // "Nghỉ phép (Phép năm)" | "Tăng ca" | "Vi phạm chuyên cần" | "Làm việc online" | "Bổ sung chấm công"
  action: string; // "Vừa tạo" | "Chờ duyệt" | "Đã duyệt" | "Đã từ chối" | "Đã huỷ"
  employeeName: string;
  employeeCode: string;
  status: string; // giá trị raw từ enum (PENDING, APPROVED, PENDING_L1, ...)
  statusLabel: string; // text hiển thị (xem bảng Status Labels)
  createdAt: string; // ISO 8601
}

// ─── HR / ADMIN / CHIEF ───────────────────────────────────────────────────────

export interface CompanyStats {
  totalEmployees: number; // tổng nhân viên ACTIVE
  checkedInToday: number; // đã checkIn hôm nay (checkInAt != null HOẶC workType = ONLINE_APPROVED)
  checkedInRate: number; // % = checkedInToday / totalEmployees * 100, đã làm tròn
  pendingLeave: number; // đơn nghỉ phép PENDING
  pendingOT: number; // đơn tăng ca PENDING
  pendingViolation: number; // đơn vi phạm PENDING
  pendingOnlineWork: number; // đơn online work PENDING_L1 + L2 + L3
  totalDepartments: number; // phòng ban đang isActive = true
  lateToday: number; // bản ghi chấm công LATE hôm nay
  absentToday: number; // bản ghi chấm công ABSENT hôm nay
  workingOnlineToday: number; // số nhân viên có workType = ONLINE_APPROVED hôm nay
}

export interface HRAnalyticsData {
  statusBreakdown: {
    status: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';
    count: number;
  }[];
  byDepartment: {
    departmentId: number;
    departmentName: string;
    count: number;
  }[];
  genderBreakdown: { gender: string; count: number }[];
  ageGroups: { range: string; count: number }[];
  averageAge: number | null; // null nếu không có nhân viên nào có dateOfBirth
  ageDataCoverage: number; // số nhân viên có dateOfBirth (mẫu tính tuổi)
  contractBreakdown: {
    contractType: 'PROBATION' | 'FIXED_TERM' | 'INDEFINITE' | 'SEASONAL';
    count: number;
  }[];
  newHiresLast30Days: number;
  expiringContractsNext30Days: number;
}

export interface CompanyDashboardResponse {
  stats: CompanyStats;
  recentActivity: ActivityItem[]; // 10 hoạt động gần nhất (mọi loại, toàn công ty)
  hrAnalytics: HRAnalyticsData; // phân tích nhân sự toàn công ty
  generatedAt: string; // ISO 8601 — thời điểm server tạo response
}

// ─── MANAGER ─────────────────────────────────────────────────────────────────

export interface DepartmentStats extends CompanyStats {
  departmentName: string; // tên phòng ban
  totalMembersInDept: number; // số nhân viên ACTIVE trong phòng ban
  // checkedInRate ở đây = checkedInToday / totalMembersInDept * 100
  // totalDepartments luôn = 1 (chỉ phòng ban của mình)
}

export interface DepartmentDashboardResponse {
  stats: DepartmentStats;
  recentActivity: ActivityItem[]; // 10 hoạt động gần nhất trong phòng ban
  hrAnalytics: HRAnalyticsData; // phân tích nhân sự phòng ban
  generatedAt: string;
}

// ─── EMPLOYEE ────────────────────────────────────────────────────────────────

export interface LeaveBalance {
  totalDays: number; // hạn mức phép năm (ANNUAL) trong năm hiện tại
  usedDays: number; // số ngày đã dùng
  remainingDays: number; // = totalDays - usedDays
}

export interface MyStats {
  isCheckedInToday: boolean; // đã check-in hôm nay chưa
  isCheckedOutToday: boolean; // đã check-out hôm nay chưa
  leaveBalance: LeaveBalance | null; // null nếu chưa được khởi tạo leave balance năm nay
  pendingLeaveRequests: number; // đơn nghỉ phép của mình đang PENDING
  lateCountThisMonth: number; // số lần đi muộn trong tháng hiện tại
  absentCountThisMonth: number; // số lần vắng trong tháng hiện tại
  pendingOT: number; // đơn tăng ca của mình đang PENDING
}

export interface MyDashboardResponse {
  stats: MyStats;
  recentActivity: ActivityItem[]; // 10 hoạt động gần nhất liên quan đến mình
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

| `status` (raw)   | `statusLabel` |
| ---------------- | ------------- |
| `PENDING`        | Chờ duyệt     |
| `PENDING_L1`     | Chờ duyệt L1  |
| `PENDING_L2`     | Chờ duyệt L2  |
| `PENDING_L3`     | Chờ duyệt L3  |
| `APPROVED`       | Đã duyệt      |
| `REJECTED`       | Đã từ chối    |
| `CANCELLED`      | Đã huỷ        |
| `AUTO_CANCELLED` | Tự huỷ        |
| `COMPLETED`      | Hoàn thành    |

### Action Labels cho `ActivityItem`

| `status` (raw)                | `action`   |
| ----------------------------- | ---------- |
| `PENDING`, `PENDING_L1`       | Vừa tạo    |
| `PENDING_L2`, `PENDING_L3`    | Chờ duyệt  |
| `APPROVED`, `COMPLETED`       | Đã duyệt   |
| `REJECTED`                    | Đã từ chối |
| `CANCELLED`, `AUTO_CANCELLED` | Đã huỷ     |

---

## Recent Activity

`recentActivity` là mảng tối đa 10 phần tử, **đã sắp xếp theo `createdAt` giảm dần** (mới nhất đứng đầu).

Mỗi item bao gồm 5 loại:

| `type`        | `typeLabel`                   | URL gợi ý (frontend tự build) |
| ------------- | ----------------------------- | ----------------------------- |
| `leave`       | `Nghỉ phép (<tên loại phép>)` | `/leave-requests/${id}`       |
| `overtime`    | `Tăng ca`                     | `/overtime-requests/${id}`    |
| `violation`   | `Vi phạm chuyên cần`          | `/violation-requests/${id}`   |
| `online_work` | `Làm việc online`             | `/online-work-requests/${id}` |
| `makeup`      | `Bổ sung chấm công`           | `/makeup-attendance/${id}`    |

> Backend chỉ trả `type` + `id`. Frontend tự build URL từ hai field này:</p>
>
> ```ts
> const urlMap: Record<ActivityType, string> = {
>   leave: '/leave-requests',
>   overtime: '/overtime-requests',
>   violation: '/violation-requests',
>   online_work: '/online-work-requests',
>   makeup: '/makeup-attendance',
> };
> router.push(`${urlMap[item.type]}/${item.targetId}`);
> ```

### `recentActivity` theo role

| Role                   | Phạm vi activity                                                 |
| ---------------------- | ---------------------------------------------------------------- |
| `ADMIN`, `HR`, `CHIEF` | Toàn bộ công ty — 10 bản ghi mới nhất qua 5 loại                 |
| `MANAGER`              | Chỉ nhân viên thuộc phòng ban mình quản lý                       |
| `EMPLOYEE`             | Đơn của mình + đơn đang chờ mình duyệt (nếu là manager/approver) |

---

## HR Analytics (`hrAnalytics`)

> Chỉ có trong `CompanyDashboardResponse` (ADMIN/HR/CHIEF) và `DepartmentDashboardResponse` (MANAGER).  
> `MyDashboardResponse` (EMPLOYEE) **không có** field này.

### Phạm vi dữ liệu theo role

| Role                   | Phạm vi `hrAnalytics`                      |
| ---------------------- | ------------------------------------------ |
| `ADMIN`, `HR`, `CHIEF` | Toàn bộ công ty                            |
| `MANAGER`              | Chỉ nhân viên trong phòng ban mình quản lý |

### `statusBreakdown`

Phân bổ nhân viên theo trạng thái, **không lọc** (bao gồm INACTIVE, ON_LEAVE).

```typescript
statusBreakdown: {
  status: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';
  count: number;
}
[];
```

### `byDepartment`

Số nhân viên **ACTIVE** theo từng phòng ban (phòng ban đang `isActive = true`), sắp xếp A→Z theo tên phòng ban.  
Với MANAGER: mảng chỉ có 1 phần tử (phòng ban của mình).

```typescript
byDepartment: {
  departmentId: number;
  departmentName: string;
  count: number;
}
[];
```

### `genderBreakdown`

Phân bổ theo giới tính, **chỉ nhân viên ACTIVE có điền gender**.  
Nhân viên chưa điền `gender` bị **loại khỏi mảng** (không hiển thị "Chưa cập nhật").  
Dùng `ageDataCoverage` để biết có bao nhiêu % đã điền đủ data.

```typescript
genderBreakdown: {
  gender: string;
  count: number;
}
[];
// gender: giá trị string tự do — thường là "MALE" / "FEMALE" / "OTHER"
```

### `ageGroups` và `averageAge`

Tính từ `dateOfBirth`, **chỉ nhân viên ACTIVE có điền ngày sinh**.

```typescript
ageGroups: {
  range: string;
  count: number;
}
[];
// range cố định theo thứ tự: 'Dưới 25' | '25-30' | '31-35' | '36-40' | 'Trên 40'

averageAge: number | null;
// null nếu không có nhân viên nào có dateOfBirth
```

| `range`   | Điều kiện     |
| --------- | ------------- |
| `Dưới 25` | age < 25      |
| `25-30`   | 25 ≤ age ≤ 30 |
| `31-35`   | 31 ≤ age ≤ 35 |
| `36-40`   | 36 ≤ age ≤ 40 |
| `Trên 40` | age > 40      |

`ageDataCoverage` = số nhân viên có `dateOfBirth` (mẫu để tính % coverage: `ageDataCoverage / stats.totalEmployees * 100`).

### `contractBreakdown`

Hợp đồng đang **ACTIVE** theo loại hợp đồng. Mảng rỗng nếu không có hợp đồng active.

```typescript
contractBreakdown: {
  contractType: 'PROBATION' | 'FIXED_TERM' | 'INDEFINITE' | 'SEASONAL';
  count: number;
}
[];
```

| `contractType` | Ý nghĩa                 |
| -------------- | ----------------------- |
| `PROBATION`    | Thử việc                |
| `FIXED_TERM`   | Có thời hạn             |
| `INDEFINITE`   | Không xác định thời hạn |
| `SEASONAL`     | Thời vụ                 |

### `newHiresLast30Days`

Số nhân viên ACTIVE có `joinDate` trong **30 ngày gần nhất** (tính từ thời điểm gọi API).

### `expiringContractsNext30Days`

Số hợp đồng ACTIVE có `endDate` trong **30 ngày tới**. Hợp đồng `INDEFINITE` (không có `endDate`) không được đếm.

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
      "absentToday": 8,
      "workingOnlineToday": 3
    },
    "recentActivity": [
      {
        "targetId": 42,
        "type": "leave",
        "typeLabel": "Nghỉ phép (Phép năm)",
        "action": "Vừa tạo",
        "employeeName": "Nguyễn Văn A",
        "employeeCode": "EMP012",
        "status": "PENDING",
        "statusLabel": "Chờ duyệt",
        "createdAt": "2026-05-26T03:12:00.000Z"
      }
    ],
    "hrAnalytics": {
      "statusBreakdown": [
        { "status": "ACTIVE", "count": 48 },
        { "status": "INACTIVE", "count": 3 },
        { "status": "ON_LEAVE", "count": 1 }
      ],
      "byDepartment": [
        { "departmentId": 2, "departmentName": "Hành chính", "count": 5 },
        { "departmentId": 1, "departmentName": "Kỹ thuật", "count": 12 },
        { "departmentId": 3, "departmentName": "Kinh doanh", "count": 8 }
      ],
      "genderBreakdown": [
        { "gender": "MALE", "count": 28 },
        { "gender": "FEMALE", "count": 18 }
      ],
      "ageGroups": [
        { "range": "Dưới 25", "count": 4 },
        { "range": "25-30", "count": 14 },
        { "range": "31-35", "count": 11 },
        { "range": "36-40", "count": 7 },
        { "range": "Trên 40", "count": 3 }
      ],
      "averageAge": 31,
      "ageDataCoverage": 39,
      "contractBreakdown": [
        { "contractType": "INDEFINITE", "count": 30 },
        { "contractType": "FIXED_TERM", "count": 12 },
        { "contractType": "PROBATION", "count": 4 }
      ],
      "newHiresLast30Days": 2,
      "expiringContractsNext30Days": 3
    },
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
      "workingOnlineToday": 1,
      "departmentName": "Kỹ thuật",
      "totalMembersInDept": 10
    },
    "recentActivity": ["..."],
    "hrAnalytics": {
      "statusBreakdown": [
        { "status": "ACTIVE", "count": 10 },
        { "status": "INACTIVE", "count": 1 }
      ],
      "byDepartment": [
        { "departmentId": 1, "departmentName": "Kỹ thuật", "count": 10 }
      ],
      "genderBreakdown": [
        { "gender": "MALE", "count": 7 },
        { "gender": "FEMALE", "count": 3 }
      ],
      "ageGroups": [
        { "range": "Dưới 25", "count": 1 },
        { "range": "25-30", "count": 4 },
        { "range": "31-35", "count": 3 },
        { "range": "36-40", "count": 1 },
        { "range": "Trên 40", "count": 0 }
      ],
      "averageAge": 29,
      "ageDataCoverage": 9,
      "contractBreakdown": [
        { "contractType": "INDEFINITE", "count": 7 },
        { "contractType": "FIXED_TERM", "count": 2 }
      ],
      "newHiresLast30Days": 1,
      "expiringContractsNext30Days": 0
    },
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
        "targetId": 42,
        "type": "leave",
        "typeLabel": "Nghỉ phép (Phép năm)",
        "action": "Vừa tạo",
        "employeeName": "Nguyễn Văn A",
        "employeeCode": "EMP012",
        "status": "PENDING",
        "statusLabel": "Chờ duyệt",
        "createdAt": "2026-05-26T03:12:00.000Z"
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
  ActivityType,
  DashboardResponse,
  CompanyDashboardResponse,
  DepartmentDashboardResponse,
  MyDashboardResponse,
  HRAnalyticsData,
} from '~/types/dashboard.types';

const activityUrlBase: Record<ActivityType, string> = {
  leave: '/leave-requests',
  overtime: '/overtime-requests',
  violation: '/violation-requests',
  online_work: '/online-work-requests',
  makeup: '/makeup-attendance',
};

export function activityUrl(item: {
  type: ActivityType;
  targetId: number;
}): string {
  return `${activityUrlBase[item.type]}/${item.targetId}`;
}

export function useDashboard() {
  const { get } = useApi();

  const fetchDashboard = () => get<DashboardResponse>('/v1/dashboard');

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

---

## GET `/v1/dashboard/new-hires` — Danh sách nhân viên mới

> Dùng để "Xem danh sách nhân viên mới" từ card `newHiresLast30Days` trên dashboard.  
> **Roles:** HR, ADMIN, CHIEF, MANAGER. EMPLOYEE nhận **403**.

### Query Params

| Param       | Kiểu                  | Bắt buộc | Mô tả                     |
| ----------- | --------------------- | -------- | ------------------------- |
| `from_date` | `string` (YYYY-MM-DD) | ✅       | Ngày bắt đầu              |
| `to_date`   | `string` (YYYY-MM-DD) | ✅       | Ngày kết thúc (inclusive) |

### Logic lọc

Nhất quán với `newHiresLast30Days` trong dashboard:

- `status = 'ACTIVE'`
- `joinDate >= from_date` AND `joinDate <= to_date`

Kết quả **sắp xếp theo `joinDate` giảm dần** (nhân viên vào sau đứng trước).

### TypeScript Type

```typescript
export interface NewHireItem {
  id: number;
  employeeCode: string;
  fullName: string;
  departmentName: string | null; // null nếu chưa gán phòng ban
  positionName: string | null; // null nếu chưa gán chức danh
  joinDate: string; // YYYY-MM-DD
  avatarUrl: string | null; // presigned URL, null nếu chưa có ảnh
}
```

### Response Example

```json
{
  "success": true,
  "data": [
    {
      "id": 12,
      "employeeCode": "NV012",
      "fullName": "Trần Thị B",
      "departmentName": "Kỹ thuật",
      "positionName": "Kỹ sư phần mềm",
      "joinDate": "2026-05-20",
      "avatarUrl": "https://cdn.example.com/avatars/nv012.jpg?X-Amz-Expires=3600&..."
    },
    {
      "id": 11,
      "employeeCode": "NV011",
      "fullName": "Nguyễn Văn A",
      "departmentName": null,
      "positionName": null,
      "joinDate": "2026-05-10",
      "avatarUrl": null
    }
  ]
}
```

### Errors

| HTTP | Khi nào                                                              |
| ---- | -------------------------------------------------------------------- |
| 400  | `from_date > to_date` — `"from_date phải nhỏ hơn hoặc bằng to_date"` |
| 400  | `from_date` hoặc `to_date` không phải ISO date string hợp lệ         |
| 403  | Role EMPLOYEE                                                        |
| 401  | Token hết hạn                                                        |

### Composable

```typescript
// composables/useDashboard.ts (bổ sung)
import type { NewHireItem } from '~/types/dashboard.types';

export function useNewHires() {
  const { get } = useApi();

  const fetchNewHires = (fromDate: string, toDate: string) =>
    get<NewHireItem[]>(
      `/v1/dashboard/new-hires?from_date=${fromDate}&to_date=${toDate}`,
    );

  // Helper: lấy danh sách ứng với card "30 ngày gần nhất"
  const fetchNewHiresLast30Days = () => {
    const to = new Date();
    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return fetchNewHires(
      from.toISOString().split('T')[0],
      to.toISOString().split('T')[0],
    );
  };

  return { fetchNewHires, fetchNewHiresLast30Days };
}
```

### Edge Cases

| Tình huống                               | Kết quả                                           |
| ---------------------------------------- | ------------------------------------------------- |
| `from_date === to_date`                  | Hợp lệ — trả nhân viên vào đúng ngày đó           |
| Không có nhân viên nào trong khoảng      | `data: []` — không lỗi                            |
| `from_date > to_date`                    | **400**                                           |
| Nhân viên chưa gán phòng ban / chức danh | `departmentName: null`, `positionName: null`      |
| Nhân viên chưa có avatar                 | `avatarUrl: null`                                 |
| Avatar bucket presign thất bại           | `avatarUrl: null` (fallback an toàn, không throw) |

---

## Edge Cases

| Tình huống                                                       | Kết quả                                                                                        |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `MANAGER` chưa được gán làm `managerId` của bất kỳ phòng ban nào | **400** — `"Bạn không quản lý phòng ban nào"`                                                  |
| `EMPLOYEE` chưa có `LeaveBalance` năm nay (chưa được khởi tạo)   | `leaveBalance: null` — không lỗi                                                               |
| Nhân viên chưa check-in hôm nay                                  | `isCheckedInToday: false`, `isCheckedOutToday: false`                                          |
| Nhân viên đã check-in nhưng chưa check-out                       | `isCheckedInToday: true`, `isCheckedOutToday: false`                                           |
| Không có hoạt động nào trong phòng ban / của mình                | `recentActivity: []` — không lỗi                                                               |
| `checkedInRate` khi `totalEmployees = 0`                         | `0` (tránh chia cho 0)                                                                         |
| Token hết hạn                                                    | **401** — dùng refresh token flow thông thường                                                 |
| Gọi lúc nửa đêm (server timezone UTC+7)                          | `generatedAt` phản ánh đúng giờ server; `lateToday`, `absentToday` reset về 0 khi qua ngày mới |
| Không nhân viên nào có `dateOfBirth`                             | `averageAge: null`, `ageDataCoverage: 0`, tất cả `ageGroups` count = 0                         |
| Không nhân viên nào có `gender`                                  | `genderBreakdown: []` (mảng rỗng)                                                              |
| Không có hợp đồng nào đang ACTIVE                                | `contractBreakdown: []`, `expiringContractsNext30Days: 0`                                      |
| `EMPLOYEE` đọc `hrAnalytics`                                     | Field không tồn tại trong response — không cần handle, TypeScript type guard đã bảo vệ         |
