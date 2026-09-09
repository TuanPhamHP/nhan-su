# FE Agent Prompt — Trang Tools: tính lại phép năm & công lương

## Context

Quy tắc trừ quỹ phép năm vừa đổi: **nghỉ nửa ngày (`HALF_DAY`) nay trừ 0.5 ngày vào quỹ phép năm**. Trước đó `HALF_DAY` có `daysPerYear = null` nên không bao giờ đụng tới quỹ — nhân sự nghỉ nửa ngày có lương không giới hạn.

Hai hệ quả trên dữ liệu cũ:

1. **Đơn đã duyệt mang giá trị sai.** `paidDays` / `unpaidDays` / `leaveCode` được chốt tại thời điểm **tạo đơn** và không bao giờ tính lại. Mọi đơn `HALF_DAY` duyệt trước đây đều mang `paidDays = totalDays` dù nhân sự không còn quỹ → đang được trả lương sai.
2. **Sổ quỹ mang giá trị sai.** `usedDays` chưa từng được cộng phần nghỉ nửa ngày.

Trang Tools này expose hai thao tác sửa dữ liệu, **phải chạy theo đúng thứ tự**. Cả hai đều có chế độ xem trước.

Bridge doc đầy đủ: [`docs/bridges/leave-balances.md`](./leave-balances.md).

---

## Auth

- Header `Authorization: Bearer <accessToken>` bắt buộc.
- Role được phép: **`HR`, `ADMIN`**. Role khác → **403** từ `RolesGuard`.
- Trang Tools nên ẩn hoàn toàn với role khác, không chỉ disable nút.

---

## Nguyên tắc bất di bất dịch

> **Bước 1 luôn chạy trước Bước 2.**
>
> `usedDays` (bước 2) được cộng từ `paidDays` của đơn (bước 1). Làm ngược thì bước 2 lấy số cũ và phải chạy lại.

> **`dryRun` mặc định là `true`.**
>
> Muốn ghi DB phải truyền thẳng `dryRun: false`. UI **không** được gửi `dryRun: false` mà chưa cho người dùng xem bảng thay đổi và bấm xác nhận.

---

## BƯỚC 1 — `POST /v1/leave-balances/recalculate-requests`

Tính lại phần P (hưởng lương) / KL (không hưởng lương) của các đơn `ANNUAL` + `HALF_DAY` đã duyệt.

Cách phát lại: mỗi nhân sự có một "quỹ" = `accruedDays` hiện tại của quỹ phép năm (0 nếu chưa được cấp phát). Rải quỹ cho các đơn theo **thứ tự ngày nghỉ**; hết quỹ thì đơn sau thành `KL`; đơn vắt ngang ranh giới bị cắt thành `P+KL`.

### Request

```ts
interface RecalculateLeaveSplitPayload {
	year: number; // bắt buộc, 2020–2100
	month?: number; // 1–12; chỉ ÁP DỤNG cho đơn có ngày nghỉ trong tháng này
	employeeIds?: number[]; // bỏ trống → toàn bộ
	dryRun?: boolean; // mặc định true
}
```

**`month` chỉ giới hạn phần GHI, không giới hạn phần tính.** Việc phát lại luôn chạy trên cả năm để quỹ tiêu hao đúng thứ tự thời gian — nếu chỉ nạp đơn tháng 8 rồi phát lại, các đơn tháng 8 sẽ được hưởng quỹ như thể tháng 1–7 chưa ai nghỉ ngày nào.

Dùng `month` khi tháng trước đã chốt lương và không muốn số liệu đã thanh toán bị đổi.

### Response

```ts
interface LeaveSplitRecalcResult {
	dryRun: boolean;
	year: number;
	month: number | null; // tháng được áp dụng; null = cả năm
	scanned: number; // số đơn đã quét (LUÔN là cả năm)
	changed: number; // số đơn có thay đổi trong phạm vi áp dụng
	skippedOutsideMonth: number; // số đơn lệch nhưng nằm ngoài tháng đã chọn
	paidBefore: number; // tổng ngày đang tính có lương của các đơn bị đổi
	paidAfter: number; // tổng ngày còn được tính có lương sau khi áp
	items: Array<{
		leaveRequestId: number;
		employeeId: number;
		employeeCode: string;
		fullName: string;
		date: string; // 'YYYY-MM-DD', ngày nghỉ
		leaveTypeCode: 'ANNUAL' | 'HALF_DAY';
		totalDays: number;
		paidBefore: number;
		paidAfter: number;
		unpaidBefore: number;
		unpaidAfter: number;
		leaveCodeBefore: string | null;
		leaveCodeAfter: 'P' | 'KL' | 'P+KL';
	}>;
	nextStep: string; // câu nhắc chạy bước 2, hiển thị nguyên văn được
}
```

