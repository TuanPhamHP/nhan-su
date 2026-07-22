# FE Agent Prompt — Backend đã thêm `requiresLocationCheck` cho ca remote toàn thời gian

## Context

Backend vừa thêm chế độ ca làm việc mới: **remote toàn thời gian** — nhân viên vẫn bấm nút check-in/check-out như bình thường, nhưng server **không** validate GPS distance. Trước đây hệ thống chỉ có 2 mode: offline (check-in + GPS) hoặc online (cron tự ghi PRESENT, FE ẩn nút check-in). Mode mới này nằm giữa: check-in thủ công, không GPS.

Lý do: HR cần cấp công cho nhân sự làm WFH 100% T2-T7. Nếu để ca `isOnline=true` thì cron tự ghi PRESENT — không phản ánh đúng vì nhân viên phải thực sự bắt đầu/kết thúc ngày làm. Nếu để ca offline thì bị GPS reject. Mode mới giải quyết đúng nhu cầu này.

## API contract đã thay đổi

### 1. `WorkShiftResponse` — thêm field

```typescript
export interface WorkShiftResponse {
  // ... các field cũ giữ nguyên
  isOnline: boolean;
  requiresLocationCheck: boolean;  // ← NEW. Default true (backward compatible).
  isActive: boolean;
  createdAt: string;
}
```

`requiresLocationCheck = false` nghĩa là: nhân viên vẫn phải bấm nút check-in/out, nhưng server không kiểm tra khoảng cách GPS.

### 2. `CreateWorkShiftDto` — thêm field optional

```typescript
export interface CreateWorkShiftDto {
  // ... các field cũ giữ nguyên
  isOnline?: boolean;              // mặc định false
  requiresLocationCheck?: boolean; // ← NEW. Mặc định true.
}
```

`UpdateWorkShiftDto = Partial<CreateWorkShiftDto>` tự động kế thừa.

### 3. `TodayShiftDto` (trong response `GET /v1/attendance/today-info`) — thêm field

```typescript
export interface TodayShiftDto {
  id: number;
  name: string;
  checkInTime: string;
  checkOutTime: string;
  isOnline: boolean;
  requiresLocationCheck: boolean;  // ← NEW
}
```

### 4. `AttendanceResponseDto.distance` — semantics mở rộng

Trước đây: `distance: null` chỉ xảy ra khi `isManual: true` (HR sửa thủ công).  
Bây giờ: cũng `null` khi check-in trên ca có `requiresLocationCheck: false`.

### 5. `GET /v1/attendance/check-attendance` — response shape thay đổi đáng kể

```typescript
export interface CheckAttendanceResponseDto {
  id: number | null;             // ← CŨ: number, MỚI: nullable
  name: string | null;
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number | null;
  distance: number | null;
  isInRange: boolean;            // **luôn true** khi shift remote
  isAvailableShift: boolean;
  canCheckIn: boolean;
  canCheckOut: boolean;
  requiresLocationCheck: boolean;  // ← NEW
  checkInWindow: TimeWindowDto | null;
  checkOutWindow: TimeWindowDto | null;
}
```

**Thay đổi quan trọng**:
- Các field location (`id, name, latitude, longitude, radiusMeters, distance`) chuyển thành **nullable**. Sẽ null khi nhân sự remote không được gán địa điểm nào (trước đây sẽ throw 400).
- `isInRange` luôn `true` khi `requiresLocationCheck=false` — FE không được hardcode `if (!isInRange) blockButton()` mà phải đọc `canCheckIn` / `canCheckOut`.
- FE phải đọc field `requiresLocationCheck` để biết có hiển thị UI "Bạn cách N mét" hay không (nếu false thì ẩn).

## Phân biệt 3 chế độ ca làm việc

| Chế độ | `isOnline` | `requiresLocationCheck` | Nút check-in trên FE | Xin GPS permission | Ai chấm công |
|---|---|---|---|---|---|
| Offline bình thường | `false` | `true` | Hiển thị | Có | Nhân viên |
| Ca online (T7 WFH cũ) | `true` | bất kỳ | **Ẩn** | Không | Cron 23:50 |
| Remote toàn thời gian (mới) | `false` | `false` | Hiển thị | **Không** | Nhân viên |

**Lưu ý ưu tiên**: `isOnline` mạnh hơn `requiresLocationCheck`. Nếu `isOnline = true` thì check-in luôn bị block, kể cả khi `requiresLocationCheck = false`.

