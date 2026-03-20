# Conventions

## File & Folder Naming

| Loại           | Convention                                 | Ví dụ                              |
| -------------- | ------------------------------------------ | ---------------------------------- |
| Component      | PascalCase                                 | `BookingForm.vue`, `AppButton.vue` |
| Page           | kebab-case                                 | `booking-detail.vue`               |
| Composable     | camelCase, prefix `use`                    | `useBookingForm.ts`                |
| Store          | camelCase, suffix `.store` (hoặc tên ngắn) | `auth.ts`, `booking.store.ts`      |
| Service        | camelCase, suffix `.service`               | `booking.service.ts`               |
| Utility        | camelCase                                  | `formatDate.ts`                    |
| Type/Interface | PascalCase                                 | `BookingPayload`, `UserProfile`    |

## Component Prefix Rules

| Prefix       | Ý nghĩa                               | Ví dụ                                |
| ------------ | ------------------------------------- | ------------------------------------ |
| `App`        | Global layout/wrapper components      | `AppHeader`, `AppButton`, `AppModal` |
| `Ui`         | Primitive UI, không có business logic | `UiInput`, `UiCard`, `UiBadge`       |
| Không prefix | Feature-specific                      | `BookingForm`, `UserAvatar`          |

## Script Setup

Luôn dùng `<script setup lang="ts">`. Thứ tự trong script:

```ts
// 1. imports
// 2. defineProps / defineEmits
// 3. composables & stores
// 4. local state (ref/reactive)
// 5. computed
// 6. functions/methods
// 7. lifecycle hooks
// 8. watchers (hạn chế)
```

## Props & Emits

```ts
const props = withDefaults(
	defineProps<{
		title: string;
		count?: number;
	}>(),
	{ count: 0 },
);

const emit = defineEmits<{
	submit: [payload: BookingPayload];
	close: [];
}>();
```

## TypeScript

- Import type riêng: `import type { Foo } from '...'`
- Không dùng `any` — dùng `unknown` nếu type chưa rõ
- Interface cho object shapes, `type` cho unions/primitives

## Tailwind CSS

**Class ordering:** layout → spacing → sizing → typography → color → border → effect → state

```
<div class="flex items-center gap-4 px-6 py-3 text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
```

**Class động — dùng object syntax:**

```ts
const cls = computed(() => ({
	'bg-brand text-white': props.variant === 'primary',
	'opacity-50 cursor-not-allowed': props.disabled,
}));
```

Không dùng string interpolation với Tailwind — bị purge:

```ts
const cls = `bg-${color}-500`; //
```

# Conventions

## File & Folder Naming

| Loại           | Convention                                 | Ví dụ                              |
| -------------- | ------------------------------------------ | ---------------------------------- |
| Component      | PascalCase                                 | `BookingForm.vue`, `AppButton.vue` |
| Page           | kebab-case                                 | `booking-detail.vue`               |
| Composable     | camelCase, prefix `use`                    | `useBookingForm.ts`                |
| Store          | camelCase, suffix `.store` (hoặc tên ngắn) | `auth.ts`, `booking.store.ts`      |
| Service        | camelCase, suffix `.service`               | `booking.service.ts`               |
| Utility        | camelCase                                  | `formatDate.ts`                    |
| Type/Interface | PascalCase                                 | `BookingPayload`, `UserProfile`    |

## Component Prefix Rules

| Prefix       | Ý nghĩa                               | Ví dụ                                |
| ------------ | ------------------------------------- | ------------------------------------ |
| `App`        | Global layout/wrapper components      | `AppHeader`, `AppButton`, `AppModal` |
| `Ui`         | Primitive UI, không có business logic | `UiInput`, `UiCard`, `UiBadge`       |
| Không prefix | Feature-specific                      | `BookingForm`, `UserAvatar`          |

## Script Setup

Luôn dùng `<script setup lang="ts">`. Thứ tự trong script:

```ts
// 1. imports
// 2. defineProps / defineEmits
// 3. composables & stores
// 4. local state (ref/reactive)
// 5. computed
// 6. functions/methods
// 7. lifecycle hooks
// 8. watchers (hạn chế)
```

