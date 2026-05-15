# Module 06 — Báo cáo & Thống kê

## Yêu cầu

| # | Yêu cầu | Ưu tiên | Web | Mobile | Sprint |
|---|---------|---------|-----|--------|--------|
| 1 | Bảng công tháng | Cao | ✓ | — | S1 |
| 2 | Thống kê đi muộn / về sớm | Cao | ✓ | — | S1 |
| 3 | Tỷ lệ chuyên cần theo phòng ban | Trung bình | ✓ | — | S3 |
| 4 | Export Excel / PDF | Trung bình | ✓ | — | S3 |
| 5 | Xem tóm tắt cá nhân | Trung bình | ✓ | ✓ | S3 |

## API Endpoints

| Method | Endpoint | Role |
|--------|----------|------|
| GET | `/v1/reports/attendance?month=2025-05` | HR, Admin |
| GET | `/v1/reports/attendance/export?format=xlsx` | HR, Admin |
| GET | `/v1/reports/late-early` | HR, Admin |
| GET | `/v1/reports/department-summary` | HR, Admin, Manager |
| GET | `/v1/reports/me/summary` | Employee |

## Lưu ý

- Manager chỉ xem báo cáo phòng ban mình
- Cache báo cáo tháng cũ Redis TTL 24h
- Export Excel dùng `exceljs`, PDF dùng `puppeteer`