## Việc cần làm trên FE

### Web (Nuxt 4)

1. **Form tạo/sửa WorkShift** (HR module):
   - Thêm checkbox/switch "Yêu cầu check vị trí GPS" — bind vào `requiresLocationCheck`
   - Default true (giữ nguyên hành vi cũ cho ca đã tồn tại)
   - UI hint: "Tắt nếu nhân sự làm remote toàn thời gian — vẫn check-in/out thủ công nhưng không kiểm tra GPS"
   - Validate UX: nếu HR tick cả `isOnline: true` và `requiresLocationCheck: false` thì warn — `isOnline` sẽ override (cron tự ghi, không cho check-in thủ công). Để rõ thì nên disable `requiresLocationCheck` khi `isOnline = true`.

2. **Bảng danh sách WorkShift**:
   - Thêm cột hiển thị `requiresLocationCheck` (badge "GPS" vs "Không GPS" hoặc icon vị trí có/không gạch chéo)

3. **Composable `useShiftSchedules.createWorkShift / updateWorkShift`**: type signature tự cập nhật theo `CreateWorkShiftDto` đã sửa.

### Mobile (Flutter) — quan trọng nhất

1. **Logic xin GPS permission** ở màn hình chấm công:
   ```dart
   final todayInfo = await api.getTodayInfo();
   final shift = todayInfo.shift;

   if (shift == null) { /* không có ca, hiển thị thông báo */ }
   else if (shift.isOnline) { /* ẩn nút check-in, hiển thị "Hệ thống tự ghi nhận công" */ }
   else if (!shift.requiresLocationCheck) {
     // ✅ Mode mới: hiển thị nút check-in, KHÔNG xin location permission
     // Có thể vẫn lấy GPS nếu đã có permission sẵn (audit log), nhưng không bắt buộc
   } else {
     // Mode cũ: xin location permission, validate GPS trước khi gọi POST /check-in
   }
   ```

2. **Payload POST `/v1/attendance/check-in`**:
   - DTO vẫn yêu cầu `latitude` và `longitude` (multipart/form-data field)
   - Khi `requiresLocationCheck: false`: gửi `latitude: 0, longitude: 0` (hoặc tọa độ thật nếu có) — server không validate
   - Khi `requiresLocationCheck: true`: gửi tọa độ thật như cũ

3. **Hiển thị record sau check-in**:
   - `distance: null` không còn chỉ có nghĩa "do HR sửa" — kiểm tra `shift.requiresLocationCheck` để biết
   - UI có thể ẩn ô "Khoảng cách" hoặc hiển thị "Không yêu cầu GPS"

### Không cần làm

- Không cần migration data — field default `true` nên ca cũ giữ nguyên hành vi
- Không cần đổi cron / scheduler logic — đó là việc của BE
- Không cần đổi flow `OnlineWorkRequest` (ad-hoc remote) — flow đó độc lập

## File bridge docs đã update (đọc kỹ trước khi code)

- [docs/bridges/attendance-shifts.md](./attendance-shifts.md) — mục "Phân biệt isOnline vs requiresLocationCheck" và DTO `WorkShiftResponse` / `CreateWorkShiftDto`
- [docs/bridges/attendance.md](./attendance.md) — `TodayShiftDto` và semantics mới của `distance: null`

## Checklist trước khi merge FE PR

- [ ] `WorkShiftResponse` type có field `requiresLocationCheck: boolean`
- [ ] `CreateWorkShiftDto` / `UpdateWorkShiftDto` có field `requiresLocationCheck?: boolean`
- [ ] `TodayShiftDto` có field `requiresLocationCheck: boolean`
- [ ] `CheckAttendanceResponseDto`: location fields chuyển sang nullable + thêm `requiresLocationCheck`
- [ ] Form tạo/sửa WorkShift cho HR có toggle `requiresLocationCheck`
- [ ] Mobile check-in flow: nếu `shift.requiresLocationCheck === false` thì skip location permission
- [ ] Mobile dùng `canCheckIn` / `canCheckOut` từ `check-attendance`, KHÔNG hardcode `if (!isInRange)`
- [ ] Mobile UI hiển thị `distance: null` không bị crash / null pointer
- [ ] Mobile ẩn UI "Bạn cách N mét" khi `requiresLocationCheck === false`
- [ ] Nếu form HR cho phép bật cả `isOnline=true` và `requiresLocationCheck=false`, có warning hoặc disable
