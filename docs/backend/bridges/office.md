# Bridge: Hành chính văn phòng (`OFFICE`), lô 1

Cho web `nhan-su` và mobile. Thiết kế: `docs/modules/17-office.md`. Phiếu yêu cầu: `docs/templates/office/hanh-chinh-van-phong.md`.
Lô 1 gồm **văn phòng phẩm theo kỳ** và **đặt phòng họp**. Mọi response bọc `{ success, data }` như các module khác.

---

## 1. Module và quyền

- Mã module `OFFICE`, **bán riêng** (`defaultEnabled: false`). Công ty chưa được cấp: mọi route 403 `MODULE_NOT_SUBSCRIBED`.
  FE thêm `OFFICE` vào `ModuleCode` và `MODULE_ROUTES` (`/office`, `/management/office`).
- **Ô trên lịch phân hệ:** server trả ô mã `adm` ("Hành chính văn phòng", nhóm `OPERATIONS`, `module: 'OFFICE'`) trong
  `GET /me/entitlements` (`docs/bridges/entitlements.md`). Web thêm `adm` vào `APP_MODULES` (home, routes, mục menu con)
  và bỏ `ADM` khỏi `PLANNED_MODULES`; mobile thêm `adm` vào bảng mã → màn hình. Công ty chưa được cấp thì ô khoá.
- **Chỉ xem** (`READ_ONLY`, gồm cả 14 ngày sau khi hết hạn): đọc và xuất Excel được; ghi bị chặn 403 `MODULE_READ_ONLY`
  hoặc `MODULE_EXPIRED`, **trừ** hai việc vẫn làm được:
  bấm Đã nhận (`POST /me/office/supply-requests/:id/receive`) và huỷ phòng (`POST /office/room-bookings/:id/cancel`).
- Mỗi công ty dùng module độc lập: STH và OngO tự tạo văn phòng, phòng họp, danh mục của mình (không có gì xuyên công ty).

| Permission | Ai có mặc định | Mở được gì trên web |
|---|---|---|
| `office:manage` | HR, ADMIN | `/management/office/settings` (văn phòng, văn phòng phẩm, định mức, phòng họp) |
| `office:supply:manage` | HR, ADMIN | Mở kỳ, chốt, cấp, phiếu bổ sung, dự trù, đơn giá, ghi đã giao |
| `office:supply:report` | HR, DIRECTOR, MANAGER, CHIEF, ADMIN | `/management/office/supply-periods`, `/management/office/reports`. **MANAGER chỉ thấy phòng mình quản lý** (server lọc) |
| `office:booking:manage` | HR, ADMIN | Dời, đổi phòng, huỷ lượt đặt phòng của người khác; **không** thấy nội dung lượt riêng tư (Q3, mục 5) |

Không cần permission (mọi nhân viên của công ty có module): `/office/supplies` (phiếu của phòng mình) và `/office/rooms`
(đặt phòng). Route quản lý trả 403 cho vai trò EMPLOYEE như module Tài sản.

**Đơn giá là thông tin mua hàng:** `unitPrice` ở `/office/supply-items`, `/me/office/supply-items` và trong phiếu là `null`
với người không có `office:supply:report`, `office:supply:manage` hay `office:manage`. Đừng hiện cột giá khi `null`.

---

## 2. Danh mục (đọc cho mọi nhân viên)

| Method | Path | Ghi chú |
|---|---|---|
| GET | `/v1/office/sites` | Văn phòng đang hoạt động. `?includeInactive=true` chỉ có tác dụng với `office:manage` |
| GET | `/v1/office/rooms?siteId=` | Phòng họp đang dùng |
| GET | `/v1/office/supply-groups` | Nhóm văn phòng phẩm |
| GET | `/v1/office/supply-items?groupId=` | Mặt hàng (trang cài đặt). Ô chọn của phiếu dùng `/me/office/supply-items` |

```json
// OfficeSiteResponseDto
{ "id": 1, "name": "Văn phòng Hữu Nghị", "address": "Hà Nội", "isActive": true }
// MeetingRoomResponseDto
{ "id": 3, "officeSiteId": 1, "officeSiteName": "Văn phòng Hữu Nghị", "name": "Phòng họp tầng 3", "capacity": 12,
  "equipment": ["Máy chiếu"], "note": null, "sortOrder": 0, "isActive": true }
// SupplyItemResponseDto
{ "id": 12, "groupId": 1, "groupName": "Bút (Note màu) & các loại gim", "hrOnly": false, "name": "Bút bi (Note màu xanh)",
  "unit": "Chiếc", "unitPrice": 5000, "sortOrder": 1, "isActive": true }
```

---

## 3. Cài đặt (UI-09, `/management/office/settings`)

| Method | Path | Quyền | Body |
|---|---|---|---|
| POST, PATCH | `/v1/office/sites`, `/v1/office/sites/:id` | `office:manage` | `{ name, address? }`, PATCH thêm `isActive` |
| POST, PATCH | `/v1/office/supply-groups`, `/:id` | `office:manage` | `{ name, hrOnly?, sortOrder? }`, PATCH thêm `isActive` |
| POST, PATCH | `/v1/office/supply-items`, `/:id` | `office:manage` | `{ groupId, name, unit, unitPrice?, sortOrder? }`, PATCH thêm `isActive` |
| GET | `/v1/office/supply-items/import-template` | `office:manage` | Tải `mau-van-phong-pham.xlsx` |
| POST | `/v1/office/supply-items/import` | `office:manage` | `multipart/form-data`, field `file` (.xlsx, 10 MB) |
| GET | `/v1/office/supply-quotas?departmentId=` | `office:supply:report` (trưởng phòng chỉ phòng mình) | |
| PUT | `/v1/office/supply-quotas` | `office:manage` | `{ departmentId, quotas: [{ itemId, monthlyQty }] }`, thay toàn bộ định mức của phòng |
| POST, PATCH | `/v1/office/rooms`, `/:id` | `office:manage` | `{ officeSiteId, name, capacity?, equipment?: string[], note?, sortOrder? }`, PATCH thêm `isActive` |

