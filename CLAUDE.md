# hr-system-fe

Đây là Web Admin cho HR System. Đọc toàn bộ file này trước khi sinh code. Web Admin dashboard cho HR System, dành cho HR, Admin, Manager. Consume API từ repo hr-system-api (/v1/...).

## Tech Stack

- **Framework:** Nuxt 4
- **Language:** TypeScript
- **Styling:** Tailwind CSS — @docs/conventions.md#tailwind
- **State Management:** Pinia
- **Package Manager:** Yarn

## Project Structure

1/ structure tổng quan

```
app/
├── assets/          # Static assets (images, fonts, global CSS)
├── components/      # Vue components (auto-imported)
├── composables/     # Composable functions (auto-imported)
├── layouts/         # Page layouts
├── middleware/      # Route middleware
├── pages/           # File-based routing
├── plugins/         # Nuxt plugins
├── services/        # API service layer
│   ├── http/        # HTTP client layer (fetch factory, typed fetchers)
│   │   ├── fetch.factory.ts   # Base fetch wrapper
│   │   ├── apikey.fetch.ts    # Fetch with API key auth
│   │   ├── auth.fetch.ts      # Fetch with Bearer token auth
│   │   ├── public.fetch.ts    # Unauthenticated fetch
│   │   └── types.ts           # Shared HTTP types
│   ├── auth.service.ts        # Auth API calls
│   ├── user.service.ts        # User API calls
│   ├── example.service.ts     # Example/reference service — đọc trước khi tạo service mới
│   └── index.ts               # Re-exports all services
└── stores/          # Pinia stores
    └── auth.ts      # Auth state
utils/               # Pure utility functions (non-Vue)
docs/                # Project documentation
```

2/ structure chi tiết

```
app/
├── assets/
├── components/
│   ├── common/               ← AppButton, AppInput, AppModal, AppTable, AppBadge
│   └── modules/
│       ├── employee/         ← EmployeeCard, EmployeeForm, EmployeeTable
│       ├── attendance/       ← AttendanceTable, CheckInStatus
│       ├── leave/            ← LeaveRequestForm, LeaveStatusBadge
│       ├── report/           ← AttendanceChart, DepartmentSummary
│       └── payroll/          ← PayslipCard
├── composables/
│   ├── useApi.ts             ← $fetch wrapper với auth header
│   ├── useAuth.ts            ← login, logout, currentUser, token
│   ├── useEmployee.ts
│   ├── useAttendance.ts
│   ├── useLeave.ts
│   ├── useReport.ts
│   └── usePayroll.ts
├── layouts/
│   ├── default.vue           ← sidebar + topbar (auth required)
│   └── auth.vue              ← login page layout
├── middleware/
│   ├── auth.ts               ← redirect /login nếu chưa có token
│   └── role.ts               ← kiểm tra role, redirect nếu không đủ quyền
├── pages/
│   ├── login.vue
│   ├── dashboard.vue
│   ├── employees/
│   │   ├── index.vue         ← danh sách
│   │   └── [id].vue          ← chi tiết + edit
│   ├── attendance/
│   │   ├── index.vue         ← bảng công hôm nay
│   │   └── monthly.vue       ← bảng công tháng
│   ├── leave/
│   │   ├── index.vue         ← danh sách đơn
│   │   └── [id].vue          ← chi tiết + approve/reject
│   ├── reports/
│   │   └── index.vue
│   ├── payroll/
│   │   └── index.vue
│   └── settings/
│       └── index.vue
├── types/
│   ├── api.types.ts          ← ApiResponse, PaginatedResponse
│   ├── employee.types.ts
│   ├── attendance.types.ts
│   ├── leave.types.ts
│   ├── payroll.types.ts
│   └── auth.types.ts
└── utils/
    ├── api.ts                ← base $fetch config
    ├── date.ts               ← format helpers dùng date-fns/vi
    └── format.ts             ← currency, số, status label
```

## Roles & Quyền truy cập trang

Authorization, ở đây chúng ra sẽ dùng mô hình roles & permissions, với logic như sau:

- Toàn bộ App sẽ có nhiều permissions.
- Chúng ta có thể CRUD các role (hoặc vị trí), sau đó gán các quyền tương ứng cho vị trí.
- Có 2 loại role là: default (có thể sửa, không thể xóa). custom (có thể sửa, xóa).
- Tiếp theo có thể gán người dùng vào role (quan hệ người dùng và role là nhiều - nhiều). Một người sẽ nhận toàn bộ permissions của các roles mà họ có.

| Page          | ADMIN | HR  | MANAGER  | EMPLOYEE |
| ------------- | ----- | --- | -------- | -------- |
| `/employees`  | ✓     | ✓   | —        | —        |
| `/attendance` | ✓     | ✓   | ✓ (team) | —        |
| `/leave`      | ✓     | ✓   | ✓ (team) | —        |
| `/reports`    | ✓     | ✓   | ✓ (team) | —        |
| `/payroll`    | ✓     | ✓   | —        | —        |
| `/settings`   | ✓     | —   | —        | —        |

---

### Khi cần làm việc với api, Types

