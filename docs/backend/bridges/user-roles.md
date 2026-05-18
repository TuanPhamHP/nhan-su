# Frontend — Phân quyền (Roles & Permissions)

## Tổng quan

Hệ thống phân quyền dùng mô hình **RBAC (Role-Based Access Control)** hai tầng:

```
Employee
  └── có nhiều Role (nhiều-nhiều, qua EmployeeRole)
        └── mỗi Role có nhiều Permission (nhiều-nhiều, qua RolePermission)
```

Khi đăng nhập, backend trả `accessToken`. Mỗi request có token hợp lệ, backend sẽ load toàn bộ permissions của user từ DB và gắn vào request context.

**Lưu ý quan trọng:** Permissions **không** được nhúng vào JWT — chúng được load realtime từ DB. Để biết user hiện tại có permissions gì, gọi `GET /v1/auth/me`.

---

## Hai tầng quyền

### Tầng 1 — System Role (trong JWT)

Là `role` field trong response đăng nhập. Quyết định **cấp độ hệ thống** của user.

| Value      | Mô tả                                           |
| ---------- | ----------------------------------------------- |
| `ADMIN`    | Superuser — bypass toàn bộ permission check     |
| `HR`       | Nhân sự — được gán HR Manager role mặc định     |
| `MANAGER`  | Quản lý — được gán role Nhân viên mặc định      |
| `EMPLOYEE` | Nhân viên thường — được gán role Nhân viên mặc định |

`ADMIN` bypass **mọi** permission check ở backend. Không cần check thêm trên frontend.

### Tầng 2 — RBAC Permissions (từ API)

Là danh sách `permissions[]` cụ thể mà user có được từ các role được gán. Dùng để ẩn/hiện UI elements và block route.

---

## Danh sách Permissions

Tất cả permission codes hiện có trong hệ thống:

| Group       | Code                  | Mô tả                         |
| ----------- | --------------------- | ----------------------------- |
| Nhân viên   | `employee:read`       | Xem nhân viên                 |
| Nhân viên   | `employee:create`     | Tạo nhân viên                 |
| Nhân viên   | `employee:update`     | Chỉnh sửa nhân viên           |
| Nhân viên   | `employee:delete`     | Vô hiệu hóa nhân viên         |
| Phòng ban   | `department:read`     | Xem phòng ban                 |
| Phòng ban   | `department:create`   | Tạo phòng ban                 |
| Phòng ban   | `department:update`   | Chỉnh sửa phòng ban           |
| Phòng ban   | `department:delete`   | Vô hiệu hóa phòng ban         |
| Chức vụ     | `position:read`       | Xem chức vụ                   |
| Chức vụ     | `position:create`     | Tạo chức vụ                   |
| Chức vụ     | `position:update`     | Chỉnh sửa chức vụ             |
| Chức vụ     | `position:delete`     | Vô hiệu hóa chức vụ           |
| Phân quyền  | `role:read`           | Xem vai trò                   |
| Phân quyền  | `role:create`         | Tạo vai trò                   |
| Phân quyền  | `role:update`         | Chỉnh sửa vai trò             |
| Phân quyền  | `role:delete`         | Xóa vai trò                   |
| Phân quyền  | `role:assign`         | Gán người dùng vào vai trò    |
| Chấm công   | `attendance:read`     | Xem chấm công                 |
| Chấm công   | `attendance:manage`   | Quản lý chấm công             |
| Nghỉ phép   | `leave:read`          | Xem đơn nghỉ phép             |
| Nghỉ phép   | `leave:create`        | Tạo đơn nghỉ phép             |
| Nghỉ phép   | `leave:approve`       | Duyệt đơn nghỉ phép           |
| Lương       | `payroll:read`        | Xem bảng lương                |
| Lương       | `payroll:manage`      | Quản lý bảng lương            |
| Lương       | `payroll:publish`     | Phát hành bảng lương          |
| Báo cáo     | `report:read`         | Xem báo cáo                   |
| Cài đặt     | `setting:read`        | Xem cài đặt hệ thống          |
| Cài đặt     | `setting:update`      | Chỉnh sửa cài đặt hệ thống   |

