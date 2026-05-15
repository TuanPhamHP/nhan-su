# Module 02 — Quản lý hồ sơ nhân viên

## Yêu cầu

| # | Yêu cầu | Ưu tiên | Web | Mobile | Sprint |
|---|---------|---------|-----|--------|--------|
| 1 | CRUD nhân viên | Cao | ✓ | — | S1 |
| 2 | Xem hồ sơ cá nhân | Cao | ✓ | ✓ | S1 |
| 3 | Upload tài liệu | Trung bình | ✓ | — | S3 |
| 4 | Quản lý phòng ban & chức vụ | Trung bình | ✓ | — | S3 |
| 5 | Lịch sử công tác | Thấp | ✓ | — | S5+ |

## API Endpoints

| Method | Endpoint | Mô tả | Role |
|--------|----------|-------|------|
| GET | `/v1/employees` | Danh sách | HR, Admin |
| POST | `/v1/employees` | Tạo mới | HR, Admin |
| GET | `/v1/employees/me` | Hồ sơ cá nhân | All |
| GET | `/v1/employees/:id` | Chi tiết | HR, Admin, self |
| PATCH | `/v1/employees/:id` | Cập nhật | HR, Admin |
| DELETE | `/v1/employees/:id` | Vô hiệu hóa | Admin |
| POST | `/v1/employees/:id/documents` | Upload tài liệu | HR, Admin |
| GET | `/v1/departments` | Danh sách phòng ban | All |
| POST | `/v1/departments` | Tạo phòng ban | Admin |

## Transformer output

```typescript
// employee.transformer.ts
export interface EmployeeResponse {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  joinDate: string;
  department: { id: string; name: string } | null;
  position: { id: string; name: string } | null;
  createdAt: string;
}

export interface EmployeeSummaryResponse {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  department: string | null;
  status: string;
}
```

## Lưu ý

- Khi tạo nhân viên mới → trigger email chào mừng (module 05)
- Không xóa cứng — `status = INACTIVE`
- File upload: max 10MB, chấp nhận PDF/JPG/PNG
