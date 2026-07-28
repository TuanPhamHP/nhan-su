# FE Prompt — Overtime: Multi-day Segments + Preview Endpoint

Copy toàn bộ nội dung dưới đây vào FE Agent (Nuxt 4). Đọc kèm [overtime-requests.md](./overtime-requests.md) để có full context.

---

## Tóm tắt thay đổi BE

Backend module `overtime-requests` vừa có 2 update lớn cần FE tương thích:

### 1. Model OT chuyển sang multi-day segments

- **Bỏ** field `overtimeDate` khỏi request body và response.
- **`startTime` / `endTime` bắt buộc là ISO 8601 full datetime** (bao gồm ngày + giờ). Được phép span nhiều ngày local VN.
- Response mới có `segments: OvertimeSegment[]` — mỗi segment 1 ngày, có `hours`, `otRate` (150/200/300) và `otRateLabel`.
- Response có thêm `totalPaidHours` = `sum(hours × otRate/100)` — dùng làm giờ trả lương thực tế.
- **`otRate` / `otRateLabel` không còn ở top-level response** — chuyển hẳn vào từng segment.
- Ràng buộc: `endTime > startTime` (không còn tự +24h), tổng `[0.5h, 12h]`.
- Rate detect **per-segment** theo ngày của segment: **lễ (300) > CN (200) > T2–T7 (150)**.
- Shift window check cũng per-segment (segment lễ/CN skip; segment T2–T7 phải ngoài giờ ca của ngày đó).

### 2. Endpoint mới `POST /v1/overtime-requests/preview`

Cho phép FE gọi mỗi khi user thay đổi startTime/endTime/workMode/locationId trong form OT để hiển thị:

- Số giờ raw + số giờ trả lương (theo hệ số)
- Breakdown segments (ngày nào × mấy giờ × hệ số nào)
- Người sẽ duyệt đơn (approver)
- Location đã chọn có hợp lệ không

**Endpoint KHÔNG lưu DB**, chỉ dùng để hiển thị. **Rate-limit 20 req / 60s / user** — FE bắt buộc debounce.

---

## Types cần thêm/sửa (`types/overtime.types.ts`)

```typescript
// ─── BỎ khỏi mọi type ───
// - overtimeDate (khỏi CreateOvertimeRequestDto, OvertimeRequestResponse)
// - otRate, otRateLabel (khỏi top-level OvertimeRequestResponse)

// ─── THÊM ───
export interface OvertimeSegment {
  segmentDate: string;                   // "YYYY-MM-DD"
  hours: number;
  otRate: 150 | 200 | 300;
  otRateLabel: string;                   // "150%" | "200%" | "300%"
}

// ─── SỬA OvertimeRequestResponse ───
export interface OvertimeRequestResponse {
  id: number;
  startTime: string;                     // ISO 8601 full datetime
  endTime: string;                       // ISO 8601 full datetime
  totalHours: number;                    // raw hours (endTime - startTime)
  segments: OvertimeSegment[];           // 1–N segments
  totalPaidHours: number;                // sum(hours × rate/100)
  // ... các field khác giữ nguyên: reason, status, workMode, location,
  //     finalWorkMode, resolvedAt, locationStatus, reviewNote, assignedApprover,
  //     reviewedBy, reviewedAt, autoExpireAt, deadlineAt, isExpired, employee,
  //     createdAt, canBeCancelled, hoursDisplay
}

// ─── SỬA CreateOvertimeRequestDto ───
export interface CreateOvertimeRequestDto {
  startTime: string;                     // ISO 8601 full datetime — BẮT BUỘC gồm ngày
  endTime: string;                       // ISO 8601 full datetime
  workMode: 'ONLINE' | 'OFFLINE';
  locationId?: number;
  reason: string;
  // BỎ: overtimeDate
}

// ─── THÊM Preview types ───
export interface PreviewOvertimeRequestDto {
  startTime: string;
  endTime: string;
  workMode: 'ONLINE' | 'OFFLINE';
  locationId?: number;
}

export interface OvertimePreviewResponse {
  isValid: boolean;
  reason: string | null;                 // null khi isValid=true
  startTime: string;
  endTime: string;
  totalHours: number;
  segments: OvertimeSegment[];           // rỗng nếu totalHours ngoài [0.5,12] hoặc endTime<=startTime
  totalPaidHours: number;
  workMode: 'ONLINE' | 'OFFLINE';
  location: { id: number; name: string } | null;
  approver: { id: number; fullName: string } | null;
  approverFallbackToHR: boolean;         // true → khi submit, đơn gửi cho HR
}
```

---

## Composable — bổ sung `previewRequest`

Trong `composables/useOvertimeRequests.ts`:

```typescript
const previewRequest = (dto: PreviewOvertimeRequestDto) =>
  post<OvertimePreviewResponse>('/v1/overtime-requests/preview', dto);

// nhớ export trong return statement
```

---

## Form OT — UX yêu cầu

### Input datetime

- Trước: form có riêng ô "Ngày OT" + ô "Giờ bắt đầu" + ô "Giờ kết thúc".
- **Sau: chỉ 2 datetime picker — "Bắt đầu" (`startTime`) và "Kết thúc" (`endTime`)** — mỗi picker chứa cả ngày + giờ. Kết thúc được phép qua đêm / qua ngày.

### Gọi `/preview` khi user thay đổi form

Debounce **300–500ms** trên các input `startTime`, `endTime`, `workMode`, `locationId`. Sau debounce, nếu 4 field đủ (workMode=ONLINE thì bỏ qua locationId), gọi `previewRequest(dto)`.