**Nhập danh mục:** nhận cả file mẫu và **chính file đăng ký hằng tháng HCNS đang dùng** (dòng số La Mã I, II… là nhóm;
nhóm ghi "(HCNS đặt)" thành nhóm chỉ HCNS đặt; nhóm "ngoài danh sách" bỏ qua). Mặt hàng trùng tên đã có trên hệ thống thì
bỏ qua (chỉ điền đơn giá nếu đang trống); trùng tên ngay trong file thì dòng đầu thắng, dòng sau vào `errors`.

Đơn giá hiểu được: `65000`, `65.000`, `65,000`, `65.000đ`, `65.000 VNĐ`, `65k`, `65 nghìn`, `1tr2`, `1,2tr`, `1.5 triệu`, ô số.
Tiền VND không có phần lẻ: `1500.5`, `5.000,50`, chữ không hiểu được thì **vẫn tạo mặt hàng, để trống giá** và thêm một
cảnh báo vào `errors`. Ô quá dài (tên 200, đơn vị 30, nhóm 100 ký tự) thì bỏ dòng, ghi lỗi. `errors` gồm cả lỗi và cảnh
báo, mọi câu có số dòng, xếp theo dòng: FE hiện nguyên danh sách. Response:

```json
{ "createdGroups": ["Đồ uống"], "createdItems": 59, "updatedPrices": 0, "existingItems": 0, "skipped": 5,
  "errors": [{ "row": 12, "message": "Dòng \"Bút chì\": chưa có đơn vị tính." }] }
```

---

## 4. Văn phòng phẩm

### 4.1 Luồng

1. HCNS mở kỳ cho **một văn phòng**, chọn hạn chót và các phòng tham gia (mặc định như kỳ trước). Mỗi phòng có sẵn một
   phiếu rỗng. Cả phòng nhận thông báo N-01. Quên phòng thì **thêm phòng** vào kỳ còn mở; mở nhầm mà chưa ai nhập thì
   **huỷ kỳ** (kỳ bị xoá, mở lại được cùng tháng). Đổi hạn chót (gia hạn hoặc rút ngắn) thì người đã nhận N-01 được báo.
2. **Mọi nhân viên trong phòng** thêm, sửa, xoá dòng tới hạn chót. **Không có nút nộp**: tới `period.lockAt` phiếu tự
   khoá. HCNS khoá sớm thì trưởng phòng, đầu mối được báo và `lockAt` thành giờ khoá thật.
3. HCNS mở bảng tổng hợp, nhập dự trù và đơn giá thực, chốt từng phiếu (sửa số phải ghi lý do), cấp hàng.
4. Trưởng phòng hoặc đầu mối bấm **Đã nhận** (sửa được số thực nhận, ghi chú thiếu). Quá 3 ngày làm việc chưa bấm thì
   HCNS ghi "đã giao" thay.
5. Sau hạn, phòng còn thiếu thì **HR tạo phiếu bổ sung** kèm ghi chú.
6. **Tới khi đóng kỳ, HCNS sửa được** số đã chốt (gọi lại `finalize` với phiếu đã chốt, đã cấp, đã nhận) và số thực nhận
   (`correct-received`), đều phải ghi lý do; trưởng phòng, đầu mối được báo. Kỳ đã đóng thì khoá hẳn.

Phiếu không có dòng nào nghĩa là phòng không xin (BR-10): không cần chốt, cấp, nhận; không chặn đóng kỳ; sau khi khoá
có nhãn **"Không đăng ký"**.

Trạng thái phiếu (`status` · `statusLabel`): `OPEN` Đang đăng ký → `LOCKED` Chờ HCNS chốt → `FINALIZED` Đã chốt, chờ cấp →
`ISSUED` Đã cấp, chờ nhận → `RECEIVED` Đã nhận. Kỳ: `OPEN` Đang nhận đăng ký → `LOCKED` Đã khoá → `CLOSED` Đã đóng.

Từ lúc khoá, tên, đơn vị, nhóm và đơn giá của mặt hàng trong kỳ là **bản chụp lúc khoá**: HCNS đổi danh mục sau đó không
làm đổi phiếu, bảng tổng hợp, báo cáo của kỳ cũ.

### 4.2 Phiếu của phòng tôi (UI-01, web và mobile)

| Method | Path | Ghi chú |
|---|---|---|
| GET | `/v1/me/office/supply-requests` | Danh sách phiếu của phòng tôi, phiếu `OPEN` lên đầu (`SupplyRequestListItemDto[]`) |
| GET | `/v1/me/office/supply-requests/:id` | Chi tiết (`SupplyRequestResponseDto`) |
| POST | `/v1/me/office/supply-requests/:id/lines` | `{ itemId, requestedQty, overQuotaReason?, note? }` hoặc `{ customName, customUnit, requestedQty, note? }` |
| PATCH | `/v1/me/office/supply-requests/:id/lines/:lineId` | `{ requestedQty?, overQuotaReason?, note?, customName?, customUnit? }` |
| DELETE | `/v1/me/office/supply-requests/:id/lines/:lineId` | Xoá dòng (chỉ khi kỳ còn mở) |
| POST | `/v1/me/office/supply-requests/:id/copy-previous` | "Lấy số tháng trước": `{ previousTitle, added, existing, skipped, skippedItems: [{ name, reason }], request }`. Chép cả dòng ngoài danh mục; không chép lý do vượt định mức (dòng vượt bị bỏ qua, nêu lý do). `existing` (UAT đợt C): mặt hàng phiếu đã có, không tính vào `skipped`. `previousTitle` null = chưa có kỳ trước. FE hiện toast: "Đã thêm {added} dòng từ {previousTitle}" + danh sách `skippedItems`; `added = 0` và `skipped = 0` thì "Phiếu đã có đủ các mặt hàng của {tháng}, không có gì để thêm." |
| POST | `/v1/me/office/supply-requests/:id/receive` | Trưởng phòng, đầu mối: `{ lines: [{ lineId, receivedQty, receivedNote? }] }`; dòng không gửi coi như nhận đủ số đã chốt |
| GET | `/v1/me/office/supply-items` | Mặt hàng cho ô chọn: đang dùng, **bỏ nhóm chỉ HCNS đặt**, kèm `quota` (định mức tháng của phòng tôi, null = không giới hạn) để hiện cạnh ô số trước khi gõ |
| GET, PUT | `/v1/me/office/supply-contact` | Đầu mối của phòng; PUT `{ employeeId \| null }` chỉ trưởng phòng |

