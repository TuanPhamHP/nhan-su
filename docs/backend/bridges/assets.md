# Bridge Docs — Quản lý tài sản (`/v1/assets`, module `ASSET`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong
> `{ success, data }`, và [entitlements.md](./entitlements.md) cho cách xử lý trạng thái module.
> Thiết kế đầy đủ: `docs/modules/15-assets.md` (repo BE). Cập nhật 10/11/2026. Ví dụ JSON trong file lấy từ
> response thật của API.

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
| POST | `/v1/assets/:id/maintenances` | `asset:manage` | | Mở phiếu sửa |
| GET | `/v1/asset-maintenances` | `asset:read` + phạm vi | ✓ | Danh sách phiếu sửa có phân trang |
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
| GET | `/v1/asset-imports/template` | `asset:manage` | ✓ | File mẫu nhập Excel |
| POST | `/v1/asset-imports` | `asset:manage` | | Nhập Excel (`multipart/form-data`) |
| GET | `/v1/employees/:employeeId/assets` | `asset:read` + phạm vi | ✓ | Tab Tài sản trong hồ sơ nhân viên |
| POST | `/v1/employees/:employeeId/assets/return-all` | `asset:manage` | ✓ | Thu hồi tất cả khi cho nghỉ việc |

### Tự phục vụ (chỉ cần đăng nhập, mọi vai trò)

| Method | Path | Điều kiện gọi | RO | Ghi chú |
|--------|------|---------------|----|---------|
| GET | `/v1/me/assets` | Mọi user | ✓ | Tài sản và ghế mình đang giữ, đã giữ |
| POST | `/v1/me/assets/assignments/:id/confirm` | Người nhận hoặc người chịu trách nhiệm | ✓ | Xác nhận đã nhận, hoặc báo không đúng |
| GET | `/v1/me/assets/documents/:id/url` | Người nhận của lần bàn giao | ✓ | Mở biên bản, ảnh tình trạng |
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
  | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';                                   // dịch vụ
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
  | 'VALUE_CHANGED' | 'DOCUMENT_ADDED' | 'DOCUMENT_REMOVED' | 'LICENSE_KEY_CHANGED';

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
  canViewValue: boolean;
  createdAt: string; updatedAt: string;
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
  type: 'REPAIR'; typeLabel: string;   // bản đầu chỉ có sửa chữa
  status: AssetMaintenanceStatus; statusLabel: string;
  description: string; workDone: string | null;
  vendor: IdName | null; underWarranty: boolean;
  cost: number | null;                 // tiền
  sentAt: string | null; expectedDoneAt: string | null; doneAt: string | null;
  createdBy: IdName; createdAt: string;
}
export interface AssetDocument {
  id: number;
  type: AssetDocumentType; typeLabel: string;
  number: string | null; issuedDate: string | null;
  amount: number | null;               // tiền
  fileName: string; mimeType: string; sizeBytes: number;
  uploadedBy: IdName; uploadedAt: string;
  links: { id: number; assetId: number | null; assetCode: string | null;
           assignmentId: number | null; renewalId: number | null; maintenanceId: number | null }[];
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

**Dịch vụ**

| Đang | Làm gì | Thành |
|---|---|---|
| `ACTIVE` | Quá hạn gia hạn hơn 3 ngày, `autoRenew = false` (việc định kỳ 00:30) | `EXPIRED` |
| `ACTIVE`, `EXPIRED` | Ghi nhận gia hạn | `ACTIVE` |
| `ACTIVE`, `EXPIRED` không còn ghế | Huỷ | `CANCELLED` |

`DISPOSED` (thanh lý) đã có trong enum nhưng chưa có thao tác ở bản này. Dùng bảng trên để bật tắt nút: thiết bị
`IN_USE` thì hiện Điều chuyển và Thu hồi, ẩn Cấp phát.

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

`targetUrl` của từng thông báo và link trong email trỏ đúng trang ở cột "Trang mở" (email kèm `t=<mã công ty>`).
Người phụ trách dịch vụ thường có vai trò EMPLOYEE, không vào được trang quản lý: đó là lý do có `asset_service`.

| Mã | `type` | Người nhận | Email | Push |
|---|---|---|---|---|
| N-01 | `ASSET_ASSIGNED` | Người được giao, hoặc người chịu trách nhiệm khi giao phòng ban | – | ✓ |
| N-02 | `ASSET_RETURNED` | Người bị thu | – | ✓ |
| N-03 | `ASSET_RENEWAL_DUE` | Người phụ trách và người quản lý tài sản, mốc 30, 7, 1 ngày trước hạn | ✓ | ✓ |
| N-04 | `ASSET_RENEWAL_OVERDUE` / `ASSET_SERVICE_EXPIRED` | Như N-03, ngày quá hạn đầu tiên / khi chuyển Hết hạn | ✓ | ✓ |
| N-05 | `ASSET_WARRANTY_EXPIRING` | Người quản lý tài sản, 30 ngày trước hạn bảo hành | – | – |
| N-07 | `ASSET_REPAIR_DONE` | Người đang giữ | – | ✓ |
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
| `utils/notification-route.ts` | Bốn `case` ở mục "Thông báo" |
| Trang quản lý | `<CommonAppModuleNotice module="ASSET" />` |

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
