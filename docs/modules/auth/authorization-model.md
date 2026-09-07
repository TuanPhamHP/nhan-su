> Trạng thái: **Draft** — bản thiết kế, chưa apply vào code. Cần chốt danh sách permission master và thứ tự migrate trước khi triển khai.

# Authorization Model — Hybrid `SystemRole` + `Permission`

Tài liệu này mô tả **kiến trúc phân quyền** của hệ thống HR sau khi migrate. Đây là source of truth cho mọi decision liên quan đến "ai được làm gì" trong codebase.

---

## 1. Vấn đề & Bối cảnh

Hệ thống hiện tại đang **song song 2 cơ chế** nhưng chỉ dùng 1:

| Cơ chế | Trạng thái |
|---|---|
| `SystemRole` (enum cứng: `ADMIN` / `HR` / `MANAGER` / `EMPLOYEE`) + `@Roles()` + `RolesGuard` | Đang gác **~193 chỗ** trên toàn bộ business endpoint |
| `Role` (bảng dynamic) + `Permission` + `RolePermission` + `@RequirePermissions()` + `PermissionsGuard` | Chỉ áp dụng ở **duy nhất** module `roles` (8 endpoint tự quản lý chính mình) |

Kết quả: FE nhận được `permissions[]` từ `/v1/auth/me` nhưng BE **không thực sự enforce** — đổi permission trong Role không thay đổi được quyền gọi API nghiệp vụ.

Mục tiêu: giữ SystemRole cho việc nó làm tốt (persona + scope filter) và bổ sung Permission cho việc SystemRole làm không tốt (cấu hình linh hoạt "ai được duyệt / ai được export / ai được xem báo cáo").

---

## 2. Nguyên tắc thiết kế

### 2.1. Tách bạch 3 khái niệm

Đây là mấu chốt — nhiều dự án nhầm 3 thứ này với nhau và bị rối:

| Khái niệm | Trả lời câu hỏi | Cơ chế |
|---|---|---|
| **Persona / Identity** | "User này là loại người dùng nào trong hệ thống?" | `SystemRole` — cột cứng trên `Employee` |
| **Capability / Permission** | "User có được phép thực hiện hành động X không?" | Permission code — cấu hình động qua Role table |
| **Authorization on resource** | "Resource cụ thể này (đơn A, báo cáo B) có phải do user này quản không?" | Business logic trong Service — dựa vào org structure (department.managerId, chain, ownership...) |

Ví dụ minh hoạ với đơn nghỉ phép:

- **Persona**: Nguyễn Văn A là `EMPLOYEE`
- **Capability**: A có permission `leave:approve` (được cấp thủ công vì sếp uỷ quyền)
- **Authorization on resource**: đơn LR-123 có `approverId = A.id` → A mới được duyệt đơn này. Đơn LR-456 có `approverId = B.id` → A **không được** duyệt dù A vẫn có `leave:approve`.

3 tầng check này **KHÔNG được gộp**.

### 2.2. Approval Routing ≠ Permission

Routing "đơn X giao cho ai duyệt" **không phải** bài toán permission. Nó phụ thuộc:

- `Department.managerId` — trưởng phòng của phòng ban đơn xuất phát
- Chain phòng ban (nếu có) — chain leader
- HR level — cấp phê duyệt cuối
- Rule đặc thù (đơn > 3 ngày phải lên HR, etc.)

Toàn bộ logic routing **giữ nguyên trong Service**, không migrate sang permission.

---

## 3. Kiến trúc Hybrid

### 3.1. Sơ đồ tầng check

```
Request
   │
   ▼
┌────────────────────────┐
│ JwtAuthGuard           │  → có JWT hợp lệ không?
└────────────────────────┘
   │
   ▼
┌────────────────────────┐
│ PermissionsGuard       │  → có permission được yêu cầu không?
│  (ADMIN bypass)        │      (@RequirePermissions('leave:approve'))
└────────────────────────┘
   │
   ▼
┌────────────────────────┐
│ Service                │  → resource cụ thể này có phải của user không?
│  - routing check       │      (leaveRequest.approverId === user.id)
│  - scope filter        │      (query filter theo SystemRole)
│  - business rule       │
└────────────────────────┘
```

Guard chỉ trả lời "có được vào endpoint không". Service trả lời "được làm gì với dữ liệu cụ thể".

### 3.2. Trách nhiệm từng thành phần

