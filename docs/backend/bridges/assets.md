# Bridge Docs — Quản lý tài sản (`/v1/assets`, module `ASSET`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong
> `{ success, data }`, và [entitlements.md](./entitlements.md) cho cách xử lý trạng thái module.
> Thiết kế đầy đủ: `docs/modules/15-assets.md` (repo BE). Cập nhật 10/11/2026, **bổ sung đợt 2 lô 2a ngày
> 13/11/2026** (mục "Đợt 2" cuối file). Ví dụ JSON của đợt 1 lấy từ response thật của API; ví dụ của đợt 2 dựng
> theo transformer và đã đối chiếu bằng bài smoke 68/68, nhưng không chụp nguyên văn.

Module **bán riêng**: công ty chưa được cấp thì mọi route trả 403 `MODULE_NOT_SUBSCRIBED`. Có hai họ tài sản
dùng chung một bảng và một bộ route:

- **Tài sản hữu hình** (`kind: 'PHYSICAL'`): máy tính, màn hình, bàn ghế, xe. Giao cho **một người** hoặc
  **một phòng ban** kèm người chịu trách nhiệm. Người nhận phải xác nhận đã nhận. Có sửa chữa và khấu hao.
- **Dịch vụ thuê bao** (`kind: 'SERVICE'`): VPS, tên miền, ChatGPT Team, license phần mềm. Cấp theo **ghế**
  cho nhiều người cùng lúc, có người phụ trách, có lịch gia hạn và license key.

---

## Endpoints

