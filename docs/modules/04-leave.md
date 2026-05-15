# Module 04 — Nghỉ phép & Xin phép

## Yêu cầu

| # | Yêu cầu | Ưu tiên | Web | Mobile | Sprint |
|---|---------|---------|-----|--------|--------|
| 1 | Gửi đơn xin nghỉ phép | Cao | ✓ | ✓ | S1 |
| 2 | Duyệt / từ chối đơn | Cao | ✓ | ✓ | S1 |
| 3 | Xem số ngày phép còn lại | Cao | ✓ | ✓ | S1 |
| 4 | Quản lý loại phép | Trung bình | ✓ | — | S3 |
| 5 | Lịch nghỉ phép toàn công ty | Trung bình | ✓ | — | S3 |
| 6 | Đơn xin đi muộn / về sớm | Trung bình | ✓ | ✓ | S3 |

## API Endpoints

| Method | Endpoint | Mô tả | Role |
|--------|----------|-------|------|
| POST | `/v1/leave-requests` | Tạo đơn | Employee |
| GET | `/v1/leave-requests` | Danh sách | HR, Manager |
| GET | `/v1/leave-requests/me` | Đơn của tôi | Employee |
| PATCH | `/v1/leave-requests/:id/approve` | Duyệt | Manager, HR |
| PATCH | `/v1/leave-requests/:id/reject` | Từ chối | Manager, HR |
| DELETE | `/v1/leave-requests/:id` | Huỷ (pending) | Employee |
| GET | `/v1/leave-balances/me` | Số ngày phép | Employee |
| GET | `/v1/leave-types` | Loại phép | All |
| POST | `/v1/permission-requests` | Xin đi muộn/về sớm | Employee |

## Loại phép mặc định

| Code | Tên | Ngày/năm | Lương |
|------|-----|----------|-------|
| ANNUAL | Phép năm | 12 | Có |
| SICK | Nghỉ bệnh | Không giới hạn | Có |
| UNPAID | Không lương | Không giới hạn | Không |
| MATERNITY | Thai sản | 180 | Có |
| PATERNITY | Nghỉ sinh con (bố) | 5 | Có |

## Transformer output

```typescript
export interface LeaveRequestResponse {
  id: string;
  employee: { id: string; fullName: string; employeeCode: string };
  leaveType: { id: string; name: string; code: string };
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string | null;
  status: string;
  approvedBy: { id: string; fullName: string } | null;
  approvedAt: string | null;
  rejectNote: string | null;
  createdAt: string;
}
```
