> Source of truth cho toàn bộ permission code trong hệ thống. Đồng bộ với `PERMISSION_DEFINITIONS` trong [prisma/seed-permissions.ts](../../../prisma/seed-permissions.ts).
>
> **Idempotent seed** — chạy `npm run db:seed:permissions` an toàn nhiều lần, KHÔNG xoá employee/data khác. Chỉ thêm permission/role/employee-role còn thiếu.
>
> Đọc trước: [authorization-model.md](authorization-model.md) — mô hình Hybrid + rule preset.
>
> Cập nhật danh sách này **mỗi khi**: thêm module mới có endpoint cần permission, thêm endpoint mới cần perm khác, hoặc thay đổi preset cho Role mặc định.

# Permission Master List

Tổng cộng: **78 permission code**, chia theo module. Được seed vào bảng `Permission` khi chạy `prisma db seed`.

---

## 1. Nguyên tắc đọc bảng

- Cột **Code**: dùng làm giá trị cho `@RequirePermissions('...')` trong controller.
- Cột **Name / Group**: hiển thị trong UI cho HR/ADMIN khi cấu hình Role.
- Cột **HR / DIR / MGR / CHF / EMP**: ✓ nếu Role mặc định đó được cấp preset permission này. `-` nếu không.
- **ADMIN không có cột** — bypass toàn bộ ở [permissions.guard.ts](../../../src/common/guards/permissions.guard.ts) (nhưng vẫn được seed full permission để hiển thị trong UI).
- **SELF-SERVICE** (không cần permission): endpoint self-service chỉ cần `JwtAuthGuard`, xem section §4.

---

## 2. Bảng master (theo group)

### 2.1. Nhân viên

| Code | Name | HR | DIR | MGR | CHF | EMP |
|---|---|:-:|:-:|:-:|:-:|:-:|
| `employee:read` | Xem nhân viên | ✓ | ✓ | ✓ | ✓ | ✓ |
| `employee:create` | Tạo nhân viên | ✓ | - | - | - | - |
| `employee:update` | Chỉnh sửa nhân viên | ✓ | - | - | - | - |
| `employee:delete` | Vô hiệu hóa nhân viên | ✓ | - | - | - | - |
| `employee:import` | Import hàng loạt nhân sự từ Excel | ✓ | - | - | - | - |

### 2.2. Phòng ban

| Code | Name | HR | DIR | MGR | CHF | EMP |
|---|---|:-:|:-:|:-:|:-:|:-:|
| `department:read` | Xem phòng ban | ✓ | ✓ | ✓ | ✓ | ✓ |
| `department:create` | Tạo phòng ban | ✓ | - | - | - | - |
| `department:update` | Chỉnh sửa phòng ban | ✓ | - | - | - | - |
| `department:delete` | Vô hiệu hóa phòng ban | ✓ | - | - | - | - |
| `department:manage` | Chuyển trưởng phòng | ✓ | - | - | - | - |

### 2.3. Chức vụ

| Code | Name | HR | DIR | MGR | CHF | EMP |
|---|---|:-:|:-:|:-:|:-:|:-:|
| `position:read` | Xem chức vụ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `position:create` | Tạo chức vụ | ✓ | - | - | - | - |
| `position:update` | Chỉnh sửa chức vụ | ✓ | - | - | - | - |
| `position:delete` | Vô hiệu hóa chức vụ | ✓ | - | - | - | - |

### 2.4. Phân quyền (Role & Permission)

| Code | Name | HR | DIR | MGR | CHF | EMP |
|---|---|:-:|:-:|:-:|:-:|:-:|
| `role:read` | Xem vai trò | - | - | - | - | - |
| `role:create` | Tạo vai trò | - | - | - | - | - |
| `role:update` | Chỉnh sửa vai trò | - | - | - | - | - |
| `role:delete` | Xóa vai trò | - | - | - | - | - |
| `role:assign` | Gán người dùng vào vai trò | - | - | - | - | - |

> Chỉ ADMIN quản lý Role/Permission (bypass). HR không có mặc định — muốn cấp thì thêm thủ công qua UI.

### 2.5. Chấm công

| Code | Name | HR | DIR | MGR | CHF | EMP |
|---|---|:-:|:-:|:-:|:-:|:-:|
| `attendance:read` | Xem chấm công toàn công ty/phòng ban | ✓ | ✓ | ✓ | ✓ | - |
| `attendance:manage` | Chỉnh sửa bản ghi chấm công thủ công | ✓ | - | - | - | - |

