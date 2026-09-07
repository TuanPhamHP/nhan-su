# FE Agent Prompt — Chuyển sang phân quyền theo Permission (đại phẫu)

## Context

Toàn bộ hệ thống chấm công đang được refactor từ **role-based** sang **permission-based** authorization. Trước đây các endpoint duyệt đơn / xem báo cáo dùng `@Roles(HR, MANAGER, ...)` — nay dùng `@RequirePermissions('X:approve')`.

Root cause của refactor: HR user không duyệt được đơn cho nhân viên phòng khác (vì code check `assignedApproverId === actor.id`), còn MANAGER thì không duyệt được cấp 2/cấp 3. Hệ thống permission đã seed sẵn nhưng không được check ở runtime.

Impact với FE:
- Hầu hết endpoint approval + report **không đổi contract** (path, body, response), chỉ đổi logic bên trong về ai được gọi.
- FE cần **kiểm tra `user.permissions[]`** thay vì `user.role` khi quyết định show/hide button.
- Có thêm **7 permission mới** đã seed — HR mặc định nhận tất cả.

> Đọc trước: [`api-response-envelope.md`](./api-response-envelope.md), [`authorization-model.md`](../modules/auth/authorization-model.md).

---

## 1. Không đổi contract API

Path, request body, response shape **giữ nguyên** cho toàn bộ endpoint đã đổi. Cụ thể:

| Endpoint | Method | Path |
|---|---|---|
| Duyệt/từ chối đơn nghỉ phép | PATCH | `/v1/leave-requests/:id/approve` \| `/:id/reject` |
| Duyệt/từ chối đơn tăng ca | PATCH | `/v1/overtime-requests/:id/approve` \| `/:id/reject` |
| Duyệt/từ chối phiếu vi phạm | PATCH | `/v1/violation-requests/:id/approve` \| `/:id/reject` |
| Duyệt/từ chối đơn bù công | PATCH | `/v1/makeup-attendance/:id/approve` \| `/:id/reject` |
| Duyệt/từ chối đơn online | PATCH | `/v1/online-work-requests/:id/approve` \| `/:id/reject` |
| Duyệt/từ chối đơn công tác | PATCH | `/v1/business-trips/:id/approve` \| `/:id/reject` |
| Báo cáo (nhiều loại) | GET | `/v1/reports/*` |

Response codes / envelope không thay đổi. Nếu FE không cần đổi UI show/hide button, code cũ vẫn chạy — chỉ khác ở việc user nào sẽ nhận được 403.

---

## 2. Permission mới đã seed

Thêm **7 permission** vào hệ thống (dành cho các module trước đây chưa có approve permission):

| Permission mới | Dùng ở đâu |
|---|---|
| `overtime:read` | GET `/v1/overtime-requests` |
| `overtime:create` | POST `/v1/overtime-requests` |
| `overtime:approve` | PATCH `/v1/overtime-requests/:id/approve` \| `/reject` |
| `violation:create` | POST `/v1/violation-requests` |
| `violation:approve` | PATCH `/v1/violation-requests/:id/approve` \| `/reject` |
| `makeup:create` | POST `/v1/makeup-attendance` |
| `makeup:approve` | PATCH `/v1/makeup-attendance/:id/approve` \| `/reject` |
| `online-work:read` | GET `/v1/online-work-requests` |
| `online-work:create` | POST `/v1/online-work-requests` |

> BE gọi `npm run db:seed:permissions` để cập nhật DB. Idempotent, an toàn chạy nhiều lần.

---

## 3. Preset permission theo role mặc định (thay đổi)

Sau khi seed lại, các role mặc định nhận preset:

| Permission | HR | DIR | MGR | CHF | EMP |
|---|:-:|:-:|:-:|:-:|:-:|
| `leave:approve` | ✓ | ✓ | ✓ | ✓ | — |
| `overtime:approve` (mới) | ✓ | ✓ | ✓ | ✓ | — |
| `violation:approve` (mới) | ✓ | ✓ | ✓ | ✓ | — |
| `makeup:approve` (mới) | ✓ | ✓ | ✓ | ✓ | — |
| `online-work:approve` | ✓ | ✓ | ✓ | ✓ | — |
| `business-trip:approve` | ✓ | ✓ | ✓ | ✓ | — |
| `report:read` | ✓ | ✓ | ✓ | ✓ | — |
| `report:export` | ✓ | ✓ | ✓ | ✓ | — |

Employee vẫn giữ quyền `X:read` và `X:create` cho các module `leave / overtime / violation / makeup / online-work / business-trip`.

**HR bây giờ được duyệt OT** — trước đây bị block cứng bởi `if (actor.role === 'HR') throw`.

---

## 4. Logic authorization mới ở service (BE tự làm — FE tham khảo)

Toàn bộ service duyệt đơn dùng pattern chung. FE không cần implement lại nhưng nắm để debug khi gặp 403:

```
1. actor.role === 'ADMIN'                    → OK (super-approver)
2. actor.id === assignedApproverId           → OK (là người được assign duyệt)
3. actor.permissions.includes('X:approve')   → OK (override bằng permission)
4. còn lại                                    → 403 Forbidden
```

Có nghĩa là:
- **User "assigned approver" trong workflow** vẫn duyệt được (path 2).
- **User có permission override** duyệt được bất kỳ đơn nào, kể cả không được assign (path 3). VD HR user có `overtime:approve` → duyệt được đơn OT của mọi nhân viên.
- **User không phải cả hai** → 403.