Mọi lệnh ghi dòng trả lại toàn bộ phiếu đã cập nhật, FE thay luôn state.

```json
// SupplyRequestResponseDto (rút gọn)
{
  "id": 55,
  "period": { "id": 7, "officeSite": { "id": 1, "name": "Văn phòng Hữu Nghị" }, "month": "2026-12", "title": "Tháng 12/2026",
              "deadline": "2026-11-28", "lockAt": "2026-11-28T17:00:00.000Z", "status": "OPEN", "statusLabel": "Đang nhận đăng ký",
              "createdBy": null, "lockedAt": null, "closedAt": null },
  "department": { "id": 4, "name": "Tài chính - Kế toán" },
  "sequence": 0, "isSupplement": false, "note": null,
  "status": "OPEN", "statusLabel": "Đang nhập",
  "canEdit": true, "canReceive": false, "proxyAllowedAt": null, "totalAmount": null,
  "lines": [
    { "id": 101, "itemId": 12, "isCustom": false, "name": "Bút bi (Note màu xanh)", "unit": "Chiếc",
      "groupName": "Bút (Note màu) & các loại gim", "requestedQty": 12, "quota": null, "overQuota": false,
      "overQuotaReason": null, "note": "Bút gel", "finalQty": null, "finalNote": null, "receivedQty": null,
      "receivedNote": null, "unitPrice": null, "amount": null, "previousQty": 10,
      "createdBy": { "id": 20, "fullName": "Nguyễn Văn A" }, "updatedBy": { "id": 21, "fullName": "Trần Thị B" },
      "updatedAt": "2026-11-20T03:00:00.000Z" }
  ]
}
```

- **Dùng cờ của server, đừng tự tính:** `canEdit` (thêm, sửa, xoá dòng), `canReceive` (nút Đã nhận). `lockAt` để hiện
  đếm ngược "Còn 2 ngày 5 giờ".
- `quota` và `overQuota`: hiện định mức cạnh ô số; số vượt định mức thì bắt nhập `overQuotaReason` trước khi gửi. Định
  mức là của phòng trong một tháng: server cộng cả số phòng đã xin ở văn phòng khác cùng tháng, nên `overQuota=false`
  mà server vẫn có thể trả `OFFICE_SUPPLY_OVER_QUOTA_REASON_REQUIRED` (câu nêu số đã xin): mở ô lý do. Giảm số về dưới
  định mức thì server tự bỏ lý do cũ.
- Dòng ngoài danh mục: tên trùng mặt hàng có trong danh mục bị từ chối (`OFFICE_SUPPLY_LINE_IN_CATALOG`, câu nêu tên đúng
  để FE gợi ý chọn trong danh sách); trùng tên và đơn vị với dòng khác của phiếu là `OFFICE_SUPPLY_LINE_EXISTS`. Cả hai
  so tên không phân biệt hoa thường, dấu tiếng Việt, dấu câu, ngoặc: "but bi note mau xanh" trùng "Bút bi (Note màu xanh)".
  Ô tìm mặt hàng phía FE cũng nên tìm không dấu ("but chi" ra "Bút chì gỗ").
- Chặn bấm đúp nút thêm, xoá: hai lần gửi liền nhau, lần sau nhận 409 hoặc 404 (không còn 500).
- Số lượng nguyên 1 đến 100.000 (dự trù, nhận, chốt từ 0); đơn giá số nguyên VND 0 đến 1.000.000.000. Gửi số là số JSON,
  chuỗi như `"320.000"` bị từ chối.
- `previousQty`: gợi ý số kỳ trước. `updatedBy`: "sửa cuối bởi …" vì cả phòng cùng sửa. `updatedAt` của dòng là lúc phòng
  thêm, sửa dòng lần cuối: HCNS chốt, cấp hay phòng bấm nhận không đổi giờ này (UAT đợt B).
- `unitPrice`, `amount`, `totalAmount` là `null` với người không có `office:supply:report` (nhân viên thường).

### 4.3 Quản lý kỳ (UI-02, `/management/office/supply-periods`)

