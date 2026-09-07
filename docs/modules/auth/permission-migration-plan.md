> Trạng thái: **Approved** — đã chốt chiến lược, pilot module, và thứ tự phase. Bắt đầu triển khai từ Phase 0.
>
> Tài liệu nền: [authorization-model.md](authorization-model.md) — đọc trước khi implement.

# Permission Migration Plan

Kế hoạch migrate toàn bộ hệ thống từ `@Roles(SystemRole)` sang `@RequirePermissions('module:action')` theo mô hình Hybrid đã chốt.

---

## 1. Chiến lược tổng thể

### 1.1. Approach: **Pilot-then-Batch**

- Chọn 1 pilot nhỏ để validate pattern → merge → test thực tế → nhân rộng.
- Không big-bang (rủi ro cao), không one-by-one (quá chậm).

### 1.2. Pilot module: **`employees` + `departments`**

Lý do:
- Permission đã có sẵn trong `PERMISSION_DEFINITIONS` (`employee:*`, `department:*`).
- 2 module gắn kết chặt (employee thuộc department) — migrate cùng lúc tránh xung đột.
- Cover pattern **CRUD + scope filter** (employee list filter theo department, MANAGER chỉ thấy phòng mình).
- ~19 endpoint (13 employees + 6 departments) — vừa tầm review.

**KHÔNG cover pattern approval** — approval flow sẽ được validate riêng khi migrate `leave` ở phase 4.

### 1.3. Ràng buộc

- Phase 0 là **blocking** cho mọi phase sau (permission chưa có thì không migrate được).
- Phase 1 (pilot) là **blocking** cho phase 2+ (chưa xác thực template thì không nhân rộng).
- Không big-bang: mỗi phase là 1 PR (hoặc chia nhỏ hơn nếu cần).
- Sau mỗi PR merge: monitor 1-2 ngày ở staging trước khi start phase tiếp theo.

---

## 2. Phase 0 — Chuẩn bị (BLOCKING)

**Mục tiêu**: Có đầy đủ permission master list trong DB + preset permission cho 4 Role mặc định + docs chính thức.

### 2.1. Deliverables

1. Audit toàn bộ controller trong `src/modules/*` → chốt danh sách permission thiếu.
2. Tạo file **idempotent** `prisma/seed-permissions.ts` — tách khỏi `prisma/seed.ts` (full seed có `cleanup()` xoá data), chạy an toàn nhiều lần.
3. Định nghĩa preset permission cho 6 Role default: ADMIN (full)/HR/DIRECTOR/MANAGER/CHIEF/EMPLOYEE. Xem quy tắc preset ở [authorization-model.md §7.1](authorization-model.md).
4. Viết `docs/modules/auth/permission-master-list.md` — bảng master, dùng làm reference cho FE và cho các phase sau.
5. Chạy `npm run db:seed:permissions` trên local để verify — idempotent, không mất data.

### 2.2. Danh sách module cần audit và bổ sung

Đã có trong seed hiện tại (không cần thêm, chỉ verify):
- `employee:*`, `department:*`, `position:*`, `role:*`, `attendance:*`, `leave:*`, `payroll:*`, `report:*`, `setting:*`

**Cần bổ sung** — audit endpoint và đề xuất perm code:

| Module | Controller | Perm code đề xuất |
|---|---|---|
| `company-announcements` | 17 endpoint | `announcement:read/create/update/delete/publish` |
| `public-holidays` | 7 endpoint | `holiday:read/create/update/delete` |
| `work-shift` | 4 endpoint | `shift:read/create/update/delete` |
| `shift-schedule` | 9 endpoint | `shift-schedule:read/create/update/delete/assign` |
| `check-in-location` | 11 endpoint | `check-in-location:read/create/update/delete/assign` |
| `makeup-attendance` | 2 endpoint | `makeup-attendance:read/create/approve/reject` |
| `violation-requests` | 9 endpoint | `violation:read/create/update/approve/reject/cancel` |
| `business-trips` | 2 endpoint | `business-trip:read/create/approve/reject` |
| `general-requests` | 16 endpoint | `general-request:read/create/update/approve/reject` |
| `overtime-requests` | 2 endpoint | `overtime:read/create/approve/reject` |
| `online-work-requests` | 2 endpoint | `online-work:read/create/approve/reject` |
| `contracts` | 7 endpoint | `contract:read/create/update/delete` |
| `social-insurance` | 3 endpoint | `social-insurance:read/manage` |
| `dashboard` | 2 endpoint | `dashboard:read` |
| `system-logs` | 2 endpoint | `system-log:read` |