| Thành phần | Dùng để | Nguồn dữ liệu |
|---|---|---|
| `SystemRole` | (1) ADMIN bypass toàn bộ permission check trong guard<br>(2) Scope filter trong Service (self / department / all)<br>(3) Xác định "persona mặc định" khi seed | `Employee.systemRole` — cột cứng NOT NULL |
| `Permission` codes | (1) Gate endpoint qua `@RequirePermissions()`<br>(2) FE dùng để show/hide button/menu | Union permissions từ chain `EmployeeRole → Role → RolePermission → Permission` |
| **Approval routing** | Đơn cụ thể có phải giao user này duyệt không | Business logic trong Service (giữ nguyên, không đổi) |

### 3.3. Nguồn của `authUser` trong JWT

Sau khi login, JWT payload chứa:

```typescript
interface AuthenticatedUser {
  id: number;             // Employee.id
  email: string;          // Employee.email
  role: SystemRole;       // ← Employee.systemRole (cột cứng)
  permissions: string[];  // ← union từ EmployeeRole → Role → RolePermission
}
```

- `role` (SystemRole) là persona cứng — 1 employee **luôn** có đúng 1 SystemRole.
- `permissions` là union tất cả permission code từ mọi Role động được gán qua `EmployeeRole`.

---

## 4. Quan hệ `SystemRole` ↔ `Role` (dynamic)

**Chốt: SystemRole là persona cứng, Role động chỉ bổ sung permission.**

### 4.1. Rule

- `Employee.systemRole` **luôn** có giá trị và **không** tự động thay đổi khi gán/gỡ Role động.
- `EmployeeRole` chỉ để cấp permission — **không** thay đổi persona.
- 1 employee có thể được gán **nhiều** Role động (n-n).
- Permissions cuối cùng = union tất cả Role động được gán + không phụ thuộc SystemRole.

### 4.2. Ví dụ

| Case | SystemRole | Role động được gán | Kết quả |
|---|---|---|---|
| Nhân viên bình thường | `EMPLOYEE` | Không có / Role "Employee mặc định" | Chỉ có permission cơ bản, scope = self |
| Trưởng nhóm dự án X (vẫn là nhân viên) | `EMPLOYEE` | Role "Project Lead" (có `announcement:create`) | Vẫn scope = self cho leave/attendance, nhưng được tạo announcement |
| Trưởng phòng | `MANAGER` | Role "Manager mặc định" | Scope = department, có `leave:approve` |
| Phó phòng được uỷ quyền duyệt đơn | `EMPLOYEE` | Role "Employee" + Role "Deputy Approver" (có `leave:approve`) | Scope = self (theo persona), nhưng được duyệt các đơn mà routing chỉ định |

Chú ý case cuối: mặc dù được cấp `leave:approve`, Service vẫn check `leaveRequest.approverId === user.id`. Muốn phó phòng thực sự nhận đơn, phải update routing (đổi `Department.managerId` hoặc thêm delegation record) — đây là feature riêng, **không** phải phạm vi permission.

### 4.3. ADMIN bypass

`SystemRole.ADMIN` **bypass toàn bộ** `PermissionsGuard`:

```typescript
// permissions.guard.ts (đã có sẵn, giữ nguyên)
if (authUser?.role === SystemRole.ADMIN) return true;
```

Lý do: đơn giản, tránh phải seed đầy đủ permission cho ADMIN và tránh bug "ADMIN không vào được vì quên gán permission". Đánh đổi: không thể "hạ quyền" ADMIN qua UI — muốn hạ phải đổi SystemRole.

---

## 5. Scope Ownership — quyết định filter dữ liệu

**Chốt: Permission KHÔNG mô tả scope. Service tự filter dựa vào `SystemRole`.**

Ví dụ endpoint `GET /v1/leave-requests`:

| SystemRole | Có `leave:read`? | Service trả về |
|---|---|---|
| `EMPLOYEE` | ✓ | Đơn của chính user |
| `MANAGER` | ✓ | Đơn phòng mình + đơn giao mình duyệt |
| `HR` | ✓ | Tất cả đơn |
| `ADMIN` | (bypass) | Tất cả đơn |

Logic filter viết trong Service — giữ nguyên như hiện tại, **không** encode scope vào permission code (`leave:read:own` / `leave:read:department` / `leave:read:all`).