| Method | Path | Quyền | Ghi chú |
|---|---|---|---|
| GET | `/v1/office/supply-periods?siteId=&status=` | `office:supply:report` | `SupplyPeriodResponseDto[]`, có `departmentsTotal`, `departmentsWithLines`, `departmentIds` (phòng tham gia: lấy của kỳ gần nhất cùng văn phòng làm mặc định khi mở kỳ mới) |
| POST | `/v1/office/supply-periods` | `office:supply:manage` | `{ officeSiteId, month: "2026-12", deadline: "2026-11-28", title?, departmentIds: [..] }` |
| GET | `/v1/office/supply-periods/:id` | `office:supply:report` | Bảng tổng hợp (`SupplyPeriodSummaryDto`) |
| GET | `/v1/office/supply-periods/:id/export` | `office:supply:report` | Excel cột phòng ban như file hiện tại |
| PATCH | `/v1/office/supply-periods/:id` | `office:supply:manage` | `{ title?, deadline? }`; đổi hạn chót (cả rút ngắn) khi kỳ còn mở, người đã nhận N-01 được báo hạn mới. Kỳ đã đóng không sửa được gì |
| POST | `/v1/office/supply-periods/:id/departments` | `office:supply:manage` | `{ departmentIds }` thêm phòng vào kỳ còn mở; phòng đã có thì bỏ qua; trả `SupplyPeriodResponseDto` |
| POST | `/v1/office/supply-periods/:id/cancel` | `office:supply:manage` | Huỷ kỳ mở nhầm khi chưa phiếu nào có dòng: `{ id, cancelled: true }`, kỳ biến mất khỏi danh sách |
| POST | `/v1/office/supply-periods/:id/lock` | `office:supply:manage` | Khoá sớm; báo trưởng phòng, đầu mối |
| POST | `/v1/office/supply-periods/:id/close` | `office:supply:manage` | Đóng khi mọi phiếu **có dòng** đã nhận (phiếu rỗng không chặn) |
| PUT | `/v1/office/supply-periods/:id/items` | `office:supply:manage` | `{ items: [{ itemId, reserveQty?, unitPrice? }] }`, trả bảng tổng hợp mới |
| POST | `/v1/office/supply-periods/:id/supplements` | `office:supply:manage` | `{ departmentId, note, lines: [...] }`, chỉ khi kỳ đã khoá |
| GET | `/v1/office/supply-requests/:id` | `office:supply:report` | Chi tiết phiếu (trưởng phòng chỉ phòng mình) |
| POST | `/v1/office/supply-requests/:id/finalize` | `office:supply:manage` | `{ lines: [{ lineId, finalQty, finalNote?, customUnitPrice? }] }`; dòng không gửi giữ số đang có (chưa chốt thì số xin). **Gọi lại được** với phiếu đã chốt, đã cấp, đã nhận tới khi đóng kỳ: đổi số so với số đã chốt phải có `finalNote`; số chốt không được nhỏ hơn số đã nhận; trạng thái phiếu giữ nguyên. Mỗi `lineId` gửi một lần |
| POST | `/v1/office/supply-requests/:id/correct-received` | `office:supply:manage` | `{ lines: [{ lineId, receivedQty, receivedNote? }], reason }` sửa số thực nhận của phiếu đã nhận khi kỳ chưa đóng; báo trưởng phòng, đầu mối |
| POST | `/v1/office/supply-requests/:id/issue` | `office:supply:manage` | Cấp hàng |
| POST | `/v1/office/supply-requests/:id/mark-delivered` | `office:supply:manage` | `{ receiverName }`, chỉ sau `proxyAllowedAt` |

```json
// SupplyPeriodSummaryDto (rút gọn)
{
  "period": { "id": 7, "title": "Tháng 12/2026", "status": "LOCKED", "...": "..." },
  "scope": "ALL",
  "departments": [
    { "departmentId": 4, "name": "Tài chính - Kế toán",
      "requests": [{ "id": 55, "sequence": 0, "status": "LOCKED", "statusLabel": "Chờ HCNS chốt", "lineCount": 3 }] }
  ],
  "rows": [
    { "itemId": 30, "name": "Giấy in A4 IK Plus", "unit": "Tập", "groupName": "Sổ & Giấy & Các file lưu trữ tài liệu",
      "cells": [{ "departmentId": 4, "qty": 8 }], "totalQty": 8, "reserveQty": 5, "purchaseQty": 13,
      "unitPrice": 65000, "amount": 845000 },
    { "itemId": null, "name": "Pin 3A", "unit": "Đôi", "groupName": null, "cells": [{ "departmentId": 4, "qty": 3 }],
      "totalQty": 3, "reserveQty": 0, "purchaseQty": 3, "unitPrice": null, "amount": null }
  ],
  "totalAmount": 845000
}
```

`cells.qty` là số đã chốt, chưa chốt thì số xin. Dòng `itemId: null` là mặt hàng ngoài danh mục: đơn giá nhập ở bước chốt
(`customUnitPrice`), không ở ô dự trù; cùng tên mà khác đơn giá là hai dòng. Trưởng phòng mở bảng tổng hợp chỉ thấy cột
phòng mình, không có dự trù.

