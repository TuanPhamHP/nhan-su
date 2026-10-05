# FE Agent Prompt — Hỗ trợ phương tiện di chuyển + Hình thức/Số tiền thanh toán

## Context nghiệp vụ

Ba vấn đề thật đang phải xử lý bằng công cụ ngoài hệ thống:

1. HR xem danh sách công tác **không biết đơn nào cần đặt xe** → phải mở từng đơn ra đọc.
2. Nhân viên không có chỗ nào nói **"chặng này tôi tự lo, chặng này cần công ty đặt xe"**.
3. Đơn mà **nhân viên phải ứng tiền trước** cho nhà xe thì không có chỗ ghi nhận → HR phải
   nhắn Zalo/điện thoại cho từng người.

BE đã xong. Bridge doc đầy đủ: [`business-trips.md`](./business-trips.md) — đọc mục
**"needsVehicleSupport vs isSelfTransport — ĐỪNG SUY RA CÁI NÀY TỪ CÁI KIA"** trước khi code.

---

## ⚠ Cái bẫy lớn nhất của task này

`TripRouteResponse` có **hai** trường boolean tên na ná nhau. Chúng **không phải phủ định
của nhau**, và lẫn hai cái là lỗi dễ xảy ra nhất ở đây.

| | `needsVehicleSupport` | `isSelfTransport` |
|---|---|---|
| Ai đặt | **Nhân viên**, lúc tạo đơn | **HR**, sau khi đơn `APPROVED` |
| Nghĩa | *Mong muốn*: có cần công ty đặt xe | *Kết quả*: công ty có bố trí xe |
| Nhãn hiển thị | "Hỗ trợ phương tiện di chuyển: Có/Không" | "Tự túc di chuyển" |
| Mặc định | `true` | `false` |

**`needsVehicleSupport = true` và `isSelfTransport = true` cùng lúc là HỢP LỆ** — nhân viên
xin hỗ trợ nhưng HR chốt tự túc. Đừng render nó như lỗi, và **đừng** dùng
`!isSelfTransport` để suy ra `needsVehicleSupport`.

---

## Thay đổi API

### 1. Type mới

```typescript
export type TripPaymentMethod = 'COMPANY_PAID' | 'EMPLOYEE_PAID';
```

| Value | Label (BE trả sẵn ở `paymentMethodLabel`) | Nghĩa |
|---|---|---|
| `COMPANY_PAID` | Công ty thanh toán | Nhân viên không phải trả gì |
| `EMPLOYEE_PAID` | Nhân viên thanh toán | Nhân viên ứng trước, sau đó làm đề nghị thanh toán gửi HR |

### 2. `TripRouteResponse` — 2 field mới

```typescript
export interface TripRouteResponse {
  // … field cũ
  needsVehicleSupport: boolean;      // mong muốn của nhân viên
  needsVehicleSupportLabel: string;  // 'Có' | 'Không' — dùng trực tiếp, đừng tự map
  isSelfTransport: boolean;          // (cũ) kết quả HR xử lý
}
```

### 3. `TripTransportResponse` — 3 field mới

```typescript
export interface TripTransportResponse {
  // … field cũ
  paymentMethod: TripPaymentMethod;
  paymentMethodLabel: string;        // 'Công ty thanh toán' | 'Nhân viên thanh toán'
  paymentAmount: number;             // VNĐ, số nguyên ≥ 0
}
```

### 4. `BusinessTripResponse` — field GỘP cho danh sách

```typescript
export interface BusinessTripResponse {
  // … field cũ
  needsVehicleSupport: boolean;      // true khi CÓ ÍT NHẤT MỘT chặng cần hỗ trợ
  needsVehicleSupportLabel: string;  // 'Có' | 'Không'
}
```

**Dùng field này cho 2 trang danh sách. ĐỪNG tự `routes.some(...)` ở FE** — gộp ở hai nơi
là hai nơi có thể lệch nhau khi luật đổi. Đơn chưa có chặng nào → `false`.

### 5. `CreateTripRouteDto` — nhân viên chọn khi thêm chặng

```typescript
export interface CreateTripRouteDto {
  // … field cũ
  needsVehicleSupport?: boolean;     // BỎ TRỐNG = true
}
```

### 6. `CreateTripTransportDto` — HR điền khi cập nhật phương tiện

```typescript
export interface CreateTripTransportDto {
  // … field cũ
  paymentMethod?: TripPaymentMethod; // bỏ trống = 'COMPANY_PAID'
  paymentAmount?: number;            // bỏ trống = 0
}
```

Ràng buộc BE enforce (gửi sai → **400**):
- `paymentAmount` phải là **số nguyên**, `0 .. 2_000_000_000`. Âm hoặc có phần thập phân → 400.
- `paymentMethod` phải thuộc enum.

---

## Việc cần làm trên UI

### A. Tạo đơn công tác — mỗi chặng thêm 1 lựa chọn (Nhân viên)

Trong form nhập lộ trình, với **mỗi chặng**:

```
Hỗ trợ phương tiện di chuyển:   ( ) Có    ( ) Không
```

- Chỉ 2 lựa chọn, **mặc định chọn "Có"** mỗi khi thêm chặng mới.
- "Có" = cần công ty đặt xe · "Không" = nhân viên tự lo chặng đó.
- Gửi lên `routes[].needsVehicleSupport`.

### B. Danh sách công tác — cả 2 trang

