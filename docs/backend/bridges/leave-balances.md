# Bridge Docs — Số ngày phép (`/v1/leave-balances`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.

---

## Endpoints

| Method | Path | Ai được gọi | Ghi chú |
|--------|------|-------------|---------|
| GET | `/v1/leave-balances/me` | tất cả role | Số ngày phép còn lại của bản thân (năm hiện tại) |
| GET | `/v1/leave-balances` | `HR`, `ADMIN` | Toàn bộ balance (có filter + phân trang) |
| POST | `/v1/leave-balances/bulk-init/employee/:employeeId` | `HR`, `ADMIN` | Khởi tạo phép cho một nhân viên (dùng khi onboard) |
| POST | `/v1/leave-balances/bulk-init` | `HR`, `ADMIN` | Khởi tạo hàng loạt cho tất cả NV × loại phép |
| POST | `/v1/leave-balances` | `HR`, `ADMIN` | Cấp phát số ngày phép cho một nhân viên |
| POST | `/v1/leave-balances/recalculate-requests` | `HR`, `ADMIN` | **Bước 1** — tính lại P/KL trên đơn đã duyệt (có dry-run) |
| POST | `/v1/leave-balances/recalculate` | `HR`, `ADMIN` | **Bước 2** — tính lại `usedDays` từ đơn đã duyệt (có dry-run) |
| PATCH | `/v1/leave-balances/:id` | `HR`, `ADMIN` | Điều chỉnh `totalDays` (ghi đè) |

> **Lưu ý thứ tự route:** `/leave-balances/me` và `/leave-balances/bulk-init` được khai báo trước `/leave-balances/:id`.

---

## TypeScript Types

```typescript
// types/leave.types.ts

export interface LeaveBalanceTypeRef {
  id: number;
  name: string;
  code: string;  // 'ANNUAL' | 'HALF_DAY' | 'LATE' | 'EARLY' | ...
}

// Response cho EMPLOYEE (/me)
export interface LeaveBalance {
  id: number;
  leaveType: LeaveBalanceTypeRef;
  year: number;           // năm dương lịch, ví dụ 2026
  totalDays: number;      // tổng ngày phép được cấp trong năm
  usedDays: number;       // số ngày đã dùng (đã approve)
  remainingDays: number;  // computed = totalDays - usedDays (backend tính sẵn)
}

// Response cho HR/Admin (GET all + POST + PATCH)
export interface LeaveBalanceAdmin {
  id: number;
  employee: {
    id: number;
    fullName: string;
    employeeCode: string;
    department: string | null;  // tên phòng ban
  };
  leaveType: LeaveBalanceTypeRef;
  year: number;
  totalDays: number;
  usedDays: number;
  remainingDays: number;
}

// Request DTO
export interface InitEmployeeLeaveBalanceDto {
  year?: number; // bỏ trống → năm hiện tại
}

export interface BulkInitLeaveBalanceDto {
  year: number;           // năm cấp phát (>= 2020)
  leaveTypeIds?: number[]; // bỏ trống → tất cả loại phép có daysPerYear != null
  employeeIds?: number[];  // bỏ trống → tất cả nhân viên ACTIVE
}

export interface BulkInitResult {
  created: number;  // số bản ghi mới
  skipped: number;  // số bản ghi đã tồn tại
  total: number;    // tổng cặp (employee × leaveType)
}

export interface CreateLeaveBalanceDto {
  employeeId: number;   // ID nhân viên
  leaveTypeId: number;  // ID loại phép (phải có daysPerYear != null)
  year: number;         // năm cấp phát (>= 2020)
  totalDays: number;    // số ngày phép (>= 0), cho phép nửa ngày — VD 6.5
}

export interface AdjustLeaveBalanceDto {
  totalDays: number;  // ghi đè giá trị cũ (>= 0), cho phép nửa ngày — VD 6.5
  note?: string;      // lý do điều chỉnh (tối đa 200 ký tự)
}

export interface QueryLeaveBalanceParams {
  year: number;          // bắt buộc
  page?: number;         // default 1
  limit?: number;        // default 20, max 100
  employeeId?: number;
  departmentId?: number;
  leaveTypeId?: number;
}
```