### UI cần làm gì

| Trường | Hiển thị |
| --- | --- |
| `paidBefore` → `paidAfter` | Dòng tóm tắt nổi bật: "**{paidBefore - paidAfter} ngày** sẽ chuyển từ có lương sang không lương" |
| `items` | Bảng chi tiết. Cột `leaveCodeBefore → leaveCodeAfter` nên hiện dạng badge, `P` xanh / `KL` đỏ / `P+KL` cam |
| `skippedOutsideMonth` | **Cảnh báo vàng** nếu > 0: "Còn {n} đơn sai ở tháng khác chưa xử lý" — người dùng dễ tưởng đã xong |
| `changed === 0` | Hiện trạng thái "Không có gì cần sửa", disable nút áp dụng |

Nhóm `items` theo `fullName` để HR dễ đọc — một người thường có nhiều đơn.

---

## BƯỚC 2 — `POST /v1/leave-balances/recalculate`

Cộng lại `usedDays` từ toàn bộ đơn `APPROVED` của năm rồi **ghi đè** giá trị đang lưu.

### Request

```ts
interface RecalculateLeaveBalancePayload {
	year: number; // bắt buộc, 2020–2100
	month?: number; // 1–12; thu hẹp PHẠM VI NHÂN SỰ — xem lưu ý bên dưới
	employeeIds?: number[]; // bỏ trống → toàn bộ nhân viên có số dư trong năm
	dryRun?: boolean; // mặc định true
}
```

> ⚠️ **`month` ở bước 2 có nghĩa KHÁC bước 1.**
>
> `usedDays` là con số luỹ kế **cả năm**, không thể "chỉ tính tháng 8" — cộng riêng một tháng sẽ mất hết ngày đã nghỉ các tháng trước. Nên ở đây `month` chỉ dùng để **thu hẹp danh sách nhân sự**: chỉ tính lại cho người có đơn nghỉ trong tháng đó, nhưng `usedDays` của họ vẫn cộng từ toàn bộ đơn trong năm.
>
> UI nên ghi rõ khác biệt này cạnh ô chọn tháng, nếu không người dùng sẽ hiểu nhầm.

### Response

```ts
interface LeaveBalanceRecalcResult {
	dryRun: boolean;
	year: number;
	month: number | null;
	scanned: number; // số bản ghi số dư trong phạm vi
	changed: number; // số bản ghi có chênh lệch
	totalDelta: number; // tổng trị tuyệt đối các chênh lệch
	items: Array<{
		employeeId: number;
		employeeCode: string;
		fullName: string;
		leaveTypeCode: string;
		accruedDays: number;
		usedBefore: number;
		usedAfter: number;
		delta: number;
		exceedsAccrued: boolean;
	}>;
	skipped: Array<{
		employeeId: number;
		fullName: string;
		leaveTypeCode: string;
		untrackedDays: number;
	}>;
}
```

### Hai trường phải cảnh báo trên UI

| Trường | Ý nghĩa | UI |
| --- | --- | --- |
| `items[].exceedsAccrued` | Sau khi tính lại, nhân sự đã dùng quá số ngày **tích luỹ tới hiện tại** → số dư âm, đơn phép năm tiếp theo của họ sẽ tự thành `KL` | Tô đỏ dòng + icon cảnh báo. Tooltip: "Nghỉ nhanh hơn tốc độ tích luỹ — chưa chắc vượt hạn mức 12 ngày/năm" |
| `skipped[]` | Nhân sự có đơn trừ quỹ nhưng **chưa được cấp phát số dư** → không có bản ghi để ghi vào | Khối riêng bên dưới bảng chính, kèm nút tắt sang màn cấp phát quỹ |

`accruedDays` là **tích luỹ theo tháng**, không phải hạn mức cả năm. `exceedsAccrued = true` không có nghĩa nhân sự đã nghỉ quá 12 ngày — đừng viết copy hàm ý điều đó.

---

## Luồng UI khuyến nghị

