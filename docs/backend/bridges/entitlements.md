# Bridge Docs — Quyền dùng module (`/v1/me/entitlements`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.

Mỗi công ty được người vận hành bật, tắt hoặc đặt hạn dùng cho từng module. **API là nơi chặn thật:**
FE ẩn menu chỉ để người dùng không bấm vào chỗ không dùng được, và ADMIN của công ty cũng không đi
vòng được. Thiết kế: `docs/control-plane.md`, mục "Quyền dùng module".

**Bốn mã quản lý được: `AI_AGENT` (từ 06/11/2026), `ASSET` và `RECRUIT` (từ 10/11/2026), `OFFICE` (lô 1 Hành chính
văn phòng).** Mọi mã khác luôn trả `ENABLED`, `reason: null`, `expiresAt: null`, nên route của chúng không còn trả
`MODULE_*`. `ASSET`, `RECRUIT` và `OFFICE` là module bán riêng: công ty chưa được cấp thì nhận `DISABLED`,
`NOT_SUBSCRIBED`. FE giữ nguyên cách xử lý theo `state`, không viết riêng cho từng mã.

---

## Endpoints

| Method | Path | Auth | Ghi chú |
|--------|------|------|---------|
| GET | `/v1/me/entitlements` | JWT | Trạng thái mọi module của công ty trong phiên hiện tại, kèm danh mục phân hệ cho lưới chọn phân hệ |

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
  | 'ANNOUNCEMENT'
  | 'ASSET'
  | 'RECRUIT'
  | 'OFFICE';
// Danh mục sẽ có thêm module. Gặp mã lạ thì bỏ qua, không lỗi.

export type ModuleState = 'ENABLED' | 'READ_ONLY' | 'DISABLED';

export type ModuleStateReason =
  | 'NOT_SUBSCRIBED'  // công ty chưa đăng ký module bán thêm
  | 'SUSPENDED'       // người vận hành tắt
  | 'READ_ONLY'       // người vận hành đặt chỉ xem
  | 'EXPIRED'         // quá hạn dùng, đang trong 14 ngày chỉ xem
  | 'LAPSED'          // quá hạn dùng trên 14 ngày, module tắt hẳn cho đến khi được gia hạn
  | null;             // dùng đầy đủ

export interface ModuleEntitlement {
  code: ModuleCode;
  label: string;              // tên tiếng Việt, hiển thị được ngay
  state: ModuleState;
  reason: ModuleStateReason;
  expiresAt: string | null;   // ISO 8601. Có thể có cả khi đang ENABLED: dùng để báo sắp hết hạn
  graceEndsAt: string | null; // ISO 8601. Qua thời điểm này thì module quá hạn tắt hẳn. null khi không có hạn
}

export interface AppGroup {
  code: string;   // 'HR' | 'TALENT' | 'OPERATIONS' | 'ANALYTICS' | 'SYSTEM', có thể thêm nhóm mới
  label: string;  // tên nhóm tiếng Việt, hiển thị được ngay
}

export interface AppTile {
  code: string;               // mã phân hệ, ổn định: 'chr' | 'tal' | 'pay' | 'rec' | 'ast' | 'apv' | 'adm' | 'eng' | 'ana' | 'sys'
  label: string;              // tên phân hệ
  description: string;        // một câu ngắn dưới tên
  group: string;              // mã nhóm trong `groups`
  color: string;              // màu nền ô icon, dạng '#rrggbb'
  icon: string;               // thuộc tính `d` của một <path>, xem mục "Danh mục phân hệ"
  module: ModuleCode | null;  // module bán riêng chứa mọi màn hình của phân hệ; null khi gộp nhiều module
  locked: boolean;            // công ty không dùng được `module` (state DISABLED)
  lockReason: ModuleStateReason; // cùng `reason` của module khi locked, null khi không khoá
}