---

## GET /v1/leave-balances/me — Số ngày phép của tôi

Trả balance của tất cả loại phép có `daysPerYear != null` cho user hiện tại, trong năm hiện tại.

> Loại phép không giới hạn (`daysPerYear = null`) như HALF_DAY, LATE, EARLY **không có record** trong bảng `leave_balances` và sẽ không xuất hiện ở đây.

**Response:** `ApiSuccess<LeaveBalance[]>` — mảng thẳng, không có `meta` phân trang.

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

---

## GET /v1/leave-balances — Toàn bộ balance (HR/Admin)

**Query params:** `?year=2026&employeeId=4&departmentId=1&leaveTypeId=1&page=1&limit=20`

`year` là **bắt buộc**. Các params còn lại optional.

**Response:** `ApiPaginated<LeaveBalanceAdmin>`

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "employee": { "id": 4, "fullName": "Nguyễn Văn An", "employeeCode": "EMP004", "department": "Kỹ thuật" },
      "leaveType": { "id": 1, "name": "Nghỉ cả ngày", "code": "ANNUAL" },
      "year": 2026,
      "totalDays": 12,
      "usedDays": 3,
      "remainingDays": 9
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 45, "totalPages": 3 }
}
```

---

## POST /v1/leave-balances/bulk-init/employee/:employeeId — Khởi tạo cho nhân viên mới (HR/Admin)

Cấp phát tất cả loại phép có `daysPerYear != null` cho một nhân viên cụ thể.  
Dùng ngay sau khi tạo nhân viên mới (onboarding). **Idempotent** — chạy lại không bị lỗi.

```http
POST /v1/leave-balances/bulk-init/employee/6
Content-Type: application/json