Lý do chọn cách này:
- Giữ danh sách permission gọn (~5-8 perm/module thay vì ~15).
- Không đụng business logic filter đã ổn định.
- Về sau nếu cần granular hơn có thể thêm perm với suffix mà không break hiện tại.

---

## 6. Naming Convention cho Permission

Format: `<module>:<action>`

### 6.1. Action chuẩn

| Nhóm | Action | Ý nghĩa |
|---|---|---|
| CRUD | `create` | Tạo mới |
| CRUD | `read` | Xem (list + detail) |
| CRUD | `update` | Sửa |
| CRUD | `delete` | Xoá (soft) |
| Approval | `approve` | Duyệt |
| Approval | `reject` | Từ chối |
| Approval | `cancel` | Huỷ đơn của người khác |
| Assignment | `assign` | Gán (VD: gán Role cho user) |
| Export/Import | `export` | Xuất báo cáo/dữ liệu |
| Export/Import | `import` | Nhập từ file |
| Đặc thù | `calculate` | Chạy tính toán (payroll) |
| Đặc thù | `sync` | Đồng bộ dữ liệu ngoài |
| Đặc thù | `publish` | Công bố (announcement) |

### 6.2. Module prefix

Trùng với tên module trong `src/modules/`:

`employee`, `department`, `position`, `role`, `permission`, `attendance`, `leave`, `makeup-attendance`, `violation`, `business-trip`, `payroll`, `contract`, `social-insurance`, `reward-discipline`, `training`, `recruitment`, `performance`, `announcement`, `report`, `holiday`, `shift`, `working-day`, `system-setting`, ...

### 6.3. Ví dụ permission code

```
employee:create
employee:read
employee:update
employee:delete

leave:create
leave:read
leave:approve
leave:reject
leave:cancel

payroll:read
payroll:calculate
payroll:export

report:read
report:export

role:read
role:create
role:update
role:delete
role:assign
```

---

## 7. Seed Strategy

### 7.1. Default Role trong DB

Seed 4 Role mặc định trong bảng `Role`, tên **khớp với SystemRole enum**:

| Role name | Permissions preset |
|---|---|
| `ADMIN` | (Không cần seed permission vì SystemRole ADMIN bypass — nhưng vẫn tạo record để hiển thị trong UI) |
| `HR` | Full quyền HR: `employee:*`, `leave:*`, `attendance:*`, `payroll:*`, `report:*`, `contract:*`, `social-insurance:*`, `announcement:*`, ... |
| `MANAGER` | `employee:read`, `leave:read/approve/reject`, `attendance:read`, `report:read`, `announcement:create/read`, `makeup-attendance:approve`, `violation:approve`, `business-trip:approve` |
| `EMPLOYEE` | `leave:create/read`, `attendance:read`, `makeup-attendance:create/read`, `violation:create/read`, `business-trip:create/read`, `announcement:read`, `payroll:read` (chỉ của mình — enforce ở Service) |

Employee mới tạo với `systemRole = X` sẽ **tự động** được gán Role động cùng tên qua `EmployeeRole` — đảm bảo behavior mặc định khớp với SystemRole cũ.

### 7.2. Permission master list

Cần audit toàn bộ endpoint hiện tại để chốt danh sách permission chính thức **trước khi seed**. Sẽ được liệt kê trong file riêng: `docs/modules/auth/permission-master-list.md` (TODO).

### 7.3. Migration data

- Không mất data hiện có: mọi Employee đã có `systemRole` → gán Role động cùng tên là xong.
- Khi migrate xong 1 module, HR có thể vào UI tinh chỉnh permission cho từng Role hoặc tạo Role mới (VD: "Trưởng nhóm dự án", "Kế toán trưởng", ...).

---

## 8. Migration Rules

### 8.1. Trong lúc migrate

- 1 controller có thể vừa `@Roles(...)` cũ vừa `@RequirePermissions(...)` mới — 2 guard AND với nhau (đều phải pass).
- Khi 1 module migrate xong, **xoá** `@Roles()` khỏi controller đó, chỉ giữ `@RequirePermissions()`.
- Endpoint self-service (`/me/*`, đổi password của chính mình...) **không** cần permission — chỉ cần `JwtAuthGuard`.
- Endpoint public (`/v1/auth/login`, `/v1/auth/forgot-password`...) **không** cần guard nào ngoài rate-limit.

### 8.2. Không migrate

Các module sau **giữ nguyên** `@Roles()` hoặc chỉ JWT:

