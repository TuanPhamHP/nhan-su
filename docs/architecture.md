# Architecture

## Overview

xc-booking là Nuxt 4 SPA/SSR kết nối với REST API external. Frontend chịu trách nhiệm toàn bộ UI và business logic hiển thị; backend là external service không do team này kiểm soát.

## Data Flow

```
Page/Component
    │
    ▼
Composable (useXxx)       ← optional, wrap logic tái sử dụng
    │
    ▼
Service (xxx.service.ts)  ← gọi API, map response
    │
    ▼
HTTP Layer (http/)        ← fetch factory, attach headers/auth
    │
    ▼
External REST API
```

Pinia store chỉ dùng cho **shared state** cần persist hoặc dùng nhiều nơi (VD: auth, user session). Không dùng store thay thế cho local component state.

## HTTP Layer (`services/http/`)

Ba loại fetcher, chọn theo từng endpoint:

| Fetcher           | Dùng khi                                                   |
| ----------------- | ---------------------------------------------------------- |
| `public.fetch.ts` | Endpoint không cần auth (VD: check availability công khai) |
| `apikey.fetch.ts` | Endpoint chỉ cần API key (hầu hết các call)                |
| `auth.fetch.ts`   | Endpoint cần Bearer token của user đã login                |

`fetch.factory.ts` là base — các fetcher trên extend từ đây, tự động attach `NUXT_PUBLIC_API_KEY` và `NUXT_BASE_API_URL` từ runtime config.

## State Management (Pinia)

| Store | Mục đích |
|---|---|
| `stores/auth.ts` | Auth state: user, token, permissions |
| `stores/ui.ts` | UI-only state: `previewRole` cho "view as" toggle |
| `stores/directory.ts` | Global directory data: employees, departments, positions |
| `stores/notification.ts` | Notification state + FCM |

Khi thêm store mới: dùng **setup store** style, file đặt trong `app/stores/`, tên `useXxxStore`.

## Routing — URL-based Layout

Toàn bộ pages quản trị nằm dưới prefix `/management/`, pages nhân viên/dùng chung nằm ở root.

```
/                           → Dashboard (tất cả roles)
/attendance/my              → Chấm công cá nhân (tất cả roles)
/overtime/my                → OT cá nhân
/violations/my              → Chỉnh công cá nhân
/business-trips             → Công tác (shared — role filter trong page)
/users/leave-requests       → Danh sách đơn nghỉ của tôi (employee)
/users/leave-requests/create → Tạo đơn nghỉ (employee)

/management/employees       → Quản lý nhân viên
/management/attendance      → Chấm công toàn bộ
/management/leave           → Tất cả đơn nghỉ
/management/overtime        → Tất cả đơn OT
/management/violations      → Tất cả vi phạm
/management/reports         → Báo cáo
/management/settings        → Cài đặt hệ thống
...
```

**Rule bất biến:** khi tạo page mới, xác định ngay nó thuộc prefix nào:
- Xem/quản lý dữ liệu của người khác → `/management/`
- Cá nhân (chỉ thao tác dữ liệu của chính mình) → root

## Layouts & Middleware

Có 2 layout chính và 1 auth layout:

| Layout | File | Dùng cho |
|---|---|---|
| `default` | `layouts/default.vue` | Tất cả management pages + root pages cho management roles |
| `employee` | `layouts/employee.vue` | Root pages khi EMPLOYEE đăng nhập |
| `auth` | `layouts/auth.vue` | Login, forgot-password, reset-password |

### role-layout.global.ts

Middleware chạy sau `auth.global.ts`, tự động assign layout:

```
/management/** → setPageLayout('default'), block EMPLOYEE → redirect /
root paths     → setPageLayout theo effectiveRole:
                   ADMIN/HR/MANAGER/CHIEF → 'default'
                   EMPLOYEE              → 'employee'
```

`effectiveRole = uiStore.previewRole ?? authStore.user.role`

### "View as" (Xem theo vai trò khác)

Management user có thể preview giao diện nhân viên qua button trong `AppHeader` user dropdown:

- Click "Xem giao diện nhân viên" → `uiStore.previewAs('EMPLOYEE')` + navigate về `/`
- Click "Về quản trị" → `uiStore.previewAs(null)` + navigate về `/management/employees`
- Preview chỉ thay đổi layout/sidebar, không thay đổi quyền truy cập API

### Sidebar components

| Component | Layout | Nav items |
|---|---|---|
| `AppSidebar.vue` | `default` | Đầy đủ — filtered bởi `user.role` |
| `AppSidebarEmployee.vue` | `employee` | Tối giản — chỉ dashboard + chấm công cá nhân + đơn của tôi |

## Auth Flow

1. Plugin `auth.ts` chạy khi app khởi động: `initFromCookie()` → `fetchMe()` (nếu có token)
2. `auth.global.ts` middleware: redirect unauthenticated users → `/login`
3. `role-layout.global.ts` middleware: assign layout + block management routes cho EMPLOYEE
4. Các request dùng `auth.fetch.ts` tự động đính Bearer token