{}
```

`year` mặc định là năm hiện tại, có thể override:

```json
{ "year": 2026 }
```

**Response 201:**

```json
{
  "success": true,
  "data": {
    "created": 3,
    "skipped": 0,
    "total": 3
  }
}
```

**Lỗi có thể gặp:**

| HTTP | Mô tả |
|------|-------|
| 400 | Nhân viên không ở trạng thái ACTIVE |
| 404 | Nhân viên không tồn tại |

> `totalDays` lấy từ `leaveType.daysPerYear`. Nếu nhân viên gia nhập giữa năm và cần điều chỉnh số ngày, dùng `PATCH /leave-balances/:id` sau khi init.

---

## POST /v1/leave-balances/bulk-init — Khởi tạo hàng loạt (HR/Admin)

Tạo bản ghi balance cho toàn bộ nhân viên ACTIVE × toàn bộ loại phép có `daysPerYear != null`.  
Dùng đầu năm để khởi tạo phép cho cả công ty trong một lần gọi. **Idempotent** — chạy lại không bị lỗi.

```json
{
  "year": 2026
}
```

Có thể giới hạn phạm vi bằng `leaveTypeIds` hoặc `employeeIds`:

```json
{
  "year": 2026,
  "leaveTypeIds": [1],
  "employeeIds": [4, 5, 6]
}
```

**Response 201:**

```json
{
  "success": true,
  "data": {
    "created": 45,
    "skipped": 5,
    "total": 50
  }
}
```

| Field | Ý nghĩa |
|---|---|
| `created` | Số bản ghi mới được tạo |
| `skipped` | Số cặp (employee, leaveType, year) đã tồn tại, bỏ qua |
| `total` | Tổng số cặp xử lý = số NV × số loại phép |

**Lỗi có thể gặp:**

| HTTP | Mô tả |
|------|-------|
| 400 | Một `leaveTypeId` trong danh sách có `daysPerYear = null` |
| 404 | Một `leaveTypeId` không tồn tại |

> `totalDays` của mỗi bản ghi được lấy từ `leaveType.daysPerYear` (ví dụ: ANNUAL → 12). HR có thể dùng `PATCH /:id` để điều chỉnh sau.

---

## POST /v1/leave-balances — Cấp phát số ngày phép (HR/Admin)

Tạo bản ghi balance cho một nhân viên. Mỗi cặp `(employeeId, leaveTypeId, year)` chỉ được tạo **một lần**.

```json
{
  "employeeId": 4,
  "leaveTypeId": 1,
  "year": 2026,
  "totalDays": 12
}
```

**Response 201:** `ApiSuccess<LeaveBalanceAdmin>`

**Lỗi có thể gặp:**

| HTTP | Mô tả |
|------|-------|
| 400 | Loại phép không giới hạn (LATE/EARLY/HALF_DAY) — không cần cấp phát |
| 404 | Loại phép không tồn tại |
| 409 | Đã có bản ghi balance cho cặp (employee, leaveType, year) này |

---

## Ràng buộc `totalDays`

`>= 0`, tối đa **1 chữ số thập phân** — khớp với cột `Decimal(5, 1)` trong DB.

Cho phép nửa ngày vì số dư phép hoàn toàn có thể lẻ: nhân sự nghỉ nửa buổi thì `usedDays`
mang `.5`, nên phần còn lại cũng lẻ. Nhập `6.75` → **400**.

---

## PATCH /v1/leave-balances/:id — Điều chỉnh totalDays (HR/Admin)

Ghi đè `totalDays`. Dùng khi HR cần bổ sung phép thâm niên, hoặc sửa sai.

```json
{
  "totalDays": 14,
  "note": "Bổ sung phép thâm niên 5 năm"
}
```

**Response 200:** `ApiSuccess<LeaveBalanceAdmin>`

> `usedDays` **không bị thay đổi**. Nếu `totalDays` mới < `usedDays` hiện tại → `remainingDays` sẽ âm. Frontend nên hiển thị cảnh báo.

`accruedDays` (và vì thế `remainingDays`) đổi theo hướng điều chỉnh:

| Điều chỉnh | `accruedDays` sau khi lưu |
|---|---|
| **Nâng** `totalDays`, loại `ANNUAL` | Tính lại theo `joinDate`: 1 ngày/tháng từ tháng vào làm đến tháng hiện tại (giờ VN), tối đa `totalDays` mới. Năm đã qua thì bằng `totalDays` mới |
| **Nâng** `totalDays`, loại khác | Bằng `totalDays` mới (cấp đủ, như lúc tạo bản ghi) |
| **Giảm** `totalDays` | Giữ nguyên, chỉ cắt xuống `totalDays` mới nếu đang lớn hơn |
| Giữ nguyên `totalDays` | Giữ nguyên |

Ví dụ: nhân viên vào làm 01/2024, bản ghi phép năm 2026 đang `6 / 6` (đã chạm tổng nên cron không
cộng nữa). HR sửa tổng thành 12 vào tháng 11 → `accruedDays = 11`. Vì là tính lại theo quy tắc,
bản ghi đang bị cộng thừa cũng được đưa về đúng số: vào 15/06/2026, đang `12 / 8`, nâng tổng lên 13
→ `accruedDays = 6`.

---

## Khi nào balance thay đổi?

| Sự kiện | Thay đổi |
|---|---|
| HR approve đơn `ANNUAL` | `usedDays` tăng theo `paidDays` của đơn |
| HR approve đơn `HALF_DAY` | `usedDays` của quỹ **ANNUAL** tăng 0.5 — nghỉ nửa ngày trừ vào phép năm |
| Hết số dư khi tạo đơn `ANNUAL` / `HALF_DAY` | `LeaveSplitService` cắt thành `P` + `KL`; phần `KL` không trừ quỹ và không tính công lương |
| HR gọi `POST /recalculate` với `dryRun: false` | `usedDays` bị **ghi đè** bằng giá trị tính lại từ đơn đã duyệt |
| Employee tạo đơn (PENDING) | Balance **chưa thay đổi** — chỉ bị trừ khi approve |
| Employee thu hồi / HR từ chối đơn PENDING | Balance không đổi (chưa trừ) |
| HR dùng `PATCH /:id` | `totalDays` thay đổi, `usedDays` giữ nguyên; nâng tổng thì `accruedDays` được tính lại (xem bảng ở mục PATCH) |
| Cron 00:00 ngày 1 hằng tháng | `accruedDays` phép năm `+1`, không vượt `totalDays`, mỗi tháng một lần |

---

## POST /v1/leave-balances/recalculate-requests — Bước 1: tính lại P/KL trên đơn (HR/Admin)

`paidDays` / `unpaidDays` / `leaveCode` được chốt tại thời điểm **tạo đơn** và không bao
giờ tính lại. Khi quy tắc trừ quỹ thay đổi — nghỉ nửa ngày (`HALF_DAY`) nay trừ vào quỹ
phép năm — thì toàn bộ đơn `HALF_DAY` duyệt trước đó vẫn mang `paidDays = totalDays` dù
nhân sự không còn quỹ, tức **đang được trả lương sai**.

Endpoint này phát lại các đơn `ANNUAL` + `HALF_DAY` đã duyệt trong năm:

- Quỹ đối chiếu = `accruedDays` **hiện tại** của quỹ phép năm.
- Nhân sự chưa được cấp phát số dư → quỹ = 0 → toàn bộ đơn thành `KL`.
- Rải quỹ theo **thứ tự ngày nghỉ**; hết quỹ thì đơn sau thành `KL`; đơn vắt ngang ranh
  giới bị cắt thành `P+KL`.

### Request

```ts
interface RecalculateLeaveSplitPayload {
  year: number;             // theo startDate của đơn
  month?: number;           // 1–12; chỉ ÁP DỤNG cho đơn trong tháng này
  employeeIds?: number[];
  dryRun?: boolean;         // mặc định true
}
```

### Response

```ts
interface LeaveSplitRecalcResult {
  dryRun: boolean;
  year: number;
  month: number | null; // tháng được áp dụng; null = cả năm
  scanned: number;      // số đơn đã quét (LUÔN là cả năm)
  changed: number;      // số đơn có thay đổi trong phạm vi áp dụng
  skippedOutsideMonth: number;  // số đơn lệch nhưng nằm ngoài tháng đã chọn
  paidBefore: number;   // tổng ngày đang tính có lương của các đơn bị đổi
  paidAfter: number;    // tổng ngày còn được tính có lương sau khi áp
  items: Array<{
    leaveRequestId: number;
    employeeId: number;
    employeeCode: string;
    fullName: string;
    date: string;              // YYYY-MM-DD
    leaveTypeCode: string;
    totalDays: number;
    paidBefore: number;  paidAfter: number;
    unpaidBefore: number; unpaidAfter: number;
    leaveCodeBefore: string | null;
    leaveCodeAfter: 'P' | 'KL' | 'P+KL';
  }>;
  nextStep: string;
}
```

> ⚠️ **Thứ tự bắt buộc:** chạy endpoint này trước, rồi mới `POST /leave-balances/recalculate`.
> `usedDays` của quỹ được cộng từ `paidDays` của đơn — làm ngược thì bước 2 lấy số cũ.

Thao tác này **đổi số công tính lương** của các tháng liên quan: ngày chuyển từ `P` sang
`KL` sẽ không còn được cộng vào `totalPayrollDays`, và ký hiệu trong bảng công đổi từ
`P` / `P/X` sang `KL` / `KL/X`.

---

## POST /v1/leave-balances/recalculate — Bước 2: tính lại usedDays (HR/Admin)

Cộng lại `usedDays` từ toàn bộ đơn nghỉ `APPROVED` của năm rồi **ghi đè** giá trị đang
lưu. Vì ghi đè chứ không cộng dồn nên **chạy lại bao nhiêu lần cũng ra cùng kết quả**.

Dùng khi quy tắc trừ quỹ thay đổi — ví dụ nghỉ nửa ngày (`HALF_DAY`) nay trừ 0.5 ngày
vào quỹ phép năm, nhưng các đơn duyệt trước đó chưa được trừ.

### Request

```ts
interface RecalculateLeaveBalancePayload {
  year: number;             // bắt buộc, 2020–2100
  month?: number;           // 1–12; thu hẹp PHẠM VI NHÂN SỰ (xem lưu ý bên dưới)
  employeeIds?: number[];   // bỏ trống → toàn bộ nhân viên có số dư trong năm
  dryRun?: boolean;         // mặc định true — chỉ xem trước, KHÔNG ghi DB
}
```

> ⚠️ **`month` ở bước 2 có nghĩa khác bước 1.** `usedDays` là con số luỹ kế **cả năm**,
> không thể "chỉ tính tháng 8" — cộng riêng một tháng sẽ ra số sai. Nên ở đây `month`
> chỉ dùng để **thu hẹp danh sách nhân sự** bị đụng tới: chỉ tính lại cho người có đơn
> nghỉ trong tháng đó, nhưng `usedDays` của họ vẫn cộng từ toàn bộ đơn trong năm.

```ts
```

> ⚠️ `dryRun` mặc định `true`. Phải truyền **`dryRun: false`** thì mới thực sự ghi.
> Luôn gọi bản xem trước và cho HR duyệt danh sách thay đổi trước khi áp dụng.

### Response

```ts
interface LeaveBalanceRecalcResult {
  dryRun: boolean;
  year: number;
  month: number | null; // tháng dùng để thu hẹp phạm vi nhân sự
  scanned: number;      // số bản ghi số dư trong phạm vi
  changed: number;      // số bản ghi có chênh lệch
  totalDelta: number;   // tổng trị tuyệt đối các chênh lệch
  items: Array<{
    employeeId: number;
    employeeCode: string;
    fullName: string;
    leaveTypeCode: string;
    accruedDays: number;
    usedBefore: number;
    usedAfter: number;
    delta: number;
    exceedsAccrued: boolean;  // usedAfter > accruedDays → số dư còn lại âm
  }>;
  skipped: Array<{
    employeeId: number;
    fullName: string;
    leaveTypeCode: string;
    untrackedDays: number;    // số ngày đáng lẽ phải trừ nhưng chưa có bản ghi số dư
  }>;
}
```

### Hai trường cần cảnh báo trên UI

| Trường | Ý nghĩa | FE nên làm |
|---|---|---|
| `items[].exceedsAccrued` | Sau khi tính lại, nhân sự đã dùng quá số ngày tích luỹ → số dư âm, đơn phép năm tiếp theo sẽ tự thành `KL` | Tô đỏ dòng, hiện icon cảnh báo |
| `skipped[]` | Nhân sự có đơn trừ quỹ nhưng **chưa được cấp phát số dư** → không ghi được gì | Hiện danh sách riêng, gợi ý cấp phát quỹ (`POST /leave-balances`) rồi chạy lại |

### Luồng khuyến nghị cho FE

1. Cấp phát quỹ phép năm cho nhân sự còn thiếu (nếu nghiệp vụ xác định họ có phép).
2. `POST /recalculate-requests` với `dryRun: true` → HR duyệt danh sách đơn sẽ đổi P/KL.
3. Gọi lại bước 2 với `dryRun: false`.
4. `POST /recalculate` với `dryRun: true` → HR duyệt bảng `items` + `skipped`.
5. Gọi lại bước 4 với `dryRun: false`.

Nếu chỉ muốn đụng vào một tháng (ví dụ tháng 7 đã chốt lương), truyền thêm `month` ở
**cả hai** bước. Xem `skippedOutsideMonth` ở bước 1 để biết còn bao nhiêu đơn sai ở
tháng khác chưa xử lý.

Ghi log tự động dưới action `leave_request.recalculate_split` và `leave_balance.recalculate`
(chỉ khi thực sự ghi, không log dry-run).

> Sau khi chạy đủ hai bước, `usedDays` luôn ≤ `accruedDays` — phần vượt quỹ đã thành `KL`
> chứ không còn ăn vào số dư, nên `remainingDays` không bao giờ âm nữa.

---

## Hiển thị trên UI

```typescript
// Thanh progress ngày phép
const percentage = computed(() =>
  balance.totalDays > 0
    ? Math.round((balance.usedDays / balance.totalDays) * 100)
    : 0,
);
// remainingDays luôn >= 0 sau khi tạo đơn thành công
// (backend kiểm tra balance trước khi cho tạo đơn)
```

---

## Composable — useLeaveBalances

```typescript
// composables/useLeaveBalances.ts
import type {
  LeaveBalance,
  LeaveBalanceAdmin,
  CreateLeaveBalanceDto,
  AdjustLeaveBalanceDto,
  QueryLeaveBalanceParams,
} from '~/types/leave.types';