---

## Role mặc định (Seeded)

| Role         | Type      | Permissions                                                                                         |
| ------------ | --------- | --------------------------------------------------------------------------------------------------- |
| HR Manager   | `DEFAULT` | employee:\*, department:\*, position:\*, attendance:\*, leave:\*, report:read                        |
| Nhân viên    | `DEFAULT` | employee:read, department:read, position:read, attendance:read, leave:read, leave:create            |

`DEFAULT` roles không thể xóa — chỉ có thể sửa permissions.

---

## API Endpoints

### Auth

```
POST   /v1/auth/login          Đăng nhập → trả accessToken + user info
POST   /v1/auth/refresh        Làm mới accessToken
GET    /v1/auth/me             Thông tin user hiện tại + systemRole
POST   /v1/auth/logout         Đăng xuất
```

### Permissions

```
GET    /v1/permissions         Danh sách tất cả permissions, nhóm theo group
```

### Roles

```
GET    /v1/roles               Danh sách roles (có phân trang, filter)
POST   /v1/roles               Tạo role CUSTOM (chỉ ADMIN)
GET    /v1/roles/:id           Chi tiết role + danh sách permissions
PATCH  /v1/roles/:id           Cập nhật tên/mô tả role (chỉ ADMIN)
DELETE /v1/roles/:id           Xóa role CUSTOM (chỉ ADMIN, không xóa DEFAULT)
PUT    /v1/roles/:id/permissions   Thay thế toàn bộ permissions của role (chỉ ADMIN)
GET    /v1/roles/:id/employees     Danh sách nhân viên thuộc role (phân trang)
POST   /v1/roles/:id/employees     Thêm nhân viên vào role (bulk, chỉ ADMIN)
DELETE /v1/roles/:id/employees/:employeeId   Xóa nhân viên khỏi role (chỉ ADMIN)
```

---

## TypeScript Types

```typescript
// types/auth.types.ts

export type SystemRole = 'ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE';

export interface AuthUser {
  id: number;
  employeeCode: string;
  fullName: string;
  email: string;
  role: SystemRole;
  avatarUrl: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}
```

```typescript
// types/role.types.ts

export type RoleType = 'DEFAULT' | 'CUSTOM';

export interface PermissionDto {
  id: number;
  code: string;
  name: string;
}

export interface PermissionGroupDto {
  group: string;
  permissions: PermissionDto[];
}

export interface RoleSummary {
  id: number;
  name: string;
  type: RoleType;
  permissionCount: number;
  employeeCount: number;
  updatedAt: string;
}

export interface RoleDetail {
  id: number;
  name: string;
  description: string | null;
  type: RoleType;
  permissions: PermissionDto[];
  permissionCount: number;
  employeeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RoleEmployee {
  id: number;
  employeeCode: string;
  fullName: string;
  email: string;
  department: string | null;
}

// Request DTOs
export interface CreateRoleDto {
  name: string;
  description?: string;
  permissionIds?: number[];
}

export interface UpdateRoleDto {
  name?: string;
  description?: string;
}

export interface AssignPermissionsDto {
  permissionIds: number[];
}

export interface AssignEmployeesDto {
  employeeIds: number[];
}
```

---

## Pinia Store — useAuthStore

