# FE Agent Prompt — `/v1/reports/attendance` bổ sung pagination + search

## Context

Trước đây `GET /v1/reports/attendance` trả **toàn bộ nhân viên** match filter dưới dạng array phẳng, chỉ filter được theo `departmentId` / `employeeId` (exact). BE vừa bổ sung `search` (theo tên hoặc mã) và **phân trang** — response shape đổi từ array → `{ data, meta }`. Đây là **breaking change** cho endpoint list, endpoint export không đổi shape.

Bridge doc đầy đủ: [`docs/bridges/reports.md`](./reports.md) mục `GET /v1/reports/attendance`.

---

## Thay đổi API

### 1. `QueryAttendanceReportParams` — thêm 3 field

```typescript
export interface QueryAttendanceReportParams {
  year: number;
  month: number;
  departmentId?: number;
  employeeId?: number;
  search?: string;   // MỚI — tên (unaccent + ILIKE) hoặc mã (ILIKE)
  page?: number;     // MỚI — default 1
  limit?: number;    // MỚI — default 20, max 100
}
```

Ví dụ URL: `?year=2026&month=5&departmentId=1&search=nguyen&page=2&limit=20`

### 2. Response shape — **BREAKING**

**Trước:**
```json
{ "success": true, "data": [ ... ] }
```

**Sau:**
```json
{
  "success": true,
  "data": [ ... ],
  "meta": { "page": 1, "limit": 20, "total": 47, "totalPages": 3 }
}
```

Field trong mỗi phần tử `data[]` **không đổi** (`AttendanceReportResponse` giữ nguyên).

### 3. Search semantics

- `search=nguyen` → match `"Nguyễn Văn A"` (unaccent tiếng Việt) **VÀ** match `"NGUYEN01"` (employeeCode).
- Substring (contains), case-insensitive, không phân biệt dấu.
- Search rỗng/whitespace → không apply filter.

### 4. Export endpoint — cùng bộ params, KHÔNG paginate

`GET /v1/reports/attendance/export` accept cùng bộ query params (bao gồm `search`), nhưng **bỏ qua `page`/`limit`** — luôn trả full list matching filter dưới dạng `.xlsx`. Response type vẫn là binary file, không phải JSON.

---

## Checklist FE

- [ ] Update type `QueryAttendanceReportParams` — thêm `search`, `page`, `limit`.
- [ ] Update composable/service `fetchAttendanceReport` — return `{ items, meta }` thay vì array. Adapt caller code.
- [ ] Màn báo cáo chấm công:
  - [ ] Thêm ô search box (tên hoặc mã), debounce 300-500ms.
  - [ ] Thêm pagination control (page, page size selector 10/20/50/100).
  - [ ] Reset về page 1 khi đổi filter (year/month/departmentId/search).
  - [ ] Hiển thị `meta.total` (ví dụ "Tổng 47 nhân viên").
- [ ] Nút "Export Excel" — truyền cùng bộ filter (bao gồm search) nhưng KHÔNG truyền page/limit (hoặc truyền cũng OK, BE ignore).
- [ ] Empty state khi `data.length === 0`:
  - Không có filter → "Chưa có dữ liệu tháng này"
  - Có search/filter → "Không tìm thấy nhân viên phù hợp"

## Không cần làm

- [ ] Field trong từng row báo cáo không đổi — không cần sửa render logic của row.
- [ ] Không cần validate search client-side — BE handle rỗng/whitespace.
- [ ] Không có endpoint metadata mới cần call — search chỉ nhận string trực tiếp.
