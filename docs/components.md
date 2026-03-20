# Components

## Tổ chức

```
app/components/
├── ui/              # Generic, reusable UI (Button, Input, Modal, ...)
├── booking/         # Components cho booking flow
├── auth/            # Login, register form components
└── layout/          # Header, Footer, Sidebar (nếu không dùng layouts/)
```

> Nuxt 4 auto-import components — không cần import thủ công trong `<script setup>`. Component đặt trong subfolder sẽ có prefix: `ui/Button.vue` → `<UiButton />`

## Convention

- Một component = một file
- Không đặt business logic (API calls) trực tiếp trong component — tách ra composable
- Component nhận data qua props, emit events lên parent — không tự gọi store trừ khi thực sự cần

## Composables

```
app/composables/
├── useAuth.ts       # Wrap auth store + auth actions
├── useBooking.ts    # Booking form logic, validation, submit
└── ...
```

Pattern chuẩn:

```ts
// composables/useBooking.ts
export function useBooking() {
	const isLoading = ref(false);
	const error = ref<string | null>(null);

	async function submit(payload: BookingPayload) {
		isLoading.value = true;
		error.value = null;
		try {
			await bookingService.create(payload);
		} catch (e) {
			error.value = (e as Error).message;
		} finally {
			isLoading.value = false;
		}
	}

	return { isLoading, error, submit };
}
```

## Layouts

| Layout        | Dùng cho                                  |
| ------------- | ----------------------------------------- |
| `default.vue` | Các trang thông thường (có header/footer) |
| `auth.vue`    | Trang login (không có nav)                |

## Khi thêm component mới

1. Xác định đúng folder (ui / booking / auth / layout)
2. Dùng `<script setup lang="ts">` + defineProps/defineEmits có type
3. Nếu cần gọi API → tạo composable, không gọi service trực tiếp trong component

## Pitfalls

1. Component phức tạp (> ~150 dòng) → tách logic vào composable
