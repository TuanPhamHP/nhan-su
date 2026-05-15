# Frontend — Nuxt 4 Conventions

## Project Structure

```
app/
├── assets/
├── components/
│   ├── common/          ← Button, Input, Modal, Table... (tái sử dụng)
│   └── modules/
│       ├── employee/    ← EmployeeCard.vue, EmployeeForm.vue...
│       ├── attendance/
│       └── leave/
├── composables/
│   ├── useAuth.ts
│   ├── useEmployee.ts
│   └── useAttendance.ts
├── layouts/
│   ├── default.vue      ← Layout chính (sidebar + topbar)
│   └── auth.vue         ← Layout login
├── middleware/
│   ├── auth.ts          ← Redirect nếu chưa login
│   └── role.ts          ← Kiểm tra role
├── pages/
│   ├── login.vue
│   ├── dashboard.vue
│   ├── employees/
│   │   ├── index.vue
│   │   └── [id].vue
│   ├── attendance/
│   ├── leave/
│   ├── reports/
│   ├── payroll/
│   └── settings/
├── types/
│   ├── employee.types.ts
│   ├── attendance.types.ts
│   └── api.types.ts
└── utils/
    ├── api.ts           ← $fetch wrapper
    ├── date.ts
    └── format.ts
```

---

## API Call — Dùng $fetch wrapper

Không gọi `$fetch` trực tiếp trong component hay page. Tất cả qua composable.

```typescript
// utils/api.ts
export function useApi() {
  const config = useRuntimeConfig();
  const { token } = useAuth();

  const $api = $fetch.create({
    baseURL: config.public.apiBaseUrl,
    headers: computed(() => ({
      Authorization: token.value ? `Bearer ${token.value}` : '',
    })),
    onResponseError({ response }) {
      if (response.status === 401) navigateTo('/login');
    },
  });

  return $api;
}
```

```typescript
// composables/useEmployee.ts
export function useEmployee() {
  const $api = useApi();

  const fetchEmployees = async (params: QueryEmployeeParams) => {
    return $api<PaginatedResponse<EmployeeSummary>>('/v1/employees', { params });
  };

  const fetchEmployee = async (id: string) => {
    return $api<ApiResponse<EmployeeDetail>>(`/v1/employees/${id}`);
  };

  const createEmployee = async (dto: CreateEmployeeDto) => {
    return $api<ApiResponse<EmployeeDetail>>('/v1/employees', {
      method: 'POST',
      body: dto,
    });
  };

  return { fetchEmployees, fetchEmployee, createEmployee };
}
```

---

## Types — Phải match với Transformer output của Backend

```typescript
// types/employee.types.ts

export interface EmployeeSummary {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  department: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';
}

export interface EmployeeDetail {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: 'ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE';
  status: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';
  joinDate: string;
  department: { id: string; name: string } | null;
  position: { id: string; name: string } | null;
  createdAt: string;
}

// types/api.types.ts
export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

---

## Quy tắc

- **Không** gọi API trực tiếp trong `<script setup>` của component — phải qua composable
- **Không** hardcode API URL — dùng `runtimeConfig`
- **Không** lưu token trong localStorage — dùng `httpOnly cookie` hoặc Pinia store với `persistedstate`
- Mọi form đều validate bằng **vee-validate + zod** trước khi submit
- Date display dùng `date-fns/vi` locale, không tự format thủ công