export interface EntitlementsResponse {
  modules: ModuleEntitlement[];
  businessHotline: string | null; // hotline nhà cung cấp (env BUSINESS_HOTLINE của BE). null khi chưa cấu hình
  groups: AppGroup[];             // nhóm của lưới chọn phân hệ, đúng thứ tự hiện
  apps: AppTile[];                // ô của lưới, xếp theo nhóm rồi theo thứ tự trong nhóm
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
      { "code": "CORE", "label": "Lõi nhân sự", "state": "ENABLED", "reason": null, "expiresAt": null, "graceEndsAt": null },
      { "code": "OVERTIME", "label": "Làm thêm giờ", "state": "READ_ONLY", "reason": "EXPIRED", "expiresAt": "2026-10-31T16:59:59.999Z", "graceEndsAt": "2026-11-14T16:59:59.999Z" },
      { "code": "REPORTS", "label": "Báo cáo", "state": "DISABLED", "reason": "SUSPENDED", "expiresAt": null, "graceEndsAt": null },
      { "code": "RECRUIT", "label": "Tuyển dụng", "state": "DISABLED", "reason": "NOT_SUBSCRIBED", "expiresAt": null, "graceEndsAt": null }
    ],
    "businessHotline": "0888888888",
    "groups": [
      { "code": "HR", "label": "Quản trị nhân sự" },
      { "code": "TALENT", "label": "Thu hút & Phát triển" }
    ],
    "apps": [
      {
        "code": "chr",
        "label": "Hồ sơ & Hợp đồng",
        "description": "Vòng đời nhân viên: hồ sơ, phòng ban, chức vụ, hợp đồng lao động.",
        "group": "HR",
        "color": "#0ea5e9",
        "icon": "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
        "module": null,
        "locked": false,
        "lockReason": null
      },
      {
        "code": "rec",
        "label": "Tuyển dụng",
        "description": "Định biên, yêu cầu tuyển, tin tuyển dụng, kho ứng viên, phỏng vấn, offer.",
        "group": "TALENT",
        "color": "#f59e0b",
        "icon": "M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z",
        "module": "RECRUIT",
        "locked": true,
        "lockReason": "NOT_SUBSCRIBED"
      }
    ]
  }
}
```

Ví dụ trên rút gọn. Thực tế `groups` có đủ 5 nhóm và `apps` có đủ 10 ô, xem mục "Danh mục phân hệ".

`businessHotline` là hotline của nhà cung cấp phần mềm, lấy từ biến môi trường `BUSINESS_HOTLINE` của BE (bỏ khoảng
trắng hai đầu; trống thì `null`). Mọi người đã đăng nhập đều nhận cùng một giá trị. FE ghi số này trong hộp thoại
phân hệ chưa đăng ký cho ADMIN; `null` thì không ghi số. Đổi số chỉ cần sửa env rồi khởi động lại API.

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
| `READ_ONLY` | `EXPIRED` | GET được, ghi trả 403 `MODULE_EXPIRED` | Như trên, kèm dòng báo đã hết hạn và ngày cuối xem được (`graceEndsAt`) |
| `DISABLED` | `LAPSED` | Mọi route trả 403 `MODULE_LAPSED` | Phân hệ bán riêng hiện khoá trong lưới, bấm mở hộp thoại báo đã hết hạn; mục lẻ trong phân hệ khác thì ẩn; chặn màn hình |
| `DISABLED` | `SUSPENDED` | Mọi route trả 403 `MODULE_SUSPENDED` | Phân hệ bán riêng hiện khoá, hộp thoại báo tạm ngưng; mục lẻ thì ẩn; chặn màn hình |
| `DISABLED` | `NOT_SUBSCRIBED` | Mọi route trả 403 `MODULE_NOT_SUBSCRIBED` | Phân hệ bán riêng hiện khoá, hộp thoại báo chưa đăng ký; mục lẻ thì ẩn; chặn màn hình |

**Hộp thoại phân hệ khoá:** với cả ba lý do trên, vai trò hiệu lực `ADMIN` (`previewRole ?? user.role`) đọc câu
"liên hệ nhà cung cấp", kèm `businessHotline` khi có. Vai trò khác, kể cả ADMIN đang xem giao diện nhân viên, đọc câu
"liên hệ quản trị viên của công ty" và không thấy số.

Hạn dùng tính hết ngày giờ Việt Nam. Quá hạn thì chỉ xem thêm 14 ngày, từ ngày thứ 15 thì tắt. Đặt hạn mới
là dùng lại ngay, dữ liệu không mất ở giai đoạn nào. Đừng tự cộng 14 ngày ở FE, đọc `graceEndsAt`.

**Dòng báo cho admin:** chỉ vai trò hiệu lực `ADMIN` (`previewRole ?? user.role`) mới thấy, vì admin là người
liên hệ gia hạn. Hiện khi có module còn tối đa 14 ngày đến hạn, đang `EXPIRED` hoặc `LAPSED`. `message` của các
mã `MODULE_*` không bảo người đọc đi gia hạn vì nhân viên thường cũng đọc câu đó, lời nhắc gia hạn nằm ở dòng
báo và thông báo cho admin. Admin cũng nhận thông báo `MODULE_EXPIRY_WARNING`
(`targetUrl` rỗng, `NAVIGATE_ONLY`, không có màn hình gia hạn trong app) và email ở các mốc 30, 14, 7, 1 ngày,
ngày đầu chỉ xem và hôm trước ngày chỉ xem cuối.

**Gọi endpoint này lỗi thì đừng khoá người dùng:** coi mọi module đang dùng được, API vẫn chặn ở phía
sau. Đây cũng là cách chạy với BE bản cũ chưa có endpoint (404).

---

## Danh mục phân hệ (lưới chọn phân hệ)

Từ 17/11/2026, tên, mô tả, nhóm, màu, icon và thứ tự của các ô trong lưới chọn phân hệ do server trả trong `groups` và
`apps`. Client không viết cứng mấy thứ này nữa, nên đổi tên hay icon chỉ cần phát hành BE, web và mobile đổi theo.
Nguồn ở BE: `src/tenancy/app-catalog.ts`.

**Server giữ phần ô, client giữ phần "ô mở vào đâu".** Mỗi client tự giữ bảng `code` → màn hình của mình (web là
route và các mục menu con, mobile là màn hình Flutter), vì hai bên có bộ màn hình khác nhau. Luật ghép:

| Tình huống | Client làm gì |
|---|---|
| `code` có trong bảng màn hình của client | Hiện ô với `label`, `description`, `icon`, `color` của server |
| `code` lạ (server thêm phân hệ mà client chưa có màn hình) | Bỏ qua ô đó, không lỗi |
| Client có màn hình cho `code` mà server không trả | Không hiện ô |
| Người dùng không vào được màn hình nào của ô (theo vai trò, quyền của client) | Ẩn ô. Server trả cùng danh mục cho mọi vai trò |
| `locked: true` | Hiện ô mờ có ổ khoá, bấm vào mở hộp thoại theo `lockReason` (xem mục trên), không chuyển màn hình |
| Nhóm không còn ô nào sau khi lọc | Ẩn tên nhóm |

Thứ tự hiện: nhóm theo thứ tự trong `groups`, ô theo thứ tự trong `apps`. Trong một nhóm, ô dùng được đứng trước ô khoá.

**Vẽ icon:** `icon` là thuộc tính `d` của một thẻ `<path>` (bộ Heroicons outline). Vẽ trong khung `viewBox="0 0 24 24"`
bằng nét, không tô: `fill="none"`, `stroke="currentColor"`, `stroke-width="1.5"`, `stroke-linecap="round"`,
`stroke-linejoin="round"`. Trên ô, nét màu trắng đặt trên nền `color`. Mobile dựng chuỗi SVG rồi vẽ bằng `flutter_svg`:

```dart
final svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ffffff" '
    'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${app.icon}"/></svg>';
