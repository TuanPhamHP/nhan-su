# Backend — API Conventions

## Base URL

```
Production:  https://api.hr.company.com/v1
Development: http://localhost:3000/v1
```

## Authentication

Mọi request (trừ public endpoints) cần header:

```
Authorization: Bearer <accessToken>
```

## HTTP Methods

| Method | Dùng cho |
|--------|---------|
| `GET` | Lấy dữ liệu |
| `POST` | Tạo mới |
| `PATCH` | Cập nhật một phần |
| `DELETE` | Xoá / vô hiệu hoá |

Không dùng `PUT`.

## Naming — URL

- `kebab-case` cho URL: `/leave-requests`, `/work-shifts`
- Plural noun cho collection: `/employees`, `/attendance-records`
- Nested resource khi có quan hệ rõ ràng: `/employees/:id/documents`
- Action endpoints dùng verb sau resource: `/leave-requests/:id/approve`

## Response Format

Mọi response đều wrap bởi `ResponseInterceptor`:

```typescript
// Single resource
{ "success": true, "data": { ... } }

// Collection có pagination
{ "success": true, "data": [...], "meta": { "page": 1, "limit": 20, "total": 150, "totalPages": 8 } }

// Error
{ "success": false, "error": { "code": "ERROR_CODE", "message": "..." } }
```

## HTTP Status Codes

| Code | Khi nào |
|------|---------|
| `200` | GET, PATCH thành công |
| `201` | POST tạo resource mới thành công |
| `400` | Validation lỗi, input không hợp lệ |
| `401` | Chưa xác thực / token hết hạn |
| `403` | Không đủ quyền |
| `404` | Không tìm thấy resource |
| `409` | Conflict — trùng dữ liệu |
| `500` | Server error |

## Error Codes

| Code | Module | HTTP |
|------|--------|------|
| `AUTH_INVALID_CREDENTIALS` | Auth | 401 |
| `AUTH_ACCOUNT_LOCKED` | Auth | 401 |
| `AUTH_TOKEN_EXPIRED` | Auth | 401 |
| `AUTH_FORBIDDEN` | Auth | 403 |
| `EMPLOYEE_NOT_FOUND` | Employee | 404 |
| `EMPLOYEE_EMAIL_EXISTS` | Employee | 409 |
| `EMPLOYEE_CODE_EXISTS` | Employee | 409 |
| `ATTENDANCE_ALREADY_CHECKED_IN` | Attendance | 409 |
| `ATTENDANCE_NOT_CHECKED_IN` | Attendance | 400 |
| `ATTENDANCE_IP_NOT_ALLOWED` | Attendance | 403 |
| `LEAVE_NOT_FOUND` | Leave | 404 |
| `LEAVE_OVERLAP` | Leave | 409 |
| `LEAVE_INSUFFICIENT_BALANCE` | Leave | 400 |
| `LEAVE_CANNOT_CANCEL` | Leave | 400 |
| `LEAVE_INVALID_DATE_RANGE` | Leave | 400 |
| `PAYROLL_NOT_FOUND` | Payroll | 404 |
| `PAYROLL_ALREADY_PUBLISHED` | Payroll | 409 |

## Pagination

```
GET /employees?page=1&limit=20
GET /attendance?page=1&limit=50&month=2025-05
```

Default: `page=1`, `limit=20`, max `limit=100`.

## Filtering & Sorting

```
GET /employees?departmentId=xxx&status=ACTIVE&search=nguyen
GET /leave-requests?status=PENDING&month=2025-05
GET /attendance?employeeId=xxx&date=2025-05-15
GET /employees?sortBy=fullName&sortOrder=asc
```

## Date Format

- Tất cả dates trong request/response dùng **ISO 8601**
- Date only: `"2025-05-15"`
- DateTime: `"2025-05-15T08:00:00.000Z"`
- Timezone: UTC trong DB và API, frontend tự convert sang local time

## Versioning

API version trong URL: `/v1/...`

Khi break changes cần version mới: `/v2/...` — không xoá `/v1` cho đến khi tất cả client đã migrate.
