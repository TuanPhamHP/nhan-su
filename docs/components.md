# Components

## Tổ chức

```
app/components/
├── common/          # App-wide shared (AppButton, AppInput, AppModal, AppPagination...)
├── ui/              # Primitive UI, không có business logic (Select, DropdownMenu, DatePicker...)
├── modules/
│   ├── employee/    # EmployeeStatusBadge, EmployeeForm...
│   ├── role/        # RoleCreateModal, RoleAddUserModal...
│   └── ...
└── layout/          # AppHeader, AppSidebar
```

## Auto-import — Quy tắc quan trọng

Nuxt 4 auto-import components theo tên file + folder path:

| Folder          | File                  | Auto-import name          | Import thủ công? |
| --------------- | --------------------- | ------------------------- | ---------------- |
| `common/`       | `AppButton.vue`       | `<CommonAppButton>`       | ❌ Không cần     |
| `ui/`           | `DropdownMenu.vue`    | `<UiDropdownMenu>`        | ❌ Không cần     |
| `layout/`       | `AppSidebar.vue`      | `<LayoutAppSidebar>`      | ❌ Không cần     |
| `modules/role/` | `RoleCreateModal.vue` | ~~ModulesRoleRoleCreate~~ | ✅ **Bắt buộc**  |

> **`components/modules/` PHẢI được import thủ công.** Nuxt sinh tên auto-import cho nested components bị dài và dễ sai (`ModulesRoleRoleCreateModal`), gây lỗi runtime "Failed to resolve component". Luôn dùng explicit import.

### ✅ Đúng — explicit import cho components trong `modules/`

```ts
// Trong page hoặc component cha
import RoleCreateModal from '~/components/modules/role/RoleCreateModal.vue';
import EmployeeStatusBadge from '~/components/modules/employee/EmployeeStatusBadge.vue';
```

```vue
<template>
  <RoleCreateModal v-if="show" @close="show = false" />
  <EmployeeStatusBadge :status="emp.status" />
</template>
```

### ❌ Sai — dùng auto-import name cho `modules/` components

```vue
<!-- KHÔNG làm thế này — sẽ bị "Failed to resolve component" -->
<ModulesRoleRoleCreateModal v-if="show" />
<ModulesEmployeeEmployeeStatusBadge :status="emp.status" />
```

---

## Convention

- Một component = một file
- Không đặt business logic (API calls) trực tiếp trong component — tách ra composable
- Component nhận data qua props, emit events lên parent — không tự gọi store trừ khi thực sự cần
- Các component như Modal, Select, DatePicker... phải dùng component trong `/components`, không dùng HTML element thuần

## Composables

```
app/composables/
├── useAuth.ts
├── useEmployee.ts
├── useRole.ts
└── ...
```

Pattern chuẩn:

```ts
export function useRole() {
	const loading = ref(false);
	const error = ref<string | null>(null);

	async function fetchRole(id: number) {
		loading.value = true;
		error.value = null;
		try {
			// ...
		} catch (e) {
			error.value = (e as Error).message;
		} finally {
			loading.value = false;
		}
	}

	return { loading, error, fetchRole };
}
```

## Layouts

| Layout        | Dùng cho                                  |
| ------------- | ----------------------------------------- |
| `default.vue` | Các trang thông thường (có header/footer) |
| `auth.vue`    | Trang login (không có nav)                |

## Khi thêm component mới

1. Xác định đúng folder (`common/`, `ui/`, `modules/<domain>/`, `layout/`)
2. Dùng `<script setup lang="ts">` + defineProps/defineEmits có type
3. Nếu cần gọi API → tạo composable, không gọi service trực tiếp trong component
4. Nếu component nằm trong `modules/` → nhớ **explicit import** ở nơi dùng

## Pitfalls

1. Component phức tạp (> ~150 dòng) → tách logic vào composable
2. **`modules/` components không auto-import được** — luôn `import X from '~/components/modules/...'`