Danh sách này là **đề xuất sơ bộ** — audit thực tế có thể phát hiện thêm action đặc thù (VD: `payroll:calculate`, `attendance:sync`, `announcement:pin`). Chốt cuối cùng trong `permission-master-list.md`.

### 2.3. Không đụng gì ngoài seed

- **Không** migrate module nào ở phase này.
- **Không** thêm decorator `@RequirePermissions()` vào controller.
- **Không** đụng `prisma/seed.ts` (full seed).
- Chỉ đụng: `prisma/seed-permissions.ts` (mới) + `package.json` (script mới) + docs (master list, migration plan).

### 2.4. Definition of Done

- [ ] `PERMISSION_DEFINITIONS` trong `seed-permissions.ts` cover đủ 15+ module còn thiếu (65 perm tổng).
- [ ] Preset permission cho 6 Role default đã đầy đủ, khớp với behavior `@Roles()` hiện tại.
- [ ] `docs/modules/auth/permission-master-list.md` liệt kê đầy đủ với format bảng: `code | name | HR | DIR | MGR | CHF | EMP`.
- [ ] Chạy `npm run db:seed:permissions` trên local thành công (idempotent — lần 2 chạy không tạo mới gì).
- [ ] `/v1/auth/me` trả về `permissions[]` khớp với preset cho từng SystemRole.
- [ ] Data employee/department/... **không bị mất** sau khi chạy seed permissions.

---

## 3. Phase 1 — PILOT: `employees` + `departments`

**Mục tiêu**: Migrate 2 module này sang `@RequirePermissions()`, validate template, chốt best practice cho các phase sau.

### 3.1. Scope

- `src/modules/employees/employees.controller.ts` — 13 endpoint
- `src/modules/departments/departments.controller.ts` — 6 endpoint
- Rà lại `src/modules/roles/roles.controller.ts` — 6 `@Roles()` còn sót (kiểm tra xem có phải deprecated không, nếu không cần thì xoá).

### 3.2. Pattern áp dụng

Xem chi tiết ở [authorization-model.md §9](authorization-model.md).

Với mỗi endpoint:

1. Xác định action → chọn permission code từ master list.
2. Thay `@Roles(SystemRole.HR, SystemRole.MANAGER, ...)` bằng `@RequirePermissions('module:action')`.
3. Thay `@UseGuards(JwtAuthGuard, RolesGuard)` bằng `@UseGuards(JwtAuthGuard, PermissionsGuard)`.
4. **Không đụng Service** — scope filter và ownership check giữ nguyên logic dựa vào `authUser.role` (SystemRole).
5. Endpoint self-service (`GET /me`, đổi password chính mình, ...) → chỉ `JwtAuthGuard`, **không** cần `@RequirePermissions`.

### 3.3. Test plan

Mỗi endpoint test 4 case:

| Case | Kỳ vọng |
|---|---|
| ADMIN gọi | Pass (bypass guard) |
| Role có permission tương ứng gọi | Pass |
| Role không có permission tương ứng gọi | 403 Forbidden |
| Không có JWT | 401 Unauthorized |

Ngoài ra với endpoint có scope filter (VD: `GET /employees`):
- EMPLOYEE gọi → chỉ thấy chính mình (hoặc empty tuỳ business rule).
- MANAGER gọi → thấy employee phòng mình quản lý.
- HR gọi → thấy tất cả.