Áp dụng **giống nhau** cho trang nhân viên và trang quản lý (HR / Quản lý / Quản trị viên):

- Thêm hiển thị `Hỗ trợ phương tiện di chuyển: {needsVehicleSupportLabel}`.
- Lấy từ **`trip.needsVehicleSupport`** (field gộp cấp đơn), không phải từ `routes[]`.
- Đây là thứ giúp HR nhìn danh sách biết ngay đơn nào phải đặt xe → nên để dễ thấy
  (badge/chip), đừng nhét vào tooltip.

### C. Chi tiết đơn công tác — phần Lộ trình di chuyển

Giữ nguyên mọi thông tin hiện có, bổ sung:

- **Mỗi chặng di chuyển:** `Hỗ trợ phương tiện di chuyển: Có/Không` ←
  `route.needsVehicleSupportLabel` (theo từng chặng, KHÔNG dùng field gộp cấp đơn).
- **Mỗi phương tiện di chuyển:** `Hình thức thanh toán` (`paymentMethodLabel`) +
  `Số tiền thanh toán` (`paymentAmount`) — định dạng **vi-VN kèm ký hiệu**: `1.850.000 ₫`.

### D. Modal "Cập nhật phương tiện" (HR / Quản trị viên)

Trong modal hiện có, **với từng transport**, thêm:

1. **Hình thức thanh toán** — radio, bắt buộc có lựa chọn, mặc định `COMPANY_PAID`:
   ```
   Hình thức thanh toán:  (•) Công ty thanh toán   ( ) Nhân viên thanh toán
   ```
2. **Số tiền thanh toán** — ô nhập số, mặc định `0`:
   - chỉ cho nhập **số nguyên không âm**;
   - hiển thị có phân cách nghìn kiểu vi-VN (`1.850.000`), gửi lên BE là **number thuần**;
   - **ô nhập KHÔNG hiện ký hiệu `₫`** — nhồi ký hiệu vào input đang gõ thì caret phải nhảy
     qua nó và người dùng dễ xoá mất. Chỗ *hiển thị* mới có `₫`;
   - đơn vị chỉ VNĐ.

> Chốt định dạng: dùng `vi-VN` + `style: 'currency'` để khớp `fmtCurrency` sẵn có của trang
> chi tiết (Chi phí dự kiến / Chi phí thực tế). Nếu dùng dấu phẩy kiểu `en-US` thì trên cùng
> một trang sẽ có hai kiểu phân cách nghìn cạnh nhau. Helper dùng chung:
> `app/utils/business-trip.utils.ts` — `formatTripPaymentAmount()` (có `₫`, để hiển thị) và
> `formatTripPaymentAmountInput()` (không ký hiệu, cho ô nhập).

**Khi HR chọn "Tự túc"** (`isSelfTransport: true`): **ẩn hoàn toàn** cả hai field trên.
Tự túc thì không có transport nào, nên tiền không có chỗ để sống.

---

## 🚨 Bẫy thứ hai: PATCH transport là REPLACE TOÀN BỘ

`PATCH /v1/business-trips/routes/:routeId/transport` với `{ transports: [...] }` **xoá hết
transports cũ rồi tạo lại** từ danh sách gửi lên.

→ Sửa 1 phương tiện vẫn phải gửi lại **cả danh sách, kèm `paymentMethod` + `paymentAmount`
của MỌI phương tiện**. Bỏ sót trường tiền ở một phần tử thì phần tử đó **bị reset về
`COMPANY_PAID` / `0`**, không phải "giữ nguyên giá trị cũ".

Cách an toàn: nạp `route.transports` vào form state, sửa trong state, submit cả mảng.

---

## Dữ liệu cũ (không cần FE xử lý gì)

Migration đã backfill ở tầng DB bằng `DEFAULT`, nên mọi đơn cũ đã có giá trị hợp lệ:

| Dữ liệu cũ | Giá trị |
|---|---|
| Chặng đã tồn tại | `needsVehicleSupport = true` ("Có") |
| Phương tiện đã tồn tại | `paymentMethod = COMPANY_PAID`, `paymentAmount = 0` |

Không có `null` nào ở ba field này — khỏi cần optional chaining hay fallback.

---

## Checklist

- [ ] `TripPaymentMethod` vào `types/business-trip.types.ts`
- [ ] 2 field mới ở `TripRouteResponse`, 3 field mới ở `TripTransportResponse`, 2 field gộp ở `BusinessTripResponse`
- [ ] `needsVehicleSupport?` vào `CreateTripRouteDto`; `paymentMethod?` + `paymentAmount?` vào `CreateTripTransportDto`
- [ ] Form tạo đơn: radio Có/Không mỗi chặng, **default Có**
- [ ] Danh sách nhân viên: hiện nhãn gộp cấp đơn
- [ ] Danh sách quản lý: hiện nhãn gộp cấp đơn
- [ ] Chi tiết: nhãn theo **từng chặng** + hình thức/số tiền theo **từng phương tiện**
- [ ] Modal cập nhật phương tiện: radio hình thức + ô tiền phân cách nghìn (không `₫`), ẩn khi Tự túc
- [ ] Submit transports gửi **cả mảng kèm tiền** (xem bẫy REPLACE ở trên)
- [ ] Không dùng `!isSelfTransport` để suy ra `needsVehicleSupport`
- [ ] Dùng `*Label` BE trả sẵn, không tự map enum → tiếng Việt