Mọi route cần JWT. Cột **RO** đánh dấu route vẫn chạy khi module ở trạng thái chỉ xem (mục "Trạng thái
module"). Route trang quản lý chỉ nhận vai trò `ADMIN`, `HR`, `DIRECTOR`, `MANAGER`, `CHIEF`.

### Trang quản lý

| Method | Path | Điều kiện gọi | RO | Ghi chú |
|--------|------|---------------|----|---------|
| GET | `/v1/asset-categories` | `asset:read` | ✓ | Loại tài sản, dạng Nhóm → Loại |
| POST | `/v1/asset-categories` | `asset:manage` | | Tạo loại |
| PATCH | `/v1/asset-categories/:id` | `asset:manage` | | Sửa loại, ngừng dùng bằng `isActive: false` |
| GET | `/v1/asset-vendors` | `asset:read` | ✓ | Nhà cung cấp |
| GET | `/v1/asset-vendors/:id` | `asset:read` + phạm vi | ✓ | Kèm tài sản đã mua và phiếu sửa trong phạm vi người xem |
| POST | `/v1/asset-vendors` | `asset:manage` | | Tạo nhà cung cấp |
| PATCH | `/v1/asset-vendors/:id` | `asset:manage` | | Sửa nhà cung cấp |
| GET | `/v1/assets` | `asset:read` + phạm vi | ✓ | Danh sách có phân trang |
| GET | `/v1/assets/export` | `asset:read` + phạm vi | ✓ | Excel theo đúng bộ lọc danh sách |
| POST | `/v1/assets` | `asset:manage` | | Tạo tài sản hoặc dịch vụ |
| GET | `/v1/assets/:id` | `asset:read` + phạm vi | ✓ | Chi tiết |
| PATCH | `/v1/assets/:id` | `asset:manage` | | Sửa |
| DELETE | `/v1/assets/:id` | `asset:manage` | | Xoá bản nhập nhầm (204) |
| POST | `/v1/assets/:id/status` | `asset:manage` | | Đánh dấu Mất, huỷ dịch vụ |
| GET | `/v1/assets/:id/events` | `asset:read` + phạm vi | ✓ | Lịch sử, mới nhất trước |
| GET | `/v1/assets/:id/assignments` | `asset:read` + phạm vi | ✓ | Mọi lần cấp phát, cả đã thu hồi |
| POST | `/v1/assets/:id/assignments` | `asset:manage` | | Cấp phát thiết bị hoặc cấp ghế |
| POST | `/v1/assets/:id/transfer` | `asset:manage` | | Điều chuyển thiết bị sang người khác |
| POST | `/v1/asset-assignments/:id/return` | `asset:manage` | ✓ | Thu hồi |
| GET | `/v1/assets/:id/depreciation` | `asset:value:read` | ✓ | Lịch khấu hao |
| GET | `/v1/assets/:id/renewals` | `asset:read` + phạm vi | ✓ | Các lần gia hạn dịch vụ |
| POST | `/v1/assets/:id/renewals` | `asset:manage` | | Ghi nhận gia hạn |
| PUT | `/v1/assets/:id/license-key` | `asset:manage` | | Đặt hoặc thay license key |
| DELETE | `/v1/assets/:id/license-key` | `asset:manage` | | Xoá license key |
| POST | `/v1/assets/:id/license-key/reveal` | `asset:read`, và phải là `ADMIN` hoặc người phụ trách | ✓ | Xem key đầy đủ |
| POST | `/v1/assets/:id/maintenances` | `asset:manage` | | Mở phiếu sửa, hoặc phiếu bảo dưỡng với `type: 'MAINTENANCE'` (đợt 2) |
| GET | `/v1/asset-maintenances` | `asset:read` + phạm vi | ✓ | Danh sách phiếu sửa, bảo dưỡng có phân trang; lọc `type` (đợt 2) |
| PATCH | `/v1/asset-maintenances/:id` | `asset:manage` | | Sửa phiếu đang mở |
| POST | `/v1/asset-maintenances/:id/close` | `asset:manage` | | Đóng phiếu |
| POST | `/v1/asset-documents` | `asset:manage` | | Tải giấy tờ lên (`multipart/form-data`) |
| GET | `/v1/assets/:id/documents` | `asset:read` + phạm vi | ✓ | Giấy tờ của tài sản |
| GET | `/v1/asset-documents/:id/url` | `asset:read` + phạm vi | ✓ | Presigned URL để mở file |
| POST | `/v1/asset-documents/:id/links` | `asset:manage` | | Gắn giấy tờ vào thêm một đích |
| DELETE | `/v1/asset-documents/:id/links/:linkId` | `asset:manage` | | Gỡ một đích (204) |
| DELETE | `/v1/asset-documents/:id` | `asset:manage` | | Xoá giấy tờ (204) |
| GET | `/v1/asset-reports/depreciation` | `asset:value:read` | ✓ | Bảng khấu hao tại một ngày |
| GET | `/v1/asset-reports/depreciation/export` | `asset:value:read` | ✓ | Bảng khấu hao dạng Excel |
| GET | `/v1/asset-reports/expiring` | `asset:read` | ✓ | Sắp đến hạn gia hạn, sắp hết bảo hành |
| GET | `/v1/asset-reports/overview` | `asset:read` + phạm vi | ✓ | **Đợt 2.** Tổng quan module (F-22) |
| GET | `/v1/asset-reports/service-costs` · `/export` | `asset:value:read` | ✓ | **Đợt 2.** Chi phí dịch vụ theo tháng (RP-02) |
| GET | `/v1/asset-reports/maintenance-costs` · `/export` | `asset:value:read` | ✓ | **Đợt 2.** Chi phí sửa chữa, bảo dưỡng (RP-05) |
| GET | `/v1/asset-reports/accounting-export` | `asset:value:read` | ✓ | **Đợt 2.** Excel cho kế toán theo kỳ (F-29) |
| GET | `/v1/asset-assignments/:id/handover-pdf` | `asset:manage` | ✓ | **Đợt 2.** Biên bản bàn giao, thu hồi PDF (F-20) |
| GET | `/v1/asset-incidents` | `asset:read` + phạm vi | ✓ | **Đợt 2.** Báo hỏng, báo mất (F-12), lọc `status`, `type`, `assetId` |
| GET | `/v1/asset-incidents/:id` | `asset:read` + phạm vi | ✓ | **Đợt 2.** Chi tiết một báo cáo |
| POST | `/v1/asset-incidents/:id/repair` | `asset:manage` | | **Đợt 2.** Tạo phiếu sửa từ báo hỏng |
| POST | `/v1/asset-incidents/:id/confirm-loss` | `asset:manage` | | **Đợt 2.** Xác nhận báo mất |
| POST | `/v1/asset-incidents/:id/close` | `asset:manage` | | **Đợt 2.** Đóng: không cần sửa, hoặc đã tìm thấy |
| GET | `/v1/asset-imports/template` | `asset:manage` | ✓ | File mẫu nhập Excel |
| POST | `/v1/asset-imports` | `asset:manage` | | Nhập Excel (`multipart/form-data`) |
| GET | `/v1/employees/:employeeId/assets` | `asset:read` + phạm vi | ✓ | Tab Tài sản trong hồ sơ nhân viên |
| POST | `/v1/employees/:employeeId/assets/return-all` | `asset:manage` | ✓ | Thu hồi tất cả khi cho nghỉ việc |

### Tự phục vụ (chỉ cần đăng nhập, mọi vai trò)

| Method | Path | Điều kiện gọi | RO | Ghi chú |
|--------|------|---------------|----|---------|
| GET | `/v1/me/assets` | Mọi user | ✓ | Tài sản và ghế mình đang giữ, đã giữ |
| POST | `/v1/me/assets/assignments/:id/confirm` | Người nhận hoặc người chịu trách nhiệm | ✓ | Xác nhận đã nhận, hoặc báo không đúng |
| GET | `/v1/me/assets/documents/:id/url` | Người nhận của lần bàn giao, hoặc người gửi báo hỏng | ✓ | Mở biên bản, ảnh tình trạng, ảnh báo hỏng của mình |
| GET | `/v1/me/assets/assignments/:id/handover-pdf` | Người nhận hoặc người chịu trách nhiệm | ✓ | **Đợt 2.** Biên bản PDF của lần bàn giao cho mình |
| POST | `/v1/me/assets/:assetId/incidents` | Người đang giữ hoặc chịu trách nhiệm | | **Đợt 2.** Báo hỏng, báo mất (`multipart/form-data`) |
| GET | `/v1/me/assets/incidents` | Mọi user | ✓ | **Đợt 2.** Báo cáo mình đã gửi, lọc như route quản lý |
| GET | `/v1/me/asset-services` | Mọi user | ✓ | Dịch vụ mình phụ trách (mảng rỗng nếu không có) |
| GET | `/v1/me/asset-services/:id/renewals` | Người phụ trách | ✓ | |
| POST | `/v1/me/asset-services/:id/renewals` | Người phụ trách | | Ghi nhận gia hạn |
| POST | `/v1/me/asset-services/:id/seats` | Người phụ trách | | Cấp ghế |
| POST | `/v1/me/asset-services/:id/seats/:assignmentId/return` | Người phụ trách | ✓ | Thu ghế |
| PUT | `/v1/me/asset-services/:id/license-key` | Người phụ trách | | Đặt hoặc thay key |
| DELETE | `/v1/me/asset-services/:id/license-key` | Người phụ trách | | Xoá key |
| POST | `/v1/me/asset-services/:id/license-key/reveal` | Người phụ trách | ✓ | Xem key đầy đủ |
| POST | `/v1/me/asset-services/:id/documents` | Người phụ trách | | Đính kèm hoá đơn vào lần gia hạn |

> **Lưu ý thứ tự route:** `/v1/assets/export` được khai báo **trước** `/v1/assets/:id`.
>
> **Không có route đơn vị sở hữu.** Mỗi công ty có đúng một đơn vị, xem mục "Mã tài sản và đơn vị sở hữu".

---

## Quyền và phạm vi dữ liệu

### Quyền

| Mã | Ý nghĩa | HR | DIRECTOR | MANAGER | CHIEF | EMPLOYEE |
|---|---|---|---|---|---|---|
| `asset:read` | Xem tài sản, dịch vụ, nhà cung cấp, báo cáo sắp hết hạn | ✓ | ✓ | ✓ | ✓ | – |
| `asset:value:read` | Xem nguyên giá, chi phí, khấu hao | ✓ | ✓ | – | ✓ | – |
| `asset:manage` | Tạo, sửa, cấp phát, thu hồi, sửa chữa, gia hạn, giấy tờ, cài đặt, nhập Excel | ✓ | – | – | – | – |

`ADMIN` có tất cả. ADMIN gán thêm được `asset:manage` cho `DIRECTOR`, `MANAGER`, `CHIEF` ở màn Phân quyền.

⚠ **Vai trò `EMPLOYEE` gọi route trang quản lý luôn nhận 403**, kể cả khi được gán `asset:manage`, vì FE vẫn
chặn EMPLOYEE khỏi `/management/**`. Nhân viên dùng nhóm `/v1/me/...`.

### Phạm vi

| Người gọi | Thấy gì ở `/v1/assets` và các route trang quản lý |
|---|---|
| `ADMIN`, `HR`, `DIRECTOR`, `CHIEF`, hoặc có `asset:manage` | Toàn công ty |
| `MANAGER` | Tài sản đang giao cho người thuộc phòng mình hoặc cho chính phòng mình |
| Người phụ trách dịch vụ | Dịch vụ mình phụ trách, qua `/v1/me/asset-services` |
| Mọi nhân viên | Thứ mình đang giữ hoặc đã giữ, qua `/v1/me/assets` |

Ngoài phạm vi thì **403 `ASSET_SCOPE_FORBIDDEN`**, không phải 200 kèm mảng rỗng: lọc `departmentId` phòng khác,
mở `/v1/assets/:id` hay `/v1/employees/:id/assets` của phòng khác.

```json
{ "success": false, "error": { "code": "ASSET_SCOPE_FORBIDDEN", "message": "Bạn không có quyền xem tài sản này" } }
```

### Trường tiền

Người thiếu `asset:value:read` nhận **`null`** ở mọi trường tiền: `cost`, `exchangeRate`, `costVnd`, `bookValue`,
`physical.salvageValue`, `service.unitPrice`, `amount`/`exchangeRate`/`amountVnd` của gia hạn, `cost` của phiếu sửa,
`amount` của giấy tờ. Payload sự kiện bỏ các khoá chứa tiền, file Excel bỏ cột tiền. Response tài sản có cờ
**`canViewValue`**: ẩn cột theo cờ này, đừng suy từ vai trò. Hiển thị `null` là "—", không phải 0.

Ví dụ cùng một laptop, `MANAGER` nhận:

```json
{ "cost": null, "costVnd": null, "bookValue": null, "physical": { "salvageValue": null }, "canViewValue": false }
```

Ngoại lệ: người phụ trách dịch vụ thấy lại số tiền của lần gia hạn **chính mình vừa nhập** (response của
`POST /v1/me/asset-services/:id/renewals`).

### License key

Chỉ lưu license key, đã mã hoá. **Không có chỗ nào lưu mật khẩu, API key hay mã 2FA**: dùng
`service.passwordManagerUrl` để trỏ sang password manager.

- Response chỉ có `service.hasLicenseKey` và `service.licenseKeyMasked` (`"••••PQRS"`).
- Xem bản đầy đủ chỉ có ADMIN (qua `/v1/assets/:id/license-key/reveal`) và người phụ trách của chính dịch vụ đó
  (qua `/v1/me/asset-services/:id/license-key/reveal`). `HR` có `asset:manage` đặt hay thay được key nhưng **không
  xem được**. Mỗi lần xem ghi nhật ký `asset.license_key_view`.
- Nên **ẩn nút Xem key** với người không phải ADMIN hay người phụ trách; API vẫn chặn 403 nếu bị gọi thẳng.
- Người không phải ADMIN không tự nhận mình là người phụ trách được (403 `ASSET_OWNER_SELF_ASSIGN`), nên HR không
  đi vòng qua việc đổi người phụ trách để đọc key.
- Response xem key có `Cache-Control: no-store`. FE giữ key trong một biến cục bộ, tự che lại sau vài giây,
  **không** đưa vào store, localStorage hay log.
- Server chưa cấu hình khoá mã hoá thì đặt hoặc xem key trả 503 `ASSET_SECRET_KEY_NOT_CONFIGURED`, phần còn lại
  của module vẫn chạy.

---

## Trạng thái module

| `state` (từ `/v1/me/entitlements`) | Hành vi |
|---|---|
| `ENABLED` | Bình thường |
| `READ_ONLY` | Mọi `GET` và xuất Excel chạy. Ghi trả 403 `MODULE_READ_ONLY` hoặc `MODULE_EXPIRED`, **trừ** các route có ✓ ở cột RO |
| `DISABLED` | Mọi route 403 `MODULE_*`. Ẩn menu Tài sản, tab Tài sản trong hồ sơ nhân viên và cảnh báo tài sản ở hộp thoại nghỉ việc |

Các route ghi vẫn chạy khi chỉ xem là thu hồi, thu hồi tất cả, xác nhận bàn giao, thu ghế và xem license key,
để không kẹt việc bàn giao hay cho nghỉ việc.

---

## Quy ước chung

- **Ngày thuần** (`purchaseDate`, `assignedAt`, `nextRenewalDate`, `paidAt`...) gửi và nhận dạng `YYYY-MM-DD`. Ngày
  không có thật (`2026-02-30`) → 400 `ASSET_INVALID_DATE`. **Thời điểm** (`createdAt`, `occurredAt`, `confirmedAt`,
  `uploadedAt`) là ISO 8601 đầy đủ.
- **Tiền** là số (`18000000`, `150`), không phải chuỗi. `currency` là mã 3 chữ in hoa, mặc định `VND`. Có số tiền mà
  khác VND thì phải kèm `exchangeRate` (400 `ASSET_EXCHANGE_RATE_REQUIRED`); BE tự quy ra `costVnd`/`amountVnd`, làm
  tròn đến đồng.
- **Mọi enum có `*Label` tiếng Việt** đi kèm (`status` + `statusLabel`, `kind` + `kindLabel`...). Hiển thị nhãn,
  đừng tự dịch mã.
- **Trường tuỳ chọn gửi `""` hay `null` đều coi như không gửi.** Ô ngày để trống không bị 400.
- ⚠ **`PATCH` chưa xoá được một trường tuỳ chọn đã có giá trị** (ghi chú, nhà cung cấp, serial, hạn bảo hành...),
  vì `null`/`""` bị coi là "không đổi". FE cứ gửi nguyên form, đừng tự lọc; khi BE hỗ trợ xoá sẽ báo lại.
- **BE trả một lỗi validate mỗi lần**, không gộp. Form giữ nguyên dữ liệu để người dùng sửa lần lượt.
- Danh sách có phân trang (`/v1/assets`, `/v1/asset-maintenances`) trả `meta { page, limit, total, totalPages }`,
  `limit` tối đa 100. Các danh sách khác trả mảng.

---

## TypeScript Types

```typescript
// types/asset.types.ts

// ── Enum (mã) ──
export type AssetKind = 'PHYSICAL' | 'SERVICE';
export type AssetStatus =
  | 'AVAILABLE' | 'IN_USE' | 'IN_REPAIR' | 'BROKEN' | 'LOST' | 'DISPOSED' // thiết bị
  | 'LOSS_REPORTED' | 'IN_MAINTENANCE'                                    // thiết bị, đợt 2
  | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';                                   // dịch vụ
export type AssetMaintenanceType = 'REPAIR' | 'MAINTENANCE';               // đợt 2 thêm MAINTENANCE
export type AssetIncidentType = 'DAMAGE' | 'LOSS';                         // đợt 2
export type AssetIncidentStatus = 'OPEN' | 'REPAIR_OPENED' | 'LOSS_CONFIRMED' | 'CLOSED'; // đợt 2
export type AssetCondition = 'NEW' | 'GOOD' | 'SCRATCHED' | 'FAULTY' | 'BROKEN';
export type AssetAccountingClass = 'FIXED_ASSET' | 'TOOL';
export type AssetBillingCycle = 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'ONE_TIME';
export type AssetPricingUnit = 'PER_SEAT' | 'PER_PLAN';
export type AssetAssignmentConfirmation = 'PENDING' | 'CONFIRMED' | 'DISPUTED' | 'NOT_REQUIRED';
export type AssetMaintenanceStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'UNREPAIRABLE' | 'CANCELLED';
export type AssetVendorType = 'SUPPLIER' | 'REPAIR' | 'SERVICE';
export type AssetDocumentType =
  | 'PURCHASE_CONTRACT' | 'SERVICE_CONTRACT' | 'INVOICE' | 'WARRANTY' | 'HANDOVER_RECORD'
  | 'CONDITION_PHOTO' | 'REPAIR_QUOTE' | 'DISPOSAL_RECORD' | 'OTHER';
export type AssetEventType =
  | 'CREATED' | 'UPDATED' | 'STATUS_CHANGED' | 'ASSIGNED' | 'RETURNED' | 'ASSIGNMENT_CONFIRMED'
  | 'ASSIGNMENT_DISPUTED' | 'REPAIR_OPENED' | 'REPAIR_CLOSED' | 'RENEWED' | 'SEATS_CHANGED'
  | 'VALUE_CHANGED' | 'DOCUMENT_ADDED' | 'DOCUMENT_REMOVED' | 'LICENSE_KEY_CHANGED'
  | 'INCIDENT_REPORTED' | 'INCIDENT_HANDLED' | 'MAINTENANCE_SCHEDULED';  // đợt 2

// ── Thành phần dùng lại ──
export interface PersonSummary { id: number; fullName: string; employeeCode: string }
export interface IdName { id: number; name: string }

// ── Danh mục ──
export interface AssetCategory {
  id: number;
  name: string;                  // Loại, VD "Laptop"
  groupName: string;             // Nhóm, VD "Máy tính". Màn cài đặt hiển thị Nhóm → Loại
  kind: AssetKind; kindLabel: string;
  defaultDepreciationMonths: number | null; // null = loại này không khấu hao
  defaultMaintenanceMonths: number | null;  // đợt 2. Chu kỳ bảo dưỡng mặc định; null = không có lịch
  requireSerial: boolean;
  isActive: boolean;
}
export interface AssetOwnerUnit { // chỉ đọc: mỗi công ty đúng một đơn vị, tự có
  id: number;
  code: string;                  // mã công ty chuẩn hoá, tiền tố mã tài sản: "cty-sth" → CTYSTH → CTYSTH000140
  name: string;                  // tên công ty
  isDefault: boolean;
  isActive: boolean;
}
export interface AssetVendor {
  id: number; name: string;
  types: AssetVendorType[]; typeLabels: string[];
  taxCode: string | null; address: string | null; website: string | null;
  contactName: string | null; phone: string | null; email: string | null; note: string | null;
  isActive: boolean;
}
export interface AssetVendorDetail extends AssetVendor {
  assets: { id: number; code: string; name: string; kind: AssetKind; statusLabel: string }[];
  maintenances: { id: number; statusLabel: string; description: string; assetCode: string; doneAt: string | null }[];
}

// ── Tài sản ──
export interface AssetHolder {   // cấp phát đang mở; dịch vụ: mỗi phần tử là một ghế
  assignmentId: number;
  employee: PersonSummary | null;
  department: IdName | null;     // giao cho phòng ban
  responsible: PersonSummary | null; // người chịu trách nhiệm khi giao cho phòng ban
  assignedAt: string;
  confirmation: AssetAssignmentConfirmation; confirmationLabel: string;
}
export interface AssetPhysical {
  manufacturer: string | null; model: string | null; serialNumber: string | null; location: string | null;
  condition: AssetCondition | null; conditionLabel: string | null;
  warrantyMonths: number | null; warrantyEndDate: string | null;
  depreciationStartDate: string | null; depreciationMonths: number | null;
  salvageValue: number | null;         // tiền
  depreciationStopDate: string | null; // ngày mất, thôi trích khấu hao từ ngày này
  accountingClass: AssetAccountingClass | null; accountingClassLabel: string | null;
  maintenanceIntervalMonths: number | null; // đợt 2. Chu kỳ bảo dưỡng (tháng); null = không có lịch
  nextMaintenanceDate: string | null;       // đợt 2. Hạn bảo dưỡng kế tiếp, YYYY-MM-DD
}
export interface AssetService {
  plan: string | null;
  billingCycle: AssetBillingCycle; billingCycleLabel: string;
  nextRenewalDate: string | null;      // null khi mua đứt (ONE_TIME)
  daysUntilRenewal: number | null;     // âm là đã quá hạn. Tô màu theo số này
  anchorDay: number | null;
  seatCount: number | null;            // null = không tính theo ghế
  seatsUsed: number;                   // vượt seatCount là được phép, chỉ cảnh báo
  unitPrice: number | null;            // tiền
  pricingUnit: AssetPricingUnit; pricingUnitLabel: string;
  autoRenew: boolean;
  owner: PersonSummary;                // người phụ trách
  adminAccount: string | null; adminUrl: string | null; passwordManagerUrl: string | null;
  paymentMethodNote: string | null;    // chỉ tên thẻ và 4 số cuối
  technicalInfo: string | null;
  hasLicenseKey: boolean; licenseKeyMasked: string | null;
}
export interface Asset {
  id: number;
  code: string;                        // CTYSTH000001
  name: string;
  kind: AssetKind; kindLabel: string;
  status: AssetStatus; statusLabel: string;
  category: AssetCategory;
  ownerUnit: AssetOwnerUnit;
  vendor: IdName | null;
  purchaseDate: string | null;
  cost: number | null; currency: string; exchangeRate: number | null; costVnd: number | null; // tiền
  bookValue: number | null;            // giá trị còn lại hôm nay, chỉ thiết bị có khấu hao. Tiền
  note: string | null;
  holders: AssetHolder[];
  physical: AssetPhysical | null;      // có khi kind = PHYSICAL
  service: AssetService | null;        // có khi kind = SERVICE
  openIncidents: AssetOpenIncident[];  // đợt 2. Báo hỏng, báo mất đang chờ xử lý; rỗng = không có
  canViewValue: boolean;
  createdAt: string; updatedAt: string;
}
export interface AssetOpenIncident {   // đợt 2
  id: number;
  type: AssetIncidentType; typeLabel: string;
  createdAt: string;
}

export interface AssetEvent {
  id: number;
  type: AssetEventType; typeLabel: string;
  actor: IdName | null;                // null khi do việc định kỳ
  occurredAt: string;
  payload: Record<string, unknown>;    // tuỳ loại; chỉ để hiện chi tiết phụ, đừng dựa vào cấu trúc
}

// ── Cấp phát ──
export interface AssetAssignment {
  id: number;
  asset: { id: number; code: string; name: string; kind: AssetKind; kindLabel: string;
           status: AssetStatus; statusLabel: string; categoryName: string; groupName: string };
  employee: PersonSummary | null; department: IdName | null; responsible: PersonSummary | null;
  assignedAt: string; assignedBy: IdName;
  conditionOnAssign: AssetCondition | null; conditionOnAssignLabel: string | null;
  expectedReturnDate: string | null; note: string | null;
  confirmation: AssetAssignmentConfirmation; confirmationLabel: string;
  confirmedAt: string | null; disputeReason: string | null;
  returnedAt: string | null;           // null = đang giữ
  returnedBy: IdName | null;
  conditionOnReturn: AssetCondition | null; conditionOnReturnLabel: string | null;
  returnNote: string | null;
}
export interface AssignResult { assignment: AssetAssignment; warnings: 'SEATS_EXCEEDED'[] }
export interface MyAssets {
  holding: AssetAssignment[];          // đang giữ, gồm cả thứ mình chịu trách nhiệm thay phòng ban
  history: AssetAssignment[];          // đã trả
  pendingConfirmationCount: number;    // badge của menu "Tài sản của tôi"
}

// ── Gia hạn, sửa chữa, giấy tờ ──
export interface AssetRenewal {
  id: number;
  periodStart: string; periodEnd: string;
  seatCount: number | null;
  amount: number | null; currency: string; exchangeRate: number | null; amountVnd: number | null; // tiền
  paidAt: string; note: string | null;
  createdBy: IdName;
}
export interface AssetMaintenance {
  id: number;
  asset: { id: number; code: string; name: string };
  type: AssetMaintenanceType; typeLabel: string; // "Sửa chữa" | "Bảo dưỡng"
  status: AssetMaintenanceStatus; statusLabel: string;
  description: string; workDone: string | null;
  vendor: IdName | null; underWarranty: boolean;
  cost: number | null;                 // tiền
  sentAt: string | null; expectedDoneAt: string | null; doneAt: string | null;
  createdBy: IdName | null;            // đợt 2: null = phiếu bảo dưỡng hệ thống tự mở (J-03), hiện "Hệ thống"
  createdAt: string;
}
export interface AssetDocument {
  id: number;
  type: AssetDocumentType; typeLabel: string;
  number: string | null; issuedDate: string | null;
  amount: number | null;               // tiền
  fileName: string; mimeType: string; sizeBytes: number;
  uploadedBy: IdName; uploadedAt: string;
  links: { id: number; assetId: number | null; assetCode: string | null;
           assignmentId: number | null; renewalId: number | null; maintenanceId: number | null;
           incidentId: number | null }[]; // đợt 2: ảnh của báo hỏng, báo mất
  // KHÔNG có URL file: lấy qua GET .../documents/:id/url khi bấm
}

// ── Khấu hao, báo cáo, nhập Excel ──
export interface DepreciationPeriod {
  month: string;                       // "2025-03"
  from: string; to: string; days: number; daysInMonth: number;
  amount: number; accumulated: number; bookValue: number;
}
export interface AssetDepreciation {
  asOf: string;
  costVnd: number | null; salvageValue: number;
  startDate: string | null; months: number | null; stopDate: string | null;
  accumulated: number; bookValue: number | null;
  accountingClass: AssetAccountingClass | null; accountingClassLabel: string | null;
  suggestedAccountingClass: AssetAccountingClass; suggestedAccountingClassLabel: string;
  schedule: DepreciationPeriod[];
}
export interface DepreciationReport {
  asOf: string;
  rows: { assetId: number; code: string; name: string; categoryName: string; ownerUnitCode: string;
          accountingClass: AssetAccountingClass | null; accountingClassLabel: string | null;
          startDate: string | null; months: number | null;
          costVnd: number; accumulated: number; bookValue: number }[];
  totals: { costVnd: number; accumulated: number; bookValue: number };
}
export interface ExpiringRow {
  type: 'renewal' | 'warranty';
  assetId: number; code: string; name: string;
  date: string;
  daysLeft: number;                    // âm là đã quá hạn
  ownerName: string | null;            // dịch vụ: người phụ trách; thiết bị: người đang giữ
}
export interface ImportResult {
  created: { physical: number; service: number };
  autoCreated: { categories: string[]; vendors: string[] };
  errors: { sheet: 'Tài sản' | 'Dịch vụ'; row: number; messages: string[] }[];
  ignoredColumns: string[];            // VD ["Dịch vụ: Password"]. Báo người dùng các cột mật khẩu đã bỏ qua
}

// ── Request body ──
export interface CreateAssetBody {
  kind: AssetKind;
  name: string;
  categoryId: number;                  // loại phải cùng kind (400 ASSET_CATEGORY_KIND_MISMATCH)
  vendorId?: number;
  code?: string;                       // bỏ trống = tự sinh {mã công ty}{6 số}
  purchaseDate?: string;
  cost?: number; currency?: string; exchangeRate?: number;
  note?: string;
  physical?: {                         // chỉ khi kind = PHYSICAL
    manufacturer?: string; model?: string; serialNumber?: string; location?: string;
    condition?: AssetCondition;
    warrantyMonths?: number;           // có ngày mua thì tự tính warrantyEndDate
    warrantyEndDate?: string;          // nhập thẳng thì thắng warrantyMonths
    depreciationStartDate?: string;    // mặc định ngày mua
    depreciationMonths?: number;       // mặc định theo loại
    salvageValue?: number;
    accountingClass?: AssetAccountingClass; // bỏ trống = BE gợi ý
    maintenanceIntervalMonths?: number;  // đợt 2. 0–120; khi tạo bỏ trống = theo loại; khi sửa 0 = bỏ lịch
    nextMaintenanceDate?: string;        // đợt 2. Bỏ trống = hôm nay + chu kỳ
  };
  service?: {                          // bắt buộc khi kind = SERVICE
    billingCycle: AssetBillingCycle;
    ownerId: number;                   // người phụ trách, phải đang làm việc
    nextRenewalDate?: string;          // bắt buộc trừ ONE_TIME
    anchorDay?: number;                // 1–31, mặc định ngày của nextRenewalDate
    plan?: string; seatCount?: number; unitPrice?: number; pricingUnit?: AssetPricingUnit;
    autoRenew?: boolean;
    adminAccount?: string; adminUrl?: string; passwordManagerUrl?: string;
    paymentMethodNote?: string;        // chuỗi có ≥ 12 chữ số liền → 400 ASSET_PAYMENT_NOTE_INVALID
    technicalInfo?: string;
    licenseKey?: string;               // chỉ khi tạo; sau đó dùng PUT .../license-key
  };
}
// PATCH: như CreateAssetBody trừ `kind`, mọi trường tuỳ chọn; khối `service` không nhận `licenseKey`
export type UpdateAssetBody = Partial<Omit<CreateAssetBody, 'kind' | 'physical' | 'service'>> & {
  physical?: Partial<NonNullable<CreateAssetBody['physical']>>;
  service?: Partial<Omit<NonNullable<CreateAssetBody['service']>, 'licenseKey'>>;
};
export interface AssignBody {
  employeeId?: number;                 // chọn đúng một: employeeId, hoặc departmentId + responsibleId
  departmentId?: number;               // chỉ thiết bị
  responsibleId?: number;              // bắt buộc khi giao phòng ban
  assignedAt?: string;                 // mặc định hôm nay, được nhập ngày quá khứ
  condition?: AssetCondition;
  expectedReturnDate?: string;
  note?: string;
}
export interface TransferBody extends AssignBody { conditionOnReturn?: AssetCondition }
export interface ReturnBody { returnedAt?: string; condition?: AssetCondition; note?: string }
export interface RenewalBody {
  amount: number;                      // số tiền thực trả kỳ này
  currency?: string;                   // mặc định tiền tệ của dịch vụ
  exchangeRate?: number;               // bắt buộc khi khác VND
  paidAt?: string;                     // mặc định hôm nay
  seatCount?: number;                  // khác hiện tại thì cập nhật số ghế của dịch vụ
  nextRenewalDate?: string;            // mặc định theo chu kỳ và ngày neo; sửa được cho kỳ khuyến mãi
  note?: string;
}
```

---

## Status Flow

**Thiết bị**

| Đang | Làm gì | Thành |
|---|---|---|
| `AVAILABLE` | Cấp phát | `IN_USE` |
| `IN_USE` | Điều chuyển | `IN_USE` (người mới) |
| `IN_USE` | Thu hồi, tình trạng khác Hỏng | `AVAILABLE` |
| `IN_USE` | Thu hồi, tình trạng Hỏng | `BROKEN` |
| `AVAILABLE`, `IN_USE`, `BROKEN` | Mở phiếu sửa (người đang giữ giữ nguyên) | `IN_REPAIR` |
| `IN_REPAIR` | Đóng Xong hoặc Huỷ | Có người giữ: `IN_USE`, không: `AVAILABLE` |
| `IN_REPAIR` | Đóng Không sửa được | `BROKEN` |
| `AVAILABLE`, `IN_USE`, `BROKEN` | Đánh dấu Mất | `LOST` |
| `AVAILABLE`, `IN_USE` | **Đợt 2.** Mở phiếu bảo dưỡng (tay hoặc việc định kỳ J-03) | `IN_MAINTENANCE` |
| `IN_MAINTENANCE` | **Đợt 2.** Đóng Xong hoặc Huỷ | Có người giữ: `IN_USE`, không: `AVAILABLE` |
| `AVAILABLE`, `IN_USE`, `BROKEN` | **Đợt 2.** Nhân viên báo mất | `LOSS_REPORTED` |
| `LOSS_REPORTED` | **Đợt 2.** HR xác nhận mất | `LOST` |
| `LOSS_REPORTED` | **Đợt 2.** HR bấm "Đã tìm thấy" | Trạng thái trước khi báo, điều chỉnh theo người đang giữ |

**Dịch vụ**

| Đang | Làm gì | Thành |
|---|---|---|
| `ACTIVE` | Quá hạn gia hạn hơn 3 ngày, `autoRenew = false` (việc định kỳ 00:30) | `EXPIRED` |
| `ACTIVE`, `EXPIRED` | Ghi nhận gia hạn | `ACTIVE` |
| `ACTIVE`, `EXPIRED` không còn ghế | Huỷ | `CANCELLED` |

`DISPOSED` (thanh lý) đã có trong enum nhưng chưa có thao tác, sẽ làm ở lô 2b. Dùng bảng trên để bật tắt nút:
thiết bị `IN_USE` thì hiện Điều chuyển và Thu hồi, ẩn Cấp phát. Bảng nút đầy đủ cho đợt 2 ở mục "Đợt 2 — lô 2a",
phần "Bật tắt nút theo trạng thái".

---

## Mã tài sản và đơn vị sở hữu

- **Mỗi công ty có đúng một đơn vị sở hữu**: mã là mã công ty lúc khởi tạo, bỏ dấu và ký tự đặc biệt
  (`cty-sth` → `CTYSTH`), tên là tên công ty. Không thêm, không sửa được, không có màn hình. Response tài sản có
  `ownerUnit` nếu muốn hiển thị.
- **Mã tài sản** tự sinh theo mã công ty: `CTYSTH000001`, `CTYSTH000002`... Số không cấp lại kể cả khi xoá.
- Mã cũ nhập tay hay nhập từ Excel (`STH000139`) giữ nguyên; cùng tiền tố với mã công ty thì bộ đếm tự kéo lên để
  mã tự sinh sau đó không trùng.

---

## GET /v1/assets — Danh sách

**Query:**

| Param | Type | Ghi chú |
|-------|------|---------|
| `page`, `limit` | number | Mặc định 1, 20; `limit` tối đa 100 |
| `kind` | `AssetKind` | |
| `categoryId` | number | |
| `groupName` | string | Lọc theo Nhóm |
| `status` | `AssetStatus` | |
| `vendorId` | number | |
| `employeeId` | number | Người đang giữ hoặc đang chịu trách nhiệm |
| `departmentId` | number | `MANAGER` lọc phòng khác → 403 |
| `search` | string | Tìm trong mã, tên, serial, model |
| `maintenanceDueWithinDays` | number 1–365 | Đợt 2. Thiết bị đang Sẵn sàng hoặc Đang sử dụng, có lịch bảo dưỡng, hạn kế tiếp ≤ hôm nay + N ngày (gồm cả quá hạn). Tài sản đang sửa, đang bảo dưỡng, mất hay đã thanh lý không có trong danh sách. Ngoài khoảng 1–365 → 400 |
| `pendingConfirmation` | `true` \| `false` | Đợt 2. `true`: tài sản có cấp phát đang chờ người nhận xác nhận. `false` hoặc bỏ trống: không lọc. Giá trị khác → 400 |

Hai thẻ "Sắp bảo dưỡng 30 ngày" và "Chờ người nhận xác nhận" của `GET /v1/asset-reports/overview` đếm bằng đúng hai bộ
lọc này (`maintenanceDueWithinDays=30`, `pendingConfirmation=true`) trong phạm vi người xem, nên số trên thẻ luôn bằng
`meta.total` khi bấm vào. Xuất Excel (`/v1/assets/export`) nhận cả hai.

**Response:** `ApiPaginated<Asset>`

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "STH000001",
      "name": "Laptop Dell Latitude 5440",
      "kind": "PHYSICAL",
      "kindLabel": "Tài sản hữu hình",
      "status": "IN_USE",
      "statusLabel": "Đang sử dụng",
      "category": { "id": 1, "name": "Laptop", "groupName": "Máy tính", "kind": "PHYSICAL", "kindLabel": "Tài sản hữu hình", "defaultDepreciationMonths": 36, "requireSerial": false, "isActive": true },
      "ownerUnit": { "id": 1, "code": "STH", "name": "Công ty STH", "isDefault": true, "isActive": true },
      "vendor": { "id": 1, "name": "Huy Phùng PC" },
      "purchaseDate": "2025-04-20",
      "cost": 26500000,
      "currency": "VND",
      "exchangeRate": 1,
      "costVnd": 26500000,
      "bookValue": 11864847,
      "note": null,
      "holders": [
        {
          "assignmentId": 5,
          "employee": { "id": 6, "fullName": "Nguyễn Văn A", "employeeCode": "EMPA" },
          "department": null,
          "responsible": null,
          "assignedAt": "2026-11-10",
          "confirmation": "PENDING",
          "confirmationLabel": "Chờ xác nhận"
        }
      ],
      "physical": {
        "manufacturer": "Dell", "model": "Latitude 5440", "serialNumber": "DL5440-001", "location": null,
        "condition": "GOOD", "conditionLabel": "Tốt",
        "warrantyMonths": 24, "warrantyEndDate": "2027-03-15",
        "depreciationStartDate": "2025-03-15", "depreciationMonths": 36, "salvageValue": 0,
        "depreciationStopDate": null, "accountingClass": "TOOL", "accountingClassLabel": "Công cụ dụng cụ"
      },
      "service": null,
      "canViewValue": true,
      "createdAt": "2026-11-10T08:33:30.317Z",
      "updatedAt": "2026-11-10T09:21:45.207Z"
    }
  ],
  "meta": { "page": 1, "limit": 2, "total": 6, "totalPages": 3 }
}
```

**403** khi vai trò `EMPLOYEE` gọi:
```json
{ "success": false, "error": { "code": "FORBIDDEN", "message": "Bạn không có quyền thực hiện hành động này" } }
```

`GET /v1/assets/export` nhận đúng bộ query trên (bỏ `page`, `limit`) và trả file `tai-san.xlsx`. Gọi bằng
`responseType: 'blob'`, lấy tên file từ `Content-Disposition`.

---

## GET /v1/assets/:id — Chi tiết

**Response:** `ApiSuccess<Asset>`. Ví dụ một dịch vụ có ghế:

```json
{
  "success": true,
  "data": {
    "id": 5,
    "code": "STH000005",
    "name": "ChatGPT Team",
    "kind": "SERVICE",
    "kindLabel": "Dịch vụ thuê bao",
    "status": "ACTIVE",
    "statusLabel": "Đang hoạt động",
    "category": { "id": 25, "name": "Tài khoản AI", "groupName": "AI & LLM", "kind": "SERVICE", "kindLabel": "Dịch vụ thuê bao", "defaultDepreciationMonths": null, "requireSerial": false, "isActive": true },
    "ownerUnit": { "id": 1, "code": "STH", "name": "Công ty STH", "isDefault": true, "isActive": true },
    "vendor": null,
    "purchaseDate": null,
    "cost": null,
    "currency": "USD",
    "exchangeRate": null,
    "costVnd": null,
    "bookValue": null,
    "note": null,
    "holders": [
      { "assignmentId": 3, "employee": { "id": 6, "fullName": "Nguyễn Văn A", "employeeCode": "EMPA" }, "department": null, "responsible": null, "assignedAt": "2026-11-10", "confirmation": "NOT_REQUIRED", "confirmationLabel": "Không cần xác nhận" },
      { "assignmentId": 4, "employee": { "id": 7, "fullName": "Trần Thị B", "employeeCode": "EMPB" }, "department": null, "responsible": null, "assignedAt": "2026-11-10", "confirmation": "NOT_REQUIRED", "confirmationLabel": "Không cần xác nhận" }
    ],
    "physical": null,
    "service": {
      "plan": "Team",
      "billingCycle": "MONTHLY",
      "billingCycleLabel": "Hằng tháng",
      "nextRenewalDate": "2026-11-20",
      "daysUntilRenewal": 10,
      "anchorDay": 20,
      "seatCount": 5,
      "seatsUsed": 2,
      "unitPrice": 30,
      "pricingUnit": "PER_SEAT",
      "pricingUnitLabel": "Theo ghế",
      "autoRenew": false,
      "owner": { "id": 8, "fullName": "Kỹ Thuật IT", "employeeCode": "IT1" },
      "adminAccount": "it@sth.smoke",
      "adminUrl": null,
      "passwordManagerUrl": "https://vault.example/item/chatgpt",
      "paymentMethodNote": "Thẻ công ty ••4417",
      "technicalInfo": null,
      "hasLicenseKey": true,
      "licenseKeyMasked": "••••PQRS"
    },
    "canViewValue": true,
    "createdAt": "2026-11-10T08:33:30.469Z",
    "updatedAt": "2026-11-10T08:33:30.469Z"
  }
}
```

**404** `ASSET_NOT_FOUND` khi không có hoặc đã xoá; **403** `ASSET_SCOPE_FORBIDDEN` khi ngoài phạm vi.

---

## POST /v1/assets — Tạo tài sản hoặc dịch vụ

**Body:** `CreateAssetBody`

**Ví dụ: thiết bị**
```json
{
  "kind": "PHYSICAL",
  "name": "Bộ máy tính bàn Dell OptiPlex 7010",
  "categoryId": 2,
  "vendorId": 1,
  "purchaseDate": "2026-01-05",
  "cost": 18000000,
  "physical": { "serialNumber": "OPTI7010-01", "location": "Phòng 302", "condition": "NEW", "warrantyMonths": 36 }
}
```

**Ví dụ: dịch vụ tính theo ghế, trả bằng USD**
```json
{
  "kind": "SERVICE",
  "name": "ChatGPT Team",
  "categoryId": 25,
  "currency": "USD",
  "exchangeRate": 26000,
  "service": {
    "plan": "Team",
    "billingCycle": "MONTHLY",
    "nextRenewalDate": "2026-11-20",
    "seatCount": 5,
    "unitPrice": 30,
    "pricingUnit": "PER_SEAT",
    "ownerId": 8,
    "adminAccount": "it@congty.vn",
    "passwordManagerUrl": "https://vault.example/item/chatgpt",
    "paymentMethodNote": "Thẻ công ty ••4417",
    "licenseKey": "ABCDE-FGHIJ-KLMNO-PQRS"
  }
}
```

**Response 201:** `ApiSuccess<Asset>`, cùng shape với chi tiết.

**400** ví dụ khi có số tiền ngoại tệ mà thiếu tỷ giá:
```json
{ "success": false, "error": { "code": "ASSET_EXCHANGE_RATE_REQUIRED", "message": "Tiền USD cần tỷ giá quy đổi ra VND" } }
```

| Mã lỗi | HTTP | Khi nào |
|---|---|---|
| `ASSET_CATEGORY_NOT_FOUND`, `ASSET_CATEGORY_KIND_MISMATCH` | 400 | Loại không có, đã ngừng dùng, hoặc khác họ tài sản |
| `ASSET_DETAIL_KIND_MISMATCH`, `ASSET_SERVICE_DETAIL_REQUIRED` | 400 | Gửi `physical` cho dịch vụ hay ngược lại; dịch vụ thiếu khối `service` |
| `ASSET_RENEWAL_DATE_REQUIRED` | 400 | Dịch vụ định kỳ thiếu `nextRenewalDate` |
| `ASSET_SERIAL_REQUIRED` | 400 | Loại bắt buộc serial |
| `ASSET_PAYMENT_NOTE_INVALID` | 400 | Ghi số thẻ đầy đủ |
| `ASSET_EXCHANGE_RATE_REQUIRED` | 400 | Có số tiền ngoại tệ mà thiếu tỷ giá |
| `ASSET_OWNER_INACTIVE` | 400 | Người phụ trách đã nghỉ việc |
| `ASSET_CODE_EXISTS`, `ASSET_SERIAL_EXISTS` | 409 | Trùng mã, trùng serial (message nói trùng với tài sản nào) |
| `ASSET_SECRET_KEY_NOT_CONFIGURED` | 503 | Gửi `licenseKey` khi server chưa có khoá mã hoá |

---

## PATCH /v1/assets/:id — Sửa

**Body:** `UpdateAssetBody`, gửi trường cần đổi. Response `ApiSuccess<Asset>`. Đổi nguyên giá hay thời gian khấu hao
sinh sự kiện `VALUE_CHANGED`; đổi số ghế sinh `SEATS_CHANGED`. Xem hạn chế xoá trường ở mục "Quy ước chung".

Người không phải ADMIN **không tự đặt mình làm người phụ trách** dịch vụ được (`service.ownerId` bằng chính mình) →
**403 `ASSET_OWNER_SELF_ASSIGN`**, vì người phụ trách xem được license key. Đổi sang người khác vẫn được.

## DELETE /v1/assets/:id — Xoá bản nhập nhầm

**Response: 204 No Content.** Chỉ cho tài sản chưa có lịch sử nào ngoài lúc tạo; đã cấp phát, sửa, gia hạn thì
**409 `ASSET_HAS_HISTORY`**. Đã xoá thì biến khỏi mọi danh sách, `GET` trả 404.

## POST /v1/assets/:id/status — Đánh dấu Mất, huỷ dịch vụ

```json
{ "status": "LOST", "date": "2026-10-20", "reason": "Mất khi đi công tác" }
```

- `status: "LOST"` chỉ cho thiết bị: đóng cấp phát đang mở, dừng khấu hao từ `date` (mặc định hôm nay).
- `status: "CANCELLED"` chỉ cho dịch vụ: còn ghế thì **409 `ASSET_SERVICE_HAS_SEATS`**.
- Thiết bị đang sửa → **409 `ASSET_REPAIR_OPEN`**; chuyển không hợp lệ → **400 `ASSET_STATUS_NOT_ALLOWED`**.

**Response 201:** `ApiSuccess<Asset>`.

---

## GET /v1/assets/:id/events — Lịch sử

**Response:** `ApiSuccess<AssetEvent[]>`, mới nhất trước. Không có API sửa hay xoá sự kiện.

```json
{
  "success": true,
  "data": [
    {
      "id": 21,
      "type": "ASSIGNED",
      "typeLabel": "Bàn giao",
      "actor": { "id": 1, "name": "Quản Trị STH" },
      "occurredAt": "2026-11-10T09:21:45.210Z",
      "payload": { "condition": "GOOD", "assignedAt": "2026-11-10", "employeeId": 6, "assignmentId": 5, "employeeName": "Nguyễn Văn A" }
    },
    {
      "id": 20,
      "type": "REPAIR_CLOSED",
      "typeLabel": "Đóng phiếu sửa",
      "actor": { "id": 1, "name": "Quản Trị STH" },
      "occurredAt": "2026-11-10T09:21:45.195Z",
      "payload": { "cost": 450000, "doneAt": "2026-11-10", "outcome": "DONE", "statusAfter": "AVAILABLE", "maintenanceId": 3 }
    }
  ]
}
```

Hiển thị theo `typeLabel` và `actor`; `payload` chỉ để hiện chi tiết phụ. Người thiếu `asset:value:read` không thấy
các khoá chứa tiền trong `payload` (như `cost` ở trên).

---

## GET /v1/assets/:id/depreciation — Khấu hao

Chỉ thiết bị (dịch vụ → 400 `ASSET_NOT_DEPRECIABLE`). Khấu hao đường thẳng **theo số ngày**: tháng đầu và tháng
dừng tính theo số ngày dùng thật, tháng cuối của lịch nhận phần chênh do làm tròn.

**Query:** `asOf=YYYY-MM-DD`, mặc định hôm nay.

**Response:** `ApiSuccess<AssetDepreciation>` (cắt bớt `schedule`):

```json
{
  "success": true,
  "data": {
    "asOf": "2025-12-31",
    "costVnd": 26500000,
    "salvageValue": 0,
    "startDate": "2025-03-15",
    "months": 36,
    "stopDate": null,
    "accumulated": 7028673,
    "bookValue": 19471327,
    "accountingClass": "TOOL",
    "accountingClassLabel": "Công cụ dụng cụ",
    "suggestedAccountingClass": "TOOL",
    "suggestedAccountingClassLabel": "Công cụ dụng cụ",
    "schedule": [
      { "month": "2025-03", "from": "2025-03-15", "to": "2025-03-31", "days": 17, "daysInMonth": 31, "amount": 403674, "accumulated": 403674, "bookValue": 26096326 },
      { "month": "2025-04", "from": "2025-04-01", "to": "2025-04-30", "days": 30, "daysInMonth": 30, "amount": 736111, "accumulated": 1139785, "bookValue": 25360215 }
    ]
  }
}
```

`suggestedAccountingClass` là gợi ý theo quy định (≥ 30 triệu và > 12 tháng là tài sản cố định), chỉ để tham khảo;
`accountingClass` là phân loại đang đặt, có thể khác gợi ý.

---

## License key — `PUT`, `DELETE`, `POST .../reveal`

| Route | Body | Response |
|---|---|---|
| `PUT /v1/assets/:id/license-key` hoặc `PUT /v1/me/asset-services/:id/license-key` | `{ "licenseKey": "ABCDE-FGHIJ-KLMNO-PQRS" }` | `ApiSuccess<Asset>`, `licenseKeyMasked` mới |
| `DELETE` cùng hai đường trên | | `ApiSuccess<Asset>`, `hasLicenseKey: false` |
| `POST /v1/assets/:id/license-key/reveal` (ADMIN) hoặc `POST /v1/me/asset-services/:id/license-key/reveal` (người phụ trách) | | `ApiSuccess<{ licenseKey: string }>`, 200 |

```json
{ "success": true, "data": { "licenseKey": "ABCDE-FGHIJ-KLMNO-PQRS" } }
```

**403** khi HR (hay ai không phải ADMIN, người phụ trách) gọi reveal:
```json
{ "success": false, "error": { "code": "ASSET_LICENSE_KEY_FORBIDDEN", "message": "Chỉ ADMIN và người phụ trách dịch vụ được xem license key" } }
```

Khác: 404 `ASSET_LICENSE_KEY_NOT_SET` khi dịch vụ chưa có key; 400 `ASSET_NOT_SERVICE` khi gọi trên thiết bị; 503
`ASSET_SECRET_KEY_NOT_CONFIGURED`.

---

## POST /v1/assets/:id/assignments — Cấp phát

**Body:** `AssignBody`

```json
{ "employeeId": 7, "condition": "NEW", "note": "Kèm bàn phím, chuột" }
```
```json
{ "departmentId": 4, "responsibleId": 5 }
```

**Response 201:** `ApiSuccess<AssignResult>`

```json
{
  "success": true,
  "data": {
    "assignment": {
      "id": 6,
      "asset": { "id": 2, "code": "STH000002", "name": "Bộ máy tính bàn Dell OptiPlex 7010", "kind": "PHYSICAL", "kindLabel": "Tài sản hữu hình", "status": "IN_USE", "statusLabel": "Đang sử dụng", "categoryName": "Bộ máy tính bàn", "groupName": "Máy tính" },
      "employee": { "id": 7, "fullName": "Trần Thị B", "employeeCode": "EMPB" },
      "department": null,
      "responsible": null,
      "assignedAt": "2026-11-10",
      "assignedBy": { "id": 2, "name": "Nhân Sự Một" },
      "conditionOnAssign": "NEW",
      "conditionOnAssignLabel": "Mới",
      "expectedReturnDate": null,
      "note": "Kèm bàn phím, chuột",
      "confirmation": "PENDING",
      "confirmationLabel": "Chờ xác nhận",
      "confirmedAt": null,
      "disputeReason": null,
      "returnedAt": null,
      "returnedBy": null,
      "conditionOnReturn": null,
      "conditionOnReturnLabel": null,
      "returnNote": null
    },
    "warnings": []
  }
}
```

**Thiết bị:**
- Chỉ cấp được khi `AVAILABLE`. Cấp xong là `PENDING`: người nhận phải xác nhận ở Tài sản của tôi.
- Đang `IN_USE` → **409 `ASSET_ALREADY_ASSIGNED`**, message nói đang ở ai và gợi ý dùng Điều chuyển:
  ```json
  { "success": false, "error": { "code": "ASSET_ALREADY_ASSIGNED", "message": "Tài sản đang giao cho Trần Thị B. Dùng Điều chuyển để chuyển sang người mới" } }
  ```
- `IN_REPAIR`, `BROKEN`, `LOST` → 409 `ASSET_NOT_ASSIGNABLE`. Hai người bấm cấp cùng một máy cùng lúc thì một người
  nhận 409.

**Dịch vụ (ghế):**
- Chỉ nhận `employeeId` (400 `ASSET_ASSIGNEE_REQUIRED`), dịch vụ phải `ACTIVE`, không cần xác nhận (`NOT_REQUIRED`).
- Người đã có ghế → **409 `ASSET_SEAT_ALREADY_HELD`**.
- Vượt `seatCount` **vẫn 201**, kèm `"warnings": ["SEATS_EXCEEDED"]`: hiện cảnh báo vàng, không chặn.

Khác: 400 `ASSET_ASSIGNEE_INACTIVE` (người nhận đã nghỉ), `ASSET_RESPONSIBLE_REQUIRED` (giao phòng ban thiếu người
chịu trách nhiệm), `DEPARTMENT_NOT_FOUND`.

## POST /v1/assets/:id/transfer — Điều chuyển

Chỉ thiết bị đang giao. **Body:** `TransferBody` (như `AssignBody`, thêm `conditionOnReturn` của người cũ). Thu của
người cũ và giao người mới trong một lần. **Response 201:** `ApiSuccess<AssignResult>`.

Lỗi: 409 `ASSET_NOT_ASSIGNED` (chưa giao ai, dùng Cấp phát), 400 `ASSET_TRANSFER_SAME_TARGET`,
`ASSET_RETURN_BEFORE_ASSIGN`, `ASSET_NOT_PHYSICAL`.

## POST /v1/asset-assignments/:id/return — Thu hồi

**Body:** `ReturnBody`, có thể rỗng. `condition: "BROKEN"` thì tài sản về `BROKEN`, ngược lại về `AVAILABLE`.
**Response 201:** `ApiSuccess<AssetAssignment>`. Thu lần hai → **409 `ASSET_ASSIGNMENT_CLOSED`**; ngày thu trước ngày
giao → 400 `ASSET_RETURN_BEFORE_ASSIGN`.

## GET /v1/assets/:id/assignments — Lịch sử người dùng

**Response:** `ApiSuccess<AssetAssignment[]>`, gồm cả lần đã thu hồi (`returnedAt` khác null). Dùng cho tab Người dùng
của thiết bị và tab Ghế của dịch vụ.

---

## Gia hạn dịch vụ — `GET`, `POST /v1/assets/:id/renewals`

**Body:** `RenewalBody`

```json
{ "amount": 150, "currency": "USD", "exchangeRate": 26000, "note": "Gia hạn tháng 11" }
```

**Response 201:** `ApiSuccess<AssetRenewal>`

```json
{
  "success": true,
  "data": {
    "id": 1,
    "periodStart": "2026-11-20",
    "periodEnd": "2026-12-19",
    "seatCount": 5,
    "amount": 150,
    "currency": "USD",
    "exchangeRate": 26000,
    "amountVnd": 3900000,
    "paidAt": "2026-11-10",
    "note": "Gia hạn tháng 11",
    "createdBy": { "id": 8, "name": "Kỹ Thuật IT" }
  }
}
```

- Kỳ được ghi là `[nextRenewalDate cũ, nextRenewalDate mới − 1 ngày]`. Ngày neo 31 tự kẹp cuối tháng
  (31/01 → 28/02 → 31/03). Kỳ có khuyến mãi ("12 tháng tặng 2") thì gửi `nextRenewalDate` tay.
- Dịch vụ `EXPIRED` gia hạn xong thì về `ACTIVE`. Dịch vụ `CANCELLED` hay mua đứt → **409 `ASSET_NOT_RENEWABLE`**.
- Lỗi khác: 400 `ASSET_EXCHANGE_RATE_REQUIRED`, `ASSET_RENEWAL_DATE_INVALID` (ngày kế tiếp không sau kỳ hiện tại),
  `ASSET_NOT_SERVICE`.

`GET` trả `ApiSuccess<AssetRenewal[]>`; số tiền theo `asset:value:read`.

---

## Sửa chữa

### GET /v1/asset-maintenances

**Query:** `page`, `limit`, `status`, `assetId`, `vendorId`. **Response:** `ApiPaginated<AssetMaintenance>`

```json
{
  "success": true,
  "data": [
    {
      "id": 3,
      "asset": { "id": 1, "code": "STH000001", "name": "Laptop Dell Latitude 5440" },
      "type": "REPAIR",
      "typeLabel": "Sửa chữa",
      "status": "DONE",
      "statusLabel": "Xong",
      "description": "Quạt kêu to",
      "workDone": "Vệ sinh và thay quạt",
      "vendor": null,
      "underWarranty": false,
      "cost": 450000,
      "sentAt": null,
      "expectedDoneAt": null,
      "doneAt": "2026-11-10",
      "createdBy": { "id": 1, "name": "Quản Trị STH" },
      "createdAt": "2026-11-10T09:21:45.177Z"
    }
  ],
  "meta": { "page": 1, "limit": 1, "total": 3, "totalPages": 3 }
}
```

### POST /v1/assets/:id/maintenances — Mở phiếu

```json
{ "description": "Gãy bánh xe", "vendorId": 1, "underWarranty": false, "cost": 0, "sentAt": "2026-11-10", "expectedDoneAt": "2026-11-17" }
```

Chỉ thiết bị (400 `ASSET_NOT_PHYSICAL`). Tài sản → `IN_REPAIR`, người đang giữ **giữ nguyên**. Mỗi lúc một phiếu mở
(409 `ASSET_REPAIR_OPEN`); tài sản đã mất → 409 `ASSET_NOT_REPAIRABLE`. **Response 201:** `ApiSuccess<AssetMaintenance>`.

### PATCH /v1/asset-maintenances/:id

Sửa `description`, `workDone`, `status` (`OPEN` ↔ `IN_PROGRESS`), `vendorId`, `underWarranty`, `cost`, `sentAt`,
`expectedDoneAt` khi phiếu còn mở. Phiếu đã đóng → 409 `ASSET_MAINTENANCE_CLOSED`.

### POST /v1/asset-maintenances/:id/close

```json
{ "outcome": "DONE", "workDone": "Thay bánh xe", "cost": 150000, "doneAt": "2026-11-15" }
```

`outcome`: `DONE` hoặc `CANCELLED` → về trạng thái trước khi sửa (có người giữ thì `IN_USE`, không thì `AVAILABLE`);
`UNREPAIRABLE` → `BROKEN`. Chi phí sửa **không** cộng vào nguyên giá. **Response 201:** `ApiSuccess<AssetMaintenance>`.

---

## Giấy tờ

### POST /v1/asset-documents — Tải lên

**Content-Type:** `multipart/form-data`

| Field | Type | Bắt buộc | Ghi chú |
|-------|------|----------|---------|
| `file` | `File` | ✅ | PDF, JPG, PNG, HEIC, XML (hoá đơn điện tử), DOCX, XLSX |
| `type` | `AssetDocumentType` | ✅ | Quyết định dung lượng tối đa, xem bảng dưới |
| `number` | string | | Số hoá đơn, số hợp đồng |
| `issuedDate` | `YYYY-MM-DD` | | |
| `amount` | number | | Tiền |
| `assetIds` | number[] | Ít nhất một đích | `[1,2]` dạng JSON, `"1,2"`, hoặc lặp trường. Một hoá đơn mua 10 máy gửi một lần |
| `assignmentId`, `renewalId`, `maintenanceId` | number | Ít nhất một đích | Gắn vào lần cấp phát, gia hạn, phiếu sửa |

| Loại | Dung lượng tối đa |
|---|---|
| `PURCHASE_CONTRACT`, `SERVICE_CONTRACT`, `OTHER` | 20 MB |
| `INVOICE`, `WARRANTY`, `HANDOVER_RECORD`, `REPAIR_QUOTE`, `DISPOSAL_RECORD` | 10 MB |
| `CONDITION_PHOTO` | 5 MB |

```typescript
const form = new FormData();
form.append('file', file);
form.append('type', 'INVOICE');
form.append('number', 'HĐ 0001234');
form.append('assetIds', JSON.stringify([1, 2]));
await authFetch('/v1/asset-documents', { method: 'POST', body: form }); // KHÔNG tự set Content-Type
```

**Response 201:** `ApiSuccess<AssetDocument>`

```json
{
  "success": true,
  "data": {
    "id": 1,
    "type": "INVOICE",
    "typeLabel": "Hoá đơn",
    "number": "HĐ 0001234",
    "issuedDate": "2025-03-15",
    "amount": 25000000,
    "fileName": "hoa-don-0001234.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 182044,
    "uploadedBy": { "id": 2, "name": "Nhân Sự Một" },
    "uploadedAt": "2026-11-10T09:29:44.336Z",
    "links": [
      { "id": 1, "assetId": 1, "assetCode": "STH000001", "assignmentId": null, "renewalId": null, "maintenanceId": null },
      { "id": 2, "assetId": 2, "assetCode": "STH000002", "assignmentId": null, "renewalId": null, "maintenanceId": null }
    ]
  }
}
```

Lỗi: 400 `ASSET_DOCUMENT_FILE_REQUIRED`, `ASSET_FILE_TOO_LARGE`, `ASSET_DOCUMENT_TARGET_REQUIRED`,
`ASSET_DOCUMENT_TARGET_NOT_FOUND`, sai kiểu file.

### GET /v1/assets/:id/documents

**Response:** `ApiSuccess<AssetDocument[]>`, gồm cả giấy tờ gắn qua cấp phát, gia hạn, phiếu sửa của tài sản đó.
**Không có URL file.**

### GET /v1/asset-documents/:id/url — Mở file

**Response:** `ApiSuccess<{ url: string }>`

```json
{ "success": true, "data": { "url": "https://…/tenants/sth/assets/documents/4cba6842-….pdf?X-Amz-Algorithm=…&X-Amz-Signature=…" } }
```

```typescript
// ✅ Lấy URL khi bấm, mở tab mới, không lưu lại
const { url } = (await authFetch(`/v1/asset-documents/${docId}/url`)).data;
window.open(url, '_blank');
```

URL sống ngắn; hết hạn thì gọi lại. PDF mở thẳng trong trình duyệt, loại khác tải về. Nhân viên dùng
`GET /v1/me/assets/documents/:id/url` và chỉ mở được **biên bản bàn giao** và **ảnh tình trạng** gắn với lần bàn giao
cho chính mình.

### Gắn, gỡ, xoá

| Route | Body | Response |
|---|---|---|
| `POST /v1/asset-documents/:id/links` | Đúng một trong `{ assetId, assignmentId, renewalId, maintenanceId }` | 201 `ApiSuccess<AssetDocument>`. Hai đích → 400 `ASSET_DOCUMENT_ONE_TARGET`; đã gắn → 400 `ASSET_DOCUMENT_ALREADY_LINKED` |
| `DELETE /v1/asset-documents/:id/links/:linkId` | | 204 |
| `DELETE /v1/asset-documents/:id` | | 204, xoá mềm |

---

## Cài đặt — loại tài sản, nhà cung cấp

| Route | Query / Body | Response |
|---|---|---|
| `GET /v1/asset-categories` | `?kind=&isActive=` | `ApiSuccess<AssetCategory[]>` |
| `POST /v1/asset-categories` | `{ name, groupName, kind, defaultDepreciationMonths?, requireSerial?, isActive? }` | 201 `AssetCategory`. Trùng tên → 409 `ASSET_CATEGORY_NAME_EXISTS` |
| `PATCH /v1/asset-categories/:id` | như trên, mọi trường tuỳ chọn | `AssetCategory`. Đổi `kind` khi đã có tài sản → 409 `ASSET_CATEGORY_KIND_LOCKED` |
| `GET /v1/asset-vendors` | `?search=&isActive=` | `ApiSuccess<AssetVendor[]>` |
| `GET /v1/asset-vendors/:id` | | `ApiSuccess<AssetVendorDetail>`. `assets` và `maintenances` chỉ gồm tài sản trong phạm vi người xem (MANAGER: phòng mình); MANAGER không thuộc phòng ban nào → 403 `ASSET_SCOPE_FORBIDDEN` |
| `POST /v1/asset-vendors` | `{ name, types?, taxCode?, address?, website?, contactName?, phone?, email?, note?, isActive? }` | 201 `AssetVendor` |
| `PATCH /v1/asset-vendors/:id` | như trên | `AssetVendor` |

Công ty mới đã có sẵn 30 loại mặc định. Không có route xoá loại hay nhà cung cấp: ngừng dùng bằng `isActive: false`.

**Chi tiết nhà cung cấp:**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Huy Phùng PC",
    "types": ["SUPPLIER", "REPAIR"],
    "typeLabels": ["Bán hàng", "Sửa chữa"],
    "taxCode": null, "address": null, "website": null, "contactName": null,
    "phone": "0901234567", "email": null, "note": null, "isActive": true,
    "assets": [
      { "id": 1, "code": "STH000001", "name": "Laptop Dell Latitude 5440", "kind": "PHYSICAL", "statusLabel": "Đang sử dụng" }
    ],
    "maintenances": [
      { "id": 1, "statusLabel": "Mới", "description": "Gãy bánh xe", "assetCode": "STH000004", "doneAt": null }
    ]
  }
}
```