### 3.4. Definition of Done

- [ ] Tất cả endpoint trong 2 module đã thay `@Roles()` bằng `@RequirePermissions()`.
- [ ] `RolesGuard` đã gỡ khỏi 2 controller này (thay bằng `PermissionsGuard`).
- [ ] Test 4 case trên toàn bộ 19 endpoint pass.
- [ ] Test scope filter (self/department/all) cho endpoint list vẫn work đúng.
- [ ] Swagger docs update tự động (nhờ giữ nguyên `@ApiBearerAuth`).
- [ ] FE không phải đổi gì (endpoint URL không đổi, response format không đổi).
- [ ] Deploy staging, monitor 1-2 ngày, không có 403 bất thường trước khi start phase 2.

### 3.5. Rollback plan

Nếu pilot phát hiện bug lớn:
- Revert PR pilot (chỉ đụng 2 controller + 0 migration → revert clean).
- Phase 0 giữ nguyên (permission đã seed không gây tác dụng phụ khi chưa được `@RequirePermissions()` reference).
- Bàn lại pattern trước khi thử lại.

---

## 4. Phase 2-7 — Nhân rộng

Chỉ start sau khi pilot đã stable ≥ 1 tuần trên staging.

| Phase | Nội dung | Ước lượng | Note |
|---|---|---|---|
| **2** | Config / master: `positions`, `work-shift`, `public-holidays`, `shift-schedule`, `check-in-location` | 1-2 PR | Admin-only, không có scope filter phức tạp → nhanh. |
| **3** | Content HR: `company-announcements` | 1 PR | 17 endpoint — PR lớn nhất phase này. |
| **4** | Approval flows: `leave`, `general-requests`, `makeup-attendance`, `violation-requests`, `business-trips`, `overtime-requests`, `online-work-requests` | 2-3 PR | **Validate pattern approval lần đầu ở đây** — nên tách `leave` thành PR riêng, coi như "pilot đợt 2" cho approval. |
| **5** | Read-heavy: `attendance`, `reports`, `dashboard` | 2 PR | Nhiều filter scope, test kỹ. |
| **6** | Nhạy cảm: `contracts`, `social-insurance` | 1 PR | Test kỹ hơn về permission granular. |
| **7** | Cleanup | 1 PR | Xoá `@Roles()` còn sót, gỡ `RolesGuard` nếu không ai dùng, update `CLAUDE.md`. |

### 4.1. Rule chung cho phase 2-7

- Copy template từ phase 1 pilot (checklist ở §3).
- Không thêm permission mới ngoài master list (nếu thấy thiếu → update master list ở PR riêng trước).
- Mỗi PR có test plan tương tự §3.3.
- Deploy staging → monitor 1-2 ngày → phase tiếp theo.

### 4.2. Rule đặc biệt cho phase 4 (approval)

Approval là pattern chưa được pilot validate. Khi migrate `leave` (module đầu tiên có approve/reject):

- Tách thành **PR riêng**, coi như pilot đợt 2.
- Test kỹ 3 tầng check (xem [authorization-model.md §9.3](authorization-model.md)):
  - Có permission `leave:approve` + là approver → pass
  - Có permission `leave:approve` + không phải approver → 403 (service check routing)
  - Không có permission → 403 (guard)
- Sau khi `leave` stable → batch các approval module còn lại theo template.

### 4.3. Rule cho phase 7 (cleanup)

- Grep toàn repo: `@Roles(` — phải bằng 0 (trừ auth/notification/dev-tools).
- Nếu `RolesGuard` không còn ai dùng → xoá khỏi `AuthModule` exports, xoá file guard.
- Update `CLAUDE.md`:
  - Section "Roles" — cập nhật để phản ánh model Hybrid.
  - Thêm section mới về `@RequirePermissions()` + reference đến docs này.
  - Thêm vào checklist "trước khi submit code": *Endpoint mới đã có `@RequirePermissions('module:action')` chưa? Permission tương ứng đã có trong master list chưa?*

