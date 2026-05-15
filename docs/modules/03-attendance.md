# Module 03 — Chấm công

## Yêu cầu

| # | Yêu cầu | Ưu tiên | Web | Mobile | Sprint |
|---|---------|---------|-----|--------|--------|
| 1 | Check-in / check-out | Cao | ✓ | ✓ | S1 |
| 2 | Giới hạn IP | Cao | ✓ | — | S1 |
| 3 | Tính đi muộn / về sớm | Cao | ✓ | — | S1 |
| 4 | Xem lịch sử chấm công | Cao | ✓ | ✓ | S1 |
| 5 | Cấu hình ca làm việc | Trung bình | ✓ | — | S3 |
| 6 | Chỉnh sửa công thủ công | Trung bình | ✓ | — | S3 |
| 7 | Nhắc nhở chưa check-in | Trung bình | — | ✓ | S3 |

## API Endpoints

| Method | Endpoint | Mô tả | Role |
|--------|----------|-------|------|
| POST | `/v1/attendance/check-in` | Check-in | Employee |
| POST | `/v1/attendance/check-out` | Check-out | Employee |
| GET | `/v1/attendance` | Danh sách | HR, Admin |
| GET | `/v1/attendance/me` | Lịch sử cá nhân | Employee |
| PATCH | `/v1/attendance/:id` | Chỉnh sửa thủ công | HR, Admin |
| GET | `/v1/work-shifts` | Danh sách ca | All |
| POST | `/v1/work-shifts` | Tạo ca | Admin |
| GET | `/v1/ip-whitelist` | Danh sách IP | Admin |
| POST | `/v1/ip-whitelist` | Thêm IP | Admin |

## Business Logic

- Check-in hợp lệ khi IP nằm trong whitelist (Web)
- Mỗi nhân viên chỉ có 1 record chấm công mỗi ngày
- Cron 9:30 sáng (T2–T7): nhắc nhở chưa check-in
- Cron 23:59 hàng ngày: auto mark absent

## Transformer output

```typescript
export interface AttendanceRecordResponse {
  id: string;
  date: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  lateMinutes: number;
  earlyMinutes: number;
  status: string;
  isManual: boolean;
  employee: { id: string; fullName: string; employeeCode: string } | null;
}
```
