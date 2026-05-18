# API & Services

## External REST API

- **Base URL:** `NUXT_PUBLIC_BASE_API_URL` (set trong `.env`, mặc định `http://localhost:3000`)
- **Auth:** Bearer token qua header `Authorization`
- **Format:** JSON request/response

## ⚠️ Response Shape — QUAN TRỌNG

**Mọi endpoint đều wrap response trong `{ success, data }`**, không phải flat object.

```ts
// ✅ Shape thực tế từ API (đã verify bằng curl)
{
  "success": true,
  "data": { /* payload thực sự */ }
}

// ❌ Shape sai — OpenAPI spec trong api-endpoint.json bỏ qua wrapper này
{
  "accessToken": "...",   // KHÔNG có ở top-level
  "user": { ... }         // KHÔNG có ở top-level
}
```

**Quy tắc bắt buộc:** Service phải dùng `ApiResponse<T>` khi type raw response, rồi **unwrap `.data`** trước khi return — component/store chỉ nhận phần payload thực sự.

```ts
// ✅ Đúng pattern
import type { ApiResponse } from '~/types/api.types';

async login(payload: LoginDto): Promise<AuthResponse> {
  const res = await publicFetch<ApiResponse<AuthResponse>>('/v1/auth/login', {
    method: 'POST',
    body: payload,
  });
  return res.data; // unwrap tại service layer
}

// ❌ Sai — type flat, trả về toàn bộ response
async login(payload: LoginDto): Promise<AuthResponse> {
  return publicFetch<AuthResponse>('/v1/auth/login', { ... });
  // res.accessToken === undefined vì thực tế là res.data.accessToken
}
```

### Verified response shapes (curl-tested)

**`POST /v1/auth/login`**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "token": "eyJ...",
    "refreshToken": "uuid-v4",
    "user": {
      "id": 1,
      "fullName": "Quản trị viên",
      "email": "admin@company.com",
      "employeeCode": "EMP001",
      "role": "ADMIN",
      "avatarUrl": null
    }
  }
}
```

**`GET /v1/employees/me`** (Bearer token required)
```json
{
  "success": true,
  "data": {
    "id": 1,
    "employeeCode": "EMP001",
    "fullName": "Quản trị viên",
    "email": "admin@company.com",
    "phone": null,
    "role": "ADMIN",
    "status": "ACTIVE",
    "joinDate": "2020-01-01",
    "dateOfBirth": null,
    "gender": null,
    "address": null,
    "avatarUrl": null,
    "department": { "id": 2, "name": "Ban giám đốc" },
    "position": { "id": 5, "name": "CEO" },
    "createdAt": "2026-05-18T02:24:40.578Z"
  }
}
```

> Khi implement endpoint mới, **luôn curl trực tiếp** để verify shape trước khi viết type:
> ```bash
> curl -s http://localhost:3000/v1/<endpoint> | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.stringify(JSON.parse(d),null,2)))"
> ```

---

## HTTP Layer

### fetch.factory.ts

Base factory, nhận config và trả về `$fetch` instance với:

- Base URL từ `useRuntimeConfig().public.baseApiUrl`
- Options pass-through (headers, onRequest hooks...)

### Chọn fetcher phù hợp

```ts
// Endpoint công khai, không cần auth
import { usePublicFetch } from '~/services/http/public.fetch';

// Endpoint cần Bearer token của user đã login
import { useAuthFetch } from '~/services/http/auth.fetch';

// Endpoint cần API key
import { useApiKeyFetch } from '~/services/http/apikey.fetch';
```

### auth.fetch.ts — đọc token

`useAuthFetch` đọc `access_token` trực tiếp từ `document.cookie` (native, không qua `useCookie`). Lý do: `useCookie` của Nuxt không đáng tin cậy khi gọi trong Pinia store action hay async context.

---

## Cách viết Service mới

```ts
// services/employee.service.ts
import type { ApiResponse, PaginatedResponse } from '~/types/api.types';
import type { Employee, EmployeeSummary, EmployeeQueryParams } from '~/types/employee.types';
import { useAuthFetch } from './http/auth.fetch';

export const useEmployeeService = () => {
  const authFetch = useAuthFetch();

  return {
    async findAll(params?: EmployeeQueryParams): Promise<EmployeeSummary[]> {
      const res = await authFetch<PaginatedResponse<EmployeeSummary>>('/v1/employees', { params });
      return res.data;
    },

    async findOne(id: number): Promise<Employee> {
      const res = await authFetch<ApiResponse<Employee>>(`/v1/employees/${id}`);
      return res.data;
    },
  };
};
```

Sau đó re-export trong `services/index.ts`:

```ts
export * from './employee.service';
```

---

## Cookie / Auth Token

- Token được ghi bằng **native `document.cookie`** (xem `app/utils/cookie.ts`), không dùng Nuxt's `useCookie` trong store
- `useCookie` của Nuxt **không hoạt động đáng tin cậy** khi gọi trong Pinia action (async context)
- `auth.fetch.ts` đọc token bằng `getCookie('access_token')` từ `~/utils/cookie`

## Services hiện có

| Service           | Domain                       |
| ----------------- | ---------------------------- |
| `auth.service.ts` | Login, logout, refresh, me   |
| `user.service.ts` | (legacy, chưa dùng)          |

## Pitfalls

❌ Không type raw response là `T` khi API trả về `{ success, data: T }` — phải dùng `ApiResponse<T>`  
❌ Không gọi `$fetch` / `fetch` trực tiếp trong component, composable, store  
❌ Không hardcode URL hay API key trong service  
❌ Không import store trong service (service không biết về Vue layer)  
❌ Không tin OpenAPI spec (`api-endpoint.json`) mù quáng — luôn curl verify shape thực tế  
✅ Unwrap `.data` tại service layer, component/store nhận payload sạch