---

## 5. Risk & Mitigation

| Risk | Mức | Mitigation |
|---|---|---|
| Bug permission → user bị lock out oan | Cao | ADMIN bypass đảm bảo luôn có đường vào fix. Deploy staging trước, monitor 403 log. |
| FE hardcode check `role === 'HR'` thay vì check `permissions.includes(...)` | Trung bình | Sau phase 1, thông báo FE team update logic show/hide theo `permissions[]`. |
| Preset permission cho MANAGER/EMPLOYEE sai → behavior khác `@Roles()` cũ | Trung bình | Phase 0 audit kỹ từng endpoint hiện tại đang cho phép role nào → mapping 1-1 vào preset. |
| Migration chưa xong ai đó thêm endpoint mới với `@Roles()` | Trung bình | Sau phase 1: update `CLAUDE.md` yêu cầu code mới dùng `@RequirePermissions()`. Reviewer check. |
| Approval flow bị vỡ ở phase 4 vì pilot không cover | Trung bình | Phase 4 tách `leave` thành PR riêng làm pilot đợt 2 (§4.2). |
| Seed chạy production làm mất permission tuỳ chỉnh của HR | Cao | Không rerun seed trên production. Chỉ dùng migration cho production. Nếu bổ sung permission → migration `INSERT ... ON CONFLICT DO NOTHING`. |

---

## 6. Tracking

Sau khi PR merge, tick vào bảng dưới:

| Phase | Status | PR | Merge date | Note |
|---|---|---|---|---|
| 0 — Audit & seed | ✅ Done | — | 2026-08-07 | `seed-permissions.ts` idempotent, 70 perm, 6 Role default |
| 1 — Pilot (employees + departments) | 🟡 Code done, chờ QA | — | — | Transitional: giữ cả `@Roles()` và `@RequirePermissions()`, AND logic |
| 2 — Config/master data | ⏳ Todo | — | — | |
| 3 — Announcements | ⏳ Todo | — | — | |
| 4 — Approval flows | ⏳ Todo | — | — | Tách `leave` PR riêng |
| 5 — Read-heavy | ⏳ Todo | — | — | |
| 6 — Sensitive | ⏳ Todo | — | — | |
| 7 — Cleanup | ⏳ Todo | — | — | |

---

## 7. FAQ

**Q: Có cần migration Prisma khi bổ sung permission không?**
A: Không, vì `permission` table đã tồn tại. Chỉ cần update `seed-permissions.ts` và rerun `npm run db:seed:permissions` — an toàn trên mọi môi trường vì idempotent (không xoá data, chỉ upsert theo `code`).

**Q: Nếu module có endpoint dùng cho nhiều role nhưng có endpoint chỉ 1 role?**
A: Mỗi endpoint gán 1 hoặc nhiều permission độc lập. Ví dụ: `GET /employees` cần `employee:read` (HR + MANAGER + EMPLOYEE đều có), nhưng `DELETE /employees/:id` cần `employee:delete` (chỉ HR có).

**Q: Endpoint cần nhiều permission cùng lúc?**
A: `@RequirePermissions('perm1', 'perm2')` — AND logic (phải có cả 2). Nếu cần OR → hiện tại guard chưa support, cần mở rộng guard (không nằm trong scope migration này).

**Q: Có phá backward compatibility API không?**
A: Không. URL, request/response format, HTTP status code đều không đổi. Chỉ đổi cách BE decide 403 vs 200.

**Q: FE có cần đổi gì?**
A: Không bắt buộc. Nhưng nên: đổi logic show/hide button từ `if (user.role === 'HR')` sang `if (user.permissions.includes('employee:delete'))` — sẽ tận dụng được flexibility của permission model. Việc này có thể làm song song, không blocking.