```typescript
// stores/auth.ts
import { defineStore } from 'pinia';
import type { AuthUser, SystemRole } from '~/types/auth.types';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null);
  const accessToken = ref<string | null>(null);
  const permissions = ref<string[]>([]);

  const isLoggedIn = computed(() => !!accessToken.value);
  const isAdmin = computed(() => user.value?.role === 'ADMIN');

  function hasPermission(code: string): boolean {
    if (user.value?.role === 'ADMIN') return true;
    return permissions.value.includes(code);
  }

  function hasAnyPermission(codes: string[]): boolean {
    if (user.value?.role === 'ADMIN') return true;
    return codes.some((code) => permissions.value.includes(code));
  }

  function hasAllPermissions(codes: string[]): boolean {
    if (user.value?.role === 'ADMIN') return true;
    return codes.every((code) => permissions.value.includes(code));
  }

  async function login(email: string, password: string) {
    const $api = useApi();
    const res = await $api<ApiResponse<AuthTokens>>('/v1/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    accessToken.value = res.data.accessToken;
    user.value = res.data.user;
    await loadPermissions();
  }

  async function loadPermissions() {
    if (!accessToken.value) return;
    // Lấy permissions từ /v1/auth/me hoặc decode từ các role đã fetch
    // Backend load permissions realtime — không embed trong JWT
    const $api = useApi();
    const me = await $api<ApiResponse<{ permissions: string[] }>>('/v1/auth/me');
    permissions.value = me.data.permissions;
  }

  function logout() {
    user.value = null;
    accessToken.value = null;
    permissions.value = [];
  }

  return {
    user,
    accessToken,
    permissions,
    isLoggedIn,
    isAdmin,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    login,
    loadPermissions,
    logout,
  };
}, {
  persist: true, // pinia-plugin-persistedstate
});
```

---

## Composable — usePermission

```typescript
// composables/usePermission.ts
export function usePermission() {
  const authStore = useAuthStore();

  return {
    can: (code: string) => authStore.hasPermission(code),
    canAny: (codes: string[]) => authStore.hasAnyPermission(codes),
    canAll: (codes: string[]) => authStore.hasAllPermissions(codes),
    isAdmin: computed(() => authStore.isAdmin),
  };
}
```

**Dùng trong component:**

```vue
<script setup lang="ts">
const { can, isAdmin } = usePermission();
</script>

<template>
  <!-- Ẩn nút nếu không có quyền -->
  <Button v-if="can('employee:create')" @click="openCreateModal">
    Thêm nhân viên
  </Button>

  <!-- Disable nếu không có quyền (không ẩn, để user biết feature tồn tại) -->
  <Button :disabled="!can('employee:update')" @click="openEditModal">
    Chỉnh sửa
  </Button>

  <!-- Chỉ ADMIN mới thấy -->
  <AdminPanel v-if="isAdmin" />
</template>
```

---

## Composable — useRoles

```typescript
// composables/useRoles.ts
import type {
  RoleSummary, RoleDetail, RoleEmployee,
  CreateRoleDto, UpdateRoleDto, AssignPermissionsDto, AssignEmployeesDto,
} from '~/types/role.types';

export function useRoles() {
  const $api = useApi();

  const fetchRoles = (params?: { page?: number; limit?: number; search?: string; type?: string }) =>
    $api<PaginatedResponse<RoleSummary>>('/v1/roles', { params });

  const fetchRole = (id: number) =>
    $api<ApiResponse<RoleDetail>>(`/v1/roles/${id}`);

  const createRole = (dto: CreateRoleDto) =>
    $api<ApiResponse<RoleDetail>>('/v1/roles', { method: 'POST', body: dto });

  const updateRole = (id: number, dto: UpdateRoleDto) =>
    $api<ApiResponse<RoleDetail>>(`/v1/roles/${id}`, { method: 'PATCH', body: dto });

  const deleteRole = (id: number) =>
    $api<void>(`/v1/roles/${id}`, { method: 'DELETE' });

  const updatePermissions = (id: number, dto: AssignPermissionsDto) =>
    $api<ApiResponse<RoleDetail>>(`/v1/roles/${id}/permissions`, { method: 'PUT', body: dto });

  const fetchRoleEmployees = (id: number, params?: { page?: number; limit?: number }) =>
    $api<PaginatedResponse<RoleEmployee>>(`/v1/roles/${id}/employees`, { params });

  const addEmployees = (id: number, dto: AssignEmployeesDto) =>
    $api<void>(`/v1/roles/${id}/employees`, { method: 'POST', body: dto });

  const removeEmployee = (roleId: number, employeeId: number) =>
    $api<void>(`/v1/roles/${roleId}/employees/${employeeId}`, { method: 'DELETE' });

  return {
    fetchRoles, fetchRole, createRole, updateRole, deleteRole,
    updatePermissions, fetchRoleEmployees, addEmployees, removeEmployee,
  };
}
```

