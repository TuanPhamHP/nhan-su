# Module 05 — Email thông báo

## Yêu cầu

| # | Yêu cầu | Ưu tiên | Web | Sprint |
|---|---------|---------|-----|--------|
| 1 | Email khi có đơn phép mới | Cao | ✓ | S1 |
| 2 | Email kết quả duyệt đơn | Cao | ✓ | S1 |
| 3 | Email chào mừng nhân viên mới | Cao | ✓ | S1 |
| 4 | Thông báo đi muộn | Trung bình | ✓ | S3 |
| 5 | Nhắc nhở chưa check-in | Trung bình | ✓ | S3 |
| 6 | Báo cáo công tháng | Thấp | ✓ | S5+ |
| 7 | Email log & retry | Trung bình | ✓ | S3 |

## Kiến trúc

```
Event → NotificationService → BullMQ Queue → EmailProcessor → Resend API → EmailLog
```

## Events & Templates

| Event | Template | Người nhận |
|-------|----------|-----------|
| `leave.created` | `leave-request` | Manager |
| `leave.approved` | `leave-approved` | Employee |
| `leave.rejected` | `leave-rejected` | Employee |
| `employee.created` | `welcome` | Employee mới |
| `attendance.late` | `late-notice` | Employee + HR |
| `attendance.missing` | `checkin-reminder` | Employee |
| `report.monthly` | `monthly-report` | HR, Manager |

## API Endpoints (Admin)

| Method | Endpoint | Role |
|--------|----------|------|
| GET | `/v1/email-logs` | Admin, HR |
| POST | `/v1/email-logs/:id/retry` | Admin |
| GET | `/v1/email-logs/stats` | Admin |

## Lưu ý

- Provider: **Resend** (free 3.000/tháng)
- Retry tối đa 3 lần, backoff exponential
- Log giữ 90 ngày