Với **online-work 3 cấp** và **violation 2 cấp**: identity check theo từng cấp cụ thể (`approverL1Id`, `approverL2Id`), nhưng permission override cover mọi cấp.

---

## 5. Hướng dẫn FE — show/hide button "Duyệt / Từ chối"

### TypeScript helper

```typescript
// composables/usePermission.ts
export function useCanApprove(
  user: AuthenticatedUser,
  assignedApproverId: number | null,
  permissionCode: string,
): boolean {
  if (user.role === 'ADMIN') return true;
  if (assignedApproverId !== null && user.id === assignedApproverId) return true;
  return user.permissions.includes(permissionCode);
}
```

### Sử dụng trong component

```vue
<script setup lang="ts">
const canApproveLeave = computed(() =>
  useCanApprove(user.value, leave.value.assignedApproverId, 'leave:approve'),
);
</script>

<template>
  <button v-if="canApproveLeave && leave.status === 'PENDING'" @click="approve">
    Duyệt
  </button>
</template>
```

### Mapping permission theo từng loại đơn

| Loại đơn | Permission | Field identity |
|---|---|---|
| Leave | `leave:approve` | `leave.assignedApproverId` |
| Overtime | `overtime:approve` | `ot.assignedApproverId` |
| Violation L1 | `violation:approve` | `violation.assignedReviewerId` |
| Violation L2 | `violation:approve` | `violation.approverL2Id` |
| Makeup | `makeup:approve` | `request.assignedApproverId` |
| Online-work L1 | `online-work:approve` | `request.approverL1Id` |
| Online-work L2 | `online-work:approve` | `request.approverL2Id` |
| Online-work L3 | `online-work:approve` | (không có identity — check permission hoặc role CHIEF/DIRECTOR) |
| Business trip | `business-trip:approve` | `trip.approverId` |

---

## 6. Show/hide menu chính

FE có thể ẩn menu "Duyệt đơn" hoặc "Báo cáo" nếu user thiếu permission tương ứng:

```typescript
const menuItems = computed(() => {
  const items = [];
  if (user.value.permissions.includes('leave:approve')
    || user.value.permissions.includes('overtime:approve')
    || user.value.permissions.includes('violation:approve')
    || user.value.permissions.includes('makeup:approve')
    || user.value.permissions.includes('online-work:approve')
    || user.value.permissions.includes('business-trip:approve')) {
    items.push({ label: 'Cần duyệt', route: '/pending' });
  }
  if (user.value.permissions.includes('report:read')) {
    items.push({ label: 'Báo cáo', route: '/reports' });
  }
  return items;
});
```

> **Ưu tiên**: check theo permission, không check theo role. Role có thể bị đổi (đặc biệt HR ↔ MANAGER swap) mà permission preset bị lệch giữa các môi trường.

---

## 7. Errors thường gặp sau refactor

| HTTP | Message | Nguyên nhân | Cách xử lý |
|---|---|---|---|
| 403 | `Bạn không có quyền {actionLabel}` | User không có permission tương ứng + không phải assigned approver | Verify `user.permissions` từ `/v1/auth/me`. Nếu preset đúng mà vẫn thiếu → chạy `npm run db:seed:permissions` BE-side. |
| 403 | `Bạn không có quyền truy cập tài nguyên này` | Endpoint dùng permission chưa được cấp cho role của user | Verify preset trong `authorization-model.md`, hoặc HR cấu hình custom Role. |
| 401 | `Token không hợp lệ` | JWT hết hạn | Refresh token / re-login. Permission được aggregate ở validate JWT nên logout/login mới thấy permission mới. |

---

## 8. Kiểm tra sau khi FE deploy

- [ ] Login bằng account HR-role thuộc phòng HCNS — check `/v1/auth/me` trả về đủ `permissions: ['leave:approve', 'overtime:approve', ...]`.
- [ ] Vào chi tiết đơn OT của nhân viên phòng khác → button "Duyệt" **hiện** (trước đây bị ẩn hoặc gọi API bị 403).
- [ ] Login bằng account role EMPLOYEE → button "Duyệt" **không hiện** ở mọi loại đơn.
- [ ] Login bằng MANAGER, vào đơn Violation cấp 2 (đã qua L1) → button "Duyệt" **hiện** (trước đây bị 403 vì L2 chỉ cho CHIEF).
- [ ] Login bằng HR, vào màn "Cần duyệt" → thấy đơn của mọi phòng (trước đây chỉ thấy đơn không có assigned approver).

---

## 9. Không cần làm

- KHÔNG hardcode role trong FE để show/hide button — dùng permission array.
- KHÔNG cache permission lâu — chúng thay đổi khi HR đổi Role cho user hoặc chỉnh preset. Refetch từ `/v1/auth/me` sau mỗi lần login.
- KHÔNG implement lại logic approval ở FE — chỉ show/hide button. Backend là source of truth.
- KHÔNG remove role field khỏi UI — vẫn giữ hiển thị role (HR, MANAGER…) trong profile. Chỉ đổi logic gate button.

---

## 10. Ghi chú

- Report endpoint hiện chưa auto-scope theo phòng ban cho MANAGER (ngoại trừ `/employees/monthly/export` và `/employees/:id/monthly`). User có `report:read` xem được toàn công ty. Nếu cần siết scope, đợi refactor tiếp theo.
- Business trip đã được **siết** — trước đây HR/MANAGER/CHIEF ai cũng duyệt được bất kỳ đơn. Nay chỉ assigned approver hoặc user có `business-trip:approve` duyệt được.
- OT cho HR — hard block đã được gỡ. HR có thể duyệt OT bình thường (như các luồng khác).
