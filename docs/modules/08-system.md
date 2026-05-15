# Module 08 — Cài đặt hệ thống

## Yêu cầu

| # | Yêu cầu | Ưu tiên | Web | Sprint |
|---|---------|---------|-----|--------|
| 1 | Cấu hình email SMTP / Resend | Cao | ✓ | S1 |
| 2 | Cấu hình ca làm việc & ngày nghỉ | Cao | ✓ | S1 |
| 3 | Quản lý phòng ban | Trung bình | ✓ | S3 |
| 4 | Cấu hình loại phép | Trung bình | ✓ | S3 |

## API Endpoints

| Method | Endpoint | Role |
|--------|----------|------|
| GET | `/v1/settings` | Admin |
| PATCH | `/v1/settings` | Admin |
| POST | `/v1/settings/email/test` | Admin |
| GET | `/v1/holidays` | All |
| POST | `/v1/holidays` | Admin |
| DELETE | `/v1/holidays/:id` | Admin |

## Environment Variables

```env
NODE_ENV=production
PORT=3000
APP_URL=https://hr.company.com
DATABASE_URL=postgresql://user:pass@localhost:5432/hrdb
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
REDIS_URL=redis://localhost:6379
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=hr@company.com
EMAIL_FROM_NAME=HR System
S3_ENDPOINT=https://s3.amazonaws.com
S3_BUCKET=hr-documents
S3_ACCESS_KEY=xxx
S3_SECRET_KEY=xxx
S3_REGION=ap-southeast-1
FRONTEND_URL=https://hr.company.com
```