> Toàn bộ endpoint check-in / check-out / xem chấm công cá nhân là **SELF-SERVICE**.

### 2.6. Nghỉ phép

| Code | Name | HR | DIR | MGR | CHF | EMP |
|---|---|:-:|:-:|:-:|:-:|:-:|
| `leave:read` | Xem đơn nghỉ phép | ✓ | ✓ | ✓ | ✓ | - |
| `leave:create` | Tạo đơn nghỉ phép | ✓ | ✓ | ✓ | ✓ | ✓ |
| `leave:approve` | Duyệt/từ chối đơn nghỉ phép | ✓ | ✓ | ✓ | ✓ | - |
| `leave-balance:read` | Xem số dư ngày phép | ✓ | ✓ | ✓ | - | - |
| `leave-balance:manage` | Cấp phát/điều chỉnh ngày phép | ✓ | - | - | - | - |
| `leave-type:create` | Tạo loại phép | ✓ | - | - | - | - |
| `leave-type:update` | Chỉnh sửa/tắt loại phép | ✓ | - | - | - | - |

> Endpoint tạo đơn phép cá nhân là **SELF-SERVICE** — không cần `leave:create` nếu chỉ tạo cho chính mình. Preset EMPLOYEE giữ `leave:create` để tương thích khi ai cần tạo hộ (edge case).

### 2.7. Đơn công tác

| Code | Name | HR | DIR | MGR | CHF | EMP |
|---|---|:-:|:-:|:-:|:-:|:-:|
| `business-trip:read` | Xem đơn công tác (list admin view) | ✓ | ✓ | ✓ | ✓ | - |
| `business-trip:approve` | Duyệt/từ chối đơn công tác | ✓ | ✓ | ✓ | ✓ | - |
| `business-trip:edit` | HR cập nhật phương tiện/vé cho đơn | ✓ | - | - | - | - |

### 2.8. Đơn văn bản (general request)

| Code | Name | HR | DIR | MGR | CHF | EMP |
|---|---|:-:|:-:|:-:|:-:|:-:|
| `general-request:read` | Xem tất cả đơn văn bản | ✓ | ✓ | ✓ | ✓ | - |
| `general-request:approve` | Duyệt đơn văn bản (endpoint pending-for-me) | ✓ | ✓ | ✓ | ✓ | - |
| `general-request:create-template` | Tạo mẫu văn bản | ✓ | - | - | - | - |
| `general-request:update-template` | Chỉnh sửa mẫu văn bản | ✓ | - | - | - | - |

### 2.9. Đơn làm online

| Code | Name | HR | DIR | MGR | CHF | EMP |
|---|---|:-:|:-:|:-:|:-:|:-:|
| `online-work:read` | Xem đơn làm online | ✓ | ✓ | ✓ | ✓ | ✓ |
| `online-work:create` | Tạo đơn làm online | ✓ | ✓ | ✓ | ✓ | ✓ |
| `online-work:approve` | Duyệt đơn làm online (mọi cấp — override chain) | ✓ | ✓ | ✓ | ✓ | - |
| `online-work:report` | Xem/export báo cáo làm online | ✓ | ✓ | ✓ | ✓ | - |

> Endpoint approve/reject gate bằng `online-work:approve`. Service ưu tiên **assigned approver identity** (`approverL1Id`/`approverL2Id`) trong workflow; ai có permission override được identity check.

### 2.10. Vi phạm chuyên cần

| Code | Name | HR | DIR | MGR | CHF | EMP |
|---|---|:-:|:-:|:-:|:-:|:-:|
| `violation:read` | Xem phiếu giải trình vi phạm | ✓ | ✓ | ✓ | ✓ | ✓ |
| `violation:create` | Tạo phiếu giải trình vi phạm | ✓ | ✓ | ✓ | ✓ | ✓ |
| `violation:approve` | Duyệt/từ chối phiếu vi phạm (mọi cấp) | ✓ | ✓ | ✓ | ✓ | - |

> Endpoint approve/reject gate bằng `violation:approve`. Cả L1 (`assignedReviewerId`) và L2 (`approverL2Id`) chung 1 permission. Service ưu tiên identity → permission override.

### 2.11. Đơn tăng ca (Overtime)

| Code | Name | HR | DIR | MGR | CHF | EMP |
|---|---|:-:|:-:|:-:|:-:|:-:|
| `overtime:read` | Xem đơn tăng ca | ✓ | ✓ | ✓ | ✓ | ✓ |
| `overtime:create` | Tạo đơn tăng ca | ✓ | ✓ | ✓ | ✓ | ✓ |
| `overtime:approve` | Duyệt/từ chối đơn tăng ca | ✓ | ✓ | ✓ | ✓ | - |

