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

## URL-driven Modal (deep link từ notification)

Khi notification/activity navigate đến một trang kèm `?open_id=<id>`, page phải tự động mở modal chi tiết tương ứng.

### Pattern chuẩn

```ts
// Trong onMounted của page
const route = useRoute();
const router = useRouter();

async function openByQueryId() {
  const raw = route.query.open_id;
  if (!raw) return;
  const id = Number(raw);
  if (!id || Number.isNaN(id)) return;

  // Clear query string trước để tránh F5 mở lại
  router.replace({ path: '/current-page' });

  try {
    const item = await service.findOne(id);
    detailTarget.value = item;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Không thể mở chi tiết');
  }
}

onMounted(() => {
  // ... other loaders ...
  openByQueryId();
});
```

### Quy tắc

- `router.replace` phải gọi **trước** khi fetch — nếu fetch lỗi, URL vẫn đã được clean
- Xử lý lỗi bằng `toast.error` — không để unhandled rejection (có thể do lỗi server hoặc phân quyền)
- Validate `id` là số hợp lệ trước khi gọi API
- Navigate phía noti/activity dùng: `router.push(\`/leave?open_id=\${item.targetId}\`)`

---

## Quy tắc

- **Không** gọi API trực tiếp trong `<script setup>` của component — phải qua composable
- **Không** hardcode API URL — dùng `runtimeConfig`
- **Không** lưu token trong localStorage — dùng `httpOnly cookie` hoặc Pinia store với `persistedstate`
- Mọi form đều validate bằng **vee-validate + zod** trước khi submit
- Date display dùng `date-fns/vi` locale, không tự format thủ công
