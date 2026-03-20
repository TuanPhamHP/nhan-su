# Forms & Notifications

## Form Handling — vee-validate

Dùng `vee-validate` cho mọi form có validation. Không tự viết validation logic.

### Pattern chuẩn

```vue
<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import type { BookingPayload } from '~/services/http/types';

	const { handleSubmit, defineField, errors, isSubmitting } = useForm<BookingPayload>({
		validationSchema: {
			name: (v: string) => !!v || 'Vui lòng nhập họ tên',
			phone: (v: string) => /^[0-9]{10,11}$/.test(v) || 'Số điện thoại không hợp lệ',
			date: (v: string) => !!v || 'Vui lòng chọn ngày',
		},
	});

	const [name, nameAttrs] = defineField('name');
	const [phone, phoneAttrs] = defineField('phone');
	const [date, dateAttrs] = defineField('date');

	const store = useBookingStore();
	const toast = useToast();

	const onSubmit = handleSubmit(async values => {
		try {
			await store.create(values);
			toast.success('Đặt dịch vụ thành công');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Đã có lỗi xảy ra');
		}
	});
</script>

<template>
	<form @submit.prevent="onSubmit">
		<div>
			<input v-model="name" v-bind="nameAttrs" placeholder="Họ tên" />
			<span v-if="errors.name" class="text-sm text-red-500">{{ errors.name }}</span>
		</div>

		<div>
			<input v-model="phone" v-bind="phoneAttrs" placeholder="Số điện thoại" />
			<span v-if="errors.phone" class="text-sm text-red-500">{{ errors.phone }}</span>
		</div>

		<button type="submit" :disabled="isSubmitting">
			{{ isSubmitting ? 'Đang xử lý...' : 'Xác nhận' }}
		</button>
	</form>
</template>
```

### Validation Schema phức tạp — dùng zod

Khi validation có nhiều rule hoặc conditional logic, dùng `zod` + `@vee-validate/zod`:

```ts
import { toTypedSchema } from '@vee-validate/zod';
import * as z from 'zod';

const schema = toTypedSchema(
	z.object({
		name: z.string().min(1, 'Vui lòng nhập họ tên'),
		phone: z.string().regex(/^[0-9]{10,11}$/, 'Số điện thoại không hợp lệ'),
		weight: z.number().positive('Khối lượng phải lớn hơn 0'),
	}),
);

const { handleSubmit, errors } = useForm({ validationSchema: schema });
```

### Pitfalls

❌ Không dùng `ref()` để track form values rồi validate thủ công ❌ Không validate trong store action — validation thuộc về form layer ✅ `isSubmitting` từ `useForm` tự handle true/false trong `handleSubmit` — không cần `ref` riêng

---

## Toast / Notifications {#toast}

Dùng `useToast()` composable cho mọi thông báo. Không dùng `alert()`, không dùng `console.log` thay thế.

### API

```ts
const toast = useToast();

toast.success('Đặt dịch vụ thành công');
toast.error('Đã có lỗi xảy ra');
toast.info('Đơn hàng đang được xử lý');
toast.warning('Phiên đăng nhập sắp hết hạn');
```

### Gọi toast ở đâu

```ts
// ✅ Trong component sau action
const onSubmit = handleSubmit(async values => {
	try {
		await store.create(values);
		toast.success('Tạo đơn thành công');
	} catch (error) {
		toast.error(error instanceof Error ? error.message : 'Đã có lỗi xảy ra');
	}
});

// ✅ Trong composable
async function deleteBooking(id: string) {
	await store.delete(id);
	toast.success('Đã xoá đơn hàng');
}
```

```ts
// ❌ Không gọi toast trong store action — store không biết về UI
async function create(payload: BookingPayload) {
	data.value = await bookingService.create(payload);
	toast.success('...'); // ❌ store không nên có UI side-effect
}
```

### Error message từ API

Luôn unwrap error message từ `Error` object thay vì hardcode:

```ts
// ✅
toast.error(error instanceof Error ? error.message : 'Đã có lỗi xảy ra');

// ❌
toast.error('Lỗi rồi'); // mất thông tin lỗi thực tế từ API
```