**`rows[].overQuota` (UAT đợt B):** có phòng xin vượt định mức; lý do nằm trong `notes` ("Tài chính - Kế toán: xin 6, vượt
định mức (In chứng từ quyết toán)"). Tô dòng để người duyệt thấy; Excel đã tô vàng nhạt.

**Nhãn kỳ đã khoá theo tiến độ (UAT đợt B):** kỳ `LOCKED` có `statusLabel` theo phiếu có dòng chậm nhất: "Đã khoá, chờ HCNS
chốt", "Đã chốt, chờ cấp", "Đã cấp, chờ các phòng nhận", "Các phòng đã nhận, chờ đóng kỳ"; không phiếu nào có dòng thì
"Đã khoá". `status` không đổi, vẫn `LOCKED`: nút theo `status`, chữ theo `statusLabel`.

**`scope` (UAT đợt B):** `ALL` là HCNS, ban giám đốc: hiện cột Dự trù, Cần mua như trên. `DEPARTMENT` là trưởng phòng:
`reserveQty` là `null`, `purchaseQty` chỉ là số của phòng mình. Khi đó **ẩn cột Dự trù** và gọi cột số là "Tổng" (không
"Cần mua"), vì số HCNS cần mua cho cả văn phòng không liên quan tới trưởng phòng. File Excel phạm vi phòng cũng không có cột
Dự trù.

Thêm từ đợt sửa sau UAT: `rows[].notes: string[]` (ghi chú dòng, lý do chốt khác số xin, nhận thiếu, ghi chú phiếu bổ
sung; mỗi phần tử bắt đầu bằng tên phòng) cho cột Ghi chú; `unpricedRows` (số dòng cần mua chưa có giá, chưa tính vào
`totalAmount`: hiện cảnh báo); `departments[].requests[].note` (ghi chú phiếu bổ sung). `rows` xếp theo thứ tự danh mục
như file HCNS. `period.departmentsTotal` đếm phòng (không đếm phiếu bổ sung), `departmentsWithLines` đếm phòng có dòng.

### 4.4 Báo cáo chi phí (UI-10, `/management/office/reports`)

| Method | Path | Quyền |
|---|---|---|
| GET | `/v1/office/reports/supply-costs?monthFrom=2026-12&monthTo=&departmentId=&groupId=` | `office:supply:report` |
| GET | `/v1/office/reports/supply-costs/export?…` | như trên |

```json
{ "rows": [{ "month": "2026-12", "departmentId": 4, "departmentName": "Tài chính - Kế toán",
             "officeSiteName": "Văn phòng Hữu Nghị", "lineCount": 3, "amount": 605000, "unpricedLines": 0 }],
  "totalAmount": 605000, "scope": "DEPARTMENT", "departmentId": 4 }
```

`scope: "DEPARTMENT"` (trưởng phòng): server luôn lọc về phòng `departmentId` dù query gửi gì, nên **khoá ô Phòng ban** ở
phòng đó (hoặc ẩn), đừng cho chọn phòng khác rồi nhận 403. `scope: "ALL"`: `departmentId` là phòng đang lọc, `null` là mọi
phòng. Tên trang và Excel thống nhất: "Chi phí văn phòng phẩm", cột "Số mặt hàng", "Mặt hàng chưa có đơn giá".

Chi phí = số thực nhận (chưa nhận thì số chốt) × đơn giá thực của kỳ. `unpricedLines` là số dòng chưa có đơn giá, chưa
tính vào `amount`: hiện cảnh báo nhỏ.

---

## 5. Đặt phòng họp (UI-04, web và mobile)

| Method | Path | Ai | Ghi chú |
|---|---|---|---|
| GET | `/v1/office/room-bookings?siteId=1&date=2026-11-20` | Mọi nhân viên | Lịch một ngày (`RoomGridResponseDto`) |
| GET | `/v1/office/room-bookings/:id` | Mọi nhân viên | |
| POST | `/v1/office/room-bookings` | Mọi nhân viên | `{ roomId, startAt, endAt, title, note?, isPrivate?, organizerId?, attendeeIds?: number[] }`. Giờ ISO **có múi giờ** (`Z` hoặc `+07:00`), server làm tròn xuống phút |
| PATCH | `/v1/office/room-bookings/:id` | Người tạo, chủ trì, `office:booking:manage` | Dời giờ, đổi phòng, sửa tiêu đề, ghi chú (`""` hoặc null là xoá), người dự (thay toàn bộ), `organizerId` (đổi chủ trì). Lượt đang diễn ra: đổi `endAt` được (kéo dài, kết thúc sớm), giữ nguyên `startAt`. Lượt đã kết thúc: 409 PAST |
| POST | `/v1/office/room-bookings/:id/cancel` | như trên | `{ reason? }`, huỷ lượt người khác thì `reason` bắt buộc; lượt đã kết thúc: 409 PAST; đang diễn ra vẫn huỷ được |
| GET | `/v1/me/office/room-bookings?from=2026-11-20&to=2026-11-27` | Mọi nhân viên | Lượt tôi tạo, chủ trì, được mời (tối đa 3 tháng) |

```json
// RoomGridResponseDto (rút gọn)
{
  "date": "2026-11-20",
  "site": { "id": 1, "name": "Văn phòng Hữu Nghị", "address": null, "isActive": true },
  "rooms": [{
    "room": { "id": 3, "name": "Phòng họp tầng 3", "capacity": 12, "equipment": ["Máy chiếu"], "...": "..." },
    "now": { "busy": false, "until": "2026-11-20T07:00:00.000Z" },
    "bookings": [{
      "id": 40, "room": { "id": 3, "name": "Phòng họp tầng 3" }, "officeSite": { "id": 1, "name": "Văn phòng Hữu Nghị" },
      "startAt": "2026-11-20T07:00:00.000Z", "endAt": "2026-11-20T08:00:00.000Z",
      "status": "CONFIRMED", "timing": "UPCOMING", "statusLabel": "Đã đặt", "isPrivate": false, "detailsVisible": true,
      "title": "Họp giao ban", "note": null, "organizer": { "id": 20, "fullName": "Nguyễn Văn A", "isActive": true },
      "createdBy": { "id": 20, "fullName": "Nguyễn Văn A" }, "attendees": [{ "id": 25, "fullName": "Lê C", "isActive": true }],
      "canEdit": true, "cancelledAt": null, "cancelledBy": null, "cancelReason": null
    }]
  }]
}
```

- `now` chỉ có khi `date` là hôm nay: `busy=false` thì hiện "Trống đến {until}" (`until: null` = trống tới hết ngày);
  `busy=true` thì "Đang họp tới {until}" (các lượt nối liền nhau đã được gộp).
- Người trong lượt có `isActive`: `false` là đã nghỉ việc, hiện "(đã nghỉ việc)". Gửi PATCH với danh sách người dự đang có thì
  server tự bỏ người đã nghỉ; chỉ người **mới thêm** mà đã nghỉ mới bị chặn (`PERSON_INVALID`, câu nêu tên và vai).
- `cancelledBy: null` ở lượt đã huỷ nghĩa là hệ thống tự huỷ (người chủ trì nghỉ việc). `canEdit=false` khi lượt đã kết
  thúc.
- `canCancel` (UAT đợt B): huỷ được không. `canEdit` (sửa, dời giờ, đổi phòng) nay còn tính trạng thái module: module chỉ
  xem (hết hạn, đang ân hạn) thì `canEdit=false` nhưng `canCancel` vẫn có thể `true` (trả phòng vẫn được, mục 19). Nút Huỷ
  theo `canCancel`, nút Sửa theo `canEdit`. Nút "Đặt phòng" và ô trống trên lịch không có cờ riêng: ẩn khi
  `/me/entitlements` cho OFFICE `state: 'READ_ONLY'`.
- `timing` (UAT đợt B): `UPCOMING` sắp tới, `ONGOING` đang họp, `ENDED` đã kết thúc, tính theo giờ máy chủ lúc trả. Lượt
  chưa huỷ có `statusLabel` theo `timing`: "Đã đặt", "Đang họp", "Đã kết thúc"; lượt huỷ là "Đã huỷ". "Lịch của tôi" làm
  mờ lượt `ENDED` và xếp sau lượt sắp tới.
- Trùng giờ (`OFFICE_ROOM_BOOKING_CONFLICT`): câu "…rồi, không cần đặt lại." chỉ còn khi đặt mới **đúng** khung giờ của lượt
  đã có (bấm Đặt hai lần). Trùng một phần là cuộc họp khác: "Phòng này đã có lượt của bạn lúc … Bạn chọn giờ hoặc phòng
  khác." **Giữ hộp đặt, sửa mở** cùng dữ liệu đã gõ, hiện câu ở ô giờ.
- **Lượt riêng tư (Q3): chỉ người tạo, chủ trì, người dự thấy nội dung.** Nhật ký hệ thống (`/system-logs`, HR và ADMIN
  đọc được) cũng không ghi tiêu đề, người dự, lý do huỷ của lượt riêng tư, chỉ ghi số người dự và có đổi hay không. Người
  khác, **kể cả HCNS** có `office:booking:manage`, nhận `detailsVisible=false`, `title`, `note`, `cancelReason` là `null`,
  `attendees` rỗng; vẫn thấy người đặt và khung giờ bận. HCNS vẫn dời giờ, đổi phòng, huỷ (có lý do) được. Body có `title`,
  `note` hay `attendeeIds` là 403, **dù giá trị giống hệt giá trị đang lưu** (để không đoán được nội dung qua mã trả về);
  `isPrivate`, `organizerId` khác giá trị hiện tại cũng 403. Form sửa của người không thấy nội dung chỉ gửi `roomId`,
  `startAt`, `endAt`.
- Không có bước duyệt. Trùng giờ trả 409 `OFFICE_ROOM_BOOKING_CONFLICT` với câu nêu giờ, người đặt và người chủ trì (bấm đúp
  thì "Bạn đã đặt phòng này…"): hiện toast rồi tải lại lịch. Server chặn cả khi hai người bấm cùng lúc.
- Giới hạn (L9): mỗi lượt ≤ 12 giờ, đặt trước tới hết ngày thứ 180 (giờ Việt Nam), không đặt giờ đã qua (trễ ≤ 5 phút vẫn
  được).
- Thông báo khi sửa: người dự mới nhận lời mời; người bị bớt nhận "không còn trong danh sách" (lượt riêng tư không nêu
  tiêu đề); chủ trì cũ, chủ trì mới nhận câu riêng; người còn lại và người đặt hộ nhận báo dời nêu cũ và mới. Chỉ sửa
  tiêu đề, ghi chú thì không báo ai.

---

## 6. Mã lỗi

| Mã | HTTP | Khi nào | FE làm gì |
|---|---|---|---|
| `OFFICE_SUPPLY_PERIOD_LOCKED` | 409 | Sửa phiếu sau hạn chót hoặc sau khi HCNS khoá sớm ("Kỳ đăng ký đã khoá…") | Toast câu của server, tải lại phiếu (lúc này `canEdit=false`) |
| `OFFICE_SUPPLY_LINE_IN_CATALOG` | 400 | Dòng ngoài danh mục trùng tên mặt hàng có trong danh mục | Toast câu của server (nêu tên đúng), mở ô chọn mặt hàng |
| `OFFICE_SUPPLY_LINE_DUPLICATE` | 400 | Một `lineId` gửi hai lần trong chốt, nhận, sửa số nhận | Lỗi của FE: mỗi dòng gửi một lần |
| `OFFICE_SUPPLY_FINAL_BELOW_RECEIVED` | 400 | Chốt lại nhỏ hơn số phòng đã nhận | Toast; sửa số thực nhận trước |
| `OFFICE_ROOM_HAS_BOOKINGS` | 409 | Ngừng phòng họp hoặc văn phòng còn lượt đặt sắp tới (câu nêu số lượt) | Toast câu của server |
| `OFFICE_SUPPLY_NOT_YOUR_DEPARTMENT` | 403 | Mở phiếu phòng khác | Về danh sách |
| `OFFICE_SUPPLY_HR_ONLY_ITEM` | 403 | Thêm mặt hàng nhóm chỉ HCNS đặt | Ô chọn đã lọc sẵn, lỗi chỉ xảy ra khi dữ liệu cũ |
| `OFFICE_SUPPLY_OVER_QUOTA_REASON_REQUIRED` | 400 | Vượt định mức mà thiếu lý do | Mở ô lý do ở dòng đó |
| `OFFICE_SUPPLY_LINE_EXISTS` | 409 | Thêm mặt hàng đã có trong phiếu | Cuộn tới dòng đang có |
| `OFFICE_SUPPLY_LINE_INVALID` | 400 | Dòng ngoài danh mục thiếu tên hay đơn vị | Lỗi ở form |
| `OFFICE_SUPPLY_NOT_RECEIVER` | 403 | Không phải trưởng phòng, đầu mối bấm nhận | Ẩn nút theo `canReceive` |
| `OFFICE_SUPPLY_RECEIVED_TOO_MANY` | 400 | Số nhận lớn hơn số chốt | Lỗi ở ô |
| `OFFICE_SUPPLY_NOTHING_CHANGED` | 400 | "Sửa số thực nhận" mà không dòng nào đổi số hay ghi chú (UAT đợt B) | Toast câu của server; chỉ dòng đổi mới được đếm vào thông báo cho phòng |
| `OFFICE_SUPPLY_NOT_MANAGER`, `OFFICE_SUPPLY_CONTACT_INVALID`, `OFFICE_SUPPLY_NO_DEPARTMENT` | 403, 400, 403 | Chỉ định đầu mối | Toast |
| `OFFICE_SUPPLY_PERIOD_EXISTS` | 409 | Văn phòng đã có kỳ của tháng đó | Toast |
| `OFFICE_SUPPLY_PERIOD_MONTH_PAST` | 400 | Mở kỳ cho tháng trước tháng hiện tại (UAT đợt C): "Tháng 10/2026 đã qua. Bạn chọn tháng 11/2026 hoặc tháng sau." | Lỗi ở ô tháng; ô tháng chỉ cho chọn từ tháng hiện tại |
| `OFFICE_SUPPLY_DEADLINE_PAST`, `OFFICE_SUPPLY_DEPARTMENT_INVALID` | 400 | Mở kỳ | Lỗi ở form |
| `OFFICE_SUPPLY_FINAL_NOTE_REQUIRED` | 400 | Chốt số khác số xin mà thiếu lý do | Mở ô lý do |
| `OFFICE_SUPPLY_INVALID_STATE` | 409 | Sai bước (chốt khi kỳ còn mở, cấp khi chưa chốt, đóng kỳ còn phiếu chưa nhận, phiếu bổ sung khi kỳ còn mở) | Toast câu của server |
| `OFFICE_SUPPLY_PROXY_TOO_EARLY` | 409 | Ghi đã giao trước `proxyAllowedAt` | Nút đã ẩn theo `proxyAllowedAt` |
| `OFFICE_SITE_NAME_EXISTS`, `OFFICE_ROOM_NAME_EXISTS`, `OFFICE_SUPPLY_ITEM_EXISTS`, `OFFICE_SUPPLY_GROUP_EXISTS` | 409 | Trùng tên | Lỗi ở ô tên |
| `OFFICE_SITE_INACTIVE` | 400 | Chọn văn phòng đã ngừng | Tải lại danh sách |
| `OFFICE_IMPORT_INVALID_FILE`, `OFFICE_IMPORT_NO_HEADER` | 400 | Nhập Excel | Toast câu của server |
| `OFFICE_ROOM_BOOKING_CONFLICT` | 409 | Trùng giờ | Toast, tải lại lịch |
| `OFFICE_ROOM_BOOKING_INVALID_TIME` | 400 | Vi phạm L9 | Lỗi ở ô giờ |
| `OFFICE_ROOM_INACTIVE`, `OFFICE_SITE_INACTIVE` | 400 | Phòng, văn phòng có thật mà đã ngừng (lịch của văn phòng đã ngừng cũng 400) | Tải lại lịch |
| `OFFICE_ROOM_NOT_FOUND` | 404 | Phòng không tồn tại | Tải lại lịch |
| `OFFICE_ROOM_BOOKING_FORBIDDEN` | 403 | Sửa, huỷ lượt không phải của mình; hoặc sửa nội dung lượt riêng tư mình không thấy | Ẩn nút theo `canEdit`; form của lượt `detailsVisible=false` chỉ cho đổi giờ, phòng |
| `OFFICE_ROOM_BOOKING_REASON_REQUIRED` | 400 | Huỷ lượt người khác thiếu lý do | Bắt nhập lý do |
| `OFFICE_ROOM_BOOKING_CANCELLED`, `OFFICE_ROOM_BOOKING_PAST` | 409 | Lượt đã huỷ; lượt đã kết thúc (cả sửa lẫn huỷ) | Tải lại |
| `OFFICE_ROOM_BOOKING_PERSON_INVALID` | 400 | Người mới thêm (chủ trì hoặc người dự) đã nghỉ hoặc không có; câu nêu tên, vai | Tải lại danh sách người |
| `OFFICE_FORBIDDEN` | 403 | Trưởng phòng xem phòng khác | Toast |
| `OFFICE_SUPPLY_DEADLINE_INVALID` | 400 | Hạn chót sai định dạng `YYYY-MM-DD` | Lỗi ở ô ngày |
| `OFFICE_SUPPLY_ITEM_DUPLICATE`, `OFFICE_SUPPLY_QUOTA_DUPLICATE` | 400 | Một mặt hàng gửi hai dòng (dự trù, phiếu bổ sung, định mức) | Lỗi ở form |
| `OFFICE_DATE_INVALID` | 400 | `to` trước `from`, hoặc xem lịch quá 3 tháng. Ngày sai định dạng hay không có thật (30/02) trả mã chung của kiểm dữ liệu với câu "Ngày không hợp lệ…" | Đặt lại bộ lọc ngày |
| `OFFICE_REPORT_RANGE_INVALID` | 400 | `monthTo` trước `monthFrom` | Lỗi ở bộ lọc |
| `OFFICE_SITE_NOT_FOUND`, `OFFICE_ROOM_NOT_FOUND`, `OFFICE_SUPPLY_GROUP_NOT_FOUND`, `OFFICE_SUPPLY_ITEM_NOT_FOUND`, `OFFICE_SUPPLY_PERIOD_NOT_FOUND`, `OFFICE_SUPPLY_REQUEST_NOT_FOUND`, `OFFICE_SUPPLY_LINE_NOT_FOUND`, `OFFICE_ROOM_BOOKING_NOT_FOUND`, `DEPARTMENT_NOT_FOUND` | 404 | Bản ghi không có (hoặc văn phòng đã ngừng khi xem lịch phòng) | Toast, về danh sách |
| `MODULE_NOT_SUBSCRIBED`, `MODULE_SUSPENDED`, `MODULE_LAPSED`, `MODULE_READ_ONLY`, `MODULE_EXPIRED` | 403 | Cổng module chung | Như module khác |

---

## 7. Thông báo (deep link)

| `type` | `refType` | Mở |
|---|---|---|
| `OFFICE_SUPPLY_PERIOD_OPENED`, `OFFICE_SUPPLY_PERIOD_CHANGED` (đổi hạn chót, khoá sớm), `OFFICE_SUPPLY_DEADLINE_REMINDER`, `OFFICE_SUPPLY_REQUEST_ADJUSTED` (chốt có sửa số, chốt lại, sửa số thực nhận), `OFFICE_SUPPLY_SUPPLEMENT_CREATED`, `OFFICE_SUPPLY_ISSUED` | `office_supply_request` | `/office/supplies?request_id={refId}` |
| `OFFICE_SUPPLY_PERIOD_LOCKED`, `OFFICE_SUPPLY_RECEIVED` (phòng nhận thiếu; các phòng đã nhận hết) | `office_supply_period` | `/management/office/supply-periods/{refId}` |
| `OFFICE_SUPPLY_PERIOD_CHANGED` khi HCNS huỷ kỳ (UAT đợt B) | `office_supply_request`, **không có `refId`** | `/office/supplies` (phiếu đã xoá cùng kỳ) |
| `OFFICE_ROOM_BOOKING_INVITED`, `OFFICE_ROOM_BOOKING_UPDATED`, `OFFICE_ROOM_BOOKING_CANCELLED`, `OFFICE_ROOM_BOOKING_REMINDER` | `office_room_booking` | `/office/rooms?booking_id={refId}` |

Nội dung: `docs/notifications/notification-content-map.md`, mục "Hành chính văn phòng". Push đi kèm mọi dòng trừ
`OFFICE_SUPPLY_PERIOD_LOCKED`. Mobile tra màn hình (`OfficeSupplies`, `OfficeRooms`) và tham số trong
`fcm-notification-routing.json` (bản 1.3.1). Web thêm ba `refType` trên vào `app/utils/notification-route.ts`, không rẽ
theo vai trò.

---

## 8. Mobile

Làm hai màn cho mọi nhân viên, cùng API với web:

1. **Văn phòng phẩm của phòng tôi:** danh sách `GET /me/office/supply-requests`; mở phiếu `OPEN` thì nhập số theo nhóm,
   nút "Lấy số tháng trước", thêm dòng ngoài danh mục, đếm ngược tới `period.lockAt`. Phiếu `ISSUED` có nút Đã nhận khi
   `canReceive`.
2. **Đặt phòng họp:** chọn văn phòng (nhớ lần chọn trước), ngày (mặc định hôm nay), lịch phòng theo giờ, chạm ô trống để
   đặt nhanh (tiêu đề, giờ kết thúc mặc định +60 phút). Tab "Lịch của tôi" dùng `GET /me/office/room-bookings`.

Deep link theo mục 7. Màn quản lý (mở kỳ, chốt, cấp, cài đặt, báo cáo) chỉ có trên web.

---

## 9. Kịch bản phải thử (web)

| # | Thao tác | Kỳ vọng |
|---|---|---|
| W1 | HR nhập file đăng ký hằng tháng ở Cài đặt | Báo tạo 5 nhóm, 59 mặt hàng; nhóm Đồ uống, Khác, Vật dụng vệ sinh có nhãn "Chỉ HCNS đặt" |
| W2 | HR mở kỳ Tháng 12 cho 2 phòng | Kỳ hiện ở danh sách; nhân viên hai phòng thấy thông báo, bấm vào mở đúng phiếu |
| W3 | Hai nhân viên cùng phòng nhập phiếu | Mỗi dòng hiện "sửa cuối bởi"; vượt định mức bắt lý do; ô chọn không có đồ uống, vệ sinh |
| W4 | Sau hạn chót (hoặc HR khoá sớm) nhân viên sửa | Ô nhập khoá, toast "Kỳ đã đóng, bạn liên hệ HCNS…" |
| W5 | HR nhập dự trù, đơn giá, chốt (có sửa số), cấp | Bảng tổng hợp đổi số cần mua, thành tiền; sửa số thiếu lý do bị chặn |
| W6 | Trưởng phòng chỉ định đầu mối; đầu mối bấm Đã nhận, sửa 8/10 | Phiếu Đã nhận; báo cáo chi phí tính theo 8 |
| W7 | HR tạo phiếu bổ sung có mặt hàng đồ uống | Phiếu bổ sung hiện ở bảng tổng hợp, có ghi chú |
| W8 | Xuất Excel bảng tổng hợp, báo cáo chi phí | File mở được, cột phòng ban như file cũ |
| W9 | Đặt phòng: đặt, trùng giờ, liền kề, riêng tư, đặt hộ, mời người dự, huỷ có lý do | Đúng mục 5; toast lỗi không trắng trang |
| W10 | Trưởng phòng (MANAGER) mở báo cáo, bảng tổng hợp | Chỉ thấy phòng mình |
| W11 | Nhân viên thường vào `/management/office/*` | Bị chặn như các trang quản lý khác |
| W12 | Công ty chưa được cấp `OFFICE` | Ô "Hành chính văn phòng" khoá như module chưa mua |
| W13 | HR thêm phòng vào kỳ đang mở; huỷ một kỳ mở nhầm chưa ai nhập; đổi hạn chót | Phòng mới thấy phiếu; kỳ huỷ biến mất, mở lại được cùng tháng; nhân viên nhận thông báo hạn mới |
| W14 | HR khoá sớm | Trưởng phòng nhận thông báo; đếm ngược trên phiếu dừng đúng giờ khoá |
| W15 | HR chốt lại phiếu đã cấp (đổi số, ghi lý do); sửa số thực nhận phiếu đã nhận | Số mới hiện ở phiếu và bảng tổng hợp; trưởng phòng nhận thông báo; kỳ đã đóng thì nút bị ẩn |
| W16 | "Lấy số tháng trước" có dòng vượt định mức, dòng ngoài danh mục | Toast nêu số dòng đã thêm và từng dòng bỏ qua kèm lý do |
| W17 | Nhân viên mở ô chọn mặt hàng, danh mục | Không có cột đơn giá |
