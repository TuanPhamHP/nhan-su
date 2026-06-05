# Frontend — Nuxt 4 Conventions

## Project Structure

```
app/
├── assets/
├── components/
│   ├── common/          ← AppButton, AppInput, AppModal, AppTable...
│   ├── layout/          ← AppHeader, AppSidebar (mgmt), AppSidebarEmployee
│   └── modules/
│       ├── employee/    ← EmployeeCard.vue, EmployeeForm.vue...
│       ├── attendance/
│       └── leave/
├── composables/
│   ├── useAuth.ts
│   ├── useEmployee.ts
│   └── useAttendance.ts
├── layouts/
│   ├── default.vue      ← Layout quản trị (management sidebar + topbar)
│   ├── employee.vue     ← Layout nhân viên (employee sidebar + topbar)
│   └── auth.vue         ← Layout login (không có nav)
├── middleware/
│   ├── auth.global.ts      ← Redirect nếu chưa login
│   └── role-layout.global.ts  ← Assign layout theo URL + role, block /management cho EMPLOYEE
├── pages/
│   ├── index.vue              ← Dashboard (tất cả roles)
│   ├── login.vue
│   ├── attendance/
│   │   ├── my.vue             ← Chấm công cá nhân (tất cả roles)
│   │   └── check-in.vue
│   ├── leave/
│   │   └── create.vue         ← Tạo đơn nghỉ (employee)
│   ├── overtime/
│   │   ├── my.vue             ← OT cá nhân
│   │   └── create.vue
│   ├── online-work/
│   │   ├── my.vue
│   │   └── create.vue
│   ├── violations/
│   │   └── my.vue
│   ├── business-trips/        ← Shared: employee xem đơn cá nhân, management xem tất cả
│   ├── users/
│   │   └── leave-requests.vue ← Danh sách đơn nghỉ của tôi (employee)
│   ├── profile/
│   ├── notifications/
│   └── management/            ← TẤT CẢ pages quản trị nằm ở đây
│       ├── employees/
│       ├── departments/
│       ├── positions/
│       ├── contracts/
│       ├── attendance/        ← Overview chấm công toàn bộ
│       ├── leave/             ← Quản lý tất cả đơn nghỉ
│       ├── overtime/
│       ├── online-work/
│       ├── violations/
│       ├── business-trips/
│       ├── reports/
│       ├── payroll/
│       ├── roles/
│       ├── settings/
│       ├── system-logs/
│       └── notifications/
├── stores/
│   ├── auth.ts          ← User, token, permissions
│   ├── ui.ts            ← previewRole cho "view as" toggle
│   └── directory.ts     ← Global employees/departments/positions
├── types/
│   ├── employee.types.ts
│   ├── attendance.types.ts
│   └── api.types.ts
└── utils/
    ├── api.ts
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
  router.replace({ path: '/management/leave' }); // dùng path thực tế của page

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
- Xử lý lỗi bằng `toast.error` — không để unhandled rejection
- Validate `id` là số hợp lệ trước khi gọi API
- Navigate phía noti/activity **phải dùng đúng prefix**:
  - Management → `router.push(\`/management/leave?open_id=\${item.targetId}\`)`
  - Employee → `router.push(\`/users/leave-requests?open_id=\${item.targetId}\`)`

---

## URL Prefix — Quy tắc Navigation

Mọi hardcoded route string trong code đều phải theo đúng prefix:

| Loại page | Prefix | Ví dụ |
|---|---|---|
| Management (xem/quản lý data của người khác) | `/management/` | `/management/employees`, `/management/leave` |
| Employee/shared (chỉ thao tác data của bản thân) | `/` (root) | `/attendance/my`, `/overtime/create` |

```ts
// ✅ Đúng
router.push('/management/employees/new');
router.push('/management/leave?open_id=123');
navigateTo('/management/violations');

// ❌ Sai — thiếu /management/ prefix
router.push('/employees/new');
router.push('/leave');
```

**business-trips là exception:** route `/business-trips` dùng chung cho cả 2 nhóm (employee xem của mình, management xem tất cả — page tự filter theo role).

---

## Quy tắc

- **Không** gọi API trực tiếp trong `<script setup>` của component — phải qua composable
- **Không** hardcode API URL — dùng `runtimeConfig`
- **Không** lưu token trong localStorage — dùng `httpOnly cookie` hoặc Pinia store với `persistedstate`
- Mọi form đều validate bằng **vee-validate + zod** trước khi submit
- Date display dùng `date-fns/vi` locale, không tự format thủ công