---

## Báo cáo

### GET /v1/asset-reports/depreciation

**Query:** `asOf`, `categoryId`, `accountingClass`. **Response:** `ApiSuccess<DepreciationReport>`

```json
{
  "success": true,
  "data": {
    "asOf": "2025-12-31",
    "rows": [
      { "assetId": 1, "code": "STH000001", "name": "Laptop Dell Latitude 5440", "categoryName": "Laptop", "ownerUnitCode": "STH", "accountingClass": "TOOL", "accountingClassLabel": "Công cụ dụng cụ", "startDate": "2025-03-15", "months": 36, "costVnd": 26500000, "accumulated": 7028673, "bookValue": 19471327 }
    ],
    "totals": { "costVnd": 47690000, "accumulated": 9192496, "bookValue": 38497504 }
  }
}
```

`GET /v1/asset-reports/depreciation/export` nhận cùng query, trả `khau-hao-tai-san.xlsx`.

### GET /v1/asset-reports/expiring

**Query:** `withinDays` (1–365, mặc định 30), `type=renewal|warranty` (bỏ trống là cả hai).
**Response:** `ApiSuccess<ExpiringRow[]>`

```json
{
  "success": true,
  "data": [
    { "type": "warranty", "assetId": 3, "code": "STH000003", "name": "Màn hình Asus VA27EHF", "date": "2026-12-19", "daysLeft": 39, "ownerName": "Phòng kế toán (Trưởng Phòng KT)" },
    { "type": "renewal", "assetId": 5, "code": "STH000005", "name": "ChatGPT Team", "date": "2026-12-20", "daysLeft": 40, "ownerName": "Kỹ Thuật IT" }
  ]
}
```

`ownerName`: dịch vụ là người phụ trách; thiết bị là người đang giữ, hoặc phòng ban kèm người chịu trách nhiệm.

---

## Nhập Excel

### GET /v1/asset-imports/template

Trả `mau-nhap-tai-san.xlsx` gồm sheet "Tài sản", "Dịch vụ" và "Hướng dẫn". Tên cột và quy tắc từng cột ở
`docs/modules/15-assets.md` mục 15.

### POST /v1/asset-imports

**Content-Type:** `multipart/form-data`, field `file` (.xlsx, tối đa 10 MB, 2.000 dòng mỗi sheet).

**Response 201:** `ApiSuccess<ImportResult>`

```json
{
  "success": true,
  "data": {
    "created": { "physical": 8, "service": 0 },
    "autoCreated": { "categories": ["Thiết bị mạng → Switch"], "vendors": ["Huy Phùng PC"] },
    "errors": [
      { "sheet": "Tài sản", "row": 14, "messages": ["Không tìm thấy nhân viên \"Nguyễn Văn X\""] }
    ],
    "ignoredColumns": ["Dịch vụ: Password"]
  }
}
```

- Nhập các dòng hợp lệ, trả lỗi theo `{ sheet, row, messages }` cho dòng hỏng: hiện bảng lỗi để người dùng sửa file
  rồi nhập lại các dòng đó. Mỗi dòng độc lập, dòng lỗi không kéo dòng khác.