---

## Composable — usePermissionsList

```typescript
// composables/usePermissionsList.ts
import type { PermissionGroupDto } from '~/types/role.types';

export function usePermissionsList() {
  const $api = useApi();

  const fetchPermissions = () =>
    $api<ApiResponse<PermissionGroupDto[]>>('/v1/permissions');

  return { fetchPermissions };
}
```

---

## Route Middleware

```typescript
// middleware/permission.ts
// Dùng definePageMeta để khai báo permissions cần thiết cho từng route

export default defineNuxtRouteMiddleware(() => {
  const authStore = useAuthStore();

  if (!authStore.isLoggedIn) {
    return navigateTo('/login');
  }
});
```

```typescript
// Trong page component — khai báo permissions cần thiết
// pages/roles/index.vue
definePageMeta({
  middleware: ['auth'],   // phải đăng nhập
  // permission check thủ công trong onMounted hoặc dùng guard bên dưới
});

// Hoặc tạo middleware chuyên dụng:
// middleware/require-permission.ts
export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore();
  const required = to.meta.permissions as string[] | undefined;

  if (!required || required.length === 0) return;

  if (!authStore.hasAllPermissions(required)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
  }
});
```

```vue
<!-- pages/roles/index.vue -->
<script setup lang="ts">
definePageMeta({
  middleware: ['auth', 'require-permission'],
  permissions: ['role:read'],
});
</script>
```

---

## Hiển thị Permission Picker (cho trang Tạo/Sửa Role)

```vue
<!-- components/roles/PermissionPicker.vue -->
<script setup lang="ts">
import type { PermissionGroupDto, PermissionDto } from '~/types/role.types';

const props = defineProps<{
  modelValue: number[];   // mảng permissionId đã chọn
}>();
const emit = defineEmits<{ 'update:modelValue': [ids: number[]] }>();

const { fetchPermissions } = usePermissionsList();
const { data: permissionsRes } = await useAsyncData('permissions', fetchPermissions);
const groups = computed(() => permissionsRes.value?.data ?? []);

const selected = computed({
  get: () => new Set(props.modelValue),
  set: (val) => emit('update:modelValue', [...val]),
});

function toggle(id: number) {
  const next = new Set(selected.value);
  next.has(id) ? next.delete(id) : next.add(id);
  emit('update:modelValue', [...next]);
}

function toggleGroup(group: PermissionGroupDto) {
  const allChecked = group.permissions.every((p) => selected.value.has(p.id));
  const next = new Set(selected.value);
  group.permissions.forEach((p) => allChecked ? next.delete(p.id) : next.add(p.id));
  emit('update:modelValue', [...next]);
}
</script>

<template>
  <div class="space-y-4">
    <div v-for="group in groups" :key="group.group" class="border rounded p-3">
      <label class="flex items-center gap-2 font-semibold cursor-pointer">
        <input
          type="checkbox"
          :checked="group.permissions.every((p) => selected.has(p.id))"
          :indeterminate="group.permissions.some((p) => selected.has(p.id)) && !group.permissions.every((p) => selected.has(p.id))"
          @change="toggleGroup(group)"
        />
        {{ group.group }}
      </label>
      <div class="mt-2 ml-4 grid grid-cols-2 gap-1">
        <label
          v-for="perm in group.permissions"
          :key="perm.id"
          class="flex items-center gap-2 text-sm cursor-pointer"
        >
          <input
            type="checkbox"
            :checked="selected.has(perm.id)"
            @change="toggle(perm.id)"
          />
          {{ perm.name }}
        </label>
      </div>
    </div>
  </div>
</template>
```

---

## Response mẫu

### GET /v1/permissions

