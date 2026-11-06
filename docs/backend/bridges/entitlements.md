# Bridge Docs — Quyền dùng module (`/v1/me/entitlements`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.

Mỗi công ty được người vận hành bật, tắt hoặc đặt hạn dùng cho từng module. **API là nơi chặn thật:**
FE ẩn menu chỉ để người dùng không bấm vào chỗ không dùng được, và ADMIN của công ty cũng không đi
vòng được. Thiết kế: `docs/control-plane.md`, mục "Quyền dùng module".

---

## Endpoints

| Method | Path | Auth | Ghi chú |
|--------|------|------|---------|
| GET | `/v1/me/entitlements` | JWT | Trạng thái mọi module của công ty trong phiên hiện tại |

---

## TypeScript Types

```typescript
export type ModuleCode =
  | 'CORE'
  | 'AI_AGENT'
  | 'REPORTS'
  | 'OVERTIME'
  | 'ONLINE_WORK'
  | 'BUSINESS_TRIP'
  | 'CONTRACT_INSURANCE'
  | 'ANNOUNCEMENT';
// Danh mục sẽ có thêm module. Gặp mã lạ thì bỏ qua, không lỗi.

export type ModuleState = 'ENABLED' | 'READ_ONLY' | 'DISABLED';

export type ModuleStateReason =
  | 'NOT_SUBSCRIBED'  // công ty chưa đăng ký module bán thêm
  | 'SUSPENDED'       // người vận hành tắt
  | 'READ_ONLY'       // người vận hành đặt chỉ xem
  | 'EXPIRED'         // quá hạn dùng, tự về chỉ xem
  | null;             // dùng đầy đủ

export interface ModuleEntitlement {
  code: ModuleCode;
  label: string;              // tên tiếng Việt, hiển thị được ngay
  state: ModuleState;
  reason: ModuleStateReason;
  expiresAt: string | null;   // ISO 8601. Có thể có cả khi đang ENABLED: dùng để báo sắp hết hạn
}

export interface EntitlementsResponse {
  modules: ModuleEntitlement[];
}
```

---

## GET `/v1/me/entitlements`

**Response 200:**

```json
{
  "success": true,
  "data": {
    "modules": [
      { "code": "CORE", "label": "Lõi nhân sự", "state": "ENABLED", "reason": null, "expiresAt": null },
      { "code": "OVERTIME", "label": "Làm thêm giờ", "state": "READ_ONLY", "reason": "EXPIRED", "expiresAt": "2026-10-31T16:59:59.999Z" },
      { "code": "REPORTS", "label": "Báo cáo", "state": "DISABLED", "reason": "SUSPENDED", "expiresAt": null }
    ]
  }
}
```

| Status | Mã | Khi nào |
|---|---|---|
| 401 | | Chưa đăng nhập |
| 403 | `TENANT_SUSPENDED` | Công ty ngừng dịch vụ |
| 503 | `TENANT_MAINTENANCE` | Công ty đang bảo trì |

Người vận hành đổi quyền thì API áp dụng trong vòng 30 giây. Riêng hạn dùng có hiệu lực đúng lúc.
Gọi lại endpoint này sau khi đăng nhập, chọn hoặc chuyển công ty, và khi một API trả mã `MODULE_*`.

---

## Trạng thái và cách FE xử lý

| `state` | `reason` | Trên API | FE |
|---|---|---|---|
| `ENABLED` | `null` | Bình thường | Bình thường |
| `READ_ONLY` | `READ_ONLY` | GET được, ghi trả 403 `MODULE_READ_ONLY` | Vẫn hiện menu, ẩn nút tạo, sửa, duyệt |
| `READ_ONLY` | `EXPIRED` | GET được, ghi trả 403 `MODULE_EXPIRED` | Như trên, kèm dòng báo đã hết hạn |
| `DISABLED` | `SUSPENDED` | Mọi route trả 403 `MODULE_SUSPENDED` | Ẩn menu, chặn màn hình |
| `DISABLED` | `NOT_SUBSCRIBED` | Mọi route trả 403 `MODULE_NOT_SUBSCRIBED` | Ẩn menu, chặn màn hình |

**Gọi endpoint này lỗi thì đừng khoá người dùng:** coi mọi module đang dùng được, API vẫn chặn ở phía
sau. Đây cũng là cách chạy với BE bản cũ chưa có endpoint (404).

---

## Mã lỗi `MODULE_*` trên route của module

Lỗi theo envelope chung, `message` là tiếng Việt hiển thị được ngay:

```json
{ "success": false, "error": { "code": "MODULE_READ_ONLY", "message": "Tính năng này đang ở chế độ chỉ xem, không chỉnh sửa được." } }
```