- **Cột có tên chứa "password", "mật khẩu", "sudo" bị bỏ qua** và liệt kê ở `ignoredColumns`: hiện dòng báo để người
  dùng biết mật khẩu không được nhập.
- Mọi dòng thuộc công ty đang đăng nhập; file cũ còn cột "Tài sản thuộc đơn vị" hay "Công ty sử dụng" thì cột đó bị
  bỏ qua. Chú thích ô cũng bị bỏ qua, kể cả chú thích do công cụ ngoài Excel ghi (openpyxl).
- Cột "Người sử dụng" phải khớp mã hoặc họ tên nhân viên **của chính công ty đang nhập**; không khớp hoặc trùng tên
  nhiều người thì cả dòng bị trả lỗi.
- Nhập file **không gửi thông báo bàn giao nào**; cấp phát từ file không cần xác nhận.

Lỗi cả file (400): `ASSET_IMPORT_INVALID_FILE` (không đọc được file; message hướng dẫn mở bằng Excel hay LibreOffice
rồi lưu lại), `ASSET_IMPORT_NO_SHEET` (không có sheet "Tài sản" hay "Dịch vụ"), `ASSET_IMPORT_TOO_MANY_ROWS`.

---

## Hồ sơ nhân viên và nghỉ việc

### GET /v1/employees/:employeeId/assets

**Query:** `open=true` để chỉ lấy đang mở. **Response:** `ApiSuccess<AssetAssignment[]>`. `MANAGER` chỉ xem được nhân
viên phòng mình (403 `ASSET_SCOPE_FORBIDDEN`); nhân viên không có → 404 `EMPLOYEE_NOT_FOUND`.

### POST /v1/employees/:employeeId/assets/return-all

Thu mọi thiết bị và ghế đang mở của người đó trong một lần. **Response 201:** `ApiSuccess<{ returned: number }>`.

### Hộp thoại cho nghỉ việc

Khi mở hộp thoại, gọi `GET /v1/employees/:id/assets?open=true`. Có mục thì hiện cảnh báo "Nhân viên còn giữ N tài
sản" kèm danh sách và nút **Thu hồi tất cả** (cần `asset:manage`). **Không chặn** việc cho nghỉ. Module `DISABLED`
hoặc không có `asset:read` thì bỏ qua bước này, đừng hiện lỗi. Cho nghỉ khi còn tài sản thì BE tự gửi thông báo cho
người quản lý tài sản, HR và quản lý trực tiếp.

---

## Tự phục vụ — Tài sản của tôi

### GET /v1/me/assets

**Response:** `ApiSuccess<MyAssets>` (cắt bớt). Không có trường tiền nào.

```json
{
  "success": true,
  "data": {
    "holding": [
      {
        "id": 5,
        "asset": { "id": 1, "code": "STH000001", "name": "Laptop Dell Latitude 5440", "kind": "PHYSICAL", "kindLabel": "Tài sản hữu hình", "status": "IN_USE", "statusLabel": "Đang sử dụng", "categoryName": "Laptop", "groupName": "Máy tính" },
        "employee": { "id": 6, "fullName": "Nguyễn Văn A", "employeeCode": "EMPA" },
        "department": null,
        "responsible": null,
        "assignedAt": "2026-11-10",
        "assignedBy": { "id": 2, "name": "Nhân Sự Một" },
        "conditionOnAssign": "NEW",
        "conditionOnAssignLabel": "Mới",
        "expectedReturnDate": null,
        "note": "Kèm sạc",
        "confirmation": "PENDING",
        "confirmationLabel": "Chờ xác nhận",
        "confirmedAt": null,
        "disputeReason": null,
        "returnedAt": null,
        "returnedBy": null,
        "conditionOnReturn": null,
        "conditionOnReturnLabel": null,
        "returnNote": null
      }
    ],
    "history": [],
    "pendingConfirmationCount": 1
  }
}
```

`pendingConfirmationCount` dùng làm badge cho mục menu "Tài sản của tôi".

### POST /v1/me/assets/assignments/:id/confirm

```json
{ "accepted": true }
```
```json
{ "accepted": false, "reason": "Máy không có sạc" }
```

**Response 200:** `ApiSuccess<AssetAssignment>`. Cấp phát `PENDING` hiện hai nút **Đã nhận** và **Không đúng**. Báo
không đúng thì trạng thái thành `DISPUTED` và người giao nhận thông báo; người nhận vẫn bấm Đã nhận được sau khi hai
bên thống nhất. Lỗi: 400 `ASSET_DISPUTE_REASON_REQUIRED`, 403 `ASSET_ASSIGNMENT_NOT_YOURS` (xác nhận hộ người khác),
409 `ASSET_ASSIGNMENT_ALREADY_CONFIRMED`, `ASSET_ASSIGNMENT_CLOSED`.

### Dịch vụ tôi phụ trách — `/v1/me/asset-services/...`

`GET /v1/me/asset-services` trả `ApiSuccess<Asset[]>` (chỉ `SERVICE`); mảng rỗng nghĩa là người này không phụ trách
dịch vụ nào, ẩn tab. Danh sách người giữ ghế nằm ở `holders`. Mọi route con chỉ người là `service.owner` của dịch vụ
đó gọi được, người khác → **403 `ASSET_NOT_OWNER`**:

| Route | Body | Response |
|---|---|---|
| `GET .../:id/renewals` | | `AssetRenewal[]` |
| `POST .../:id/renewals` | `RenewalBody` | 201 `AssetRenewal`, luôn có số tiền |
| `POST .../:id/seats` | `{ employeeId, assignedAt?, note? }` | 201 `AssignResult` |
| `POST .../:id/seats/:assignmentId/return` | `{ returnedAt?, note? }` | 201 `AssetAssignment` |
| `PUT`, `DELETE .../:id/license-key` | `{ licenseKey }` cho PUT | `Asset` |
| `POST .../:id/license-key/reveal` | | 200 `{ licenseKey }` |
| `POST .../:id/documents` | multipart như `/v1/asset-documents`, **`renewalId` bắt buộc** và phải là lần gia hạn của dịch vụ này | 201 `AssetDocument` |

---

## Thông báo

FE điều hướng theo `refType` (`app/utils/notification-route.ts`). Module dùng **bốn `refType`**, mỗi cái ứng với một
trang; BE chọn sẵn theo từng người nhận nên FE **không** rẽ theo vai trò:

| `refType` | `refId` | Trang mở | Dùng cho |
|---|---|---|---|
| `asset_holding` | ID tài sản | `/assets/my` | N-01, N-02, N-07, N-11 |
| `asset_service` | ID dịch vụ | `/assets/my?tab=services&open_id=:id` | N-03, N-04 gửi **người phụ trách** |
| `asset` | ID tài sản | `/management/assets/:id` | N-05, N-12, và N-03, N-04 gửi người quản lý tài sản |
| `employee_assets` | ID nhân viên | `/management/employees/:id?tab=assets` | N-09 |
| `asset_incident` | ID báo cáo (incident) | `/management/assets/incidents?open_id=:id` | **Đợt 2.** N-06 |

N-08 (đợt 2) dùng `refType` `asset` sẵn có, nên không phải thêm `case` cho nó.

`targetUrl` của từng thông báo và link trong email trỏ đúng trang ở cột "Trang mở" (email kèm `t=<mã công ty>`).
Người phụ trách dịch vụ thường có vai trò EMPLOYEE, không vào được trang quản lý: đó là lý do có `asset_service`.

| Mã | `type` | Người nhận | Email | Push |
|---|---|---|---|---|
| N-01 | `ASSET_ASSIGNED` | Người được giao, hoặc người chịu trách nhiệm khi giao phòng ban | – | ✓ |
| N-02 | `ASSET_RETURNED` | Người bị thu | – | ✓ |
| N-03 | `ASSET_RENEWAL_DUE` | Người phụ trách và người quản lý tài sản, mốc 30, 7, 1 ngày trước hạn | ✓ | ✓ |
| N-04 | `ASSET_RENEWAL_OVERDUE` / `ASSET_SERVICE_EXPIRED` | Như N-03, ngày quá hạn đầu tiên / khi chuyển Hết hạn | ✓ | ✓ |
| N-05 | `ASSET_WARRANTY_EXPIRING` | Người quản lý tài sản, 30 ngày trước hạn bảo hành | – | – |
| N-06 | `ASSET_INCIDENT_REPORTED` | **Đợt 2.** Người quản lý tài sản và quản lý trực tiếp của người báo | – | ✓ |
| N-07 | `ASSET_REPAIR_DONE` | Người đang giữ (chỉ phiếu sửa, phiếu bảo dưỡng không gửi) | – | ✓ |
| N-08 | `ASSET_MAINTENANCE_DUE` | **Đợt 2.** Người quản lý tài sản, khi J-03 tự mở phiếu bảo dưỡng | – | – |
| N-09 | `ASSET_OFFBOARDING_OPEN` | Người quản lý tài sản, HR, quản lý trực tiếp | ✓ | – |
| N-11 | `ASSET_CONFIRMATION_REMINDER` | Người chưa xác nhận sau 2 ngày | – | ✓ |
| N-12 | `ASSET_ASSIGNMENT_DISPUTED` | Người đã giao | – | ✓ |

"Người quản lý tài sản" là ADMIN và người có `asset:manage`. Tiêu đề và nội dung:
`docs/notifications/notification-content-map.md`, mục Tài sản.

---

## Mã lỗi

Lỗi theo envelope chung, `message` là tiếng Việt hiển thị được ngay.

| HTTP | Mã | Khi nào |
|---|---|---|
| 400 | `ASSET_INVALID_DATE` | Ngày không có thật |
| 400 | `ASSET_CATEGORY_NOT_FOUND` · `ASSET_CATEGORY_KIND_MISMATCH` | Loại không có, đã ngừng, hoặc khác họ tài sản |
| 400 | `ASSET_DETAIL_KIND_MISMATCH` · `ASSET_SERVICE_DETAIL_REQUIRED` | Gửi `physical` cho dịch vụ hay ngược lại; dịch vụ thiếu khối `service` |
| 400 | `ASSET_RENEWAL_DATE_REQUIRED` · `ASSET_RENEWAL_DATE_INVALID` | Dịch vụ định kỳ thiếu ngày gia hạn; ngày kế tiếp không sau kỳ hiện tại |
| 400 | `ASSET_SERIAL_REQUIRED` | Loại bắt buộc serial |
| 400 | `ASSET_PAYMENT_NOTE_INVALID` | Ghi số thẻ đầy đủ |
| 400 | `ASSET_EXCHANGE_RATE_REQUIRED` | Tiền ngoại tệ thiếu tỷ giá |
| 400 | `ASSET_VENDOR_NOT_FOUND` · `DEPARTMENT_NOT_FOUND` | Nhà cung cấp, phòng ban không có |
| 400 | `ASSET_ASSIGNEE_INACTIVE` · `ASSET_OWNER_INACTIVE` | Người nhận, người phụ trách đã nghỉ |
| 400 | `ASSET_ASSIGNEE_REQUIRED` · `ASSET_RESPONSIBLE_REQUIRED` | Chọn sai người nhận; giao phòng ban thiếu người chịu trách nhiệm |
| 400 | `ASSET_TRANSFER_SAME_TARGET` · `ASSET_RETURN_BEFORE_ASSIGN` | Điều chuyển cho chính người đang giữ; ngày thu hồi trước ngày giao |
| 400 | `ASSET_NOT_PHYSICAL` · `ASSET_NOT_SERVICE` · `ASSET_NOT_DEPRECIABLE` | Thao tác không hợp với họ tài sản |
| 400 | `ASSET_STATUS_NOT_ALLOWED` | Đổi trạng thái tay không hợp lệ |
| 400 | `ASSET_DISPUTE_REASON_REQUIRED` | Báo không đúng mà không ghi lý do |
| 400 | `ASSET_DOCUMENT_FILE_REQUIRED` · `ASSET_FILE_TOO_LARGE` · `ASSET_DOCUMENT_TARGET_REQUIRED` · `ASSET_DOCUMENT_TARGET_NOT_FOUND` · `ASSET_DOCUMENT_ONE_TARGET` · `ASSET_DOCUMENT_ALREADY_LINKED` | Giấy tờ |
| 400 | `ASSET_IMPORT_INVALID_FILE` · `ASSET_IMPORT_NO_SHEET` · `ASSET_IMPORT_TOO_MANY_ROWS` | Nhập Excel |
| 403 | `FORBIDDEN` | Sai vai trò (EMPLOYEE vào route quản lý) hoặc thiếu quyền |
| 403 | `ASSET_SCOPE_FORBIDDEN` | Ngoài phạm vi xem |
| 403 | `ASSET_FORBIDDEN` | Không có quyền thao tác trên tài sản này |
| 403 | `ASSET_NOT_OWNER` | Không phụ trách dịch vụ này |
| 403 | `ASSET_ASSIGNMENT_NOT_YOURS` | Xác nhận hộ người khác |
| 403 | `ASSET_LICENSE_KEY_FORBIDDEN` | Không phải ADMIN hay người phụ trách mà đòi xem key |
| 403 | `ASSET_OWNER_SELF_ASSIGN` | Người không phải ADMIN tự đặt mình làm người phụ trách dịch vụ |
| 403 | `MODULE_*` | Xem [entitlements.md](./entitlements.md) |
| 404 | `ASSET_NOT_FOUND` · `ASSET_ASSIGNMENT_NOT_FOUND` · `ASSET_MAINTENANCE_NOT_FOUND` · `ASSET_DOCUMENT_NOT_FOUND` · `ASSET_VENDOR_NOT_FOUND` (route nhà cung cấp) · `ASSET_CATEGORY_NOT_FOUND` (route loại) · `ASSET_LICENSE_KEY_NOT_SET` · `EMPLOYEE_NOT_FOUND` | Không tìm thấy |
| 409 | `ASSET_CODE_EXISTS` · `ASSET_SERIAL_EXISTS` | Trùng mã, trùng serial |
| 409 | `ASSET_CATEGORY_NAME_EXISTS` · `ASSET_CATEGORY_KIND_LOCKED` | Cài đặt |
| 409 | `ASSET_ALREADY_ASSIGNED` · `ASSET_NOT_ASSIGNABLE` · `ASSET_NOT_ASSIGNED` · `ASSET_SEAT_ALREADY_HELD` | Cấp phát |
| 409 | `ASSET_ASSIGNMENT_CLOSED` · `ASSET_ASSIGNMENT_ALREADY_CONFIRMED` | Cấp phát đã thu hồi; đã xác nhận rồi |
| 409 | `ASSET_REPAIR_OPEN` · `ASSET_NOT_REPAIRABLE` · `ASSET_MAINTENANCE_CLOSED` | Sửa chữa |
| 409 | `ASSET_NOT_RENEWABLE` · `ASSET_SERVICE_HAS_SEATS` | Dịch vụ đã huỷ hoặc mua đứt; huỷ khi còn ghế |
| 409 | `ASSET_HAS_HISTORY` | Xoá tài sản đã có lịch sử |
| 409 | `ASSET_STATUS_CHANGED` | Người khác vừa đổi tài sản: tải lại rồi thử lại |
| 503 | `ASSET_SECRET_KEY_NOT_CONFIGURED` | Server chưa có khoá mã hoá license key |

**Đợt 2 — lô 2a** thêm các mã sau. Chi tiết từng route ở mục "Đợt 2 — lô 2a".

| HTTP | Mã | Khi nào |
|---|---|---|
| 400 | `ASSET_MAINTENANCE_INTERVAL_REQUIRED` | Gửi hạn bảo dưỡng khi tài sản chưa có chu kỳ |
| 400 | `ASSET_MAINTENANCE_OUTCOME_INVALID` | Đóng phiếu bảo dưỡng với kết quả "Không sửa được" |
| 400 | `ASSET_INCIDENT_TOO_MANY_PHOTOS` · `ASSET_INCIDENT_PHOTO_TYPE` · `ASSET_FILE_TOO_LARGE` | Ảnh báo hỏng: quá 10 ảnh, không phải JPG/PNG/HEIC, quá 5 MB |
| 400 | `ASSET_INCIDENT_DATE_IN_FUTURE` | Ngày phát hiện sau hôm nay |
| 400 | `ASSET_INCIDENT_TYPE_MISMATCH` | Tạo phiếu sửa từ báo mất, hoặc xác nhận mất trên báo hỏng |
| 400 | `ASSET_REPORT_RANGE_INVALID` · `ASSET_REPORT_RANGE_TOO_LONG` | Kỳ báo cáo: ngày đến trước ngày từ; quá 24 tháng (RP-05) hoặc 12 tháng (Excel kế toán) |
| 400 | `BAD_REQUEST` | Sai định dạng query, ví dụ `month` không phải `YYYY-MM`; `message` nói rõ trường nào |
| 403 | `ASSET_NOT_HELD` | Báo hỏng thiết bị mình không giữ, không chịu trách nhiệm |
| 404 | `ASSET_INCIDENT_NOT_FOUND` | Không có báo cáo |
| 409 | `ASSET_INCIDENT_OPEN` | Đã có báo cáo cùng loại đang chờ cho tài sản này |
| 409 | `ASSET_INCIDENT_NOT_ALLOWED` | Tài sản đang sửa, đang bảo dưỡng, hoặc đã báo mất |
| 409 | `ASSET_INCIDENT_HANDLED` | Báo cáo đã có người xử lý |
| 409 | `ASSET_LOSS_REPORTED` | Thu hồi, điều chuyển tài sản đang chờ xác minh mất |
| 409 | `ASSET_ASSIGNMENT_NOT_RETURNED` | Xin biên bản thu hồi khi chưa thu hồi |

---

## Composable — useAssetService

Bản đầy đủ (hơn 40 hàm) ở `nhan-su/app/services/asset.service.ts`. Khung và vài hàm tiêu biểu:

```typescript
// services/asset.service.ts
import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse, PaginatedResponse, PaginatedMeta } from '~/types/api.types';
import type { Asset, AssetQueryParams, AssignBody, AssignResult, AssetRenewal, RenewalBody, MyAssets } from '~/types/asset.types';

export const useAssetService = () => {
  const authFetch = useAuthFetch();

  return {
    async findAll(params?: AssetQueryParams): Promise<{ data: Asset[]; meta: PaginatedMeta }> {
      const res = await authFetch<PaginatedResponse<Asset>>('/v1/assets', { params });
      return { data: res.data, meta: res.meta };
    },

    exportExcel(params?: AssetQueryParams): Promise<Blob> {
      return authFetch<Blob>('/v1/assets/export', { params, responseType: 'blob' });
    },

    async findOne(id: number): Promise<Asset> {
      return (await authFetch<ApiResponse<Asset>>(`/v1/assets/${id}`)).data;
    },

    async assign(id: number, body: AssignBody): Promise<AssignResult> {
      return (await authFetch<ApiResponse<AssignResult>>(`/v1/assets/${id}/assignments`, { method: 'POST', body })).data;
    },

    async revealLicenseKey(id: number): Promise<string> {
      // Không lưu kết quả vào store hay localStorage
      return (await authFetch<ApiResponse<{ licenseKey: string }>>(`/v1/assets/${id}/license-key/reveal`, { method: 'POST' })).data.licenseKey;
    },

    async documentUrl(documentId: number): Promise<string> {
      return (await authFetch<ApiResponse<{ url: string }>>(`/v1/asset-documents/${documentId}/url`)).data.url;
    },

    // ── Tự phục vụ ──
    async myAssets(): Promise<MyAssets> {
      return (await authFetch<ApiResponse<MyAssets>>('/v1/me/assets')).data;
    },

    async renewMyService(id: number, body: RenewalBody): Promise<AssetRenewal> {
      return (await authFetch<ApiResponse<AssetRenewal>>(`/v1/me/asset-services/${id}/renewals`, { method: 'POST', body })).data;
    },
  };
};
```

---

## Hạ tầng FE cần nối

| Chỗ | Việc |
|---|---|
| `types/entitlement.types.ts` | Thêm `'ASSET'` vào `ModuleCode` |
| `composables/useModuleAccess.ts` | `MODULE_ROUTES.ASSET = ['/management/assets', '/assets']` |
| `permission-guard.global.ts` | `ROUTE_PERMISSIONS`: `/management/assets` → `asset:read`, `/management/assets/settings` → `asset:manage` |
| Sidebar quản lý | Nhóm "Tài sản" (`module: 'ASSET'`) |
| Sidebar nhân viên | Mục "Tài sản của tôi" (`module: 'ASSET'`), badge `pendingConfirmationCount` |
| `utils/notification-route.ts` | Bốn `case` ở mục "Thông báo"; **đợt 2** thêm `asset_incident` |
| Trang quản lý | `<CommonAppModuleNotice module="ASSET" />` |
| Menu (`config/app-modules.ts`) | **Đợt 2.** Thêm mục "Báo hỏng, báo mất" → `/management/assets/incidents` (`asset:read`, `module: 'ASSET'`); đổi "Sửa chữa" thành "Sửa chữa, bảo dưỡng" |

Danh sách màn hình: `docs/modules/15-assets.md` mục 11.

---

## Edge Cases

| Tình huống | HTTP | Ghi chú |
|-----------|------|---------|
| `EMPLOYEE` gọi `/v1/assets` | 403 | `FORBIDDEN`, kể cả có `asset:manage` |
| `MANAGER` mở tài sản phòng khác | 403 | `ASSET_SCOPE_FORBIDDEN` |
| Người thiếu `asset:value:read` | 200 | Mọi trường tiền `null`, `canViewValue: false`, Excel không có cột tiền |
| `HR` bấm xem license key | 403 | `ASSET_LICENSE_KEY_FORBIDDEN`: chỉ ADMIN và người phụ trách |
| `HR` tự đổi người phụ trách dịch vụ thành chính mình | 403 | `ASSET_OWNER_SELF_ASSIGN` |
| `MANAGER` mở chi tiết nhà cung cấp | 200 | Chỉ thấy tài sản, phiếu sửa của phòng mình |
| Hai người cấp cùng một máy cùng lúc | 201 / 409 | Một người thành công, một người `ASSET_ALREADY_ASSIGNED` |
| Cấp ghế thứ 6 cho dịch vụ 5 ghế | 201 | Kèm `warnings: ['SEATS_EXCEEDED']` |
| Cấp ghế cho người đã có ghế | 409 | `ASSET_SEAT_ALREADY_HELD` |
| Thu hồi lần hai | 409 | `ASSET_ASSIGNMENT_CLOSED` |
| Serial trùng với tài sản đã xoá | 201 | Được phép |
| Tạo dịch vụ USD mà bỏ trống nguyên giá | 201 | Không có số tiền thì không đòi tỷ giá |
| Thiết bị khấu hao xong vẫn dùng | 200 | `bookValue = 0`, không âm |
| Nhân viên nghỉ việc còn giữ tài sản | 200 | Vẫn cho nghỉ; người quản lý nhận N-09; tài sản vẫn ở người đó đến khi thu hồi |
| Module chỉ xem, nhân viên xác nhận bàn giao | 200 | Route có ✓ ở cột RO |
| Module tắt, cho nhân viên nghỉ | 200 | Thành công, không có N-09 |
| `PATCH` gửi `note: null` để xoá ghi chú | 200 | Ghi chú **giữ nguyên** (hạn chế hiện tại) |
| Nhập Excel có cột Password | 201 | Cột bị bỏ qua, liệt kê ở `ignoredColumns` |
| Nhập Excel có chú thích ô do openpyxl ghi | 201 | Chú thích bị bỏ qua, dữ liệu nhập bình thường |
| Nhập Excel, "Người sử dụng" không khớp nhân viên của công ty | 201 | Dòng đó vào `errors`, các dòng khác vẫn nhập |
| Mở presigned URL sau khi hết hạn | 403 từ S3 | Gọi lại `.../documents/:id/url` |

---

## Đợt 2 — lô 2a (13/11/2026)