- `auth` — login/logout/refresh
- `notification-center`, `email-logs` (self-service của user)
- Endpoint `/me/*` bất kỳ

### 8.3. Rule cho code mới

Sau khi phase 1 hoàn thành, code mới **bắt buộc** dùng `@RequirePermissions()`:

- ❌ Không viết `@Roles(SystemRole.HR, SystemRole.MANAGER)` cho endpoint business mới.
- ✓ Dùng `@RequirePermissions('module:action')`, thêm permission vào seed nếu chưa có.
- ✓ Scope filter (self/department/all) **vẫn** viết trong Service dựa vào `authUser.role`.

---

## 9. Ví dụ đầy đủ — Endpoint Approve Leave

### 9.1. Controller

```typescript
@Post(':id/approve')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('leave:approve')
@ApiOperation({ summary: 'Duyệt đơn nghỉ phép' })
async approve(
  @Param('id', ParseIntPipe) id: number,
  @CurrentUser() user: AuthenticatedUser,
) {
  const approved = await this.leaveService.approve(id, user);
  return toLeaveResponse(approved);
}
```

### 9.2. Service — vẫn giữ check routing

```typescript
async approve(id: number, actor: AuthenticatedUser) {
  const req = await this.repo.findByIdOrThrow(id);

  // ← Đây là "authorization on resource" — permission KHÔNG thay thế được
  if (req.approverId !== actor.id && actor.role !== SystemRole.ADMIN) {
    throw new ForbiddenException('Bạn không phải người duyệt đơn này');
  }

  if (req.status !== LeaveStatus.PENDING) {
    throw new BadRequestException('Đơn không ở trạng thái chờ duyệt');
  }

  const updated = await this.repo.update(id, { status: LeaveStatus.APPROVED, approvedAt: new Date() });

  // notification, log, ...
  return updated;
}
```

### 9.3. Ai dùng được endpoint này?

| Case | Có `leave:approve`? | Là approver của đơn? | Kết quả |
|---|---|---|---|
| Manager phòng A duyệt đơn của nhân viên phòng A | ✓ (từ Role "MANAGER") | ✓ | Duyệt được |
| Manager phòng B duyệt đơn của nhân viên phòng A | ✓ | ✗ | 403 Forbidden (service) |
| HR duyệt đơn khi Manager chưa duyệt (không phải approver) | ✓ (từ Role "HR") | ✗ | 403 Forbidden (service) |
| EMPLOYEE thường (không có perm) gọi API | ✗ | — | 403 Forbidden (guard) |
| Phó phòng được cấp Role "Deputy Approver" | ✓ | ✗ (routing chưa đổi) | 403 Forbidden (service) — muốn duyệt được phải update routing riêng |
| ADMIN | (bypass) | — | Duyệt được (bypass cả 2 tầng) |

---

## 10. Câu hỏi mở (cần chốt sau)

- **Delegation tạm thời** (sếp đi vắng, uỷ quyền duyệt 3 ngày): permission không giải quyết được vì không có TTL. Cần feature riêng (bảng `ApprovalDelegation` với `startAt` / `endAt`) — nằm ngoài scope tài liệu này.
- **Permission master list**: cần audit toàn bộ endpoint hiện có và chốt danh sách trước khi seed → file riêng.
- **Thứ tự migrate module**: đã đề xuất sơ bộ trong phần bàn luận, sẽ chốt trong file `docs/modules/auth/permission-migration-plan.md` sau.
- **UI quản lý Role/Permission**: FE cần trang cho HR/ADMIN gán permission vào Role và gán Role vào Employee. Contract API đã có sẵn ở `/v1/roles` và `/v1/permissions`.

---

## 11. Checklist khi thêm endpoint mới (sau khi migrate xong)

- [ ] Đã có permission tương ứng trong `docs/modules/auth/permission-master-list.md` chưa? Nếu chưa → thêm.
- [ ] Đã seed permission vào DB qua migration chưa?
- [ ] Controller có `@UseGuards(JwtAuthGuard, PermissionsGuard)` + `@RequirePermissions('module:action')`?
- [ ] Nếu endpoint làm việc với resource cụ thể (approve/update/delete) → Service có check ownership/routing không?
- [ ] Nếu endpoint trả list và cần filter theo scope (self/department/all) → Service có filter theo `authUser.role` không?
- [ ] Endpoint self-service (`/me/*`) → **không** cần `@RequirePermissions`, chỉ JWT.