| HTTP | Mã | Xử lý |
|---|---|---|
| 403 | `MODULE_NOT_SUBSCRIBED` | Hiện `message`, tải lại entitlements. **Không** đăng xuất |
| 403 | `MODULE_SUSPENDED` | Như trên |
| 403 | `MODULE_READ_ONLY` | Hiện `message`, giữ nguyên dữ liệu người dùng đang nhập |
| 403 | `MODULE_EXPIRED` | Như trên |

---

## Route theo module

| Mã | Route bị chặn |
|---|---|
| `AI_AGENT` | `/v1/agent/*` |
| `REPORTS` | `/v1/reports/*` |
| `OVERTIME` | `/v1/overtime-requests/*`, `/v1/approval/overtime-requests/*`, `/v1/reports/overtime`, `/v1/reports/overtime/export` |
| `ONLINE_WORK` | `/v1/online-work-requests/*`, `/v1/approval/online-work-requests/*`, `/v1/reports/online-work`, `/v1/reports/online-work/export` |
| `BUSINESS_TRIP` | `/v1/business-trips/*`, `/v1/approval/business-trips/*` |
| `CONTRACT_INSURANCE` | `/v1/contracts/*`, `/v1/social-insurance/*` |
| `ANNOUNCEMENT` | `/v1/company-announcements/*` |

Ba route sau không sửa dữ liệu nghiệp vụ nên vẫn gọi được khi chỉ xem hoặc hết hạn, và chỉ bị chặn
khi module đã tắt:

| Route | Vì sao |
|---|---|
| `POST /v1/overtime-requests/preview` | Chỉ tính thử, không ghi |
| `POST /v1/social-insurance/me` | Nhân viên xem BHXH của mình, POST vì phải gửi lại mật khẩu |
| `PATCH /v1/company-announcements/:id/read` | Chỉ ghi nhận người này đã đọc |

Route thuộc module khác nhưng được gọi từ màn hình lõi: `GET /v1/reports/violations/export` thuộc
`REPORTS`, trang Vi phạm thì thuộc lõi, nên ẩn nút xuất khi `REPORTS` đã tắt.

---

## Số liệu ở route không bị chặn

Các route này thuộc lõi nên vẫn trả 200, chỉ bỏ phần của module:

| Route | Trường | Khi nào |
|---|---|---|
| `GET /v1/approval/counts` | `overtimeRequests`, `onlineWorkRequests`, `businessTrips` về 0 | Module không `ENABLED`, vì không còn đơn để duyệt |
| `GET /v1/dashboard` của quản lý, HR, admin | `pendingOT`, `pendingOnlineWork` về 0 | Module không `ENABLED`, cùng lý do |
| `GET /v1/dashboard` của nhân viên | `pendingOT` về 0 | Module `DISABLED`. Số này là đơn của chính người đó đang chờ, nên chỉ xem thì vẫn còn |
| `GET /v1/dashboard` | `recentActivity` bỏ mục `overtime`, `online_work` | Module `DISABLED`. Chỉ xem thì vẫn còn, và mảng có thể ít hơn 10 mục |
| `GET /v1/dashboard` | `hrAnalytics.contractBreakdown` rỗng, `hrAnalytics.expiringContractsNext30Days` về 0 | `CONTRACT_INSURANCE` `DISABLED` |
| Bảng công tháng `/v1/reports/my/monthly`, `/v1/reports/employees/*/monthly`, `/v1/reports/employees/monthly/export`, `/v1/reports/attendance/export-detail` | Số giờ làm thêm về 0, giữ nguyên cột | `OVERTIME` `DISABLED` |

---

## Edge Cases

| Tình huống | Kết quả |
|---|---|
| Không có token | 401, không lộ trạng thái module |
| Công ty khác cùng hệ thống bị tắt module | Không ảnh hưởng |
| Mã `CORE` | Luôn `ENABLED`, không tắt được |
| Có `expiresAt` trong tương lai | `ENABLED`, `reason: null`. FE có thể báo sắp hết hạn |
| Đã tắt và có `expiresAt` | `DISABLED`: tắt thắng hạn dùng |
| Bật lại sau khi tắt | Dùng lại bình thường, dữ liệu còn nguyên |
| Người dùng đang mở màn hình lúc bị tắt | Request kế tiếp trả `MODULE_SUSPENDED` |
| Socket `/announcements` đang mở khi `ANNOUNCEMENT` bị tắt | Bị ngắt trong tối đa một phút sau khi API nhận trạng thái mới. Mở lại nhận sự kiện `error` mã `MODULE_SUSPENDED` |
| Socket `/announcements` đang mở khi phiên kết thúc (đăng xuất, đổi mật khẩu, vô hiệu tài khoản, gỡ khỏi công ty) | Bị ngắt trong tối đa một phút, sự kiện `error` mã `UNAUTHENTICATED` |
