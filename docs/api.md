# API & Services

## External REST API

- **Base URL:** `NUXT_BASE_API_URL` (set trong `.env`)
- **Auth:** API Key qua header — `NUXT_PUBLIC_API_KEY`
- **Format:** JSON request/response

## HTTP Layer

### fetch.factory.ts

Base factory, nhận config và trả về fetch instance với:

- Base URL từ runtime config
- Default headers (`Content-Type: application/json`)
- Error handling chuẩn

### Chọn fetcher phù hợp

```ts
// Endpoint công khai, không cần auth
import { publicFetch } from '~/services/http/public.fetch';

// Endpoint cần API key (mặc định cho hầu hết call)
import { apikeyFetch } from '~/services/http/apikey.fetch';

// Endpoint cần Bearer token của user
import { authFetch } from '~/services/http/auth.fetch';
```

## Cách viết Service mới

```ts
// services/booking.service.ts
import { apikeyFetch } from './http/apikey.fetch';
import type { BookingPayload, BookingResponse } from './http/types';

export const bookingService = {
	async create(payload: BookingPayload): Promise<BookingResponse> {
		return apikeyFetch<BookingResponse>('/bookings', {
			method: 'POST',
			body: payload,
		});
	},

	async getById(id: string): Promise<BookingResponse> {
		return apikeyFetch<BookingResponse>(`/bookings/${id}`);
	},
};
```

Sau đó re-export trong `services/index.ts`:

```ts
export { bookingService } from './booking.service';
```

## Services hiện có

| Service              | Domain                                  |
| -------------------- | --------------------------------------- |
| `auth.service.ts`    | Login, logout, refresh token            |
| `user.service.ts`    | Thông tin user đang đăng nhập           |
| `example.service.ts` | Reference/example — xem để hiểu pattern |

## Error Handling

Service layer throw error với message từ API response. Tại component/composable dùng try/catch:

```ts
try {
	await bookingService.create(payload);
} catch (error) {
	// Hiển thị error cho user
	console.error(error);
}
```

## Runtime Config

Trong `nuxt.config.ts`:

```ts
runtimeConfig: {
  baseApiUrl: process.env.NUXT_BASE_API_URL,
  public: {
    apiKey: process.env.NUXT_PUBLIC_API_KEY,
  }
}
```

Truy cập:

```ts
const config = useRuntimeConfig();
config.baseApiUrl; // server-only
config.public.apiKey; // client + server
```

Pitfalls ❌ Không gọi $fetch / fetch trực tiếp trong component, composable, store ❌ Không hardcode URL hay API key trong service ❌ Không import store trong service (service không biết về Vue layer) ✅ Xem example.service.ts để hiểu pattern trước khi viết service mới