> **HR đã được phép duyệt OT** (trước đây bị block cứng). Service check assigned approver identity → permission override.

### 2.12. Đơn bù công

| Code | Name | HR | DIR | MGR | CHF | EMP |
|---|---|:-:|:-:|:-:|:-:|:-:|
| `makeup:read` | Xem đơn bù công | ✓ | ✓ | ✓ | ✓ | ✓ |
| `makeup:create` | Tạo đơn bù công | ✓ | ✓ | ✓ | ✓ | ✓ |
| `makeup:approve` | Duyệt/từ chối đơn bù công | ✓ | ✓ | ✓ | ✓ | - |

> Endpoint approve/reject gate bằng `makeup:approve`. Service check `assignedApproverId` → permission override.

### 2.12. Thông báo công ty

| Code | Name | HR | DIR | MGR | CHF | EMP |
|---|---|:-:|:-:|:-:|:-:|:-:|
| `announcement:read-admin` | Xem danh sách thông báo (admin view) | ✓ | ✓ | ✓ | ✓ | - |
| `announcement:create` | Tạo thông báo công ty | ✓ | - | - | - | - |
| `announcement:delete` | Xóa/thu hồi thông báo | ✓ | - | - | - | - |

> Toàn bộ endpoint `/my`, đọc chi tiết thông báo của mình, react, comment, mark-read là **SELF-SERVICE**.

### 2.13. Địa điểm chấm công

| Code | Name | HR | DIR | MGR | CHF | EMP |
|---|---|:-:|:-:|:-:|:-:|:-:|
| `check-in-location:read` | Xem địa điểm chấm công | ✓ | - | - | - | - |
| `check-in-location:create` | Tạo địa điểm chấm công | ✓ | - | - | - | - |
| `check-in-location:update` | Chỉnh sửa địa điểm chấm công | ✓ | - | - | - | - |
| `check-in-location:delete` | Vô hiệu hóa địa điểm chấm công | ✓ | - | - | - | - |
| `check-in-location:assign` | Gán nhân viên vào địa điểm | ✓ | - | - | - | - |

### 2.14. Ngày lễ

| Code | Name | HR | DIR | MGR | CHF | EMP |
|---|---|:-:|:-:|:-:|:-:|:-:|
| `holiday:read` | Xem chi tiết ngày lễ | ✓ | - | - | - | - |
| `holiday:create` | Tạo ngày lễ | ✓ | - | - | - | - |
| `holiday:update` | Chỉnh sửa ngày lễ | ✓ | - | - | - | - |
| `holiday:delete` | Xóa ngày lễ | ✓ | - | - | - | - |

> `GET /public-holidays` (list) là **Public** — mọi user đã login đều đọc được, không cần permission.

### 2.15. Ca làm việc

| Code | Name | HR | DIR | MGR | CHF | EMP |
|---|---|:-:|:-:|:-:|:-:|:-:|
| `work-shift:create` | Tạo ca làm việc | ✓ | - | - | - | - |
| `work-shift:update` | Chỉnh sửa ca làm việc | ✓ | - | - | - | - |
| `work-shift:delete` | Vô hiệu hóa ca làm việc | ✓ | - | - | - | - |

> `GET /work-shifts` là **Public** — không cần permission.

### 2.16. Lịch ca

| Code | Name | HR | DIR | MGR | CHF | EMP |
|---|---|:-:|:-:|:-:|:-:|:-:|
| `shift-schedule:read` | Xem lịch ca toàn công ty | ✓ | - | - | - | - |
| `shift-schedule:assign` | Gán/cập nhật lịch ca cho nhân viên | ✓ | - | - | - | - |
| `shift-schedule:delete` | Xóa lịch ca theo ngày | ✓ | - | - | - | - |

> `GET /shift-schedules/me` là **SELF-SERVICE**.

### 2.17. Hợp đồng

| Code | Name | HR | DIR | MGR | CHF | EMP |
|---|---|:-:|:-:|:-:|:-:|:-:|
| `contract:read` | Xem hợp đồng | ✓ | ✓ | ✓ | ✓ | - |
| `contract:create` | Tạo hợp đồng | ✓ | - | - | - | - |
| `contract:update` | Chỉnh sửa hợp đồng | ✓ | - | - | - | - |
| `contract:activate` | Kích hoạt hợp đồng | ✓ | - | - | - | - |
| `contract:terminate` | Chấm dứt hợp đồng | ✓ | - | - | - | - |
| `contract:import` | Import hàng loạt hợp đồng từ Excel | ✓ | - | - | - | - |