Thiết kế: `docs/modules/15-assets.md` mục 16. Phần này bổ sung, không đổi hành vi nào của đợt 1 ngoài các điểm
ghi rõ dưới đây. Các kiểu ở mục "TypeScript Types" phía trên **đã cập nhật** cho đợt 2 (dòng có chú thích
`// đợt 2`); bảng dưới là tóm tắt phần thay đổi. Lô 2b (thanh lý, tem QR, kiểm kê) ở mục "Đợt 2 — lô 2b" cuối file.

### Thay đổi kiểu dữ liệu

| Chỗ | Thay đổi |
|---|---|
| `AssetStatus` | Thêm `LOSS_REPORTED` "Mất (chờ xác minh)" và `IN_MAINTENANCE` "Đang bảo dưỡng". Mọi bộ lọc trạng thái phải có hai giá trị này |
| `AssetCategory` | Thêm `defaultMaintenanceMonths: number \| null`. Gửi `0` khi sửa để bỏ |
| `Asset.physical` | Thêm `maintenanceIntervalMonths: number \| null`, `nextMaintenanceDate: string \| null` (`YYYY-MM-DD`) |
| `Asset` | Thêm `openIncidents: { id, type, typeLabel, createdAt }[]`: báo hỏng, báo mất đang chờ xử lý. Danh sách hiện cờ khi mảng không rỗng |
| `AssetMaintenance.type` | Thêm `MAINTENANCE` "Bảo dưỡng" bên cạnh `REPAIR` "Sửa chữa". Danh sách phiếu cần cột Loại |
| `AssetMaintenance.createdBy` | Giờ có thể `null`: phiếu bảo dưỡng do hệ thống tự sinh theo lịch. Hiện "Hệ thống" |
| `AssetDocument.links[]` | Thêm `incidentId: number \| null`: ảnh của báo hỏng, báo mất |
| `AssetEvent.type` | Thêm `INCIDENT_REPORTED`, `INCIDENT_HANDLED`, `MAINTENANCE_SCHEDULED`. Nhãn `REPAIR_OPENED`, `REPAIR_CLOSED` đổi thành "Mở/Đóng phiếu sửa chữa hoặc bảo dưỡng"; payload có `maintenanceType` |

```ts
type AssetStatus =
  | 'AVAILABLE' | 'IN_USE' | 'IN_REPAIR' | 'BROKEN' | 'LOST'
  | 'LOSS_REPORTED' | 'IN_MAINTENANCE' // đợt 2
  | 'DISPOSED' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';

interface AssetIncident {
  id: number;
  asset: { id: number; code: string; name: string; status: AssetStatus; statusLabel: string };
  type: 'DAMAGE' | 'LOSS';
  typeLabel: string;            // "Báo hỏng" | "Báo mất"
  status: 'OPEN' | 'REPAIR_OPENED' | 'LOSS_CONFIRMED' | 'CLOSED';
  statusLabel: string;          // "Chờ xử lý" | "Đã tạo phiếu sửa" | "Đã xác nhận mất" | "Đã đóng"
  description: string;
  occurredOn: string | null;    // YYYY-MM-DD, ngày phát hiện do nhân viên khai
  reportedBy: { id: number; name: string };
  handledBy: { id: number; name: string } | null;
  handledAt: string | null;     // ISO
  handlingNote: string | null;
  maintenanceId: number | null; // phiếu sửa tạo từ báo hỏng
  photoDocumentIds: number[];   // mở ảnh qua GET /v1/asset-documents/:id/url hoặc /v1/me/assets/documents/:id/url
  createdAt: string;
}

interface IncidentQuery { page?: number; limit?: number; status?: AssetIncident['status']; type?: AssetIncident['type']; assetId?: number }
interface HandleIncidentBody { note?: string }                                   // close
interface ConfirmLossBody extends HandleIncidentBody { lostOn?: string }         // YYYY-MM-DD, mặc định occurredOn
interface RepairFromIncidentBody extends HandleIncidentBody { vendorId?: number; underWarranty?: boolean }

interface HandoverPdf { document: AssetDocument; url: string } // url là presigned, hết hạn sau 1 giờ

interface AssetOverview {
  asOf: string;                 // YYYY-MM-DD
  canViewValue: boolean;
  total: number;                // mọi tài sản và dịch vụ trong phạm vi người xem
  byStatus: { status: AssetStatus; statusLabel: string; count: number }[]; // chỉ trạng thái có ít nhất 1 tài sản
  byDepartment: { departmentName: string; count: number; costVnd: number | null; bookValue: number | null }[];
  totals: { costVnd: number; bookValue: number } | null; // null khi canViewValue = false
  serviceCostThisMonth: number | null;                   // null khi canViewValue = false
  expiringIn30Days: number;     // dịch vụ sắp gia hạn + thiết bị sắp hết bảo hành, 30 ngày tới
  maintenanceDueIn30Days: number; // = meta.total của GET /assets?maintenanceDueWithinDays=30
  pendingConfirmations: number; // số TÀI SẢN có cấp phát chờ xác nhận = meta.total của GET /assets?pendingConfirmation=true
  openIncidents: number;        // báo hỏng, báo mất đang chờ
}
interface ServiceCostReport {
  month: string;                // YYYY-MM
  rows: { renewalId: number; assetId: number; code: string; name: string; categoryName: string;
          vendorName: string | null; ownerName: string | null; periodStart: string; periodEnd: string;
          amountVnd: number;    // cả kỳ gia hạn
          shareVnd: number }[]; // phần phân bổ vào tháng đang xem. Cột chính của báo cáo
  totalVnd: number;             // tổng shareVnd
}
interface MaintenanceCostReport {
  from: string; to: string;
  rows: { maintenanceId: number; assetId: number; code: string; name: string;
          type: AssetMaintenanceType; typeLabel: string; vendorName: string | null;
          underWarranty: boolean; doneAt: string; cost: number }[];
  totalVnd: number;
}
interface ServiceCostQuery { month: string; vendorId?: number; categoryId?: number; ownerId?: number } // month bắt buộc
interface MaintenanceCostQuery { from: string; to: string; assetId?: number; vendorId?: number; type?: AssetMaintenanceType }
interface DateRangeQuery { from: string; to: string } // accounting-export
```

### Vòng đời mới

```
AVAILABLE, IN_USE  ──mở phiếu bảo dưỡng (tay hoặc J-03)──▶ IN_MAINTENANCE ──đóng DONE/CANCELLED──▶ trạng thái cũ
IN_USE, AVAILABLE, BROKEN ──nhân viên báo mất──▶ LOSS_REPORTED ──HR xác nhận──▶ LOST
                                                       └──HR "Đã tìm thấy"──▶ trạng thái cũ
```

- `IN_MAINTENANCE`: người giữ giữ nguyên, khấu hao vẫn chạy, không cấp phát được (409 `ASSET_NOT_ASSIGNABLE`),
  điều chuyển vẫn được như khi đang sửa. Không đánh dấu Mất được khi còn phiếu mở (409 `ASSET_REPAIR_OPEN`).
- `LOSS_REPORTED`: cấp phát vẫn mở, khấu hao vẫn chạy cho tới khi xác nhận. Thu hồi, điều chuyển → 409
  `ASSET_LOSS_REPORTED`; mở phiếu sửa, bảo dưỡng → 409 `ASSET_NOT_REPAIRABLE`. "Thu hồi tất cả" khi nghỉ việc
  vẫn chạy (đóng cấp phát, trạng thái giữ `LOSS_REPORTED`).
- HR đánh dấu Mất thẳng bằng `POST /v1/assets/:id/status` thì báo mất đang chờ của tài sản đó tự sang
  `LOSS_CONFIRMED`.

### Bật tắt nút theo trạng thái

API vẫn chặn mọi trường hợp sai, nhưng ẩn hoặc khoá nút theo bảng này để người dùng không bấm vào lỗi 409. Mọi nút
ghi ở trang quản lý cần `asset:manage`; người chỉ có `asset:read` (MANAGER, DIRECTOR mặc định) chỉ xem.

**Trang chi tiết thiết bị (`kind = PHYSICAL`)**

| Nút | Hiện khi | Lỗi nếu bấm sai |
|---|---|---|
| Cấp phát | `AVAILABLE` | 409 `ASSET_ALREADY_ASSIGNED` (đang `IN_USE`), `ASSET_NOT_ASSIGNABLE` (trạng thái khác) |
| Điều chuyển, Thu hồi | Có người giữ (`holders` không rỗng) và trạng thái khác `LOSS_REPORTED` | 409 `ASSET_LOSS_REPORTED` |
| Mở phiếu sửa | `AVAILABLE`, `IN_USE`, `BROKEN` | 409 `ASSET_REPAIR_OPEN`, `ASSET_NOT_REPAIRABLE` |
| Mở phiếu bảo dưỡng | `AVAILABLE`, `IN_USE` | 409 `ASSET_REPAIR_OPEN`, `ASSET_NOT_REPAIRABLE` |
| Đánh dấu Mất | `AVAILABLE`, `IN_USE`, `BROKEN`, `LOSS_REPORTED` | 409 `ASSET_REPAIR_OPEN` khi đang sửa, bảo dưỡng |
| Biên bản bàn giao | Mỗi dòng cấp phát của thiết bị | – |
| Biên bản thu hồi | Dòng cấp phát đã có `returnedAt` | 409 `ASSET_ASSIGNMENT_NOT_RETURNED` |
| Cảnh báo báo hỏng, báo mất | `openIncidents` không rỗng: dải cảnh báo kèm link sang tab Báo hỏng | – |

**Trang Báo hỏng, báo mất (`/management/assets/incidents`)**, chỉ báo cáo `status = OPEN` mới có nút:

| Loại | Nút | Route |
|---|---|---|
| `DAMAGE` | **Tạo phiếu sửa** (hỏi ghi chú, nhà sửa, bảo hành) | `POST /v1/asset-incidents/:id/repair` |
| `DAMAGE` | **Đóng, không cần sửa** (hỏi ghi chú) | `POST /v1/asset-incidents/:id/close` |
| `LOSS` | **Xác nhận mất** (hỏi ghi chú, ngày mất, mặc định `occurredOn`) | `POST /v1/asset-incidents/:id/confirm-loss` |
| `LOSS` | **Đã tìm thấy** (hỏi ghi chú) | `POST /v1/asset-incidents/:id/close` |

Báo cáo đã xử lý hiện `handledBy`, `handledAt`, `handlingNote`; báo cáo `REPAIR_OPENED` có link sang phiếu sửa
`maintenanceId` (tab Sửa chữa của tài sản). Hai người cùng xử lý một báo cáo: người sau nhận 409
`ASSET_INCIDENT_HANDLED`, tải lại danh sách.

**Tài sản của tôi (`/assets/my`)**, trên từng thiết bị đang giữ (`holding`, `asset.kind = 'PHYSICAL'`):

| Nút | Hiện khi |
|---|---|
| Báo hỏng | `asset.status` là `IN_USE`, `AVAILABLE` hoặc `BROKEN`, và mình chưa có báo hỏng `OPEN` cho tài sản đó |
| Báo mất | Như trên, với báo mất |
| Biên bản bàn giao | Mọi thiết bị trong `holding` và `history` |
| Biên bản thu hồi | Thiết bị trong `history` (đã trả) |

Lấy danh sách báo cáo đang mở của mình bằng `GET /v1/me/assets/incidents?status=OPEN` để biết nút nào phải ẩn.
Tài sản `IN_REPAIR`, `IN_MAINTENANCE`, `LOSS_REPORTED` thì ẩn cả hai nút báo, hiện nhãn trạng thái.

### Bảo dưỡng định kỳ (F-11)

**Đặt lịch:** `POST /v1/assets` hoặc `PATCH /v1/assets/:id` với khối `physical`:

```json
{ "physical": { "maintenanceIntervalMonths": 6, "nextMaintenanceDate": "2027-05-15" } }
```

- Khi tạo, bỏ trống chu kỳ thì lấy `defaultMaintenanceMonths` của loại. Có chu kỳ mà không có hạn thì hạn đầu
  tiên là hôm nay cộng chu kỳ.
- Khi sửa, `maintenanceIntervalMonths: 0` là bỏ lịch (hạn về `null`). Gửi hạn khi chưa có chu kỳ → 400
  `ASSET_MAINTENANCE_INTERVAL_REQUIRED`. Đổi lịch sinh sự kiện `MAINTENANCE_SCHEDULED`.

**Mở phiếu tay:** `POST /v1/assets/:id/maintenances` với `"type": "MAINTENANCE"` (mặc định `REPAIR`). Chỉ khi tài
sản `AVAILABLE` hoặc `IN_USE` (409 `ASSET_NOT_REPAIRABLE`). Mỗi tài sản một phiếu mở bất kể loại (409
`ASSET_REPAIR_OPEN`).

**Việc định kỳ J-03** (07:00 hằng ngày): thiết bị có lịch, đến hạn, đang `AVAILABLE`/`IN_USE`, chưa có phiếu mở
→ tự mở phiếu `MAINTENANCE` (`createdBy: null`), tài sản sang `IN_MAINTENANCE`, gửi N-08 cho người quản lý tài sản.

**Đóng:** `POST /v1/asset-maintenances/:id/close`. Phiếu bảo dưỡng chỉ nhận `DONE` hoặc `CANCELLED` (400
`ASSET_MAINTENANCE_OUTCOME_INVALID` với `UNREPAIRABLE`). Cả hai đều đưa tài sản về trạng thái cũ và đặt hạn kế
tiếp = ngày đóng (`doneAt`) + chu kỳ. Phiếu bảo dưỡng không gửi N-07.

**Lọc:** `GET /v1/asset-maintenances?type=MAINTENANCE`. `OPEN` hiện "Mới" (chờ thực hiện), `IN_PROGRESS` hiện
"Đang xử lý"; đổi bằng `PATCH /v1/asset-maintenances/:id` `{ "status": "IN_PROGRESS" }`.

### Báo hỏng, báo mất (F-12)

#### POST /v1/me/assets/:assetId/incidents — Nhân viên báo

**Content-Type:** `multipart/form-data`

| Field | Bắt buộc | Ghi chú |
|---|---|---|
| `type` | ✓ | `DAMAGE` hoặc `LOSS` |
| `description` | ✓ | 1–4000 ký tự |
| `occurredOn` | | `YYYY-MM-DD`, mặc định hôm nay, không được sau hôm nay. Báo mất được xác nhận thì là ngày thôi khấu hao |
| `photos` | | Lặp lại field, tối đa 10 ảnh, mỗi ảnh ≤ 5 MB, JPG/PNG/HEIC. Kiểm tra ở FE trước khi gửi; BE vẫn chặn với mã riêng |

**Response 201:** `ApiSuccess<AssetIncident>`

```json
{
  "success": true,
  "data": {
    "id": 2, "asset": { "id": 6, "code": "CTA000006", "name": "Laptop Dell 2", "status": "LOSS_REPORTED", "statusLabel": "Mất (chờ xác minh)" },
    "type": "LOSS", "typeLabel": "Báo mất", "status": "OPEN", "statusLabel": "Chờ xử lý",
    "description": "Để quên trên taxi", "occurredOn": "2026-11-12",
    "reportedBy": { "id": 4, "name": "Nhân Viên A" }, "handledBy": null, "handledAt": null, "handlingNote": null,
    "maintenanceId": null, "photoDocumentIds": [], "createdAt": "2026-11-13T10:12:41.000Z"
  }
}
```

| HTTP | `error.code` | Khi nào |
|---|---|---|
| 400 | `ASSET_INCIDENT_TOO_MANY_PHOTOS` · `ASSET_INCIDENT_PHOTO_TYPE` · `ASSET_FILE_TOO_LARGE` | Ảnh không hợp lệ |
| 400 | `ASSET_INCIDENT_DATE_IN_FUTURE` | `occurredOn` sau hôm nay |
| 403 | `ASSET_NOT_HELD` | Không phải thiết bị mình đang giữ hoặc chịu trách nhiệm |
| 409 | `ASSET_INCIDENT_OPEN` | Đã có báo cáo cùng loại đang chờ |
| 409 | `ASSET_INCIDENT_NOT_ALLOWED` | Tài sản đang sửa, bảo dưỡng hoặc chờ xác minh mất |
| 409 | `ASSET_STATUS_CHANGED` | Người khác vừa đổi tài sản, tải lại |

Báo mất đổi tài sản sang `LOSS_REPORTED` ngay. Báo hỏng không đổi trạng thái. Cả hai gửi N-06 cho người quản lý
tài sản và quản lý trực tiếp của người báo.

#### GET /v1/me/assets/incidents · GET /v1/asset-incidents

Query: `page`, `limit`, `status`, `type`, `assetId` (`IncidentQuery`). Response `ApiPaginated<AssetIncident>`, mới
nhất trước. Route `/me` chỉ trả báo cáo của chính mình; route quản lý theo phạm vi tài sản (MANAGER chỉ phòng mình),
nhân viên gọi → 403 `FORBIDDEN`. Route quản lý với `assetId` ngoài phạm vi → 403 `ASSET_SCOPE_FORBIDDEN`, tài sản
không có → 404 `ASSET_NOT_FOUND` (giống trang chi tiết). Tab Báo hỏng của trang chi tiết dùng
`GET /v1/asset-incidents?assetId=:id`.
`GET /v1/asset-incidents/:id` trả một báo cáo (người gửi luôn xem được của mình), 404 `ASSET_INCIDENT_NOT_FOUND`.
Trang nhận `?open_id=` từ thông báo N-06 thì gọi route này rồi mở hộp chi tiết.

Ảnh: người quản lý mở bằng `GET /v1/asset-documents/:id/url`, người gửi mở bằng
`GET /v1/me/assets/documents/:id/url`. Cả hai trả `{ url }` presigned 1 giờ. Ảnh cũng hiện trong
`GET /v1/assets/:id/documents` (tab Giấy tờ) với `type: 'CONDITION_PHOTO'` và link có `incidentId`; tạo phiếu sửa từ
báo hỏng thì ảnh được gắn thêm vào phiếu đó (link có `maintenanceId`).

#### Xử lý (người có `asset:manage`)

| Route | Body | Kết quả | Lỗi riêng |
|---|---|---|---|
| `POST /v1/asset-incidents/:id/repair` | `{ "note"?, "vendorId"?, "underWarranty"? }` | Chỉ báo hỏng. Mở phiếu sửa mang sẵn mô tả và ảnh, báo cáo `REPAIR_OPENED`, tài sản `IN_REPAIR` | 400 `ASSET_INCIDENT_TYPE_MISMATCH`; 409 `ASSET_REPAIR_OPEN`, `ASSET_NOT_REPAIRABLE` |
| `POST /v1/asset-incidents/:id/confirm-loss` | `{ "note"?, "lostOn"? }` | Chỉ báo mất. Tài sản `LOST`, đóng cấp phát, thôi khấu hao từ `lostOn` (mặc định `occurredOn`) | 400 `ASSET_INCIDENT_TYPE_MISMATCH` |
| `POST /v1/asset-incidents/:id/close` | `{ "note"? }` | Báo hỏng: đóng không sửa. Báo mất: "Đã tìm thấy", tài sản về trạng thái trước khi báo | |

Mọi route xử lý trả 201 `ApiSuccess<AssetIncident>`; báo cáo đã xử lý → 409 `ASSET_INCIDENT_HANDLED`.

### Biên bản PDF (F-20)

`GET /v1/asset-assignments/:id/handover-pdf?kind=assign|return` (người quản lý) và
`GET /v1/me/assets/assignments/:id/handover-pdf?kind=` (người nhận hoặc người chịu trách nhiệm của lần đó).

```json
{
  "success": true,
  "data": {
    "document": { "id": 3, "type": "HANDOVER_RECORD", "typeLabel": "Biên bản bàn giao", "number": "BBG-CTA000004-1", "fileName": "BBG-CTA000004-1.pdf", "mimeType": "application/pdf", "...": "như AssetDocument" },
    "url": "https://…/tenants/cta/assets/documents/….pdf?X-Amz-Signature=…"
  }
}
```

- Lần đầu sinh PDF A4 và lưu thành giấy tờ gắn vào lần cấp phát; các lần sau trả lại đúng giấy tờ đó. `url`
  hết hạn sau 1 giờ, gọi lại để lấy link mới. PDF không in giá trị tài sản.
- `kind=return` khi chưa thu hồi → 409 `ASSET_ASSIGNMENT_NOT_RETURNED`. Ghế dịch vụ → 400 `ASSET_NOT_PHYSICAL`.
  Route `/me` cho người khác → 403 `ASSET_ASSIGNMENT_NOT_YOURS`.

### Báo cáo (F-22, RP-02, RP-05, F-29)

#### GET /v1/asset-reports/overview

```json
{
  "success": true,
  "data": {
    "asOf": "2026-11-13", "canViewValue": true, "total": 9,
    "byStatus": [{ "status": "IN_USE", "statusLabel": "Đang sử dụng", "count": 3 }],
    "byDepartment": [{ "departmentName": "Kỹ thuật", "count": 2, "costVnd": 72000000, "bookValue": 47000000 }],
    "totals": { "costVnd": 156000000, "bookValue": 98000000 },
    "serviceCostThisMonth": 6450000,
    "expiringIn30Days": 1, "maintenanceDueIn30Days": 0, "pendingConfirmations": 2, "openIncidents": 0
  }
}
```

`byDepartment` chỉ tính thiết bị chưa mất, chưa thanh lý; không ai giữ thì `departmentName` là "Chưa cấp phát" (từ 14/11, luôn đứng cuối).
Người không có `asset:value:read`: `totals`, `serviceCostThisMonth` và cột tiền trong `byDepartment` là `null`.
MANAGER chỉ thấy tài sản phòng mình.

#### GET /v1/asset-reports/service-costs?month=YYYY-MM

Query thêm `vendorId`, `categoryId`, `ownerId`. Mỗi dòng là một lần gia hạn có phần phân bổ vào tháng đó theo
BR-07 (chia đều theo số tháng của kỳ, tháng cuối gánh phần lẻ).

```json
{ "success": true, "data": { "month": "2026-11", "rows": [
  { "renewalId": 1, "assetId": 12, "code": "CTA000008", "name": "ChatGPT Team", "categoryName": "Tài khoản AI", "vendorName": null, "ownerName": "Nhân Viên A", "periodStart": "2026-11-01", "periodEnd": "2026-11-30", "amountVnd": 3900000, "shareVnd": 3900000 }
], "totalVnd": 6450000 } }
```

`/export` nhận cùng query, trả `chi-phi-dich-vu-YYYY-MM.xlsx`.

#### GET /v1/asset-reports/maintenance-costs?from=&to=

`from`, `to` bắt buộc (`YYYY-MM-DD`). Query thêm `assetId`, `vendorId`, `type`. Phiếu đã đóng `DONE`/`UNREPAIRABLE`
có ngày xong trong kỳ, kỳ tối đa 24 tháng. Response `MaintenanceCostReport`:

```json
{ "success": true, "data": { "from": "2026-11-01", "to": "2026-11-30", "rows": [
  { "maintenanceId": 1, "assetId": 6, "code": "CTA000006", "name": "Laptop Dell 4", "type": "REPAIR", "typeLabel": "Sửa chữa", "vendorName": null, "underWarranty": false, "doneAt": "2026-11-13", "cost": 1200000 }
], "totalVnd": 1200000 } }
```

`/export` trả `chi-phi-sua-chua-bao-duong.xlsx`.

#### GET /v1/asset-reports/accounting-export?from=&to=

Kỳ tối đa 12 tháng. Trả `tai-san-ke-toan-<from>-<to>.xlsx` ba sheet, dòng đầu mỗi sheet ghi kỳ:

| Sheet | Cột |
|---|---|
| Khấu hao trong kỳ | Mã, Tên, Phân loại, Phòng ban sử dụng, Nguyên giá, Luỹ kế đầu kỳ, Khấu hao trong kỳ, Luỹ kế cuối kỳ, Giá trị còn lại cuối kỳ; dòng Tổng |
| Tăng trong kỳ | Mã, Tên, Phân loại, Phòng ban, Ngày ghi tăng, Nguyên giá, Số tháng khấu hao |
| Giảm trong kỳ | Mã, Tên, Phân loại, Hình thức (Mất, Đã thanh lý), Ngày ghi giảm, Nguyên giá, Luỹ kế đến ngày giảm, Giá trị còn lại |

