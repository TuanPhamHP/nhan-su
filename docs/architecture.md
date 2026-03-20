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

Hiện tại chỉ có `stores/auth.ts`. Khi thêm store mới:

- Dùng **setup store** style (không dùng Options API style)
- File đặt trong `app/stores/`
- Tên: `useXxxStore`

## Routing

File-based routing qua `app/pages/`. Hiện có:

- `/` → `pages/index.vue` — trang chủ / booking form
- `/login` → `pages/login.vue` — đăng nhập

## Auth Flow

1. User login → gọi `auth.service.ts`
2. Token lưu vào `stores/auth.ts`
3. Các request tiếp theo dùng `auth.fetch.ts` tự động đính token
4. Middleware trong `app/middleware/` guard các route cần auth
