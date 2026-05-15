# HR System — Tài liệu dự án

## Tech Stack (đã chốt)

| Layer | Tech | Version |
|-------|------|---------|
| Mobile | Flutter | 3.x |
| Web Frontend | Nuxt | 4.x |
| Backend | NestJS (Node.js) | 10.x |
| Database | PostgreSQL | 16.x |
| ORM | Prisma | 5.x |
| Queue | BullMQ + Redis | 5.x |
| Email | Resend | — |
| Auth | JWT + Passport.js | — |

## Cấu trúc tài liệu

```
docs/
├── README.md                        ← File này
│
├── backend/
│   ├── architecture.md              ← Layer architecture, project structure
│   ├── coding-rules.md              ← Quy tắc lập trình bắt buộc
│   ├── api-conventions.md           ← Response format, error codes
│   ├── transformer-dto-rules.md     ← Chuẩn transformer + DTO
│   └── prisma-repository-rules.md  ← Cách dùng Prisma + Repository pattern
│
├── frontend/
│   └── nuxt-conventions.md          ← Chuẩn Nuxt 4, composables, API calls
│
├── mobile/
│   └── flutter-conventions.md      ← Chuẩn Flutter, folder structure
│
├── database/
│   └── schema.md                    ← Prisma schema đầy đủ
│
└── modules/
    ├── 01-auth.md
    ├── 02-employee.md
    ├── 03-attendance.md
    ├── 04-leave.md
    ├── 05-notification.md
    ├── 06-report.md
    ├── 07-payroll.md
    └── 08-system.md
```

## Roles & Permissions

| Role | Quyền |
|------|-------|
| `ADMIN` | Toàn quyền |
| `HR` | Quản lý nhân viên, chấm công, nghỉ phép, báo cáo |
| `MANAGER` | Duyệt đơn phép team, xem báo cáo team |
| `EMPLOYEE` | Hồ sơ cá nhân, check-in/out, xin phép, xem lương |

## Sprint Plan

| Sprint | Nội dung | Thời gian |
|--------|----------|-----------|
| S1–S2 | Auth, hồ sơ nhân viên, chấm công, nghỉ phép cơ bản, email core | 4 tuần |
| S3–S4 | Báo cáo, bảng lương, cài đặt, tính năng nâng cao | 4 tuần |
| S5+ | Lịch sử công tác, phiếu lương PDF, tối ưu hiệu suất | Tiếp theo |