```json
{
  "success": true,
  "data": [
    {
      "group": "Nhân viên",
      "permissions": [
        { "id": 1, "code": "employee:read", "name": "Xem nhân viên" },
        { "id": 2, "code": "employee:create", "name": "Tạo nhân viên" },
        { "id": 3, "code": "employee:update", "name": "Chỉnh sửa nhân viên" },
        { "id": 4, "code": "employee:delete", "name": "Vô hiệu hóa nhân viên" }
      ]
    },
    {
      "group": "Phân quyền",
      "permissions": [
        { "id": 13, "code": "role:read",   "name": "Xem vai trò" },
        { "id": 14, "code": "role:create", "name": "Tạo vai trò" },
        { "id": 15, "code": "role:update", "name": "Chỉnh sửa vai trò" },
        { "id": 16, "code": "role:delete", "name": "Xóa vai trò" },
        { "id": 17, "code": "role:assign", "name": "Gán người dùng vào vai trò" }
      ]
    }
  ]
}
```

### GET /v1/roles

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "HR Manager",
      "type": "DEFAULT",
      "permissionCount": 18,
      "employeeCount": 1,
      "updatedAt": "2026-05-18T02:24:40.459Z"
    },
    {
      "id": 2,
      "name": "Nhân viên",
      "type": "DEFAULT",
      "permissionCount": 6,
      "employeeCount": 3,
      "updatedAt": "2026-05-18T02:24:40.466Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 2, "totalPages": 1 }
}
```

### GET /v1/roles/:id

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "HR Manager",
    "description": "Quản lý nhân sự — toàn quyền trên employee, department, position, leave",
    "type": "DEFAULT",
    "permissions": [
      { "id": 1,  "code": "employee:read",   "name": "Xem nhân viên" },
      { "id": 2,  "code": "employee:create", "name": "Tạo nhân viên" }
    ],
    "permissionCount": 18,
    "employeeCount": 1,
    "createdAt": "2026-05-18T02:24:40.459Z",
    "updatedAt": "2026-05-18T02:24:40.459Z"
  }
}
```

### PUT /v1/roles/:id/permissions

```json
// Request body
{ "permissionIds": [1, 2, 3, 5, 9] }

// Response — role với permissions mới
{
  "success": true,
  "data": { "id": 1, "name": "HR Manager", "type": "DEFAULT", "permissions": [...], ... }
}
```

### POST /v1/roles/:id/employees

```json
// Request body
{ "employeeIds": [3, 4, 5] }
// Response: 204 No Content
```

---

## Logic ẩn/hiện UI theo quyền

| Tình huống                         | Logic                                          |
| ---------------------------------- | ---------------------------------------------- |
| Nút "Thêm nhân viên"               | `v-if="can('employee:create')"`                |
| Nút "Xóa" trong bảng nhân viên     | `v-if="can('employee:delete')"`                |
| Tab "Phân quyền" trong sidebar     | `v-if="can('role:read')"`                      |
| Nút "Tạo Role" trong trang roles   | `v-if="can('role:create')"`                    |
| Nút "Xóa Role"                     | `v-if="can('role:delete') && role.type === 'CUSTOM'"` |
| Nút "Duyệt nghỉ phép"              | `v-if="can('leave:approve')"`                  |
| Toàn bộ trang Payroll              | middleware `permissions: ['payroll:read']`     |
| ADMIN — không cần check gì thêm    | `isAdmin` là `true`, `can()` luôn trả `true`   |

---

## Lưu ý quan trọng

- **Không** dùng `role` (SystemRole) để check feature-level access — dùng `permissions[]` thay thế.  
  `ADMIN` là exception duy nhất — bypass tất cả.
- **Không** cache permissions quá lâu. Khi ADMIN thay đổi permissions của một role, user đang online vẫn còn permissions cũ cho đến lần refresh token tiếp theo. Có thể gọi `loadPermissions()` sau khi user thực hiện action quan trọng.
- `DEFAULT` roles không thể xóa — ẩn nút "Xóa" khi `role.type === 'DEFAULT'`.
- `permissionIds` trong `PUT /v1/roles/:id/permissions` là **thay thế toàn bộ**, không phải append.