## Props & Emits

```ts
const props = withDefaults(
	defineProps<{
		title: string;
		count?: number;
	}>(),
	{ count: 0 },
);

const emit = defineEmits<{
	submit: [payload: BookingPayload];
	close: [];
}>();
```

## TypeScript

- Import type riêng: `import type { Foo } from '...'`
- Không dùng `any` — dùng `unknown` nếu type chưa rõ
- Interface cho object shapes, `type` cho unions/primitives

## Tailwind CSS

**Class ordering:** layout → spacing → sizing → typography → color → border → effect → state

```vue
<div class="flex items-center gap-4 px-6 py-3 text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
```

**Class động — dùng object syntax:**

```ts
const cls = computed(() => ({
	'bg-brand text-white': props.variant === 'primary',
	'opacity-50 cursor-not-allowed': props.disabled,
}));
```

❌ Không dùng string interpolation với Tailwind — bị purge:

```ts
const cls = `bg-${color}-500`; // ❌
```

## Scoped SCSS — Hạn chế tối đa

**Mặc định: không dùng `<style scoped>`**. Tailwind đủ cho hầu hết mọi trường hợp.

Chỉ được dùng scoped SCSS khi **cả hai điều kiện** đều đúng:

1. Không thể đạt được bằng Tailwind utility classes
2. Style nhắm vào phần tử con từ thư viện ngoài (không control được class)

```vue
<!-- ✅ Hợp lệ: override style deep của third-party component -->
<style scoped>
	:deep(.ql-editor) {
		min-height: 200px;
	}
</style>

<!-- ✅ Hợp lệ: CSS animation phức tạp không có sẵn trong Tailwind -->
<style scoped>
	.skeleton {
		background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
	}
	@keyframes shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}
</style>
```

```vue
<!-- ❌ Không hợp lệ: Tailwind làm được hoàn toàn -->
<style scoped>
	.card {
		display: flex;
		padding: 16px;
		border-radius: 8px;
		background: white;
	}
</style>

<!-- ❌ Không hợp lệ: chỉ vì ngại viết nhiều class -->
<style scoped>
	.btn-primary {
		background-color: #3b82f6;
		color: white;
		font-weight: 500;
	}
</style>
```

Nếu thấy muốn viết scoped SCSS → **dừng lại, viết lại bằng Tailwind trước**.

## Pinia Store

Luôn dùng **Setup Store** (không dùng Options Store):

```ts
export const useBookingStore = defineStore('booking', () => {
	const data = ref<BookingResponse | null>(null);
	const loading = ref(false);
	const error = ref<string | null>(null);
	// ...
	return { data, loading, error };
});
```

Destructure trong component:

```ts
const store = useBookingStore();
const { data, loading } = storeToRefs(store); // state/getters
const { fetchById } = store; // actions
```

## Utils vs Composables

| `utils/`                  | `app/composables/`                |
| ------------------------- | --------------------------------- |
| Pure functions, không Vue | Dùng `ref`, `computed`, lifecycle |
| `formatDate(date)`        | `useCountdown()`                  |
| `slugify(str)`            | `useFormValidation()`             |

## Pinia Store

Luôn dùng **Setup Store** (không dùng Options Store):

```ts
export const useBookingStore = defineStore('booking', () => {
	const data = ref<BookingResponse | null>(null);
	const loading = ref(false);
	const error = ref<string | null>(null);
	// ...
	return { data, loading, error };
});
```

Destructure trong component:

```ts
const store = useBookingStore();
const { data, loading } = storeToRefs(store); // state/getters
const { fetchById } = store; // actions
```

## Utils vs Composables

| `utils/`                  | `app/composables/`                |
| ------------------------- | --------------------------------- |
| Pure functions, không Vue | Dùng `ref`, `computed`, lifecycle |
| `formatDate(date)`        | `useCountdown()`                  |
| `slugify(str)`            | `useFormValidation()`             |