Chỉ thiết bị có nguyên giá và khấu hao. Phòng ban lấy theo người giữ tại ngày cuối kỳ (phòng ban hiện tại của
người đó). Lỗi kỳ: 400 `ASSET_REPORT_RANGE_INVALID` (đến trước từ), `ASSET_REPORT_RANGE_TOO_LONG`.

### Thông báo mới

| Mã | `type` | Người nhận | Push | `refType` → trang |
|---|---|---|---|---|
| N-06 | `ASSET_INCIDENT_REPORTED` | Người quản lý tài sản, quản lý trực tiếp của người báo | ✓ | `asset_incident` → `/management/assets/incidents?open_id=:refId` |
| N-08 | `ASSET_MAINTENANCE_DUE` | Người quản lý tài sản | – | `asset` → `/management/assets/:refId` |

Quản lý trực tiếp của người báo thường có vai trò MANAGER nên vào được trang Báo hỏng. Nếu người đó không có
`asset:read`, guard trang chặn như mọi trang quản lý khác; đó không phải lỗi của thông báo.

### Màn hình web lô 2a

Bản đầy đủ của thiết kế ở `docs/modules/15-assets.md` mục 16.8. Phần thuộc lô 2a:

| Màn | Việc |
|---|---|
| `/management/assets` | Thêm **Tổng quan** (F-22) làm phần đầu trang hoặc tab đầu, từ `GET /v1/asset-reports/overview`: thẻ số theo trạng thái (tách riêng "Mất (chờ xác minh)" và "Đang bảo dưỡng"), bảng theo phòng ban, thẻ việc chờ (sắp hết hạn, sắp bảo dưỡng, chờ xác nhận, báo hỏng đang mở). Mỗi thẻ dẫn tới danh sách tương ứng: "sắp hết hạn" → `/management/assets/reports?tab=expiring`, "báo hỏng đang mở" → `/management/assets/incidents`, "sắp bảo dưỡng" → `/management/assets?maintenanceDueWithinDays=30`, "chờ xác nhận" → `/management/assets?pendingConfirmation=true`. Trang danh sách đọc hai tham số này từ URL, hiện thành nhãn lọc có nút bỏ, và giữ chúng khi đổi trang, khi lọc thêm và khi xuất Excel. Thẻ tiền ẩn khi `canViewValue = false`. Bảng danh sách hiện biểu tượng cảnh báo khi `openIncidents` không rỗng |
| `/management/assets/[id]` | Khối **Bảo dưỡng định kỳ** ở tab Thông tin (chu kỳ, hạn kế tiếp, tô màu khi còn ≤ 30 ngày hoặc quá hạn); tab mới **Báo hỏng** (`GET /v1/asset-incidents?assetId=`); tab Sửa chữa thêm cột Loại và nút Mở phiếu bảo dưỡng; dòng cấp phát ở tab Người dùng có nút **Biên bản** (bàn giao, thu hồi) |
| Form tài sản (`AssetFormModal`) | Thêm hai ô chu kỳ bảo dưỡng (tháng, 0–120) và hạn kế tiếp cho thiết bị. Khi sửa, ô chu kỳ để 0 là bỏ lịch |
| `/management/assets/settings` | Cột và ô **Chu kỳ bảo dưỡng mặc định** cho loại thiết bị; gửi `0` để bỏ |
| `/management/assets/maintenances` | Bộ lọc Loại (Sửa chữa / Bảo dưỡng), cột Loại, người tạo `null` hiện "Hệ thống" |
| `/management/assets/incidents` | **Trang mới.** Danh sách có phân trang, lọc trạng thái và loại, mặc định `status=OPEN`; hộp chi tiết có ảnh và các nút ở mục "Bật tắt nút theo trạng thái"; nhận `?open_id=` |
| `/management/assets/reports` | Thêm tab **Chi phí dịch vụ** (chọn tháng, lọc nhà cung cấp, loại, người phụ trách, xuất Excel), tab **Chi phí sửa chữa, bảo dưỡng** (chọn kỳ, lọc loại, xuất Excel) và nút **Xuất cho kế toán** (chọn kỳ tối đa 12 tháng, tải file). Ba phần này cần `asset:value:read`: ẩn với người không có |
| Bộ lọc trạng thái mọi màn | Thêm "Mất (chờ xác minh)" và "Đang bảo dưỡng"; thêm màu cho hai trạng thái này |
| `/assets/my` | Nút **Báo hỏng**, **Báo mất** trên từng thiết bị (hộp thoại: mô tả, ngày phát hiện, tối đa 10 ảnh); khu **Báo cáo của tôi** từ `GET /v1/me/assets/incidents`; nút **Biên bản** trên thiết bị đang giữ và đã trả |
| Menu, thông báo | Mục "Báo hỏng, báo mất"; `case 'asset_incident'` trong `utils/notification-route.ts` |

Excel: gọi bằng `responseType: 'blob'` rồi `downloadAssetBlob(blob, tên)` như `/v1/assets/export`. FE tự đặt tên
file (`chi-phi-dich-vu-YYYY-MM.xlsx`, `chi-phi-sua-chua-bao-duong.xlsx`, `tai-san-ke-toan-<from>-<to>.xlsx`), vì
`Content-Disposition` không được expose qua CORS. Biên bản PDF thì khác: route trả JSON `HandoverPdf`, mở `url` ở tab
mới.

### Composable — hàm mới

Đã thêm vào `useAssetService` (`app/services/asset.service.ts`), đặt tên theo kiểu các hàm sẵn có. Kiểu ở web có
tiền tố `Asset` (ví dụ `AssetOverview`, `AssetServiceCostQuery`):

```typescript
overview(): Promise<AssetOverview>                                        // GET  /v1/asset-reports/overview
serviceCosts(q: ServiceCostQuery): Promise<ServiceCostReport>             // GET  /v1/asset-reports/service-costs
exportServiceCosts(q: ServiceCostQuery): Promise<Blob>                    // GET  .../service-costs/export
maintenanceCosts(q: MaintenanceCostQuery): Promise<MaintenanceCostReport> // GET  /v1/asset-reports/maintenance-costs
exportMaintenanceCosts(q: MaintenanceCostQuery): Promise<Blob>            // GET  .../maintenance-costs/export
exportAccounting(q: DateRangeQuery): Promise<Blob>                        // GET  /v1/asset-reports/accounting-export
handoverPdf(assignmentId: number, kind: 'assign' | 'return'): Promise<HandoverPdf>    // GET /v1/asset-assignments/:id/handover-pdf
findIncidents(q: IncidentQuery): Promise<{ data: AssetIncident[]; meta: PaginatedMeta }>  // GET /v1/asset-incidents
findIncident(id: number): Promise<AssetIncident>                          // GET  /v1/asset-incidents/:id
repairFromIncident(id: number, body: RepairFromIncidentBody): Promise<AssetIncident> // POST .../repair
confirmIncidentLoss(id: number, body: ConfirmLossBody): Promise<AssetIncident> // POST .../confirm-loss
closeIncident(id: number, body: HandleIncidentBody): Promise<AssetIncident> // POST .../close
// Tự phục vụ
reportIncident(assetId: number, body: ReportIncidentBody): Promise<AssetIncident> // POST /v1/me/assets/:assetId/incidents
myIncidents(q: IncidentQuery): Promise<{ data: AssetIncident[]; meta: PaginatedMeta }> // GET /v1/me/assets/incidents
myHandoverPdf(assignmentId: number, kind: 'assign' | 'return'): Promise<HandoverPdf>  // GET /v1/me/assets/assignments/:id/handover-pdf
```

`reportIncident` nhận body có kiểu (`type`, `description`, `occurredOn?`, `photos?: File[]`) rồi tự dựng `FormData`
như `uploadDocument`: mỗi ảnh một lần `append('photos', file)`, không tự đặt header `Content-Type` để trình duyệt
điền boundary. `openMaintenance` sẵn có nhận thêm
`type: 'MAINTENANCE'`; `findMaintenances` nhận thêm `type`.

### Khi module chỉ xem hoặc tắt

| Route lô 2a | `READ_ONLY` |
|---|---|
| Mọi `GET`: tổng quan, báo cáo, Excel, biên bản PDF, danh sách và chi tiết báo hỏng | Chạy |
| Báo hỏng, báo mất (`POST /v1/me/assets/:id/incidents`) | 403 `MODULE_READ_ONLY` hoặc `MODULE_EXPIRED`: ẩn hai nút báo |
| Xử lý báo cáo, mở phiếu bảo dưỡng, sửa lịch bảo dưỡng | 403 như trên: ẩn nút như các thao tác ghi khác |

Việc định kỳ J-03 không chạy khi module chỉ xem hoặc tắt. Module tắt thì mọi route 403 `MODULE_*`, ẩn menu.

### Edge cases lô 2a

| Tình huống | HTTP | Ghi chú |
|---|---|---|
| Nhân viên báo hỏng thiết bị đang giữ, 2 ảnh | 201 | Tài sản vẫn `IN_USE`, có `openIncidents`; N-06 tới người quản lý tài sản và quản lý trực tiếp |
| Báo hỏng lần hai khi lần trước chưa xử lý | 409 | `ASSET_INCIDENT_OPEN` |
| Báo hỏng thiết bị người khác giữ | 403 | `ASSET_NOT_HELD` |
| Gửi 11 ảnh, hoặc một ảnh 6 MB | 400 | `ASSET_INCIDENT_TOO_MANY_PHOTOS`, `ASSET_FILE_TOO_LARGE`. FE nên chặn trước |
| Ảnh PDF hay TXT | 400 | `ASSET_INCIDENT_PHOTO_TYPE` |
| Ngày phát hiện là ngày mai | 400 | `ASSET_INCIDENT_DATE_IN_FUTURE` |
| Báo mất | 201 | Tài sản `LOSS_REPORTED` ngay, lọc được bằng `?status=LOSS_REPORTED` |
| HR thu hồi, điều chuyển tài sản chờ xác minh mất | 409 | `ASSET_LOSS_REPORTED`: xử lý báo mất trước |
| HR xác nhận mất | 201 | Tài sản `LOST`, đóng cấp phát, `physical.depreciationStopDate` = ngày nhân viên khai |
| HR bấm Đã tìm thấy | 201 | Tài sản về trạng thái trước khi báo, người giữ giữ nguyên |
| Tạo phiếu sửa từ báo hỏng | 201 | Báo cáo `REPAIR_OPENED`, tài sản `IN_REPAIR`, ảnh gắn sang phiếu |
| Hai HR cùng xử lý một báo cáo | 201 / 409 | Người sau `ASSET_INCIDENT_HANDLED` |
| Lọc `assetId` của tài sản phòng khác (MANAGER) | 403 | `ASSET_SCOPE_FORBIDDEN`. Tài sản người trong phòng làm mất vẫn thuộc phòng (từ 14/11) |
| J-03 chạy, thiết bị đến hạn | – | Phiếu `MAINTENANCE` mới, `createdBy: null`, tài sản `IN_MAINTENANCE`, N-08 |
| Cấp phát thiết bị đang bảo dưỡng | 409 | `ASSET_NOT_ASSIGNABLE`. Điều chuyển vẫn được |
| Đóng phiếu bảo dưỡng "Không sửa được" | 400 | `ASSET_MAINTENANCE_OUTCOME_INVALID`: phiếu bảo dưỡng chỉ có Xong hoặc Huỷ |
| Đóng hoặc huỷ phiếu bảo dưỡng | 201 | Hạn kế tiếp = ngày đóng + chu kỳ |
| Sửa tài sản với `maintenanceIntervalMonths: 0` | 200 | Bỏ lịch, hạn về `null` |
| Gửi `nextMaintenanceDate` khi chưa có chu kỳ | 400 | `ASSET_MAINTENANCE_INTERVAL_REQUIRED` |
| Biên bản thu hồi của cấp phát chưa trả | 409 | `ASSET_ASSIGNMENT_NOT_RETURNED` |
| Biên bản cho ghế dịch vụ | 400 | `ASSET_NOT_PHYSICAL`: ẩn nút với dịch vụ |
| Nhân viên xin biên bản của người khác | 403 | `ASSET_ASSIGNMENT_NOT_YOURS` |
| Tải biên bản lần hai | 200 | Cùng `document.id`, `url` mới |
| MANAGER mở tổng quan | 200 | Chỉ tài sản phòng mình, mọi trường tiền `null` |
| MANAGER gọi báo cáo chi phí hoặc Excel kế toán | 403 | `FORBIDDEN`: thiếu `asset:value:read` |
| Excel kế toán kỳ 13 tháng | 400 | `ASSET_REPORT_RANGE_TOO_LONG` |
| `month=2026-13` | 400 | `BAD_REQUEST`, `message` nói rõ |
| Bấm thẻ "sắp bảo dưỡng" rồi mở phiếu sửa một máy trong danh sách | 200 | Máy đó ra khỏi danh sách và thẻ giảm 1, vì đang sửa thì không xét bảo dưỡng |
| Nhân viên bấm "Đã nhận" | 200 | Tài sản ra khỏi `pendingConfirmation=true`, thẻ "chờ xác nhận" giảm 1 |
| `maintenanceDueWithinDays=0`, `366` hoặc `abc`; `pendingConfirmation=abc` | 400 | `BAD_REQUEST` |
| MANAGER bấm hai thẻ này | 200 | Chỉ tài sản phòng mình, số khớp thẻ của chính họ |

---

## Đợt 2 — sửa sau bài nhập vai (14/11/2026)

Bài nhập vai toàn luồng lô 2a tìm ra ba chỗ chặn việc và năm lỗi dữ liệu; người dùng duyệt sửa toàn bộ. Phần này
chỉ nói chỗ **đổi so với mục "Đợt 2 — lô 2a"** ở trên. Thiết kế đầy đủ: `docs/modules/15-assets.md` mục 16.13.
Backend cần migration `20261114075502_add_asset_assignment_end_reason_and_dispute_response`.

### Kiểu dữ liệu đổi

```typescript
// Trạng thái báo hỏng, báo mất: thêm RESOLVED = phiếu sửa tạo từ báo hỏng đã đóng (kết quả ở `maintenance`)
type AssetIncidentStatus = 'OPEN' | 'REPAIR_OPENED' | 'LOSS_CONFIRMED' | 'CLOSED' | 'RESOLVED'

// Sự kiện lịch sử: thêm một loại
// ASSIGNMENT_DISPUTE_RESOLVED  payload { assignmentId, reason, response }

interface AssignmentAsset {
  // ...các trường cũ
  serialNumber: string | null           // mới: hiện ở Tài sản của tôi (O4)
}

interface AssetAssignment {
  // ...các trường cũ
  endReason: 'RETURNED' | 'TRANSFERRED' | 'LOST' | null   // null khi đang giữ
  endReasonLabel: string | null         // "Thu hồi" | "Điều chuyển" | "Mất"
  transferredFrom: { assignmentId: number; holderName: string } | null  // lần này sinh ra do điều chuyển
  transferredTo: { assignmentId: number; holderName: string } | null    // lần này kết thúc do điều chuyển
  disputeResponse: string | null        // câu trả lời của người quản lý tài sản khi người nhận báo chưa đúng
  disputeRespondedAt: string | null     // ISO
}

interface AssetIncident {
  // ...các trường cũ
  maintenance: {
    id: number
    status: AssetMaintenanceStatus
    statusLabel: string                 // "Xong" | "Không sửa được" | "Đã huỷ" | ...
    doneAt: string | null
    workDone: string | null
  } | null
}

interface AssetOverview {
  // ...các trường cũ
  total: number                         // ĐỔI: không gồm Mất, Đã thanh lý, Đã huỷ (byStatus vẫn đủ)
  physicalCount: number                 // mới
  serviceCount: number                  // mới
  disputedConfirmations: number         // mới: = meta.total của GET /assets?disputed=true
}

interface AssetQueryParams {
  // ...các trường cũ
  disputed?: boolean                    // mới
}
```

Sự kiện cũ có thêm trường: `ASSIGNED` có `note`, và khi điều chuyển có `fromName`; `RETURNED` có `endReason`, và khi
điều chuyển có `toName`, `note`, `condition`; `STATUS_CHANGED` sang LOST có `closedAssignmentId`, `holderName` khi
đóng một lần cấp phát; `UPDATED` có thể là `{ maintenanceId, maintenanceVendor: { from, to } }` (đổi đơn vị sửa của
phiếu, tên đơn vị); `INCIDENT_HANDLED` có thể là `{ incidentId, outcome: 'RESOLVED', maintenanceId,
maintenanceOutcome }`.

### Nhãn đổi (`…Label` trong response)

| Nhóm | Mã | Nhãn cũ | Nhãn mới |
|---|---|---|---|
| Loại hình | PHYSICAL | Tài sản hữu hình | **Thiết bị** |
| Trạng thái | BROKEN | Hỏng chờ xử lý | **Hỏng** |
| Trạng thái | LOSS_REPORTED | Mất (chờ xác minh) | **Chờ xác minh mất** |
| Chu kỳ | ONE_TIME | Một lần | **Mua đứt** |
| Xác nhận | PENDING | Chờ xác nhận | **Chờ người nhận xác nhận** |
| Xác nhận | DISPUTED | Báo không đúng | **Người nhận báo chưa đúng** |
| Phiếu | OPEN | Mới | **Mới mở** |
| Nhà cung cấp | SUPPLIER / SERVICE | Bán hàng / Dịch vụ | **Bán thiết bị** / **Cung cấp dịch vụ** |
| Giấy tờ | HANDOVER_RECORD | Biên bản bàn giao | **Biên bản bàn giao, thu hồi** |
| Sự kiện | ASSIGNED / ASSIGNMENT_DISPUTED | Bàn giao / Báo bàn giao không đúng | **Cấp phát** / **Người nhận báo chưa đúng** |
| Báo cáo | RESOLVED | – | **Đã xử lý xong** |

Bộ nhãn tại chỗ của web (ô lọc) phải khớp bảng này. Thuật ngữ thao tác: **Cấp phát**, **Điều chuyển**,
**Thu hồi**; "bàn giao" chỉ còn trong tên giấy tờ "Biên bản bàn giao".

### Endpoint mới: POST /v1/asset-assignments/:id/dispute-response

Người có `asset:manage` trả lời khi người nhận báo cấp phát chưa đúng. Cấp phát về `PENDING`, lưu câu trả lời,
người nhận nhận thông báo N-15 rồi kiểm lại và bấm Đã nhận. Muốn đổi tài sản khác thì thu hồi rồi cấp phát lại như
thường, không cần trả lời.

```json
// Request
{ "response": "Đã gửi bổ sung sạc qua tổ xe chiều nay" }

// Response 201: AssetAssignment
{ "success": true, "data": { "id": 12, "confirmation": "PENDING", "confirmationLabel": "Chờ người nhận xác nhận",
  "disputeReason": "Không có sạc", "disputeResponse": "Đã gửi bổ sung sạc qua tổ xe chiều nay",
  "disputeRespondedAt": "2026-11-14T03:10:00.000Z", "...": "..." } }
```

| HTTP | Mã | Khi nào |
|---|---|---|
| 400 | `ASSET_DISPUTE_RESPONSE_REQUIRED` | `response` chỉ có khoảng trắng |
| 400 | `BAD_REQUEST` | Thiếu `response` ("Câu trả lời không được để trống."), dài quá 1000 ký tự |
| 403 | `FORBIDDEN` / `ASSET_FORBIDDEN` | Không có `asset:manage` |
| 404 | `ASSET_ASSIGNMENT_NOT_FOUND` | |
| 409 | `ASSET_ASSIGNMENT_CLOSED` | Lần cấp phát đã kết thúc |
| 409 | `ASSET_ASSIGNMENT_NOT_DISPUTED` | Người nhận chưa báo chưa đúng, hoặc đã có người trả lời trước |

Người nhận vẫn tự bấm Đã nhận được khi đang `DISPUTED` (hai bên thống nhất ngoài hệ thống), không phải chờ trả lời.

### Hành vi đổi

| Chỗ | Trước | Sau |
|---|---|---|
| Phạm vi MANAGER (`/assets`, chi tiết, tổng quan, báo cáo, Excel) | Chỉ tài sản đang cấp phát cho người trong phòng hoặc cho phòng | Thêm **dịch vụ do người trong phòng phụ trách** và **thiết bị đã mất mà lần cấp phát cuối thuộc phòng** |
| `/asset-incidents` của MANAGER | Theo phạm vi tài sản | Thêm mọi báo cáo do người trong phòng gửi; `GET /asset-incidents/:id` mở được báo cáo đó |
| `?departmentId=` (HR lọc theo phòng) | Như phạm vi cũ | Cùng điều kiện mới |
| `?search=` | Mã, tên, serial, model | Thêm tên, mã nhân viên của người đang giữ, người chịu trách nhiệm, người phụ trách dịch vụ |
| `?pendingConfirmation=true` | Cấp phát `PENDING` | Không đổi; cấp phát `DISPUTED` nằm ở `?disputed=true` |
| Xác nhận mất, đánh dấu Mất | Cấp phát đóng như thu hồi, gửi N-02 | `endReason: 'LOST'`, `returnNote` là lý do; người giữ nhận N-13; biên bản thu hồi trả 409 `ASSET_ASSIGNMENT_LOST` |
| Điều chuyển | Ghi chú "Điều chuyển", tình trạng trống, hai biên bản rời | Lần cũ `endReason: 'TRANSFERRED'`, `returnNote` "Điều chuyển sang {người mới}. {ghi chú}"; không gửi tình trạng thì lấy tình trạng đang ghi; lần mới có `transferredFrom`. **Một biên bản điều chuyển** số `BBDC-{mã}-{id}` cho cả hai bên: `handover-pdf?kind=assign` của lần mới và `kind=return` của lần cũ trả cùng một `document`; người giữ cũ mở được qua `/me/...` |
| Biên bản | Người tải lên là người mở đầu tiên | `uploadedBy` là người lập: người cấp phát (bàn giao, điều chuyển) hoặc người thu hồi. Có câu dẫn, câu kết, "Biên bản lập thành 02 bản" |
| Tạo phiếu sửa từ báo hỏng | Báo cáo đứng mãi ở `REPAIR_OPENED` | Phiếu đóng (Xong, Không sửa được, Huỷ) thì báo cáo sang `RESOLVED`, xem kết quả ở `maintenance` |
| Đóng phiếu | Nhận ngày xong bất kỳ | 400 `ASSET_MAINTENANCE_DONE_IN_FUTURE` (sau hôm nay), 400 `ASSET_MAINTENANCE_DONE_BEFORE_SENT` (trước ngày gửi đi) |
| Báo cáo Khấu hao `GET /asset-reports/depreciation` | Gồm tài sản đã ghi giảm | Bỏ tài sản có ngày thôi khấu hao ≤ `asOf`. Tổng khớp `overview.totals` |
| Excel kế toán, sheet "Khấu hao trong kỳ" | Cộng tài sản ghi giảm vào cuối kỳ | Vẫn có dòng (khấu hao đến ngày giảm), luỹ kế và giá trị còn lại cuối kỳ = 0, cột "Ghi chú" mới, không cộng vào dòng Tổng |
| Mọi file Excel | Ngày là chữ `2026-11-13`, tiền không định dạng | Ô ngày thật `dd/mm/yyyy`, tiền có dấu phân cách, dòng tiêu đề cố định có bộ lọc, dòng 1 ghi kỳ báo cáo (trừ file danh sách). Tên sheet: "Khấu hao", "Chi phí dịch vụ" (không còn ngày). Cột "Mã tài sản" thay "Mã QLTS". File danh sách thêm cột "Hạn bảo dưỡng" |
| Câu lỗi | Có câu tiếng Anh: `Forbidden resource`, `email must be an email`, `Cannot POST …`, `Internal server error`, `Validation failed (numeric string is expected)` | Mọi câu là tiếng Việt, có nhãn trường người dùng thấy và bước tiếp theo. **Mã lỗi không đổi**, web vẫn hiện `error.message` |
| Thông báo cho chính mình | Cấp phát cho chính mình cũng nhận N-01 | Người thao tác không nhận thông báo về việc mình vừa làm; một việc chỉ một thông báo cho một người |