```typescript
const previewData = ref<OvertimePreviewResponse | null>(null);
const previewError = ref<string | null>(null);

const runPreview = useDebounceFn(async () => {
  if (!formState.startTime || !formState.endTime || !formState.workMode) return;
  if (formState.workMode === 'OFFLINE' && !formState.locationId) return;
  try {
    previewData.value = await previewRequest({
      startTime: formState.startTime,
      endTime: formState.endTime,
      workMode: formState.workMode,
      locationId: formState.locationId,
    });
    previewError.value = null;
  } catch (err) {
    if (err.status === 429) {
      previewError.value = 'Bạn thao tác quá nhanh, vui lòng thử lại sau 60 giây.';
    } else {
      previewError.value = 'Không kiểm tra được thông tin đơn. Thử lại sau.';
    }
  }
}, 400);

watch(
  () => [formState.startTime, formState.endTime, formState.workMode, formState.locationId],
  runPreview,
);
```

### UI hiển thị kết quả preview

Ngay dưới form (hoặc trong sidebar), render card "Chi tiết đơn OT":

```
┌─ Chi tiết đơn OT ───────────────────────────┐
│ Bắt đầu:   23:00 26/07/2026 (T7)            │
│ Kết thúc:  09:00 27/07/2026 (CN)            │
│ Tổng giờ:  10.0 giờ                         │
│ Chi tiết:                                    │
│   • 26/07 (T7): 1.0h × 150% = 1.5h          │
│   • 27/07 (CN): 9.0h × 200% = 18.0h         │
│ Giờ trả lương: 19.5 giờ                     │
│ Người duyệt: Trần Thị B                     │
│ Địa điểm: Trụ sở Q1                         │
└─────────────────────────────────────────────┘
```

- Nếu `approverFallbackToHR = true` → hiển thị "Đơn sẽ gửi cho HR duyệt".
- Nếu `approver = null` và `approverFallbackToHR = false` → hiếm khi xảy ra, hiển thị placeholder.
- Nếu `isValid = false` → hiển thị `reason` bằng banner đỏ ngay trên card, disable nút "Gửi đơn OT".
- Nếu `segments` rỗng (tổng ngoài [0.5, 12] hoặc endTime≤startTime) → chỉ hiển thị lỗi, không render bảng segments.

### Nút submit

- `Gửi đơn OT` chỉ enable khi `previewData?.isValid === true` VÀ `reason` (nếu có) đã fix.
- Body gửi lên `POST /v1/overtime-requests` là `CreateOvertimeRequestDto` (thêm field `reason` so với preview).

### Rate-limit 429

- Bắt lỗi HTTP 429 riêng — không log console. Show toast/banner + disable auto-preview trong 60s.

---

## Hiển thị danh sách + chi tiết đơn (list & detail)

Response `OvertimeRequestResponse` giờ có:

- `startTime`, `endTime` → format riêng, hiển thị "23:00 26/07 → 09:00 27/07" (nếu qua ngày) hoặc "11:00 → 14:00 20/07" (nếu cùng ngày).
- **Không còn `overtimeDate`** — mọi chỗ đang hiển thị "Ngày OT" phải chuyển sang derive từ `startTime`.
- **Không còn `otRate` top-level** — badge "150%" trên list cần thay logic:
  - Nếu `segments.length === 1` → hiển thị 1 badge `segments[0].otRateLabel`.
  - Nếu `segments.length > 1` → hiển thị nhiều badge, VD `150% + 200%`.
- Trong detail, render bảng segments giống card preview ở trên.
- Thêm dòng "Giờ trả lương" = `totalPaidHours`.

---

## Checklist FE

- [ ] Xóa mọi tham chiếu `overtimeDate` trong types, form, list, detail.
- [ ] Xóa `otRate`, `otRateLabel` khỏi top-level type `OvertimeRequestResponse`.
- [ ] Thêm `OvertimeSegment`, `PreviewOvertimeRequestDto`, `OvertimePreviewResponse` vào types.
- [ ] Đổi form OT sang 2 datetime picker (bỏ picker "Ngày OT" riêng).
- [ ] Thêm composable `previewRequest`.
- [ ] Wire debounce 300–500ms → gọi preview khi startTime/endTime/workMode/locationId đổi.
- [ ] Render card preview (segments breakdown + approver + location + totalPaidHours).
- [ ] Bắt 429 riêng, disable auto-preview trong 60s khi bị rate-limit.
- [ ] Đảm bảo nút submit chỉ enable khi `previewData.isValid === true`.
- [ ] Trong list/detail: derive "ngày OT" từ `startTime` local VN; badge rate từ `segments`.
- [ ] Test case OT qua đêm: startTime 23:00 26/07, endTime 01:00 27/07 → thấy 2 segments (mỗi ngày 1h).
- [ ] Test case OT trong 1 ngày: startTime 20:00, endTime 22:00 cùng ngày → 1 segment.
- [ ] Test case tổng > 12h hoặc endTime ≤ startTime → preview trả `isValid=false`, submit disabled.
- [ ] Test 429 khi spam preview → hiển thị toast phù hợp.

---

## Câu hỏi cần check với BE nếu gặp

- Preview trả `location=null` dù đã gửi `locationId` → có thể location đã bị deactivate. FE nên gọi lại `/available-locations` để refresh dropdown.
- Preview trả `approver=null` + `approverFallbackToHR=false` → edge case rất hiếm (user không có manager và không có HR active). Nên log để BE điều tra.