- Đọc file docs/api-endpoint.json để hiểu toàn bộ API shape.
- Đọc các file docs/bridges/ để hiểu các nghiệp vụ đồng bộ từ phía backend.

- Tạo toàn bộ types trong app/types/ dựa trên response schemas trong api-endpoint.json:

- api.types.ts: ApiResponse<T>, PaginatedResponse<T>
- employee.types.ts: EmployeeSummary, EmployeeDetail, CreateEmployeeDto, UpdateEmployeeDto
- attendance.types.ts
- leave.types.ts

## Mỗi type phải khớp chính xác với response schema trong openapi.json.

## Environment Variables

```env
NUXT_PUBLIC_API_KEY=     # API key gửi kèm mỗi request
NUXT_BASE_API_URL=       # Base URL của REST API external
```

Truy cập trong code:

- `useRuntimeConfig().public.apiKey`
- `useRuntimeConfig().baseApiUrl` (server-only)

## Common Commands

```bash
yarn dev          # Start dev server
yarn build        # Build for production
yarn preview      # Preview production build
yarn typecheck    # Run TypeScript check
```

## Non-Negotiable Rules

Những rule này LUÔN áp dụng, không có ngoại lệ:

### Vue / Nuxt

- Luôn dùng `<script setup lang="ts">` — không dùng Options API, không dùng `defineComponent`
- Import type riêng: `import type { Foo } from '...'`
- Không dùng `any` — dùng `unknown` nếu chưa rõ type

### Component Import — QUAN TRỌNG

Nuxt chỉ auto-import đáng tin cậy cho `common/`, `ui/`, `layout/`. Components trong `modules/` **phải import thủ công** — dùng auto-import name (`ModulesXxxYyy`) sẽ gây lỗi runtime "Failed to resolve component".

```ts
// ✅ Đúng — explicit import cho mọi component trong components/modules/
import RoleCreateModal from '~/components/modules/role/RoleCreateModal.vue';
import EmployeeStatusBadge from '~/components/modules/employee/EmployeeStatusBadge.vue';
```

```vue
<!-- ❌ Sai — KHÔNG dùng auto-import name cho modules/ -->
<ModulesRoleRoleCreateModal />
<ModulesEmployeeEmployeeStatusBadge />
```

### API & Services

- Không gọi `$fetch` / `fetch` trực tiếp trong component, composable, store
- Mọi API call đi qua `app/services/` — xem `example.service.ts` để hiểu pattern
- Service mới phải được re-export trong `services/index.ts`

### Styling

- **Tailwind CSS là mặc định** — dùng utility classes cho mọi styling
- **Không dùng `<style scoped>`** trừ 2 trường hợp duy nhất:
  1. Override style của third-party component với `:deep()`
  2. CSS animation phức tạp không có sẵn trong Tailwind (ví dụ: `@keyframes shimmer`)
- Khi muốn viết scoped CSS → dừng lại, thử viết bằng Tailwind trước

### Pinia Store

- Luôn dùng Setup Store — không dùng Options Store (`state: () => ({})`)
- Dùng `storeToRefs()` khi destructure state/getters
- Store chỉ chứa state + actions gọi service — không chứa UI logic

### Data Flow

- Logic tái sử dụng → composable; shared state → store

### Forms

- Dùng vee-validate cho mọi form có validation — không tự viết validation logic
- Xem pattern: @docs/forms.md

### Toast / Notifications

- Dùng useToast() để hiển thị thông báo — không dùng alert()
- Gọi toast ở component/composable sau action, không gọi trong store
- Xem pattern: @docs/forms.md#toast

## Checklist trước khi submit code

- [ ] API calls qua composable, không gọi `$fetch` trực tiếp trong component
- [ ] Types trong `types/` khớp với response shape từ API
- [ ] Form validation dùng vee-validate + zod
- [ ] Date/time hiển thị qua `utils/date.ts` (date-fns + locale vi)
- [ ] Currency/số hiển thị qua `utils/format.ts`
- [ ] Không hardcode API URL — dùng `runtimeConfig`
- [ ] Route có role restriction → có middleware check
- [ ] Không lưu token thủ công vào localStorage
- [ ] Components trong `modules/` được **explicit import**, không dùng auto-import name

---

## KHÔNG được làm

- Gọi `$fetch` trực tiếp trong component hay page
- Hardcode API base URL
- Tự ý thêm UI library mới (shadcn, headlessui...) không hỏi trước
- Dùng `any` type
- Bỏ qua form validation trước khi submit
- Tự format date bằng string manipulation — dùng date-fns
- Tự format tiền bằng string concatenation — dùng `Intl.NumberFormat`
- Dùng auto-import name (`ModulesXxxYyy`) cho components trong `components/modules/` — phải explicit import

## Documentation

- Conventions & naming: @docs/conventions.md
- Architecture & data flow: @docs/architecture.md
- API service layer: @docs/api.md
- Component patterns: @docs/components.md
- Forms & notifications: @docs/forms.md
- api endpoints: @docs/api-enpoint.json
- backend bridges: @docs/bridges/
- front-end docs: @docs/frontend/nuxt-conventions.md
- Code review checklist: @docs/review.md