### Thông báo mới và đổi

| Mã | `type` | Người nhận | `refType` → trang |
|---|---|---|---|
| N-01 (đổi chữ) | `ASSET_ASSIGNED` | Người được cấp phát | `asset_holding` → `/assets/my` |
| N-02b | `ASSET_RETURNED` | Người giữ cũ khi điều chuyển, title "🔄 Tài sản đã được điều chuyển" | `asset_holding` → `/assets/my` |
| N-13 | `ASSET_LOST` | Người đang giữ khi tài sản được xác nhận mất | `asset_holding` → `/assets/my` |
| N-13b | `ASSET_LOST` | Quản lý trực tiếp của người giữ, chỉ đọc | `asset` → `/management/assets/:refId` |
| N-14 | `ASSET_INCIDENT_HANDLED` | Người gửi báo hỏng, báo mất | **`asset_my_incident`** → `/assets/my?incident_id=:refId` (refId là **id báo cáo**) |
| N-15 | `ASSET_DISPUTE_RESOLVED` | Người nhận khi người quản lý trả lời | `asset_holding` → `/assets/my` |
| N-16 | `ASSET_RENEWED` | Người phụ trách dịch vụ khi người khác gia hạn | `asset_service` → `/assets/my?tab=services&open_id=:refId` |
| N-17 | `ASSET_REPAIR_OPENED` | Người đang giữ khi mở phiếu sửa hoặc bảo dưỡng | `asset_holding` → `/assets/my` |
| N-07b | `ASSET_REPAIR_DONE` | Quản lý trực tiếp của người giữ, chỉ đọc | `asset` → `/management/assets/:refId` |
| N-06 (đổi) | `ASSET_INCIDENT_REPORTED` | Người quản lý tài sản nhận bản "…, cần xử lý" kèm việc cần làm; quản lý trực tiếp giữ bản "Thông tin:" | không đổi |

Nội dung từng câu: `docs/notifications/notification-content-map.md`. Định tuyến app: `fcm-notification-routing.json`.

### Mã lỗi mới

| HTTP | Mã | Khi nào |
|---|---|---|
| 400 | `ASSET_DISPUTE_RESPONSE_REQUIRED` | Trả lời rỗng |
| 409 | `ASSET_ASSIGNMENT_NOT_DISPUTED` | Trả lời một cấp phát không ở trạng thái báo chưa đúng |
| 409 | `ASSET_ASSIGNMENT_LOST` | Xin biên bản thu hồi của lần cấp phát kết thúc vì mất: ẩn nút này khi `endReason === 'LOST'` |
| 400 | `ASSET_MAINTENANCE_DONE_IN_FUTURE` | Ngày xong sau hôm nay |
| 400 | `ASSET_MAINTENANCE_DONE_BEFORE_SENT` | Ngày xong trước ngày gửi đi |

### Màn hình web cần đổi theo contract này

| Màn | Việc |
|---|---|
| Chi tiết tài sản, tab Người dùng | Dòng `DISPUTED`: hiện lý do và nút **Trả lời** (hộp nhập câu trả lời → `dispute-response`); đã trả lời thì hiện câu trả lời và giờ. Lần cấp phát đã kết thúc hiện `endReasonLabel`; `TRANSFERRED` hiện "Điều chuyển sang {transferredTo.holderName}", lần mới hiện "Nhận từ {transferredFrom.holderName}". Nút Biên bản thu hồi ẩn khi `endReason === 'LOST'`; khi `TRANSFERRED` ghi "Biên bản điều chuyển" |
| Hộp Điều chuyển | Có ô tình trạng lúc điều chuyển (mặc định tình trạng đang ghi của thiết bị) và ô ghi chú; toast "Đã điều chuyển {mã} từ {người cũ} sang {người mới} …" |
| Tổng quan | Thẻ "Người nhận báo chưa đúng" (`disputedConfirmations`) bấm sang `/management/assets?disputed=true`; số tổng dùng `total` mới, tách `physicalCount`, `serviceCount` |
| Danh sách tài sản | Đọc `?disputed=true` từ URL như hai bộ lọc thẻ cũ, có nhãn lọc |
| Tài sản của tôi | Thẻ cấp phát `PENDING` có `disputeResponse` (người quản lý đã trả lời): hiện "Người quản lý tài sản trả lời: …" cạnh nút Đã nhận. Mục lịch sử: `endReason === 'LOST'` nằm ở nhóm riêng "Đã ghi nhận mất", không ở "Đã thu hồi", không có nút biên bản thu hồi. Hiện `asset.serialNumber`. Nhận `?incident_id=` để mở đúng báo cáo |
| Báo hỏng, báo mất (của tôi và trang quản lý) | Trạng thái `RESOLVED` "Đã xử lý xong" kèm kết quả phiếu (`maintenance.statusLabel`, `doneAt`, `workDone`) |
| Lịch sử tài sản | Nhãn cho `ASSIGNMENT_DISPUTE_RESOLVED`, trường `maintenanceVendor` ("Đơn vị sửa chữa của phiếu"), `fromName`, `toName`, `note`, `closedAssignmentId`/`holderName`, `INCIDENT_HANDLED` outcome `RESOLVED` |
| Định tuyến thông báo (`notification-route.ts`) | `asset_my_incident` → `/assets/my?incident_id=:refId`; năm `type` mới |

### Edge cases

| Tình huống | HTTP | Ghi chú |
|---|---|---|
| MANAGER mở thiết bị nhân viên phòng mình làm mất | 200 | Trước là 403 |
| MANAGER phòng khác mở thiết bị đó | 403 | `ASSET_SCOPE_FORBIDDEN` |
| MANAGER mở dịch vụ do chính mình hoặc người trong phòng phụ trách | 200 | Có trong danh sách, thẻ "Sắp đến hạn", báo cáo Sắp hết hạn |
| Người nhận báo chưa đúng rồi tự bấm Đã nhận | 200 | `CONFIRMED`, không cần chờ trả lời |
| HR trả lời rồi người nhận lại báo chưa đúng | 200 | Lại `DISPUTED` với lý do mới; `disputeResponse`, `disputeRespondedAt` về `null` (câu trả lời cũ còn ở sự kiện `ASSIGNMENT_DISPUTE_RESOLVED`) |
| Người nhận bấm Đã nhận sau khi báo chưa đúng hoặc sau khi được trả lời | 200 | `CONFIRMED`; `disputeReason`, `disputeResponse`, `disputeRespondedAt` cùng về `null`, lịch sử còn ở tab sự kiện |
| Điều chuyển không gửi tình trạng | 201 | Cả hai lần cấp phát lấy tình trạng đang ghi của thiết bị |
| Người giữ cũ mở biên bản thu hồi của lần đã điều chuyển | 200 | Trả biên bản điều chuyển `BBDC-…` dùng chung |
| Biên bản thu hồi của lần kết thúc vì mất | 409 | `ASSET_ASSIGNMENT_LOST` |
| Dữ liệu điều chuyển trước 14/11 | 200 | Không nối được hai lần (`transferredFrom` null), biên bản giữ cách ghi cũ |
| Nhân viên báo hỏng thiết bị mình giữ, HR tạo phiếu rồi đóng Xong | – | Người báo nhận N-14 hai lần (tiếp nhận, sửa xong), không nhận N-17 hay N-07; báo cáo `RESOLVED`; quản lý trực tiếp nhận N-07b |
| Đóng phiếu với ngày xong là ngày mai | 400 | `ASSET_MAINTENANCE_DONE_IN_FUTURE` |
| Overview sau khi có tài sản mất | 200 | `total` giảm, `byStatus` vẫn có `LOST`; `totals.bookValue` bằng tổng của báo cáo Khấu hao |

## Đợt 2 — lô 2b (14/11/2026): thanh lý, tem QR, kiểm kê

Thiết kế: `docs/modules/15-assets.md` mục 16 (F-15, F-17, F-18, BR-16 đến BR-19). Migration
`20261114231043_add_asset_disposals_and_stocktakes` và `20261115004940_add_counterparty_to_asset_disposals` (bên mua,
bên nhận, thêm sau bài nhập vai). Phần này chỉ thêm; hành vi lô 2a giữ nguyên trừ các dòng "Hành vi đổi". App mobile
(quét tem, màn kiểm kê) đọc `docs/mobile/assets.md`. Mục "Sửa sau bài nhập vai lô 2b" ở cuối liệt kê những gì đổi so
với bản đầu của mục này.

### Quyền mới

| Mã | Mặc định | Dùng cho |
|---|---|---|
| `asset:disposal:approve` | DIRECTOR, CHIEF. ADMIN luôn qua | Duyệt, từ chối phiếu thanh lý; tab "Thanh lý tài sản" trong hộp thư duyệt |

Tạo, sửa, gửi lại, huỷ phiếu; in tem; kiểm kê dùng `asset:manage` có sẵn. Người lập phiếu **không tự duyệt** được
phiếu của mình (403 `ASSET_DISPOSAL_SELF_APPROVE`), trừ ADMIN. Công ty đang có nhận quyền mới khi người vận hành
chạy `tenancy:seed-all --only permissions --apply`.

### Hành vi đổi

| Chỗ | Trước | Sau |
|---|---|---|
| `GET /v1/assets` và `/export` | Không chọn trạng thái thì có cả tài sản Đã thanh lý | Không chọn `status` thì **không** có `DISPOSED`. Chọn `status=DISPOSED` để xem riêng. Báo cáo, Excel kế toán vẫn có |
| `Asset` | – | Thêm `pendingDisposalId: number \| null`: phiếu thanh lý đang chờ duyệt có tài sản này |
| Cấp phát, mở phiếu sửa, bảo dưỡng | – | Tài sản có `pendingDisposalId` → 409 `ASSET_DISPOSAL_PENDING`. J-03 không tự mở phiếu bảo dưỡng cho nó, thẻ "Sắp bảo dưỡng" không đếm nó |
| `AssetOverview` | – | Thêm `pendingDisposals: number` (= `meta.total` của `GET /asset-disposals?status=PENDING`) |
| `GET /v1/approval/counts` | – | Thêm `assetDisposals: number`, cộng vào `total`. 0 khi module `ASSET` không `ENABLED` |
| `AssetDocument.links[]` | – | Thêm `disposalId: number \| null`. `POST /v1/asset-documents` nhận thêm `disposalId` (biên bản thanh lý) |
| Excel kế toán, sheet "Giảm trong kỳ" | Hình thức "Đã thanh lý" | "Thanh lý: Bán/Huỷ/Mất/Tặng", thêm cột "Phiếu thanh lý" (`Số {id}`) |
| `AssetEvent.type` | – | Thêm `DISPOSAL_REQUESTED` "Đề nghị thanh lý", `DISPOSAL_REJECTED` "Phiếu thanh lý bị từ chối", `DISPOSAL_CANCELLED` "Huỷ phiếu thanh lý", `DISPOSED` "Thanh lý", `STOCKTAKE_CHECKED` "Kiểm kê", `STOCKTAKE_RESOLVED` "Xử lý chênh lệch kiểm kê" |

### TypeScript Types

```ts
type DisposalMethod = 'SALE' | 'DESTROY' | 'LOSS' | 'DONATION';   // Bán | Huỷ | Mất | Tặng
type DisposalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'; // Chờ duyệt | Đã duyệt | Bị từ chối | Đã huỷ

interface AssetDisposal {
  id: number;
  method: DisposalMethod; methodLabel: string;
  status: DisposalStatus; statusLabel: string;
  disposalDate: string;          // YYYY-MM-DD, ngày ghi giảm, thôi khấu hao từ ngày này
  reason: string;
  proceeds: number | null;       // giá thu về VND; null khi người lập không nhập (không thu tiền) hoặc khi không có quyền xem giá (xem canViewValue)
  round: number;                 // vòng hiện tại; gửi khi duyệt, từ chối
  submittedAt: string;           // ISO, lần gửi gần nhất
  createdBy: { id: number; name: string };
  decidedBy: { id: number; name: string } | null;
  decidedAt: string | null;
  decisionNote: string | null;   // lý do từ chối, hoặc ghi chú khi duyệt
  items: {
    assetId: number; code: string; name: string;
    status: AssetStatus; statusLabel: string;
    categoryName: string; serialNumber: string | null; location: string | null;
    costVnd: number | null;               // null khi không có quyền xem giá
    bookValueAtDisposal: number | null;   // chốt lúc duyệt; null khi chưa duyệt hoặc không có quyền xem giá
  }[];
  totalBookValue: number | null;          // chỉ khi APPROVED và có quyền xem giá
  history: { round: number; action: 'SUBMITTED' | 'RESUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
             actionLabel: string; actorName: string; at: string; note: string | null }[];
  documents: { id: number; type: string; typeLabel: string; fileName: string; mimeType: string; uploadedBy: { id: number; name: string };
               sizeBytes: number; uploadedAt: string }[]; // mở qua GET /v1/asset-documents/:id/url
  actions: { canDecide: boolean; canEdit: boolean; canCancel: boolean }; // tính theo người đang xem
  canViewValue: boolean;
  createdAt: string;
}
interface CreateDisposalBody {
  assetIds: number[];            // 1–100 thiết bị
  method: DisposalMethod;
  disposalDate: string;          // không sau hôm nay
  reason: string;                // 3–4000 ký tự
  proceeds?: number;             // VND, số nguyên ≥ 0
}
interface UpdateDisposalBody extends CreateDisposalBody { resubmit?: boolean } // gửi đủ trường như lúc tạo
interface DecideDisposalBody { round: number; note?: string }               // note bắt buộc khi từ chối
interface DisposalQuery { page?: number; limit?: number; status?: DisposalStatus; assetId?: number }

type StocktakeStatus = 'OPEN' | 'CLOSED' | 'CANCELLED';                    // Đang kiểm kê | Đã đóng | Đã huỷ
type StocktakeResult = 'PENDING' | 'OK' | 'WRONG_LOCATION' | 'WRONG_HOLDER' | 'DAMAGED' | 'NOT_FOUND';
// Chưa kiểm | Đúng | Sai vị trí | Sai người giữ | Hỏng | Không tìm thấy
type StocktakeResolution = 'NONE' | 'UPDATED' | 'REPAIR_OPENED' | 'MARKED_LOST' | 'IGNORED';
// Chưa xử lý | Đã cập nhật | Đã mở phiếu sửa | Đã chuyển Mất | Bỏ qua

interface AssetStocktake {
  id: number; name: string;
  status: StocktakeStatus; statusLabel: string;
  scope: { departmentIds: number[]; departmentNames: string[]; categoryIds: number[]; categoryNames: string[];
           text: string };       // "phòng Kỹ thuật; loại Laptop" hoặc "toàn công ty"
  note: string | null;
  openedBy: { id: number; name: string }; openedAt: string;
  closedBy: { id: number; name: string } | null; closedAt: string | null;
  summary: { total: number; checked: number; pending: number; ok: number; wrongLocation: number;
             wrongHolder: number; damaged: number; notFound: number;
             outOfScope: number;   // quét được ngoài phạm vi
             unresolved: number }; // dòng chênh lệch chưa xử lý
}
interface AssetStocktakeLine {
  id: number; stocktakeId: number;
  asset: { id: number; code: string; name: string; status: AssetStatus; statusLabel: string;
           categoryName: string; serialNumber: string | null; location: string | null };
  inScope: boolean;              // false: quét được ngoài phạm vi, chỉ tham khảo
  expectedHolderId: number | null; expectedHolderName: string | null;       // theo sổ lúc mở đợt
  expectedDepartmentId: number | null; expectedDepartmentName: string | null;
  expectedLocation: string | null;
  result: StocktakeResult; resultLabel: string;
  observedLocation: string | null; observedNote: string | null;
  checkedBy: { id: number; name: string } | null; checkedAt: string | null; checkedByScan: boolean;
  resolution: StocktakeResolution; resolutionLabel: string;
  resolvedBy: { id: number; name: string } | null; resolvedAt: string | null; resolutionNote: string | null;
}
interface CreateStocktakeBody { name: string; departmentIds?: number[]; categoryIds?: number[]; note?: string }
interface CheckStocktakeBody {
  assetId?: number;              // ghi tay trên danh sách
  code?: string;                 // ô "Nhập hoặc bắn mã": mã tài sản hoặc nguyên chuỗi QR
  result: Exclude<StocktakeResult, 'PENDING'>;
  observedLocation?: string; note?: string;
  byScan?: boolean;              // true khi đến từ máy bắn mã hay ô bắn mã
}
interface ResolveStocktakeLineBody {
  resolution: Exclude<StocktakeResolution, 'NONE'>;
  location?: string;                               // UPDATED
  toEmployeeId?: number;                           // UPDATED: người giữ đúng
  toDepartmentId?: number; responsibleId?: number; // UPDATED: giao cho phòng ban
  lostDate?: string;                               // MARKED_LOST, mặc định ngày đóng đợt
  note?: string;                                   // bắt buộc khi IGNORED
}
interface StocktakeLinesQuery { page?: number; limit?: number /* ≤200, mặc định 50 */; result?: StocktakeResult;
  inScope?: boolean; discrepancy?: boolean; unresolved?: boolean; search?: string }

interface PrintLabelsBody extends Omit<AssetQuery, 'page' | 'limit' | 'kind'> { assetIds?: number[] } // ≤500
```

### Endpoint

| Method | Path | Quyền | Chỉ xem | Ghi chú |
|---|---|---|---|---|
| POST | `/v1/asset-disposals` | `asset:manage` | | Body `CreateDisposalBody` → 201 `AssetDisposal` (PENDING, round 1) |
| GET | `/v1/asset-disposals` | `asset:read` | ✓ | Phân trang. MANAGER chỉ thấy phiếu có tài sản thuộc phòng mình |
| GET | `/v1/asset-disposals/:id` | `asset:read` | ✓ | Kèm `history`, `documents`, `actions` |
| PATCH | `/v1/asset-disposals/:id` | `asset:manage`, người lập (hoặc ADMIN) | | Chỉ khi `REJECTED`. `resubmit: true` → PENDING, `round + 1` |
| POST | `/v1/asset-disposals/:id/approve` | `asset:disposal:approve` | | Body `{ round, note? }`. Tài sản → `DISPOSED`, thôi khấu hao, chốt giá trị còn lại |
| POST | `/v1/asset-disposals/:id/reject` | `asset:disposal:approve` | | Body `{ round, note }`, note bắt buộc. Tài sản giữ nguyên |
| POST | `/v1/asset-disposals/:id/cancel` | `asset:manage`, người lập (hoặc ADMIN) | | Khi `PENDING` hoặc `REJECTED`. Body `{ note? }` |
| POST | `/v1/asset-labels` | `asset:manage` | ✓ | Body `PrintLabelsBody` → **file PDF** (`application/pdf`, 201), khổ A6, mỗi trang một tem. Chỉ thiết bị, tối đa 500 |
| POST | `/v1/asset-stocktakes` | `asset:manage` | | Body `CreateStocktakeBody` → 201 `AssetStocktake`. Đã có đợt mở → 409 |
| GET | `/v1/asset-stocktakes` | `asset:read`, phạm vi toàn công ty | ✓ | Phân trang, `?status=`. MANAGER → 403 |
| GET | `/v1/asset-stocktakes/open` | `asset:read` | ✓ | `{ id, name } \| null`: đợt đang mở, cho nút "Tạo đợt" và tooltip |
| GET | `/v1/asset-stocktakes/:id` | `asset:read`, phạm vi toàn công ty | ✓ | `AssetStocktake` kèm `summary` |
| GET | `/v1/asset-stocktakes/:id/lines` | `asset:read`, phạm vi toàn công ty | ✓ | `StocktakeLinesQuery`. Dòng trong phạm vi đứng trước |
| GET | `/v1/asset-stocktakes/:id/export` | `asset:read`, phạm vi toàn công ty | ✓ | Biên bản kiểm kê `.xlsx`: sheet "Biên bản kiểm kê" (tiêu đề, phạm vi, số liệu, dòng), sheet "Ngoài phạm vi" nếu có |
| POST | `/v1/asset-stocktakes/:id/check` | `asset:manage` | | Body `CheckStocktakeBody` → 201 `AssetStocktakeLine`. Lần sau đè lần trước |
| POST | `/v1/asset-stocktakes/:id/close` | `asset:manage` | | Dòng `PENDING` → `NOT_FOUND`. → 201 `AssetStocktake` |
| POST | `/v1/asset-stocktakes/:id/cancel` | `asset:manage` | | Body `{ note? }`. Chỉ khi đang mở |
| POST | `/v1/asset-stocktake-lines/:id/resolve` | `asset:manage` | | Body `ResolveStocktakeLineBody` → 201 `AssetStocktakeLine`. Chỉ sau khi đóng đợt |
| GET | `/v1/me/asset-scan/:code` | JWT | ✓ | Cho app mobile (xem `docs/mobile/assets.md`). Web không dùng |

Tải PDF tem: gọi bằng `authFetch` với `responseType: 'blob'` rồi tạo link tải (`tem-tai-san.pdf`), giống tải Excel.
Lỗi 4xx của route này vẫn trả JSON như mọi route khác.

### Thanh lý: luồng và điều kiện (BR-16)

```
(tạo) ──▶ PENDING ──duyệt──▶ APPROVED: tài sản → DISPOSED
             │  └──từ chối──▶ REJECTED ──người lập sửa, resubmit──▶ PENDING (round + 1)
             └──────────────────────┴──người lập huỷ──▶ CANCELLED
```

- Thanh lý được thiết bị `AVAILABLE`, `BROKEN`, `LOST`, không có cấp phát mở, chưa nằm trong phiếu PENDING khác.
  Sai một trong các điều kiện → 409 `ASSET_DISPOSAL_NOT_ALLOWED`, kèm `error.errors: [{ assetId, code, reason }]`
  (một dòng cho mỗi tài sản lỗi). Hiện câu `error.message` và đánh dấu đỏ đúng các dòng trong `errors`.
- Lúc duyệt, server kiểm lại các điều kiện trên; tài sản đã đổi từ lúc gửi thì cũng 409 `ASSET_DISPOSAL_NOT_ALLOWED`.
- Duyệt: tài sản `DISPOSED`; `depreciationStopDate` = ngày thanh lý (tài sản đã Mất giữ ngày mất); báo hỏng còn chờ
  của tài sản tự đóng với ghi chú "Tài sản đã thanh lý theo phiếu số …".
- Duyệt và từ chối ghi có điều kiện `status = PENDING AND round = :round`: hai người bấm cùng lúc thì người sau 409
  `ASSET_DISPOSAL_CHANGED`. Gặp mã này thì tải lại phiếu.
- Nút theo `actions` của response: **Duyệt**, **Từ chối** khi `canDecide`; **Sửa và gửi lại** khi `canEdit`; **Huỷ
  phiếu** khi `canCancel`. Không tự tính lại ở web.

### Kiểm kê: luồng (BR-17)

```
(mở đợt: chốt danh sách) ──▶ OPEN ──ghi kết quả (quét, bắn mã, ghi tay; đè lần trước)──▶ OPEN
                               ├──đóng──▶ CLOSED: PENDING → NOT_FOUND ──xử lý từng dòng chênh lệch
                               └──huỷ──▶ CANCELLED
```

- Mỗi lúc chỉ **một** đợt mở (L13). Nút "Tạo đợt kiểm kê" khoá khi `GET /asset-stocktakes/open` khác `null`; tooltip
  cạnh nút ở trang danh sách và đầu trang chi tiết: "Mỗi lúc chỉ mở được một đợt kiểm kê, để mỗi lần quét luôn ghi
  vào đúng một đợt. Muốn mở đợt mới, hãy đóng hoặc huỷ đợt đang mở." Khi có đợt mở, tooltip ghi tên đợt đó.
- Đợt không gồm thiết bị Mất, Đã thanh lý. Phạm vi theo phòng ban là phòng của lần cấp phát đang mở; thiết bị trong
  kho (chưa cấp phát) chỉ vào đợt toàn công ty hoặc đợt theo loại.
