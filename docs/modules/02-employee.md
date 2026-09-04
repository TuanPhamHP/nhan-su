# Module 02 — Quản lý hồ sơ nhân viên

## Yêu cầu

| #   | Yêu cầu                                       | Ưu tiên    | Web | Mobile | Sprint |
| --- | --------------------------------------------- | ---------- | --- | ------ | ------ |
| 1   | CRUD nhân viên                                | Cao        | ✓   | —      | S1     |
| 2   | Xem hồ sơ cá nhân                             | Cao        | ✓   | ✓      | S1     |
| 3   | Upload tài liệu                               | Trung bình | ✓   | —      | S3     |
| 4   | Quản lý phòng ban & chức vụ                   | Trung bình | ✓   | —      | S3     |
| 5   | Lịch sử công tác                              | Thấp       | ✓   | —      | S5+    |
| 6   | Quản lý CCCD (bắt buộc) + Hộ chiếu (tuỳ chọn) | Cao        | ✓   | ✓      | S3     |

---

## API Endpoints

| Method | Endpoint | Mô tả | Role |
| --- | --- | --- | --- |
| GET | `/v1/employees/directory` | Danh bạ công ty nhóm theo phòng ban | All |
| GET | `/v1/employees` | Danh sách nhân viên (MANAGER/CHIEF tự lọc theo dept) | All |
| POST | `/v1/employees` | Tạo nhân viên mới | HR, ADMIN |
| GET | `/v1/employees/me` | Hồ sơ cá nhân | All |
| GET | `/v1/employees/me/documents` | Tài liệu của bản thân | All |
| GET | `/v1/employees/:id` | Chi tiết nhân viên | HR, ADMIN, MANAGER, CHIEF, self |
| PATCH | `/v1/employees/:id` | Cập nhật nhân viên | HR, ADMIN |
| DELETE | `/v1/employees/:id` | Vô hiệu hóa (soft delete) | ADMIN |
| POST | `/v1/employees/:id/reset-password` | Reset mật khẩu về dạng `ho_ten@ma_nv` | HR, ADMIN |
| GET | `/v1/employees/:id/documents` | Danh sách tài liệu của nhân viên | HR, ADMIN, MANAGER, CHIEF |
| POST | `/v1/employees/:id/documents` | Upload tài liệu cho nhân viên | HR, ADMIN |
| DELETE | `/v1/employees/:employeeId/documents/:documentId` | Xóa tài liệu | HR, ADMIN |
| GET | `/v1/employees/:employeeId/documents/:documentId/url` | Lấy presigned URL xem/download tài liệu | All |
| GET | `/v1/employees/:employeeId/citizen-id` | Xem CCCD | self · perm `employee:citizen-id:read` |
| POST | `/v1/employees/:employeeId/citizen-id` | Tạo CCCD | perm `employee:citizen-id:create` |
| PATCH | `/v1/employees/:employeeId/citizen-id` | Cập nhật CCCD | perm `employee:citizen-id:update` |
| DELETE | `/v1/employees/:employeeId/citizen-id` | Xoá CCCD | perm `employee:citizen-id:delete` |
| POST | `/v1/employees/:employeeId/citizen-id/photos` | Upload ảnh CCCD (front+back, bắt buộc đủ 2) | perm `employee:citizen-id:update` |
| GET | `/v1/employees/:employeeId/citizen-id/history` | Lịch sử thay đổi CCCD | self · perm `employee:citizen-id:read` |
| GET | `/v1/employees/:employeeId/passport` | Xem hộ chiếu | self · perm `employee:passport:read` |
| POST | `/v1/employees/:employeeId/passport` | Tạo hộ chiếu | perm `employee:passport:create` |
| PATCH | `/v1/employees/:employeeId/passport` | Cập nhật hộ chiếu | perm `employee:passport:update` |
| DELETE | `/v1/employees/:employeeId/passport` | Xoá hộ chiếu | perm `employee:passport:delete` |
| POST | `/v1/employees/:employeeId/passport/photos/:side` | Upload 1 ảnh hộ chiếu (side = front\|back) | perm `employee:passport:update` |
| DELETE | `/v1/employees/:employeeId/passport/photos/:side` | Xoá 1 ảnh hộ chiếu | perm `employee:passport:update` |
| GET | `/v1/meta-data/passport-types` | Danh sách loại hộ chiếu (dropdown) | All |