### 2.18. BHXH

| Code | Name | HR | DIR | MGR | CHF | EMP |
|---|---|:-:|:-:|:-:|:-:|:-:|
| `social-insurance:read` | Xem thông tin BHXH toàn công ty | ✓ | - | - | - | - |
| `social-insurance:update` | Cập nhật thông tin BHXH | ✓ | - | - | - | - |

> Xem BHXH của chính mình là **SELF-SERVICE**.

### 2.19. Bảng lương

| Code | Name | HR | DIR | MGR | CHF | EMP |
|---|---|:-:|:-:|:-:|:-:|:-:|
| `payroll:read` | Xem bảng lương | ✓ | - | - | - | - |
| `payroll:manage` | Quản lý bảng lương | ✓ | - | - | - | - |
| `payroll:publish` | Phát hành bảng lương | ✓ | - | - | - | - |

> Module payroll chưa có endpoint — permission được reserve sẵn cho phase sau.

### 2.20. Dashboard & Báo cáo

| Code | Name | HR | DIR | MGR | CHF | EMP |
|---|---|:-:|:-:|:-:|:-:|:-:|
| `dashboard:read` | Xem dashboard tổng hợp | ✓ | ✓ | ✓ | ✓ | - |
| `report:read` | Xem tất cả báo cáo | ✓ | ✓ | ✓ | ✓ | - |
| `report:export` | Xuất tất cả báo cáo ra Excel | ✓ | ✓ | ✓ | ✓ | - |

> Scope filter (MANAGER chỉ thấy phòng mình) do Service tự lọc dựa vào `authUser.role` — không encode vào permission. Xem [authorization-model.md §5](authorization-model.md).
>
> Nếu sau này cần granular hơn (VD: Kế toán chỉ được xem báo cáo lương, không được xem báo cáo chấm công) → split thành `report:attendance`, `report:leave`, `report:payroll`, ... — nằm ngoài scope migration đợt đầu.

### 2.21. Hệ thống

| Code | Name | HR | DIR | MGR | CHF | EMP |
|---|---|:-:|:-:|:-:|:-:|:-:|
| `system-log:read` | Xem lịch sử thao tác hệ thống | ✓ | - | - | - | - |
| `setting:read` | Xem cài đặt hệ thống | ✓ | - | - | - | - |
| `setting:update` | Chỉnh sửa cài đặt hệ thống | ✓ | - | - | - | - |

---

## 3. Convention naming

Format: `<module>:<action>`

Xem chi tiết trong [authorization-model.md §6](authorization-model.md).

Action đã dùng:
- `read`, `create`, `update`, `delete` — CRUD chuẩn
- `manage` — quản lý ở mức cao (VD: `attendance:manage` = edit thủ công, `payroll:manage`)
- `approve` — duyệt đơn (endpoint list "pending-for-me" hoặc endpoint approve có `@Roles`)
- `assign` — gán resource cho user (VD: `role:assign`, `check-in-location:assign`, `shift-schedule:assign`)
- `edit` — chỉnh sửa đặc thù (VD: `business-trip:edit` = HR update vé)
- `report`, `export` — xem/xuất báo cáo
- `publish` — công bố (payroll)
- `create-template`, `update-template` — quản lý template (general-request)
- `read-admin` — xem list admin view (không phải "của mình")

---

## 4. Endpoint SELF-SERVICE (không cần permission)

Các endpoint dưới đây chỉ cần `JwtAuthGuard` — service tự check ownership/routing dựa vào `authUser.id` hoặc `assignedApproverId`. **KHÔNG** gán `@RequirePermissions()` cho các endpoint này.

### Category 1 — Xem/tạo của chính mình

- `GET /*/me`, `GET /*/me/*` — xem của cá nhân
- `POST /*` khi tạo đơn cho chính mình (leave, business-trip, general-request, overtime, online-work, makeup, violation)
- `PATCH /*/cancel` — huỷ đơn của chính mình
- `PATCH /*/submit`, `PATCH /*/draft` — chuyển state đơn của chính mình
- `PATCH /employees/me/*` — cập nhật profile cá nhân
- `PATCH /auth/change-password` — đổi mật khẩu