Dựng dạng wizard 4 bước, không cho nhảy cóc:

```
[1] Chọn năm + tháng (tuỳ chọn) + nhân sự (tuỳ chọn)
        ↓
[2] Xem trước bước 1   → POST recalculate-requests { dryRun: true }
    • Bảng items, dòng tóm tắt paidBefore → paidAfter
    • Cảnh báo skippedOutsideMonth
    • Nút [Áp dụng]  → cùng payload, dryRun: false
        ↓
[3] Xem trước bước 2   → POST recalculate { dryRun: true }
    • Bảng items, khối skipped
    • Cảnh báo exceedsAccrued
    • Nút [Áp dụng]  → cùng payload, dryRun: false
        ↓
[4] Xong — hiện lại số tổng kết của cả hai bước
```

Quy tắc bắt buộc trong UI:

- Nút áp dụng ở bước 2 (wizard) **disable** cho tới khi bước 1 đã áp dụng xong trong cùng phiên, hoặc bước 1 trả `changed: 0`.
- Payload lúc áp dụng phải **giống hệt** payload lúc xem trước, chỉ khác `dryRun`. Nếu người dùng đổi filter thì bắt xem trước lại.
- Hiện dialog xác nhận trước mỗi lần `dryRun: false`, nhắc lại số ngày/số bản ghi sẽ đổi.

---

## Tính idempotent — và giới hạn của nó

Cả hai endpoint **ghi đè chứ không cộng dồn**, nên bấm nhầm hai lần liên tiếp không gây hại. UI vẫn nên chặn double-click, nhưng không cần cơ chế khoá phức tạp.

**Giới hạn cần biết:** bước 1 đối chiếu với `accruedDays` **hiện tại**, mà giá trị này tăng dần theo tháng. Chạy lại vào tháng sau có thể làm một số đơn vừa chuyển `KL` quay về `P`, tức bảng công đã chốt lại đổi số. Trang Tools nên:

- Hiện ngày giờ lần chạy gần nhất. Lấy qua `GET /v1/system-logs?action=leave_request.recalculate_split&limit=1` và `?action=leave_balance.recalculate` — endpoint này cũng chỉ cho `ADMIN`/`HR` nên cùng phạm vi với trang Tools. Log **chỉ được ghi khi thực sự áp dụng**, dry-run không ghi.
- Có câu nhắc: "Chỉ chạy lại khi thực sự cần. Chạy ở tháng khác có thể làm đổi số liệu đã chốt."

---

## Xung đột với thao tác chỉnh tay

`PATCH /v1/leave-requests/:id/payroll-split` cho HR ghi đè P/KL của một đơn. Bước 1 **không biết** đơn nào đã được chỉnh tay — nó tính lại tất cả từ `accruedDays`, nên sẽ xoá giá trị chỉnh tay đó.

Trang Tools nên cảnh báo trước khi chạy bước 1: kiểm tra `GET /v1/system-logs?action=leave_request.override_payroll_split` xem có đơn nào trong phạm vi sắp chạy đã bị chỉnh tay không, và hiện danh sách cho người dùng xác nhận.

---

## Ảnh hưởng xuống báo cáo công

Sau khi áp dụng, các ngày chuyển `P → KL` sẽ:

- Không còn được cộng vào `totalPayrollDays`.
- Đổi ký hiệu trong bảng công: `P` → `KL`, `P/X` → `KL/X`.
- Không ảnh hưởng `mealAllowanceDays` (ăn ca chỉ tính phần đi làm thực tế).

FE hiển thị bảng công cần bổ sung `KL` và `KL/X` vào legend ký hiệu nếu chưa có.

---

## Lỗi có thể gặp

| Tình huống                                 | Response                                                           |
| ------------------------------------------ | ------------------------------------------------------------------ |
| Thiếu / sai token                          | **401**                                                            |
| Role không phải HR/ADMIN                   | **403**                                                            |
| `year` ngoài 2020–2100, `month` ngoài 1–12 | **400** kèm message từ class-validator                             |
| Không có gì để sửa                         | **201** với `changed: 0` — không phải lỗi, UI hiện trạng thái rỗng |

Cả hai endpoint là `POST` không override `@HttpCode`, nên **thành công trả 201** kể cả khi `dryRun: true`. Đừng bắt cứng 200.

Không có endpoint nào ném lỗi khi danh sách rỗng — luôn trả kết quả với các mảng rỗng.