> Chi tiết DTO, validation, response shape, edge cases: [`docs/bridges/employee-citizen-id-passport.md`](../bridges/employee-citizen-id-passport.md)

---

## POST /v1/employees — Request Body

| Field            | Type              | Bắt buộc | Ghi chú                                       |
| ---------------- | ----------------- | -------- | --------------------------------------------- |
| `fullName`       | string            | ✓        | 2–100 ký tự                                   |
| `email`          | string            | ✓        | Unique, tự động lowercase                     |
| `password`       | string            | ✓        | Mật khẩu tạm thời, tối thiểu 6 ký tự          |
| `joinDate`       | string (ISO 8601) | ✓        | `"2025-01-15"`                                |
| `role`           | `SystemRole`      | ✓        | `ADMIN \| HR \| MANAGER \| CHIEF \| EMPLOYEE` |
| `departmentId`   | number            | —        | ID phòng ban                                  |
| `positionId`     | number            | —        | ID chức vụ                                    |
| `managerId`      | number            | —        | ID quản lý trực tiếp                          |
| `defaultShiftId` | number            | —        | ID ca làm việc mặc định                       |
| `phone`          | string            | —        | Số điện thoại Việt Nam                        |
| `dateOfBirth`    | string (ISO 8601) | —        | `"1990-05-20"`                                |
| `gender`         | string            | —        | `"Nam" \| "Nữ" \| "Khác"`                     |
| `address`        | string            | —        | Địa chỉ                                       |

`UpdateEmployeeDto` = `PartialType(OmitType(CreateEmployeeDto, ['email', 'password']))` — tất cả các field trên (trừ email, password) đều có thể update.

---

## Transformer Output

### EmployeeResponseDto

> Dùng cho: `GET /me`, `GET /:id`, `POST /`, `PATCH /:id`

```typescript
class EmployeeResponseDto {
	id: number;
	employeeCode: string; // "EMP001"
	fullName: string;
	email: string;
	phone: string | null;
	role: string; // SystemRole enum
	status: string; // EmployeeStatus enum
	joinDate: string; // "2025-01-15"
	dateOfBirth: string | null; // "1990-05-20"
	gender: string | null;
	address: string | null;
	avatarUrl: string | null; // presigned URL
	department: { id: number; name: string } | null;
	position: { id: number; name: string } | null;
	manager: { id: number; employeeCode: string; fullName: string } | null;
	defaultShift: { id: number; name: string } | null;
	createdAt: string; // ISO 8601
}
```

### EmployeeSummaryResponseDto

> Dùng cho: `GET /` (danh sách)

```typescript
class EmployeeSummaryResponseDto {
	id: number;
	employeeCode: string;
	fullName: string;
	email: string;
	department: { id: number; name: string } | null;
	position: { id: number; name: string } | null;
	status: string;
	role: string;
}
```

### DirectoryDepartmentGroupDto

> Dùng cho: `GET /directory`

```typescript
class DirectoryDepartmentGroupDto {
	departmentId: number;
	departmentName: string;
	members: DirectoryMemberResponseDto[];
}

class DirectoryMemberResponseDto {
	id: number;
	employeeCode: string;
	fullName: string;
	phone: string | null;
	avatarUrl: string | null; // raw S3 URL (chưa presign)
	role: string; // SystemRole enum
	position: string | null; // tên chức vụ (string, không phải object)
	isManager: boolean; // true nếu là trưởng phòng (managedDepartment != null)
}
```

---

## Lưu ý

- Khi tạo nhân viên → tự động khởi tạo số ngày phép năm (`leaveService.autoInitAnnualLeave`)
- Không xóa cứng — `status = INACTIVE` (soft delete)
- File upload: max 10MB, chấp nhận PDF/DOCX/JPG/PNG
- `avatarUrl` ở các endpoint đơn lẻ (`/me`, `/:id`) được presign trước khi trả về; endpoint `/directory` chưa presign
- Reset password tạo mật khẩu dạng `ho_ten@ma_nhanvien` (bỏ dấu) và gửi email thông báo