### Category 2 — Duyệt đơn khi là approver cụ thể

- `PATCH /makeup-attendance/:id/approve|reject` — service check `assignedApproverId === user.id`
- `PATCH /overtime-requests/:id/approve|reject` — service check `assignedApproverId`
- `PATCH /online-work-requests/:id/approve-l1|l2|l3|reject` — service check level-approver
- `PATCH /violation-requests/:id/approve|reject` — service check L1/L2 approver
- `PATCH /general-requests/:id/approve|reject` — service check approver chain

> Endpoint approve chỉ có `@Roles(...)` cho các module `leave`, `business-trip` mới cần permission. Các module còn lại có thêm endpoint `GET /*/pending-for-me` (list "đơn đang chờ mình duyệt") cần perm `*:approve` để render menu.

### Category 3 — Approval list dashboard

- `GET /approval/counts`, `GET /approval/leave-requests`, `GET /approval/business-trips`, `GET /approval/makeup-attendance`, `GET /approval/overtime-requests`, `GET /approval/online-work-requests`, `GET /approval/violation-requests` — service tự filter theo `assignedApproverId = user.id`

### Category 4 — Comment/react thông báo

- `PATCH /company-announcements/:id/read`, `POST /*/react`, `GET/POST /*/comments`, `DELETE /*/comments/:id` — user chỉ tương tác trên thông báo họ nhận được

### Category 5 — Metadata / Public

- `GET /permissions`, `GET /roles/:id/employees`, `GET /leave-types`, `GET /public-holidays`, `GET /work-shifts`, `GET /departments`, `GET /departments/:id`, `GET /positions`, `GET /positions/:id`, `GET /employees` (directory), `GET /company-announcements/types` — mọi user đăng nhập đều đọc được, không cần permission

---

## 5. Rule cập nhật danh sách này

Bất kỳ ai thêm/sửa endpoint đều **BẮT BUỘC**:

1. Nếu endpoint mới **cần permission**:
   - Kiểm tra permission code đã có trong bảng chưa. Nếu có → dùng lại.
   - Nếu chưa có → thêm entry vào `PERMISSION_DEFINITIONS` trong [prisma/seed-permissions.ts](../../../prisma/seed-permissions.ts) VÀ thêm dòng vào bảng tương ứng ở file này.
   - Update preset (`HR_PERMS`, `DIRECTOR_PERMS`, ...) cho Role mặc định nếu cần.
   - Chạy `npm run db:seed:permissions` local để verify — idempotent, không mất data.

2. Nếu endpoint mới là **SELF-SERVICE**:
   - Không đụng `PERMISSION_DEFINITIONS`.
   - Thêm vào section §4 nếu là pattern mới.

3. Nếu **rename** permission code:
   - Cân nhắc kỹ — sẽ break tất cả Role đã cấu hình trong DB production.
   - Cần migration script để re-assign role.

4. `npm run db:seed:permissions` **an toàn** trên mọi môi trường:
   - KHÔNG xoá permission/role/employee-role đã có.
   - Chỉ thêm mới permission còn thiếu, cập nhật `name`/`group` cho permission có sẵn (giữ nguyên `code`).
   - Chỉ thêm mới permission vào Role default nếu preset có thêm code mới — KHÔNG xoá permission HR đã custom.
   - Chỉ gán Role default cho employee nếu employee chưa có Role default tương ứng.

5. `npm run db:seed` (full seed) **CHỈ chạy trên môi trường local mới khởi tạo** — nó chạy `cleanup()` xoá toàn bộ employee/department/... rồi tạo lại. KHÔNG chạy trên staging/production.

---

## 6. Sync verification

Sau khi rerun seed local, verify bằng:

```bash
# Đếm số permission trong DB — phải bằng số dòng trong PERMISSION_DEFINITIONS (65)
psql $DATABASE_URL -c "SELECT COUNT(*) FROM permission;"

# Đếm số Role default — phải bằng 6
psql $DATABASE_URL -c "SELECT id, name FROM role WHERE type = 'DEFAULT' ORDER BY id;"

# Verify permission của HR role
psql $DATABASE_URL -c "
  SELECT p.code
  FROM role r
  JOIN role_permission rp ON rp.role_id = r.id
  JOIN permission p ON p.id = rp.permission_id
  WHERE r.name = 'Nhân sự'
  ORDER BY p.code;
"
```

Hoặc dùng UI `/api/docs` gọi `GET /v1/permissions` để xem list, `GET /v1/roles` để xem Role default.