export function useLeaveBalances() {
  const { get, list, post, patch } = useFetch();

  /** Tất cả role: số ngày phép còn lại của bản thân (năm hiện tại) */
  const fetchMyBalance = () =>
    get<LeaveBalance[]>('/v1/leave-balances/me');

  /** HR/Admin: toàn bộ balance (year là bắt buộc) */
  const fetchAllBalances = (params: QueryLeaveBalanceParams) =>
    list<LeaveBalanceAdmin>('/v1/leave-balances', { params });

  /** HR/Admin: khởi tạo phép cho nhân viên mới (idempotent) */
  const initBalancesForEmployee = (employeeId: number, dto: InitEmployeeLeaveBalanceDto = {}) =>
    post<BulkInitResult>(`/v1/leave-balances/bulk-init/employee/${employeeId}`, dto);

  /** HR/Admin: khởi tạo hàng loạt đầu năm (idempotent) */
  const bulkInitBalances = (dto: BulkInitLeaveBalanceDto) =>
    post<BulkInitResult>('/v1/leave-balances/bulk-init', dto);

  /** HR/Admin: cấp phát số ngày phép cho một nhân viên */
  const createBalance = (dto: CreateLeaveBalanceDto) =>
    post<LeaveBalanceAdmin>('/v1/leave-balances', dto);

  /** HR/Admin: điều chỉnh totalDays (ghi đè) */
  const adjustBalance = (id: number, dto: AdjustLeaveBalanceDto) =>
    patch<LeaveBalanceAdmin>(`/v1/leave-balances/${id}`, dto);

  return { fetchMyBalance, fetchAllBalances, initBalancesForEmployee, bulkInitBalances, createBalance, adjustBalance };
}
```

---

## Edge cases

| Tình huống | Kết quả |
|---|---|
| Employee chưa có record balance (HR chưa tạo) | `GET /me` trả mảng rỗng `[]` |
| Tạo đơn ANNUAL khi balance record không tồn tại | 400 `LEAVE_INSUFFICIENT_BALANCE` |
| `remainingDays` bằng 0 | Vẫn trả về trong response; tạo đơn mới → 400 |
| HALF_DAY / LATE / EARLY | `daysPerYear = null` → không có record balance, `POST /leave-balances` trả 400 |
| POST với cặp (employee, leaveType, year) đã tồn tại | 409 Conflict |
| PATCH `totalDays` xuống thấp hơn `usedDays` | Backend cho phép, `remainingDays` âm — frontend nên cảnh báo |