SvgPicture.string(svg, width: 20, height: 20);
```

Web gắn thẳng vào `<path :d="app.icon">`, không dùng `v-html`.

`locked` và `lockReason` suy ra từ `modules`: ô khoá khi module của nó `DISABLED`; chỉ xem (`READ_ONLY`) thì không khoá.
Client nào đã tự tính từ `modules` thì kết quả phải trùng.

**Không có `apps` (lỗi mạng, BE cũ chưa có trường này):** đừng khoá điều hướng. Web vẫn điều hướng bằng các mục menu con
của mình và báo lưới chọn phân hệ chưa tải được, kèm nút thử lại.

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
| 403 | `MODULE_LAPSED` | Như trên |
| 403 | `MODULE_READ_ONLY` | Hiện `message`, giữ nguyên dữ liệu người dùng đang nhập |
| 403 | `MODULE_EXPIRED` | Như trên |

---

## Route theo module

Hiện chỉ dòng `AI_AGENT`, `ASSET`, `RECRUIT` và `OFFICE` có tác dụng. Với `AI_AGENT`, khi chỉ xem các `GET` vẫn đọc được hội
thoại cũ; chat, xác nhận hay huỷ hành động, phản hồi, đổi tên và xoá hội thoại trả 403 `MODULE_EXPIRED`.
Với `ASSET`, xem [assets.md](./assets.md) mục 2. Với `RECRUIT`, xem [recruitment.md](./recruitment.md) mục
"Trạng thái module": trang công khai không đi qua JWT nên có luật riêng. Với `OFFICE`, xem [office.md](./office.md) mục 1:
khi chỉ xem vẫn bấm Đã nhận hàng và huỷ phòng họp được. Các dòng còn lại, cùng bảng ba route và mục "Số liệu ở
route không bị chặn" bên dưới, chỉ áp dụng nếu module đó được chuyển sang bán riêng.

| Mã | Route gắn cổng |
|---|---|
| `AI_AGENT` | `/v1/agent/*` |
| `REPORTS` | `/v1/reports/*` |
| `OVERTIME` | `/v1/overtime-requests/*`, `/v1/approval/overtime-requests/*`, `/v1/reports/overtime`, `/v1/reports/overtime/export` |
| `ONLINE_WORK` | `/v1/online-work-requests/*`, `/v1/approval/online-work-requests/*`, `/v1/reports/online-work`, `/v1/reports/online-work/export` |
| `BUSINESS_TRIP` | `/v1/business-trips/*`, `/v1/approval/business-trips/*` |
| `CONTRACT_INSURANCE` | `/v1/contracts/*`, `/v1/social-insurance/*` |
| `ANNOUNCEMENT` | `/v1/company-announcements/*` |
| `ASSET` | `/v1/assets/*`, `/v1/asset-categories/*`, `/v1/asset-vendors/*`, `/v1/asset-assignments/*`, `/v1/asset-maintenances/*`, `/v1/asset-documents/*`, `/v1/asset-reports/*`, `/v1/asset-imports/*`, `/v1/employees/:id/assets/*`, `/v1/me/assets/*`, `/v1/me/asset-services/*` |
| `RECRUIT` | `/v1/recruitment/*`, `/v1/me/recruitment/*`; trang công khai `/v1/public/careers/*`, `/v1/public/offer-responses/*` tự kiểm trạng thái của công ty trong đường dẫn hoặc token |
| `OFFICE` | `/v1/office/*`, `/v1/me/office/*` |

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
| Nhân viên thường gọi | Cùng `groups`, `apps` như ADMIN; client tự ẩn ô người đó không vào được |
| `RECRUIT` đang chỉ xem (`READ_ONLY`, `EXPIRED`) | Ô `rec` không khoá, vào xem được |
| Công ty khác cùng hệ thống bị tắt module | Không ảnh hưởng |
| Mã luôn bật (mọi mã trừ `AI_AGENT`, `ASSET`, `RECRUIT`, `OFFICE`) | Luôn `ENABLED`, không tắt được |
| Công ty chưa được cấp `ASSET` | `DISABLED`, `NOT_SUBSCRIBED`; mọi route tài sản 403 `MODULE_NOT_SUBSCRIBED` |
| Công ty chưa được cấp `OFFICE` | `DISABLED`, `NOT_SUBSCRIBED`; ô `adm` khoá, mọi route `/v1/office/*`, `/v1/me/office/*` 403 `MODULE_NOT_SUBSCRIBED` |
| Công ty chưa được cấp `RECRUIT` | `DISABLED`, `NOT_SUBSCRIBED`; mọi route tuyển dụng 403 `MODULE_NOT_SUBSCRIBED`, trang tuyển dụng công khai 404 `RECRUIT_CAREERS_CLOSED` |
| Có `expiresAt` trong tương lai | `ENABLED`, `reason: null`. FE có thể báo sắp hết hạn |
| Quá hạn đúng 14 ngày | Vẫn `READ_ONLY`, `EXPIRED` đến hết ngày đó |
| Quá hạn từ ngày thứ 15 | `DISABLED`, `LAPSED` |
| Chỉ xem do người vận hành đặt rồi quá hạn | Theo hạn dùng như trên |
| Đã tắt và có `expiresAt` | `DISABLED`, `SUSPENDED`: tắt tay thắng hạn dùng, kể cả đã quá hạn |
| Đặt hạn mới sau khi `LAPSED` | Trong vòng 30 giây về `ENABLED`, dữ liệu còn nguyên |
| Bật lại sau khi tắt | Dùng lại bình thường, dữ liệu còn nguyên |
| Người dùng đang mở màn hình lúc bị tắt | Request kế tiếp trả `MODULE_SUSPENDED` |
| Socket `/announcements` đang mở khi `ANNOUNCEMENT` bị tắt | Bị ngắt trong tối đa một phút sau khi API nhận trạng thái mới. Mở lại nhận sự kiện `error` mã `MODULE_SUSPENDED` |
| Socket `/announcements` đang mở khi phiên kết thúc (đăng xuất, đổi mật khẩu, vô hiệu tài khoản, gỡ khỏi công ty) | Bị ngắt trong tối đa một phút, sự kiện `error` mã `UNAUTHENTICATED` |