- Ô **"Nhập hoặc bắn mã"** gửi `code` (nguyên chuỗi máy bắn mã trả về) với `byScan: true`, kết quả mặc định `OK`;
  sau khi ghi, xoá ô và giữ con trỏ trong ô để bắn tiếp. Response `inScope: false` thì báo "ngoài phạm vi, chỉ ghi
  tham khảo". Ghi tay trên danh sách gửi `assetId` với `byScan: false`.
- **Chênh lệch** = dòng trong phạm vi có kết quả khác Đúng (`?discrepancy=true`). Xử lý chỉ sau khi đóng đợt:
  - `UPDATED`: vị trí mới (`location`) và/hoặc người giữ đúng (`toEmployeeId`, hoặc `toDepartmentId` +
    `responsibleId`). Đổi người giữ đi qua đúng luồng điều chuyển (đang có người giữ) hoặc cấp phát (chưa có).
  - `REPAIR_OPENED`: mở phiếu sửa, mô tả "Theo kiểm kê "{tên đợt}": {kết quả}…".
  - `MARKED_LOST`: tài sản sang Mất, thôi khấu hao từ `lostDate` (mặc định ngày đóng đợt).
  - `IGNORED`: bắt buộc `note`.
  Lỗi của luồng được gọi (ví dụ 409 `ASSET_NOT_ASSIGNABLE`, `ASSET_REPAIR_OPEN`) trả nguyên mã và câu, dòng giữ
  `NONE` để xử lý lại.

### Thông báo mới

| Mã | `type` | Người nhận | `refType` → trang |
|---|---|---|---|
| N-10 | `ASSET_DISPOSAL_PENDING` | Người có `asset:disposal:approve` và ADMIN, trừ người lập. Gửi, gửi lại, và J-07 nhắc sau 3 ngày | `asset_disposal` → `/management/assets/disposals/{refId}` |
| N-10 | `ASSET_DISPOSAL_DECIDED` | Người lập phiếu, khi được duyệt (✅) hoặc bị từ chối (❌) | `asset_disposal` → `/management/assets/disposals/{refId}` |

Hai thông báo đều `NAVIGATE_ONLY` (category `REQUEST`): người duyệt phải mở phiếu xem tài sản và vòng gửi, không duyệt
nhanh từ chuông. Câu chữ: `docs/notifications/notification-content-map.md`.

### Mã lỗi mới

| HTTP | Mã | Khi nào |
|---|---|---|
| 400 | `ASSET_DISPOSAL_DATE_IN_FUTURE` | Ngày thanh lý sau hôm nay |
| 400 | `ASSET_DISPOSAL_REJECT_NOTE_REQUIRED` | Từ chối mà không ghi lý do |
| 403 | `ASSET_DISPOSAL_SELF_APPROVE` | Người lập tự duyệt, tự từ chối (trừ ADMIN) |
| 403 | `ASSET_DISPOSAL_NOT_CREATOR` | Người khác người lập sửa, gửi lại, huỷ (trừ ADMIN) |
| 404 | `ASSET_DISPOSAL_NOT_FOUND` | |
| 409 | `ASSET_DISPOSAL_NOT_ALLOWED` | Tài sản không đủ điều kiện, kèm `error.errors` |
| 409 | `ASSET_DISPOSAL_PENDING` | Cấp phát, mở phiếu sửa, bảo dưỡng tài sản đang chờ duyệt thanh lý |
| 409 | `ASSET_DISPOSAL_CHANGED` | Phiếu đã sang trạng thái hoặc vòng khác |
| 409 | `ASSET_DISPOSAL_NOT_EDITABLE` | Sửa phiếu không ở trạng thái Bị từ chối |
| 409 | `ASSET_DISPOSAL_NOT_CANCELLABLE` | Huỷ phiếu đã duyệt hoặc đã huỷ |
| 400 | `ASSET_LABEL_NOT_PHYSICAL` | Chọn dịch vụ để in tem |
| 400 | `ASSET_LABEL_EMPTY` | Bộ lọc không có thiết bị nào |
| 400 | `ASSET_LABEL_TOO_MANY` | Bộ lọc có hơn 500 thiết bị |
| 400 | `ASSET_STOCKTAKE_SCOPE_INVALID` | Phòng ban, loại không còn, hoặc chọn loại dịch vụ |
| 400 | `ASSET_STOCKTAKE_EMPTY` | Phạm vi không có thiết bị nào |
| 400 | `ASSET_STOCKTAKE_ASSET_REQUIRED` | Ghi kết quả mà không có `assetId` hay `code` |
| 400 | `ASSET_QR_INVALID` | `code` không phải mã tài sản hay tem của hệ thống |
| 400 | `ASSET_QR_OTHER_COMPANY` | Tem của công ty khác |
| 400 | `ASSET_STOCKTAKE_RESULT_INVALID` | `byScan: true` mà ghi Không tìm thấy |
| 400 | `ASSET_STOCKTAKE_RESOLVE_INPUT` | `UPDATED` thiếu cả vị trí lẫn người giữ; `IGNORED` thiếu ghi chú |
| 403 | `ASSET_SCOPE_FORBIDDEN` | MANAGER mở trang kiểm kê |
| 404 | `ASSET_STOCKTAKE_NOT_FOUND`, `ASSET_STOCKTAKE_LINE_NOT_FOUND` | |
| 404 | `ASSET_NOT_FOUND` | Mã bắn vào không có ở công ty đang chọn |
| 409 | `ASSET_STOCKTAKE_OPEN_EXISTS` | Mở đợt khi đã có đợt mở; câu lỗi có tên đợt |
| 409 | `ASSET_STOCKTAKE_CLOSED` | Ghi kết quả, đóng, huỷ đợt đã đóng hoặc đã huỷ |
| 409 | `ASSET_STOCKTAKE_NOT_CLOSED` | Xử lý chênh lệch khi đợt còn mở (hoặc đã huỷ) |
| 409 | `ASSET_STOCKTAKE_LINE_OUT_OF_SCOPE` | Xử lý dòng ngoài phạm vi |
| 409 | `ASSET_STOCKTAKE_LINE_NO_DISCREPANCY` | Xử lý dòng Đúng |
| 409 | `ASSET_STOCKTAKE_LINE_RESOLVED` | Dòng đã được xử lý |

### Màn hình web lô 2b

| Màn | Việc |
|---|---|
| `/management/assets` (danh sách) | Chọn nhiều dòng; nút **In tem** (theo lựa chọn, hoặc theo bộ lọc đang áp khi không chọn dòng nào). Dòng có `pendingDisposalId` có nhãn "Chờ duyệt thanh lý". Bộ lọc trạng thái có "Đã thanh lý" |
| `/management/assets/[id]` | Nút **In tem**; nút **Đề nghị thanh lý** khi thiết bị `AVAILABLE`/`BROKEN`/`LOST`, không có người giữ, `pendingDisposalId === null`; có `pendingDisposalId` thì băng thông báo "Đang chờ duyệt thanh lý, phiếu số …" kèm link, và ẩn Cấp phát, Mở phiếu sửa |
| `/management/assets/disposals` | Mới: danh sách phiếu, lọc trạng thái, nút **Tạo phiếu thanh lý** (chọn nhiều thiết bị đủ điều kiện, hình thức, ngày, lý do, giá thu về). Lỗi `ASSET_DISPOSAL_NOT_ALLOWED` đánh dấu đúng dòng |
| `/management/assets/disposals/[id]` | Mới: thông tin phiếu, bảng tài sản (giá trị khi có quyền), lịch sử các vòng, giấy tờ (tải biên bản thanh lý với `type=DISPOSAL_RECORD`, `disposalId`), nút theo `actions`. Từ chối mở hộp bắt buộc lý do. Sửa và gửi lại mở form như lúc tạo |
| `/management/assets/stocktakes` | Mới: danh sách đợt với số liệu `summary`; nút **Tạo đợt kiểm kê** (tên, phòng ban, loại) khoá kèm tooltip L13 khi có đợt mở |
| `/management/assets/stocktakes/[id]` | Mới: đầu trang số liệu và tooltip L13; ô **Nhập hoặc bắn mã** (đợt mở); danh sách dòng lọc theo kết quả, trong/ngoài phạm vi, chênh lệch, chưa xử lý; ghi tay từng dòng (đợt mở); **Đóng đợt** (hộp xác nhận nói rõ số tài sản chưa kiểm sẽ thành Không tìm thấy), **Huỷ đợt**; sau khi đóng, mỗi dòng chênh lệch có nút **Xử lý** (bốn cách); **Xuất biên bản** |
| `/management/approval` | Tab **Thanh lý tài sản** (khoá `assetDisposals`), hiện khi người xem có `asset:disposal:approve` và module `ASSET` dùng đầy đủ; danh sách `GET /asset-disposals?status=PENDING`, bấm dòng mở trang chi tiết phiếu |
| Menu tài sản | Thêm "Thanh lý" và "Kiểm kê" (người có `asset:manage`; "Thanh lý" cả người có `asset:disposal:approve`) |
| Tổng quan | Thẻ "Phiếu thanh lý chờ duyệt" (`pendingDisposals`) bấm sang `/management/assets/disposals?status=PENDING` |
| Lịch sử tài sản | Nhãn sáu sự kiện mới; payload `disposalId`, `round`, `method`, `note`, `stocktakeName`, `result`, `resolution`, `location { from, to }`, `maintenanceId`, `lostDate` |
| Định tuyến thông báo | `asset_disposal` → `/management/assets/disposals/:refId`; hai `type` mới |

### Khi module chỉ xem hoặc tắt

Chỉ xem: in tem, quét, xem phiếu, xem đợt, xuất biên bản vẫn chạy. Tạo, sửa, duyệt, huỷ phiếu; mở, ghi, đóng, huỷ
đợt; xử lý chênh lệch → 403 `MODULE_*`. Số `assetDisposals` của hộp thư duyệt về 0. J-07 dừng.

### Edge cases lô 2b

| Tình huống | HTTP | Ghi chú |
|---|---|---|
| Đề nghị thanh lý laptop đang cấp phát (S-16) | 409 | `ASSET_DISPOSAL_NOT_ALLOWED`, lý do "Đang cấp phát… Bạn thu hồi trước" |
| Giám đốc từ chối, HR sửa và gửi lại, giám đốc duyệt (S-15) | 201 | `history`: SUBMITTED, REJECTED, RESUBMITTED, APPROVED; tài sản có sự kiện từ chối và thanh lý |
| HR bỏ bớt tài sản khi gửi lại | 200 | Tài sản bị bỏ hết `pendingDisposalId`, cấp phát lại được |
| Thanh lý thiết bị đã Mất | 201 | `depreciationStopDate` giữ ngày mất |
| Phiếu nhiều tài sản, một tài sản bị cấp phát lại trước khi duyệt | 409 | Không thể vì cấp phát bị chặn khi phiếu chờ duyệt; dữ liệu cũ sai thì duyệt trả `ASSET_DISPOSAL_NOT_ALLOWED` |
| In tem không chọn dòng, bộ lọc 0 thiết bị | 400 | `ASSET_LABEL_EMPTY` |
| Bắn mã tài sản phòng khác vào đợt theo phòng (S-30) | 201 | `inScope: false`, tài sản không đổi gì, không có sự kiện |
| Bắn hai lần một tài sản | 201 | Lần sau đè lần trước |
| Đóng đợt còn tài sản chưa kiểm | 201 | Thành `NOT_FOUND`, vào danh sách chênh lệch |
| Chuyển Mất từ kiểm kê | 201 | Đóng cấp phát (lý do Mất), người giữ nhận N-13, thôi khấu hao từ ngày đóng đợt |
| Hai người xử lý cùng một dòng | 409 | Người sau `ASSET_STOCKTAKE_LINE_RESOLVED` |
| MANAGER mở `/management/assets/stocktakes` | 403 | Ẩn menu Kiểm kê với MANAGER |

### Sửa sau bài nhập vai lô 2b (15/11/2026)

Bài nhập vai (HR quản lý tài sản, giám đốc duyệt, trưởng phòng Kho vận, đi kiểm kê bằng máy quét USB) cùng bản rà câu
chữ tìm ra các chỗ dưới đây. Kiểu ở mục "TypeScript Types" phía trên **chưa** sửa theo bảng này; bảng này là nguồn đúng.

**Thêm field, thêm tham số**

| Chỗ | Thay đổi |
|---|---|
| `AssetDisposal.counterparty: string \| null` | Bên mua (Bán) hoặc bên nhận (Tặng). `null` với Tiêu huỷ, Mất |
| `CreateDisposalBody.counterparty?: string` (cả `UpdateDisposalBody`) | Tối đa 200 ký tự, server cắt khoảng trắng. **Bắt buộc** khi `method` là `SALE` hoặc `DONATION` (400 `ASSET_DISPOSAL_COUNTERPARTY_REQUIRED`); gửi với `DESTROY`, `LOSS` thì bị bỏ qua |
| `proceeds` | Là **tổng** giá thu về của cả phiếu, không theo từng máy. Ghi rõ trên form |
| `AssetDisposal.items[].estimatedBookValue: number \| null` | Giá trị còn lại tính tới ngày thanh lý của phiếu, cho phiếu **chưa duyệt** (Chờ duyệt, Bị từ chối, Đã huỷ). Đúng con số sẽ chốt nếu duyệt. `null` khi đã duyệt (xem `bookValueAtDisposal`), khi không có quyền xem giá, khi thiết bị không có nguyên giá |
| `AssetDisposal.totalBookValue` | Có cả khi chưa duyệt: tổng `estimatedBookValue`. Đã duyệt thì là tổng đã chốt. `null` khi không có quyền xem giá |
| `GET /v1/assets?disposable=true` | Chỉ thiết bị đề nghị thanh lý được: Sẵn sàng, Hỏng hoặc Mất, không ai giữ, chưa nằm trong phiếu chờ duyệt. Ô tìm thiết bị của form phiếu thanh lý **dùng tham số này**, không gợi ý máy sẽ bị từ chối |
| `GET /v1/asset-stocktakes/:id/lines?unresolved=true` | Giờ là "dòng chênh lệch chưa xử lý" (đã gồm điều kiện của `discrepancy`). Trước đây gửi một mình thì ra mọi dòng |

**Hành vi đổi**

| Chỗ | Trước | Sau |
|---|---|---|
| `POST /v1/asset-labels` theo bộ lọc, không chọn `status` | Có cả thiết bị Mất | Bỏ thiết bị Mất (không còn vật để dán). Chọn `status=LOST` hoặc gửi `assetIds` thì vẫn in được |
| Tem PDF | Mã, tên, loại, công ty | Thêm **số serial** sau tên loại ("Laptop · Serial DL-3440-0102"), để phân biệt máy trùng tên |
| `ASSET_DISPOSAL_NOT_ALLOWED` lúc **duyệt** | Câu bảo bỏ tài sản khỏi phiếu | Câu cho người duyệt: "Có n thiết bị không còn đủ điều kiện thanh lý: … Bạn từ chối phiếu để người lập bỏ các thiết bị này rồi gửi lại." |
| `error.errors[].reason` của thiết bị đang cấp phát | "Đang cấp phát cho người dùng…" | Có tên người hoặc phòng đang giữ và chỉ chỗ thu hồi: "Đang cấp phát cho Trịnh Văn Long. Bạn thu hồi ở tab Người dùng của trang tài sản rồi đề nghị thanh lý lại." Thiết bị không còn thì `code` là "Một thiết bị", không lộ id |
| `ASSET_QR_OTHER_COMPANY` | "…công ty bạn đang chọn." | "Tem này không phải của {tên công ty} nên không ghi vào đợt kiểm kê được. Bạn để riêng tem này ra rồi quét tiếp thiết bị khác." |
| `AssetStocktake.scope.text` | "phòng Kho vận; loại Laptop" (ra "phòng Phòng …" khi tên phòng đã có chữ Phòng) | "Kho vận, Điều phối vận tải; loại Laptop". Web ghép "Phạm vi: " phía trước, đừng thêm chữ "phòng" |
| `expectedHolderName` khi cấp cho phòng ban | "Kỹ thuật (Lan chịu trách nhiệm)" | "Kỹ thuật, Lan chịu trách nhiệm"; thiếu người chịu trách nhiệm thì chỉ tên phòng |
| Biên bản kiểm kê Excel | Một dòng tiêu đề dính tên công ty | Dòng 1 tên công ty, dòng 2 "BIÊN BẢN KIỂM KÊ TÀI SẢN: {tên đợt}", dòng 3 phạm vi và ai mở, đóng đợt, dòng 4 số liệu |
| Excel kế toán, sheet "Giảm trong kỳ" | – | Thêm cột "Bên mua, bên nhận" |
| Thông báo N-10 cho người duyệt | Tiêu đề giống nhau cho mọi phiếu | Tiêu đề có số phiếu: `📋 Cần duyệt phiếu thanh lý số {id}`; nội dung có bên mua, giá thu về khi có |

**Nhãn đổi** (lấy từ `…Label` của response, web phải đổi các bản sao nhãn trong `asset.types.ts` cho khớp)

| Mã | Trước | Sau |
|---|---|---|
| `AssetDisposalMethod.DESTROY` | Huỷ | **Tiêu huỷ** (tránh lẫn với nút "Huỷ phiếu" và trạng thái "Đã huỷ") |
| `AssetStocktakeResolution.REPAIR_OPENED` | Đã mở phiếu sửa | Đã tạo phiếu sửa (khớp báo hỏng lô 2a) |
| `AssetStocktakeResolution.MARKED_LOST` | Đã chuyển Mất | Đã xác nhận mất (khớp "Xác nhận mất" ở Tác vụ) |
| `AssetStocktakeResolution.IGNORED` | Bỏ qua | **Giữ nguyên sổ** (đổi ở vòng 3, xem mục dưới) |
| `AssetStocktakeResolution.UPDATED` | Đã cập nhật | **Đã cập nhật sổ** (đổi ở vòng 3) |
| `AssetEventType.DISPOSAL_REJECTED` | Phiếu thanh lý bị từ chối | Từ chối phiếu thanh lý |

**Thuật ngữ thống nhất cho câu chữ web** (backend đã theo): "dừng khấu hao" (không "thôi khấu hao"); "người lập phiếu";
"thiết bị" cho mọi thứ trong phiếu thanh lý và đợt kiểm kê; "lần gửi" thay cho "vòng" (không hiện chữ "vòng" hay số
vòng cho người dùng, chỉ hiện "Gửi lại lần {n}" khi `round > 1`); "quét tem" cho thao tác đọc tem bằng máy quét, ô nhập
tên "Nhập mã hoặc quét tem"; "Xác nhận mất" cho cách xử lý chuyển Mất.

**Mã lỗi mới**

| HTTP | Mã | Khi nào |
|---|---|---|
| 400 | `ASSET_DISPOSAL_COUNTERPARTY_REQUIRED` | Bán hoặc Tặng mà không ghi bên mua, bên nhận |

### Sửa sau vòng nhập vai thứ 3 của lô 2b (15/11/2026)

Kế toán (in biên bản, gửi lại phiếu) và tổng giám đốc (duyệt trên máy tính bảng) tìm ra các chỗ dưới đây.

**Thêm field**

| Chỗ | Thay đổi |
|---|---|
| `AssetStocktake.summary.checked` | Giờ chỉ đếm thiết bị **có người ghi kết quả** (`checkedAt` khác null). Trước đây đợt đã đóng thì thiết bị tự thành Không tìm thấy cũng bị tính là đã kiểm |
| `AssetStocktake.summary.autoNotFound: number` | Mới. Trong `notFound`: số thiết bị không ai kiểm, tự thành Không tìm thấy khi đóng đợt. Đợt đang mở thì luôn 0 (phần chưa kiểm vẫn ở `pending`) |
| `AssetDisposal.history[].changes: string \| null` | Mới, chỉ ở dòng `RESUBMITTED`: câu tả những gì người lập đã đổi so với lần gửi trước, ví dụ "Bỏ CTA000011 khỏi phiếu. Đổi giá thu về từ 2.000.000 đ sang 500.000 đ." Không đổi gì thì "Gửi lại, không đổi nội dung phiếu." Người không có quyền xem giá chỉ thấy "Đổi giá thu về." không kèm số. Phiếu tạo trước bản này thì `null` |
| `AssetDisposal.items[].depreciationStopDate: string` | Mới, `YYYY-MM-DD`: ngày dừng khấu hao sẽ dùng (hoặc đã dùng) khi duyệt. Thiết bị **Mất** giữ ngày ghi nhận mất, còn lại là `disposalDate`. Hộp xác nhận duyệt phải lấy ngày từ đây, không lấy `disposalDate` |
| `AssetDisposal.documents[]` | Thêm `number: string \| null`, `issuedDate: string \| null` (`YYYY-MM-DD`), `amount: number \| null` (null khi không có quyền xem giá) |
| `Asset.disposal: { id, method, methodLabel, disposalDate } \| null` | Mới: phiếu thanh lý **đã duyệt** của tài sản, để trang tài sản ghi "Đã thanh lý theo phiếu số {id}" có link. `null` khi chưa thanh lý |
| `AssetEvent` `DOCUMENT_ADDED` | `payload` thêm `disposalId` khi giấy tờ đính vào phiếu thanh lý (đã có sẵn `fileName`, `number`, `documentType`). Lịch sử thiết bị nên ghi "Thêm giấy tờ vào phiếu thanh lý số {disposalId}: {fileName}" |

**Hành vi đổi**

| Chỗ | Trước | Sau |
|---|---|---|
| `GET /v1/assets` có `search`, không chọn `status` | Ẩn tài sản Đã thanh lý, gõ đúng tên máy vẫn "không tìm thấy" | Có `search` thì **có cả** tài sản Đã thanh lý. Không gõ gì và không chọn `status` thì vẫn ẩn như cũ |
| `GET /v1/assets/:id/documents` | Không có giấy tờ đính vào phiếu thanh lý | Có giấy tờ của mọi phiếu thanh lý chứa tài sản này |
| Biên bản kiểm kê Excel | Bảng 15 cột, không định dạng in | In A4 ngang vừa một trang theo chiều ngang, lặp dòng tiêu đề cột, kẻ ô, xuống dòng trong ô. 10 cột: STT, Mã, Tên, Serial, Theo sổ sách (người giữ, phòng, vị trí gộp một ô), Kết quả, Thực tế ghi nhận, Người kiểm (kèm quét tem hay ghi tay), **Thời điểm kiểm**, Xử lý chênh lệch. Dòng tự thành Không tìm thấy ghi "Không ai kiểm, tự ghi khi đóng đợt". Dưới bảng có ngày và chỗ ký: Người lập biên bản, Kế toán trưởng, Giám đốc |
| Biên bản kiểm kê Excel, dòng số liệu | "Tổng n thiết bị: Đúng…, Chưa kiểm 0." | "Tổng n thiết bị, đã kiểm m. Kết quả: Đúng…"; "Chưa kiểm" chỉ có khi đợt còn mở; thêm câu "Có k thiết bị không ai kiểm nên tự ghi Không tìm thấy khi đóng đợt." khi k > 0 |
| Phiếu sửa tạo từ dòng kiểm kê | Mô tả có thể dính hai dấu chấm | Ghép câu bỏ dấu câu cuối của ghi chú người gõ. Dòng **Hỏng** thì tình trạng thiết bị chuyển Hỏng |
| `ASSET_STOCKTAKE_RESOLVE_INPUT` khi `IGNORED` không có ghi chú | "Bạn ghi lý do bỏ qua…" | "Bạn ghi lý do giữ nguyên sổ, để người xem biên bản hiểu vì sao chênh lệch này không cần sửa." |

**Quyền xem kiểm kê**: backend đã cho mọi người có `asset:read` phạm vi toàn công ty (ADMIN, HR, DIRECTOR, CHIEF, hoặc có `asset:manage`) đọc danh sách, chi tiết, dòng, Excel của đợt kiểm kê. Trưởng phòng (phạm vi phòng) vẫn 403. Web đang ẩn mục "Kiểm kê" với người không có `asset:manage`, nên lãnh đạo không thấy; web cần mở mục này ở chế độ chỉ xem cho các vai trò trên.
